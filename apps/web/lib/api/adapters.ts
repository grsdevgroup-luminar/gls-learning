// Maps API DTOs (cents, UPPER enums, nested instructor) back onto the prototype
// domain types the existing UI components consume. Lets us swap the data source
// to the live API with minimal component churn.
import type {
  CourseDetailDto,
  CourseSummaryDto,
  CourseLevel,
  EnrollmentDto,
  ReviewDto,
} from "@skillstream/shared";
import type { Course, Level, Review, Section } from "@/types";

const LEVEL_TO_LEGACY: Record<CourseLevel, Level> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  ALL_LEVELS: "All Levels",
};

const STATUS_TO_LEGACY = {
  DRAFT: "draft",
  REVIEW: "review",
  PUBLISHED: "published",
} as const;

const LESSON_TYPE_TO_LEGACY = {
  VIDEO: "video",
  QUIZ: "quiz",
  ARTICLE: "article",
} as const;

function baseCourse(dto: CourseSummaryDto): Omit<Course, "sections"> {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    subtitle: dto.subtitle,
    description: "",
    category: dto.category,
    level: LEVEL_TO_LEGACY[dto.level],
    thumbnail: dto.thumbnail,
    instructorId: dto.instructor.id,
    instructor: {
      id: dto.instructor.id,
      name: dto.instructor.name,
      title: dto.instructor.title,
      avatar: dto.instructor.avatar,
      bio: dto.instructor.bio,
      rating: dto.instructor.ratingAvg,
      students: dto.instructor.studentCount,
      courses: dto.instructor.courseCount,
    },
    basePrice: dto.basePriceCents / 100,
    originalPrice: dto.originalPriceCents
      ? dto.originalPriceCents / 100
      : undefined,
    rating: dto.ratingAvg,
    reviewCount: dto.reviewCount,
    studentCount: dto.studentCount,
    language: dto.language,
    updatedAt: new Date().toISOString(),
    status: STATUS_TO_LEGACY[dto.status],
    bestseller: dto.bestseller,
    whatYouLearn: [],
    requirements: [],
    lessonCount: dto.lessonCount,
    durationSec: dto.durationSec,
    revenue: 0,
  };
}

/** Summary → legacy Course (no curriculum; cards/lists only). */
export function toLegacyCourse(dto: CourseSummaryDto): Course {
  return { ...baseCourse(dto), sections: [] };
}

/** Detail → legacy Course with curriculum (quiz content omitted by the API; the
 *  quiz player fetches it separately and gates on `type === 'quiz'`). */
export function toLegacyCourseDetail(dto: CourseDetailDto): Course {
  const sections: Section[] = dto.sections.map((s) => ({
    id: s.id,
    title: s.title,
    lessons: s.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      durationSec: l.durationSec,
      type: LESSON_TYPE_TO_LEGACY[l.type],
      preview: l.preview,
    })),
  }));
  return {
    ...baseCourse(dto),
    description: dto.description,
    updatedAt: dto.updatedAt,
    whatYouLearn: dto.whatYouLearn,
    requirements: dto.requirements,
    sections,
  };
}

export function toLegacyReview(dto: ReviewDto): Review {
  return {
    id: dto.id,
    courseId: dto.courseId,
    author: dto.author,
    avatar: dto.avatar ?? "",
    rating: dto.rating,
    date: dto.createdAt.slice(0, 10),
    title: dto.title,
    body: dto.body,
    status: dto.status.toLowerCase() as Review["status"],
    helpful: dto.helpful,
  };
}

/** Completed-lesson-id map keyed by courseId, from the user's enrollments. */
export function enrollmentsToProgress(
  enrollments: EnrollmentDto[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of enrollments) out[e.courseId] = e.completedLessonIds;
  return out;
}
