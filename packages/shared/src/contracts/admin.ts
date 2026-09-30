import { z } from "zod";
import type { CouponScope, CouponType } from "../enums.js";
import { CourseStatus, CourseVisibility, OrderStatus } from "../enums.js";
import {
  ReminderChannel,
  ReminderStatus,
  ReminderTrigger,
  StudentStatus,
} from "../enums.js";
import {
  abandonedCartParamsSchema,
  almostDoneParamsSchema,
  automationConditionFromParams,
  idleParamsSchema,
  lowProgressParamsSchema,
  newContentParamsSchema,
  type AbandonedCartAutomationParams,
  type AlmostDoneAutomationParams,
  type IdleAutomationParams,
  type LowProgressAutomationParams,
  type NewContentAutomationParams,
} from "./automation-params.js";
import { searchQuerySchema } from "./common.js";

export interface AdminOverviewDto {
  revenueCents: number;
  enrollments: number;
  students: number;
  instructors: number;
  publishedCourses: number;
  completionRatePct: number;
  refundRatePct: number;
  paidOrders: number;
}

export interface AdminAnalyticsDto {
  /** Last 14 days, oldest first. */
  revenueTrend: { date: string; revenueCents: number; enrollments: number }[];
  /** All regions by paid revenue (all-time), using the checkout region. */
  revenueByRegion: { country: string; revenueCents: number }[];
  /** Course activity counts from actual account/enrollment/order data. */
  funnel: { stage: string; count: number }[];
  recentActivity: {
    type: "order" | "enrollment" | "review" | "signup";
    label: string;
    at: string;
  }[];
}

export interface AdminStudentStatsDto {
  total: number;
  active: number;
  atRisk: number;
}

export interface AdminOrderStatsDto {
  total: number;
  grossPaidCents: number;
  refundCount: number;
}

/** Organization assignment shown by the admin course-management modal. */
export interface AdminCourseOrganizationDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  domain: string | null;
  adminEmail: string;
  seatCount: number;
  usedSeats: number;
  assignedAt: string;
}

export interface AdminCourseStatsDto {
  total: number;
  published: number;
}

/** Admin courses list query: search, pagination, status/visibility/category
 *  filters, and `unassignedToOrgId`/`unassignedToPartnerId` — back the org
 *  and delivery-partner course-assignment dialogs' "Add courses" pickers,
 *  each listing published courses (public or private) not yet assigned to
 *  the given org/partner (see OrganizationsService.assignCourse and
 *  DeliveryPartnerService.assignCourse). */
export const adminCourseQuerySchema = searchQuerySchema.extend({
  status: z.nativeEnum(CourseStatus).optional(),
  visibility: z.nativeEnum(CourseVisibility).optional(),
  category: z.string().optional(),
  unassignedToOrgId: z.string().optional(),
  unassignedToPartnerId: z.string().optional(),
});
export type AdminCourseQuery = z.infer<typeof adminCourseQuerySchema>;

/** Admin orders list query: search, pagination, and payment filters. */
export const adminOrderQuerySchema = searchQuerySchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  gateway: z.enum(["STRIPE", "PAYPAL", "SSLCOMMERZ"]).optional(),
});
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

export interface AdminStudentDto {
  id: string;
  name: string;
  email: string;
  country: string | null;
  status: string;
  totalSpentCents: number;
  enrollments: number;
  joinedAt: string;
}

/** Admin-safe detail view for a student. Intentionally excludes credentials,
 * notification preferences, private notes, and other non-operational data. */
export interface AdminStudentProfileDto {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  country: string | null;
  phone: string | null;
  status: string;
  streakDays: number;
  totalSpentCents: number;
  joinedAt: string;
  lastActivityAt: string | null;
  enrollments: number;
  completedCourses: number;
  certificates: number;
  interests: { categories: string[]; keywords: string[] };
  courses: {
    id: string;
    title: string;
    status: string;
    completedLessons: number;
    totalLessons: number;
    progressPct: number;
    enrolledAt: string;
    lastActivityAt: string;
    completedAt: string | null;
    certificateIssuedAt: string | null;
  }[];
}

/** A single org or delivery-partner membership a student has ever held,
 *  current or past — powers the admin "Memberships" tab so a platform admin
 *  can see (and restore) a membership an org/partner removed. */
