import type {
  AdminAnalyticsDto,
  AdminCourseStatsDto,
  AdminCourseOrganizationDto,
  AdminOrderStatsDto,
  AdminOverviewDto,
  AdminReviewCourseOptionDto,
  AdminReviewStatsDto,
  AdminStudentStatsDto,
  AdminPricingDto,
  AdminStudentDto,
  AdminStudentProfileDto,
  AutomationRuleDto,
  CommentDto,
  CouponDto,
  CourseDetailDto,
  CourseSummaryDto,
  CreateCommentInput,
  CreateReviewInput,
  EmailTemplateDto,
  EmailTemplatePreviewDto,
  FeaturedCouponDto,
  PatchCouponInput,
  PlatformSettingsDto,
  PreviewEmailTemplateInput,
  UpdateInstructorProfileInput,
  UpdatePlatformSettingsInput,
  UpsertAutomationRuleInput,
  UpsertCouponInput,
  UpsertEmailTemplateInput,
  ApplyInstructorInput,
  EnrollmentDto,
  InstructorApplicationDto,
  InstructorNameChangeRequestDto,
  InstructorApplicationStatsDto,
  InstructorCvUploadDto,
  InstructorProfileDto,
  InstructorPublicProfileDto,
  InstructorRosterDto,
  MyOrderStatsDto,
  OrderDto,
  TusUploadDto,
  UploadCompleteDto,
  UploadStatusDto,
  CreateTusUploadInput,
  CreateOrganizationInput,
  CreateOrganizationResultDto,
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
  AdminDeliveryPartnerApplicationQuery,
  AdminDeliveryPartnerQuery,
  AssignPartnerCourseInput,
  CreatePartnerCampaignInput,
  DeliveryPartnerApplicationDto,
  DeliveryPartnerApplicationStatsDto,
  DeliveryPartnerCampaignDto,
  DeliveryPartnerCourseAssignmentDto,
  DeliveryPartnerDto,
  DeliveryPartnerInvitationDto,
  DeliveryPartnerMemberDto,
  DeliveryPartnerReferralDto,
  PartnerGrantedCourseDto,
  PartnerInvitationInfoDto,
  PartnerDocumentDto,
  ReviewPartnerApplicationInput,
  UpdatePartnerCampaignInput,
  PayoutBalanceDto,
  PayoutDto,
  PayoutAccountDto,
  PayoutAccountInput,
  PayoutBreakdownDto,
  PayoutStripeStatusDto,
  StripeOnboardLinkDto,
  CheckoutQuoteInput,
  CheckoutSessionInput,
  CheckoutSessionDto,
  LessonNoteDto,
  LessonResourceDto,
  NotificationDto,
  LearningPreferencesDto,
  NotificationPreferencesDto,
  UnreadCountDto,
  CreditBalanceDto,
  CreditLedgerEntryDto,
  UpdateNotificationPreferencesInput,
  UpdateLearningPreferencesInput,
  ToggleLessonResultDto,
  ActivityDayDto,
  ActivityPeriod,
  CategoryDto,
  WatchTimeResultDto,
} from "@skillstream/shared";
import { apiFetch, apiFetchMultipart } from "./client";

// Re-exported so pages can import DTO types alongside the endpoint helpers.
export type {
  AdminOverviewDto,
  AdminStudentDto,
  AdminStudentProfileDto,
  PlatformSettingsDto,
  AutomationRuleDto,
  CommentDto,
  CouponDto,
  EmailTemplateDto,
  EmailTemplatePreviewDto,
  ReminderLogDto,
  FeaturedCouponDto,
  CourseDetailDto,
  CourseSummaryDto,
  EnrollmentDto,
  InstructorApplicationDto,
  InstructorNameChangeRequestDto,
  InstructorApplicationStatsDto,
  InstructorCvUploadDto,
  InstructorProfileDto,
  InstructorPublicProfileDto,
  InstructorRosterDto,
  MyOrderStatsDto,
  NotificationDto,
  UnreadCountDto,
  CreditBalanceDto,
  CreditLedgerEntryDto,
  OrderDto,
  OrganizationDto,
  Paginated,
  ReviewDto,
  DeliveryPartnerApplicationDto,
  DeliveryPartnerApplicationStatsDto,
  DeliveryPartnerCampaignDto,
  DeliveryPartnerDto,
  DeliveryPartnerReferralDto,
  PartnerDocumentDto,
  PayoutBalanceDto,
  PayoutDto,
  PayoutAccountDto,
  PayoutBreakdownDto,
  PayoutStripeStatusDto,
  StripeOnboardLinkDto,
} from "@skillstream/shared";

