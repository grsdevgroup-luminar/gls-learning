export interface MailAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

/** Payload for the `mail` queue — the deferred half of every email that used
 *  to be sent inline in a request path (welcome, password reset, org invite,
 *  org admin credentials, receipts, admin alerts). `key` addresses the
 *  EMAIL_TEMPLATES registry entry; `vars` are the Liquid variables for it. */
export interface MailJobData {
  key: string;
  to: string;
  vars: Record<string, unknown>;
  ctaHref?: string;
  protectedHtml?: string;
  attachments?: MailAttachment[];
}
