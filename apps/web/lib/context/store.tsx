"use client";

// Real-data-backed replacement for the former mock/localStorage store. Preserves
// the useStore() interface the UI already consumes, but sources data from the
// live API (catalog, enrollments) + session (role) + localStorage (cart/region).
// Course content (sections) is loaded from the API; quiz answers stay server-side
// (the quiz player calls the quiz API directly).
//
// Note: instructor/sales-agent/organization program surfaces expose minimal
// facade state here; those portals should migrate to their dedicated API hooks.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_REGION, getRegion } from "@/lib/mock/pricing";
import { captureReferralFromUrl } from "@/lib/referral";
import { api } from "@/lib/api/endpoints";
import {
  enrollmentsToProgress,
  toLegacyCourse,
  toLegacyCourseDetail,
} from "@/lib/api/adapters";
import { useSession } from "@/lib/api/session";
import type {
  Course,
  CourseStatus,
  Instructor,
  InstructorApplication,
  InstructorStatus,
  SalesAgent,
  SalesAgentApplication,
  Organization,
  OrgMemberRole,
} from "@/types";

export type Role =
  | "guest"
  | "student"
  | "instructor"
  | "admin"
  | "sales_agent"
  | "org_admin";

export const DEMO_INSTRUCTOR_ID = "ins_sara";
export const DEMO_AGENT_ID = "agent_demo";
export const DEMO_ORG_SLUG = "acme";
export const DEMO_STUDENT_ID = "stu_alex";

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

interface StoreContextValue {
  mounted: boolean;
  role: Role;
  // region
  regionCode: string;
  region: ReturnType<typeof getRegion>;
  setRegionCode: (code: string) => void;
  // cart
  cart: string[];
  coupon: string | null;
  addToCart: (courseId: string) => void;
  removeFromCart: (courseId: string) => void;
  clearCart: () => void;
  inCart: (courseId: string) => boolean;
  setCoupon: (code: string | null) => void;
  // auth (no-op shims kept for source compatibility; real auth is in useSession)
  login: (asAdmin?: boolean) => void;
  loginAs: (role: Role) => void;
  logout: () => void;
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
  upsertCourse: (course: Course) => void;
  deleteCourse: (id: string) => void;
  setCourseStatus: (id: string, status: CourseStatus) => void;
  reset: () => void;
  // instructor program (facade)
  currentInstructor: Instructor | null;
  getInstructorById: (id: string) => Instructor | undefined;
  instructorStatusOf: (id: string) => InstructorStatus | undefined;
  myCourses: Course[];
  loginAsInstructor: (instructorId?: string) => void;
  applyAsInstructor: (data: {
    name: string;
    email: string;
    expertise: string;
    headline: string;
    bio: string;
    sampleUrl?: string;
  }) => string;
  approveInstructor: (applicationId: string, note?: string) => void;
  rejectInstructor: (applicationId: string, note?: string) => void;
  updateInstructorProfile: (partial: Partial<Instructor>) => void;
  instructorApplications: InstructorApplication[];
  // sales agent program (facade)
  allAgents: SalesAgent[];
  currentAgent: SalesAgent | null;
  agentApplications: SalesAgentApplication[];
  loginAsAgent: (agentId?: string) => void;
  applyAsSalesAgent: (data: {
    name: string;
    email: string;
    phone?: string;
    region: string;
    bio: string;
  }) => string;
  approveAgent: (
    applicationId: string,
    commissionPercent: number,
    note?: string,
  ) => void;
  rejectAgent: (applicationId: string, note?: string) => void;
  updateAgentCommission: (agentId: string, commissionPercent: number) => void;
  suspendAgent: (agentId: string) => void;
  // organizations (facade)
  allOrganizations: Organization[];
  currentOrg: Organization | null;
  loginAsOrgAdmin: (orgSlug?: string) => void;
  createOrganization: (data: {
    name: string;
    slug: string;
    domain?: string;
    adminEmail: string;
    seatCount: number;
  }) => string;
  updateOrganization: (
    orgId: string,
    partial: Partial<
      Pick<Organization, "name" | "domain" | "logoUrl" | "seatCount" | "status">
    >,
  ) => void;
  assignOrgCourse: (orgId: string, courseId: string) => void;
  unassignOrgCourse: (orgId: string, courseId: string) => void;
  inviteOrgMember: (orgId: string, email: string, role: OrgMemberRole) => void;
  removeOrgMember: (orgId: string, memberId: string) => void;
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

  // ── catalog (published summaries) ──
  const { data: courseList } = useQuery({
    queryKey: ["store", "courses"],
    queryFn: () => api.courses({ pageSize: 100 }),
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
    region: getRegion(regionCode),
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
    // auth shims (real auth lives in useSession/useLogin/useLogout)
    login: () => undefined,
    loginAs: () => undefined,
    logout: () => undefined,
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
    upsertCourse: () => undefined,
    deleteCourse: () => undefined,
    setCourseStatus: () => undefined,
    reset: () => undefined,
    // instructor program (facade — see dedicated API for full behaviour)
    currentInstructor: null,
    getInstructorById: () => undefined,
    instructorStatusOf: () => undefined,
    myCourses: [],
    loginAsInstructor: () => undefined,
    applyAsInstructor: () => "",
    approveInstructor: () => undefined,
    rejectInstructor: () => undefined,
    updateInstructorProfile: () => undefined,
    instructorApplications: [],
    // sales agent program (facade)
    allAgents: [],
    currentAgent: null,
    agentApplications: [],
    loginAsAgent: () => undefined,
    applyAsSalesAgent: () => "",
    approveAgent: () => undefined,
    rejectAgent: () => undefined,
    updateAgentCommission: () => undefined,
    suspendAgent: () => undefined,
    // organizations (facade)
    allOrganizations: [],
    currentOrg: null,
    loginAsOrgAdmin: () => undefined,
    createOrganization: () => "",
    updateOrganization: () => undefined,
    assignOrgCourse: () => undefined,
    unassignOrgCourse: () => undefined,
    inviteOrgMember: () => undefined,
    removeOrgMember: () => undefined,
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
