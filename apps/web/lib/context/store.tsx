"use client";

// Storefront/learner client state: catalog + enrollments come from the live
// API, role from the session, region from localStorage. The cart is hybrid —
// guests use localStorage, authenticated users use the /cart API — with a
// one-shot merge on login so items added while logged-out survive sign-in.
// Course content (sections) is loaded from the API; quiz answers stay
// server-side (the quiz player calls the quiz API directly). Instructor/
// delivery-partner/org portals use their own dedicated API hooks
// (lib/api/endpoints.ts), not this store.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_REGION, FALLBACK_REGION, type RegionRow } from "@/lib/pricing";
import { toast } from "sonner";
import { api } from "@/lib/api/endpoints";
import { useCatalog } from "@/lib/api/hooks";
import { qk } from "@/lib/api/query-keys";
import { ApiError, getApiErrorMessage } from "@/lib/api/errors";
import { useSession } from "@/lib/api/session";
import { cartApi } from "@/lib/api/cart";
import type {
  CartDto,
  CourseSummaryDto,
  EnrollmentDto,
} from "@skillstream/shared";

/** Completed-lesson-id map keyed by courseId, from the user's enrollments. */
function enrollmentsToProgress(
  enrollments: EnrollmentDto[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of enrollments) out[e.courseId] = e.completedLessonIds;
  return out;
}

export type Role =
  | "guest"
  | "student"
  | "instructor"
  | "admin"
  | "delivery_partner"
  | "org_admin";

export interface MyReview {
  id?: string;
  rating: number;
  body: string;
  date: string;
  status: "PENDING" | "APPROVED" | "HIDDEN";
  progressPercent: number;
  ratingStage: "STARTED" | "IN_PROGRESS" | "COMPLETED";
  ratingWeight: number;
}

const CART_KEY = "skillstream_cart_v2";
/** One discount/referral code field — the backend resolves whether it's a
 *  coupon or a delivery-partner campaign code (see CodeResolverService). */
const CART_CODE_KEY = "skillstream_cart_code_v1";
const REGION_KEY = "skillstream_region_v2";

const ROLE_FROM_SESSION: Record<string, Role> = {
  STUDENT: "student",
  INSTRUCTOR: "instructor",
  ADMIN: "admin",
  DELIVERY_PARTNER: "delivery_partner",
  ORG_ADMIN: "org_admin",
};

interface StoreContextValue {
  mounted: boolean;
  role: Role;
  // region
  regionCode: string;
  region: RegionRow;
  /** Every region the storefront can price in (from the API). */
  regions: RegionRow[];
  setRegionCode: (code: string) => void;
  // cart
  cart: string[];
  /**
   * True while the authoritative cart is still being fetched from the server
   * for an authenticated user. The checkout page uses this to avoid flashing
   * an "empty cart" state on the round-trip back from an external payment
   * gateway (Stripe/PayPal cancel), where the page fully reloads and the
   * in-memory cart is [] until the server cart resolves.
   */
  cartLoading: boolean;
  /** A discount/referral code — coupon or delivery-partner campaign, the
   *  backend tells them apart (see QuoteDto.appliedCode). */
  code: string | null;
  addToCart: (courseId: string) => void;
  removeFromCart: (courseId: string) => void;
  clearCart: () => void;
  inCart: (courseId: string) => boolean;
  setCode: (code: string | null) => void;
  // enrollment + progress
  enrolled: string[];
  isEnrolled: (courseId: string) => boolean;
  toggleLesson: (courseId: string, lessonId: string) => void;
  isLessonDone: (courseId: string, lessonId: string) => boolean;
  completedCount: (courseId: string) => number;
  // reviews
  getMyReview: (courseId: string) => MyReview | undefined;
  submitReview: (
    courseId: string,
    rating: number,
    body: string,
  ) => void;
  // courses
  courses: CourseSummaryDto[];
}

const StoreContext = createContext<StoreContextValue | null>(null);