export interface AdminMembershipEntryDto {
  /** orgId (organization membership) or courseAssignmentId (delivery-partner
   *  membership) — whichever `kind` this row is. */
  id: string;
  kind: "ORGANIZATION" | "DELIVERY_PARTNER_COURSE";
  orgName?: string;
  role?: string;
  partnerName?: string;
  courseTitle?: string;
  joinedAt: string;
  removedAt: string | null;
  removedBy: { id: string; name: string } | null;
  removedReason: string | null;
}

export interface AdminStudentMembershipsDto {
  organizations: AdminMembershipEntryDto[];
  deliveryPartnerCourses: AdminMembershipEntryDto[];
}

/** One audited event affecting this student — invite created/revoked, member
 *  removed/restored — newest first. Powers the admin "Activity" tab. */
export interface AdminStudentActivityEntryDto {
  id: string;
  action: string;
  actor: { id: string; name: string } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const upsertCouponSchema = z.object({
  code: z.string().min(2).max(40).toUpperCase(),
  type: z.enum(["PERCENT", "FIXED", "FREE"]),
  value: z.number().int().min(0),
  description: z.string().default(""),
  minSpendCents: z.number().int().min(0).nullable().optional(),
  scope: z.enum(["GLOBAL", "COURSE"]).default("GLOBAL"),
  courseId: z.string().nullable().optional(),
  expiresAt: z.string(),
  /** 0 = unlimited. */
  usageLimit: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});
export type UpsertCouponInput = z.infer<typeof upsertCouponSchema>;

/** Lifecycle actions on an existing coupon: enable/disable, promote/unpromote. */
export const patchCouponSchema = z
  .object({
    active: z.boolean().optional(),
    featured: z.boolean().optional(),
  })
  .refine((v) => v.active !== undefined || v.featured !== undefined, {
    message: "Provide active and/or featured",
  });
export type PatchCouponInput = z.infer<typeof patchCouponSchema>;

export interface CouponDto {
  code: string;
  type: CouponType;
  value: number;
  description: string;
  minSpendCents: number | null;
  scope: CouponScope;
  courseId: string | null;
  expiresAt: string;
  usageLimit: number;
  used: number;
  active: boolean;
  featured: boolean;
}

/** Public shape for the storefront promo banner — no usage/limit internals. */
export interface FeaturedCouponDto {
  code: string;
  type: CouponType;
  value: number;
  description: string;
  minSpendCents: number | null;
  expiresAt: string;
}

// ── Platform settings ─────────────────────────────────────────────────────────

export interface PlatformSettingsDto {
  platformName: string;
  supportEmail: string;
  /** Gateway kill-switches — checkout rejects a disabled gateway. */
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  sslcommerzEnabled: boolean;
  notifications: Record<string, boolean>;
  updatedAt: string;
}

/** Every field optional: the settings form saves one card at a time. */
export const updatePlatformSettingsSchema = z
  .object({
    platformName: z.string().trim().min(1).max(80),
    supportEmail: z.string().email(),
    stripeEnabled: z.boolean(),
    paypalEnabled: z.boolean(),
    sslcommerzEnabled: z.boolean(),
    notifications: z.record(z.boolean()),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });
export type UpdatePlatformSettingsInput = z.infer<
  typeof updatePlatformSettingsSchema
>;

// ── User management ───────────────────────────────────────────────────────────

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(StudentStatus),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// ── Order refunds ─────────────────────────────────────────────────────────────

/** Admin refund body — one refund action can span multiple order items with
 *  arbitrary per-item amounts. `comment` is required and surfaces in the
 *  student's notification and their credit-history row. Each `items[]` entry
 *  targets one OrderItem; server validates that amountCents never exceeds
 *  (priceCents − prior refundedCents) for that item. */
export const refundOrderSchema = z.object({
  comment: z.string().trim().min(3).max(500),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        amountCents: z.number().int().positive(),
      }),
    )
    .min(1, "Select at least one item to refund"),
});
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

// ── Automation rules ──────────────────────────────────────────────────────────

/** Starting values for new rules; delivery always uses the saved rule value. */
export const DEFAULT_AUTOMATION_COOLDOWN_HOURS: Record<ReminderTrigger, number> = {
  IDLE: 168,
  LOW_PROGRESS: 168,
  ABANDONED_CART: 24,
  ALMOST_DONE: 168,
  NEW_CONTENT: 168,
};

