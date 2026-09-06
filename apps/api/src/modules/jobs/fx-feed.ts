/** Shared parse of the USD-base FX feed used by the daily job and admin lookup. */

export function isSaneFxRate(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 && rate < 100_000;
}

/** Display FX is USD → local; two decimal places is enough for the price hint. */
export function roundFxRate(rate: number): number {
  return Math.round(rate * 100) / 100;
}

export async function fetchUsdRates(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { result?: string; rates?: Record<string, unknown> };
  // open.er-api.com reports failure in the body with a 200 status.
  if (body.result && body.result !== "success") throw new Error(`feed result=${body.result}`);
  if (!body.rates || typeof body.rates !== "object") throw new Error("no rates in response");
  return body.rates;
}

/** USD is the base — never take the feed's USD quote. */
export function rateFromFeed(
  rates: Record<string, unknown>,
  currency: string,
): number | undefined {
  const code = currency.toUpperCase();
  if (code === "USD") return 1;
  const rate = rates[code];
  return isSaneFxRate(rate) ? roundFxRate(rate) : undefined;
}
