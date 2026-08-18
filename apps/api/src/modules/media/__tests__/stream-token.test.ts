import { describe, it, expect, beforeAll } from "vitest";
import {
  createVerify,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";
import { ipAccessRules, signStreamToken } from "../media.service";

// A throwaway RSA keypair stands in for Cloudflare's signing key.
let pem: string;
let publicKey: KeyObject;

beforeAll(() => {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  pem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  publicKey = pair.publicKey;
});

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, "base64url").toString());

describe("signStreamToken", () => {
  const now = new Date("2026-07-16T00:00:00Z");

  it("produces a three-part JWT whose signature verifies", () => {
    const token = signStreamToken("vid_123", "key_abc", pem, undefined, now);
    const [header, payload, sig] = token.split(".");
    expect(token.split(".")).toHaveLength(3);

    const ok = createVerify("RSA-SHA256")
      .update(`${header}.${payload}`)
      .verify(publicKey, sig, "base64url");
    expect(ok).toBe(true);
  });

  it("binds the token to the video uid and key id", () => {
    const [header, payload] = signStreamToken("vid_123", "key_abc", pem, undefined, now)
      .split(".");
    expect(decode(header)).toMatchObject({ alg: "RS256", kid: "key_abc" });
    expect(decode(payload)).toMatchObject({ sub: "vid_123", kid: "key_abc" });
  });

  it("blocks download and bounds the validity window", () => {
    const iat = Math.floor(now.getTime() / 1000);
    const claims = decode(signStreamToken("vid_123", "key_abc", pem, undefined, now).split(".")[1]);
    expect(claims.downloadable).toBe(false);
    expect(claims.nbf).toBeLessThanOrEqual(iat);
    expect(claims.exp).toBe(iat + 2 * 60 * 60);
  });

  it("binds accessRules to the requester's /24 when the IP is a parseable IPv4", () => {
    const claims = decode(
      signStreamToken("vid_123", "key_abc", pem, "203.0.113.42", now).split(".")[1],
    );
    expect(claims.accessRules).toEqual([
      { type: "ip.src", action: "allow", ip: ["203.0.113.0/24"] },
      { type: "any", action: "block" },
    ]);
  });

  it("omits accessRules when the IP is missing or unparseable (IPv6, fail open)", () => {
    const withoutIp = decode(signStreamToken("vid_123", "key_abc", pem, undefined, now).split(".")[1]);
    const withIpv6 = decode(
      signStreamToken("vid_123", "key_abc", pem, "2001:db8::1", now).split(".")[1],
    );
    expect(withoutIp.accessRules).toBeUndefined();
    expect(withIpv6.accessRules).toBeUndefined();
  });

  it("tampering with the payload breaks verification", () => {
    const [header, , sig] = signStreamToken("vid_123", "key_abc", pem, undefined, now).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "other" })).toString("base64url");
    const ok = createVerify("RSA-SHA256")
      .update(`${header}.${forged}`)
      .verify(publicKey, sig, "base64url");
    expect(ok).toBe(false);
  });
});

describe("ipAccessRules", () => {
  it("masks an IPv4 address to its /24", () => {
    expect(ipAccessRules("203.0.113.42")).toEqual([
      { type: "ip.src", action: "allow", ip: ["203.0.113.0/24"] },
      { type: "any", action: "block" },
    ]);
  });

  it("returns undefined for IPv6, malformed input, and undefined", () => {
    expect(ipAccessRules("2001:db8::1")).toBeUndefined();
    expect(ipAccessRules("not-an-ip")).toBeUndefined();
    expect(ipAccessRules(undefined)).toBeUndefined();
  });

  // Regression: confirmed live against a real dev server that Node's
  // dual-stack listener reports IPv4 clients this way — a plain IPv4 regex
  // silently never matches a real request without this normalization.
  it("strips the IPv4-mapped IPv6 prefix Node actually reports for real clients", () => {
    expect(ipAccessRules("::ffff:192.168.0.106")).toEqual([
      { type: "ip.src", action: "allow", ip: ["192.168.0.0/24"] },
      { type: "any", action: "block" },
    ]);
  });
});
