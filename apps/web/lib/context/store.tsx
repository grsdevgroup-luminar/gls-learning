"use client";

// Storefront/learner client state: catalog + enrollments come from the live
// API, role from the session, region from localStorage. The cart is hybrid —
// guests use localStorage, authenticated users use the /cart API — with a
// one-shot merge on login so items added while logged-out survive sign-in.
// Course content (sections) is loaded from the API; quiz answers stay
// server-side (the quiz player calls the quiz API directly). Instructor/
// sales-agent/org portals use their own dedicated API hooks
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
import { captureReferralFromUrl } from "@/lib/referral";
import { api } from "@/lib/api/endpoints";
import { useCatalog } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
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
  | "sales_agent"
  | "org_admin";

export interface MyReview {
  rating: number;
  title: string;
  body: string;
  date: string;
}

const CART_KEY = "skillstream_cart_v2";
const CART_COUPON_KEY = "skillstream_cart_coupon_v2";
const REGION_KEY = "skillstream_region_v2";

const ROLE_FROM_SESSION: Record<string, Role> = {
  STUDENT: "student",
  INSTRUCTOR: "instructor",
  ADMIN: "admin",
  SALES_AGENT: "sales_agent",
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
  coupon: string | null;
  addToCart: (courseId: string) => void;
  removeFromCart: (courseId: string) => void;
  clearCart: () => void;
  inCart: (courseId: string) => boolean;
  setCoupon: (code: string | null) => void;
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
    title: string,
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

function readGuestCoupon(): string | null {
  try {
    return localStorage.getItem(CART_COUPON_KEY);
  } catch {
    return null;
  }
}

function wipeGuestCart() {
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(CART_COUPON_KEY);
  } catch {
    /* ignore */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const [mounted, setMounted] = useState(false);

  // ── cart / coupon ──
  // Local mirror so the UI reads synchronously. The source of truth is
  // localStorage for guests and the server for authenticated users; both
  // paths keep this state in sync.
  const [cart, setCart] = useState<string[]>([]);
  const [coupon, setCouponState] = useState<string | null>(null);
  const [regionCode, setRegionCodeState] = useState<string>(DEFAULT_REGION);

  // ── client caches (my reviews) ──
  const [myReviews, setMyReviews] = useState<Record<string, MyReview>>({});

  // Track whether we've already merged this login. Prevents a second merge if
  // the user object identity flips (e.g. a profile refetch) after login.
  const mergedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    // Restore persisted client state after mount. Deferred to a task so the
    // effect body only schedules work instead of setting state synchronously
    // (which would cascade a render before paint).
    const id = setTimeout(() => {
      try {
        setCart(readGuestCart());
        setCouponState(readGuestCoupon());
        const r = localStorage.getItem(REGION_KEY);
        if (r) setRegionCodeState(r);
      } catch {
        /* ignore */
      }
      setMounted(true);
    }, 0);
    captureReferralFromUrl();
    return () => clearTimeout(id);
  }, []);

  // Region persists per-device, not per-user.
  useEffect(() => {
    if (mounted) localStorage.setItem(REGION_KEY, regionCode);
  }, [regionCode, mounted]);

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
      if (coupon) localStorage.setItem(CART_COUPON_KEY, coupon);
      else localStorage.removeItem(CART_COUPON_KEY);
    } catch {
      /* ignore */
    }
  }, [coupon, mounted, user]);

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
    regions.find((r) => r.code === regionCode) ??
    regions.find((r) => r.code === DEFAULT_REGION) ??
    FALLBACK_REGION;

  // ── catalog (published summaries) ──
  const { data: courseList } = useCatalog();
  const courses: CourseSummaryDto[] = courseList?.items ?? [];

  // ── enrollments / progress ──
  const { data: enrollments } = useQuery({
    queryKey: ["store", "enrollments"],
    queryFn: () => api.myEnrollments(),
    enabled: !!user,
    staleTime: 30_000,
  });
  const enrolled = useMemo(
    () => (enrollments ?? []).map((e) => e.courseId),
    [enrollments],
  );
  const progress = useMemo(
    () => enrollmentsToProgress(enrollments ?? []),
    [enrollments],
  );

  const refetchEnrollments = useCallback(
    () => qc.invalidateQueries({ queryKey: ["store", "enrollments"] }),
    [qc],
  );

  // ── server cart (auth'd users only) ──
  const {
    data: serverCart,
    refetch: refetchCart,
  } = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => cartApi.get(),
    enabled: !!user && mounted,
    staleTime: 30_000,
  });

  const applyServerCart = useCallback((dto: CartDto) => {
    setCart(dto.items.map((i) => i.courseId));
    setCouponState(dto.couponCode);
  }, []);

  // On login: merge guest cart into DB once, then adopt the server cart as
  // the source of truth. On logout: reset in-memory cart so the next visitor
  // on this device sees an empty cart.
  useEffect(() => {
    if (!mounted) return;

    if (!user) {
      mergedForUserRef.current = null;
      // Hydrate from localStorage for guest browsing.
      setCart(readGuestCart());
      setCouponState(readGuestCoupon());
      return;
    }

    if (mergedForUserRef.current === user.id) return;
    mergedForUserRef.current = user.id;

    const guestItems = readGuestCart();
    const guestCoupon = readGuestCoupon();
    const shouldMerge = guestItems.length > 0 || !!guestCoupon;

    const run = shouldMerge
      ? cartApi.merge({
          courseIds: guestItems,
          couponCode: guestCoupon ?? undefined,
        })
      : cartApi.get();

    run
      .then((dto) => {
        wipeGuestCart();
        applyServerCart(dto);
        qc.setQueryData(["store", "cart"], dto);
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err));
        // Reset the guard so a manual retry (e.g. reopening the cart) will
        // attempt the merge again instead of silently sticking to localStorage.
        mergedForUserRef.current = null;
      });
  }, [user, mounted, applyServerCart, qc]);

  // Adopt query updates (e.g. after a background refetch) into local state.
  useEffect(() => {
    if (serverCart && user) applyServerCart(serverCart);
  }, [serverCart, user, applyServerCart]);

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
          qc.setQueryData(["store", "cart"], dto);
        })
        .catch((err) => {
          rollback();
          toast.error(getApiErrorMessage(err));
          void refetchCart();
        });
    },
    [applyServerCart, qc, refetchCart],
  );

  const addToCart = useCallback(
    (courseId: string) => {
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
    [user, cart, runServerMutation],
  );

  const removeFromCart = useCallback(
    (courseId: string) => {
      if (!user) {
        setCart((c) => c.filter((x) => x !== courseId));
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
    [user, cart, runServerMutation],
  );

  const clearCart = useCallback(() => {
    if (!user) {
      setCart([]);
      setCouponState(null);
      return;
    }
    runServerMutation(
      () => {
        const prevCart = cart;
        const prevCoupon = coupon;
        setCart([]);
        setCouponState(null);
        return {
          rollback: () => {
            setCart(prevCart);
            setCouponState(prevCoupon);
          },
        };
      },
      () => cartApi.clear(),
    );
  }, [user, cart, coupon, runServerMutation]);

  const setCoupon = useCallback(
    (code: string | null) => {
      if (!user) {
        setCouponState(code);
        return;
      }
      runServerMutation(
        () => {
          const prev = coupon;
          setCouponState(code);
          return { rollback: () => setCouponState(prev) };
        },
        () => cartApi.setCoupon(code),
      );
    },
    [user, coupon, runServerMutation],
  );

  const value: StoreContextValue = {
    mounted,
    role,
    // region
    regionCode,
    region,
    regions,
    setRegionCode: setRegionCodeState,
    // cart
    cart,
    coupon,
    addToCart,
    removeFromCart,
    clearCart,
    inCart: (id) => cart.includes(id),
    setCoupon,
    // enrollment + progress
    enrolled,
    isEnrolled: (id) => enrolled.includes(id),
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
    submitReview: (courseId, rating, title, body) => {
      setMyReviews((m) => ({
        ...m,
        [courseId]: { rating, title, body, date: new Date().toISOString().slice(0, 10) },
      }));
      void api.submitReview(courseId, { rating, title, body }).catch((err) => {
        // Roll the optimistic copy back so the UI doesn't claim a review landed.
        setMyReviews((m) => {
          const rest = { ...m };
          delete rest[courseId];
          return rest;
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
