import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "./email.service";

/** Keys of the admin notification toggles in PlatformSettings.notifications. */
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
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** The support inbox, but only when this particular toggle is on. */
  private async recipient(key: AdminAlertKey): Promise<string | null> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: { supportEmail: true, notifications: true },
    });
    if (!settings) return null;
    const toggles = (settings.notifications ?? {}) as Record<string, boolean>;
    return toggles[key] ? settings.supportEmail : null;
  }

  private async send(
    key: AdminAlertKey,
    subject: string,
    lines: string[],
  ): Promise<void> {
    try {
      const to = await this.recipient(key);
      if (!to) return;
      await this.email.sendAdminAlert(to, subject, lines);
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
    const to = await this.recipient("dailyRevenue");
    if (!to) return;

    const end = new Date(now);
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end.getTime() - 24 * 3600_000);

    const orders = await this.prisma.order.findMany({
      where: { status: "PAID", paidAt: { gte: start, lt: end } },
      select: { totalCents: true, currency: true },
    });
    const gross = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const enrollments = await this.prisma.enrollment.count({
      where: { enrolledAt: { gte: start, lt: end } },
    });
    const signups = await this.prisma.user.count({
      where: { createdAt: { gte: start, lt: end } },
    });

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
    const to = await this.recipient("atRiskDigest");
    if (!to) return;

    const students = await this.prisma.studentProfile.findMany({
      where: { status: "AT_RISK" },
      select: { user: { select: { name: true, email: true } } },
      take: 25,
    });
    if (students.length === 0) return; // nothing to report — stay quiet

    await this.send("atRiskDigest", `${students.length} student(s) at risk`, [
      "These learners have stalled and may need a nudge:",
      ...students.map((s) => `• ${s.user.name} (${s.user.email})`),
    ]);
  }
}
