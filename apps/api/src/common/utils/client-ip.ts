import type { Request } from "express";

/** True for loopback and RFC1918 addresses — not geolocatable. */
export function isPrivateOrLocalIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127.")) {
    return true;
  }
  if (ip.includes(":")) {
    // Treat all IPv6 as non-local only when not loopback; skip link-local.
    return ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd");
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Best-effort client IP for geo checks. Prefers edge-provided headers when the
 * API sits behind a reverse proxy (trust proxy is enabled in main.ts).
 */
export function clientIp(req: Request): string | null {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) return cf.trim();

  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const direct = req.ip ?? req.socket?.remoteAddress ?? null;
  if (!direct) return null;
  // Express may format IPv4-mapped IPv6 as ::ffff:x.x.x.x
  return direct.startsWith("::ffff:") ? direct.slice(7) : direct;
}
