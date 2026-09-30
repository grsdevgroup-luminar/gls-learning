import { Prisma } from "@prisma/client";
import { parseLessonResources } from "@grslearning/shared";
import type {
  CourseDetailDto,
  CourseSummaryDto,
  InstructorSummaryDto,
  SectionDto,
  LessonPptxDto,
} from "@grslearning/shared";

// Prisma payload shapes (with the relations the mappers require).
const summaryInclude = {
  instructor: { include: { instructorProfile: true } },
  sections: { where: { archivedAt: null }, include: { lessons: { where: { archivedAt: null }, select: { type: true, durationSec: true } } } },
} satisfies Prisma.CourseInclude;

export type CourseSummaryRow = Prisma.CourseGetPayload<{
  include: typeof summaryInclude;
}>;

const detailInclude = {
  instructor: { include: { instructorProfile: true } },
  // Only the org ids are needed — just enough for CoursesService.bySlug()'s
  // "is this caller a member of any org this PRIVATE course is assigned to"
  // check. Never mapped into CourseDetailDto (admin-only concern).
  orgAssignments: { select: { orgId: true } },
  sections: {
    where: { archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      lessons: {
        where: { archivedAt: null },
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
    courseNumber: row.courseNumber,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    isoStandard: row.isoStandard,
    level: row.level,
    thumbnail: row.thumbnail,
    status: row.status,
    visibility: row.visibility,
    bestseller: row.bestseller,
    language: row.language,
    basePriceCents: row.basePriceCents,
    originalPriceCents: row.originalPriceCents,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    ratingWeightedCount: row.ratingWeightedCount,
    completedReviewCount: row.completedReviewCount,
    studentCount: row.studentCount,
    durationSec,
    lessonCount,
    updatedAt: row.updatedAt.toISOString(),
    instructor: mapInstructor(row.instructor),
  };
}

export function toCourseDetail(
  row: CourseDetailRow,
  opts?: {
    includeArticleContent?: boolean;
    includeLessonResources?: boolean;
    accessibleLessonIds?: ReadonlySet<string>;
    canEnrollForOrganization?: boolean;
  },
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
      // Preview lessons are the course's marketing surface — their resources
      // (slides, starter code) must be downloadable by anyone browsing the
      // catalog, not just enrolled learners. So `preview === true` bypasses
      // both the `includeLessonResources` gate (public catalog) and the
      // sequential-access gate (enrolled but hasn't reached this lesson yet).
      const lessonResources = parseLessonResources(l.resources);
      const pptxResource = l.type === "VIDEO" && !opts?.includeArticleContent
        ? lessonResources.find((resource) => resource.name.toLowerCase().endsWith(".pptx"))
        : undefined;
      const exposeResources =
        l.preview ||
        (opts?.includeLessonResources === true &&
          (!opts.accessibleLessonIds || opts.accessibleLessonIds.has(l.id)));
      return {
        id: l.id,
        title: l.title,
        durationSec: l.durationSec,
        type: l.type,
        preview: l.preview,
        order: l.order,
        hasQuiz: l.quiz !== null,
        hasVideo: l.cfVideoUid !== null,
        resources: exposeResources ? lessonResources : [],
        pptx: l.type === "VIDEO" && exposeResources && l.pptxStorageKey && l.pptxName
          ? ({ name: l.pptxName, url: "", sizeLabel: l.pptxSizeLabel ?? undefined, durationSec: 0, storageKey: l.pptxStorageKey } satisfies LessonPptxDto)
          : l.type === "VIDEO" && exposeResources && pptxResource
            ? ({ name: pptxResource.name, url: pptxResource.url, sizeLabel: pptxResource.sizeLabel, durationSec: 0, storageKey: pptxResource.storageKey } satisfies LessonPptxDto)
            : null,
        ...(opts?.includeArticleContent
          ? { articleContent: l.articleContent }
          : {}),
      };
    }),
  }));

  return {
    id: row.id,
    courseNumber: row.courseNumber,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    isoStandard: row.isoStandard,
    level: row.level,
    thumbnail: row.thumbnail,
    status: row.status,
    visibility: row.visibility,
    bestseller: row.bestseller,
    language: row.language,
    basePriceCents: row.basePriceCents,
    originalPriceCents: row.originalPriceCents,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    ratingWeightedCount: row.ratingWeightedCount,
    completedReviewCount: row.completedReviewCount,
    studentCount: row.studentCount,
    durationSec,
    lessonCount,
    instructor: mapInstructor(row.instructor, true),
    ...(opts?.canEnrollForOrganization === true
      ? { canEnrollForOrganization: true }
      : {}),
    description: row.description,
    whatYouLearn: row.whatYouLearn,
    requirements: row.requirements,
    updatedAt: row.updatedAt.toISOString(),
    sections,
  };
}
