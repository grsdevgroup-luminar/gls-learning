import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { AutomationService } from "./automation.service";
import { FxService } from "./fx.service";
import { AdminAlertsService } from "../email/admin-alerts.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { StreamCleanupService } from "../media/stream-cleanup.service";
import { MAINTENANCE_QUEUE } from "./jobs.constants";
import { MaintenanceRepository } from "./maintenance.repository";
import { NotificationsRepository } from "./notifications.repository";

/**
 * Periodic consistency / analytics rollup. Recomputes enrollment completion
 * status (so dashboards stay accurate even if a write was missed) and logs a
 * lightweight metrics snapshot. Idempotent and safe to re-run.
 */
@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly repo: MaintenanceRepository,
    private readonly reminderRepo: NotificationsRepository,
    private readonly automation: AutomationService,
    private readonly fx: FxService,
    private readonly alerts: AdminAlertsService,
    private readonly notifications: NotificationsService,
    private readonly organizations: OrganizationsService,
    private readonly streamCleanup: StreamCleanupService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    // Marketing automation rides the same periodic queue as the rollup.
    if (job.name === "automation-sweep") return this.automation.sweep();
    if (job.name === "fx-refresh") return this.fx.refresh();
    if (job.name === "admin-digest") {
      await this.alerts.dailyRevenue();
      await this.alerts.atRiskDigest();
      return { ok: true };
    }
    if (job.name === "org-invite-expiry") {
      await this.organizations.checkExpiredInvitations();
      return { ok: true };
    }
    if (job.name === "notification-retention") {
      const notifications = await this.notifications.pruneRead();
      const cutoff = new Date(Date.now() - 90 * 86_400_000);
      const { count: reminderLogs } = await this.reminderRepo.deleteOldReminderLogs(cutoff);
      const result = { ...notifications, reminderLogs };
      this.logger.log(`notification retention: ${JSON.stringify(result)}`);
      return result;
    }
    if (job.name === "table-size-check") {
      await this.notifications.checkTableSize();
      return { ok: true };
    }
    if (job.name === "upload-sweep") {
      return this.streamCleanup.runMaintenanceSweep();
    }
    if (job.name !== "rollup") return undefined;

    // Reconcile enrollment completion: mark COMPLETED when every lesson is done.
    const enrollments = await this.repo.findIncompleteEnrollments();

    let fixed = 0;
    for (const e of enrollments) {
      const total = await this.repo.countLessonsByCourse(e.courseId);
      if (total > 0 && e._count.lessonProgress >= total) {
        await this.repo.markEnrollmentCompleted(e.id, new Date());
        fixed += 1;
      }
    }

    // Prune refresh tokens past expiry. Rotation now keeps revoked rows (for
    // reuse detection), so they must be swept once expired or they accumulate.
    const { count: prunedTokens } = await this.repo.deleteExpiredRefreshTokens(
      new Date(),
    );

    const [users, courses, paid] = await this.repo.metricsSnapshot();

    const snapshot = { fixedCompletions: fixed, prunedTokens, users, courses, paidOrders: paid };
    this.logger.log(`maintenance rollup: ${JSON.stringify(snapshot)}`);
    return snapshot;
  }
}
