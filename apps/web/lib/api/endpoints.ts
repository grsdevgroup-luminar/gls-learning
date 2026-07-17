import type {
  AdminOverviewDto,
  AdminPricingDto,
  AdminStudentDto,
  AutomationRuleDto,
  CommentDto,
  CouponDto,
  CourseDetailDto,
  CourseSummaryDto,
  CreateCommentInput,
  CreateReviewInput,
  FeaturedCouponDto,
  PatchCouponInput,
  PlatformSettingsDto,
  UpdatePlatformSettingsInput,
  UpsertAutomationRuleInput,
  UpsertCouponInput,
  EnrollmentDto,
  InstructorApplicationDto,
  InstructorProfileDto,
  InstructorRosterDto,
  OrderDto,
  DirectUploadDto,
  OrganizationDto,
  Paginated,
  PlaybackDto,
  QuizAttemptInput,
  QuizAttemptResultDto,
  QuizPlayDto,
  QuizResultDto,
  QuoteDto,
  RegionRow,
  ReminderLogDto,
  ReviewDto,
  SalesAgentDto,
  SalesAgentReferralDto,
  CheckoutQuoteInput,
  CheckoutSessionInput,
  CheckoutSessionDto,
  ToggleLessonResultDto,
} from "@skillstream/shared";
import { apiFetch } from "./client";

// Re-exported so pages can import DTO types alongside the endpoint helpers.
export type {
  AdminOverviewDto,
  AdminStudentDto,
  PlatformSettingsDto,
  AutomationRuleDto,
  CommentDto,
  CouponDto,
  ReminderLogDto,
  FeaturedCouponDto,
  CourseDetailDto,
  CourseSummaryDto,
  EnrollmentDto,
  InstructorApplicationDto,
  InstructorProfileDto,
  InstructorRosterDto,
  OrderDto,
  OrganizationDto,
  Paginated,
  ReviewDto,
  SalesAgentDto,
  SalesAgentReferralDto,
} from "@skillstream/shared";

/** `GET /me/certificates` returns certificates enriched with course info
 *  (unlike the bare `CertificateDto` embedded in enrollments). */
