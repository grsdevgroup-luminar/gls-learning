"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  AutomationRuleDto,
  CheckoutQuoteInput,
  CreateCommentInput,
  CreateReviewInput,
  PatchCouponInput,
  QuizAttemptInput,
  UpdatePlatformSettingsInput,
  UpsertAutomationRuleInput,
  UpsertCouponInput,
} from "@skillstream/shared";
import { api } from "./endpoints";

// Query keys
export const qk = {
  courses: (params?: unknown) => ["courses", params] as const,
  course: (slug: string) => ["course", slug] as const,
  enrollments: ["enrollments"] as const,
  weeklyActivity: ["enrollments", "weekly-activity"] as const,
  progress: (courseId: string) => ["progress", courseId] as const,
  quiz: (lessonId: string) => ["quiz", lessonId] as const,
  quizResult: (lessonId: string) => ["quiz-result", lessonId] as const,
  orders: ["orders"] as const,
  reviews: (courseId: string) => ["reviews", courseId] as const,
  comments: (courseId: string) => ["comments", courseId] as const,
  myReview: (courseId: string) => ["my-review", courseId] as const,
  certificates: ["certificates"] as const,
  adminOverview: ["admin-overview"] as const,
  adminStudents: (params?: unknown) => ["admin-students", params] as const,
  adminOrders: (params?: unknown) => ["admin-orders", params] as const,
  instructorProfile: ["instructor-profile"] as const,
  instructorCourses: ["instructor-courses"] as const,
  salesAgents: ["sales-agents"] as const,
  categories: ["categories"] as const,
  adminCoupons: ["admin-coupons"] as const,
  featuredCoupon: ["featured-coupon"] as const,
  adminSettings: ["admin-settings"] as const,
  automationRules: ["automation-rules"] as const,
  reminderLogs: ["reminder-logs"] as const,
};

// ── catalog ──────────────────────────────────────────────────────────────
export const useCourses = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: qk.courses(params), queryFn: () => api.courses(params) });

export const useCourse = (slug: string) =>
  useQuery({ queryKey: qk.course(slug), queryFn: () => api.course(slug) });

/** Course categories from the API. Rarely change, so cache them for the session. */
export const useCategories = () =>
  useQuery({
    queryKey: qk.categories,
    queryFn: api.categories,
    staleTime: 60 * 60 * 1000,
  });

// ── enrollment / progress ─────────────────────────────────────────────────
export const useMyEnrollments = () =>
  useQuery({ queryKey: qk.enrollments, queryFn: api.myEnrollments });

export const useWeeklyActivity = () =>
  useQuery({ queryKey: qk.weeklyActivity, queryFn: api.myWeeklyActivity });

export const useProgress = (courseId: string, enabled = true) =>
  useQuery({
    queryKey: qk.progress(courseId),
    queryFn: () => api.progress(courseId),
    enabled,
  });

export function useToggleLesson(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lessonId: string) => api.toggleLesson(courseId, lessonId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.progress(courseId) });
      qc.invalidateQueries({ queryKey: qk.enrollments });
    },
  });
}

export function useEnrollFree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => api.enrollFree(courseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.enrollments }),
  });
}

// ── quiz ─────────────────────────────────────────────────────────────────
export const useQuiz = (lessonId: string) =>
  useQuery({ queryKey: qk.quiz(lessonId), queryFn: () => api.quiz(lessonId) });

export function useSubmitQuiz(lessonId: string, courseId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QuizAttemptInput) => api.submitQuiz(lessonId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.quizResult(lessonId) });
      if (courseId) qc.invalidateQueries({ queryKey: qk.progress(courseId) });
    },
  });
}

// ── commerce ──────────────────────────────────────────────────────────────
export function useQuote() {
  return useMutation({ mutationFn: (body: CheckoutQuoteInput) => api.quote(body) });
}

export const useMyOrders = () =>
  useQuery({ queryKey: qk.orders, queryFn: api.myOrders });

// ── reviews ───────────────────────────────────────────────────────────────
export const useCourseReviews = (courseId: string, page = 1) =>
  useQuery({
    queryKey: [...qk.reviews(courseId), page],
    queryFn: () => api.courseReviews(courseId, page),
  });

export function useSubmitReview(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateReviewInput) => api.submitReview(courseId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.myReview(courseId) });
      qc.invalidateQueries({ queryKey: qk.reviews(courseId) });
    },
  });
}

