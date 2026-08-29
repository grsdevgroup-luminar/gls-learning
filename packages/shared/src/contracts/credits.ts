import type { CreditLedgerReason } from "../enums.js";

/** One (currency, balance) pair — a user can accrue credit in more than one
 *  currency when orders from different regions get refunded. */
export interface CreditBalanceDto {
  currency: string;
  amountCents: number;
}

/** One row in the ledger. Positive = grant, negative = spend. See
 *  REFUND_TO_CREDIT_PLAN.md. */
export interface CreditLedgerEntryDto {
  id: string;
  amountCents: number;
  currency: string;
  reason: CreditLedgerReason;
  /** Source order (for GRANT_REFUND) or spend order (for SPEND_CHECKOUT). */
  orderId: string | null;
  /** Only populated for GRANT_REFUND — the admin's refund note. */
  comment: string | null;
  createdAt: string;
}
