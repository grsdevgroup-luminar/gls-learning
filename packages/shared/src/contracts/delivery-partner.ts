import { z } from "zod";
import { DeliveryPartnerStatus } from "../enums";
import { searchQuerySchema } from "./common.js";
import { countryCodeSchema, emailSchema, passwordSchema } from "./auth.js";
import type { CourseSummaryDto } from "./catalog.js";

export const PARTNER_MAX_CUSTOM_FIELDS = 10;
export const PARTNER_MAX_DOCUMENTS = 5;

export const partnerCustomFieldSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(500),
});
export type PartnerCustomField = z.infer<typeof partnerCustomFieldSchema>;

/** Defensive parse for the `customFields` JSON column — salvages individually
 *  valid entries rather than failing the whole read on one bad row. */
export function parsePartnerCustomFields(value: unknown): PartnerCustomField[] {
  const parsed = z.array(partnerCustomFieldSchema).safeParse(value);
  if (parsed.success) return parsed.data;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const one = partnerCustomFieldSchema.safeParse(item);
    return one.success ? [one.data] : [];
  });
}

export const partnerDocumentSchema = z.object({
  title: z.string().trim().min(1).max(80),
  key: z.string(),
  name: z.string(),
  sizeLabel: z.string(),
});
export type PartnerDocument = z.infer<typeof partnerDocumentSchema>;

export function parsePartnerDocuments(value: unknown): PartnerDocument[] {
  const parsed = z.array(partnerDocumentSchema).safeParse(value);
  if (parsed.success) return parsed.data;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const one = partnerDocumentSchema.safeParse(item);
    return one.success ? [one.data] : [];
  });
}

/** Building block for `DeliveryPartnerSignupSchema` below — applying is only
 *  ever done as part of that combined signup+apply step (an existing account
 *  cannot self-initiate a delivery-partner application; see
 *  DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §2 for why). */
const ApplyDeliveryPartnerSchema = z.object({
  country: countryCodeSchema,
  customFields: z.array(partnerCustomFieldSchema).max(PARTNER_MAX_CUSTOM_FIELDS).default([]),
  // The applicant's requested rate — a starting point for the admin's
  // review, not binding; the admin sets the actual rate on approval.
  expectedCommissionPercent: z.number().min(1, "Commission must be at least 1%").max(50, "Commission cannot exceed 50%").optional(),
});

/** Creates the account and the delivery-partner application in one step —
 *  applying never requires first creating (or logging into) a student
 *  account. Documents are attached afterward, once the applicant has an
 *  account/application to scope the upload to. */
export const DeliveryPartnerSignupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: passwordSchema,
}).merge(ApplyDeliveryPartnerSchema);
export type DeliveryPartnerSignupInput = z.infer<typeof DeliveryPartnerSignupSchema>;

export const ReviewPartnerApplicationSchema = z.object({
  status: z.enum([DeliveryPartnerStatus.APPROVED, DeliveryPartnerStatus.REJECTED]),
  commissionPercent: z.number().min(1, "Commission must be at least 1%").max(50, "Commission cannot exceed 50%").optional(),
  note: z.string().max(1000).optional(),
});
export type ReviewPartnerApplicationInput = z.infer<
  typeof ReviewPartnerApplicationSchema
>;

export const UpdatePartnerSchema = z.object({
  commissionPercent: z.number().min(1, "Commission must be at least 1%").max(50, "Commission cannot exceed 50%").optional(),
  status: z.nativeEnum(DeliveryPartnerStatus).optional(),
});
export type UpdatePartnerInput = z.infer<typeof UpdatePartnerSchema>;

export const AdminDeliveryPartnerApplicationQuerySchema = searchQuerySchema.extend({
  status: z.nativeEnum(DeliveryPartnerStatus).optional(),
});
export type AdminDeliveryPartnerApplicationQuery = z.infer<
  typeof AdminDeliveryPartnerApplicationQuerySchema
>;

