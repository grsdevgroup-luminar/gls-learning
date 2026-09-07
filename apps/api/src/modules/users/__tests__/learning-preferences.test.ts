import { describe, expect, it } from "vitest";
import {
  REQUIRED_INTEREST_CATEGORY_COUNT,
  LEARNING_CATEGORIES,
  updateLearningPreferencesSchema,
} from "@skillstream/shared";

describe("updateLearningPreferencesSchema", () => {
  it("keeps the complete ten-category taxonomy available", () => {
    expect(LEARNING_CATEGORIES).toEqual([
      "Cloud",
      "Communication",
      "Data Science",
      "Design",
      "Development",
      "Finance",
      "Health & Wellness",
      "Language Learning",
      "Marketing",
      "Personal Development",
    ]);
  });

  it("accepts three or more distinct areas without an upper limit and defaults optional keywords", () => {
    const parsed = updateLearningPreferencesSchema.parse({
      categories: [
        "Development",
        "Design",
        "Data Science",
        "Cloud",
      ],
    });

    expect(parsed.categories).toHaveLength(4);
    expect(parsed.keywords).toEqual([]);
  });

  it("rejects fewer than three areas", () => {
    expect(updateLearningPreferencesSchema.safeParse({
      categories: ["Development", "Design"],
    }).success).toBe(false);
    expect(updateLearningPreferencesSchema.safeParse({ categories: [] }).success).toBe(false);
  });

  it("rejects duplicate areas and case-insensitive duplicate keywords", () => {
    expect(
      updateLearningPreferencesSchema.safeParse({
        categories: ["Development", "Development", "Design"],
      }).success,
    ).toBe(false);
    expect(
      updateLearningPreferencesSchema.safeParse({
        categories: ["Development", "Design", "Data Science"],
        keywords: ["React", "react"],
      }).success,
    ).toBe(false);
  });
});
