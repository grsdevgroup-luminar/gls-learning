import { Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import type {
  NotificationPreferencesDto,
  UpdateNotificationPreferencesInput,
} from "@skillstream/shared";
import { NotificationPreferencesService } from "../notifications/notification-preferences.service";
import { UsersRepository } from "./users.repository";

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly prefs: NotificationPreferencesService,
  ) {}

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

  /** Reminder opt-ins — same DTO shape as always; storage moved off
   *  StudentProfile.notificationPrefs onto the generalized
   *  NotificationPreference table (see NOTIFICATION_SYSTEM_PLAN.md). */
  notificationPrefs(userId: string): Promise<NotificationPreferencesDto> {
    return this.prefs.getReminderPrefs(userId);
  }

  updateNotificationPrefs(
    userId: string,
    patch: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferencesDto> {
    return this.prefs.updateReminderPrefs(userId, patch);
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.repo.create(data);
  }
}
