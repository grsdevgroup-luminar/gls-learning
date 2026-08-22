import { Injectable, Logger } from "@nestjs/common";
import { NotificationPreferencesService } from "../notifications/notification-preferences.service";
import { AdminAlertsRepository } from "./admin-alerts.repository";
import { EmailService } from "./email.service";

/** Keys of the admin notification toggles in PlatformSettings.notifications —
 *  also used as the NotificationPreference "event" for per-admin opt-in. */
export type AdminAlertKey =
  | "newEnrollment"
  | "dailyRevenue"
  | "atRiskDigest"
  | "newReview";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Sends the alerts behind the admin notification switches. Every send is
 * best-effort: an alert must never fail the user action that triggered it
 * (an enrolment, a review), so failures are logged and swallowed.
 */
@Injectable()
export class AdminAlertsService {
  private readonly logger = new Logger(AdminAlertsService.name);

  constructor(
    private readonly repo: AdminAlertsRepository,
    private readonly email: EmailService,
    private readonly prefs: NotificationPreferencesService,
  ) {}

  /** Real admin users who get this alert: the platform-wide toggle is a kill
   *  switch (unchanged from before — same Admin → Settings page), and each
   *  admin additionally has their own independent opt-in on top of it,
   *  defaulting to on. Replaces the single hardcoded `supportEmail` string. */
  private async recipients(
    key: AdminAlertKey,
  ): Promise<{ id: string; name: string; email: string }[]> {
    const settings = await this.repo.findPlatformSettings();
    const toggles = (settings?.notifications ?? {}) as Record<string, boolean>;
    if (!toggles[key]) return [];

    const admins = await this.repo.findAdminUsers();
    const allowed = await Promise.all(
      admins.map(async (a) => ({
        admin: a,
        wants: await this.prefs.wantsChannel(a.id, key, "EMAIL"),
      })),
    );
    return allowed.filter((a) => a.wants).map((a) => a.admin);
  }

  private async send(
    key: AdminAlertKey,
    subject: string,
    lines: string[],
  ): Promise<void> {
    try {
      const admins = await this.recipients(key);
      await Promise.all(
        admins.map((a) => this.email.sendAdminAlert(a.email, subject, lines)),
      );
    } catch (err) {
      this.logger.error(`admin alert "${key}" failed: ${(err as Error).message}`);
    }
  }

  newEnrollment(learnerName: string, courseTitle: string): Promise<void> {
    return this.send("newEnrollment", `New enrollment: ${courseTitle}`, [
      `${learnerName} enrolled in “${courseTitle}”.`,
    ]);
  }

  newReview(
    courseTitle: string,
    rating: number,
    authorName: string,
  ): Promise<void> {
    return this.send("newReview", `New ${rating}★ review: ${courseTitle}`, [
      `${authorName} left a ${rating}-star review on “${courseTitle}”.`,
      "It stays hidden from the storefront until you approve it in Admin → Reviews.",
    ]);
  }

  /** Yesterday's takings — the "daily revenue summary" toggle. */
  async dailyRevenue(now: Date = new Date()): Promise<void> {
    const admins = await this.recipients("dailyRevenue");
    if (admins.length === 0) return;

    const end = new Date(now);
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end.getTime() - 24 * 3600_000);

    const orders = await this.repo.findPaidOrdersBetween(start, end);
    const gross = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const enrollments = await this.repo.countEnrollmentsBetween(start, end);
    const signups = await this.repo.countSignupsBetween(start, end);

    await this.send(
      "dailyRevenue",
      `Daily summary — ${money(gross)} from ${orders.length} order${orders.length === 1 ? "" : "s"}`,
      [
        `Date: ${start.toISOString().slice(0, 10)} (UTC)`,
        `Revenue: ${money(gross)} across ${orders.length} paid order(s)`,
        `New enrollments: ${enrollments}`,
        `New signups: ${signups}`,
      ],
    );
  }

  /** Learners flagged AT_RISK — the "at-risk student digest" toggle. */
  async atRiskDigest(): Promise<void> {
    const admins = await this.recipients("atRiskDigest");
    if (admins.length === 0) return;

    const students = await this.repo.findAtRiskStudents();
    if (students.length === 0) return; // nothing to report — stay quiet

    await this.send("atRiskDigest", `${students.length} student(s) at risk`, [
      "These learners have stalled and may need a nudge:",
      ...students.map((s) => `• ${s.user.name} (${s.user.email})`),
    ]);
  }
}
