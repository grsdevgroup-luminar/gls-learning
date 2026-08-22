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
  for (const cookie of cookies) {
    res.headers.append("set-cookie", cookie);
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
