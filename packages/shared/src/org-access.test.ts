import { describe, expect, it } from "vitest";
import { isOrgAccessLocked } from "./org-access";

describe("isOrgAccessLocked", () => {
  it("is never locked when the org isn't suspended", () => {
    expect(isOrgAccessLocked({ status: "ACTIVE", accessLocksAt: new Date(0) })).toBe(false);
    expect(isOrgAccessLocked({ status: "TRIAL", accessLocksAt: new Date(0) })).toBe(false);
  });

  it("is not locked when suspended with no accessLocksAt (pre-migration backfill gap)", () => {
    expect(isOrgAccessLocked({ status: "SUSPENDED", accessLocksAt: null })).toBe(false);
  });

  it("is not locked while a grace period is still in the future", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isOrgAccessLocked({ status: "SUSPENDED", accessLocksAt: future })).toBe(false);
  });

  it("is locked once accessLocksAt has passed", () => {
    const past = new Date(Date.now() - 1000);
    expect(isOrgAccessLocked({ status: "SUSPENDED", accessLocksAt: past })).toBe(true);
  });
});
