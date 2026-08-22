import { describe, expect, it } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { Env } from "../../../config/env";
import { GeoIpService } from "../geoip.service";

function configStub(values: Partial<Record<keyof Env, unknown>>) {
  return {
    get: (key: keyof Env) => values[key],
  } as ConfigService<Env, true>;
}

describe("GeoIpService", () => {
  it("rejects checkout when enabled but the country database is not loaded", () => {
    const service = new GeoIpService(
      configStub({
        GEOIP_CHECKOUT_ENABLED: true,
        NODE_ENV: "production",
      }),
    );

    expect(service.verifyCheckout("203.0.113.10", "US")).toEqual({
      allowed: false,
      reason: "verification_unavailable",
    });
  });

  it("allows checkout when geo verification is disabled", () => {
    const service = new GeoIpService(
      configStub({
        GEOIP_CHECKOUT_ENABLED: false,
        NODE_ENV: "production",
      }),
    );

    expect(service.verifyCheckout("203.0.113.10", "US")).toEqual({
      allowed: true,
    });
  });
});
