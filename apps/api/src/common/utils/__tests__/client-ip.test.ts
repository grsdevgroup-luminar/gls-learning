import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { clientIp, isPrivateOrLocalIp } from "../client-ip";

const req = (headers: Record<string, string>, ip?: string): Request =>
  ({
    headers,
    ip,
    socket: { remoteAddress: ip },
  }) as Request;

describe("isPrivateOrLocalIp", () => {
  it("detects loopback and RFC1918", () => {
    expect(isPrivateOrLocalIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalIp("10.0.0.5")).toBe(true);
    expect(isPrivateOrLocalIp("192.168.1.2")).toBe(true);
    expect(isPrivateOrLocalIp("8.8.8.8")).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers Cloudflare connecting IP", () => {
    expect(
      clientIp(req({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" })),
    ).toBe("1.2.3.4");
  });

  it("prefers x-real-ip over X-Forwarded-For (Next rewrite hop)", () => {
    expect(
      clientIp(
        req({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "10.0.0.1, 9.9.9.9" }),
      ),
    ).toBe("1.2.3.4");
  });

  it("skips private X-Forwarded-For hops", () => {
    expect(clientIp(req({ "x-forwarded-for": "10.1.2.3, 1.2.3.4" }))).toBe(
      "1.2.3.4",
    );
  });

  it("falls back to the first public X-Forwarded-For hop", () => {
    expect(clientIp(req({ "x-forwarded-for": " 1.2.3.4 , 9.9.9.9" }))).toBe(
      "1.2.3.4",
    );
  });

  it("normalizes IPv4-mapped IPv6", () => {
    expect(clientIp(req({}, "::ffff:203.0.113.10"))).toBe("203.0.113.10");
  });
});
