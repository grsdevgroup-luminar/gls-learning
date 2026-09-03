import { z } from "zod";
import type { CourseLevel, CourseStatus, LessonType } from "../enums.js";

export const courseSortSchema = z
  .enum(["popular", "newest", "rating", "price_asc", "price_desc"])
  .default("popular");
export type CourseSort = z.infer<typeof courseSortSchema>;

/** Largest page the catalog will serve. Callers that want "the whole catalog"
 *  must use this — asking for more is a 400. */
export const MAX_PAGE_SIZE = 48;

/**
 * The platform taxonomy is deliberately independent of the courses currently
 * published.  That keeps every learning path available to new students even
 * while a category is being prepared by instructors.
 */
export const LEARNING_CATEGORIES = [
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
] as const;
/** Categories are managed in the API. This alias remains for UI compatibility. */
export type LearningCategory = string;
export const learningCategorySchema = z
  .string()
  .trim()
  .min(1, "Category is required")
  .max(80, "Category cannot exceed 80 characters");

/** Catalog search box limit — keeps URLs and ILIKE filters bounded. */
export const MAX_COURSE_SEARCH_LENGTH = 200;
export const MIN_COURSE_SEARCH_LENGTH = 2;

export function normalizeCourseSearchQuery(value: string): string {
  return value.trim().slice(0, MAX_COURSE_SEARCH_LENGTH);
}

/** Returns a trimmed, capped query when it meets the minimum length; otherwise "". */
export function activeCourseSearchQuery(value: string): string {
  const query = normalizeCourseSearchQuery(value);
  return query.length >= MIN_COURSE_SEARCH_LENGTH ? query : "";
}

export const courseListQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(
      MAX_COURSE_SEARCH_LENGTH,
      `Search cannot exceed ${MAX_COURSE_SEARCH_LENGTH} characters`,
    )
    .optional(),
  category: z.union([learningCategorySchema, z.array(learningCategorySchema).min(1)]).optional(),
  level: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"])
    .optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  instructorId: z.string().optional(),
  sort: courseSortSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(12),
});
export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

export interface InstructorSummaryDto {
  id: string;
  name: string;
  title: string;
  avatar: string | null;
  bio?: string;
  ratingAvg?: number;
  studentCount?: number;
  courseCount?: number;
}

/** A downloadable attachment on a lesson (slides, starter repo, cheat sheet). */
export interface LessonResourceDto {
  name: string;
  /** Absolute URL the learner downloads from. For platform-uploaded files this
   *  is a short-lived signed URL — do not cache. */
  url: string;
  /** Optional human-readable size, e.g. "2.4 MB" — display only. */
  sizeLabel?: string;
  /** Internal storage handle for platform-uploaded files. Present only for
   *  files uploaded through the resource upload endpoint; absent for links. */
  storageKey?: string;
}

export interface LessonPublicDto {
  id: string;
  title: string;
  durationSec: number;
  type: LessonType;
  preview: boolean;
  order: number;
  hasQuiz: boolean;
  /** Whether a Cloudflare Stream video is attached (course builder upload status). */
  hasVideo: boolean;
  resources: LessonResourceDto[];
  /** Owner/admin only (course builder) — omitted from the public catalog so
   *  paid article content can't be read without enrolling. */
  articleContent?: string | null;
}

export interface SectionDto {
  id: string;
  title: string;
  order: number;
  lessons: LessonPublicDto[];
}

export interface CourseSummaryDto {
  id: string;
  courseNumber: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  isoStandard: string;
  level: CourseLevel;
  thumbnail: string;
  status: CourseStatus;
  bestseller: boolean;
  language: string;
  basePriceCents: number;
  originalPriceCents: number | null;
  ratingAvg: number;
  reviewCount: number;
  studentCount: number;
  durationSec: number;
  lessonCount: number;
  instructor: InstructorSummaryDto;
}

export interface CourseDetailDto extends CourseSummaryDto {
  description: string;
  whatYouLearn: string[];
  requirements: string[];
  updatedAt: string;
  sections: SectionDto[];
}
