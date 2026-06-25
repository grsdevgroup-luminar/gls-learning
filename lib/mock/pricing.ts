import type { PricingTier, CountryOverride } from "@/types";

// A region the storefront can price in. `multiplier` is the PPP/region discount
// applied to the USD base price; `fxRate` converts USD -> local for display.
export interface RegionRow {
  code: string;
  country: string;
  flag: string;
  currency: string;
  symbol: string;
  locale: string; // BCP-47 locale for correct currency grouping/symbol placement
  fxRate: number;
  multiplier: number;
  tierId: string;
  override?: boolean; // priced by a custom country override
}

export const pricingTiers: PricingTier[] = [
  {
    id: "t1",
    name: "Tier 1 — High income",
    multiplier: 1,
    countries: ["United States", "United Kingdom", "Germany", "Canada", "Australia", "Japan"],
  },
  {
    id: "t2",
    name: "Tier 2 — Middle income",
    multiplier: 0.7,
    countries: ["Brazil", "Mexico", "Turkey", "Thailand", "South Africa"],
  },
  {
    id: "t3",
    name: "Tier 3 — Emerging",
    multiplier: 0.45,
    countries: ["India", "Bangladesh", "Nigeria", "Pakistan", "Egypt"],
  },
];

// Custom per-country overrides the admin can set (beats the tier).
export const countryOverrides: CountryOverride[] = [
  { country: "Bangladesh", flag: "🇧🇩", type: "flat_percent", flatPercent: 30 },
  { country: "India", flag: "🇮🇳", type: "flat_percent", flatPercent: 35 },
];

export const regions: RegionRow[] = [
  { code: "US", country: "United States", flag: "🇺🇸", currency: "USD", symbol: "$", locale: "en-US", fxRate: 1, multiplier: 1, tierId: "t1" },
  { code: "GB", country: "United Kingdom", flag: "🇬🇧", currency: "GBP", symbol: "£", locale: "en-GB", fxRate: 0.79, multiplier: 1, tierId: "t1" },
  { code: "DE", country: "Germany", flag: "🇩🇪", currency: "EUR", symbol: "€", locale: "de-DE", fxRate: 0.92, multiplier: 1, tierId: "t1" },
  { code: "CA", country: "Canada", flag: "🇨🇦", currency: "CAD", symbol: "C$", locale: "en-CA", fxRate: 1.37, multiplier: 1, tierId: "t1" },
  { code: "AU", country: "Australia", flag: "🇦🇺", currency: "AUD", symbol: "A$", locale: "en-AU", fxRate: 1.51, multiplier: 1, tierId: "t1" },
  { code: "BR", country: "Brazil", flag: "🇧🇷", currency: "BRL", symbol: "R$", locale: "pt-BR", fxRate: 5.42, multiplier: 0.7, tierId: "t2" },
  { code: "MX", country: "Mexico", flag: "🇲🇽", currency: "MXN", symbol: "MX$", locale: "es-MX", fxRate: 17.1, multiplier: 0.7, tierId: "t2" },
  { code: "TR", country: "Turkey", flag: "🇹🇷", currency: "TRY", symbol: "₺", locale: "tr-TR", fxRate: 32.5, multiplier: 0.7, tierId: "t2" },
  { code: "ZA", country: "South Africa", flag: "🇿🇦", currency: "ZAR", symbol: "R", locale: "en-ZA", fxRate: 18.4, multiplier: 0.7, tierId: "t2" },
  { code: "IN", country: "India", flag: "🇮🇳", currency: "INR", symbol: "₹", locale: "en-IN", fxRate: 83.2, multiplier: 0.35, tierId: "t3", override: true },
  { code: "BD", country: "Bangladesh", flag: "🇧🇩", currency: "BDT", symbol: "৳", locale: "bn-BD", fxRate: 117, multiplier: 0.3, tierId: "t3", override: true },
  { code: "NG", country: "Nigeria", flag: "🇳🇬", currency: "NGN", symbol: "₦", locale: "en-NG", fxRate: 1480, multiplier: 0.45, tierId: "t3" },
];

export const DEFAULT_REGION = "US";

export function getRegion(code: string): RegionRow {
  return regions.find((r) => r.code === code) ?? regions[0];
}

// USD price after region/PPP discount (rounded to .99 for nicer display)
export function regionalUsd(basePrice: number, region: RegionRow): number {
  const raw = basePrice * region.multiplier;
  if (region.multiplier === 1) return basePrice;
  return Math.max(0, Math.floor(raw) + 0.99);
}

export function formatLocal(usd: number, region: RegionRow): string {
  const local = usd * region.fxRate;
  // Round whole units for low-value currencies so we don't show misleading
  // sub-unit precision on FX-converted prices.
  const wholeUnits = local >= 1000 || region.fxRate >= 50;
  // Always format the number with the "en-US" locale: Node's default ICU
  // build only ships full grouping/decimal data for en-US, while browsers
  // ship full ICU for every locale. Formatting with `region.locale` here
  // would render differently on the server vs. the client (e.g. "1,306" vs
  // "1 306" for en-ZA) and trigger a hydration mismatch. en-US grouping is
  // guaranteed identical in both environments.
  const numberStr = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: wholeUnits ? 0 : 2,
    maximumFractionDigits: wholeUnits ? 0 : 2,
  }).format(local);
  return `${region.symbol} ${numberStr}`;
}
