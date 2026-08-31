import {
  getCountryCallingCode,
  isSupportedCountry,
  isValidPhoneNumber,
} from "libphonenumber-js";

/**
 * "+880" for a supported ISO country, or undefined for the handful of
 * entries in our country list libphonenumber-js has no telecom metadata
 * for (uninhabited/no-dial-plan territories like Antarctica).
 */
export function callingCodeFor(country: string): string | undefined {
  const code = country.toUpperCase();
  if (!isSupportedCountry(code)) return undefined;
  return `+${getCountryCallingCode(code)}`;
}

/**
 * True if `phone` is a real, dialable E.164 number — length and pattern
 * checked against the calling code it starts with, not a generic regex.
 */
export function isValidPhone(phone: string): boolean {
  return isValidPhoneNumber(phone);
}
