// Curriculum totals derived from a course DTO. The API reports durationSec/
// lessonCount directly on every course (summary or detail), so these never
// need to fall back to walking `sections` — only summaries used to omit them
// in the old mock data, which is gone now.
import type { CourseDetailDto, CourseSummaryDto } from "@skillstream/shared";

export function courseDurationMin(course: CourseSummaryDto) {
  return Math.round(course.durationSec / 60);
}

export function courseLessonCount(course: CourseSummaryDto) {
  return course.lessonCount;
}

export function courseArticleCount(course: CourseDetailDto) {
  return course.sections.reduce(
    (a, s) => a + s.lessons.filter((l) => l.type === "ARTICLE").length,
    0,
  );
}

export function courseResourceCount(course: CourseDetailDto) {
  return course.sections.reduce(
    (a, s) => a + s.lessons.reduce((b, l) => b + l.resources.length, 0),
    0,
  );
}
