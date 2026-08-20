import { isPrivateOrLocalIp } from "../../common/utils/client-ip";

export type GeoIpCheckoutBlockReason =
  | "vpn_detected"
  | "country_mismatch"
  | "missing_profile_country"
  | "location_unknown"
  | "verification_unavailable";

export type GeoIpCheckoutVerdict =
  | { allowed: true }
  | { allowed: false; reason: GeoIpCheckoutBlockReason };

export interface AnonymousIpFlags {
  isAnonymousVpn: boolean;
  isPublicProxy: boolean;
  isTorExitNode: boolean;
  isResidentialProxy: boolean;
}

export interface CheckoutGeoInput {
  enabled: boolean;
  nodeEnv: string;
  ip: string | null;
  profileCountry: string | null;
  geoCountry: string | null;
  anonymous: AnonymousIpFlags | null;
}

/** Pure checkout geo policy — easy to unit test without MaxMind files. */
export function evaluateCheckoutGeo(
  input: CheckoutGeoInput,
): GeoIpCheckoutVerdict {
  if (!input.enabled) return { allowed: true };

  if (!input.profileCountry?.trim()) {
    return { allowed: false, reason: "missing_profile_country" };
  }

  const ip = input.ip?.trim() ?? null;
  if (!ip || isPrivateOrLocalIp(ip)) {
    if (input.nodeEnv === "development") return { allowed: true };
    return { allowed: false, reason: "location_unknown" };
  }

  if (input.anonymous) {
    const { isAnonymousVpn, isPublicProxy, isTorExitNode, isResidentialProxy } =
      input.anonymous;
    if (
      isAnonymousVpn ||
      isPublicProxy ||
      isTorExitNode ||
      isResidentialProxy
    ) {
      return { allowed: false, reason: "vpn_detected" };
    }
  }

  const profile = input.profileCountry.trim().toUpperCase();
  const geo = input.geoCountry?.trim().toUpperCase() ?? null;
  if (!geo) return { allowed: false, reason: "location_unknown" };
  if (geo !== profile) return { allowed: false, reason: "country_mismatch" };

  return { allowed: true };
}

export const CHECKOUT_GEO_MESSAGES: Record<GeoIpCheckoutBlockReason, string> = {
  vpn_detected:
    "VPN detected. Please switch off your VPN and try again.",
  country_mismatch:
    "Your current location does not match the country on your account. Update your profile country or checkout from your home country.",
  missing_profile_country:
    "Add your country to your profile before checkout.",
  location_unknown:
    "We could not verify your location. Please try again from your home network.",
  verification_unavailable:
    "Location verification is temporarily unavailable. Please try again later.",
};
