import { z } from "zod";
import type { ReviewStatus } from "../enums.js";

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const reviewStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "HIDDEN"]),
});
export type ReviewStatusInput = z.infer<typeof reviewStatusSchema>;

export interface ReviewDto {
  id: string;
  courseId: string;
  author: string;
  avatar: string | null;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  helpful: number;
  createdAt: string;
  /** Course this review belongs to — the moderation queue spans all courses. */
  courseTitle: string;
}
