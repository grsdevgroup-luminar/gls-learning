import { z } from "zod";
import { SalesAgentStatus } from "../enums";

export const ApplySalesAgentSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  region: z.string().min(2).max(100),
  bio: z.string().min(20).max(1000),
});
export type ApplySalesAgentInput = z.infer<typeof ApplySalesAgentSchema>;

export const ReviewAgentApplicationSchema = z.object({
  status: z.enum([SalesAgentStatus.APPROVED, SalesAgentStatus.REJECTED]),
  commissionPercent: z.number().min(0).max(50).optional(),
  note: z.string().max(500).optional(),
});
export type ReviewAgentApplicationInput = z.infer<
  typeof ReviewAgentApplicationSchema
>;

export const UpdateAgentSchema = z.object({
  commissionPercent: z.number().min(0).max(50).optional(),
  status: z.nativeEnum(SalesAgentStatus).optional(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

export const SalesAgentDto = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  region: z.string(),
  referralCode: z.string(),
  commissionPercent: z.number(),
  status: z.nativeEnum(SalesAgentStatus),
  totalEarningsCents: z.number(),
  pendingEarningsCents: z.number(),
  paidEarningsCents: z.number(),
  referralCount: z.number(),
  createdAt: z.string(),
});
export type SalesAgentDto = z.infer<typeof SalesAgentDto>;

export const SalesAgentReferralDto = z.object({
  id: z.string(),
  orderId: z.string(),
  agentId: z.string(),
  studentName: z.string(),
  courseTitle: z.string(),
  orderTotalCents: z.number(),
  commissionCents: z.number(),
  status: z.enum(["pending", "confirmed", "paid"]),
  createdAt: z.string(),
});
export type SalesAgentReferralDto = z.infer<typeof SalesAgentReferralDto>;
