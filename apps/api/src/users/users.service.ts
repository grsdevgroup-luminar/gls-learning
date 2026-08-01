import { Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import {
  resolveNotificationPrefs,
  type NotificationPreferencesDto,
  type UpdateNotificationPreferencesInput,
} from "@skillstream/shared";
import { UsersRepository } from "./users.repository";

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }

  /** Full user with the role-specific profile needed for /auth/me. */
  findWithProfiles(id: string) {
    return this.repo.findWithProfiles(id);
  }

  /** Reminder opt-ins, stored as JSON on the student profile. Missing profile
   *  or missing keys fall back to the shared defaults, so every caller sees a
   *  complete object. */
  async notificationPrefs(userId: string): Promise<NotificationPreferencesDto> {
    const profile = await this.repo.findStudentNotificationPrefs(userId);
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
    await this.repo.upsertStudentNotificationPrefs(userId, next);
    return next;
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.repo.create(data);
  }
}
