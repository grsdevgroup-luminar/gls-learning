import { Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import {
  resolveNotificationPrefs,
  type NotificationPreferencesDto,
  type UpdateNotificationPreferencesInput,
} from "@skillstream/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Full user with the role-specific profile needed for /auth/me. */
  findWithProfiles(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { studentProfile: true, instructorProfile: true },
    });
  }

  /** Reminder opt-ins, stored as JSON on the student profile. Missing profile
   *  or missing keys fall back to the shared defaults, so every caller sees a
   *  complete object. */
  async notificationPrefs(userId: string): Promise<NotificationPreferencesDto> {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      select: { notificationPrefs: true },
    });
    return resolveNotificationPrefs(profile?.notificationPrefs);
  }

  /** Sparse merge, then store the fully-resolved object so delivery-time reads
   *  never have to reason about partial state. */
  async updateNotificationPrefs(
    userId: string,
    patch: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferencesDto> {
    const current = await this.notificationPrefs(userId);
    const next = { ...current };
    for (const [trigger, channels] of Object.entries(patch)) {
      const key = trigger as keyof NotificationPreferencesDto;
      next[key] = { ...next[key], ...channels };
    }
    await this.prisma.studentProfile.upsert({
      where: { userId },
      update: { notificationPrefs: next },
      create: { userId, notificationPrefs: next },
    });
    return next;
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
