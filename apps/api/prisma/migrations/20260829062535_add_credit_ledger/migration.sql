-- CreateEnum
CREATE TYPE "CreditLedgerReason" AS ENUM ('GRANT_REFUND', 'SPEND_CHECKOUT', 'ADJUST_MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEvent" ADD VALUE 'ORDER_REFUNDED';
ALTER TYPE "NotificationEvent" ADD VALUE 'CREDIT_GRANTED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "creditAppliedCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StudentCreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" "CreditLedgerReason" NOT NULL,
    "orderId" TEXT,
    "adminUserId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentCreditLedger_userId_currency_createdAt_idx" ON "StudentCreditLedger"("userId", "currency", "createdAt");

-- CreateIndex
CREATE INDEX "StudentCreditLedger_orderId_idx" ON "StudentCreditLedger"("orderId");

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCreditLedger" ADD CONSTRAINT "StudentCreditLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
