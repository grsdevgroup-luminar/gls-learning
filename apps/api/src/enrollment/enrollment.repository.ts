import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { COURSE_SUMMARY_INCLUDE } from "../courses/course.mapper";

export const ENROLLMENT_INCLUDE = {
  course: { include: COURSE_SUMMARY_INCLUDE },
  lessonProgress: { where: { completed: true }, select: { lessonId: true } },
  certificate: true,
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentRow = Prisma.EnrollmentGetPayload<{
  include: typeof ENROLLMENT_INCLUDE;
}>;

type Db = Prisma.TransactionClient | PrismaService;

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

  findCourseAccess(courseId: string) {
    return this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        basePriceCents: true,
        status: true,
        visibility: true,
        orgId: true,
      },
    });
  }

  findOrgMembership(orgId: string, userId: string) {
    return this.prisma.orgMember.findFirst({
      where: { orgId, userId },
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

  findLessonProgress(enrollmentId: string, lessonId: string) {
    return this.prisma.lessonProgress.findUnique({
      where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    });
  }

  deleteLessonProgressById(id: string) {
    return this.prisma.lessonProgress.delete({ where: { id } });
  }

  createLessonProgress(enrollmentId: string, lessonId: string) {
    return this.prisma.lessonProgress.create({
      data: { enrollmentId, lessonId, completed: true },
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

  upsertCertificate(enrollmentId: string, serial: string) {
    return this.prisma.certificate.upsert({
      where: { enrollmentId },
      update: {},
      create: { enrollmentId, serial },
    });
  }

  deleteCertificateByEnrollment(enrollmentId: string) {
    return this.prisma.certificate.delete({ where: { enrollmentId } });
  }

  findWeeklyLessonProgress(userId: string, since: Date) {
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
      include: {
        enrollment: {
          select: {
            courseId: true,
            course: { select: { title: true, slug: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });
  }
}
