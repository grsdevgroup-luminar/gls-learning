import { z } from "zod";
import type { CourseLevel, CourseStatus, LessonType } from "../enums.js";

export const courseSortSchema = z
  .enum(["popular", "newest", "rating", "price_asc", "price_desc"])
  .default("popular");
export type CourseSort = z.infer<typeof courseSortSchema>;

export const courseListQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().optional(),
  level: z
    .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"])
    .optional(),
  sort: courseSortSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
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
  slug: string;
  title: string;
  subtitle: string;
  category: string;
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
