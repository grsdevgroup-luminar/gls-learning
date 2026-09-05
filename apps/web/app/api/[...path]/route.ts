import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const AUTH_COOKIE_NAMES = new Set(["access_token", "refresh_token"]);

/**
 * The API response is exposed through this browser-origin proxy. A Domain
 * attribute emitted for the API host (or a shared parent domain) can otherwise
 * leave the browser holding a cookie that the web host cannot reliably clear.
 * Auth cookies are intentionally host-only at the browser-facing origin.
 */
function browserCookie(setCookie: string): string {
  const name = setCookie.slice(0, setCookie.indexOf("="));
  if (!AUTH_COOKIE_NAMES.has(name)) return setCookie;
  return setCookie
    .split(";")
    .filter((part, index) => index === 0 || !/^\s*domain\s*=/i.test(part))
    .join(";");
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127.")) {
    return true;
  }
  if (ip.includes(":")) {
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

/** IP of the browser as seen by Railway in front of Next.js — not the web service egress. */
function edgeClientIp(request: NextRequest): string | null {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) {
    const ip = normalizeIp(cf);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    for (const hop of xff.split(",")) {
      const ip = normalizeIp(hop);
      if (ip && !isPrivateOrLocalIp(ip)) return ip;
    }
  }

  const real = request.headers.get("x-real-ip")?.trim();
  if (real) {
    const ip = normalizeIp(real);
    if (ip && !isPrivateOrLocalIp(ip)) return ip;
  }

  return null;
}

async function proxyToApi(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const dest = `${API_ORIGIN}/api/${path.join("/")}${incoming.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const ip = edgeClientIp(request);
  if (path.join("/") === "checkout/session") {
    const incoming: string[] = [];
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === "cookie" || lower === "authorization") {
        incoming.push(`${key}=<redacted>`);
        return;
      }
      incoming.push(`${key}=${value}`);
    });
    console.log(
      `[api proxy] checkout/session edgeIp=${ip ?? "null"} dest=${dest} incoming ${incoming.join(" ")}`,
    );
  }
  if (ip) {
    headers.set("x-gls-client-ip", ip);
    headers.set("x-real-ip", ip);
    headers.set("x-forwarded-for", ip);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(dest, init);
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "content-encoding") return;
    if (lower === "set-cookie") return;
    out.set(key, value);
  });

  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });

  const cookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  const isLogout = path.join("/") === "auth/logout";
  for (const cookie of cookies) {
    // During logout, preserve the API's original Domain attribute as well as
    // the host-only fallback below. This removes cookies created by older
    // deployments before auth cookies were normalized at this proxy.
    res.headers.append("set-cookie", isLogout ? cookie : browserCookie(cookie));
  }

  // Logout must clear the cookies on the browser-facing origin. Do this after
  // forwarding the API headers so the proxy's deletion cannot be superseded
  // by another Set-Cookie header from the upstream response.
  if (isLogout) {
    const expires = new Date(0);
    res.cookies.set("access_token", "", {
      expires,
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
    });
    res.cookies.set("refresh_token", "", {
      expires,
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
    });
  }

  return res;
}

export const dynamic = "force-dynamic";

export const GET = proxyToApi;
export const POST = proxyToApi;
export const PUT = proxyToApi;
export const PATCH = proxyToApi;
export const DELETE = proxyToApi;
export const HEAD = proxyToApi;
export const OPTIONS = proxyToApi;
