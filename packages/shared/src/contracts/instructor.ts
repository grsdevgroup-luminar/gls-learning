import { z } from "zod";
import type { InstructorStatus } from "../enums.js";

export const applyInstructorSchema = z.object({
  expertise: z.string().min(1).max(80),
  headline: z.string().min(1).max(160),
  bio: z.string().min(1).max(4000),
  sampleUrl: z.string().url().optional(),
});
export type ApplyInstructorInput = z.infer<typeof applyInstructorSchema>;

export const updateInstructorProfileSchema = z.object({
  title: z.string().max(160).optional(),
  bio: z.string().max(4000).optional(),
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
  status: InstructorStatus;
  appliedAt: string;
  reviewedAt: string | null;
  note: string | null;
}
