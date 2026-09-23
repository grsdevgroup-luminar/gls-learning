import { z } from "zod";
import { InstructorStatus } from "../enums.js";
import { searchQuerySchema } from "./common.js";
import { countryCodeSchema, emailSchema, passwordSchema } from "./auth.js";
import { isValidPhone } from "../phone.js";

export const applyInstructorSchema = z.object({
  expertise: z.string().trim().min(1, "Area of expertise is required.").max(80),
  headline: z.string().trim().min(1, "Professional headline is required.").max(160),
  bio: z.string().trim().min(1, "About section is required.").max(4000),
  sampleUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  twitterUrl: z.string().url().optional(),
  youtubeUrl: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
  otherUrl: z.string().url().optional(),
  // A CV is optional and uploaded separately (multipart) before the JSON
  // apply body is submitted — these just reference that already-uploaded
  // file. The server re-verifies cvKey belongs to the applying user.
  cvKey: z.string().optional(),
  cvName: z.string().max(200).optional(),
  cvSizeLabel: z.string().max(20).optional(),
});
export type ApplyInstructorInput = z.infer<typeof applyInstructorSchema>;

/** Creates the account and the instructor application in one step — the
 *  dedicated instructor signup journey, so applying never requires first
 *  creating (or logging into) a student account. No CV field: that's
 *  uploaded separately post-signup, once the applicant has an account to
 *  scope the upload to. */
export const instructorSignupSchema = z.object({
  name: z.string().trim().min(1, "Full name is required.").max(120),
  email: emailSchema,
  password: passwordSchema,
  country: countryCodeSchema,
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .refine(isValidPhone, "Enter a valid phone number for the selected country."),
}).merge(applyInstructorSchema.omit({ cvKey: true, cvName: true, cvSizeLabel: true }));
export type InstructorSignupInput = z.infer<typeof instructorSignupSchema>;

// A URL field the instructor can also explicitly clear: "" means "remove the
// link", a valid URL means "set it", and omitting the key entirely (the
// `.optional()`) leaves it untouched — matched by
// `.optional()`) leaves it untouched — matched by nullableUrl below on the
// service side, which maps "" to
// service side, which maps "" to null before writing to the DB.
const clearableUrl = z.union([z.string().trim().url(), z.literal("")]).optional();

export const updateInstructorProfileSchema = z.object({
  title: z
    .string()
    .min(1, "Headline is required")
    .max(160, "Headline must be 160 characters or fewer")
    .optional(),
  bio: z
    .string()
    .max(4000, "Bio must be 4,000 characters or fewer")
    .optional(),
  expertise: z.string().max(80).optional(),
  avatar: z.string().optional(),
  sampleUrl: clearableUrl,
  linkedinUrl: clearableUrl,
  twitterUrl: clearableUrl,
  youtubeUrl: clearableUrl,
  facebookUrl: clearableUrl,
  otherUrl: clearableUrl,
});
export type UpdateInstructorProfileInput = z.infer<
  typeof updateInstructorProfileSchema
>;

export const requestInstructorNameChangeSchema = z.object({
  requestedName: z.string().trim().min(1, "Name is required").max(120),
});
export type RequestInstructorNameChangeInput = z.infer<
  typeof requestInstructorNameChangeSchema
>;

export const nameChangeRequestQuerySchema = searchQuerySchema.extend({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});
export type NameChangeRequestQuery = z.infer<typeof nameChangeRequestQuerySchema>;

export interface InstructorNameChangeRequestDto {
  id: string;
  userId: string;
  currentName: string;
  requestedName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  note: string | null;
  email: string;
}
export const reviewApplicationSchema = z.object({
  note: z.string().max(1000).optional(),
});
export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;

/** Rejection requires a reason — it's what the applicant sees in their
 *  decision notification, so an empty one leaves them with no explanation. */
export const rejectApplicationSchema = z.object({
  note: z.string().trim().min(1, "A rejection reason is required").max(1000),
});
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;

export const adminInstructorApplicationQuerySchema = searchQuerySchema.extend({
  status: z.nativeEnum(InstructorStatus).optional(),
});
export type AdminInstructorApplicationQuery = z.infer<
  typeof adminInstructorApplicationQuerySchema
>;

export const adminInstructorQuerySchema = searchQuerySchema.extend({
  expertise: z.string().optional(),
});
export type AdminInstructorQuery = z.infer<typeof adminInstructorQuerySchema>;

export interface InstructorApplicationStatsDto {
  pending: number;
  approved: number;
  rejected: number;
}

/** Public roster entry — no email/earnings, so it is safe to serve unauthenticated. */
export interface InstructorRosterDto {
  id: string;
  name: string;
  avatar: string | null;
  title: string;
  bio: string;
  ratingAvg: number;
  studentCount: number;
  courseCount: number;
}

export interface InstructorProfileDto {
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  title: string;
  bio: string;
  expertise: string | null;
  ratingAvg: number;
  studentCount: number;
  courseCount: number;
  earningsCents: number;
  status: InstructorStatus;
  /** Admin's reason when `status` is REJECTED — null otherwise. */
  note: string | null;
  sampleUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  facebookUrl?: string | null;
  otherUrl?: string | null;
  joinedAt?: string;
  pendingNameChange?: InstructorNameChangeRequestDto | null;
  /** Most recently rejected name-change request, so its reason can still be
   *  shown after the request drops out of the PENDING-only query above. */
  lastRejectedNameChange?: InstructorNameChangeRequestDto | null;
}

/** Public instructor profile — no email/earnings, safe to serve unauthenticated. */
export interface InstructorPublicProfileDto {
  id: string;
  name: string;
  avatar: string | null;
  title: string;
  bio: string;
  expertise: string | null;
  ratingAvg: number;
  studentCount: number;
  courseCount: number;
  joinedAt: string;
  sampleUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  otherUrl: string | null;
}

export interface InstructorApplicationDto {
  id: string;
  name: string;
  email: string;
  expertise: string;
  headline: string;
  bio: string;
  sampleUrl: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
  facebookUrl: string | null;
  otherUrl: string | null;
  cvName: string | null;
  cvUrl: string | null;
  cvSizeLabel: string | null;
  status: InstructorStatus;
  appliedAt: string;
  reviewedAt: string | null;
  note: string | null;
}

/** Response from the CV upload endpoint — `key` is echoed back in the apply
 *  body so the server can verify it belongs to the uploading user. */
export interface InstructorCvUploadDto {
  key: string;
  name: string;
  url: string;
  sizeLabel: string;
}
