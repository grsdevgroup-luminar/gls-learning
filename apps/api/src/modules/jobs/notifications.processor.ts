import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ReminderChannel, ReminderTrigger } from "@prisma/client";
import { Job } from "bullmq";
import { resolveNotificationPrefs } from "@skillstream/shared";
import { EmailService } from "../email/email.service";
import { SmsService } from "../email/sms.service";
import { NOTIFICATIONS_QUEUE } from "./jobs.constants";
import { NotificationsRepository } from "./notifications.repository";

export interface ReminderJobData {
  userId: string;
  channel: ReminderChannel;
  trigger: ReminderTrigger;
  subject: string;
  ruleId?: string;
}

/**
 * Sends engagement reminders. EMAIL goes out via Resend (EmailService); SMS has
 * no provider wired yet and is logged only. Delivery is recorded in ReminderLog
 * *after* a successful send, so a send failure throws and BullMQ retries without
 * marking the reminder sent (and without starting its cooldown).
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<unknown> {
    if (job.name !== "reminder") return undefined;
    const { userId, channel, trigger, subject, ruleId } = job.data;

    const user = await this.repo.findUserForReminder(userId);
    if (!user) return { ok: false, reason: "user gone" };

    // Opt-outs are enforced here rather than in the producer: every reminder,
    // whatever enqueued it, passes through this worker.
    const prefs = resolveNotificationPrefs(user.studentProfile?.notificationPrefs);
    const wanted = channel === "EMAIL" ? prefs[trigger].email : prefs[trigger].sms;
    if (!wanted) {
      this.logger.log(`reminder skipped (${channel}/${trigger}) — user opted out`);
      return { ok: false, reason: "opted out" };
    }

    if (channel === "EMAIL") {
      await this.email.sendReminder(user.email, user.name, subject);
    } else {
      // No number on file is a dead end, not a failure — don't log it as sent
      // and don't let BullMQ retry it.
      const sent = await this.sms.send(user.phone, subject);
      if (!sent) return { ok: false, reason: "no phone number" };
    }

    await this.repo.createReminderLog({ userId, channel, trigger, subject, ruleId });
    this.logger.log(`reminder sent (${channel}/${trigger}) to ${userId}`);
    return { ok: true };
  }
}
