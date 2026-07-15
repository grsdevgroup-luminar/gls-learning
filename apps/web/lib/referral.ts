/** Sales-agent referral attribution: `?ref=CODE` is captured on landing and
 *  attached to the next checkout so the agent earns commission server-side. */
const REF_KEY = "skillstream_ref_v1";

export function captureReferralFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem(REF_KEY, ref.trim().toUpperCase());
  } catch {
    /* ignore */
  }
}

export function getReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    /* ignore */
  }
}
