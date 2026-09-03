import { z } from "zod";
import type { EnrollmentStatus } from "../enums.js";
import type { CourseSummaryDto } from "./catalog.js";

export interface CertificateDto {
  serial: string;
  learnerName: string;
  courseNumber: string;
  pdfUrl: string | null;
  issuedAt: string;
}

export interface EnrollmentDto {
  id: string;
  courseId: string;
  course: CourseSummaryDto;
  status: EnrollmentStatus;
  completedLessonIds: string[];
  lessonCount: number;
  completedCount: number;
  progressPct: number;
  /** Sum of durationSec across completed lessons (any type) — "course time" credited. */
  timeLearnedSec: number;
  /** Actual video-playback seconds reported by the player. Accumulates on every
   *  watch, so replaying a segment counts again — not the same number as
   *  `timeLearnedSec` above. */
  watchTimeSec: number;
  enrolledAt: string;
  lastActivityAt: string;
  completedAt: string | null;
  certificate: CertificateDto | null;
}

export interface WeeklyActivityDayDto {
  /** ISO date (YYYY-MM-DD), local to the server. */
  date: string;
  minutes: number;
}

export type ActivityPeriod = "daily" | "weekly" | "monthly";

export interface ActivityDayDto {
  /** ISO date (YYYY-MM-DD), local to the server. */
  date: string;
  minutes: number;
}

export interface ToggleLessonResultDto {
  lessonId: string;
  completed: boolean;
  completedCount: number;
  lessonCount: number;
  progressPct: number;
  courseCompleted: boolean;
  certificate: CertificateDto | null;
}

/** Result of `GET /certificates/:serial` — the public verification lookup. */
export interface CertificateVerificationDto {
  valid: true;
  serial: string;
  learnerName: string;
  courseTitle: string;
  courseSlug: string;
  uniqueId: string;
  courseNumber: string;
  courseStartDate: string;
  courseEndDate: string;
  verificationUrl: string;
  isoStandard: string;
  issuedAt: string;
}

/** A learner's private note on one lesson (`/me/lessons/:lessonId/note`). */
export interface LessonNoteDto {
  lessonId: string;
  body: string;
  updatedAt: string;
}

export const saveLessonNoteSchema = z.object({
  /** Empty deletes the note. Capped so a note stays a note. */
  body: z.string().max(20_000),
});
export type SaveLessonNoteInput = z.infer<typeof saveLessonNoteSchema>;

/** A single player heartbeat's worth of actively-watched wall-clock time.
 *  Capped well above the client's flush interval so a slow network batching a
 *  couple of ticks together still gets through, but a forged huge value can't. */
export const recordWatchTimeSchema = z.object({
  watchedSec: z.number().int().positive().max(30),
});
export type RecordWatchTimeInput = z.infer<typeof recordWatchTimeSchema>;

export interface WatchTimeResultDto {
  watchTimeSec: number;
}
