// ---------------------------------------------------------------------------
// Progress math shared by the API (authoritative completion %, certificate
// issuance) and the frontend (progress rings/meters).
// ---------------------------------------------------------------------------

export function completionPct(
  completedLessons: number,
  totalLessons: number,
): number {
  if (totalLessons <= 0) return 0;
  return Math.round((completedLessons / totalLessons) * 100);
}

export function isCourseComplete(
  completedLessons: number,
  totalLessons: number,
): boolean {
  return totalLessons > 0 && completedLessons >= totalLessons;
}

/** Quiz attempt passes when the score meets or beats the pass threshold. */
export function quizPassed(scorePercent: number, passScore: number): boolean {
  return scorePercent >= passScore;
}

/**
 * A lesson is available only when every lesson before it in the course has
 * been completed. The lesson itself may be incomplete: that is the next
 * lesson the learner is allowed to work on.
 */
export function isLessonSequentiallyAccessible(
  orderedLessonIds: readonly string[],
  completedLessonIds: Iterable<string>,
  lessonId: string,
): boolean {
  const index = orderedLessonIds.indexOf(lessonId);
  if (index < 0) return false;

  const completed = new Set(completedLessonIds);
  return orderedLessonIds
    .slice(0, index)
    .every((previousId) => completed.has(previousId));
}
