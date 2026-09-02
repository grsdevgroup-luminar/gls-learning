import { Injectable, Logger } from "@nestjs/common";
import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from "./email-provider";

/**
 * No-op adapter used when `EMAIL_DRIVER=log` or when running without
 * provider credentials (dev, CI). Logs the outbound envelope instead of
 * sending, so template call-sites still exercise their code paths.
 */
@Injectable()
export class LogProvider implements EmailProvider {
  private readonly logger = new Logger("EmailProvider:log");

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const to = Array.isArray(input.to) ? input.to.join(", ") : input.to;
    this.logger.log(`[DEV EMAIL] to=${to} subject=${JSON.stringify(input.subject)}`);
    return { id: undefined };
  }
}