/** `GET /me/certificates` returns certificates enriched with course info
 *  (unlike the bare `CertificateDto` embedded in enrollments). */
export interface CertificateDto {
  serial: string;
  learnerName: string;
  courseNumber: string;
  pdfUrl: string | null;
  issuedAt: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseStartDate: string;
  courseEndDate: string;
}

/** Exported so server-side prefetches (serverApi) can build the identical
 *  path + query string a matching client useQuery call will use — needed
 *  for the RSC↔React Query hydration bridge to actually cache-hit. */
export const qs = (params: Record<string, string | string[] | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const value of v) if (value !== "") sp.append(k, String(value));
    } else if (v !== undefined && v !== "") {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

// Endpoint functions usable from the browser (credentials are always included).
export const api = {
  // catalog
  courses: (params: Record<string, string | string[] | number | undefined> = {}) =>
    apiFetch<Paginated<CourseSummaryDto>>(`/courses${qs(params)}`),
  course: (slug: string) => apiFetch<CourseDetailDto>(`/courses/${slug}`),
  learningCourse: (courseId: string) =>
    apiFetch<CourseDetailDto>(`/me/courses/${courseId}/learning`),
  categories: () => apiFetch<string[]>("/categories"),
  proposeCategory: (name: string) =>
    apiFetch<CategoryDto>("/categories/proposals", {
      method: "POST",
      body: { name },
    }),
  recommendations: (limit = 8) =>
    apiFetch<CourseSummaryDto[]>(`/me/recommendations${qs({ limit })}`),
  coursePreferences: () =>
    apiFetch<LearningPreferencesDto>("/me/course-preferences"),
  updateCoursePreferences: (input: UpdateLearningPreferencesInput) =>
    apiFetch<LearningPreferencesDto>("/me/course-preferences", {
      method: "PATCH",
      body: input,
    }),

  // pricing regions (public; FX rates refreshed daily by the API's fx job)
  regions: () => apiFetch<RegionRow[]>("/pricing/regions"),

  // enrollment / progress
  myEnrollments: () => apiFetch<EnrollmentDto[]>("/me/enrollments"),
  myActivity: (period: ActivityPeriod = "weekly") =>
    apiFetch<ActivityDayDto[]>(`/me/activity?period=${period}`),
  progress: (courseId: string) =>
    apiFetch<EnrollmentDto>(`/me/courses/${courseId}/progress`),
  enrollFree: (courseId: string) =>
    apiFetch<EnrollmentDto>(`/courses/${courseId}/enroll`, { method: "POST" }),
  toggleLesson: (courseId: string, lessonId: string) =>
    apiFetch<ToggleLessonResultDto>(
      `/enrollments/${courseId}/lessons/${lessonId}/toggle`,
      { method: "POST" },
    ),
  // `keepalive` lets this survive a pagehide/unmount flush after the tab starts unloading.
  recordWatchTime: (courseId: string, lessonId: string, watchedSec: number, keepalive = false) =>
    apiFetch<WatchTimeResultDto>(
      `/enrollments/${courseId}/lessons/${lessonId}/watch-time`,
      { method: "POST", body: { watchedSec }, keepalive },
    ),

  pptxCompletion: (courseId: string, lessonId: string) =>
    apiFetch<{ completed: boolean }>(`/enrollments/${courseId}/lessons/${lessonId}/pptx-completion`),
  setPptxCompletion: (courseId: string, lessonId: string, completed: boolean) =>
    apiFetch<{ completed: boolean }>(`/enrollments/${courseId}/lessons/${lessonId}/pptx-completion`, { method: "POST", body: { completed } }),

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
  checkoutSession: (body: CheckoutSessionInput, idempotencyKey: string) =>
    apiFetch<CheckoutSessionDto>("/checkout/session", {
      method: "POST",
      body,
      // Collapses double-clicks and network retries onto a single Order on the
      // server; also flows through to Stripe/PayPal so no duplicate provider
      // session is opened. See docs/PAYMENT_IDEMPOTENCY_PLAN.md.
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  myOrders: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<OrderDto>>(`/me/orders${qs(params)}`),
  myOrder: (orderId: string) => apiFetch<OrderDto>(`/me/orders/${orderId}`),
  cancelOrder: (orderId: string) =>
    apiFetch<OrderDto>(`/me/orders/${orderId}/cancel`, { method: "POST" }),
  myOrderStats: () => apiFetch<MyOrderStatsDto>("/me/orders/stats"),
  /** Captures a provider approval the buyer just returned with (PayPal). */
  settleOrder: (orderId: string) =>
    apiFetch<OrderDto>(`/payments/settle/${orderId}`, { method: "POST" }),
  devSimulatePayment: (orderId: string) =>
    apiFetch<OrderDto>(`/payments/dev/simulate/${orderId}`, { method: "POST" }),

  // notifications
  myNotifications: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<NotificationDto>>(`/me/notifications${qs(params)}`),
  unreadNotificationCount: () =>
    apiFetch<UnreadCountDto>("/me/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    apiFetch<void>(`/me/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () =>
    apiFetch<void>("/me/notifications/read-all", { method: "PATCH" }),

  // store credit
  myCreditBalances: () => apiFetch<CreditBalanceDto[]>("/me/credits"),
  myCreditHistory: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<CreditLedgerEntryDto>>(`/me/credits/history${qs(params)}`),

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
  /** Public instructor profile page. */
  instructorPublicProfile: (id: string) =>
    apiFetch<InstructorPublicProfileDto>(`/instructors/${id}`),

  // admin — instructor applications
  adminInstructorApplications: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<InstructorApplicationDto>>(`/admin/instructor-applications${qs(params)}`),
  adminInstructorApplicationStats: () =>
    apiFetch<InstructorApplicationStatsDto>("/admin/instructor-applications/stats"),
  adminInstructors: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<InstructorProfileDto>>(`/admin/instructors${qs(params)}`),
  approveInstructorApplication: (id: string, note?: string) =>
    apiFetch<InstructorApplicationDto>(
      `/admin/instructor-applications/${id}/approve`,
      { method: "POST", body: { note } },
    ),
  rejectInstructorApplication: (id: string, note: string) =>
    apiFetch<InstructorApplicationDto>(
      `/admin/instructor-applications/${id}/reject`,
      { method: "POST", body: { note } },
    ),

  instructorNameChangeRequests: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<InstructorNameChangeRequestDto>>(`/admin/instructor-name-change-requests${qs(params)}`),
  approveInstructorNameChange: (id: string) =>
    apiFetch<InstructorNameChangeRequestDto>(`/admin/instructor-name-change-requests/${id}/approve`, { method: "POST" }),
  rejectInstructorNameChange: (id: string, note: string) =>
    apiFetch<InstructorNameChangeRequestDto>(`/admin/instructor-name-change-requests/${id}/reject`, { method: "POST", body: { note } }),
  // certificates
  myCertificates: () => apiFetch<CertificateDto[]>("/me/certificates"),
  // lesson notes (private per learner; enrollment required to write)
  lessonNote: (lessonId: string) =>
    apiFetch<LessonNoteDto | null>(`/me/lessons/${lessonId}/note`),
  saveLessonNote: (lessonId: string, body: string) =>
    apiFetch<LessonNoteDto | null>(`/me/lessons/${lessonId}/note`, {
      method: "PUT",
      body: { body },
    }),

  // notification preferences (gate real reminder delivery)
  notificationPrefs: () =>
    apiFetch<NotificationPreferencesDto>("/me/notification-preferences"),
  updateNotificationPrefs: (input: UpdateNotificationPreferencesInput) =>
    apiFetch<NotificationPreferencesDto>("/me/notification-preferences", {
      method: "PATCH",
      body: input,
    }),

  // admin overview & management
  adminOverview: () => apiFetch<AdminOverviewDto>("/admin/overview"),
  adminAnalytics: () => apiFetch<AdminAnalyticsDto>("/admin/analytics"),
  adminStudents: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<AdminStudentDto>>(`/admin/students${qs(params)}`),
  adminStudentStats: () =>
    apiFetch<AdminStudentStatsDto>("/admin/students/stats"),
  adminStudentProfile: (id: string) =>
    apiFetch<AdminStudentProfileDto>(`/admin/students/${id}/profile`),
  adminOrders: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<OrderDto>>(`/admin/orders${qs(params)}`),
  adminOrderStats: () =>
    apiFetch<AdminOrderStatsDto>("/admin/orders/stats"),
  adminCourses: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<InstructorCourseDto>>(`/admin/courses${qs(params)}`),
  adminCourseStats: () =>
    apiFetch<AdminCourseStatsDto>("/admin/courses/stats"),
  adminCourseOrganizations: (courseId: string) =>
    apiFetch<AdminCourseOrganizationDto[]>(`/admin/courses/${courseId}/organizations`),
  updateUserStatus: (userId: string, status: "ACTIVE" | "IDLE" | "AT_RISK") =>
    apiFetch<{ ok: true }>(`/admin/users/${userId}/status`, { method: "PATCH", body: { status } }),
  deleteUser: (userId: string) =>
    apiFetch<{ ok: true }>(`/admin/users/${userId}`, { method: "DELETE" }),
  refundOrder: (
    orderId: string,
    body: {
      comment: string;
      items: { orderItemId: string; amountCents: number }[];
    },
  ) =>
    apiFetch<OrderDto>(`/admin/orders/${orderId}/refund`, {
      method: "POST",
      body,
    }),
  // coupons — the featured one drives the public storefront banner
  featuredCoupon: () => apiFetch<FeaturedCouponDto | null>("/coupons/featured"),
  adminCoupons: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<CouponDto>>(`/admin/coupons${qs(params)}`),
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
  adminCategories: () => apiFetch<CategoryDto[]>("/admin/categories"),
  adminCreateCategory: (name: string) =>
    apiFetch<CategoryDto>("/admin/categories", { method: "POST", body: { name } }),
  adminUpdateCategory: (id: string, body: { name?: string; status?: CategoryDto["status"] }) =>
    apiFetch<CategoryDto>(`/admin/categories/${id}`, { method: "PATCH", body }),
  adminDeleteCategory: (id: string) =>
    apiFetch<{ ok: true; archived: boolean }>(`/admin/categories/${id}`, { method: "DELETE" }),

  // marketing automation
  adminAutomationRules: () => apiFetch<AutomationRuleDto[]>("/admin/automation-rules"),
  adminCreateAutomationRule: (input: UpsertAutomationRuleInput) =>
    apiFetch<AutomationRuleDto>("/admin/automation-rules", { method: "POST", body: input }),
  adminUpdateAutomationRule: (id: string, input: UpsertAutomationRuleInput) =>
    apiFetch<AutomationRuleDto>(`/admin/automation-rules/${id}`, { method: "PATCH", body: input }),
  adminDeleteAutomationRule: (id: string) =>
    apiFetch<{ ok: true }>(`/admin/automation-rules/${id}`, { method: "DELETE" }),
  adminReminderLogs: () => apiFetch<ReminderLogDto[]>("/admin/reminder-logs"),

  // email templates
  adminEmailTemplates: () => apiFetch<EmailTemplateDto[]>("/admin/email-templates"),
  adminUpdateEmailTemplate: (key: string, input: UpsertEmailTemplateInput) =>
    apiFetch<EmailTemplateDto>(`/admin/email-templates/${key}`, { method: "PATCH", body: input }),
  adminResetEmailTemplate: (key: string) =>
    apiFetch<{ ok: true }>(`/admin/email-templates/${key}`, { method: "DELETE" }),
  adminPreviewEmailTemplate: (key: string, draft?: PreviewEmailTemplateInput) =>
    apiFetch<EmailTemplatePreviewDto>(`/admin/email-templates/${key}/preview`, {
      method: "POST",
      body: draft ?? {},
    }),
  adminSendTestEmail: (key: string) =>
    apiFetch<{ ok: true }>(`/admin/email-templates/${key}/test-send`, { method: "POST" }),

  adminReviews: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<ReviewDto>>(`/admin/reviews${qs(params)}`),
  adminReviewStats: () => apiFetch<AdminReviewStatsDto>("/admin/reviews/stats"),
  adminReviewCourses: () =>
    apiFetch<AdminReviewCourseOptionDto[]>("/admin/reviews/courses"),
  updateReviewStatus: (reviewId: string, action: "APPROVE" | "HIDE" | "UNHIDE") =>
    apiFetch<ReviewDto>(`/admin/reviews/${reviewId}/status`, { method: "PATCH", body: { action } }),

  // delivery partner (self-service)
  // Only called right after registerDeliveryPartner creates the pending
  // application — there's no standalone apply endpoint (see
  // DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §2).
  uploadPartnerDocument: (title: string, file: File) => {
    const form = new FormData();
    form.append("title", title);
    form.append("file", file);
    return apiFetchMultipart<PartnerDocumentDto>("/delivery-partners/apply/docs", form);
  },
  myDeliveryPartner: () => apiFetch<DeliveryPartnerDto | null>("/me/delivery-partner"),
  myDeliveryPartnerApplication: () =>
    apiFetch<DeliveryPartnerApplicationDto | null>("/me/delivery-partner/application", { cache: "no-store" }),
  myDeliveryPartnerReferrals: () =>
    apiFetch<DeliveryPartnerReferralDto[]>("/me/delivery-partner/referrals"),
  myDeliveryPartnerCourses: () =>
    apiFetch<DeliveryPartnerCourseAssignmentDto[]>("/me/delivery-partner/courses"),
  myPartnerGrantedCourses: () =>
    apiFetch<PartnerGrantedCourseDto[]>("/me/delivery-partner/granted-courses"),
  myPartnerCampaigns: () =>
    apiFetch<DeliveryPartnerCampaignDto[]>("/me/delivery-partner/campaigns"),
  myDeliveryPartnerMembers: () =>
    apiFetch<DeliveryPartnerMemberDto[]>("/me/delivery-partner/members"),
  myDeliveryPartnerInvitations: () =>
    apiFetch<DeliveryPartnerInvitationDto[]>("/me/delivery-partner/invitations"),

  // delivery partner — members + invitations (partner-authenticated, per course assignment)
  invitePartnerMember: (courseAssignmentId: string, email: string) =>
    apiFetch<DeliveryPartnerInvitationDto>(
      `/delivery-partner/courses/${courseAssignmentId}/invite`,
      { method: "POST", body: { email } },
    ),
  partnerCourseInvitations: (courseAssignmentId: string) =>
    apiFetch<DeliveryPartnerInvitationDto[]>(`/delivery-partner/courses/${courseAssignmentId}/invitations`),
  partnerCourseMembers: (courseAssignmentId: string) =>
    apiFetch<DeliveryPartnerMemberDto[]>(`/delivery-partner/courses/${courseAssignmentId}/members`),
  revokePartnerInvitation: (inviteId: string) =>
    apiFetch<{ ok: true }>(`/delivery-partner/invitations/${inviteId}`, { method: "DELETE" }),
  removePartnerMember: (memberId: string) =>
    apiFetch<{ ok: true }>(`/delivery-partner/members/${memberId}`, { method: "DELETE" }),
  partnerInvitationInfo: (token: string) =>
    apiFetch<PartnerInvitationInfoDto>(`/delivery-partner/invitations/${token}`),
  claimPartnerInvitation: (token: string) =>
    apiFetch<DeliveryPartnerCourseAssignmentDto>(`/delivery-partner/claim/${token}`, { method: "POST" }),

  // admin — delivery partners
  adminDeliveryPartnerApplications: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<DeliveryPartnerApplicationDto>>(`/admin/delivery-partner-applications${qs(params)}`),
  adminDeliveryPartnerApplicationStats: () =>
    apiFetch<DeliveryPartnerApplicationStatsDto>("/admin/delivery-partner-applications/stats"),
  reviewDeliveryPartnerApplication: (id: string, body: ReviewPartnerApplicationInput) =>
    apiFetch<DeliveryPartnerApplicationDto>(
      `/admin/delivery-partner-applications/${id}/review`,
      { method: "POST", body },
    ),
  adminDeliveryPartners: (params: Record<string, string | number | undefined> = {}) =>
    apiFetch<Paginated<DeliveryPartnerDto>>(`/admin/delivery-partners${qs(params)}`),
  updateDeliveryPartner: (id: string, body: Partial<Pick<DeliveryPartnerDto, "commissionPercent" | "status">>) =>
    apiFetch<DeliveryPartnerDto>(`/admin/delivery-partners/${id}`, { method: "PATCH", body }),
  adminPartnerCourses: (partnerId: string) =>
    apiFetch<DeliveryPartnerCourseAssignmentDto[]>(`/admin/delivery-partners/${partnerId}/courses`),
  adminAssignPartnerCourse: (partnerId: string, body: AssignPartnerCourseInput) =>
    apiFetch<DeliveryPartnerCourseAssignmentDto>(
      `/admin/delivery-partners/${partnerId}/courses`,
      { method: "POST", body },
    ),
  adminUpdatePartnerCourseAssignment: (partnerId: string, courseId: string, memberCap: number) =>
    apiFetch<DeliveryPartnerCourseAssignmentDto>(
      `/admin/delivery-partners/${partnerId}/courses/${courseId}`,
      { method: "PATCH", body: { memberCap } },
    ),
  adminUnassignPartnerCourse: (partnerId: string, courseId: string) =>
    apiFetch<{ ok: true }>(`/admin/delivery-partners/${partnerId}/courses/${courseId}`, { method: "DELETE" }),

  // admin — delivery partner campaigns
  adminPartnerCampaigns: (partnerId: string) =>
    apiFetch<DeliveryPartnerCampaignDto[]>(`/admin/delivery-partners/${partnerId}/campaigns`),
  adminCreatePartnerCampaign: (partnerId: string, body: CreatePartnerCampaignInput) =>
    apiFetch<DeliveryPartnerCampaignDto>(
      `/admin/delivery-partners/${partnerId}/campaigns`,
      { method: "POST", body },
    ),
  adminUpdatePartnerCampaign: (partnerId: string, campaignId: string, body: UpdatePartnerCampaignInput) =>
    apiFetch<DeliveryPartnerCampaignDto>(
      `/admin/delivery-partners/${partnerId}/campaigns/${campaignId}`,
      { method: "PATCH", body },
    ),
  adminDeletePartnerCampaign: (partnerId: string, campaignId: string) =>
    apiFetch<{ ok: true }>(`/admin/delivery-partners/${partnerId}/campaigns/${campaignId}`, { method: "DELETE" }),

  // payouts (instructor + delivery partner share one ledger)
  payoutBalance: () => apiFetch<PayoutBalanceDto>("/me/payouts/balance"),
  myPayouts: () => apiFetch<PayoutDto[]>("/me/payouts"),
  payoutAccount: () => apiFetch<PayoutAccountDto | null>("/me/payout-account"),
  setPayoutAccount: (body: PayoutAccountInput) =>
    apiFetch<PayoutAccountDto>("/me/payout-account", { method: "POST", body }),
  requestPayout: (amountCents?: number) =>
    apiFetch<PayoutDto>("/me/payouts", {
      method: "POST",
      body: amountCents !== undefined ? { amountCents } : undefined,
    }),
  quotePayout: (amountCents: number) =>
    apiFetch<PayoutBreakdownDto>("/me/payouts/quote", {
      method: "POST",
      body: { amountCents },
    }),
  stripeOnboardLink: () =>
    apiFetch<StripeOnboardLinkDto>("/me/payout-account/stripe/onboard-link", {
      method: "POST",
    }),
  stripeAccountStatus: () =>
    apiFetch<PayoutStripeStatusDto>("/me/payout-account/stripe/status"),
  adminPayouts: (params: {
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  } = {}) => apiFetch<PayoutDto[]>(`/admin/payouts${qs(params)}`),
  approvePayout: (id: string) =>
    apiFetch<PayoutDto>(`/admin/payouts/${id}/approve`, { method: "POST" }),
  markPayoutPaid: (id: string) =>
    apiFetch<PayoutDto>(`/admin/payouts/${id}/mark-paid`, { method: "POST" }),
  rejectPayout: (id: string, note: string) =>
    apiFetch<PayoutDto>(`/admin/payouts/${id}/reject`, { method: "POST", body: { note } }),

  // instructor
  applyInstructor: (body: ApplyInstructorInput) =>
    apiFetch<InstructorApplicationDto>("/instructors/apply", {
      method: "POST",
      body,
    }),
  uploadInstructorCv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetchMultipart<InstructorCvUploadDto>("/instructors/apply/cv", form);
  },
  deleteInstructorCv: (key: string) =>
    apiFetch<{ ok: true }>(`/instructors/apply/cv${qs({ key })}`, { method: "DELETE" }),
  instructorProfile: () =>
    apiFetch<InstructorProfileDto | null>("/me/instructor", { cache: "no-store" }),
  instructorCourses: () =>
    apiFetch<InstructorCourseDto[]>("/me/instructor/courses"),
  instructorCourseReviews: (
    courseId: string,
    params: Record<string, string | number | undefined> = {},
  ) => apiFetch<Paginated<ReviewDto>>(`/me/courses/${courseId}/reviews${qs(params)}`),
  requestInstructorNameChange: (requestedName: string) =>
    apiFetch<InstructorNameChangeRequestDto>("/me/instructor/name-change-requests", { method: "POST", body: { requestedName } }),
  updateInstructorProfile: (body: UpdateInstructorProfileInput) =>
    apiFetch<InstructorProfileDto>("/me/instructor", { method: "PATCH", body }),
};

/** Own-course listing includes revenue (owner-only field). `orgAssignmentCount`
 *  is only ever populated by the admin course list, not the instructor's own. */
export type InstructorCourseDto = CourseSummaryDto & {
  revenueCents: number;
  orgAssignmentCount?: number;
};

// ── organizations (B2B portal) ─────────────────────────────────────────────

export const orgApi = {
  /** Provisions the org's admin account directly (temp password) — the
   *  response is the only time the raw password is ever returned. */
  create: (body: CreateOrganizationInput) =>
    apiFetch<CreateOrganizationResultDto>("/organizations", { method: "POST", body }),
  list: () => apiFetch<OrganizationDto[]>("/organizations"),
  bySlug: (idOrSlug: string) =>
    apiFetch<OrganizationDto>(`/organizations/${idOrSlug}`),
  mine: () => apiFetch<OrganizationDto[]>("/me/organizations"),
  /** `seatCount`, `status`, `suspensionMode` and `graceDays` are platform-admin
   *  only — the API rejects them from an org admin. */
  update: (
    orgId: string,
    body: Partial<{
      name: string;
      domain: string;
      logoUrl: string;
      seatCount: number;
      status: OrganizationDto["status"];
      suspensionMode: NonNullable<OrganizationDto["suspensionMode"]>;
      graceDays: number;
    }>,
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

// ── delivery partner: courses/members/invites (partner-authenticated) ──────
// Mirrors orgApi's shape one level deeper — assignment/invite/member calls
// are scoped to one course assignment, not the whole partner, since access
// is per-course (see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §3/§6).
export const partnerApi = {
  courses: () => api.myDeliveryPartnerCourses(),
  invite: (courseAssignmentId: string, email: string) =>
    api.invitePartnerMember(courseAssignmentId, email),
  invitations: (courseAssignmentId: string) =>
    api.partnerCourseInvitations(courseAssignmentId),
  members: (courseAssignmentId: string) =>
    api.partnerCourseMembers(courseAssignmentId),
  revokeInvitation: (inviteId: string) => api.revokePartnerInvitation(inviteId),
  removeMember: (memberId: string) => api.removePartnerMember(memberId),
  invitationInfo: (token: string) => api.partnerInvitationInfo(token),
  claim: (token: string) => api.claimPartnerInvitation(token),
  grantedCourses: () => api.myPartnerGrantedCourses(),
  allMembers: () => api.myDeliveryPartnerMembers(),
  allInvitations: () => api.myDeliveryPartnerInvitations(),
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
  createRegion: (body: {
    code: string;
    currency: string;
    symbol: string;
    fxRate: number;
    locale?: string;
    tierId?: string;
    override?: boolean;
    multiplier?: number;
  }) => apiFetch<AdminPricingDto>("/admin/pricing/regions", { method: "POST", body }),
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
  deleteRegion: (code: string) =>
    apiFetch<AdminPricingDto>(`/admin/pricing/regions/${code}`, { method: "DELETE" }),
  fxRate: (currency: string) =>
    apiFetch<{ currency: string; rate: number }>(
      `/admin/pricing/fx-rate${qs({ currency })}`,
    ),
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
  isoStandard?: string;
  level?: CourseLevelInput;
  thumbnail?: string;
  language?: string;
  basePriceCents?: number;
  /** Platform-admin only — the API rejects this field from anyone else. */
  visibility?: "PUBLIC" | "PRIVATE";
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
  validateCourseStatus: (id: string, status: "DRAFT" | "REVIEW" | "PUBLISHED") =>
    apiFetch<{ ok: true }>(`/courses/${id}/status/validate`, {
      method: "POST",
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
  createTusUpload: (body: CreateTusUploadInput) =>
    apiFetch<TusUploadDto>("/media/tus", { method: "POST", body }),

  completeUpload: (uploadId: string) =>
    apiFetch<UploadCompleteDto>(`/media/uploads/${uploadId}/complete`, {
      method: "POST",
    }),

  getUploadStatus: (uploadId: string) =>
    apiFetch<UploadStatusDto>(`/media/uploads/${uploadId}`),

  discardUpload: (uploadId: string) =>
    apiFetch<void>(`/media/uploads/${uploadId}`, { method: "DELETE" }),

  /** Uploads a single lesson resource. The backend enforces the 10 MB cap and
   *  MIME whitelist; the UI is expected to pre-validate for a nicer UX. */
  uploadLessonPptx: (lessonId: string, file: File, durationSec: number) => {
    const form = new FormData(); form.append("file", file, file.name); form.append("durationSec", String(durationSec));
    return apiFetchMultipart<{ name: string; sizeLabel?: string; durationSec: number }>(`/authoring/lessons/${lessonId}/pptx`, form);
  },
  deleteLessonPptx: (lessonId: string) => apiFetch<{ ok: true }>(`/authoring/lessons/${lessonId}/pptx`, { method: "DELETE" }),
  uploadLessonResource: (lessonId: string, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return apiFetchMultipart<LessonResourceDto>(
      `/authoring/lessons/${lessonId}/resources`,
      form,
    );
  },
  deleteLessonResource: (lessonId: string, storageKey: string) =>
    apiFetch<{ ok: true }>(
      `/authoring/lessons/${lessonId}/resources?storageKey=${encodeURIComponent(storageKey)}`,
      { method: "DELETE" },
    ),
};

// Grouped aliases so portal pages can import a namespaced client.
export const adminApi = {
  overview: () => api.adminOverview(),
  analytics: () => api.adminAnalytics(),
  students: (params: Record<string, string | number | undefined> = {}) =>
    api.adminStudents(params),
  studentStats: () => api.adminStudentStats(),
  studentProfile: (id: string) => api.adminStudentProfile(id),
  orders: (params: Record<string, string | number | undefined> = {}) =>
    api.adminOrders(params),
  orderStats: () => api.adminOrderStats(),
  categories: api.adminCategories,
  createCategory: api.adminCreateCategory,
  updateCategory: api.adminUpdateCategory,
  deleteCategory: api.adminDeleteCategory,
  courses: (params: Record<string, string | number | undefined> = {}) =>
    api.adminCourses(params),
  courseStats: () => api.adminCourseStats(),
  courseOrganizations: (courseId: string) => api.adminCourseOrganizations(courseId),
  updateUserStatus: api.updateUserStatus,
  deleteUser: api.deleteUser,
  refundOrder: api.refundOrder,
  reviews: (params: Record<string, string | number | undefined> = {}) =>
    api.adminReviews(params),
  reviewStats: () => api.adminReviewStats(),
  reviewCourses: () => api.adminReviewCourses(),
  updateReviewStatus: api.updateReviewStatus,
  instructorApplications: (params: Record<string, string | number | undefined> = {}) =>
    api.adminInstructorApplications(params),
  instructorApplicationStats: () => api.adminInstructorApplicationStats(),
  instructors: (params: Record<string, string | number | undefined> = {}) =>
    api.adminInstructors(params),
  approveInstructorApplication: api.approveInstructorApplication,
  rejectInstructorApplication: api.rejectInstructorApplication,
  instructorNameChangeRequests: (params: Record<string, string | number | undefined> = {}) => api.instructorNameChangeRequests(params),
  approveInstructorNameChange: api.approveInstructorNameChange,
  rejectInstructorNameChange: api.rejectInstructorNameChange,
  deliveryPartnerApplications: (params: Record<string, string | number | undefined> = {}) =>
    api.adminDeliveryPartnerApplications(params),
  deliveryPartnerApplicationStats: () => api.adminDeliveryPartnerApplicationStats(),
  approveDeliveryPartnerApplication: (id: string, commissionPercent: number, note?: string) =>
    api.reviewDeliveryPartnerApplication(id, { status: "APPROVED", commissionPercent, note }),
  rejectDeliveryPartnerApplication: (id: string, note: string) =>
    api.reviewDeliveryPartnerApplication(id, { status: "REJECTED", note }),
  deliveryPartners: (params: Record<string, string | number | undefined> = {}) =>
    api.adminDeliveryPartners(params),
  updateDeliveryPartner: api.updateDeliveryPartner,
  partnerCourses: (partnerId: string) => api.adminPartnerCourses(partnerId),
  assignPartnerCourse: (partnerId: string, body: AssignPartnerCourseInput) =>
    api.adminAssignPartnerCourse(partnerId, body),
  updatePartnerCourseAssignment: (partnerId: string, courseId: string, memberCap: number) =>
    api.adminUpdatePartnerCourseAssignment(partnerId, courseId, memberCap),
  unassignPartnerCourse: (partnerId: string, courseId: string) =>
    api.adminUnassignPartnerCourse(partnerId, courseId),
  partnerCampaigns: (partnerId: string) => api.adminPartnerCampaigns(partnerId),
  createPartnerCampaign: (partnerId: string, body: CreatePartnerCampaignInput) =>
    api.adminCreatePartnerCampaign(partnerId, body),
  updatePartnerCampaign: (partnerId: string, campaignId: string, body: UpdatePartnerCampaignInput) =>
    api.adminUpdatePartnerCampaign(partnerId, campaignId, body),
  deletePartnerCampaign: (partnerId: string, campaignId: string) =>
    api.adminDeletePartnerCampaign(partnerId, campaignId),
  payouts: api.adminPayouts,
  approvePayout: api.approvePayout,
  markPayoutPaid: api.markPayoutPaid,
  rejectPayout: api.rejectPayout,
};

export const instructorApi = {
  profile: () => api.instructorProfile(),
  requestInstructorNameChange: api.requestInstructorNameChange,
  courses: () => api.instructorCourses(),
  courseReviews: (
    courseId: string,
    params: Record<string, string | number | undefined> = {},
  ) => api.instructorCourseReviews(courseId, params),
};
