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

export interface ToggleLessonResultDto {
  lessonId: string;
  completed: boolean;
  completedCount: number;
  lessonCount: number;
  progressPct: number;
  courseCompleted: boolean;
  certificate: CertificateDto | null;
}
