import { z } from "zod";
import type { InstructorStatus } from "../enums.js";

export const applyInstructorSchema = z.object({
  expertise: z.string().min(1).max(80),
  headline: z.string().min(1).max(160),
  bio: z.string().min(1).max(4000),
  sampleUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  twitterUrl: z.string().url().optional(),
  youtubeUrl: z.string().url().optional(),
  facebookUrl: z.string().url().optional(),
  otherUrl: z.string().url().optional(),
});
export type ApplyInstructorInput = z.infer<typeof applyInstructorSchema>;

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
});
export type UpdateInstructorProfileInput = z.infer<
  typeof updateInstructorProfileSchema
>;

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
  status: InstructorStatus;
  appliedAt: string;
  reviewedAt: string | null;
  note: string | null;
}
