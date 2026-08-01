-- Payouts: unified request→approve→paid ledger for instructors and sales agents.

CREATE TYPE "PayeeType" AS ENUM ('INSTRUCTOR', 'AGENT');
CREATE TYPE "PayoutMethod" AS ENUM ('PAYPAL', 'BANK');
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED');

CREATE TABLE "PayoutAccount" (
    "userId" TEXT NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "details" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "payeeUserId" TEXT NOT NULL,
    "payeeType" "PayeeType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "method" "PayoutMethod" NOT NULL,
    "destination" TEXT NOT NULL,
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payout_payeeUserId_idx" ON "Payout"("payeeUserId");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_payeeUserId_fkey"
    FOREIGN KEY ("payeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
