import { z } from "zod";
import { PayeeType, PayoutMethod, PayoutStatus } from "../enums";

/** Minimum balance (cents) a payee must have accrued to request a payout. */
export const MIN_PAYOUT_CENTS = 5000;

/** Stripe connected account id pattern (`acct_...`). Used when method=STRIPE. */
export const STRIPE_CONNECTED_ACCOUNT_RE = /^acct_[A-Za-z0-9]+$/;

export const PayoutAccountSchema = z.object({
  method: z.nativeEnum(PayoutMethod),
  details: z.string().min(3).max(300),
});
export type PayoutAccountInput = z.infer<typeof PayoutAccountSchema>;

export const PayoutAccountDto = z.object({
  method: z.nativeEnum(PayoutMethod),
  details: z.string(),
  updatedAt: z.string(),
});
export type PayoutAccountDto = z.infer<typeof PayoutAccountDto>;

/** Balance the payee sees before requesting a payout. */
export const PayoutBalanceDto = z.object({
  payeeType: z.nativeEnum(PayeeType),
  lifetimeEarnedCents: z.number(),
  paidOutCents: z.number(),
  inFlightCents: z.number(),
  availableCents: z.number(),
  minPayoutCents: z.number(),
  hasAccount: z.boolean(),
  hasOpenRequest: z.boolean(),
  canRequest: z.boolean(),
});
export type PayoutBalanceDto = z.infer<typeof PayoutBalanceDto>;

export const PayoutDto = z.object({
  id: z.string(),
  payeeUserId: z.string(),
  payeeName: z.string(),
  payeeEmail: z.string(),
  payeeType: z.nativeEnum(PayeeType),
  amountCents: z.number(),
  netCents: z.number(),
  platformFeeCents: z.number(),
  stripeFeeCents: z.number(),
  status: z.nativeEnum(PayoutStatus),
  method: z.nativeEnum(PayoutMethod),
  destination: z.string(),
  providerRef: z.string().nullable(),
  note: z.string().nullable(),
  requestedAt: z.string(),
  processedAt: z.string().nullable(),
});
export type PayoutDto = z.infer<typeof PayoutDto>;

export const RejectPayoutSchema = z.object({
  note: z.string().max(500).optional(),
});
export type RejectPayoutInput = z.infer<typeof RejectPayoutSchema>;

/** Admin list filters for `GET /admin/payouts`. `q` matches payee name/email
 *  and destination (case-insensitive). `from`/`to` bound `requestedAt`. */
export const AdminPayoutQuerySchema = z.object({
  status: z.nativeEnum(PayoutStatus).optional(),
  q: z.string().trim().max(200).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type AdminPayoutQuery = z.infer<typeof AdminPayoutQuerySchema>;

/** Body for `POST /me/payouts`. When `amountCents` is omitted the server
 *  withdraws the full available balance (backward-compatible). */
export const RequestPayoutSchema = z.object({
  amountCents: z.number().int().positive().optional(),
});
export type RequestPayoutInput = z.infer<typeof RequestPayoutSchema>;

/** Body for `POST /me/payouts/quote`. Pure fee preview, no writes. */
export const QuotePayoutSchema = z.object({
  amountCents: z.number().int().positive(),
});
export type QuotePayoutInput = z.infer<typeof QuotePayoutSchema>;

/** Breakdown of a payout: gross requested → what the payee actually receives.
 *  `net = requested − platformFee − stripeFee`. */
export const PayoutBreakdownDto = z.object({
  requestedCents: z.number(),
  platformFeeCents: z.number(),
  stripeFeeCents: z.number(),
  netCents: z.number(),
  minNetCents: z.number(),
  meetsMinimum: z.boolean(),
});
export type PayoutBreakdownDto = z.infer<typeof PayoutBreakdownDto>;

/** Stripe Connect status snapshot fetched live from Stripe. `connected` means
 *  the platform has ever created an `acct_xxx` for this user; `payoutsEnabled`
 *  means Stripe will accept a Transfer to that account right now. */
export const PayoutStripeStatusDto = z.object({
  connected: z.boolean(),
  connectedAccountId: z.string().nullable(),
  chargesEnabled: z.boolean(),
  payoutsEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
  requirementsDue: z.array(z.string()),
});
export type PayoutStripeStatusDto = z.infer<typeof PayoutStripeStatusDto>;

/** Hosted onboarding link returned by Stripe. Single-use; short TTL. */
export const StripeOnboardLinkDto = z.object({
  url: z.string().url(),
  expiresAt: z.string(),
});
export type StripeOnboardLinkDto = z.infer<typeof StripeOnboardLinkDto>;
