-- Instructor payout via Stripe Connect: add STRIPE payout method + fee/net
-- accounting columns and provider reference. Backfills existing rows so
-- historical payouts show net == amount (no fees ever deducted for them).

ALTER TYPE "PayoutMethod" ADD VALUE 'STRIPE';
ALTER TYPE "NotificationEvent" ADD VALUE 'PAYOUT_REQUESTED';

ALTER TABLE "Payout"
  ADD COLUMN "netCents"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stripeFeeCents"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "providerRef"      TEXT;

UPDATE "Payout" SET "netCents" = "amountCents" WHERE "netCents" = 0;
