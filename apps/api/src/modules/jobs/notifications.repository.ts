import { Injectable } from "@nestjs/common";
import { ReminderChannel, ReminderStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserForReminder(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        phone: true,
      },
    });
  }

  createReminderLog(data: {
    userId?: string;
    channel: ReminderChannel;
    trigger: string;
    subject: string;
    ruleId?: string;
    status?: ReminderStatus;
  }) {
    return this.prisma.reminderLog.create({
      data: { ...data, status: data.status ?? "SENT" },
    });
  }

  /** Same 90-day retention as read Notification rows — this is a delivery
   *  audit trail, not a user-facing inbox, so there's no "unread" tier. */
  deleteOldReminderLogs(cutoff: Date) {
    return this.prisma.reminderLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  }
}
