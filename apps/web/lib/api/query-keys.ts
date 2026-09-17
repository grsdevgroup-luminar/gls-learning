// Pure query-key builders — deliberately not "use client" (unlike hooks.ts)
// so Server Components can import and call them directly when prefetching,
// and have the resulting key match what a client useQuery call builds with
// the same params.
export type QueryParams = Record<string, string | string[] | number | undefined>;

export function cleanParams(params: QueryParams = {}) {
  const cleaned: Record<string, string | string[] | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") cleaned[key] = value;
  }
  return cleaned;
}

export const qk = {
  courses: (params?: QueryParams) => ["courses", cleanParams(params)] as const,
  course: (slug: string) => ["course", slug] as const,
  enrollments: ["enrollments"] as const,
  activity: (period: string) => ["enrollments", "activity", period] as const,
  progress: (courseId: string) => ["progress", courseId] as const,
  quiz: (lessonId: string) => ["quiz", lessonId] as const,
  quizResult: (lessonId: string) => ["quiz-result", lessonId] as const,
  orders: (params?: unknown) => ["orders", params] as const,
  myOrderStats: ["orders", "stats"] as const,
  myOrder: (id: string) => ["orders", id] as const,
  notifications: (params?: unknown) => ["notifications", params] as const,
  unreadNotificationCount: ["notifications", "unread-count"] as const,
  creditBalances: ["credits", "balances"] as const,
  creditHistory: (params?: unknown) => ["credits", "history", params] as const,
  reviews: (courseId: string) => ["reviews", courseId] as const,
  comments: (courseId: string) => ["comments", courseId] as const,
  myReview: (courseId: string) => ["my-review", courseId] as const,
  certificates: ["certificates"] as const,
  adminOverview: ["admin-overview"] as const,
  adminStudents: (params?: unknown) => ["admin-students", params] as const,
  adminOrders: (params?: unknown) => ["admin-orders", params] as const,
  instructorProfile: ["instructor-profile"] as const,
  instructorCourses: ["instructor-courses"] as const,
  deliveryPartners: ["delivery-partners"] as const,
  categories: ["categories"] as const,
  adminCategories: ["admin-categories"] as const,
  coursePreferences: ["me", "course-preferences"] as const,
  recommendations: (limit?: number) => ["me", "recommendations", limit] as const,
  adminCoupons: (params?: unknown) => ["admin-coupons", params] as const,
  featuredCoupon: ["featured-coupon"] as const,
  adminSettings: ["admin-settings"] as const,
  automationRules: ["automation-rules"] as const,
  reminderLogs: ["reminder-logs"] as const,
  emailTemplates: ["email-templates"] as const,
  catalog: ["store", "courses"] as const,
};
