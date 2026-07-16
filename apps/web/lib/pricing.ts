// Region pricing for the storefront. The region rows themselves come from the
// API (`GET /pricing/regions` via the store) so admin edits and the daily FX
// refresh reach customers; the math lives in `@skillstream/shared` so preview
// here and the authoritative re-price at checkout can't drift apart.
//
// Shared works in integer cents; the legacy storefront types carry dollars.
// These wrappers bridge that at the call site rather than reworking every page.

import {
  formatLocal as formatLocalCents,
  regionalPriceCents,
  toCents,
  toDollars,
  type RegionRow,
} from "@skillstream/shared";

export { DEFAULT_REGION, type RegionRow } from "@skillstream/shared";

/**
 * Region used before the API responds, and if it's unreachable. Full price in
 * USD: the fallback must never invent a discount the server won't honour at
 * checkout.
 */
export const FALLBACK_REGION: RegionRow = {
  code: "US",
  country: "United States",
  flag: "🇺🇸",
  currency: "USD",
  symbol: "$",
  locale: "en-US",
  fxRate: 1,
  multiplier: 1,
  tierId: "t1",
};

/** USD price (dollars) after the region/PPP discount. */
export function regionalUsd(basePrice: number, region: Pick<RegionRow, "multiplier">): number {
  return toDollars(regionalPriceCents(toCents(basePrice), region));
}

/** Approximate local-currency rendering of a USD dollar amount. */
export function formatLocal(usd: number, region: Pick<RegionRow, "symbol" | "fxRate">): string {
  return formatLocalCents(toCents(usd), region);
}
