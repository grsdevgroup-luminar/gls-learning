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

/**
 * Cached, cookie-free fetch for public data that's safe to share across every
 * visitor (course listings/detail, categories) — pairs with a page's
 * `export const revalidate = N` for on-demand ISR. Unlike `serverApi`, this
 * never forwards cookies, so the shared cache entry isn't fragmented per
 * session for a response that doesn't actually vary by viewer.
 */
export async function serverApiCached<T>(
  path: string,
  revalidateSeconds: number,
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiFetch<T>(path, { ...options, next: { revalidate: revalidateSeconds } });
}

/** serverApiCached that returns null on 404 instead of throwing. */
export async function serverApiCachedOptional<T>(
  path: string,
  revalidateSeconds: number,
  options: ApiRequestOptions = {},
): Promise<T | null> {
  try {
    return await serverApiCached<T>(path, revalidateSeconds, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
