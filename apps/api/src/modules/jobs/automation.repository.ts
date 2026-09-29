import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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
        items: { include: { course: { select: { title: true, slug: true } } }, take: 1 },
      },
    });
  }

  /** Latest non-archived lesson `createdAt` per course — used by the NEW_CONTENT
   *  automation trigger so title/price edits don't masquerade as new lessons. */
  async findLatestLessonAddedAt(courseIds: string[]): Promise<Map<string, Date>> {
    if (courseIds.length === 0) return new Map();

    const rows = await this.prisma.lesson.findMany({
      where: {
        archivedAt: null,
        section: { courseId: { in: courseIds } },
      },
      select: {
        createdAt: true,
        section: { select: { courseId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const latest = new Map<string, Date>();
    for (const row of rows) {
      const courseId = row.section.courseId;
      const prev = latest.get(courseId);
      if (!prev || row.createdAt > prev) latest.set(courseId, row.createdAt);
    }
    return latest;
  }

  findInProgressEnrollments(where: object) {
    return this.prisma.enrollment.findMany({
      where: { status: "IN_PROGRESS", ...where },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true, slug: true, updatedAt: true } },
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
