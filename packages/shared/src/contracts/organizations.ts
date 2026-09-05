import { z } from "zod";
import { OrgStatus, OrgMemberRole, OrgSuspensionMode } from "../enums";

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  domain: z.string().optional(),
  adminEmail: z.string().email(),
  adminName: z.string().min(1).max(120).optional(),
  seatCount: z.number().int().min(1).max(10000),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional(),
  seatCount: z.number().int().min(1).max(10000).optional(),
  status: z.nativeEnum(OrgStatus).optional(),
  /** Only meaningful when `status` is being set to SUSPENDED. */
  suspensionMode: z.nativeEnum(OrgSuspensionMode).optional(),
  /** Required when `suspensionMode` is GRACE_PERIOD. */
  graceDays: z.number().int().min(1).max(90).optional(),
});
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

export const InviteOrgMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(OrgMemberRole),
});
export type InviteOrgMemberInput = z.infer<typeof InviteOrgMemberSchema>;

export const AssignOrgCourseSchema = z.object({
  courseId: z.string(),
});
export type AssignOrgCourseInput = z.infer<typeof AssignOrgCourseSchema>;

export const OrgMemberDto = z.object({
  id: z.string(),
  orgId: z.string(),
  userId: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  role: z.nativeEnum(OrgMemberRole),
  joinedAt: z.string(),
});
export type OrgMemberDto = z.infer<typeof OrgMemberDto>;

export const OrganizationDto = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  logoUrl: z.string().nullable(),
  adminEmail: z.string(),
  status: z.nativeEnum(OrgStatus),
  suspensionMode: z.nativeEnum(OrgSuspensionMode).nullable(),
  accessLocksAt: z.string().nullable(),
  /** Server-computed via `isOrgAccessLocked` — the frontend should never
   *  re-derive this from status/accessLocksAt itself. */
  accessLocked: z.boolean(),
  seatCount: z.number(),
  usedSeats: z.number(),
  createdAt: z.string(),
  members: z.array(OrgMemberDto),
  privateCourseCount: z.number(),
});
export type OrganizationDto = z.infer<typeof OrganizationDto>;

/** Returned only by POST /organizations — the one time the raw temp password
 *  is ever exposed, mirroring how invite() returns its raw token. */
export const CreateOrganizationResultDto = OrganizationDto.extend({
  tempPassword: z.string(),
  credentialsEmailSent: z.boolean(),
});
export type CreateOrganizationResultDto = z.infer<typeof CreateOrganizationResultDto>;
