import type { AutomationRule, ReminderLogEntry } from "./legacy-types";

export const automationRules: AutomationRule[] = [
  {
    id: "ar1",
    name: "Ready to continue learning",
    trigger: "idle",
    condition: "No activity for 8 days",
    channels: ["email"],
    template: "Ready to continue learning?",
    active: true,
    sentCount: 0,
  },
  {
    id: "ar2",
    name: "Encourage stalled progress",
    trigger: "low_progress",
    condition: "10% or less complete after 3 weeks",
    channels: ["email"],
    template: "You're just getting started—pick up where you left off.",
    active: true,
    sentCount: 0,
  },
  {
    id: "ar3",
    name: "Recover abandoned carts",
    trigger: "abandoned_cart",
    condition: "Order unpaid for 4.5 hours",
    channels: ["email"],
    template: "Your order is waiting—complete payment to continue.",
    active: true,
    sentCount: 0,
  },
  {
    id: "ar4",
    name: "Finish the course",
    trigger: "almost_done",
    condition: "85% or more complete",
    channels: ["email"],
    template: "You're so close—finish your course and earn your certificate!",
    active: true,
    sentCount: 0,
  },
  {
    id: "ar5",
    name: "New content announcement",
    trigger: "new_content",
    condition: "A new lesson was added in the last 7 days since the learner last studied",
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
