import { Injectable } from "@nestjs/common";
import {
  REMINDER_TRIGGERS,
  resolveNotificationPrefs,
  type ChannelPrefs,
  type NotificationPreferencesDto,
  type UpdateNotificationPreferencesInput,
} from "@skillstream/shared";
import { NotificationPreferencesRepository } from "./notification-preferences.repository";

/**
 * One generalized preference store behind three call sites: the student
 * reminder-settings API, the delivery-time gate in NotificationsProcessor
 * (both reminders and Phase 1 events), and the admin-alert fan-out. See
 * NOTIFICATION_SYSTEM_PLAN.md.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly repo: NotificationPreferencesRepository) {}

  /** `GET /me/notification-preferences` — same DTO shape as before the
   *  StudentProfile.notificationPrefs JSON blob existed; only the storage
   *  moved, not the contract. */
  async getReminderPrefs(userId: string): Promise<NotificationPreferencesDto> {
    const rows = await this.repo.findMany(userId, [...REMINDER_TRIGGERS]);
    const stored = Object.fromEntries(
      rows.map((r) => [r.event, { email: r.email, sms: r.sms }]),
    );
    return resolveNotificationPrefs(stored);
  }

  /** Sparse merge, same semantics the old JSON-blob version had — only the
   *  triggers present in `patch` are written. */
  async updateReminderPrefs(
    userId: string,
    patch: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferencesDto> {
    const current = await this.getReminderPrefs(userId);
    for (const [trigger, channels] of Object.entries(patch)) {
      const key = trigger as keyof NotificationPreferencesDto;
      const merged: ChannelPrefs = { ...current[key], ...channels };
      current[key] = merged;
      await this.repo.upsert(userId, key, merged);
    }
    return current;
  }

  /** Delivery-time gate — defaults match the reminder system's existing
   *  defaults (email on, sms off) for every event universe: reminders, Phase 1
   *  transactional events, and admin alert keys alike. */
  async wantsChannel(
    userId: string,
    event: string,
    channel: "EMAIL" | "SMS",
  ): Promise<boolean> {
    const row = await this.repo.findOne(userId, event);
    if (channel === "EMAIL") return row?.email ?? true;
    return row?.sms ?? false;
  }
}
