import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { EmailService } from "../email/email.service";
import type { MailJobData } from "../email/mail-job.types";
import { NotificationsService } from "../notifications/notifications.service";
import { MAIL_QUEUE } from "./jobs.constants";
import { NotificationsRepository } from "./notifications.repository";

/**
 * Delivers every email that used to be sent inline in a request path (welcome,
 * password reset, org invite, org admin credentials, receipts, admin alerts).
 * Concurrency + a rate limit let a burst of enqueues (e.g. a bulk admin alert
 * fan-out) drain without serializing one at a time or tripping the email
 * provider's rate limit.
 */
@Processor(MAIL_QUEUE, { concurrency: 5, limiter: { max: 10, duration: 1000 } })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly email: EmailService,
    private readonly repo: NotificationsRepository,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<unknown> {
    if (job.name !== "send") return undefined;
    const { key, to, vars, ctaHref, protectedHtml, attachments } = job.data;

    const { subject } = await this.email.deliverTemplate(key, to, vars, {
      ctaHref,
      protectedHtml,
      attachments,
    });
    await this.repo.createReminderLog({ channel: "EMAIL", trigger: key, subject });
    return { ok: true };
  }

  /** Fires once a job has exhausted every retry — the only point at which an
   *  email is truly, permanently undelivered rather than "still retrying".
   *  Every email on this queue is transactional (password reset, receipts,
   *  application decisions, ...), never marketing, so alerting on every
   *  exhausted job here is never noisy the way it would be for reminders. */
  @OnWorkerEvent("failed")
  async onFailed(job: Job<MailJobData> | undefined): Promise<void> {
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    this.logger.error(
      `mail delivery exhausted retries: key=${job.data.key} to=${job.data.to}`,
    );
    try {
      await this.repo.createReminderLog({
        channel: "EMAIL",
        trigger: job.data.key,
        subject: job.data.key,
        status: "FAILED",
      });
    } catch (err) {
      // Delivery failure must never crash the worker if the audit table or
      // an older database schema is unavailable.
      this.logger.error("Could not record failed mail delivery", err as Error);
    }
    try {
      // Previously this failure was only ever visible in server logs — an
      // admin had no way to know a critical send (e.g. a password reset) had
      // silently died until a user complained. Surface it in the admin inbox.
      await this.notifications.notifyAdmins({
        event: "EMAIL_DELIVERY_FAILED",
        title: "An email failed to send",
        body: `The "${job.data.key}" email to ${job.data.to} could not be delivered after ${job.attemptsMade} attempt${job.attemptsMade === 1 ? "" : "s"}. Check the email provider configuration.`,
        href: "/admin/marketing",
      });
    } catch (err) {
      this.logger.error("Could not notify admins of failed mail delivery", err as Error);
    }
  }
}
