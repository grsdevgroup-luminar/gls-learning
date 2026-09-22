// ---------------------------------------------------------------------------
// Canonical enums — the single source of truth shared by the Prisma schema,
// the NestJS API, and the Next.js frontend. Values are UPPER_SNAKE to match
// Prisma/Postgres enum conventions; the frontend maps them to display labels.
// ---------------------------------------------------------------------------

export const UserRole = {
  STUDENT: "STUDENT",
  INSTRUCTOR: "INSTRUCTOR",
  ADMIN: "ADMIN",
  DELIVERY_PARTNER: "DELIVERY_PARTNER",
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

export const UploadStatus = {
  CREATED: "CREATED",
  UPLOADING: "UPLOADING",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
  ABANDONED: "ABANDONED",
} as const;
export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];

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
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  REFUNDED: "REFUNDED",
  FAILED: "FAILED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentGateway = {
  STRIPE: "STRIPE",
  PAYPAL: "PAYPAL",
  SSLCOMMERZ: "SSLCOMMERZ",
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

/** In-app notification events, Phase 1. Mirrors `NotificationEvent` in schema.prisma. */
export const NotificationEvent = {
  ORDER_PAID: "ORDER_PAID",
  ORDER_REFUNDED: "ORDER_REFUNDED",
  CREDIT_GRANTED: "CREDIT_GRANTED",
  CERTIFICATE_ISSUED: "CERTIFICATE_ISSUED",
  INSTRUCTOR_APPLICATION_APPROVED: "INSTRUCTOR_APPLICATION_APPROVED",
  INSTRUCTOR_APPLICATION_REJECTED: "INSTRUCTOR_APPLICATION_REJECTED",
  DELIVERY_PARTNER_APPLICATION_APPROVED: "DELIVERY_PARTNER_APPLICATION_APPROVED",
  DELIVERY_PARTNER_APPLICATION_REJECTED: "DELIVERY_PARTNER_APPLICATION_REJECTED",
  PAYOUT_REQUESTED: "PAYOUT_REQUESTED",
  PAYOUT_APPROVED: "PAYOUT_APPROVED",
  PAYOUT_PAID: "PAYOUT_PAID",
  REFERRAL_CONFIRMED: "REFERRAL_CONFIRMED",
  // Phase 3 — social & ambient
  COURSE_NEW_REVIEW: "COURSE_NEW_REVIEW",
  COURSE_NEW_ENROLLMENT: "COURSE_NEW_ENROLLMENT",
  ORDER_NEW_PURCHASE: "ORDER_NEW_PURCHASE",
  COURSE_UPDATED_BY_ADMIN: "COURSE_UPDATED_BY_ADMIN",
  ORG_MEMBER_JOINED: "ORG_MEMBER_JOINED",
  ORG_SEATS_LOW: "ORG_SEATS_LOW",
  ORG_INVITE_EXPIRED: "ORG_INVITE_EXPIRED",
  ORG_INVITE_RECEIVED: "ORG_INVITE_RECEIVED",
  TABLE_SIZE_WARNING: "TABLE_SIZE_WARNING",
} as const;
export type NotificationEvent =
  (typeof NotificationEvent)[keyof typeof NotificationEvent];

export const ReminderStatus = {
  SENT: "SENT",
  OPENED: "OPENED",
  CLICKED: "CLICKED",
  BOUNCED: "BOUNCED",
  FAILED: "FAILED",
} as const;
export type ReminderStatus =
  (typeof ReminderStatus)[keyof typeof ReminderStatus];

export const CourseVisibility = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;
export type CourseVisibility =
  (typeof CourseVisibility)[keyof typeof CourseVisibility];

export const DeliveryPartnerStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
} as const;
export type DeliveryPartnerStatus =
  (typeof DeliveryPartnerStatus)[keyof typeof DeliveryPartnerStatus];

export const ReferralStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PAID: "PAID",
  REVERSED: "REVERSED",
} as const;
export type ReferralStatus = (typeof ReferralStatus)[keyof typeof ReferralStatus];

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

export const OrgSuspensionMode = {
  LOCK_NOW: "LOCK_NOW",
  GRACE_PERIOD: "GRACE_PERIOD",
} as const;
export type OrgSuspensionMode =
  (typeof OrgSuspensionMode)[keyof typeof OrgSuspensionMode];

export const PayeeType = {
  INSTRUCTOR: "INSTRUCTOR",
  DELIVERY_PARTNER: "DELIVERY_PARTNER",
} as const;
export type PayeeType = (typeof PayeeType)[keyof typeof PayeeType];

export const PayoutMethod = {
  PAYPAL: "PAYPAL",
  BANK: "BANK",
  STRIPE: "STRIPE",
} as const;
export type PayoutMethod = (typeof PayoutMethod)[keyof typeof PayoutMethod];

export const PayoutStatus = {
  REQUESTED: "REQUESTED",
  APPROVED: "APPROVED",
  PAID: "PAID",
  REJECTED: "REJECTED",
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

/** Store-credit ledger reason. Mirrors `CreditLedgerReason` in schema.prisma. */
export const CreditLedgerReason = {
  GRANT_REFUND: "GRANT_REFUND",
  SPEND_CHECKOUT: "SPEND_CHECKOUT",
  ADJUST_MANUAL: "ADJUST_MANUAL",
} as const;
export type CreditLedgerReason =
  (typeof CreditLedgerReason)[keyof typeof CreditLedgerReason];

// Display-label maps for enums the frontend renders verbatim.
export const LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All Levels",
};
