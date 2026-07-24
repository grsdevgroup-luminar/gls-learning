import { describe, it, expect } from "vitest";
import { computeBalance } from "../payouts.service";

const base = {
  lifetimeEarnedCents: 20000,
  paidOutCents: 0,
  inFlightCents: 0,
  minPayoutCents: 5000,
  hasAccount: true,
};

describe("computeBalance", () => {
  it("available = lifetime − paid − in-flight, and allows a request above the floor", () => {
    const b = computeBalance({ ...base, paidOutCents: 5000, inFlightCents: 0 });
    expect(b.availableCents).toBe(15000);
    expect(b.canRequest).toBe(true);
  });

  it("blocks a second request while one is in flight", () => {
    const b = computeBalance({ ...base, inFlightCents: 20000 });
    expect(b.availableCents).toBe(0);
    expect(b.hasOpenRequest).toBe(true);
    expect(b.canRequest).toBe(false);
  });

  it("never reports a negative balance", () => {
    const b = computeBalance({ ...base, paidOutCents: 25000 });
    expect(b.availableCents).toBe(0);
  });

  it("requires an account and at least the minimum", () => {
    expect(computeBalance({ ...base, hasAccount: false }).canRequest).toBe(false);
    expect(computeBalance({ ...base, lifetimeEarnedCents: 4000 }).canRequest).toBe(false);
  });
});
