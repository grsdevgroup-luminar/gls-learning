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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const hasSession = request.cookies.has("refresh_token");
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
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
