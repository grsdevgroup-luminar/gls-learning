import { z } from "zod";
import { passwordSchema } from "./auth.js";
import { learningCategorySchema } from "./catalog.js";
import { isValidPhone } from "../phone.js";
import { CourseVisibility } from "../enums.js";

export const MAX_COURSE_DESCRIPTION_LENGTH = 2000;
import { countryCodeSchema } from "./auth.js";

const levelEnum = z.enum([
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "ALL_LEVELS",
]);
const lessonTypeEnum = z.enum(["VIDEO", "QUIZ", "ARTICLE"]);

export const ISO_STANDARD_OPTIONS = [
  "ISO 9001:2015 — Quality Management",
  "ISO 14001:2015 — Environmental Management",
  "ISO 45001:2018 — Occupational Health and Safety",
  "ISO 27001:2022 — Information Security",
  "ISO 22000:2018 — Food Safety Management",
  "ISO 13485:2016 — Medical Devices Quality Management",
  "ISO 50001:2018 — Energy Management",
] as const;

export const createCourseSchema = z.object({
  title: z.string().min(1).max(160),
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by -")
    .optional(),
  subtitle: z.string().max(240, "Subtitle cannot exceed 240 characters").default(""),
  description: z
    .string()
    .max(
      MAX_COURSE_DESCRIPTION_LENGTH,
      `Description cannot exceed ${MAX_COURSE_DESCRIPTION_LENGTH} characters`,
    )
    .default(""),
  category: learningCategorySchema,
  isoStandard: z.string().max(200, "ISO Standard cannot exceed 200 characters").default(""),
  level: levelEnum.default("ALL_LEVELS"),
  thumbnail: z.string().default(""),
  language: z.string().default("English"),
  basePriceCents: z.number().int().min(0).default(0),
  originalPriceCents: z.number().int().min(0).nullable().optional(),
  whatYouLearn: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  /** Platform-admin only — AuthoringService rejects this from anyone else.
   *  Independent of org assignment: PRIVATE hides a course from the public
   *  catalog entirely; which org(s) can then access it is a separate,
   *  later step (OrganizationsService.assignCourse). Only settable once a
   *  course is PUBLISHED. */
  visibility: z.nativeEnum(CourseVisibility).optional(),
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

/** Attachments can be either a link the author owns (URL only) or a file
 *  uploaded through the platform (URL + `storageKey`). The storage key is the
 *  internal handle used to delete the object on file removal or lesson delete;
 *  legacy link-only resources omit it. */
export const lessonResourceSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  sizeLabel: z.string().max(20).optional(),
  storageKey: z.string().min(1).max(512).optional(),
});
export type LessonResourceInput = z.infer<typeof lessonResourceSchema>;

/** Reads the `Lesson.resources` JSON column defensively: it is untyped at the
 *  database level, so anything that doesn't parse is dropped rather than served. */
export function parseLessonResources(value: unknown): LessonResourceInput[] {
  const parsed = z.array(lessonResourceSchema).safeParse(value);
  if (parsed.success) return parsed.data;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const one = lessonResourceSchema.safeParse(item);
    return one.success ? [one.data] : [];
  });
}

export const lessonSchema = z.object({
  title: z.string().min(1).max(200),
  type: lessonTypeEnum.default("VIDEO"),
  durationSec: z.number().int().min(0).default(0),
  preview: z.boolean().default(false),
  order: z.number().int().min(0).optional(),
  articleContent: z.string().nullable().optional(),
  cfVideoUid: z.string().nullable().optional(),
  resources: z.array(lessonResourceSchema).max(20).optional(),
});
export type LessonInput = z.infer<typeof lessonSchema>;

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
export type ReorderInput = z.infer<typeof reorderSchema>;

// ── Quiz authoring ───────────────────────────────────────────────────────────

export const quizOptionInputSchema = z.object({
  text: z.string().min(1).max(300),
  isCorrect: z.boolean(),
  order: z.number().int().min(0).optional(),
});
export type QuizOptionInput = z.infer<typeof quizOptionInputSchema>;

export const createQuizSchema = z.object({
  passScore: z.number().int().min(0).max(100).default(70),
});
export type CreateQuizInput = z.infer<typeof createQuizSchema>;

export const updateQuizSchema = z.object({
  passScore: z.number().int().min(0).max(100),
});
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;

export const createQuizQuestionSchema = z.object({
  prompt: z.string().min(1).max(1000),
  explanation: z.string().max(2000).optional(),
  order: z.number().int().min(0).optional(),
  options: z.array(quizOptionInputSchema).min(2).max(8),
});
export type CreateQuizQuestionInput = z.infer<typeof createQuizQuestionSchema>;

export const updateQuizQuestionSchema = z.object({
  prompt: z.string().min(1).max(1000).optional(),
  explanation: z.string().max(2000).nullable().optional(),
  order: z.number().int().min(0).optional(),
  options: z.array(quizOptionInputSchema).min(2).max(8).optional(),
});
export type UpdateQuizQuestionInput = z.infer<typeof updateQuizQuestionSchema>;

// ── User profile ─────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required. Please enter your name.").max(120).optional(),
  avatar: z.string().url().nullable().optional(),
  country: z.union([countryCodeSchema, z.null()]).optional(),
  /** E.164, validated against the real numbering plan for its calling code
   *  (length + pattern) rather than a generic digit-count regex — the SMS
   *  reminder channel has nowhere to send without a genuinely dialable number. */
  phone: z
    .string()
    .refine(isValidPhone, "Please enter a valid phone number for the selected country")
    .nullable()
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
