import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AutomationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveRules() {
    return this.prisma.automationRule.findMany({
      where: { active: true },
    });
  }

  findRecentReminder(userId: string, ruleId: string, since: Date) {
    return this.prisma.reminderLog.findFirst({
      where: { userId, ruleId, createdAt: { gte: since } },
      select: { id: true },
    });
  }

  incrementRuleSentCount(ruleId: string, sentForRule: number) {
    return this.prisma.automationRule.update({
      where: { id: ruleId },
      data: { sentCount: { increment: sentForRule } },
    });
  }

  findPendingOrders(before: Date) {
    return this.prisma.order.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: before },
      },
      include: {
        user: { select: { name: true } },
        items: { include: { course: { select: { title: true } } }, take: 1 },
      },
    });
  }

  findInProgressEnrollments(where: object) {
    return this.prisma.enrollment.findMany({
      where: { status: "IN_PROGRESS", ...where },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true, updatedAt: true } },
        _count: { select: { lessonProgress: { where: { completed: true } } } },
      },
    });
  }

  countLessonsByCourse(courseId: string) {
    return this.prisma.lesson.count({
      where: { section: { courseId } },
    });
  }
}
