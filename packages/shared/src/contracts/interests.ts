import { z } from "zod";
import { learningCategorySchema } from "./catalog.js";

/** A learner chooses exactly three catalog categories in the sign-up modal. */
export const REQUIRED_INTEREST_CATEGORY_COUNT = 3;
export const MAX_INTEREST_KEYWORDS = 12;

const keywordSchema = z.string().trim().min(1).max(48);

export const updateLearningPreferencesSchema = z.object({
  categories: z
    .array(learningCategorySchema)
    .length(
      REQUIRED_INTEREST_CATEGORY_COUNT,
      `Choose exactly ${REQUIRED_INTEREST_CATEGORY_COUNT} learning areas`,
    )
    .refine((categories) => new Set(categories).size === categories.length, {
      message: "Choose three different learning areas",
    }),
  keywords: z
    .array(keywordSchema)
    .max(MAX_INTEREST_KEYWORDS, `Add up to ${MAX_INTEREST_KEYWORDS} keywords`)
    .refine(
      (keywords) =>
        new Set(keywords.map((keyword) => keyword.toLocaleLowerCase())).size ===
        keywords.length,
      { message: "Each keyword can only be added once" },
    )
    .default([]),
});
export type UpdateLearningPreferencesInput = z.infer<
  typeof updateLearningPreferencesSchema
>;

export interface LearningPreferencesDto {
  categories: string[];
  keywords: string[];
  completed: boolean;
}
