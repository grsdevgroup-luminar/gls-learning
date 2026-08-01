import { z } from "zod";
import { OrgStatus, OrgMemberRole } from "../enums";

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with hyphens"),
  domain: z.string().optional(),
  adminEmail: z.string().email(),
  seatCount: z.number().int().min(1).max(10000),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  domain: z.string().optional(),
  logoUrl: z.string().url().optional(),
  seatCount: z.number().int().min(1).max(10000).optional(),
  status: z.nativeEnum(OrgStatus).optional(),
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
  seatCount: z.number(),
  usedSeats: z.number(),
  createdAt: z.string(),
  members: z.array(OrgMemberDto),
  privateCourseCount: z.number(),
});
export type OrganizationDto = z.infer<typeof OrganizationDto>;
