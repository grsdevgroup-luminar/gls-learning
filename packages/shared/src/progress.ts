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
