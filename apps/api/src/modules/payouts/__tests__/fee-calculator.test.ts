import { describe, expect, it } from "vitest";
import {
  STRIPE_FEE_BPS,
  STRIPE_FEE_FLAT_CENTS,
  calculatePayoutBreakdown,
} from "../fees/fee-calculator";

const config = { platformFeeBps: 500, minNetCents: 2_500 }; // 5%, $25 min

describe("calculatePayoutBreakdown", () => {
  it("subtracts platform + Stripe fees from the requested amount", () => {
    const b = calculatePayoutBreakdown(10_000, config); // $100
    // 5% platform = 500, Stripe 0.25% + 25¢ = 25 + 25 = 50 → net 9,450
    expect(b.platformFeeCents).toBe(500);
    expect(b.stripeFeeCents).toBe(STRIPE_FEE_FLAT_CENTS + Math.round((10_000 * STRIPE_FEE_BPS) / 10_000));
    expect(b.netCents).toBe(10_000 - b.platformFeeCents - b.stripeFeeCents);
    expect(b.meetsMinimum).toBe(true);
  });

  it("flags below-minimum results", () => {
    const b = calculatePayoutBreakdown(1_000, config); // $10
    expect(b.meetsMinimum).toBe(false);
  });

  it("clamps net at 0 when fees exceed the request", () => {
    const tinyRequest = calculatePayoutBreakdown(10, config);
    expect(tinyRequest.netCents).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 platform fee when configured to 0 bps", () => {
    const b = calculatePayoutBreakdown(5_000, { ...config, platformFeeBps: 0 });
    expect(b.platformFeeCents).toBe(0);
  });
});
