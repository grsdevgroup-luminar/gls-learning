import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from "./providers/email-provider";

@Injectable()
export class EmailService {
  private readonly frontendUrl: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.frontendUrl = config.get("FRONTEND_URL", { infer: true });
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await this.provider.send({
        to,
        subject: "Reset your SkillStream password",
        html: this.passwordResetHtml(name, link),
        text: `Hi ${name},\n\nReset your password:\n${link}\n\nThis link expires in 1 hour.\n\n— The SkillStream team`,
      });
    } catch (err) {
      this.logger.error("Failed to send password reset email", err as Error);
      throw new Error("Email delivery failed");
    }
  }

  async sendOrgInvite(
    to: string,
    orgName: string,
    role: string,
    token: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}/join/${encodeURIComponent(token)}`;
    const roleLabel = role === "ADMIN" ? "an admin" : "a member";
    try {
      await this.provider.send({
        to,
        subject: `You've been invited to ${orgName} on SkillStream`,
        html: this.orgInviteHtml(orgName, roleLabel, link),
        text: `You've been invited to join ${orgName} as ${roleLabel} on SkillStream.\n\nAccept your invitation:\n${link}\n\nThis invitation expires in 7 days.\n\n— The SkillStream team`,
      });
    } catch (err) {
      this.logger.error("Failed to send org invite email", err as Error);
      throw new Error("Email delivery failed");
    }
  }

  /** Engagement reminder (marketing automation). `subject` is the already-
   *  rendered template line and doubles as the body's headline. */
  async sendReminder(to: string, name: string, subject: string): Promise<void> {
    try {
      await this.provider.send({
        to,
        subject,
        html: this.reminderHtml(name, subject),
        text: `Hi ${name},\n\n${subject}\n\n${this.frontendUrl}/dashboard\n\n— The SkillStream team`,
      });
    } catch (err) {
      this.logger.error("Failed to send reminder email", err as Error);
      throw new Error("Email delivery failed");
    }
  }

  /** Email fan-out for a Phase 1 in-app notification (order paid, application
   *  decision, payout transition, referral confirmed, ...). Unlike
   *  `sendReminder`, this carries a separate title/body and an optional deep
   *  link into the specific page the event is about, not always /dashboard. */
  async sendNotificationEmail(
    to: string,
    name: string,
    title: string,
    body: string,
    href?: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}${href ?? "/dashboard"}`;
    try {
      await this.provider.send({
        to,
        subject: title,
        html: this.notificationHtml(name, title, body, link),
        text: `Hi ${name},\n\n${title}\n\n${body}\n\n${link}\n\n— The SkillStream team`,
      });
    } catch (err) {
      this.logger.error("Failed to send notification email", err as Error);
      throw new Error("Email delivery failed");
    }
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    try {
      await this.provider.send({
        to,
        subject: "Welcome to SkillStream 🎉",
        html: this.welcomeHtml(name),
        text: `Hi ${name},\n\nWelcome to SkillStream! Start learning today.\n\n${this.frontendUrl}/courses\n\n— The SkillStream team`,
      });
    } catch (err) {
      this.logger.error("Failed to send welcome email", err as Error);
      // Welcome mail is best-effort — swallow so signup path stays green.
    }
  }

  /**
   * Tells an applicant what an admin decided. The apply forms promise "we'll
   * email you our decision", so this closes that loop for both the instructor
   * and sales-agent flows.
   */
  async sendApplicationDecision(
    to: string,
    name: string,
    programme: "instructor" | "sales agent",
    approved: boolean,
    note?: string | null,
  ): Promise<void> {
    const subject = approved
      ? `You're approved as a SkillStream ${programme} 🎉`
      : `Your SkillStream ${programme} application`;
    const lines = approved
      ? [
          `Good news — your ${programme} application has been approved.`,
          ...(note ? [note] : []),
          "Sign in and your new portal will be waiting for you.",
        ]
      : [
          `Thanks for applying to be a SkillStream ${programme}. We're not able to approve your application at this time.`,
          ...(note ? [note] : []),
          "You're welcome to apply again once you have more to show us.",
        ];

    try {
      await this.provider.send({
        to,
        subject,
        html: this.reminderHtml(name, lines.join(" ")),
        text: `Hi ${name},\n\n${lines.join("\n\n")}\n\n— The SkillStream team`,
      });
    } catch (err) {
      this.logger.error("Failed to send application decision email", err as Error);
      throw new Error("Email delivery failed");
    }
  }

  /**
   * Purchase receipt, with the same PDF the buyer can download from
   * /dashboard/billing attached. Best-effort like every other email in a
   * request path — fulfilment must not depend on delivery.
   */
  async sendReceipt(
    to: string,
    name: string,
    order: { id: string; totalCents: number; currency: string; items: { title: string }[] },
    pdf: Buffer,
  ): Promise<void> {
    const total = `${order.currency} ${(order.totalCents / 100).toFixed(2)}`;
    const titles = order.items.map((i) => i.title).join(", ");
    const subject = `Your SkillStream receipt — ${total}`;
    const lines = [
      `Thanks for your purchase, ${name}.`,
      `Order ${order.id}: ${titles}`,
      `Total paid: ${total}`,
      "Your receipt is attached, and your courses are ready in your dashboard.",
    ];

    try {
      await this.provider.send({
        to,
        subject,
        html: this.adminAlertHtml(subject, lines),
        text: `${lines.join("\n\n")}\n\n${this.frontendUrl}/dashboard`,
        attachments: [
          {
            filename: `skillstream-receipt-${order.id}.pdf`,
            content: pdf,
            contentType: "application/pdf",
          },
        ],
      });
    } catch (err) {
      this.logger.error("Failed to send receipt email", err as Error);
      throw new Error("Email delivery failed");
    }
  }

  /** Operational alert to the platform's own support inbox (admin toggles). */
  async sendAdminAlert(to: string, subject: string, lines: string[]): Promise<void> {
    const text = `${lines.join("\n")}\n\n${this.frontendUrl}/admin`;
    try {
      await this.provider.send({
        to,
        subject,
        html: this.adminAlertHtml(subject, lines),
        text,
      });
    } catch (err) {
      this.logger.error("Failed to send admin alert", err as Error);
      throw new Error("Email delivery failed");
    }
  }

  private adminAlertHtml(subject: string, lines: string[]): string {
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = lines
      .map(
        (l) =>
          `<p style="margin:0 0 12px;color:#374151;font-size:15px">${escape(l)}</p>`,
      )
      .join("");
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:#111827;padding:24px 40px">
          <span style="color:#fff;font-size:18px;font-weight:700">SkillStream admin</span>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <h1 style="margin:0 0 16px;color:#111827;font-size:18px">${escape(subject)}</h1>
          ${body}
          <a href="${this.frontendUrl}/admin" style="display:inline-block;margin-top:12px;background:#111827;color:#fff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">Open the admin panel</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private passwordResetHtml(name: string, link: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your password</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
          <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">SkillStream</span>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Reset your password</h1>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px">Hi ${name}, we received a request to reset your password. Click the button below to choose a new one.</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">Reset password</a>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:13px">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;word-break:break-all">Or copy this URL: ${link}</p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
          <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} SkillStream. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private orgInviteHtml(orgName: string, roleLabel: string, link: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Team invitation</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
          <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">SkillStream</span>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">You're invited to ${orgName}</h1>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px">Your organization has invited you to join their team on SkillStream as ${roleLabel}. Accept to get access to your company's courses.</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">Accept invitation</a>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:13px">This invitation expires in <strong>7 days</strong>. If you weren't expecting this, you can ignore this email.</p>
          <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;word-break:break-all">Or copy this URL: ${link}</p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
          <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} SkillStream. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private reminderHtml(name: string, message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
          <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">SkillStream</span>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <p style="margin:0 0 24px;color:#374151;font-size:16px">Hi ${name},</p>
          <p style="margin:0 0 24px;color:#374151;font-size:16px">${message}</p>
          <a href="${this.frontendUrl}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">Continue learning</a>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
          <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} SkillStream. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private notificationHtml(
    name: string,
    title: string,
    body: string,
    link: string,
  ): string {
    const escape = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
          <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">SkillStream</span>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <p style="margin:0 0 8px;color:#374151;font-size:16px">Hi ${escape(name)},</p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827">${escape(title)}</h1>
          <p style="margin:0 0 24px;color:#374151;font-size:15px">${escape(body)}</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">View details</a>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
          <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} SkillStream. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private welcomeHtml(name: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to SkillStream</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
          <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">SkillStream</span>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Welcome, ${name}! 🎉</h1>
          <p style="margin:0 0 24px;color:#6b7280;font-size:15px">You're now part of the SkillStream learning community. Explore thousands of courses and start growing your skills today.</p>
          <a href="${this.frontendUrl}/courses" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">Browse courses</a>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
          <p style="margin:0;color:#9ca3af;font-size:12px">© ${new Date().getFullYear()} SkillStream. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }
}
