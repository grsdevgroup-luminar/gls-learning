import { z } from "zod";
import type { EnrollmentStatus } from "../enums.js";
import type { CourseSummaryDto } from "./catalog.js";

export interface CertificateDto {
  serial: string;
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
  minutesWatched: number;
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
