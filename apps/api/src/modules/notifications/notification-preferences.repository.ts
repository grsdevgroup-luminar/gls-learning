import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class NotificationPreferencesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOne(userId: string, event: string) {
    return this.prisma.notificationPreference.findUnique({
      where: { userId_event: { userId, event } },
    });
  }

  findMany(userId: string, events: string[]) {
    return this.prisma.notificationPreference.findMany({
      where: { userId, event: { in: events } },
    });
  }

  upsert(
    userId: string,
    event: string,
    data: { inApp?: boolean; email?: boolean; sms?: boolean },
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_event: { userId, event } },
      update: data,
      create: { userId, event, ...data },
    });
  }
}
