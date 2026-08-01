import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminAlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPlatformSettings() {
    return this.prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: { supportEmail: true, notifications: true },
    });
  }

  findPaidOrdersBetween(start: Date, end: Date) {
    return this.prisma.order.findMany({
      where: { status: "PAID", paidAt: { gte: start, lt: end } },
      select: { totalCents: true, currency: true },
    });
  }

  countEnrollmentsBetween(start: Date, end: Date) {
    return this.prisma.enrollment.count({
      where: { enrolledAt: { gte: start, lt: end } },
    });
  }

  countSignupsBetween(start: Date, end: Date) {
    return this.prisma.user.count({
      where: { createdAt: { gte: start, lt: end } },
    });
  }

  findAtRiskStudents() {
    return this.prisma.studentProfile.findMany({
      where: { status: "AT_RISK" },
      select: { user: { select: { name: true, email: true } } },
      take: 25,
    });
  }
}
