import { z } from "zod";
import type { CouponScope, CouponType } from "../enums.js";
import { ReminderChannel, ReminderTrigger, StudentStatus } from "../enums.js";

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
  usageLimit: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});
export type UpsertCouponInput = z.infer<typeof upsertCouponSchema>;

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
}

// ── User management ───────────────────────────────────────────────────────────

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(StudentStatus),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// ── Automation rules ──────────────────────────────────────────────────────────

export const upsertAutomationRuleSchema = z.object({
  name: z.string().min(1).max(120),
  trigger: z.nativeEnum(ReminderTrigger),
  condition: z.string().default(""),
  channels: z.array(z.nativeEnum(ReminderChannel)).min(1),
  template: z.string().min(1).max(2000),
  active: z.boolean().default(true),
});
export type UpsertAutomationRuleInput = z.infer<typeof upsertAutomationRuleSchema>;
