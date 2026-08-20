export {
  COUNTRIES,
  ISO_COUNTRY_CODES,
  isIsoCountryCode,
  nameFor,
} from "@skillstream/shared";
export type { Country } from "@skillstream/shared";

import { nameFor as sharedNameFor } from "@skillstream/shared";

/** Human-readable country label for a stored code; falls back to the raw value. */
export function formatCountry(code: string | null | undefined): string {
  if (!code) return "—";
  return sharedNameFor(code) ?? code;
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
