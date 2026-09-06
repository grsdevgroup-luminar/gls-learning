import { z } from "zod";
import { ReviewStatus } from "../enums.js";
import { searchQuerySchema } from "./common.js";

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1, "Review title is required").max(160, "Review title must be 160 characters or fewer"),
  body: z.string().trim().max(4000, "Review must be 4,000 characters or fewer"),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const reviewStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "HIDDEN"]),
});
export type ReviewStatusInput = z.infer<typeof reviewStatusSchema>;

/** Admin reviews list: search, pagination, plus status / course / rating filters. */
export const adminReviewQuerySchema = searchQuerySchema.extend({
  status: z.nativeEnum(ReviewStatus).optional(),
  courseId: z.string().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
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
  title: string;
  body: string;
  status: ReviewStatus;
  helpful: number;
  createdAt: string;
  /** Course this review belongs to — the moderation queue spans all courses. */
  courseTitle: string;
}
