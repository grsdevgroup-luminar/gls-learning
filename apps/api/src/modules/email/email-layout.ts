/** The one HTML shell every SkillStream email renders inside — replaces what
 *  used to be six near-identical private methods on EmailService. Only
 *  `headline`/`bodyHtml`/`cta*` are admin-editable content; the chrome around
 *  them (header, footer, button styling) is fixed. */
export interface EmailLayoutInput {
  /** Already HTML-safe — Liquid's autoescape covers the templated path
   *  (EmailTemplatesService.compose); any other caller must escape its own
   *  raw input before passing it here, same as `bodyHtml`. */
  headline: string;
  /** Already-safe HTML (the caller is responsible for escaping/rendering). */
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Structural, non-editable content appended after `bodyHtml` — e.g. a
   *  credentials box that must always show the real account details
   *  regardless of what an admin writes in the template. */
  protectedHtml?: string;
  footerNote?: string;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderEmailLayout({
  headline,
  bodyHtml,
  ctaLabel,
  ctaHref,
  protectedHtml,
  footerNote,
}: EmailLayoutInput): string {
  const cta =
    ctaLabel && ctaHref
      ? `<a href="${ctaHref}" style="display:inline-block;margin-top:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none">${escapeHtml(ctaLabel)}</a>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${headline}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;margin:0;padding:0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center">
          <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">SkillStream</span>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">${headline}</h1>
          <div style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6">${bodyHtml}</div>
          ${protectedHtml ?? ""}
          ${cta}
          ${footerNote ? `<p style="margin:24px 0 0;color:#9ca3af;font-size:13px">${footerNote}</p>` : ""}
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

/** Structural credential box for `org_admin_credentials` — never admin-editable,
 *  since it must always reflect the real generated account. */
export function credentialsBoxHtml(email: string, tempPassword: string): string {
  return `<table width="100%" style="background:#f9fafb;border-radius:8px;margin:16px 0 24px">
    <tr><td style="padding:16px 20px">
      <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em">Email</p>
      <p style="margin:0 0 14px;color:#111827;font-size:15px;font-weight:600">${escapeHtml(email)}</p>
      <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em">Temporary password</p>
      <p style="margin:0;color:#111827;font-size:16px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(tempPassword)}</p>
    </td></tr>
  </table>`;
}
