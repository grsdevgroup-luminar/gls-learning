import { Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async hasPendingRoleApplication(userId: string): Promise<boolean> {
    const [instructorApplication, deliveryPartnerApplication] = await Promise.all([
      this.prisma.instructorApplication.findFirst({
        where: { userId },
        orderBy: { appliedAt: "desc" },
        select: { status: true },
      }),
      this.prisma.deliveryPartnerApplication.findFirst({
        where: { userId },
        orderBy: { appliedAt: "desc" },
        select: { status: true },
      }),
    ]);

    return (
      instructorApplication?.status === "PENDING" ||
      deliveryPartnerApplication?.status === "PENDING"
    );
  }

  findWithProfiles(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, instructorProfile: true },
    });
  }

  findStudentNotificationPrefs(userId: string) {
    return this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { notificationPrefs: true },
    });
  }

  upsertStudentNotificationPrefs(
    userId: string,
    next: Prisma.InputJsonValue,
  ) {
    return this.prisma.studentProfile.upsert({
      where: { userId },
      update: { notificationPrefs: next },
      create: { userId, notificationPrefs: next },
    });
  }

  findStudentInterests(userId: string) {
    return this.prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        interestCategories: true,
        interestKeywords: true,
        interestsCompletedAt: true,
      },
    });
  }

  saveStudentInterests(userId: string, categories: string[], keywords: string[]) {
    return this.prisma.studentProfile.upsert({
      where: { userId },
      update: {
        interestCategories: categories,
        interestKeywords: keywords,
        interestsCompletedAt: new Date(),
      },
      create: {
        userId,
        interestCategories: categories,
        interestKeywords: keywords,
        interestsCompletedAt: new Date(),
      },
    });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
