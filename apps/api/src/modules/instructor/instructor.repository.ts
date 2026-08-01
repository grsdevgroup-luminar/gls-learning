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

  findManyApplications(status?: InstructorStatus) {
    return this.prisma.instructorApplication.findMany({
      where: status ? { status } : undefined,
      orderBy: { appliedAt: "desc" },
    });
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
