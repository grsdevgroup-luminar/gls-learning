/**
 * Transport-only contract for outbound email. `EmailService` speaks this
 * interface; concrete adapters (Resend, SES, SMTP, …) translate to the
 * vendor SDK. Swapping providers = add one adapter + flip `EMAIL_DRIVER`,
 * with no caller-side changes.
 */

export interface EmailAttachment {
  filename: string;
  /** Raw bytes or already-base64 string. Adapters normalize as needed. */
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailInput {
  to: string | string[];
  /** Overrides the configured default `from`. */
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  /** Provider tags/metadata; adapters MAY ignore. */
  tags?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  /** Provider message id when available. */
  id?: string;
}

export interface EmailProvider {
  /** Sends the email. Throws `Error` on transport failure. */
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");
