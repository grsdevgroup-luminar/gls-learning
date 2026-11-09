import type { AutomationRule, ReminderLogEntry } from "./legacy-types";
import { DEFAULT_AUTOMATION_PARAMS } from "@grslearning/shared";

export const automationRules: AutomationRule[] = [
  {
    id: "ar1",
    cooldownHours: 168,
    name: "Ready to continue learning",
    trigger: "idle",
    condition: "No activity for more than 8 days",
    params: DEFAULT_AUTOMATION_PARAMS.IDLE,
    channels: ["email"],
    template: "Ready to continue learning?",
    active: true,
    sentCount: 0,
  },
  {
    id: "ar2",
    cooldownHours: 168,
    name: "Encourage stalled progress",
    trigger: "low_progress",
    condition: "Enrolled for more than 21 days, progress at most 10%",
    params: DEFAULT_AUTOMATION_PARAMS.LOW_PROGRESS,
    channels: ["email"],
    template: "You're just getting started—pick up where you left off.",
    active: true,
    sentCount: 0,
  },
  {
    id: "ar3",
    cooldownHours: 24,
    name: "Recover abandoned carts",
    trigger: "abandoned_cart",
    condition: "Order pending for more than 4.5 hours",
    params: DEFAULT_AUTOMATION_PARAMS.ABANDONED_CART,
    channels: ["email"],
    template: "Your order is waiting—complete payment to continue.",
    active: true,
    sentCount: 0,
  },
  {
    id: "ar4",
    cooldownHours: 168,
    name: "Finish the course",
    trigger: "almost_done",
    condition: "Progress at least 85%",
    params: DEFAULT_AUTOMATION_PARAMS.ALMOST_DONE,
    channels: ["email"],
    template: "You're so close—finish your course and earn your certificate!",
    active: true,
    sentCount: 0,
  },
  {
    id: "ar5",
    cooldownHours: 168,
    name: "New content announcement",
    trigger: "new_content",
    condition: "Lessons added within the last 7 days, after the learner's last activity",
    params: DEFAULT_AUTOMATION_PARAMS.NEW_CONTENT,
    channels: ["email"],
    template: "New content was added to your course.",
    active: true,
    sentCount: 0,
  },
];

export const reminderLog: ReminderLogEntry[] = [
  { id: "rl1", date: "2026-06-23 09:12", student: "Bianca Rossi", channel: "email", trigger: "idle", subject: "Ready to continue learning?", status: "opened" },
  { id: "rl2", date: "2026-06-23 08:40", student: "Yuki Tanaka", channel: "email", trigger: "low_progress", subject: "You're just getting started—pick up where you left off.", status: "clicked" },
  { id: "rl3", date: "2026-06-22 17:05", student: "Emma Schmidt", channel: "email", trigger: "idle", subject: "Ready to continue learning?", status: "opened" },
  { id: "rl4", date: "2026-06-22 14:22", student: "Alex Morgan", channel: "email", trigger: "almost_done", subject: "You're so close—finish your course and earn your certificate!", status: "clicked" },
  { id: "rl5", date: "2026-06-22 11:18", student: "Daniel Tran", channel: "email", trigger: "abandoned_cart", subject: "Your order is waiting—complete payment to continue.", status: "sent" },
  { id: "rl6", date: "2026-06-21 10:03", student: "Rahul Verma", channel: "email", trigger: "almost_done", subject: "You're so close—finish your course and earn your certificate!", status: "opened" },
  { id: "rl7", date: "2026-06-21 09:15", student: "Lina Park", channel: "email", trigger: "new_content", subject: "New content was added to your course.", status: "opened" },
];

export const reminderStats = {
  sent7d: 1840,
  openRate: 48,
  clickRate: 14,
  reactivated: 312,
};
