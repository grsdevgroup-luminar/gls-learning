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
  isLessonSequentiallyAccessible,
  isOrgAccessLocked,
  isCourseComplete,
  type CertificateDto,
  type EnrollmentDto,
  type EnrollmentStatus,
  type ToggleLessonResultDto,
  type ActivityDayDto,
  type ActivityPeriod,
  type WatchTimeResultDto,
  parseLessonResources,
} from "@skillstream/shared";
import { ConfigService } from "@nestjs/config";
import { AdminAlertsService } from "../email/admin-alerts.service";
import {
  NotificationsService,
  type NotifyInput,
} from "../notifications/notifications.service";
import type { Db } from "../../common/types";
import { apiBaseUrl, certificatePdfUrl } from "../../common/utils/urls";
import type { Env } from "../../config/env";
import { PrismaService } from "../../prisma/prisma.service";
import { toCourseSummary } from "../courses/course.mapper";
import {
  EnrollmentRepository,
  type EnrollmentRow,
} from "./enrollment.repository";

const MAX_CERTIFICATE_SERIAL_RETRIES = 3;

function countLessons(course: EnrollmentRow["course"]): number {
  return course.sections.reduce((n, s) => n + s.lessons.length, 0);
}

/** 48 bits of randomness — the serial is the only public credential. */
function generateCertificateSerial(): string {
  return `CERT-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
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
    learnerName: cert.learnerName,
    courseNumber: cert.courseNumber,
    pdfUrl: cert.pdfUrl ?? certificatePdfUrl(apiBase, cert.serial),
    issuedAt: cert.issuedAt.toISOString(),
  };
}

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly repo: EnrollmentRepository,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly alerts: AdminAlertsService,
    private readonly notifications: NotificationsService,
  ) { }

  private get apiBase(): string {
    return apiBaseUrl(this.config);
  }

  private toDto(row: EnrollmentRow): EnrollmentDto {
    const lessonCount = countLessons(row.course);
    const completedLessonIds = row.lessonProgress
      .filter((p) => p.completed)
      .map((p) => p.lessonId);
    const completedCount = completedLessonIds.length;
    // Lifetime credit: any lesson that has ever been completed, including
    // ones later unchecked. Progress % still uses currently-complete only.
    const timeLearnedSec = row.lessonProgress.reduce(
      // completedAt is retained when a lesson is unchecked, so lifetime
      // learning credit must use the retained progress row rather than the
      // current completion toggle.
      (sum, p) => sum + (p.completedAt ? p.lesson.durationSec : 0) + (p.pptxCompleted ? p.lesson.pptxDurationSec : 0),
      0,
    );
    return {
      id: row.id,
      courseId: row.courseId,
      course: toCourseSummary(row.course),
      status: row.status,
      completedLessonIds,
      lessonCount,
      completedCount,
      progressPct: completionPct(completedCount, lessonCount),
      timeLearnedSec,
      watchTimeSec: row.watchTimeSec,
      enrolledAt: row.enrolledAt.toISOString(),
      lastActivityAt: row.lastActivityAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      certificate: mapCertificate(row.certificate, this.apiBase),
    };
  }

  /** Minutes engaged per day over the last 7 days, derived from lessons the
   * student actually completed (lesson duration counted on its completion
   * day) — a real signal, not a placeholder. */
  async activity(userId: string, period: ActivityPeriod = "weekly"): Promise<ActivityDayDto[]> {
    const daysInPeriod = period === "daily" ? 1 : period === "monthly" ? 30 : 7;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (daysInPeriod - 1));

    const rows = await this.repo.findLessonProgressSince(userId, since);

    const minutesByDate = new Map<string, number>();
    for (const r of rows) {
      const key = r.completedAt.toISOString().slice(0, 10);
      minutesByDate.set(
        key,
        (minutesByDate.get(key) ?? 0) + Math.round(((r.completed ? r.lesson.durationSec : 0) + (r.pptxCompleted ? r.lesson.pptxDurationSec : 0)) / 60),
      );
    }

    const days: ActivityDayDto[] = [];
    for (let i = 0; i < daysInPeriod; i++) {
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
      learnerName: c.learnerName,
      courseNumber: c.courseNumber,
      pdfUrl: c.pdfUrl ?? certificatePdfUrl(this.apiBase, c.serial),
      issuedAt: c.issuedAt.toISOString(),
      courseId: c.enrollment.courseId,
      courseTitle: (c.enrollment.course as { title: string }).title,
      isoStandard: c.enrollment.course.isoStandard,
      courseSlug: (c.enrollment.course as { slug: string }).slug,
      courseStartDate: c.enrollment.enrolledAt.toISOString(),
      courseEndDate: (c.enrollment.completedAt ?? c.issuedAt).toISOString(),
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
  
  async canReview(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.repo.findActiveByUserAndCourse(
      userId,
      courseId,
    );

    return Boolean(enrollment);
  }

  /** Server-authoritative review context; the client cannot choose its rating stage. */
  async reviewContext(userId: string, courseId: string): Promise<{ progressPercent: number; status: EnrollmentStatus } | null> {
    const enrollment = await this.repo.findByUserAndCourse(userId, courseId);
    if (!enrollment || !['IN_PROGRESS', 'COMPLETED'].includes(enrollment.status)) return null;
    const lessonCount = countLessons(enrollment.course);
    const completedCount = enrollment.lessonProgress.filter((p) => p.completed).length;
    return {
      progressPercent: completionPct(completedCount, lessonCount),
      status: enrollment.status,
    };
  }

  /** Thin wrapper so other modules (e.g. CoursesService) can check org
   *  membership without taking a dependency on the organizations module. */
  async isOrgMember(orgId: string, userId: string): Promise<boolean> {
    return !!(await this.repo.findOrgMembership(orgId, userId));
  }

  /** A course can now be assigned to several orgs — this is "is the user a
   *  member of at least one of them," in a single query rather than looping
   *  `isOrgMember` per org. */
  async isOrgMemberOfAny(orgIds: string[], userId: string): Promise<boolean> {
    if (orgIds.length === 0) return false;
    return !!(await this.repo.findAnyOrgMembership(orgIds, userId));
  }

  /** Thin wrapper so CoursesService can check delivery-partner course access
   *  without taking a dependency on the delivery-partner module — mirrors
   *  isOrgMemberOfAny, one level deeper (per course-assignment). */
  async isPartnerMemberOfCourse(courseId: string, userId: string): Promise<boolean> {
    return !!(await this.repo.findAnyPartnerMembershipForCourse(courseId, userId));
  }

  /** Completed ids for an enrolled learner, used to build the gated learner
   * course view without exposing attachment URLs for locked lessons. */
  async completedLessonIds(userId: string, courseId: string): Promise<string[]> {
    const enrollment = await this.repo.findIdByUserAndCourse(userId, courseId);
    if (!enrollment) throw new ForbiddenException("Not enrolled in this course");
    const rows = await this.repo.findCompletedLessonIds(enrollment.id);
    return rows.map((row) => row.lessonId);
  }

  /** Throws unless the learner is enrolled and all preceding lessons are done. */
  async assertLessonAccessible(userId: string, lessonId: string): Promise<void> {
    const lesson = await this.repo.findLessonAccessContext(lessonId, userId);
    if (!lesson) throw new NotFoundException("Lesson not found");

    const enrollment = await this.repo.findIdByUserAndCourse(
      userId,
      lesson.section.courseId,
    );
    if (!enrollment) throw new ForbiddenException("Not enrolled in this course");

    const course = lesson.section.course;
    // Gated the same way as enrollFree: an org/partner course-assignment
    // isn't limited to PRIVATE courses, so this must also run for a
    // PUBLIC+paid course (access was only free because of that grant). A
    // free PUBLIC course is skipped even if some org/partner assignment
    // happens to also exist on it — that assignment isn't why access is
    // free, so its suspension status can't revoke it.
    const needsGrant = course.visibility === "PRIVATE" || course.basePriceCents > 0;
    if (needsGrant) {
      // Every org this course is assigned to that the user is also a member
      // of. Empty means the user's access predates the course/org
      // relationship changing (e.g. unassigned since they enrolled) — no
      // suspension to check, same as the old single-org "org is null" case.
      // Otherwise, access continues as long as *any* one of those orgs isn't
      // currently locked (grace period respected).
      const memberOrgs = course.orgAssignments
        .map((a) => a.org)
        .filter((org) => org.members.length > 0);
      // Same idea for delivery-partner access, one level deeper (per
      // course-assignment, not per-partner) — no grace period, a partner is
      // simply APPROVED or not.
      const memberPartnerAssignments = course.deliveryPartnerAssignments.filter(
        (a) => a.members.length > 0,
      );
      const orgLocked = memberOrgs.length > 0 && memberOrgs.every((org) => isOrgAccessLocked(org));
      const partnerLocked =
        memberPartnerAssignments.length > 0 &&
        memberPartnerAssignments.every((a) => a.partner.status !== "APPROVED");
      // Only block if *every* path this user has to this course is locked —
      // someone with both an active org seat and a suspended partner grant
      // (or vice versa) should still get in through whichever path works.
      const hasAnyPath = memberOrgs.length > 0 || memberPartnerAssignments.length > 0;
      const allPathsLocked =
        (memberOrgs.length === 0 || orgLocked) &&
        (memberPartnerAssignments.length === 0 || partnerLocked);
      if (hasAnyPath && allPathsLocked) {
        throw new ForbiddenException("Access to this course is currently suspended");
      }
    }

    const completed = await this.repo.findCompletedLessonIds(enrollment.id);
    const orderedLessonIds = lesson.section.course.sections.flatMap((section) =>
      section.lessons.map((courseLesson) => courseLesson.id),
    );

    if (
      !isLessonSequentiallyAccessible(
        orderedLessonIds,
        completed.map((row) => row.lessonId),
        lessonId,
      )
    ) {
      throw new ForbiddenException("Complete the previous lesson first");
    }
  }

  /**
   * Free self-enroll. Allowed for: free PUBLIC courses, org courses the user
   * has a seat for (org-paid), or delivery-partner courses the user was
   * invited to (see DELIVERY_PARTNER_MEMBER_FLOW_PLAN.md §6.3) — an org/partner
   * course-assignment isn't limited to PRIVATE courses (an admin can assign
   * any published course, §4.1), so a grant must bypass the purchase
   * requirement on a PUBLIC+paid course too, not just gate a PRIVATE one.
   * A free PUBLIC course stays open to everyone regardless of any org/partner
   * assignment that happens to also exist on it — that assignment isn't the
   * reason access is free, so its suspension status is irrelevant here. Paid
   * public courses with no grant must go through checkout.
   */
  async enrollFree(userId: string, courseId: string): Promise<EnrollmentDto> {
    const course = await this.repo.findCourseAccess(courseId, userId);
    if (!course || course.status !== "PUBLISHED")
      throw new NotFoundException("Course not found");

    const needsGrant = course.visibility === "PRIVATE" || course.basePriceCents > 0;
    if (needsGrant) {
      // Org-assigned course: membership in any org it's assigned to grants
      // seat-based access — a course can now be shared across several orgs.
      const memberOrgs = course.orgAssignments
        .map((a) => a.org)
        .filter((org) => org.members.length > 0);
      // Delivery-partner-assigned course: same idea, one level deeper — access
      // is per course-assignment (not per-partner), so only the assignments
      // this user was actually invited to count.
      const memberPartnerAssignments = course.deliveryPartnerAssignments.filter(
        (a) => a.members.length > 0,
      );

      if (memberOrgs.length === 0 && memberPartnerAssignments.length === 0) {
        throw new ForbiddenException(
          course.visibility === "PRIVATE"
            ? "This course is restricted to its organization"
            : "This course requires purchase",
        );
      }
      // New enrollments are blocked immediately once *every* path this user
      // could enroll through is suspended (mode-agnostic for orgs — a grace
      // period only preserves access already granted, never a fresh
      // enrollment). At least one active org or approved partner is enough.
      const orgsAllSuspended =
        memberOrgs.length > 0 && memberOrgs.every((org) => org.status === "SUSPENDED");
      const partnersAllSuspended =
        memberPartnerAssignments.length > 0 &&
        memberPartnerAssignments.every((a) => a.partner.status !== "APPROVED");
      const hasActiveOrgPath = memberOrgs.length > 0 && !orgsAllSuspended;
      const hasActivePartnerPath = memberPartnerAssignments.length > 0 && !partnersAllSuspended;
      if (!hasActiveOrgPath && !hasActivePartnerPath) {
        throw new ForbiddenException("Access to this course is currently suspended");
      }
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
    tx: Db | undefined,
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

    await this.assertLessonAccessible(userId, lessonId);

    const existing = await this.repo.findLessonProgress(enrollment.id, lessonId);

    if (existing?.completed) {
      await this.repo.uncompleteLessonProgress(existing.id);
      return this.recompute(userId, courseId, enrollment.id, lessonId, false);
    }

    await this.repo.upsertLessonProgress(enrollment.id, lessonId);
    return this.recompute(userId, courseId, enrollment.id, lessonId, true);
  }

  /**
   * Records a player heartbeat's worth of actively-watched video time.
   * Additive and never deduplicated by position — rewatching a segment
   * reports again, by design (this is "watch time", not "coverage").
   */
  async getPptxCompletion(userId: string, courseId: string, lessonId: string) {
    const enrollment = await this.repo.findIdByUserAndCourse(userId, courseId);
    if (!enrollment) throw new ForbiddenException("Not enrolled in this course");
    const lesson = await this.repo.findLessonPptxContext(lessonId);
    if (!lesson || lesson.type !== "VIDEO" || lesson.section.courseId !== courseId || (!lesson.pptxStorageKey && !parseLessonResources(lesson.resources).some((resource) => resource.name.toLowerCase().endsWith(".pptx")))) throw new NotFoundException("PowerPoint not found");
    await this.assertLessonAccessible(userId, lessonId);
    const progress = await this.repo.findLessonProgress(enrollment.id, lessonId);
    return { completed: progress?.pptxCompleted ?? false };
  }

  async setPptxCompletion(userId: string, courseId: string, lessonId: string, completed: boolean) {
    const enrollment = await this.repo.findIdByUserAndCourse(userId, courseId);
    if (!enrollment) throw new ForbiddenException("Not enrolled in this course");
    const lesson = await this.repo.findLessonPptxContext(lessonId);
    if (!lesson || lesson.type !== "VIDEO" || lesson.section.courseId !== courseId || (!lesson.pptxStorageKey && !parseLessonResources(lesson.resources).some((resource) => resource.name.toLowerCase().endsWith(".pptx")))) throw new NotFoundException("PowerPoint not found");
    await this.assertLessonAccessible(userId, lessonId);
    const progress = await this.repo.setPptxCompleted(enrollment.id, lessonId, completed);
    return { completed: progress.pptxCompleted };
  }

  async recordWatchTime(
    userId: string,
    courseId: string,
    lessonId: string,
    watchedSec: number,
  ): Promise<WatchTimeResultDto> {
    const enrollment = await this.repo.findIdByUserAndCourse(userId, courseId);
    if (!enrollment) throw new ForbiddenException("Not enrolled in this course");

    const lesson = await this.repo.findLessonForWatchTime(lessonId);
    if (!lesson || lesson.section.courseId !== courseId)
      throw new BadRequestException("Lesson does not belong to this course");
    if (lesson.type !== "VIDEO")
      throw new BadRequestException("Only video lessons accrue watch time");

    const { watchTimeSec } = await this.repo.incrementWatchTime(enrollment.id, watchedSec);
    return { watchTimeSec };
  }

  /** Mark a lesson complete (used when a quiz is passed). Idempotent. */
  async markLessonComplete(
    userId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    const enrollment = await this.repo.findIdByUserAndCourse(userId, courseId);
    if (!enrollment) return;
    await this.assertLessonAccessible(userId, lessonId);
    await this.repo.upsertLessonProgress(enrollment.id, lessonId);
    await this.recompute(userId, courseId, enrollment.id, lessonId, true);
  }

  private async recompute(
    userId: string,
    courseId: string,
    enrollmentId: string,
    lessonId: string,
    completed: boolean,
  ): Promise<ToggleLessonResultDto> {
    const [lessonCount, completedCount] =
      await this.repo.countLessonsAndCompleted(courseId, enrollmentId);
    const done = isCourseComplete(completedCount, lessonCount);
    await this.updateStatus(enrollmentId, done);
    const certificate = await this.manageCertificate(userId, enrollmentId, courseId, done);
    return this.buildResult(lessonId, completed, lessonCount, completedCount, done, certificate);
  }

  private async updateStatus(enrollmentId: string, done: boolean): Promise<void> {
    const data: Prisma.EnrollmentUpdateInput = {
      lastActivityAt: new Date(),
      status: done ? "COMPLETED" : "IN_PROGRESS",
      completedAt: done ? new Date() : null,
    };
    await this.repo.updateEnrollment(enrollmentId, data);
  }

  /**
   * Certificates are issued once per enrollment and never revoked by progress
   * changes. `serial`, `issuedAt`, and `learnerName` are immutable after creation.
   */
  private async manageCertificate(
    userId: string,
    enrollmentId: string,
    courseId: string,
    done: boolean,
  ): Promise<CertificateDto | null> {
    const existing = await this.repo.findCertificateByEnrollment(enrollmentId);
    if (existing) return mapCertificate(existing, this.apiBase);

    if (!done) return null;

    const user = await this.repo.findUserName(userId);
    const course = await this.repo.findCourseNumber(courseId);
    if (!user || !course) return null;

    const notifyInput: NotifyInput = {
      userId,
      event: "CERTIFICATE_ISSUED",
      title: "Certificate issued",
      body: "You completed a course — your certificate is ready.",
      href: "/dashboard/certificates",
    };

    let serial = generateCertificateSerial();

    for (let attempt = 0; attempt < MAX_CERTIFICATE_SERIAL_RETRIES; attempt++) {
      try {
        const cert = await this.prisma.$transaction(async (tx) => {
          const created = await this.repo.createCertificate(
            enrollmentId,
            serial,
            user.name,
            course.courseNumber,
            tx,
          );
          await this.notifications.notify(notifyInput, tx);
          return created;
        });
        void this.notifications
          .notifyEmailAfterCommit(notifyInput)
          .catch(() => undefined);
        return mapCertificate(cert, this.apiBase);
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        const raced = await this.repo.findCertificateByEnrollment(enrollmentId);
        if (raced) return mapCertificate(raced, this.apiBase);
        serial = generateCertificateSerial();
      }
    }

    throw new Error("Could not allocate certificate serial");
  }

  private buildResult(
    lessonId: string,
    completed: boolean,
    lessonCount: number,
    completedCount: number,
    done: boolean,
    certificate: CertificateDto | null,
  ): ToggleLessonResultDto {
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
