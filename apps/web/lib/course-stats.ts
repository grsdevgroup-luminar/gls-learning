// Curriculum totals derived from a Course. Catalog summaries carry no
// `sections` but do carry `lessonCount`/`durationSec`, so those win when
// present and the section walk is the fallback for a fully-loaded detail.
import type { Course } from "@/types";

export function courseDurationMin(course: Course) {
  const sec =
    course.durationSec ??
    course.sections.reduce(
      (sum, s) => sum + s.lessons.reduce((a, l) => a + l.durationSec, 0),
      0,
    );
  return Math.round(sec / 60);
}

export function courseLessonCount(course: Course) {
  return (
    course.lessonCount ?? course.sections.reduce((a, s) => a + s.lessons.length, 0)
  );
}

export function courseArticleCount(course: Course) {
  return course.sections.reduce(
    (a, s) => a + s.lessons.filter((l) => l.type === "article").length,
    0,
  );
}

export function courseResourceCount(course: Course) {
  return course.sections.reduce(
    (a, s) => a + s.lessons.reduce((b, l) => b + (l.resources?.length ?? 0), 0),
    0,
  );
}
