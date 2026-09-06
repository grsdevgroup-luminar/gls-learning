import {
  COUNTRIES as sharedCountries,
  ISO_COUNTRY_CODES,
  isIsoCountryCode,
  nameFor as sharedNameFor,
  flagFor as sharedFlagFor,
} from "@skillstream/shared";

export type { Country } from "@skillstream/shared";

/** UI + API country list — requires a built `@skillstream/shared` dist. */
export const COUNTRIES = sharedCountries ?? [];

export { ISO_COUNTRY_CODES, isIsoCountryCode };

if (COUNTRIES.length === 0 && process.env.NODE_ENV !== "production") {
  console.error(
    "[countries] COUNTRIES is empty — run `pnpm --filter @skillstream/shared build`",
  );
}

/** Human-readable country label for a stored code; falls back to the raw value. */
export function formatCountry(code: string | null | undefined): string {
  if (!code) return "—";
  return sharedNameFor(code) ?? code;
}

export function nameFor(code: string): string | undefined {
  return sharedNameFor(code);
}

export const flagFor = sharedFlagFor;
