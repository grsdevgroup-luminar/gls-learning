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
 * Core fetch wrapper used by both the browser and server clients. Always sends
 * credentials so the httpOnly auth cookies travel with the request. Parses
 * problem-detail errors into ApiError.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, cookieHeader, headers, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
