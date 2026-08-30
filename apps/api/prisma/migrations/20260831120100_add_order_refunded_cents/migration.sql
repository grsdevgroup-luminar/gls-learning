-- Denormalized refund totals on Order and OrderItem. `refundedCents` on each
-- row is the cumulative store-credit refund granted against it; the admin
-- refund dialog uses these to compute per-item and per-order remaining
-- refundable without querying the credit ledger.

ALTER TABLE "Order"
  ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem"
  ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0;
