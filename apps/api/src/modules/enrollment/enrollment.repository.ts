import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { COURSE_SUMMARY_INCLUDE } from "../courses/course.mapper";
import type { Db } from "../../common/types";

export const ENROLLMENT_INCLUDE = {
  course: { include: COURSE_SUMMARY_INCLUDE },
  // Keep previously-completed rows (`completed: false`) so time learned can
  // credit a lesson that was later unchecked. `completedLessonIds` still
  // filters to `completed: true` in `toDto`.
  lessonProgress: {
    select: {
      lessonId: true,
      completed: true,
      lesson: { select: { durationSec: true } },
    },
  },
  certificate: true,
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentRow = Prisma.EnrollmentGetPayload<{
  include: typeof ENROLLMENT_INCLUDE;
}>;

@Injectable()
export class EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findManyByUser(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: ENROLLMENT_INCLUDE,
      orderBy: { lastActivityAt: "desc" },
    });
  }

  findByUserAndCourse(userId: string, courseId: string) {
    return this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: ENROLLMENT_INCLUDE,
    });
  }

  findIdByUserAndCourse(userId: string, courseId: string, tx?: Db) {
    return this.db(tx).enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
  }

  countByUserAndCourse(userId: string, courseId: string) {
    return this.prisma.enrollment.count({ where: { userId, courseId } });
  }
  findActiveByUserAndCourse(userId: string, courseId: string) {
  return this.prisma.enrollment.findFirst({
    where: {
      userId,
      courseId,
      status: {
        in: ["IN_PROGRESS", "COMPLETED"],
      },
    },
    select: { id: true },
  });
}

  /** `userId` scopes `orgAssignments.org.members` to just this caller, so
   *  the service can tell — in one query — which (if any) of the course's
   *  assigned orgs this user actually belongs to, and each one's status. A
   *  course can now be assigned to several orgs; a PRIVATE course grants
   *  access through any one of them. */
  findCourseAccess(courseId: string, userId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        basePriceCents: true,
        status: true,
        visibility: true,
        orgAssignments: {
          select: {
            org: {
              select: {
                id: true,
                status: true,
                members: { where: { userId }, select: { id: true } },
              },
            },
          },
        },
      },
    });
  }

  findOrgMembership(orgId: string, userId: string) {
    return this.prisma.orgMember.findFirst({
      where: { orgId, userId },
    });
  }

  findAnyOrgMembership(orgIds: string[], userId: string) {
    return this.prisma.orgMember.findFirst({
      where: { userId, orgId: { in: orgIds } },
    });
  }

  upsertEnrollment(userId: string, courseId: string, tx?: Db) {
    return this.db(tx).enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId },
    });
  }

  incrementCourseStudentCount(courseId: string, tx?: Db) {
    return this.db(tx).course.update({
      where: { id: courseId },
      data: { studentCount: { increment: 1 } },
      select: { instructorId: true, title: true },
    });
  }

  incrementInstructorStudentCount(instructorUserId: string, tx?: Db) {
    return this.db(tx).instructorProfile.updateMany({
      where: { userId: instructorUserId },
      data: { studentCount: { increment: 1 } },
    });
  }

  findUserName(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
  }

  findLessonCourseId(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { section: { select: { courseId: true } } },
    });
  }

  /** Type + owning course, for validating a watch-time report before it's trusted. */
  findLessonForWatchTime(lessonId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { type: true, section: { select: { courseId: true } } },
    });
  }

  incrementWatchTime(enrollmentId: string, deltaSec: number) {
    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        watchTimeSec: { increment: deltaSec },
        lastActivityAt: new Date(),
      },
      select: { watchTimeSec: true },
    });
  }

  /** Course order is authoritative for sequential lesson access. Also carries
   *  the org-suspension fields (scoped to this user's memberships among the
   *  course's assigned orgs — see `findCourseAccess`) so `assertLessonAccessible`
   *  can gate org-PRIVATE playback across multiple assigned orgs without a
   *  second query. */
  findLessonAccessContext(lessonId: string, userId: string) {
    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        section: {
          select: {
            courseId: true,
            course: {
              select: {
                visibility: true,
                orgAssignments: {
                  select: {
                    org: {
                      select: {
                        id: true,
                        status: true,
                        accessLocksAt: true,
                        members: { where: { userId }, select: { id: true } },
                      },
                    },
                  },
                },
                sections: {
                  orderBy: { order: "asc" },
                  select: {
                    lessons: {
                      orderBy: { order: "asc" },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  findCompletedLessonIds(enrollmentId: string) {
    return this.prisma.lessonProgress.findMany({
      where: { enrollmentId, completed: true },
      select: { lessonId: true },
    });
  }

  findLessonProgress(enrollmentId: string, lessonId: string) {
    return this.prisma.lessonProgress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    });
  }

  /** Leaves the row in place so time learned stays credited. */
  uncompleteLessonProgress(id: string) {
    return this.prisma.lessonProgress.update({
      where: { id },
      data: { completed: false },
    });
  }

  upsertLessonProgress(enrollmentId: string, lessonId: string) {
    return this.prisma.lessonProgress.upsert({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
      update: { completed: true },
      create: { enrollmentId, lessonId, completed: true },
    });
  }

  countLessonsAndCompleted(courseId: string, enrollmentId: string) {
    return this.prisma.$transaction([
      this.prisma.lesson.count({ where: { section: { courseId } } }),
      this.prisma.lessonProgress.count({
        where: { enrollmentId, completed: true },
      }),
    ]);
  }

  updateEnrollment(enrollmentId: string, data: Prisma.EnrollmentUpdateInput) {
    return this.prisma.enrollment.update({ where: { id: enrollmentId }, data });
  }

  findCourseNumber(courseId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: { courseNumber: true },
    });
  }

  findCertificateByEnrollment(enrollmentId: string) {
    return this.prisma.certificate.findUnique({
      where: { enrollmentId },
    });
  }

  upsertCertificate(
    enrollmentId: string,
    serial: string,
    learnerName: string,
    courseNumber: string,
  ) {
    return this.prisma.certificate.upsert({
      where: { enrollmentId },
      update: { courseNumber },
      create: { enrollmentId, serial, learnerName, courseNumber },
    });
  }

  deleteCertificateByEnrollment(enrollmentId: string) {
    return this.prisma.certificate.delete({ where: { enrollmentId } });
  }

  createCertificate(
    enrollmentId: string,
    serial: string,
    learnerName: string,
    courseNumber: string,
    tx?: Db,
  ) {
    return this.db(tx).certificate.create({
      data: { enrollmentId, serial, learnerName, courseNumber },
    });
  }

  findLessonProgressSince(userId: string, since: Date) {
    return this.prisma.lessonProgress.findMany({
      where: {
        completed: true,
        completedAt: { gte: since },
        enrollment: { userId },
      },
      select: { completedAt: true, lesson: { select: { durationSec: true } } },
    });
  }

  findCertificatesByUser(userId: string) {
    return this.prisma.certificate.findMany({
      where: { enrollment: { userId } },
      select: {
        serial: true,
        learnerName: true,
        courseNumber: true,
        pdfUrl: true,
        issuedAt: true,
        enrollment: {
          select: {
            courseId: true,
            enrolledAt: true,
            completedAt: true,
            course: { select: { title: true, slug: true, isoStandard: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });
  }
}
