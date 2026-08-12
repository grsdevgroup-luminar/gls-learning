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

/**
 * Inverts `regionalPriceCents`: given a bound expressed in *regional*
 * (already-discounted) USD cents — e.g. a catalog price-filter label like
 * "under $30" — returns the equivalent bound in *raw* `basePriceCents` terms.
 *
 * Needed because course prices are stored and filtered in raw USD, but a
 * price filter's label refers to the discounted price a viewer in that
 * region actually sees on the card. Filtering raw cents directly against a
 * regional-dollar bound silently mismatches the two — a course showing
 * "$22.99" on screen can fail an "under $30" filter because its undiscounted
 * price is $64.99. `edge` picks which side of the bucket this bound is:
 * `"max"` widens the raw ceiling enough to admit every course that would
 * round to at or under the bound after discount; `"min"` raises the raw
 * floor to exclude everything that would round below it.
 */
export function rawPriceCentsForRegionalBound(
  regionalBoundCents: number,
  region: Pick<RegionRow, "multiplier">,
  edge: "max" | "min",
): number {
  const m = region.multiplier;
  if (m === 1) return regionalBoundCents;
  if (edge === "max") {
    // Largest whole-dollar bucket (the ".99" rounding step) still <= bound.
    const bucket = Math.floor((regionalBoundCents - 99) / 100);
    return Math.ceil(((bucket + 1) * 100) / m) - 1;
  }
  // Smallest whole-dollar bucket still >= bound.
  const bucket = Math.ceil((regionalBoundCents - 99) / 100);
  return Math.ceil((bucket * 100) / m);
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
