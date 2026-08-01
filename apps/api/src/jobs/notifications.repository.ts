import { Injectable } from "@nestjs/common";
import { ReminderChannel, ReminderTrigger } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

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
        studentProfile: { select: { notificationPrefs: true } },
      },
    });
  }

  createReminderLog(data: {
    userId: string;
    channel: ReminderChannel;
    trigger: ReminderTrigger;
    subject: string;
    ruleId?: string;
  }) {
    return this.prisma.reminderLog.create({
      data: { ...data, status: "SENT" },
    });
  }
}
