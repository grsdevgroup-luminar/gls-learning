import { z } from "zod";
import { PayeeType, PayoutMethod, PayoutStatus } from "../enums";

/** Minimum balance (cents) a payee must have accrued to request a payout. */
export const MIN_PAYOUT_CENTS = 5000;

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
  status: z.nativeEnum(PayoutStatus),
  method: z.nativeEnum(PayoutMethod),
  destination: z.string(),
  note: z.string().nullable(),
  requestedAt: z.string(),
  processedAt: z.string().nullable(),
});
export type PayoutDto = z.infer<typeof PayoutDto>;

export const RejectPayoutSchema = z.object({
  note: z.string().max(500).optional(),
});
export type RejectPayoutInput = z.infer<typeof RejectPayoutSchema>;