export const MIN_AUTOMATION_COOLDOWN_HOURS = 24;
export const MAX_AUTOMATION_COOLDOWN_HOURS = 8760; // One year.
export const automationCooldownHoursSchema = z
  .number()
  .int()
  .min(MIN_AUTOMATION_COOLDOWN_HOURS)
  .max(MAX_AUTOMATION_COOLDOWN_HOURS);

type AutomationRuleBaseDto = {
  id: string;
  name: string;
  condition: string;
  channels: ReminderChannel[];
  template: string;
  active: boolean;
  sentCount: number;
  cooldownHours: number;
};

export interface AutomationScheduleDto {
  /** Daily sweep time in HH:MM:SS, using server-local time. */
  sweepTime: string;
}

export type AutomationRuleDto =
  | (AutomationRuleBaseDto & { trigger: "IDLE"; params: IdleAutomationParams })
  | (AutomationRuleBaseDto & { trigger: "LOW_PROGRESS"; params: LowProgressAutomationParams })
  | (AutomationRuleBaseDto & { trigger: "ABANDONED_CART"; params: AbandonedCartAutomationParams })
  | (AutomationRuleBaseDto & { trigger: "ALMOST_DONE"; params: AlmostDoneAutomationParams })
  | (AutomationRuleBaseDto & { trigger: "NEW_CONTENT"; params: NewContentAutomationParams });

export interface ReminderLogDto {
  id: string;
  userId: string | null;
  userName: string | null;
  ruleId: string | null;
  channel: ReminderChannel;
  /** A ReminderTrigger or NotificationEvent value — see ReminderLog in schema.prisma. */
  trigger: string;
  subject: string;
  status: ReminderStatus;
  createdAt: string;
}

const automationRuleBaseSchema = {
  name: z.string().min(1).max(120),
  channels: z.array(z.nativeEnum(ReminderChannel)).min(1),
  template: z.string().min(1).max(2000),
  active: z.boolean().default(true),
  cooldownHours: automationCooldownHoursSchema,
};

export const upsertAutomationRuleSchema = z.discriminatedUnion("trigger", [
  z.object({
    ...automationRuleBaseSchema,
    trigger: z.literal(ReminderTrigger.IDLE),
    params: idleParamsSchema,
  }),
  z.object({
    ...automationRuleBaseSchema,
    trigger: z.literal(ReminderTrigger.LOW_PROGRESS),
    params: lowProgressParamsSchema,
  }),
  z.object({
    ...automationRuleBaseSchema,
    trigger: z.literal(ReminderTrigger.ABANDONED_CART),
    params: abandonedCartParamsSchema,
  }),
  z.object({
    ...automationRuleBaseSchema,
    trigger: z.literal(ReminderTrigger.ALMOST_DONE),
    params: almostDoneParamsSchema,
  }),
  z.object({
    ...automationRuleBaseSchema,
    trigger: z.literal(ReminderTrigger.NEW_CONTENT),
    params: newContentParamsSchema,
  }),
]);
export type UpsertAutomationRuleInput = z.infer<typeof upsertAutomationRuleSchema>;

export { automationConditionFromParams };
export type { AutomationParamsByTrigger } from "./automation-params.js";
export {
  DEFAULT_AUTOMATION_PARAMS,
  parseAutomationRuleParams,
  resolveAutomationRuleParams,
} from "./automation-params.js";

// ── Email templates ─────────────────────────────────────────────────────────

export type EmailTemplateCategory =
  | "auth"
  | "organizations"
  | "delivery_partner"
  | "commerce"
  | "applications"
  | "payouts"
  | "admin_alerts";

export interface EmailTemplateVariableDto {
  name: string;
  description: string;
  sample: string;
}

export interface EmailTemplateDto {
  key: string;
  label: string;
  category: EmailTemplateCategory;
  description: string;
  subject: string;
  body: string;
  ctaLabel?: string;
  variables: EmailTemplateVariableDto[];
  isCustomized: boolean;
  updatedAt?: string;
  updatedByName?: string | null;
}

export const upsertEmailTemplateSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  ctaLabel: z.string().max(60).optional(),
});
export type UpsertEmailTemplateInput = z.infer<typeof upsertEmailTemplateSchema>;

/** Same shape, all optional — an empty body previews the saved override/
 *  default, a full one previews unsaved edits from the admin editor. */
export const previewEmailTemplateSchema = upsertEmailTemplateSchema.partial();
export type PreviewEmailTemplateInput = z.infer<typeof previewEmailTemplateSchema>;

export interface EmailTemplatePreviewDto {
  subject: string;
  html: string;
}
