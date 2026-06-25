import { z } from "zod";

const levelEnum = z.enum([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "ALL_LEVELS",
]);
const lessonTypeEnum = z.enum(["VIDEO", "QUIZ", "ARTICLE"]);

export const createCourseSchema = z.object({
  title: z.string().min(1).max(160),
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by -")
    .optional(),
  subtitle: z.string().max(240).default(""),
  description: z.string().default(""),
  category: z.string().min(1),
  level: levelEnum.default("ALL_LEVELS"),
  thumbnail: z.string().default(""),
  language: z.string().default("English"),
  basePriceCents: z.number().int().min(0).default(0),
  originalPriceCents: z.number().int().min(0).nullable().optional(),
  whatYouLearn: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
});
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = createCourseSchema.partial();
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

export const courseStatusSchema = z.object({
  status: z.enum(["DRAFT", "REVIEW", "PUBLISHED"]),
});
export type CourseStatusInput = z.infer<typeof courseStatusSchema>;

export const sectionSchema = z.object({
  title: z.string().min(1).max(160),
  order: z.number().int().min(0).optional(),
});
export type SectionInput = z.infer<typeof sectionSchema>;

export const lessonSchema = z.object({
  title: z.string().min(1).max(200),
  type: lessonTypeEnum.default("VIDEO"),
  durationSec: z.number().int().min(0).default(0),
  preview: z.boolean().default(false),
  order: z.number().int().min(0).optional(),
  articleContent: z.string().nullable().optional(),
  cfVideoUid: z.string().nullable().optional(),
});
export type LessonInput = z.infer<typeof lessonSchema>;

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
export type ReorderInput = z.infer<typeof reorderSchema>;
