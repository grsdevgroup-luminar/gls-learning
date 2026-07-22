"use client";

// Storefront/learner client state: catalog + enrollments come from the live
// API, role from the session, cart/region from localStorage. Course content
// (sections) is loaded from the API; quiz answers stay server-side (the quiz
// player calls the quiz API directly). Instructor/sales-agent/org portals use
// their own dedicated API hooks (lib/api/endpoints.ts), not this store.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MAX_PAGE_SIZE } from "@skillstream/shared";
import { DEFAULT_REGION, FALLBACK_REGION, type RegionRow } from "@/lib/pricing";
import { captureReferralFromUrl } from "@/lib/referral";
import { api } from "@/lib/api/endpoints";
import {
  enrollmentsToProgress,
  toLegacyCourse,
  toLegacyCourseDetail,
} from "@/lib/api/adapters";
import { useSession } from "@/lib/api/session";
import type { Course } from "@/types";

export type Role =
  | "guest"
  | "student"
  | "instructor"
  | "admin"
  | "sales_agent"
  | "org_admin";

export interface QuizResult {
  bestScore: number;
  lastScore: number;
  attempts: number;
  passed: boolean;
  lastAttemptAt: string;
}

export interface MyReview {
  rating: number;
  title: string;
  body: string;
  date: string;
}

const CART_KEY = "skillstream_cart_v2";
const REGION_KEY = "skillstream_region_v2";

const ROLE_FROM_SESSION: Record<string, Role> = {
  STUDENT: "student",
  INSTRUCTOR: "instructor",
  ADMIN: "admin",
  SALES_AGENT: "sales_agent",
  ORG_ADMIN: "org_admin",
};

function quizKey(courseId: string, lessonId: string) {
  return `${courseId}:${lessonId}`;
}

// `mounted` flips to true after hydration without a setState-in-effect.
const noopSubscribe = () => () => {};

// localStorage is client-only; read it lazily so SSR/hydration still render
// the defaults, exactly as the mount effect used to deliver them.
function readStoredCart(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const c = localStorage.getItem(CART_KEY);
    return c ? JSON.parse(c) : [];
  } catch {
    return [];
  }
}

