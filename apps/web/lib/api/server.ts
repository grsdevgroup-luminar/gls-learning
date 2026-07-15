import "server-only";
import { cookies } from "next/headers";
import { apiFetch, type ApiRequestOptions } from "./client";
import { ApiError } from "./errors";

/**
 * Server-side API fetch for Server Components / Server Functions. Forwards the
 * incoming request's cookies so the API sees the authenticated session.
 * Reads are uncached by default (auth-dependent, per-request data).
 */
export async function serverApi<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const cookieStore = await cookies();
  return apiFetch<T>(path, {
    ...options,
    cookieHeader: cookieStore.toString(),
    cache: options.cache ?? "no-store",
  });
}

/** serverApi that returns null on 401/403/404 instead of throwing — handy for
 *  optional data (e.g. "am I enrolled?", "my review"). */
export async function serverApiOptional<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T | null> {
  try {
    return await serverApi<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && [401, 403, 404].includes(err.status))
      return null;
    throw err;
  }
}
