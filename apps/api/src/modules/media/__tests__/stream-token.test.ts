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

  // IP-binding is disabled (see ipAccessRules) — Railway never exposes the
  // real visitor IP to this app, so binding to it blocked every real viewer
  // instead of just abusers. accessRules is omitted regardless of input
  // until Railway exposes a header that actually carries the client IP.
  it("omits accessRules for any IP, parseable or not", () => {
    const withParseableIp = decode(
      signStreamToken("vid_123", "key_abc", pem, "203.0.113.42", now).split(".")[1],
    );
    const withoutIp = decode(signStreamToken("vid_123", "key_abc", pem, undefined, now).split(".")[1]);
    const withIpv6 = decode(
      signStreamToken("vid_123", "key_abc", pem, "2001:db8::1", now).split(".")[1],
    );
    expect(withParseableIp.accessRules).toBeUndefined();
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
  // Disabled 2026-08-19: confirmed live on Railway that X-Forwarded-For/
  // X-Real-Ip arrive already populated with Railway's own infra hops, never
  // the real visitor — so IP-binding blocked every real viewer, not abusers.
  // Returns undefined unconditionally until Railway exposes a header that
  // actually carries the client IP for this deployment.
  it("returns undefined regardless of input", () => {
    expect(ipAccessRules("203.0.113.42")).toBeUndefined();
    expect(ipAccessRules("::ffff:192.168.0.106")).toBeUndefined();
    expect(ipAccessRules("2001:db8::1")).toBeUndefined();
    expect(ipAccessRules("not-an-ip")).toBeUndefined();
    expect(ipAccessRules(undefined)).toBeUndefined();
  });
});
