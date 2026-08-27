import { z } from "zod";

export const CATEGORY_NAME_MAX_LENGTH = 80;

export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Category name is required")
  .max(CATEGORY_NAME_MAX_LENGTH, `Category name cannot exceed ${CATEGORY_NAME_MAX_LENGTH} characters`);

export const categoryStatusSchema = z.enum(["ACTIVE", "PENDING", "REJECTED"]);
export type CategoryStatus = z.infer<typeof categoryStatusSchema>;

export const categoryProposalSchema = z.object({ name: categoryNameSchema });
export type CategoryProposalInput = z.infer<typeof categoryProposalSchema>;

export const createCategorySchema = z.object({ name: categoryNameSchema });
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: categoryNameSchema.optional(),
    status: categoryStatusSchema.optional(),
  })
  .refine((input) => input.name !== undefined || input.status !== undefined, {
    message: "Provide a category name or status",
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export interface CategoryDto {
  id: string;
  name: string;
  status: CategoryStatus;
  courseCount: number;
  createdAt: string;
  updatedAt: string;
}
