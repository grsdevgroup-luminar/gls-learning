import { z } from "zod";
import { ReminderTrigger } from "../enums.js";

/** Per-channel opt-in for one reminder trigger. */
export const channelPrefsSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
});
export type ChannelPrefs = z.infer<typeof channelPrefsSchema>;

export const REMINDER_TRIGGERS = [
  ReminderTrigger.IDLE,
  ReminderTrigger.LOW_PROGRESS,
  ReminderTrigger.ALMOST_DONE,
  ReminderTrigger.ABANDONED_CART,
  ReminderTrigger.NEW_CONTENT,
] as const;

/** `GET /me/notification-preferences` — always fully populated (defaults filled in). */
export type NotificationPreferencesDto = Record<ReminderTrigger, ChannelPrefs>;

/** `PATCH /me/notification-preferences` — sparse; only the named triggers change. */
const partialChannelPrefs = channelPrefsSchema.partial();
export const updateNotificationPreferencesSchema = z
  .object({
    IDLE: partialChannelPrefs,
    LOW_PROGRESS: partialChannelPrefs,
    ALMOST_DONE: partialChannelPrefs,
    ABANDONED_CART: partialChannelPrefs,
    NEW_CONTENT: partialChannelPrefs,
  })
  .partial()
  .strict();
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

/** Opted in by default: a learner who never visits settings still gets nudges. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferencesDto =
  Object.fromEntries(
    REMINDER_TRIGGERS.map((t) => [t, { email: true, sms: false }]),
  ) as NotificationPreferencesDto;

/** Merges a stored (possibly empty or stale) prefs blob over the defaults. */
export function resolveNotificationPrefs(
  stored: unknown,
): NotificationPreferencesDto {
  const source = (stored ?? {}) as Partial<
    Record<ReminderTrigger, Partial<ChannelPrefs>>
  >;
  return Object.fromEntries(
    REMINDER_TRIGGERS.map((t) => [
      t,
      {
        email: source[t]?.email ?? DEFAULT_NOTIFICATION_PREFS[t].email,
        sms: source[t]?.sms ?? DEFAULT_NOTIFICATION_PREFS[t].sms,
      },
    ]),
  ) as NotificationPreferencesDto;
}

/** Human labels shared by the settings UI. */
export const REMINDER_TRIGGER_COPY: Record<
  ReminderTrigger,
  { title: string; description: string }
> = {
  IDLE: {
    title: "Idle reminders",
    description: "Nudge me if I haven't studied in a week",
  },
  LOW_PROGRESS: {
    title: "Stalled progress",
    description: "Encourage me when I fall behind on a course",
  },
  ALMOST_DONE: {
    title: "Almost done",
    description: "Tell me when I'm close to finishing a course",
  },
  ABANDONED_CART: {
    title: "Abandoned cart",
    description: "Remind me about courses left in my cart",
  },
  NEW_CONTENT: {
    title: "New lessons",
    description: "Let me know when a course I'm taking adds content",
  },
};
