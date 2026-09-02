import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { Env } from "../../../config/env";
import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from "./email-provider";

/**
 * Adapter for https://resend.com. Isolates the Resend SDK behind the
 * `EmailProvider` contract so the rest of the codebase never imports
 * `resend` directly. Swapping to SES / SMTP / Postmark = add a sibling
 * adapter and flip `EMAIL_DRIVER`.
 */
@Injectable()
export class ResendProvider implements EmailProvider {
  private readonly resend: Resend;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo?: string;
  private readonly logger = new Logger(ResendProvider.name);

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get("RESEND_API_KEY", { infer: true });
    if (!apiKey) {
      // Guarded by env.ts superRefine; defensive here in case that guard
      // is bypassed in a test harness.
      throw new Error("ResendProvider requires RESEND_API_KEY");
    }
    this.resend = new Resend(apiKey);
    this.defaultFrom = config.get("EMAIL_FROM", { infer: true });
    this.defaultReplyTo = config.get("EMAIL_REPLY_TO", { infer: true });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const from = input.from ?? `SkillStream <${this.defaultFrom}>`;
    const replyTo = input.replyTo ?? this.defaultReplyTo;

    const { data, error } = await this.resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo,
      headers: input.headers,
      tags: input.tags
        ? Object.entries(input.tags).map(([name, value]) => ({ name, value }))
        : undefined,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content)
          ? a.content.toString("base64")
          : a.content,
        contentType: a.contentType,
      })),
    });

    if (error) {
      this.logger.error(
        `Resend send failed: ${error.name ?? "unknown"} — ${error.message}`,
      );
      throw new Error(`Email delivery failed: ${error.message}`);
    }

    return { id: data?.id };
  }
}