export const AdminDeliveryPartnerQuerySchema = searchQuerySchema;
export type AdminDeliveryPartnerQuery = z.infer<typeof AdminDeliveryPartnerQuerySchema>;

export const DeliveryPartnerDto = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  region: z.string(),
  referralCode: z.string(),
  commissionPercent: z.number(),
  status: z.nativeEnum(DeliveryPartnerStatus),
  totalEarningsCents: z.number(),
  pendingEarningsCents: z.number(),
  paidEarningsCents: z.number(),
  referralCount: z.number(),
  createdAt: z.string(),
});
export type DeliveryPartnerDto = z.infer<typeof DeliveryPartnerDto>;

export const DeliveryPartnerReferralDto = z.object({
  id: z.string(),
  orderId: z.string(),
  partnerId: z.string(),
  studentName: z.string(),
  courseTitle: z.string(),
  orderTotalCents: z.number(),
  commissionCents: z.number(),
  status: z.enum(["pending", "confirmed", "paid"]),
  createdAt: z.string(),
});
export type DeliveryPartnerReferralDto = z.infer<typeof DeliveryPartnerReferralDto>;

export interface PartnerDocumentDto extends PartnerDocument {
  url: string;
}

export interface DeliveryPartnerApplicationDto {
  id: string;
  name: string;
  email: string;
  country: string | null;
  customFields: PartnerCustomField[];
  documents: PartnerDocumentDto[];
  expectedCommissionPercent: number | null;
  status: DeliveryPartnerStatus;
  appliedAt: string;
  reviewedAt: string | null;
  note: string | null;
}

export interface DeliveryPartnerApplicationStatsDto {
  pending: number;
  approved: number;
  rejected: number;
}

// ─── Course assignment + members (see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md) ──
// Mirrors the Organization/CourseOrgAssignment pattern, but access is
// per-course: a member invited through one course assignment does not get
// access to the partner's other assigned courses.

/** Admin-only — sets the per-course member cap at assignment time, mirroring
 *  Organization.seatCount. */
export const AssignPartnerCourseSchema = z.object({
  courseId: z.string(),
  memberCap: z.number().int().min(1).max(1000).default(10),
});
export type AssignPartnerCourseInput = z.infer<typeof AssignPartnerCourseSchema>;

export const UpdatePartnerCourseAssignmentSchema = z.object({
  memberCap: z.number().int().min(1).max(1000),
});
export type UpdatePartnerCourseAssignmentInput = z.infer<
  typeof UpdatePartnerCourseAssignmentSchema
>;

export interface DeliveryPartnerCourseAssignmentDto {
  id: string;
  partnerId: string;
  course: CourseSummaryDto;
  memberCap: number;
  usedSeats: number;
  createdAt: string;
}

export const InvitePartnerMemberSchema = z.object({
  email: emailSchema,
});
export type InvitePartnerMemberInput = z.infer<typeof InvitePartnerMemberSchema>;

export interface DeliveryPartnerMemberDto {
  id: string;
  courseAssignmentId: string;
  userId: string | null;
  name: string;
  email: string;
  joinedAt: string;
}

export interface DeliveryPartnerInvitationDto {
  id: string;
  courseAssignmentId: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

/** Public preview shown at the claim link before the visitor signs in. */
export interface PartnerInvitationInfoDto {
  valid: boolean;
  email: string | null;
  courseTitle: string | null;
  partnerName: string | null;
}

/** One course a member has access to via a delivery partner — powers the
 *  member-facing granted-courses page (deliberately not /dashboard/team,
 *  see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §6.3). */
export interface PartnerGrantedCourseDto {
  courseAssignmentId: string;
  partnerName: string;
  course: CourseSummaryDto;
  joinedAt: string;
  /** Mirrors Organization's accessLocked, simplified — delivery partner has
   *  no grace-period concept, so this is just "is the partner currently
   *  suspended." A member's access pauses along with their partner's. */
  partnerSuspended: boolean;
}
