import { z } from "zod";
import { RatingStage, ReviewStatus } from "../enums.js";
import { searchQuerySchema } from "./common.js";

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z
    .string()
    .trim()
    .min(1, "Review is required")
    .max(4000, "Review must be 4,000 characters or fewer"),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const reviewStatusSchema = z.object({
  action: z.enum(["APPROVE", "HIDE", "UNHIDE"]),
});
export type ReviewStatusInput = z.infer<typeof reviewStatusSchema>;

/** Admin reviews list: search, pagination, plus status / course / rating filters. */
export const adminReviewQuerySchema = searchQuerySchema.extend({
  status: z.nativeEnum(ReviewStatus).optional(),
  courseId: z.string().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  /** Deep-link a single review (e.g. from a notification) regardless of the
   *  other filters. */
  reviewId: z.string().min(1).optional(),
});
export type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>;

export interface AdminReviewStatsDto {
  avgRating: number;
  approved: number;
  pending: number;
}

export interface AdminReviewCourseOptionDto {
  id: string;
  title: string;
}

export interface ReviewDto {
  id: string;
  courseId: string;
  author: string;
  avatar: string | null;
  rating: number;
  body: string;
  status: ReviewStatus;
  helpful: number;
  createdAt: string;
  /** Course this review belongs to — the moderation queue spans all courses. */
  courseTitle: string;
  progressPercent: number;
  ratingStage: RatingStage;
  /** Learners who finished more of a course contribute more strongly. */
  ratingWeight: number;
}
