import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { ReminderChannel, ReminderTrigger } from "@prisma/client";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { NOTIFICATIONS_QUEUE } from "./jobs.constants";

export interface ReminderJobData {
  userId: string;
  channel: ReminderChannel;
  trigger: ReminderTrigger;
  subject: string;
  ruleId?: string;
}

/**
 * Sends engagement reminders. In production this would call Resend/Twilio; here
 * it records the delivery in ReminderLog (the channel send is stubbed). The
 * queue gives us retries, backoff, and rate limiting for free.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<unknown> {
    if (job.name !== "reminder") return undefined;
    const { userId, channel, trigger, subject, ruleId } = job.data;

    // TODO: integrate Resend (email) / Twilio (sms) here.
    await this.prisma.reminderLog.create({
      data: { userId, channel, trigger, subject, ruleId, status: "SENT" },
    });
    this.logger.log(`reminder sent (${channel}/${trigger}) to ${userId}`);
    return { ok: true };
  }
}