export interface CertificateDto {
  serial: string;
  pdfUrl: string | null;
  issuedAt: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

// Endpoint functions usable from the browser (credentials are always included).
export const api = {
  // catalog
  courses: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<CourseSummaryDto>>(`/courses${qs(params)}`),
  course: (slug: string) => apiFetch<CourseDetailDto>(`/courses/${slug}`),
  categories: () => apiFetch<string[]>("/categories"),

  // pricing regions (public; FX rates refreshed daily by the API's fx job)
  regions: () => apiFetch<RegionRow[]>("/pricing/regions"),

  // enrollment / progress
  myEnrollments: () => apiFetch<EnrollmentDto[]>("/me/enrollments"),
  progress: (courseId: string) =>
    apiFetch<EnrollmentDto>(`/me/courses/${courseId}/progress`),
  enrollFree: (courseId: string) =>
    apiFetch<EnrollmentDto>(`/courses/${courseId}/enroll`, { method: "POST" }),
  toggleLesson: (courseId: string, lessonId: string) =>
    apiFetch<ToggleLessonResultDto>(
      `/enrollments/${courseId}/lessons/${lessonId}/toggle`,
      { method: "POST" },
    ),

  // media
  playback: (lessonId: string) =>
    apiFetch<PlaybackDto>(`/lessons/${lessonId}/playback`),

  // quiz
  quiz: (lessonId: string) => apiFetch<QuizPlayDto>(`/lessons/${lessonId}/quiz`),
  quizResult: (lessonId: string) =>
    apiFetch<QuizResultDto | null>(`/lessons/${lessonId}/quiz/result`),
  submitQuiz: (lessonId: string, body: QuizAttemptInput) =>
    apiFetch<QuizAttemptResultDto>(`/lessons/${lessonId}/quiz/attempt`, {
      method: "POST",
      body,
    }),

  // commerce
  quote: (body: CheckoutQuoteInput) =>
    apiFetch<QuoteDto>("/checkout/quote", { method: "POST", body }),
  checkoutSession: (body: CheckoutSessionInput) =>
    apiFetch<CheckoutSessionDto>("/checkout/session", { method: "POST", body }),
  myOrders: () => apiFetch<OrderDto[]>("/me/orders"),
  devSimulatePayment: (orderId: string) =>
    apiFetch<OrderDto>(`/payments/dev/simulate/${orderId}`, { method: "POST" }),

  // reviews
  courseReviews: (courseId: string, page = 1) =>
    apiFetch<Paginated<ReviewDto>>(`/courses/${courseId}/reviews${qs({ page })}`),
  myReview: (courseId: string) =>
    apiFetch<ReviewDto | null>(`/me/courses/${courseId}/review`),
  submitReview: (courseId: string, body: CreateReviewInput) =>
    apiFetch<ReviewDto>(`/courses/${courseId}/reviews`, { method: "POST", body }),

  // comments — flat course discussion, public read / logged-in write
  courseComments: (courseId: string, page = 1) =>
    apiFetch<Paginated<CommentDto>>(`/courses/${courseId}/comments${qs({ page })}`),
  postComment: (courseId: string, body: CreateCommentInput) =>
    apiFetch<CommentDto>(`/courses/${courseId}/comments`, { method: "POST", body }),

  /** Approved instructors (public roster). */
  instructors: () => apiFetch<InstructorRosterDto[]>("/instructors"),

  // admin — instructor applications
  adminInstructorApplications: () =>
    apiFetch<InstructorApplicationDto[]>("/admin/instructor-applications"),
  approveInstructorApplication: (id: string, note?: string) =>
    apiFetch<InstructorApplicationDto>(
      `/admin/instructor-applications/${id}/approve`,
      { method: "POST", body: { note } },
    ),
  rejectInstructorApplication: (id: string, note?: string) =>
    apiFetch<InstructorApplicationDto>(
      `/admin/instructor-applications/${id}/reject`,
      { method: "POST", body: { note } },
    ),

  // certificates
  myCertificates: () => apiFetch<CertificateDto[]>("/me/certificates"),

  // admin overview & management
  adminOverview: () => apiFetch<AdminOverviewDto>("/admin/overview"),
  adminStudents: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<AdminStudentDto[]>(`/admin/students${qs(params)}`),
  adminOrders: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<OrderDto[]>(`/admin/orders${qs(params)}`),
  adminCourses: () => apiFetch<InstructorCourseDto[]>("/admin/courses"),
  updateUserStatus: (userId: string, status: "ACTIVE" | "IDLE" | "AT_RISK") =>
    apiFetch<{ ok: true }>(`/admin/users/${userId}/status`, { method: "PATCH", body: { status } }),
  deleteUser: (userId: string) =>
    apiFetch<{ ok: true }>(`/admin/users/${userId}`, { method: "DELETE" }),
  refundOrder: (orderId: string) =>
    apiFetch<{ ok: true }>(`/admin/orders/${orderId}/refund`, { method: "POST" }),
  // coupons — the featured one drives the public storefront banner
  featuredCoupon: () => apiFetch<FeaturedCouponDto | null>("/coupons/featured"),
  adminCoupons: () => apiFetch<CouponDto[]>("/admin/coupons"),
  adminUpsertCoupon: (input: UpsertCouponInput) =>
    apiFetch<CouponDto>("/admin/coupons", { method: "POST", body: input }),
  adminPatchCoupon: (code: string, input: PatchCouponInput) =>
    apiFetch<CouponDto>(`/admin/coupons/${code}`, { method: "PATCH", body: input }),
  adminDeleteCoupon: (code: string) =>
    apiFetch<{ ok: true }>(`/admin/coupons/${code}`, { method: "DELETE" }),

  // platform settings
  adminSettings: () => apiFetch<PlatformSettingsDto>("/admin/settings"),
  adminUpdateSettings: (input: UpdatePlatformSettingsInput) =>
    apiFetch<PlatformSettingsDto>("/admin/settings", { method: "PATCH", body: input }),

  // marketing automation
  adminAutomationRules: () => apiFetch<AutomationRuleDto[]>("/admin/automation-rules"),
  adminCreateAutomationRule: (input: UpsertAutomationRuleInput) =>
    apiFetch<AutomationRuleDto>("/admin/automation-rules", { method: "POST", body: input }),
  adminUpdateAutomationRule: (id: string, input: UpsertAutomationRuleInput) =>
    apiFetch<AutomationRuleDto>(`/admin/automation-rules/${id}`, { method: "PATCH", body: input }),
  adminDeleteAutomationRule: (id: string) =>
    apiFetch<{ ok: true }>(`/admin/automation-rules/${id}`, { method: "DELETE" }),
  adminReminderLogs: () => apiFetch<ReminderLogDto[]>("/admin/reminder-logs"),

  // NB: returns a bare array (not Paginated) — the API takes a status filter.
  adminReviews: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<ReviewDto[]>(`/admin/reviews${qs(params)}`),
  updateReviewStatus: (reviewId: string, status: "APPROVED" | "HIDDEN") =>
    apiFetch<ReviewDto>(`/admin/reviews/${reviewId}/status`, { method: "PATCH", body: { status } }),

  // sales agent (self-service)
  applySalesAgent: (body: {
    name: string;
    email: string;
    phone?: string;
    region: string;
    bio: string;
  }) =>
    apiFetch<{ id: string; status: string }>("/sales-agents/apply", {
      method: "POST",
      body,
    }),
  mySalesAgent: () => apiFetch<SalesAgentDto | null>("/me/sales-agent"),
  mySalesAgentReferrals: () =>
    apiFetch<SalesAgentReferralDto[]>("/me/sales-agent/referrals"),

  // admin — sales agents
  adminSalesAgents: () => apiFetch<SalesAgentDto[]>("/admin/sales-agents"),
  updateSalesAgent: (id: string, body: Partial<Pick<SalesAgentDto, "commissionPercent" | "status">>) =>
    apiFetch<SalesAgentDto>(`/admin/sales-agents/${id}`, { method: "PATCH", body }),
  payoutSalesAgent: (id: string) =>
    apiFetch<{ ok: true }>(`/admin/sales-agents/${id}/payout`, { method: "POST" }),

  // instructor
  applyInstructor: (body: {
    expertise: string;
    headline: string;
    bio: string;
    sampleUrl?: string;
  }) =>
    apiFetch<InstructorApplicationDto>("/instructors/apply", {
      method: "POST",
      body,
    }),
  instructorProfile: () => apiFetch<InstructorProfileDto | null>("/me/instructor"),
  instructorCourses: () =>
    apiFetch<InstructorCourseDto[]>("/me/instructor/courses"),
  updateInstructorProfile: (body: {
    title?: string;
    bio?: string;
    expertise?: string;
    avatar?: string;
  }) =>
    apiFetch<InstructorProfileDto>("/me/instructor", { method: "PATCH", body }),
};

/** Own-course listing includes revenue (owner-only field). */
export type InstructorCourseDto = CourseSummaryDto & { revenueCents: number };

// ── organizations (B2B portal) ─────────────────────────────────────────────

export const orgApi = {
  bySlug: (idOrSlug: string) =>
    apiFetch<OrganizationDto>(`/organizations/${idOrSlug}`),
  mine: () => apiFetch<OrganizationDto[]>("/me/organizations"),
  update: (
    orgId: string,
    body: Partial<{ name: string; domain: string; logoUrl: string; seatCount: number }>,
  ) => apiFetch<OrganizationDto>(`/organizations/${orgId}`, { method: "PATCH", body }),
  invite: (orgId: string, email: string, role: "ADMIN" | "MEMBER") =>
    apiFetch<{ id: string; token: string; email: string }>(
      `/organizations/${orgId}/invite`,
      { method: "POST", body: { email, role } },
    ),
  invitations: (orgId: string) =>
    apiFetch<{ id: string; email: string; role: string; expiresAt: string }[]>(
      `/organizations/${orgId}/invitations`,
    ),
  cancelInvitation: (orgId: string, inviteId: string) =>
    apiFetch<{ ok: true }>(`/organizations/${orgId}/invitations/${inviteId}`, {
      method: "DELETE",
    }),
  removeMember: (orgId: string, memberId: string) =>
    apiFetch<OrganizationDto>(`/organizations/${orgId}/members/${memberId}`, {
      method: "DELETE",
    }),
  invitationInfo: (token: string) =>
    apiFetch<{
      valid: boolean;
      email: string | null;
      role: "ADMIN" | "MEMBER" | null;
      orgName: string | null;
      orgSlug: string | null;
    }>(`/organizations/invitations/${token}`),
  claim: (token: string) =>
    apiFetch<OrganizationDto>(`/organizations/claim/${token}`, { method: "POST" }),
  courses: (orgId: string) =>
    apiFetch<CourseSummaryDto[]>(`/organizations/${orgId}/courses`),
  assignCourse: (orgId: string, courseId: string) =>
    apiFetch<OrganizationDto>(`/organizations/${orgId}/courses`, {
      method: "POST",
      body: { courseId },
    }),
  unassignCourse: (orgId: string, courseId: string) =>
    apiFetch<OrganizationDto>(`/organizations/${orgId}/courses/${courseId}`, {
      method: "DELETE",
    }),
};

// ── admin pricing (region / PPP tiers) ─────────────────────────────────────

export const pricingAdminApi = {
  getAll: () => apiFetch<AdminPricingDto>("/admin/pricing"),
  createTier: (body: { name: string; multiplier: number }) =>
    apiFetch<AdminPricingDto>("/admin/pricing/tiers", { method: "POST", body }),
  updateTier: (id: string, body: { name?: string; multiplier?: number }) =>
    apiFetch<AdminPricingDto>(`/admin/pricing/tiers/${id}`, { method: "PATCH", body }),
  deleteTier: (id: string) =>
    apiFetch<AdminPricingDto>(`/admin/pricing/tiers/${id}`, { method: "DELETE" }),
  updateRegion: (
    code: string,
    body: Partial<{
      tierId: string;
      fxRate: number;
      currency: string;
      symbol: string;
      override: boolean;
      multiplier: number;
    }>,
  ) => apiFetch<AdminPricingDto>(`/admin/pricing/regions/${code}`, { method: "PATCH", body }),
};

// ── authoring (instructor/admin course builder) ────────────────────────────

export interface AuthoringQuizQuestionDto {
  id: string;
  prompt: string;
  explanation: string | null;
  order: number;
  options: { id: string; text: string; isCorrect: boolean; order: number }[];
}
export interface AuthoringQuizDto {
  id: string;
  lessonId: string;
  passScore: number;
  questions: AuthoringQuizQuestionDto[];
}

export type CourseLevelInput = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ALL_LEVELS";
export interface CourseFieldsInput {
  title?: string;
  subtitle?: string;
  description?: string;
  category?: string;
  level?: CourseLevelInput;
  thumbnail?: string;
  language?: string;
  basePriceCents?: number;
}
export interface LessonFieldsInput {
  title: string;
  type: "VIDEO" | "QUIZ" | "ARTICLE";
  durationSec?: number;
  preview?: boolean;
  order?: number;
  articleContent?: string | null;
  cfVideoUid?: string | null;
}

export const authoringApi = {
  course: (id: string) => apiFetch<CourseDetailDto>(`/authoring/courses/${id}`),
  createCourse: (body: CourseFieldsInput & { title: string; category: string }) =>
    apiFetch<CourseDetailDto>("/courses", { method: "POST", body }),
  updateCourse: (id: string, body: CourseFieldsInput) =>
    apiFetch<CourseDetailDto>(`/courses/${id}`, { method: "PATCH", body }),
  setCourseStatus: (id: string, status: "DRAFT" | "REVIEW" | "PUBLISHED") =>
    apiFetch<CourseDetailDto>(`/courses/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),
  deleteCourse: (id: string) =>
    apiFetch<{ ok: true }>(`/courses/${id}`, { method: "DELETE" }),
  addSection: (courseId: string, body: { title: string; order?: number }) =>
    apiFetch<CourseDetailDto>(`/courses/${courseId}/sections`, {
      method: "POST",
      body,
    }),
  updateSection: (id: string, body: { title: string; order?: number }) =>
    apiFetch<CourseDetailDto>(`/sections/${id}`, { method: "PATCH", body }),
  deleteSection: (id: string) =>
    apiFetch<CourseDetailDto>(`/sections/${id}`, { method: "DELETE" }),
  addLesson: (sectionId: string, body: LessonFieldsInput) =>
    apiFetch<CourseDetailDto>(`/sections/${sectionId}/lessons`, {
      method: "POST",
      body,
    }),
  updateLesson: (id: string, body: LessonFieldsInput) =>
    apiFetch<CourseDetailDto>(`/lessons/${id}`, { method: "PATCH", body }),
  deleteLesson: (id: string) =>
    apiFetch<CourseDetailDto>(`/lessons/${id}`, { method: "DELETE" }),
  quiz: (lessonId: string) =>
    apiFetch<AuthoringQuizDto | null>(`/authoring/lessons/${lessonId}/quiz`),
  upsertQuiz: (lessonId: string, passScore: number) =>
    apiFetch<AuthoringQuizDto>(`/lessons/${lessonId}/quiz`, {
      method: "POST",
      body: { passScore },
    }),
  addQuizQuestion: (
    quizId: string,
    body: {
      prompt: string;
      explanation?: string;
      order?: number;
      options: { text: string; isCorrect: boolean; order?: number }[];
    },
  ) =>
    apiFetch<AuthoringQuizDto>(`/quizzes/${quizId}/questions`, {
      method: "POST",
      body,
    }),
  deleteQuizQuestion: (questionId: string) =>
    apiFetch<AuthoringQuizDto>(`/quiz-questions/${questionId}`, {
      method: "DELETE",
    }),
  mediaUploadUrl: () =>
    apiFetch<DirectUploadDto>("/media/upload-url", { method: "POST" }),
};

// Grouped aliases so portal pages can import a namespaced client.
export const adminApi = {
  overview: () => api.adminOverview(),
  students: () => api.adminStudents(),
  orders: () => api.adminOrders(),
  courses: () => api.adminCourses(),
  updateUserStatus: api.updateUserStatus,
  deleteUser: api.deleteUser,
  refundOrder: api.refundOrder,
  reviews: api.adminReviews,
  updateReviewStatus: api.updateReviewStatus,
  instructorApplications: api.adminInstructorApplications,
  approveInstructorApplication: api.approveInstructorApplication,
  rejectInstructorApplication: api.rejectInstructorApplication,
  salesAgents: api.adminSalesAgents,
  updateSalesAgent: api.updateSalesAgent,
  payoutSalesAgent: api.payoutSalesAgent,
};

export const instructorApi = {
  profile: () => api.instructorProfile(),
  courses: () => api.instructorCourses(),
};
