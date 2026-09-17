import { z } from "zod";
import { DeliveryPartnerStatus } from "../enums";
import { searchQuerySchema } from "./common.js";
import { countryCodeSchema, emailSchema, passwordSchema } from "./auth.js";

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

export const ApplyDeliveryPartnerSchema = z.object({
  country: countryCodeSchema,
  customFields: z.array(partnerCustomFieldSchema).max(PARTNER_MAX_CUSTOM_FIELDS).default([]),
});
export type ApplyDeliveryPartnerInput = z.infer<typeof ApplyDeliveryPartnerSchema>;

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
