import { describe, expect, it } from "vitest";
import { evaluateCheckoutGeo } from "../geoip-checkout";

const base = {
  enabled: true,
  nodeEnv: "production" as const,
  ip: "203.0.113.10",
  profileCountry: "BD",
  geoCountry: "BD",
  anonymous: null,
};

describe("evaluateCheckoutGeo", () => {
  it("allows when checks are disabled", () => {
    expect(
      evaluateCheckoutGeo({ ...base, enabled: false, geoCountry: "US" }),
    ).toEqual({ allowed: true });
  });

  it("blocks VPN/proxy connections", () => {
    expect(
      evaluateCheckoutGeo({
        ...base,
        anonymous: {
          isAnonymousVpn: true,
          isPublicProxy: false,
          isTorExitNode: false,
          isResidentialProxy: false,
        },
      }),
    ).toEqual({ allowed: false, reason: "vpn_detected" });
  });

  it("blocks when geo country differs from profile", () => {
    expect(
      evaluateCheckoutGeo({ ...base, geoCountry: "US" }),
    ).toEqual({ allowed: false, reason: "country_mismatch" });
  });

  it("allows a matching non-VPN connection", () => {
    expect(evaluateCheckoutGeo(base)).toEqual({ allowed: true });
  });

  it("skips private IPs in development", () => {
    expect(
      evaluateCheckoutGeo({
        ...base,
        nodeEnv: "development",
        ip: "127.0.0.1",
        geoCountry: null,
      }),
    ).toEqual({ allowed: true });
  });
});
