import type { ProblemDetail } from "@skillstream/shared";
import { ApiError } from "./errors";

const BROWSER_BASE = "/api";
const SERVER_BASE = process.env.API_ORIGIN
  ? `${process.env.API_ORIGIN}/api`
  : "http://localhost:4000/api";
const BASE_URL = typeof window === "undefined" ? SERVER_BASE : BROWSER_BASE;

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Extra cookies to forward (server-side SSR fetches set this). */
  cookieHeader?: string;
}

/**
 * Single-flight refresh: the 15-minute access-token cookie expires long before
 * the 7-day refresh cookie, so browser calls hit 401 mid-session. This POSTs
 * /auth/refresh once and lets the Set-Cookie install a fresh access token.
 * Deduped module-wide so a burst of parallel 401s triggers ONE rotation —
 * refresh tokens are single-use, so N concurrent refreshes would invalidate
 * each other and log the user out.
 */
let refreshInFlight: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * When both access and refresh tokens are dead, every subsequent request 401s
 * with no way to recover in-page. The middleware only checks that the
 * refresh_token cookie *exists*, not that it's valid, so an expired-but-present
 * cookie sails past the proxy and lands here. Bounce the browser to /login with
 * a `next` param so they land back where they were after signing in. Skipped
 * for the auth endpoints themselves (would loop) and when already on /login.
 */
let redirectingToLogin = false;
function redirectToLogin(): void {
  if (typeof window === "undefined" || redirectingToLogin) return;
  const { pathname, search } = window.location;
  if (pathname === "/login" || pathname.startsWith("/login/")) return;
  redirectingToLogin = true;
  const next = encodeURIComponent(`${pathname}${search}`);
  window.location.assign(`/login?next=${next}`);
}

function isAuthPath(path: string): boolean {
  return (
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/logout") ||
    path.startsWith("/auth/me")
  );
}

/**
 * Core fetch wrapper used by both the browser and server clients. Always sends
 * credentials so the httpOnly auth cookies travel with the request. Parses
 * problem-detail errors into ApiError. On a browser 401 it transparently
 * refreshes the session once and retries (SSR calls carry cookieHeader and are
 * skipped — a Server Component can't persist rotated cookies mid-render).
 */
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, cookieHeader, headers, ...rest } = options;
  const send = () =>
    fetch(`${BASE_URL}${path}`, {
      ...rest,
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await send();
  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    !cookieHeader &&
    !path.startsWith("/auth/refresh")
  ) {
    if (await refreshSession()) {
      res = await send();
    }
    if (res.status === 401 && !isAuthPath(path)) {
      redirectToLogin();
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const problem = data as ProblemDetail | null;
    throw new ApiError(
      res.status,
      problem,
      problem?.message
        ? Array.isArray(problem.message)
          ? problem.message.join(", ")
          : problem.message
        : res.statusText,
    );
  }

  return data as T;
}

/** Absolute URL for an API path — for links the browser navigates to directly
 *  (PDFs, downloads) rather than fetches. */
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/**
 * Multipart upload wrapper. Uses the same 401-retry dance as apiFetch but lets
 * the browser set the multipart boundary in Content-Type — hard-coding it here
 * would strip the `boundary=...` suffix and every request would 400.
 */
export async function apiFetchMultipart<T>(
  path: string,
  formData: FormData,
  init: Omit<RequestInit, "body" | "headers"> = {},
): Promise<T> {
  const send = () =>
    fetch(`${BASE_URL}${path}`, {
      ...init,
      method: init.method ?? "POST",
      credentials: "include",
      body: formData,
    });

  let res = await send();
  if (
    res.status === 401 &&
    typeof window !== "undefined" &&
    !path.startsWith("/auth/refresh")
  ) {
    if (await refreshSession()) {
      res = await send();
    }
    if (res.status === 401 && !isAuthPath(path)) {
      redirectToLogin();
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const problem = data as ProblemDetail | null;
    throw new ApiError(
      res.status,
      problem,
      problem?.message
        ? Array.isArray(problem.message)
          ? problem.message.join(", ")
          : problem.message
        : res.statusText,
    );
  }
  return data as T;
}

/**
 * Downloads a cookie-authenticated file. A plain <a href> would work only while
 * the API stays same-site; fetching with credentials and handing the browser a
 * blob works regardless, and surfaces API errors instead of rendering a JSON
 * error page in a new tab.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const send = () => fetch(`${BASE_URL}${path}`, { credentials: "include" });
  let res = await send();
  if (res.status === 401 && typeof window !== "undefined") {
    if (await refreshSession()) {
      res = await send();
    }
    if (res.status === 401) {
      redirectToLogin();
    }
  }
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as ProblemDetail | null;
    throw new ApiError(res.status, problem, problem?.message?.toString() ?? res.statusText);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
