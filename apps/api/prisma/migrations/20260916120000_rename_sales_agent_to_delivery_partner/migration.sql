-- CreateEnum
CREATE TYPE "DeliveryPartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationEvent_new" AS ENUM ('ORDER_PAID', 'ORDER_REFUNDED', 'CREDIT_GRANTED', 'CERTIFICATE_ISSUED', 'INSTRUCTOR_APPLICATION_APPROVED', 'INSTRUCTOR_APPLICATION_REJECTED', 'DELIVERY_PARTNER_APPLICATION_APPROVED', 'DELIVERY_PARTNER_APPLICATION_REJECTED', 'PAYOUT_REQUESTED', 'PAYOUT_APPROVED', 'PAYOUT_PAID', 'REFERRAL_CONFIRMED', 'COURSE_NEW_REVIEW', 'COURSE_NEW_ENROLLMENT', 'ORDER_NEW_PURCHASE', 'COURSE_UPDATED_BY_ADMIN', 'ORG_MEMBER_JOINED', 'ORG_SEATS_LOW', 'ORG_INVITE_EXPIRED', 'TABLE_SIZE_WARNING');
ALTER TABLE "Notification" ALTER COLUMN "event" TYPE "NotificationEvent_new" USING ("event"::text::"NotificationEvent_new");
ALTER TYPE "NotificationEvent" RENAME TO "NotificationEvent_old";
ALTER TYPE "NotificationEvent_new" RENAME TO "NotificationEvent";
DROP TYPE "public"."NotificationEvent_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PayeeType_new" AS ENUM ('INSTRUCTOR', 'DELIVERY_PARTNER');
ALTER TABLE "Payout" ALTER COLUMN "payeeType" TYPE "PayeeType_new" USING ("payeeType"::text::"PayeeType_new");
ALTER TYPE "PayeeType" RENAME TO "PayeeType_old";
ALTER TYPE "PayeeType_new" RENAME TO "PayeeType";
DROP TYPE "public"."PayeeType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN', 'DELIVERY_PARTNER', 'ORG_ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "SalesAgent" DROP CONSTRAINT "SalesAgent_userId_fkey";

-- DropForeignKey
ALTER TABLE "SalesAgentReferral" DROP CONSTRAINT "SalesAgentReferral_agentId_fkey";

-- DropForeignKey
ALTER TABLE "SalesAgentReferral" DROP CONSTRAINT "SalesAgentReferral_orderId_fkey";

-- DropIndex
DROP INDEX "Order_agentId_idx";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "agentId",
DROP COLUMN "agentReferralCode",
ADD COLUMN     "partnerId" TEXT,
ADD COLUMN     "partnerReferralCode" TEXT;

-- DropTable
DROP TABLE "SalesAgent";

-- DropTable
DROP TABLE "SalesAgentApplication";

-- DropTable
DROP TABLE "SalesAgentReferral";

-- DropEnum
DROP TYPE "SalesAgentStatus";

-- CreateTable
CREATE TABLE "DeliveryPartner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "region" TEXT NOT NULL DEFAULT '',
    "status" "DeliveryPartnerStatus" NOT NULL DEFAULT 'PENDING',
    "totalEarningsCents" INTEGER NOT NULL DEFAULT 0,
    "pendingEarningsCents" INTEGER NOT NULL DEFAULT 0,
    "paidEarningsCents" INTEGER NOT NULL DEFAULT 0,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPartnerApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "region" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "status" "DeliveryPartnerStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "DeliveryPartnerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPartnerReferral" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPartnerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartner_userId_key" ON "DeliveryPartner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartner_referralCode_key" ON "DeliveryPartner"("referralCode");

-- CreateIndex
CREATE INDEX "DeliveryPartner_status_idx" ON "DeliveryPartner"("status");

-- CreateIndex
CREATE INDEX "DeliveryPartnerApplication_status_idx" ON "DeliveryPartnerApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartnerReferral_orderId_key" ON "DeliveryPartnerReferral"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerReferral_partnerId_idx" ON "DeliveryPartnerReferral"("partnerId");

-- CreateIndex
CREATE INDEX "Order_partnerId_idx" ON "Order"("partnerId");

-- AddForeignKey
ALTER TABLE "DeliveryPartner" ADD CONSTRAINT "DeliveryPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerReferral" ADD CONSTRAINT "DeliveryPartnerReferral_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DeliveryPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerReferral" ADD CONSTRAINT "DeliveryPartnerReferral_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

