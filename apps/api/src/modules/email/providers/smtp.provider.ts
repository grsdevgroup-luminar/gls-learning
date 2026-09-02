import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";
import type { Env } from "../../../config/env";
import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from "./email-provider";

/**
 * Generic SMTP adapter (nodemailer). Primary use in this project is local
 * development against Mailpit (docker-compose service `mailpit`, SMTP on
 * :1025, web UI on :8025). Same adapter can point at any SMTP relay in
 * staging — production keeps using the Resend adapter.
 */
@Injectable()
export class SmtpProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo?: string;
  private readonly logger = new Logger(SmtpProvider.name);

  constructor(config: ConfigService<Env, true>) {
    const host = config.get("SMTP_HOST", { infer: true });
    const port = config.get("SMTP_PORT", { infer: true });
    const secure = config.get("SMTP_SECURE", { infer: true });
    const user = config.get("SMTP_USER", { infer: true });
    const pass = config.get("SMTP_PASS", { infer: true });

    if (!host) {
      // Guarded by env.ts superRefine; defensive here in case that guard
      // is bypassed in a test harness.
      throw new Error("SmtpProvider requires SMTP_HOST");
    }

    this.transporter = createTransport({
      host,
      port,
      secure: secure ?? false,
      auth: user ? { user, pass: pass ?? "" } : undefined,
    });

    this.defaultFrom = config.get("EMAIL_FROM", { infer: true });
    this.defaultReplyTo = config.get("EMAIL_REPLY_TO", { infer: true });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const from = input.from ?? `SkillStream <${this.defaultFrom}>`;
    const replyTo = input.replyTo ?? this.defaultReplyTo;

    try {
      const info = await this.transporter.sendMail({
        from,
        to: input.to,
        replyTo,
        subject: input.subject,
        html: input.html,
        text: input.text,
        headers: input.headers,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      return { id: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP send failed: ${message}`);
      throw new Error(`Email delivery failed: ${message}`);
    }
  }
}
