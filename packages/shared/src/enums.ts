// ---------------------------------------------------------------------------
// Canonical enums — the single source of truth shared by the Prisma schema,
// the NestJS API, and the Next.js frontend. Values are UPPER_SNAKE to match
// Prisma/Postgres enum conventions; the frontend maps them to display labels.
// ---------------------------------------------------------------------------

export const UserRole = {
  STUDENT: "STUDENT",
  INSTRUCTOR: "INSTRUCTOR",
  ADMIN: "ADMIN",
  SALES_AGENT: "SALES_AGENT",
  ORG_ADMIN: "ORG_ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const CourseStatus = {
  DRAFT: "DRAFT",
  REVIEW: "REVIEW",
  PUBLISHED: "PUBLISHED",
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export const CourseLevel = {
  BEGINNER: "BEGINNER",
  INTERMEDIATE: "INTERMEDIATE",
  ADVANCED: "ADVANCED",
  ALL_LEVELS: "ALL_LEVELS",
} as const;
export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];

export const LessonType = {
  VIDEO: "VIDEO",
  QUIZ: "QUIZ",
  ARTICLE: "ARTICLE",
} as const;
export type LessonType = (typeof LessonType)[keyof typeof LessonType];

export const InstructorStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type InstructorStatus =
  (typeof InstructorStatus)[keyof typeof InstructorStatus];

export const EnrollmentStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ABANDONED: "ABANDONED",
} as const;
export type EnrollmentStatus =
  (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export const StudentStatus = {
  ACTIVE: "ACTIVE",
  IDLE: "IDLE",
  AT_RISK: "AT_RISK",
} as const;
export type StudentStatus = (typeof StudentStatus)[keyof typeof StudentStatus];

export const ReviewStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  HIDDEN: "HIDDEN",
} as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const OrderStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
  FAILED: "FAILED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentGateway = {
  STRIPE: "STRIPE",
  PAYPAL: "PAYPAL",
} as const;
export type PaymentGateway =
  (typeof PaymentGateway)[keyof typeof PaymentGateway];

export const CouponType = {
  PERCENT: "PERCENT",
  FIXED: "FIXED",
  FREE: "FREE",
} as const;
export type CouponType = (typeof CouponType)[keyof typeof CouponType];

export const CouponScope = {
  GLOBAL: "GLOBAL",
  COURSE: "COURSE",
} as const;
export type CouponScope = (typeof CouponScope)[keyof typeof CouponScope];

export const ReminderTrigger = {
  IDLE: "IDLE",
  LOW_PROGRESS: "LOW_PROGRESS",
  ABANDONED_CART: "ABANDONED_CART",
  ALMOST_DONE: "ALMOST_DONE",
  NEW_CONTENT: "NEW_CONTENT",
} as const;
export type ReminderTrigger =
  (typeof ReminderTrigger)[keyof typeof ReminderTrigger];

export const ReminderChannel = {
  EMAIL: "EMAIL",
  SMS: "SMS",
} as const;
export type ReminderChannel =
  (typeof ReminderChannel)[keyof typeof ReminderChannel];

export const ReminderStatus = {
  SENT: "SENT",
  OPENED: "OPENED",
  CLICKED: "CLICKED",
  BOUNCED: "BOUNCED",
} as const;
export type ReminderStatus =
  (typeof ReminderStatus)[keyof typeof ReminderStatus];

export const CourseVisibility = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;
export type CourseVisibility =
  (typeof CourseVisibility)[keyof typeof CourseVisibility];

export const SalesAgentStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
} as const;
export type SalesAgentStatus =
  (typeof SalesAgentStatus)[keyof typeof SalesAgentStatus];

export const OrgStatus = {
  ACTIVE: "ACTIVE",
  TRIAL: "TRIAL",
  SUSPENDED: "SUSPENDED",
} as const;
export type OrgStatus = (typeof OrgStatus)[keyof typeof OrgStatus];

export const OrgMemberRole = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;
export type OrgMemberRole = (typeof OrgMemberRole)[keyof typeof OrgMemberRole];

// Display-label maps for enums the frontend renders verbatim.
export const LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All Levels",
};
