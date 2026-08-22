import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16: "Proxy" is the renamed Middleware. Used here only for an
// optimistic auth gate — real authorization happens in the API + server
// components. We gate on the long-lived refresh_token cookie's presence.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/account",
  "/learn",
  "/admin",
  "/instructor",
  "/sales-agent",
  "/org",
];

type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN" | "SALES_AGENT" | "ORG_ADMIN";

// Role-portal prefixes → who may enter. ADMIN is treated as a superuser.
// /sales-agent is deliberately NOT here: it also hosts the apply form any
// logged-in user (of any role) submits before becoming a SALES_AGENT.
const ROLE_PREFIXES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/instructor", roles: ["INSTRUCTOR", "ADMIN"] },
  // Instructors can also be learners, so they may use the student dashboard
  // and progress pages without being redirected back to the instructor portal.
  { prefix: "/dashboard", roles: ["STUDENT", "INSTRUCTOR", "ORG_ADMIN"] },
];

const HOME: Record<Role, string> = {
  ADMIN: "/admin",
  INSTRUCTOR: "/instructor",
  SALES_AGENT: "/sales-agent",
  ORG_ADMIN: "/dashboard",
  STUDENT: "/dashboard",
};

/** Reads the `role` claim from the access-token JWT WITHOUT verifying it. Safe
 *  because this only drives an optimistic redirect — the API still enforces
 *  authorization. Returns null when the token is absent (expired) or unreadable,
 *  in which case we let the request through rather than guess. */
function roleFromToken(token: string | undefined): Role | null {
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.role === "string" ? (json.role as Role) : null;
  } catch {
    return null;
  }
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

/** Client IP as seen by the Railway/Vercel edge in front of Next.js. */
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

function withClientIp(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  const ip = edgeClientIp(request);
  if (ip) headers.set("x-real-ip", ip);
  return headers;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const headers = withClientIp(request);

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return NextResponse.next({ request: { headers } });
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next({ request: { headers } });

  const hasSession = request.cookies.has("refresh_token");
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role gate for the portal prefixes — only when the role is actually readable
  // this request (a fresh access token is present).
  const rule = ROLE_PREFIXES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  if (rule) {
    const role = roleFromToken(request.cookies.get("access_token")?.value);
    if (role && !rule.roles.includes(role)) {
      return NextResponse.redirect(new URL(HOME[role], request.url));
    }
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/account/:path*",
    "/learn/:path*",
    "/admin/:path*",
    "/instructor/:path*",
    "/sales-agent/:path*",
    "/org/:path*",
  ],
};
