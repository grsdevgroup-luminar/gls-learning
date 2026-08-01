import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  completionPct,
  isCourseComplete,
  type CertificateDto,
  type EnrollmentDto,
  type ToggleLessonResultDto,
  type WeeklyActivityDayDto,
} from "@skillstream/shared";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAlertsService } from "../email/admin-alerts.service";
import { apiBaseUrl, certificatePdfUrl } from "../common/urls";
import type { Env } from "../config/env";
import { toCourseSummary } from "../courses/course.mapper";
import {
  EnrollmentRepository,
  type EnrollmentRow,
} from "./enrollment.repository";

function countLessons(course: EnrollmentRow["course"]): number {
  return course.sections.reduce((n, s) => n + s.lessons.length, 0);
}

/** `pdfUrl` falls back to the API's on-the-fly renderer, so every certificate
 *  is downloadable even though no file is stored. */
function mapCertificate(
  cert: EnrollmentRow["certificate"],
  apiBase: string,
): CertificateDto | null {
  if (!cert) return null;
  return {
    serial: cert.serial,
    pdfUrl: cert.pdfUrl ?? certificatePdfUrl(apiBase, cert.serial),
    issuedAt: cert.issuedAt.toISOString(),
  };
}

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly repo: EnrollmentRepository,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AdminAlertsService,
  ) {}

  private get apiBase(): string {
    return apiBaseUrl(this.config);
  }

  private toDto(row: EnrollmentRow): EnrollmentDto {
    const lessonCount = countLessons(row.course);
    const completedLessonIds = row.lessonProgress.map((p) => p.lessonId);
    const completedCount = completedLessonIds.length;
    return {
      id: row.id,
      courseId: row.courseId,
      course: toCourseSummary(row.course),
      status: row.status,
      completedLessonIds,
      lessonCount,
      completedCount,
      progressPct: completionPct(completedCount, lessonCount),
      minutesWatched: row.minutesWatched,
      enrolledAt: row.enrolledAt.toISOString(),
      lastActivityAt: row.lastActivityAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      certificate: mapCertificate(row.certificate, this.apiBase),
    };
  }

  /** Minutes engaged per day over the last 7 days, derived from lessons the
   * student actually completed (lesson duration counted on its completion
   * day) — a real signal, not a placeholder. */
  async weeklyActivity(userId: string): Promise<WeeklyActivityDayDto[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);

    const rows = await this.repo.findWeeklyLessonProgress(userId, since);

    const minutesByDate = new Map<string, number>();
    for (const r of rows) {
      const key = r.completedAt.toISOString().slice(0, 10);
      minutesByDate.set(
        key,
        (minutesByDate.get(key) ?? 0) + Math.round(r.lesson.durationSec / 60),
      );
    }

    const days: WeeklyActivityDayDto[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, minutes: minutesByDate.get(key) ?? 0 });
    }
    return days;
  }

  async myCertificates(userId: string): Promise<CertificateDto[]> {
    const certs = await this.repo.findCertificatesByUser(userId);
    return certs.map((c) => ({
      serial: c.serial,
      pdfUrl: c.pdfUrl ?? certificatePdfUrl(this.apiBase, c.serial),
      issuedAt: c.issuedAt.toISOString(),
      courseId: c.enrollment.courseId,
      courseTitle: (c.enrollment.course as { title: string }).title,
      courseSlug: (c.enrollment.course as { slug: string }).slug,
    }));
  }

  async myEnrollments(userId: string): Promise<EnrollmentDto[]> {
    const rows = await this.repo.findManyByUser(userId);
    return rows.map((r) => this.toDto(r));
  }

  async getOne(userId: string, courseId: string): Promise<EnrollmentDto> {
    const row = await this.repo.findByUserAndCourse(userId, courseId);
    if (!row) throw new NotFoundException("Not enrolled in this course");
    return this.toDto(row);
  }

  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const n = await this.repo.countByUserAndCourse(userId, courseId);
    return n > 0;
  }

  /**
   * Free self-enroll. Allowed for: free PUBLIC courses, or org-PRIVATE courses
   * the user has a seat for (org-paid). Paid public courses must go through
   * checkout.
   */
  async enrollFree(userId: string, courseId: string): Promise<EnrollmentDto> {
    const course = await this.repo.findCourseAccess(courseId);
    if (!course || course.status !== "PUBLISHED")
      throw new NotFoundException("Course not found");

    if (course.visibility === "PRIVATE") {
      // Org-private course: membership in the owning org grants seat-based access.
      const member = course.orgId
        ? await this.repo.findOrgMembership(course.orgId, userId)
        : null;
      if (!member)
        throw new ForbiddenException("This course is restricted to its organization");
    } else if (course.basePriceCents > 0) {
      throw new ForbiddenException("This course requires purchase");
    }

    await this.enrollMany(undefined, userId, [courseId]);
    return this.getOne(userId, courseId);
  }

  /**
   * Idempotently enroll a user in courses. Called by the free-enroll path and
   * by the payments webhook after a verified purchase. Safe to call within a
   * transaction (pass `tx`).
   */
  async enrollMany(
    tx: Prisma.TransactionClient | PrismaService | undefined,
    userId: string,
    courseIds: string[],
  ): Promise<void> {
    for (const courseId of courseIds) {
      const existing = await this.repo.findIdByUserAndCourse(
        userId,
        courseId,
        tx,
      );
      await this.repo.upsertEnrollment(userId, courseId, tx);
      // Only increment counters for genuinely new enrollments.
      if (!existing) {
        const course = await this.repo.incrementCourseStudentCount(courseId, tx);
        await this.repo.incrementInstructorStudentCount(course.instructorId, tx);
        // Fire-and-forget: an alert must never roll back the enrollment. Read
        // the learner name outside `tx` — the caller's transaction may still be
        // open, and this is not part of it.
        void this.repo
          .findUserName(userId)
          .then((u) => this.alerts.newEnrollment(u?.name ?? "A learner", course.title))
          .catch(() => undefined);
      }
    }
  }

  async toggleLesson(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<ToggleLessonResultDto> {
    const enrollment = await this.repo.findIdByUserAndCourse(userId, courseId);
    if (!enrollment) throw new ForbiddenException("Not enrolled in this course");

    // Lesson must belong to this course.
    const lesson = await this.repo.findLessonCourseId(lessonId);
    if (!lesson || lesson.section.courseId !== courseId)
      throw new BadRequestException("Lesson does not belong to this course");

    const existing = await this.repo.findLessonProgress(enrollment.id, lessonId);

    let completed: boolean;
    if (existing) {
      await this.repo.deleteLessonProgressById(existing.id);
      completed = false;
    } else {
      await this.repo.createLessonProgress(enrollment.id, lessonId);
      completed = true;
    }

    return this.recompute(courseId, enrollment.id, lessonId, completed);
  }

  /** Mark a lesson complete (used when a quiz is passed). Idempotent. */
  async markLessonComplete(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    const enrollment = await this.repo.findIdByUserAndCourse(userId, courseId);
    if (!enrollment) return;
    await this.repo.upsertLessonProgress(enrollment.id, lessonId);
    await this.recompute(courseId, enrollment.id, lessonId, true);
  }

  private async recompute(
    courseId: string,
    enrollmentId: string,
    lessonId: string,
    completed: boolean,
  ): Promise<ToggleLessonResultDto> {
    const [lessonCount, completedCount] =
      await this.repo.countLessonsAndCompleted(courseId, enrollmentId);

    const done = isCourseComplete(completedCount, lessonCount);
    const data: Prisma.EnrollmentUpdateInput = {
      lastActivityAt: new Date(),
      status: done ? "COMPLETED" : "IN_PROGRESS",
      completedAt: done ? new Date() : null,
    };
    await this.repo.updateEnrollment(enrollmentId, data);

    let certificate: CertificateDto | null = null;
    if (done) {
      const cert = await this.repo.upsertCertificate(
        enrollmentId,
        // 48 bits of randomness: the serial is the only credential the public
        // verification endpoint takes, so it must not be guessable (and must
        // not collide — `serial` is unique).
        `CERT-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
      );
      certificate = mapCertificate(cert, this.apiBase);
    } else {
      await this.repo
        .deleteCertificateByEnrollment(enrollmentId)
        .catch(() => undefined);
    }

    return {
      lessonId,
      completed,
      completedCount,
      lessonCount,
      progressPct: completionPct(completedCount, lessonCount),
      courseCompleted: done,
      certificate,
    };
  }
}
