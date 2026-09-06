import { Injectable } from "@nestjs/common";
import { InstructorStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { Db } from "../../common/types";

@Injectable()
export class InstructorRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Db) {
    return tx ?? this.prisma;
  }

  findUserByIdOrThrow(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
  }

  findPendingApplication(userId: string) {
    return this.prisma.instructorApplication.findFirst({
      where: { userId, status: "PENDING" },
    });
  }

  /** Most recent application regardless of status — lets `myProfile()`
   *  reflect a pending or rejected application before any InstructorProfile
   *  row exists (that row is only created on approval). */
  findLatestApplicationByUser(userId: string) {
    return this.prisma.instructorApplication.findFirst({
      where: { userId },
      orderBy: { appliedAt: "desc" },
    });
  }

  createApplication(data: Prisma.InstructorApplicationUncheckedCreateInput) {
    return this.prisma.instructorApplication.create({ data });
  }

  findApprovedInstructorsRoster() {
    return this.prisma.user.findMany({
      where: { instructorProfile: { status: InstructorStatus.APPROVED } },
      include: { instructorProfile: true },
      orderBy: { instructorProfile: { ratingAvg: "desc" } },
    });
  }

  findApprovedProfileByUserId(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, instructorProfile: { status: InstructorStatus.APPROVED } },
      include: { instructorProfile: true },
    });
  }

  findInstructorProfilesPage(
    where: Prisma.UserWhereInput,
    page: number,
    pageSize: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: { instructorProfile: true },
        orderBy: { instructorProfile: { ratingAvg: "desc" } },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
  }

  findUserWithProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { instructorProfile: true },
    });
  }

  updateUserAvatar(userId: string, avatar: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar },
    });
  }

  updateInstructorProfile(
    userId: string,
    data: Prisma.InstructorProfileUpdateInput,
  ) {
    return this.prisma.instructorProfile.update({
      where: { userId },
      data,
    });
  }

  findApplicationsPage(
    where: Prisma.InstructorApplicationWhereInput,
    page: number,
    pageSize: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.instructorApplication.findMany({
        where,
        orderBy: { appliedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.instructorApplication.count({ where }),
    ]);
  }

  applicationStatusCounts() {
    return this.prisma.$transaction([
      this.prisma.instructorApplication.count({ where: { status: "PENDING" } }),
      this.prisma.instructorApplication.count({ where: { status: "APPROVED" } }),
      this.prisma.instructorApplication.count({ where: { status: "REJECTED" } }),
    ]);
  }

  findApplicationById(appId: string) {
    return this.prisma.instructorApplication.findUnique({
      where: { id: appId },
    });
  }

  updateApplication(
    appId: string,
    data: Prisma.InstructorApplicationUpdateInput,
    tx?: Db,
  ) {
    return this.db(tx).instructorApplication.update({
      where: { id: appId },
      data,
    });
  }

  updateUserRole(userId: string, role: "INSTRUCTOR", tx?: Db) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { role },
    });
  }

  /** Live per-instructor rollup. `InstructorProfile.studentCount` is
   *  incremented on enrollment but `ratingAvg` is never written, so the
   *  earnings page needs a real-time aggregate over the instructor's
   *  published courses. Weighted by `reviewCount` so a course with 100
   *  reviews outweighs one with 2. */
  async computeInstructorStats(instructorId: string) {
    const courses = await this.prisma.course.findMany({
      where: { instructorId, status: "PUBLISHED" },
      select: { studentCount: true, ratingAvg: true, reviewCount: true },
    });
    let students = 0;
    let ratingSum = 0;
    let reviewSum = 0;
    for (const c of courses) {
      students += c.studentCount;
      ratingSum += c.ratingAvg * c.reviewCount;
      reviewSum += c.reviewCount;
    }
    return {
      studentCount: students,
      ratingAvg: reviewSum > 0 ? ratingSum / reviewSum : 0,
    };
  }

  upsertInstructorProfile(
    userId: string,
    update: Prisma.InstructorProfileUpdateInput,
    create: Prisma.InstructorProfileUncheckedCreateInput,
    tx?: Db,
  ) {
    return this.db(tx).instructorProfile.upsert({
      where: { userId },
      update,
      create,
    });
  }
}
