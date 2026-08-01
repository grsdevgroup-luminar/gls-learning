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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next();

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/learn/:path*",
    "/admin/:path*",
    "/instructor/:path*",
    "/sales-agent/:path*",
    "/org/:path*",
  ],
};
