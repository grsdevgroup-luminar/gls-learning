import { z } from "zod";

/** Flat course discussion. No moderation state — any logged-in user may post. */
export const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export interface CommentDto {
  id: string;
  courseId: string;
  author: string;
  avatar: string | null;
  body: string;
  createdAt: string;
}
