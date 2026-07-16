import type { ProblemDetail } from "@skillstream/shared";
import { ApiError } from "./errors";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

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
    !path.startsWith("/auth/refresh") &&
    (await refreshSession())
  ) {
    res = await send();
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