function readGuestCart(): string[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function readGuestCode(): string | null {
  try {
    return localStorage.getItem(CART_CODE_KEY);
  } catch {
    return null;
  }
}

function wipeGuestCart() {
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(CART_CODE_KEY);
  } catch {
    /* ignore */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const cartRestricted = user?.role === "ORG_ADMIN" || user?.role === "DELIVERY_PARTNER" || user?.role === "INSTRUCTOR";
  const serverCartKey = useMemo(() => ["store", "cart", user?.id ?? "guest"] as const, [user?.id]);
  const [mounted, setMounted] = useState(false);

  // ── cart / code ──
  // Local mirror so the UI reads synchronously. The source of truth is
  // localStorage for guests and the server for authenticated users; both
  // paths keep this state in sync.
  const [cart, setCart] = useState<string[]>([]);
  const [code, setCodeState] = useState<string | null>(null);
  const [regionCode, setRegionCodeState] = useState<string>(DEFAULT_REGION);

  // ── client caches (my reviews) ──
  const [myReviews, setMyReviews] = useState<Record<string, MyReview>>({});

  // Track whether we've already merged this login. Prevents a second merge if
  // the user object identity flips (e.g. a profile refetch) after login.
  const mergedForUserRef = useRef<string | null>(null);
  // Tracks the previous authenticated user id so we can detect a logout
  // transition (truthy → null) and wipe cart state from device storage.
  // A first-load guest must NOT trigger the wipe — that would nuke a cart
  // they built up while logged out.
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Restore persisted client state after mount. Deferred to a task so the
    // effect body only schedules work instead of setting state synchronously
    // (which would cascade a render before paint).
    const id = setTimeout(() => {
      try {
        setCart(readGuestCart());
        setCodeState(readGuestCode());
        const r = localStorage.getItem(REGION_KEY);
        if (r) setRegionCodeState(r);
      } catch {
        /* ignore */
      }
      setMounted(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Region persists per-device, not per-user.
  useEffect(() => {
    if (mounted) localStorage.setItem(REGION_KEY, regionCode);
  }, [regionCode, mounted]);

  const setRegionCode = useCallback(
    (code: string) => {
      setRegionCodeState(code);
      // Registration redirects immediately after success, so persist here as
      // well as in the effect above. That makes its selected country available
      // to cart and checkout on the very first page after signup.
      if (mounted) localStorage.setItem(REGION_KEY, code);
    },
    [mounted],
  );

  // Guest cart persists to localStorage. Skip while authenticated so the
  // server-owned cart isn't mirrored into device storage.
  useEffect(() => {
    if (!mounted || user) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart, mounted, user]);
  useEffect(() => {
    if (!mounted || user) return;
    try {
      if (code && cart.length > 0) localStorage.setItem(CART_CODE_KEY, code);
      else localStorage.removeItem(CART_CODE_KEY);
    } catch {
      /* ignore */
    }
  }, [code, cart, mounted, user]);

  // ── pricing regions (rates refreshed daily server-side) ──
  const { data: regionList } = useQuery({
    queryKey: ["store", "regions"],
    queryFn: () => api.regions(),
    // Rates only move once a day; no reason to refetch on every mount.
    staleTime: 60 * 60 * 1000,
  });
  const regions = regionList?.length ? regionList : [FALLBACK_REGION];
  // An unknown saved code (a region the admin since removed) must resolve to US,
  // matching `pricing.service.ts#resolveRegion` — falling back to regions[0]
  // would price the user as whoever sorts first while checkout charges them US.
  const region =
    regions?.find((r) => r.code === regionCode) ??
    regions?.find((r) => r.code === DEFAULT_REGION) ??
    FALLBACK_REGION;
  // Once an account is known, its profile country is the default pricing region.
  // Guests may still choose a region manually; this prevents a stale device setting
  // from leaving an authenticated learner on the wrong regional price.
  useEffect(() => {
    const profileRegionCode = user?.country?.trim().toUpperCase();
    if (!mounted || !profileRegionCode || !regionList?.some((r) => r.code === profileRegionCode)) return;
    // The profile country is the authoritative default after authentication.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRegionCodeState((current) => (current === profileRegionCode ? current : profileRegionCode));
  }, [mounted, regionList, user?.country]);

  // ── catalog (published summaries) ──
  const { data: courseList } = useCatalog();
  const courses: CourseSummaryDto[] = courseList?.items ?? [];

  // ── enrollments / progress ──
  const { data: enrollments } = useQuery({
    queryKey: qk.enrollments,
    queryFn: () => api.myEnrollments(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const enrolled = useMemo(
    () =>
      (enrollments ?? [])
        .filter(
          (e) =>
            e.status === "IN_PROGRESS" || e.status === "COMPLETED",
        )
        .map((e) => e.courseId),
    [enrollments],
  );
  const progress = useMemo(
    () => enrollmentsToProgress(enrollments ?? []),
    [enrollments],
  );

  useEffect(() => {
    if (!user || !enrollments?.length) return;
    let cancelled = false;
    void Promise.all(
      enrollments
        .filter((e) => e.status === "IN_PROGRESS" || e.status === "COMPLETED")
        .map(async (e) => [e.courseId, await api.myReview(e.courseId)] as const),
    )
      .then((entries) => {
        if (cancelled) return;
        setMyReviews((current) => {
          const next = { ...current };
          for (const [courseId, review] of entries) {
            if (review) {
              next[courseId] = {
                id: review.id,
                rating: review.rating,
                body: review.body,
                date: review.createdAt,
                status: review.status,
                progressPercent: review.progressPercent,
                ratingStage: review.ratingStage,
                ratingWeight: review.ratingWeight,
              };
            } else {
              delete next[courseId];
            }
          }
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, enrollments]);
  const refetchEnrollments = useCallback(
    () => qc.invalidateQueries({ queryKey: qk.enrollments }),
    [qc],
  );

  // ── server cart (auth'd users only) ──
  // Swallow 401 → null so a logout-time refetch race (useLogout calls
  // qc.clear(), which triggers active queries to refetch before the user
  // state has propagated through render) doesn't surface as a toast.
  const {
    data: serverCart,
    refetch: refetchCart,
    isPending: serverCartPending,
    fetchStatus: serverCartFetchStatus,
  } = useQuery({
    queryKey: serverCartKey,
    queryFn: async () => {
      try {
        return await cartApi.get();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    enabled: !!user && !cartRestricted && mounted,
    staleTime: 30_000,
    retry: false,
  });

  // Loading is only meaningful for authenticated users — guests read from
  // localStorage synchronously. We combine `isPending` (no data yet) with
  // `fetchStatus !== "idle"` so a disabled query (guest / pre-mount) is not
  // counted as loading.
  const cartLoading =
    !!user &&
    !cartRestricted &&
    mounted &&
    serverCartPending &&
    serverCartFetchStatus !== "idle";

  const applyServerCart = useCallback((dto: CartDto) => {
    setCart(dto.items?.map((i) => i.courseId) ?? []);
    setCodeState(dto.code);
  }, []);

  // On login: merge guest cart into DB once, then adopt the server cart as
  // the source of truth. On logout: reset in-memory cart so the next visitor
  // on this device sees an empty cart.
  useEffect(() => {
    if (!mounted) return;

    if (!user) {
      mergedForUserRef.current = null;
      // Logout transition: previous render had a signed-in user, now null.
      // Wipe the persisted cart + code so the next visitor on this device
      // (or the same user opening a new tab) doesn't inherit stale items.
      if (prevUserIdRef.current) {
        wipeGuestCart();
        setCart([]);
        setCodeState(null);
        prevUserIdRef.current = null;
        return;
      }
      // First-load guest — hydrate from localStorage.
      setCart(readGuestCart());
      setCodeState(readGuestCode());
      return;
    }

    prevUserIdRef.current = user.id;
    if (cartRestricted) {
      mergedForUserRef.current = user.id;
      setCart([]);
      setCodeState(null);
      return;
    }
    if (mergedForUserRef.current === user.id) return;
    mergedForUserRef.current = user.id;

    const guestItems = readGuestCart();
    const guestCode = guestItems.length > 0 ? readGuestCode() : null;
    const shouldMerge = guestItems.length > 0;

    const run = shouldMerge
      ? cartApi.merge({
        courseIds: guestItems,
        code: guestCode ?? undefined,
      })
      : cartApi.get();

    run
      .then((dto) => {
        wipeGuestCart();
        applyServerCart(dto);
        qc.setQueryData(serverCartKey, dto);
      })
      .catch((err) => {
        // Reset the guard so a manual retry (e.g. reopening the cart) will
        // attempt the merge again instead of silently sticking to localStorage.
        mergedForUserRef.current = null;
        // 401 during a logout race isn't user-actionable — session already
        // turned over. Swallow it silently and let the guest-hydrate path
        // that runs on the next render take over.
        if (err instanceof ApiError && err.status === 401) return;
        toast.error(getApiErrorMessage(err));
      });
  }, [user, cartRestricted, serverCartKey, mounted, applyServerCart, qc]);

  // Adopt query updates (e.g. after a background refetch) into local state.
  // A null result means the server responded 401 — treated as "not signed in",
  // so we leave in-memory state alone and let the user-change effect handle it.
  useEffect(() => {
    if (serverCart && user && !cartRestricted) applyServerCart(serverCart);
  }, [serverCart, user, cartRestricted, applyServerCart]);

  const role: Role = user ? ROLE_FROM_SESSION[user.role] ?? "student" : "guest";

  // Optimistic mutation helper: applies the local change immediately, fires
  // the API call, rolls back and toasts on failure.
  const runServerMutation = useCallback(
    (
      optimistic: () => { rollback: () => void },
      fn: () => Promise<CartDto>,
    ) => {
      const { rollback } = optimistic();
      fn()
        .then((dto) => {
          applyServerCart(dto);
          qc.setQueryData(serverCartKey, dto);
        })
        .catch((err) => {
          rollback();
          // 401 during a logout race isn't user-actionable — swallow silently.
          if (err instanceof ApiError && err.status === 401) return;
          toast.error(getApiErrorMessage(err));
          void refetchCart();
        });
    },
    [applyServerCart, qc, refetchCart, serverCartKey],
  );

  const addToCart = useCallback(
    (courseId: string) => {
      if (user && cartRestricted) return;
      if (!user) {
        setCart((c) => (c.includes(courseId) ? c : [...c, courseId]));
        return;
      }
      runServerMutation(
        () => {
          const prev = cart;
          setCart((c) => (c.includes(courseId) ? c : [...c, courseId]));
          return { rollback: () => setCart(prev) };
        },
        () => cartApi.addItem(courseId),
      );
    },
    [user, cartRestricted, cart, runServerMutation],
  );

  const removeFromCart = useCallback(
    (courseId: string) => {
      if (user && cartRestricted) return;
      if (!user) {
        // Dropping the last item must drop the code too — otherwise it
        // silently reapplies to whatever gets added next.
        setCart((c) => {
          const next = c.filter((x) => x !== courseId);
          if (next.length === 0) setCodeState(null);
          return next;
        });
        return;
      }
      runServerMutation(
        () => {
          const prev = cart;
          setCart((c) => c.filter((x) => x !== courseId));
          return { rollback: () => setCart(prev) };
        },
        () => cartApi.removeItem(courseId),
      );
    },
    [user, cartRestricted, cart, runServerMutation],
  );

  const clearCart = useCallback(() => {
    if (user && cartRestricted) return;
    if (!user) {
      setCart([]);
      setCodeState(null);
      return;
    }
    runServerMutation(
      () => {
        const prevCart = cart;
        const prevCode = code;
        setCart([]);
        setCodeState(null);
        return {
          rollback: () => {
            setCart(prevCart);
            setCodeState(prevCode);
          },
        };
      },
      () => cartApi.clear(),
    );
  }, [user, cartRestricted, cart, code, runServerMutation]);

  const setCode = useCallback(
    (next: string | null) => {
      if (user && cartRestricted) return;
      if (!user) {
        setCodeState(next);
        return;
      }
      runServerMutation(
        () => {
          const prev = code;
          setCodeState(next);
          return { rollback: () => setCodeState(prev) };
        },
        () => cartApi.setCode(next),
      );
    },
    [user, cartRestricted, code, runServerMutation],
  );

  const value: StoreContextValue = {
    mounted,
    role,
    // region
    regionCode,
    region,
    regions,
    setRegionCode,
    // cart
    cart,
    cartLoading,
    code,
    addToCart,
    removeFromCart,
    clearCart,
    inCart: (id) => cart?.includes(id) ?? false,
    setCode,
    // enrollment + progress
    enrolled,
    isEnrolled: (id) => enrolled?.includes(id) ?? false,
    toggleLesson: (courseId, lessonId) => {
      void api
        .toggleLesson(courseId, lessonId)
        .then(refetchEnrollments)
        .catch((err) => toast.error(getApiErrorMessage(err)));
    },
    isLessonDone: (courseId, lessonId) =>
      (progress[courseId] ?? []).includes(lessonId),
    completedCount: (courseId) => (progress[courseId] ?? []).length,
    // reviews
    getMyReview: (courseId) => myReviews[courseId],
    submitReview: (courseId, rating, body) => {
      const previous = myReviews[courseId];
      setMyReviews((m) => ({
        ...m,
        [courseId]: {
          ...previous,
          rating,
          body,
          date: new Date().toISOString(),
          status: "PENDING",
          progressPercent: previous?.progressPercent ?? 0,
          ratingStage: previous?.ratingStage ?? "STARTED",
          ratingWeight: previous?.ratingWeight ?? 0.35,
        },
      }));
      void api
        .submitReview(courseId, { rating, body })
        .then((review) => {
          setMyReviews((m) => ({
            ...m,
            [courseId]: {
              id: review.id,
              rating: review.rating,
              body: review.body,
              date: review.createdAt,
              status: review.status,
              progressPercent: review.progressPercent,
              ratingStage: review.ratingStage,
              ratingWeight: review.ratingWeight,
            },
          }));
          void qc.invalidateQueries({ queryKey: qk.reviews(courseId) });
        })
        .catch((err) => {
          setMyReviews((m) => {
            const next = { ...m };
            if (previous) next[courseId] = previous;
            else delete next[courseId];
            return next;
          });
          toast.error(getApiErrorMessage(err));
        });
    },
    // courses
    courses,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
