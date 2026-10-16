import {
  COUNTRIES as sharedCountries,
  ISO_COUNTRY_CODES,
  isIsoCountryCode,
  nameFor as sharedNameFor,
  flagFor as sharedFlagFor,
  tenderFor as sharedTenderFor,
} from "@grslearning/shared";

export type { Country } from "@grslearning/shared";

/** UI + API country list — requires a built `@grslearning/shared` dist. */
export const COUNTRIES = sharedCountries ?? [];

export { ISO_COUNTRY_CODES, isIsoCountryCode };

if (COUNTRIES.length === 0 && process.env.NODE_ENV !== "production") {
  console.error(
    "[countries] COUNTRIES is empty — run `pnpm --filter @grslearning/shared build`",
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
export const tenderFor = sharedTenderFor;
