import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { MAINTENANCE_QUEUE } from "./jobs.constants";

/**
 * Periodic consistency / analytics rollup. Recomputes enrollment completion
 * status (so dashboards stay accurate even if a write was missed) and logs a
 * lightweight metrics snapshot. Idempotent and safe to re-run.
 */
@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== "rollup") return undefined;

    // Reconcile enrollment completion: mark COMPLETED when every lesson is done.
    const enrollments = await this.prisma.enrollment.findMany({
      where: { status: { not: "COMPLETED" } },
      select: {
        id: true,
        courseId: true,
        _count: { select: { lessonProgress: { where: { completed: true } } } },
      },
    });

    let fixed = 0;
    for (const e of enrollments) {
      const total = await this.prisma.lesson.count({
        where: { section: { courseId: e.courseId } },
      });
      if (total > 0 && e._count.lessonProgress >= total) {
        await this.prisma.enrollment.update({
          where: { id: e.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        fixed += 1;
      }
    }

    const [users, courses, paid] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.course.count({ where: { status: "PUBLISHED" } }),
      this.prisma.order.count({ where: { status: "PAID" } }),
    ]);

    const snapshot = { fixedCompletions: fixed, users, courses, paidOrders: paid };
    this.logger.log(`maintenance rollup: ${JSON.stringify(snapshot)}`);
    return snapshot;
  }
}
