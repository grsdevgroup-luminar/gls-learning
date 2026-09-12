import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";
import { firstName } from "../../common/utils/text";
import type { Env } from "../../config/env";
import { MAIL_QUEUE } from "../jobs/jobs.constants";
import { credentialsBoxHtml, escapeHtml, renderEmailLayout } from "./email-layout";
import { EmailTemplatesService } from "./email-templates.service";
import type { MailAttachment, MailJobData } from "./mail-job.types";
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from "./providers/email-provider";

/** Every retryable, admin-templatable send goes through the `mail` queue
 *  (section 9 of the email-templates plan): a transient provider outage
 *  retries instead of silently dropping the email or failing the request
 *  that triggered it. */
const MAIL_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: 500,
  removeOnFail: { count: 500 },
};

/** BullMQ rejects a custom job id containing ":" (it collides with the
 *  library's own Redis key namespacing) — join with "|" instead, and strip
 *  any stray colons from the parts themselves just in case. */
function safeJobId(...parts: string[]): string {
  return parts.map((p) => p.replace(/:/g, "_")).join("|");
}

@Injectable()
export class EmailService {
  private readonly frontendUrl: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue<MailJobData>,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly templates: EmailTemplatesService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.frontendUrl = config.get("FRONTEND_URL", { infer: true });
  }

  private enqueue(jobId: string, data: MailJobData): Promise<unknown> {
    return this.mailQueue.add("send", data, { ...MAIL_JOB_OPTS, jobId });
  }

  // ── Queued (deferred, retried, admin-templatable) ─────────────────────────

  async sendWelcome(to: string, name: string): Promise<void> {
    await this.enqueue(safeJobId("welcome", to), {
      key: "welcome",
      to,
      vars: { first_name: firstName(name) },
      ctaHref: `${this.frontendUrl}/courses`,
    });
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.enqueue(safeJobId("password_reset", token), {
      key: "password_reset",
      to,
      vars: { first_name: firstName(name), reset_link: link },
      ctaHref: link,
    });
  }

  async sendOrgInvite(
    to: string,
    orgName: string,
    role: string,
    token: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}/join/${encodeURIComponent(token)}`;
    await this.enqueue(safeJobId("org_invite", token), {
      key: "org_invite",
      to,
      vars: {
        org_name: orgName,
        role_label: role === "ADMIN" ? "an admin" : "a member",
        invite_link: link,
      },
      ctaHref: link,
    });
  }

  async sendOrgAdminCredentials(
    to: string,
    adminName: string,
    orgName: string,
    tempPassword: string,
  ): Promise<void> {
    const link = `${this.frontendUrl}/login`;
    await this.enqueue(safeJobId("org_admin_credentials", to, tempPassword), {
      key: "org_admin_credentials",
      to,
      vars: {
        admin_name: adminName,
        org_name: orgName,
        admin_email: to,
        temp_password: tempPassword,
        login_link: link,
      },
      ctaHref: link,
      protectedHtml: credentialsBoxHtml(to, tempPassword),
    });
  }

  /**
   * Purchase receipt, with the same PDF the buyer can download from
   * /dashboard/billing attached. Queued like every other email, so a
   * transient provider outage retries instead of losing the receipt.
   */
  async sendReceipt(
    to: string,
    name: string,
    order: { id: string; totalCents: number; currency: string; items: { title: string }[] },
    pdf: Buffer,
  ): Promise<void> {
    const total = `${order.currency} ${(order.totalCents / 100).toFixed(2)}`;
    const attachments: MailAttachment[] = [
      {
        filename: `skillstream-receipt-${order.id}.pdf`,
        contentBase64: pdf.toString("base64"),
        contentType: "application/pdf",
      },
    ];
    await this.enqueue(safeJobId("receipt", order.id), {
      key: "receipt",
      to,
      vars: {
        first_name: firstName(name),
        order_id: order.id,
        items: order.items.map((i) => i.title).join(", "),
        total,
      },
      ctaHref: `${this.frontendUrl}/dashboard`,
      attachments,
    });
  }

  /** Operational alert to the platform's own support inbox (admin toggles).
   *  `key` is one of the `admin_alert_*` registry entries. */
  async sendAdminAlert(
    key: string,
    to: string,
    vars: Record<string, unknown>,
  ): Promise<void> {
    const varsFingerprint = Object.values(vars).join("_");
    await this.enqueue(safeJobId(key, to, varsFingerprint), {
      key,
      to,
      vars,
      ctaHref: `${this.frontendUrl}/admin`,
    });
  }

  // ── Direct (already running inside a retrying BullMQ worker) ──────────────

  /** Engagement reminder (marketing automation). Reminders stay on
   *  `AutomationRule.template`, not the EmailTemplate registry — this renders
   *  straight into the shared layout rather than looking up a template key. */
  async sendReminder(to: string, name: string, subject: string): Promise<void> {
    const safeSubject = escapeHtml(subject);
    const html = renderEmailLayout({
      headline: safeSubject,
      bodyHtml: `<p style="margin:0">Hi ${escapeHtml(firstName(name))}, ${safeSubject}</p>`,
      ctaLabel: "Continue learning",
      ctaHref: `${this.frontendUrl}/dashboard`,
    });
    await this.deliver(to, subject, html, `Hi ${name},\n\n${subject}\n\n${this.frontendUrl}/dashboard`);
  }

  /** Email fan-out for a Phase 1 in-app notification (order paid, application
   *  decision, payout transition, referral confirmed, ...). `key` is the
   *  NotificationEvent value, which doubles as its EmailTemplate registry key. */
  async sendNotificationEmail(
    key: string,
    to: string,
    name: string,
    title: string,
    body: string,
    href?: string,
  ): Promise<void> {
    const { subject, html, text } = await this.templates.render(
      key,
      { first_name: firstName(name), title, body },
      { ctaHref: `${this.frontendUrl}${href ?? "/dashboard"}` },
    );
    await this.deliver(to, subject, html, text);
  }

  private async deliver(to: string, subject: string, html: string, text: string): Promise<void> {
    try {
      await this.provider.send({ to, subject, html, text });
    } catch (err) {
      this.logger.error("Failed to send email", err as Error);
      throw new Error("Email delivery failed");
    }
  }

  /** "Send test email to myself" from the admin template editor — renders
   *  with the registry's sample data and sends immediately (not queued), so
   *  the admin gets instant feedback rather than waiting on a worker. */
  async sendTestEmail(key: string, to: string): Promise<void> {
    const { subject, html, text } = await this.templates.preview(key);
    await this.deliver(to, `[Test] ${subject}`, html, text);
  }

  /** Called by MailProcessor to actually render + send a queued job. Not
   *  part of the public "sendXxx" surface other modules call. */
  async deliverTemplate(
    key: string,
    to: string,
    vars: Record<string, unknown>,
    opts: { ctaHref?: string; protectedHtml?: string; attachments?: MailAttachment[] },
  ): Promise<{ subject: string }> {
    const { subject, html, text } = await this.templates.render(key, vars, opts);
    try {
      await this.provider.send({
        to,
        subject,
        html,
        text,
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.contentBase64, "base64"),
          contentType: a.contentType,
        })),
      });
    } catch (err) {
      this.logger.error(`Failed to send "${key}" email`, err as Error);
      throw err;
    }
    return { subject };
  }
}
