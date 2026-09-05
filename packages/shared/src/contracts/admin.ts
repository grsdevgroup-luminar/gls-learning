import { z } from "zod";
import type { CouponScope, CouponType } from "../enums.js";
import { CourseStatus, OrderStatus } from "../enums.js";
import {
  ReminderChannel,
  ReminderStatus,
  ReminderTrigger,
  StudentStatus,
} from "../enums.js";
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

export interface AdminCourseStatsDto {
  total: number;
  published: number;
}

/** Admin courses list query: search, pagination, and status filter. */
export const adminCourseQuerySchema = searchQuerySchema.extend({
  status: z.nativeEnum(CourseStatus).optional(),
});
export type AdminCourseQuery = z.infer<typeof adminCourseQuerySchema>;

/** Admin orders list query: search, pagination, and status filter. */
export const adminOrderQuerySchema = searchQuerySchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
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
  baseCurrency: string;
  defaultLanguage: string;
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
    baseCurrency: z.string().trim().length(3).toUpperCase(),
    defaultLanguage: z.string().trim().min(1).max(40),
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

export interface AutomationRuleDto {
  id: string;
  name: string;
  trigger: ReminderTrigger;
  /** Admin-facing prose describing the rule ("No activity for 7 days"). The
   *  sweep's thresholds live in code — this string is not parsed. */
  condition: string;
  channels: ReminderChannel[];
  template: string;
  active: boolean;
  sentCount: number;
}

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

export const upsertAutomationRuleSchema = z.object({
  name: z.string().min(1).max(120),
  trigger: z.nativeEnum(ReminderTrigger),
  condition: z.string().default(""),
  channels: z.array(z.nativeEnum(ReminderChannel)).min(1),
  template: z.string().min(1).max(2000),
  active: z.boolean().default(true),
});
export type UpsertAutomationRuleInput = z.infer<typeof upsertAutomationRuleSchema>;
