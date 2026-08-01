import { describe, it, expect, beforeAll } from "vitest";
import {
  createVerify,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";
import { signStreamToken } from "../media.service";

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
    const token = signStreamToken("vid_123", "key_abc", pem, now);
    const [header, payload, sig] = token.split(".");
    expect(token.split(".")).toHaveLength(3);

    const ok = createVerify("RSA-SHA256")
      .update(`${header}.${payload}`)
      .verify(publicKey, sig, "base64url");
    expect(ok).toBe(true);
  });

  it("binds the token to the video uid and key id", () => {
    const [header, payload] = signStreamToken("vid_123", "key_abc", pem, now)
      .split(".");
    expect(decode(header)).toMatchObject({ alg: "RS256", kid: "key_abc" });
    expect(decode(payload)).toMatchObject({ sub: "vid_123", kid: "key_abc" });
  });

  it("blocks download and bounds the validity window", () => {
    const iat = Math.floor(now.getTime() / 1000);
    const claims = decode(signStreamToken("vid_123", "key_abc", pem, now).split(".")[1]);
    expect(claims.downloadable).toBe(false);
    expect(claims.nbf).toBeLessThanOrEqual(iat);
    expect(claims.exp).toBe(iat + 2 * 60 * 60);
  });

  it("tampering with the payload breaks verification", () => {
    const [header, , sig] = signStreamToken("vid_123", "key_abc", pem, now).split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "other" })).toString("base64url");
    const ok = createVerify("RSA-SHA256")
      .update(`${header}.${forged}`)
      .verify(publicKey, sig, "base64url");
    expect(ok).toBe(false);
  });
});
