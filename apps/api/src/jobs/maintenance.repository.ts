import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MaintenanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findIncompleteEnrollments() {
    return this.prisma.enrollment.findMany({
      where: { status: { not: "COMPLETED" } },
      select: {
        id: true,
        courseId: true,
        _count: { select: { lessonProgress: { where: { completed: true } } } },
      },
    });
  }

  countLessonsByCourse(courseId: string) {
    return this.prisma.lesson.count({
      where: { section: { courseId } },
    });
  }

  markEnrollmentCompleted(id: string, completedAt: Date) {
    return this.prisma.enrollment.update({
      where: { id },
      data: { status: "COMPLETED", completedAt },
    });
  }

  deleteExpiredRefreshTokens(now: Date) {
    return this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
  }

  metricsSnapshot() {
    return this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.course.count({ where: { status: "PUBLISHED" } }),
      this.prisma.order.count({ where: { status: "PAID" } }),
    ]);
  }
}
