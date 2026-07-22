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
import { PrismaService } from "../prisma/prisma.service";
import {
  COURSE_SUMMARY_INCLUDE,
  toCourseSummary,
} from "../courses/course.mapper";

const enrollmentInclude = {
  course: { include: COURSE_SUMMARY_INCLUDE },
  lessonProgress: { where: { completed: true }, select: { lessonId: true } },
  certificate: true,
} satisfies Prisma.EnrollmentInclude;

type EnrollmentRow = Prisma.EnrollmentGetPayload<{
  include: typeof enrollmentInclude;
}>;

function countLessons(course: EnrollmentRow["course"]): number {
  return course.sections.reduce((n, s) => n + s.lessons.length, 0);
}

function mapCertificate(
  cert: EnrollmentRow["certificate"],
): CertificateDto | null {
  if (!cert) return null;
  return {
    serial: cert.serial,
    pdfUrl: cert.pdfUrl,
    issuedAt: cert.issuedAt.toISOString(),
  };
}

@Injectable()
export class EnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

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
      certificate: mapCertificate(row.certificate),
    };
  }

  /** Minutes engaged per day over the last 7 days, derived from lessons the
   * student actually completed (lesson duration counted on its completion
   * day) — a real signal, not a placeholder. */
  async weeklyActivity(userId: string): Promise<WeeklyActivityDayDto[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 6);

    const rows = await this.prisma.lessonProgress.findMany({
      where: {
        completed: true,
        completedAt: { gte: since },
        enrollment: { userId },
      },
      select: { completedAt: true, lesson: { select: { durationSec: true } } },
    });

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
    const certs = await this.prisma.certificate.findMany({
      where: { enrollment: { userId } },
      include: { enrollment: { select: { courseId: true, course: { select: { title: true, slug: true } } } } },
      orderBy: { issuedAt: "desc" },
    });
    return certs.map((c) => ({
      serial: c.serial,
      pdfUrl: c.pdfUrl,
      issuedAt: c.issuedAt.toISOString(),
      courseId: c.enrollment.courseId,
      courseTitle: (c.enrollment.course as { title: string }).title,
      courseSlug: (c.enrollment.course as { slug: string }).slug,
    }));
  }

  async myEnrollments(userId: string): Promise<EnrollmentDto[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId },
      include: enrollmentInclude,
      orderBy: { lastActivityAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async getOne(userId: string, courseId: string): Promise<EnrollmentDto> {
    const row = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: enrollmentInclude,
    });
    if (!row) throw new NotFoundException("Not enrolled in this course");
    return this.toDto(row);
  }

  isEnrolled(userId: string, courseId: string): Promise<boolean> {
    return this.prisma.enrollment
      .count({ where: { userId, courseId } })
      .then((n) => n > 0);
  }

  /**
   * Free self-enroll. Allowed for: free PUBLIC courses, or org-PRIVATE courses
   * the user has a seat for (org-paid). Paid public courses must go through
   * checkout.
   */
  async enrollFree(userId: string, courseId: string): Promise<EnrollmentDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        basePriceCents: true,
        status: true,
        visibility: true,
        orgId: true,
      },
    });
    if (!course || course.status !== "PUBLISHED")
      throw new NotFoundException("Course not found");

    if (course.visibility === "PRIVATE") {
      // Org-private course: membership in the owning org grants seat-based access.
      const member = course.orgId
        ? await this.prisma.orgMember.findFirst({
            where: { orgId: course.orgId, userId },
          })
        : null;
      if (!member)
        throw new ForbiddenException("This course is restricted to its organization");
    } else if (course.basePriceCents > 0) {
      throw new ForbiddenException("This course requires purchase");
    }

    await this.enrollMany(this.prisma, userId, [courseId]);
    return this.getOne(userId, courseId);
  }

  /**
   * Idempotently enroll a user in courses. Called by the free-enroll path and
   * by the payments webhook after a verified purchase. Safe to call within a
   * transaction (pass `tx`).
   */
  async enrollMany(
    tx: Prisma.TransactionClient | PrismaService,
    userId: string,
    courseIds: string[],
  ): Promise<void> {
    for (const courseId of courseIds) {
      const existing = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true },
      });
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        update: {},
        create: { userId, courseId },
      });
      // Only increment counters for genuinely new enrollments.
      if (!existing) {
        const course = await tx.course.update({
          where: { id: courseId },
          data: { studentCount: { increment: 1 } },
          select: { instructorId: true },
        });
        await tx.instructorProfile.updateMany({
          where: { userId: course.instructorId },
          data: { studentCount: { increment: 1 } },
        });
      }
    }
  }

  async toggleLesson(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<ToggleLessonResultDto> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    if (!enrollment) throw new ForbiddenException("Not enrolled in this course");

    // Lesson must belong to this course.
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
    if (!lesson || lesson.section.courseId !== courseId)
      throw new BadRequestException("Lesson does not belong to this course");

    const existing = await this.prisma.lessonProgress.findUnique({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
      },
    });

    let completed: boolean;
    if (existing) {
      await this.prisma.lessonProgress.delete({ where: { id: existing.id } });
      completed = false;
    } else {
      await this.prisma.lessonProgress.create({
        data: { enrollmentId: enrollment.id, lessonId, completed: true },
      });
      completed = true;
    }

    return this.recompute(userId, courseId, enrollment.id, lessonId, completed);
  }

  /** Mark a lesson complete (used when a quiz is passed). Idempotent. */
  async markLessonComplete(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    if (!enrollment) return;
    await this.prisma.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
      },
      update: { completed: true },
      create: { enrollmentId: enrollment.id, lessonId, completed: true },
    });
    await this.recompute(userId, courseId, enrollment.id, lessonId, true);
  }

  private async recompute(
    _userId: string,
    courseId: string,
    enrollmentId: string,
    lessonId: string,
    completed: boolean,
  ): Promise<ToggleLessonResultDto> {
    const [lessonCount, completedCount] = await this.prisma.$transaction([
      this.prisma.lesson.count({ where: { section: { courseId } } }),
      this.prisma.lessonProgress.count({
        where: { enrollmentId, completed: true },
      }),
    ]);

    const done = isCourseComplete(completedCount, lessonCount);
    const data: Prisma.EnrollmentUpdateInput = {
      lastActivityAt: new Date(),
      status: done ? "COMPLETED" : "IN_PROGRESS",
      completedAt: done ? new Date() : null,
    };
    await this.prisma.enrollment.update({ where: { id: enrollmentId }, data });

    let certificate: CertificateDto | null = null;
    if (done) {
      const cert = await this.prisma.certificate.upsert({
        where: { enrollmentId },
        update: {},
        create: {
          enrollmentId,
          serial: `CERT-${randomUUID().slice(0, 8).toUpperCase()}`,
        },
      });
      certificate = mapCertificate(cert);
    } else {
      await this.prisma.certificate
        .delete({ where: { enrollmentId } })
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
