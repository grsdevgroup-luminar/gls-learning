import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { Env } from "../config/env";

@Injectable()
export class EmailService {
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService<Env, true>) {
    const apiKey = config.get("RESEND_API_KEY", { infer: true });
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = config.get("RESEND_FROM_EMAIL", { infer: true });
    this.frontendUrl = config.get("FRONTEND_URL", { infer: true });

    if (!this.resend) {
      this.logger.warn("RESEND_API_KEY not set — emails will be logged only");
    }
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    if (!this.resend) {
      this.logger.log(`[DEV] Password reset link for ${to}: ${link}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: `SkillStream <${this.from}>`,
      to,
      subject: "Reset your SkillStream password",
      html: this.passwordResetHtml(name, link),
      text: `Hi ${name},\n\nReset your password:\n${link}\n\nThis link expires in 1 hour.\n\n— The SkillStream team`,
    });

    if (error) {
      this.logger.error("Failed to send password reset email", error);
      throw new Error("Email delivery failed");
    }
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[DEV] Welcome email would be sent to ${to}`);
      return;
    }

    await this.resend.emails.send({
      from: `SkillStream <${this.from}>`,
      to,
      subject: "Welcome to SkillStream 🎉",
      html: this.welcomeHtml(name),
      text: `Hi ${name},\n\nWelcome to SkillStream! Start learning today.\n\n${this.frontendUrl}/courses\n\n— The SkillStream team`,
    });
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