function readStoredRegion(): string {
  if (typeof window === "undefined") return DEFAULT_REGION;
  try {
    return localStorage.getItem(REGION_KEY) || DEFAULT_REGION;
  } catch {
    return DEFAULT_REGION;
  }
}

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
  enroll: (courseIds: string[]) => void;
  toggleLesson: (courseId: string, lessonId: string) => void;
  isLessonDone: (courseId: string, lessonId: string) => boolean;
  completedCount: (courseId: string) => number;
  // quizzes (client cache; server grading happens in the quiz API)
  getQuizResult: (courseId: string, lessonId: string) => QuizResult | undefined;
  submitQuizAttempt: (
    courseId: string,
    lessonId: string,
    scorePercent: number,
    passScore: number,
  ) => QuizResult;
  // reviews
  getMyReview: (courseId: string) => MyReview | undefined;
  submitReview: (
    courseId: string,
    rating: number,
    title: string,
    body: string,
  ) => void;
  // courses
  courses: Course[];
  getCourse: (id: string) => Course | undefined;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const [mounted, setMounted] = useState(false);

  // ── client-only state (cart / region) ──
  const [cart, setCart] = useState<string[]>([]);
  const [coupon, setCouponState] = useState<string | null>(null);
  const [regionCode, setRegionCodeState] = useState<string>(DEFAULT_REGION);

  // ── client caches (quiz results / my reviews) ──
  const [quizResults, setQuizResults] = useState<Record<string, QuizResult>>({});
  const [myReviews, setMyReviews] = useState<Record<string, MyReview>>({});
  const [detailsById, setDetailsById] = useState<Record<string, Course>>({});

  useEffect(() => {
    try {
      const c = localStorage.getItem(CART_KEY);
      if (c) setCart(JSON.parse(c));
      const r = localStorage.getItem(REGION_KEY);
      if (r) setRegionCodeState(r);
    } catch {
      /* ignore */
    }
    captureReferralFromUrl();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, mounted]);
  useEffect(() => {
    if (mounted) localStorage.setItem(REGION_KEY, regionCode);
  }, [regionCode, mounted]);

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
  const { data: courseList } = useQuery({
    queryKey: ["store", "courses"],
    queryFn: () => api.courses({ pageSize: MAX_PAGE_SIZE }),
    staleTime: 60_000,
  });
  const courses = useMemo<Course[]>(() => {
    const summaries = (courseList?.items ?? []).map(toLegacyCourse);
    // Prefer fully-loaded details (with curriculum) when available.
    return summaries.map((c) => detailsById[c.id] ?? c);
  }, [courseList, detailsById]);

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

  // Lazily load a course's full curriculum into the details cache.
  const ensureDetail = useCallback(
    async (idOrSlug: string) => {
      const known =
        courseList?.items.find(
          (c) => c.id === idOrSlug || c.slug === idOrSlug,
        ) ?? null;
      const slug = known?.slug ?? idOrSlug;
      try {
        const detail = await api.course(slug);
        setDetailsById((m) => ({ ...m, [detail.id]: toLegacyCourseDetail(detail) }));
      } catch {
        /* ignore */
      }
    },
    [courseList],
  );

  const getCourse = useCallback(
    (id: string): Course | undefined => {
      const found =
        detailsById[id] ?? courses.find((c) => c.id === id || c.slug === id);
      if (found && detailsById[found.id] === undefined) void ensureDetail(id);
      return found;
    },
    [courses, detailsById, ensureDetail],
  );

  const refetchEnrollments = useCallback(
    () => qc.invalidateQueries({ queryKey: ["store", "enrollments"] }),
    [qc],
  );

  const role: Role = user ? ROLE_FROM_SESSION[user.role] ?? "student" : "guest";

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
    addToCart: (id) => setCart((c) => (c.includes(id) ? c : [...c, id])),
    removeFromCart: (id) => setCart((c) => c.filter((x) => x !== id)),
    clearCart: () => {
      setCart([]);
      setCouponState(null);
    },
    inCart: (id) => cart.includes(id),
    setCoupon: setCouponState,
    // enrollment + progress
    enrolled,
    isEnrolled: (id) => enrolled.includes(id),
    enroll: (ids) => {
      void Promise.allSettled(ids.map((id) => api.enrollFree(id))).then(
        refetchEnrollments,
      );
    },
    toggleLesson: (courseId, lessonId) => {
      void api.toggleLesson(courseId, lessonId).then(refetchEnrollments);
    },
    isLessonDone: (courseId, lessonId) =>
      (progress[courseId] ?? []).includes(lessonId),
    completedCount: (courseId) => (progress[courseId] ?? []).length,
    // quizzes
    getQuizResult: (courseId, lessonId) =>
      quizResults[quizKey(courseId, lessonId)],
    submitQuizAttempt: (courseId, lessonId, scorePercent, passScore) => {
      const key = quizKey(courseId, lessonId);
      const prev = quizResults[key];
      const passed = scorePercent >= passScore;
      const result: QuizResult = {
        bestScore: Math.max(prev?.bestScore ?? 0, scorePercent),
        lastScore: scorePercent,
        attempts: (prev?.attempts ?? 0) + 1,
        passed: passed || !!prev?.passed,
        lastAttemptAt: new Date().toISOString(),
      };
      setQuizResults((m) => ({ ...m, [key]: result }));
      return result;
    },
    // reviews
    getMyReview: (courseId) => myReviews[courseId],
    submitReview: (courseId, rating, title, body) => {
      setMyReviews((m) => ({
        ...m,
        [courseId]: { rating, title, body, date: new Date().toISOString().slice(0, 10) },
      }));
      void api.submitReview(courseId, { rating, title, body }).catch(() => undefined);
    },
    // courses
    courses,
    getCourse,
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
