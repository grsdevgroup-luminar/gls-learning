import { Injectable } from "@nestjs/common";
import { ReminderChannel } from "@prisma/client";
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
    userId: string;
    channel: ReminderChannel;
    trigger: string;
    subject: string;
    ruleId?: string;
  }) {
    return this.prisma.reminderLog.create({
      data: { ...data, status: "SENT" },
    });
  }
}
