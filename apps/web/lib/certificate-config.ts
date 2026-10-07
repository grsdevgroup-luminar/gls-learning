/**
 * Certificate branding is intentionally centralized here so the temporary
 * GRS Learning values can be replaced without editing the certificate layout.
 * Set these in the web app environment when the final domain and mailbox are
 * approved.
 */
const configuredBaseUrl =
  process.env.NEXT_PUBLIC_CERTIFICATE_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const CERTIFICATE_WEBSITE = configuredBaseUrl || "https://grslearning.com";
export const CERTIFICATE_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CERTIFICATE_CONTACT_EMAIL?.trim() ||
  "training@grslearning.com";

export function certificateVerificationUrl(serial: string): string {
  const baseUrl =
    configuredBaseUrl ||
    (typeof window !== "undefined" ? window.location.origin : CERTIFICATE_WEBSITE);
  return `${baseUrl.replace(/\/+$/, "")}/verify/${encodeURIComponent(serial)}`;
}
