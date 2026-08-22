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

function normalizeIp(raw: string): string {
  const ip = raw.trim();
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function firstPublicHop(header: string | string[] | undefined): string | null {
  if (typeof header !== "string" || !header.trim()) return null;
  for (const hop of header.split(",")) {
    const ip = normalizeIp(hop);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }
  return null;
}

/**
 * Best-effort client IP for geo checks. Prefers edge-provided headers when the
 * API sits behind a reverse proxy (trust proxy is enabled in main.ts).
 *
 * Browser calls go Next.js (`/api` rewrite) → this API, so `req.socket` is
 * Railway/the web service. The web proxy copies the edge client IP onto
 * `x-real-ip` before the rewrite.
 */
export function clientIp(req: Request): string | null {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) {
    const ip = normalizeIp(cf);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }

  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) {
    const ip = normalizeIp(real);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }

  const fromXff = firstPublicHop(req.headers["x-forwarded-for"]);
  if (fromXff) return fromXff;

  const direct = req.ip ?? req.socket?.remoteAddress ?? null;
  if (!direct) return null;
  const ip = normalizeIp(direct);
  return ip && !isPrivateOrLocalIp(ip) ? ip : null;
}
