import { z } from "zod";
import type { CouponScope, CouponType } from "../enums.js";
import {
  ReminderChannel,
  ReminderStatus,
  ReminderTrigger,
  StudentStatus,
} from "../enums.js";

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
  trigger: ReminderTrigger;
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