// ── certificates ──────────────────────────────────────────────────────────
export const useMyCertificates = () =>
  useQuery({ queryKey: qk.certificates, queryFn: api.myCertificates });

// ── admin ─────────────────────────────────────────────────────────────────
export const useAdminOverview = () =>
  useQuery({ queryKey: qk.adminOverview, queryFn: api.adminOverview });

export const useAdminStudents = (params: Record<string, string | number | undefined> = {}) =>
  useQuery({ queryKey: qk.adminStudents(params), queryFn: () => api.adminStudents(params) });

export const useAdminOrders = (params: Record<string, string | number | undefined> = {}) =>
  useQuery({ queryKey: qk.adminOrders(params), queryFn: () => api.adminOrders(params) });

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.refundOrder(orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminOrders() }),
  });
}

export function useUpdateUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "ACTIVE" | "IDLE" | "AT_RISK" }) =>
      api.updateUserStatus(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.adminStudents() }),
  });
}

// ── comments ──────────────────────────────────────────────────────────────
export const useCourseComments = (courseId: string) =>
  useQuery({
    queryKey: qk.comments(courseId),
    queryFn: () => api.courseComments(courseId),
  });

export function usePostComment(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCommentInput) => api.postComment(courseId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.comments(courseId) }),
  });
}

// ── platform settings ─────────────────────────────────────────────────────
export const useAdminSettings = () =>
  useQuery({ queryKey: qk.adminSettings, queryFn: api.adminSettings });

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlatformSettingsInput) => api.adminUpdateSettings(input),
    onSuccess: (s) => qc.setQueryData(qk.adminSettings, s),
  });
}

// ── marketing automation ──────────────────────────────────────────────────
export const useAutomationRules = () =>
  useQuery({ queryKey: qk.automationRules, queryFn: api.adminAutomationRules });

export const useReminderLogs = () =>
  useQuery({ queryKey: qk.reminderLogs, queryFn: api.adminReminderLogs });

function useRuleMutation<TArgs, TData>(fn: (args: TArgs) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.automationRules }),
  });
}

export const useCreateAutomationRule = () =>
  useRuleMutation((input: UpsertAutomationRuleInput) => api.adminCreateAutomationRule(input));

/** The API's PATCH takes a full rule body, so callers send the whole rule. */
export const useUpdateAutomationRule = () =>
  useRuleMutation(({ id, ...input }: UpsertAutomationRuleInput & { id: string }) =>
    api.adminUpdateAutomationRule(id, input),
  );

export const useDeleteAutomationRule = () =>
  useRuleMutation((id: string) => api.adminDeleteAutomationRule(id));

/** Body the PATCH expects, derived from an existing rule. */
export const ruleToInput = (r: AutomationRuleDto): UpsertAutomationRuleInput => ({
  name: r.name,
  trigger: r.trigger,
  condition: r.condition,
  channels: r.channels,
  template: r.template,
  active: r.active,
});

// ── coupons ───────────────────────────────────────────────────────────────
export const useFeaturedCoupon = () =>
  useQuery({ queryKey: qk.featuredCoupon, queryFn: api.featuredCoupon });

export const useAdminCoupons = () =>
  useQuery({ queryKey: qk.adminCoupons, queryFn: api.adminCoupons });

/** Any coupon write can change which one is promoted, so both the admin table
 *  and the public banner are refetched. */
function useCouponMutation<TArgs, TData>(fn: (args: TArgs) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.adminCoupons });
      void qc.invalidateQueries({ queryKey: qk.featuredCoupon });
    },
  });
}

export const useUpsertCoupon = () =>
  useCouponMutation((input: UpsertCouponInput) => api.adminUpsertCoupon(input));

export const usePatchCoupon = () =>
  useCouponMutation(({ code, ...input }: PatchCouponInput & { code: string }) =>
    api.adminPatchCoupon(code, input),
  );

export const useDeleteCoupon = () =>
  useCouponMutation((code: string) => api.adminDeleteCoupon(code));

// ── instructor ────────────────────────────────────────────────────────────
export const useInstructorProfile = () =>
  useQuery({ queryKey: qk.instructorProfile, queryFn: api.instructorProfile });

export const useInstructorCourses = () =>
  useQuery({ queryKey: qk.instructorCourses, queryFn: api.instructorCourses });
