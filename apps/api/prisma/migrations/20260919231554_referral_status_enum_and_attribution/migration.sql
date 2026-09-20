-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'REVERSED');

-- AlterTable: DeliveryPartnerReferral.status text -> enum (existing values are
-- already lowercase spellings of the enum names), plus the new reversedCents
-- counter used to track partial-refund reversals.
ALTER TABLE "DeliveryPartnerReferral"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ReferralStatus" USING (UPPER("status")::"ReferralStatus"),
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "DeliveryPartnerReferral" ADD COLUMN "reversedCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: durable signup-time referral attribution on User
ALTER TABLE "User" ADD COLUMN "referredByPartnerId" TEXT;

-- CreateIndex
CREATE INDEX "User_referredByPartnerId_idx" ON "User"("referredByPartnerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByPartnerId_fkey" FOREIGN KEY ("referredByPartnerId") REFERENCES "DeliveryPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
