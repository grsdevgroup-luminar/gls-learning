import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ReminderChannel, ReminderTrigger } from "@prisma/client";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NOTIFICATIONS_QUEUE } from "./jobs.constants";

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
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<unknown> {
    if (job.name !== "reminder") return undefined;
    const { userId, channel, trigger, subject, ruleId } = job.data;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) return { ok: false, reason: "user gone" };

    if (channel === "EMAIL") {
      await this.email.sendReminder(user.email, user.name, subject);
    } else {
      // ponytail: SMS has no provider (no Twilio in this system) — logged only.
      this.logger.log(`[STUB] ${channel} reminder to ${userId}: ${subject}`);
    }

    await this.prisma.reminderLog.create({
      data: { userId, channel, trigger, subject, ruleId, status: "SENT" },
    });
    this.logger.log(`reminder sent (${channel}/${trigger}) to ${userId}`);
    return { ok: true };
  }
}
