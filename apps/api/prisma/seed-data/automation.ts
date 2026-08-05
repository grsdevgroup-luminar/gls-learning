import type { AutomationRule, ReminderLogEntry } from "./legacy-types";

export const automationRules: AutomationRule[] = [
  {
    id: "ar1",
    name: "Win back idle learners",
    trigger: "idle",
    condition: "No activity for 7 days",
    channels: ["email", "sms"],
    template: "Hi {{first_name}}, your {{course}} is waiting — pick up where you left off (you're {{progress}}% there!).",
    active: true,
    sentCount: 1284,
  },
  {
    id: "ar2",
    name: "Nudge stalled progress",
    trigger: "low_progress",
    condition: "Less than 15% complete after 14 days",
    channels: ["email"],
    template: "One small step today, {{first_name}}? The next lesson in {{course}} is only 12 minutes.",
    active: true,
    sentCount: 642,
  },
  {
    id: "ar3",
    name: "Recover abandoned carts",
    trigger: "abandoned_cart",
    condition: "Cart left for 3 hours",
    channels: ["email"],
    template: "Still thinking it over? Here's 10% off {{course}} to help you decide. Code: COMEBACK10",
    active: true,
    sentCount: 388,
  },
  {
    id: "ar4",
    name: "Celebrate the finish line",
    trigger: "almost_done",
    condition: "Over 85% complete",
    channels: ["email"],
    template: "You're almost there, {{first_name}}! Finish {{course}} this week and earn your certificate. 🎓",
    active: true,
    sentCount: 921,
  },
  {
    id: "ar5",
    name: "New content announcement",
    trigger: "new_content",
    condition: "New lessons added to an enrolled course",
    channels: ["email"],
    template: "New lessons just dropped in {{course}}. Come check them out!",
    active: false,
    sentCount: 0,
  },
];

export const reminderLog: ReminderLogEntry[] = [
  { id: "rl1", date: "2026-06-23 09:12", student: "Bianca Rossi", channel: "email", trigger: "idle", subject: "Your ML course is waiting", status: "opened" },
  { id: "rl2", date: "2026-06-23 09:12", student: "Bianca Rossi", channel: "sms", trigger: "idle", subject: "Pick up where you left off", status: "sent" },
  { id: "rl3", date: "2026-06-23 08:40", student: "Yuki Tanaka", channel: "email", trigger: "low_progress", subject: "One small step today?", status: "clicked" },
  { id: "rl4", date: "2026-06-22 17:05", student: "Emma Schmidt", channel: "email", trigger: "idle", subject: "Your AWS course misses you", status: "opened" },
  { id: "rl5", date: "2026-06-22 14:22", student: "Alex Morgan", channel: "email", trigger: "almost_done", subject: "You're almost there! 🎓", status: "clicked" },
  { id: "rl6", date: "2026-06-22 11:18", student: "Daniel Tran", channel: "email", trigger: "abandoned_cart", subject: "10% off to finish your order", status: "sent" },
  { id: "rl7", date: "2026-06-21 19:50", student: "Sofia Reyes", channel: "sms", trigger: "idle", subject: "Your design course is waiting", status: "bounced" },
  { id: "rl8", date: "2026-06-21 10:03", student: "Rahul Verma", channel: "email", trigger: "almost_done", subject: "Finish this week, earn your cert", status: "opened" },
];

export const reminderStats = {
  sent7d: 1840,
  openRate: 48,
  clickRate: 14,
  reactivated: 312,
};
