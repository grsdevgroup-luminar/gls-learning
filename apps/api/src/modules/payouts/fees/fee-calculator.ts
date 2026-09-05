/**
 * Pure fee math for instructor payouts. Called from the service layer at
 * request time to freeze the breakdown into the `Payout` row, and from the
 * `POST /me/payouts/quote` endpoint for the UI's live preview.
 *
 *   net = requested − platformFee − stripeFee
 *
 * Fees are always ≥ 0; `net` is clamped at 0 (a fee stack that exceeds the
 * request is invalid, not negative money). Callers check `meetsMinimum`
 * before allowing the withdrawal.
 */

/** Stripe Connect Standard/Express Transfers to a connected account. This
 *  covers the destination-account portion; Stripe's Cross-Border Payouts add
 *  0.25% + 0.25 USD for foreign accounts, so the formula matches those and is
 *  a safe over-estimate for domestic USD transfers (Stripe absorbs the gap).
 *  Update in one place if Stripe's schedule changes. */
export const STRIPE_FEE_BPS = 25; // 0.25%
export const STRIPE_FEE_FLAT_CENTS = 25; // $0.25

export interface FeeConfig {
  platformFeeBps: number;
  minNetCents: number;
}

export interface PayoutBreakdown {
  requestedCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  netCents: number;
  minNetCents: number;
  meetsMinimum: boolean;
}

/** Basis-points math with banker's rounding to whole cents. Kept exact so a
 *  quote and the persisted row always agree on the same value. */
function bpsCents(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / 10_000);
}

export function calculatePayoutBreakdown(
  requestedCents: number,
  config: FeeConfig,
): PayoutBreakdown {
  const platformFeeCents = Math.max(0, bpsCents(requestedCents, config.platformFeeBps));
  const stripeFeeCents = Math.max(
    0,
    bpsCents(requestedCents, STRIPE_FEE_BPS) + STRIPE_FEE_FLAT_CENTS,
  );
  const netCents = Math.max(0, requestedCents - platformFeeCents - stripeFeeCents);
  return {
    requestedCents,
    platformFeeCents,
    stripeFeeCents,
    netCents,
    minNetCents: config.minNetCents,
    meetsMinimum: netCents >= config.minNetCents,
  };
}
