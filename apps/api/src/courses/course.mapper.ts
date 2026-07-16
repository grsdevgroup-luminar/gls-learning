import { Prisma } from "@prisma/client";
import type {
  CourseDetailDto,
  CourseSummaryDto,
  InstructorSummaryDto,
  SectionDto,
} from "@skillstream/shared";

// Prisma payload shapes (with the relations the mappers require).
const summaryInclude = {
  instructor: { include: { instructorProfile: true } },
  sections: { include: { lessons: { select: { durationSec: true } } } },
} satisfies Prisma.CourseInclude;

export type CourseSummaryRow = Prisma.CourseGetPayload<{
  include: typeof summaryInclude;
}>;

const detailInclude = {
  instructor: { include: { instructorProfile: true } },
  sections: {
    orderBy: { order: "asc" },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        include: { quiz: { select: { id: true } } },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type CourseDetailRow = Prisma.CourseGetPayload<{
  include: typeof detailInclude;
}>;

export const COURSE_SUMMARY_INCLUDE = summaryInclude;
export const COURSE_DETAIL_INCLUDE = detailInclude;

function mapInstructor(
  instructor: CourseSummaryRow["instructor"],
  full = false,
): InstructorSummaryDto {
  const p = instructor.instructorProfile;
  const base: InstructorSummaryDto = {
    id: instructor.id,
    name: instructor.name,
    title: p?.title ?? "",
    avatar: instructor.avatar,
  };
  if (full && p) {
    base.bio = p.bio;
    base.ratingAvg = p.ratingAvg;
    base.studentCount = p.studentCount;
    base.courseCount = p.courseCount;
  }
  return base;
}

export function toCourseSummary(row: CourseSummaryRow): CourseSummaryDto {
  let durationSec = 0;
  let lessonCount = 0;
  for (const s of row.sections) {
    for (const l of s.lessons) {
      durationSec += l.durationSec;
      lessonCount += 1;
    }
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    level: row.level,
    thumbnail: row.thumbnail,
    status: row.status,
    bestseller: row.bestseller,
    language: row.language,
    basePriceCents: row.basePriceCents,
    originalPriceCents: row.originalPriceCents,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    studentCount: row.studentCount,
    durationSec,
    lessonCount,
    instructor: mapInstructor(row.instructor),
  };
}

export function toCourseDetail(
  row: CourseDetailRow,
  opts?: { includeArticleContent?: boolean },
): CourseDetailDto {
  let durationSec = 0;
  let lessonCount = 0;
  const sections: SectionDto[] = row.sections.map((s) => ({
    id: s.id,
    title: s.title,
    order: s.order,
    lessons: s.lessons.map((l) => {
      durationSec += l.durationSec;
      lessonCount += 1;
      return {
        id: l.id,
        title: l.title,
        durationSec: l.durationSec,
        type: l.type,
        preview: l.preview,
        order: l.order,
        hasQuiz: l.quiz !== null,
        hasVideo: l.cfVideoUid !== null,
        ...(opts?.includeArticleContent
          ? { articleContent: l.articleContent }
          : {}),
      };
    }),
  }));

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    level: row.level,
    thumbnail: row.thumbnail,
    status: row.status,
    bestseller: row.bestseller,
    language: row.language,
    basePriceCents: row.basePriceCents,
    originalPriceCents: row.originalPriceCents,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    studentCount: row.studentCount,
    durationSec,
    lessonCount,
    instructor: mapInstructor(row.instructor, true),
    description: row.description,
    whatYouLearn: row.whatYouLearn,
    requirements: row.requirements,
    updatedAt: row.updatedAt.toISOString(),
    sections,
  };
}
