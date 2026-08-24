import { Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import {
  LEARNING_CATEGORIES,
  type LearningPreferencesDto,
  type NotificationPreferencesDto,
  type UpdateNotificationPreferencesInput,
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

  async learningPreferences(userId: string): Promise<LearningPreferencesDto> {
    const profile = await this.repo.findStudentInterests(userId);
    return {
      categories: profile?.interestCategories ?? [],
      keywords: profile?.interestKeywords ?? [],
      completed: Boolean(profile?.interestsCompletedAt),
    };
  }

  async updateLearningPreferences(
    userId: string,
    input: { categories: string[]; keywords: string[] },
  ): Promise<LearningPreferencesDto> {
    await this.repo.saveStudentInterests(userId, input.categories, input.keywords);
    return { ...input, completed: true };
  }

  availableLearningCategories() {
    return LEARNING_CATEGORIES;
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.repo.create(data);
  }
}
