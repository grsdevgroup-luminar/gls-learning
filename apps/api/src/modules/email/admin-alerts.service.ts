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
    toggleKey: AdminAlertKey,
    templateKey: string,
    vars: Record<string, unknown>,
  ): Promise<void> {
    try {
      const admins = await this.recipients(toggleKey);
      await Promise.all(
        admins.map((a) => this.email.sendAdminAlert(templateKey, a.email, vars)),
      );
    } catch (err) {
      this.logger.error(`admin alert "${toggleKey}" failed: ${(err as Error).message}`);
    }
  }

  newEnrollment(learnerName: string, courseTitle: string): Promise<void> {
    return this.send("newEnrollment", "admin_alert_new_enrollment", {
      learner_name: learnerName,
      course_title: courseTitle,
    });
  }

  newReview(
    courseTitle: string,
    rating: number,
    authorName: string,
  ): Promise<void> {
    return this.send("newReview", "admin_alert_new_review", {
      author_name: authorName,
      rating: String(rating),
      course_title: courseTitle,
    });
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

    await this.send("dailyRevenue", "admin_alert_daily_revenue", {
      date: start.toISOString().slice(0, 10),
      revenue: money(gross),
      order_count: String(orders.length),
      enrollments: String(enrollments),
      signups: String(signups),
    });
  }

  /** Learners flagged AT_RISK — the "at-risk student digest" toggle. */
  async atRiskDigest(): Promise<void> {
    const admins = await this.recipients("atRiskDigest");
    if (admins.length === 0) return;

    const students = await this.repo.findAtRiskStudents();
    if (students.length === 0) return; // nothing to report — stay quiet

    await this.send("atRiskDigest", "admin_alert_at_risk_digest", {
      student_count: String(students.length),
      student_list: students.map((s) => `• ${s.user.name} (${s.user.email})`).join("\n"),
    });
  }
}
