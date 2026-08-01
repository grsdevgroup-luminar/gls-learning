// ---------------------------------------------------------------------------
// Regional / PPP pricing. Ported from the prototype's lib/mock/pricing.ts but
// operating on integer cents. Used authoritatively by the API at checkout and
// for preview by the frontend. Region rows themselves live in the DB
// (Region/PricingTier/CountryOverride) and are passed in here.
// ---------------------------------------------------------------------------

export interface RegionRow {
  code: string;
  country: string;
  flag: string;
  currency: string;
  symbol: string;
  locale: string;
  fxRate: number; // USD -> local conversion (display only)
  multiplier: number; // PPP/region discount applied to USD base price
  tierId: string;
  override?: boolean;
}

export const DEFAULT_REGION = "US";

/**
 * USD price (in cents) after the region/PPP discount. Rounded to the nearest
 * whole dollar minus 1 cent (".99") for full-price regions left untouched —
 * mirrors the prototype's `regionalUsd` rounding behaviour.
 */
export function regionalPriceCents(
  baseCents: number,
  region: Pick<RegionRow, "multiplier">,
): number {
  if (region.multiplier === 1) return baseCents;
  const raw = baseCents * region.multiplier;
  // floor to whole dollars, then add 99 cents — never below zero.
  const wholeDollars = Math.floor(raw / 100);
  return Math.max(0, wholeDollars * 100 + 99);
}

/** Format a USD cents amount in the region's local currency for display. */
export function formatLocal(
  usdCents: number,
  region: Pick<RegionRow, "symbol" | "fxRate">,
): string {
  const local = (usdCents / 100) * region.fxRate;
  const wholeUnits = local >= 1000 || region.fxRate >= 50;
  // Always format with en-US grouping to avoid SSR/CSR hydration mismatches —
  // Node's default ICU only guarantees full data for en-US.
  const numberStr = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: wholeUnits ? 0 : 2,
    maximumFractionDigits: wholeUnits ? 0 : 2,
  }).format(local);
  return `${region.symbol} ${numberStr}`;
}
