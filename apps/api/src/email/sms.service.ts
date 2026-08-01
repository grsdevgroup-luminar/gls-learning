import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";

/** E.164: a leading `+`, then 8–15 digits. Twilio rejects anything else. */
export const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * SMS delivery via Twilio's REST API. Called over plain `fetch` rather than
 * the Twilio SDK: this is one form-encoded POST, and the SDK would be a
 * multi-megabyte dependency for it.
 *
 * Unconfigured (no credentials) it logs instead of sending — the same
 * fail-soft contract EmailService has without a Resend key, so local and CI
 * runs work without a provider account.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly accountSid?: string;
  private readonly authToken?: string;
  private readonly from?: string;

  constructor(config: ConfigService<Env, true>) {
    this.accountSid = config.get("TWILIO_ACCOUNT_SID", { infer: true });
    this.authToken = config.get("TWILIO_AUTH_TOKEN", { infer: true });
    this.from = config.get("TWILIO_FROM_NUMBER", { infer: true });

    if (!this.configured)
      this.logger.warn(
        "Twilio not configured — SMS will be logged instead of sent",
      );
  }

  private get configured(): boolean {
    return !!(this.accountSid && this.authToken && this.from);
  }

  /**
   * Sends one message. Returns false when there was nothing to send to (no
   * number, or a number Twilio would reject) so the caller can record the
   * reminder as skipped rather than retrying forever; throws on a genuine
   * delivery failure so BullMQ retries it.
   */
  async send(to: string | null | undefined, body: string): Promise<boolean> {
    if (!to || !E164.test(to)) {
      this.logger.log(`SMS skipped — no usable phone number (${to ?? "none"})`);
      return false;
    }
    if (!this.configured) {
      this.logger.log(`[DEV] SMS to ${to}: ${body}`);
      return true;
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: this.from!,
          // Twilio segments at 160 GSM-7 chars; keep one segment per reminder.
          Body: body.length > 160 ? `${body.slice(0, 157)}...` : body,
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      this.logger.error(`Twilio send failed (${res.status}): ${detail.slice(0, 200)}`);
      throw new Error("SMS delivery failed");
    }
    return true;
  }
}
