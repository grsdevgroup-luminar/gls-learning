import {
  COUNTRIES as sharedCountries,
  ISO_COUNTRY_CODES,
  isIsoCountryCode,
  nameFor as sharedNameFor,
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

/** Convert an ISO 3166-1 alpha-2 code to its flag emoji. */
export function flagFor(code: string): string {
  if (code.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.charCodeAt(0) - 65,
    A + code.charCodeAt(1) - 65,
  );
}
