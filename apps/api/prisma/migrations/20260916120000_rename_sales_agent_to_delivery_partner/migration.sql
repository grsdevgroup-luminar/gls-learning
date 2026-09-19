-- Preserve existing sales-agent records while renaming the feature to delivery-partner.
-- This migration maps legacy enum values and renames tables in place; it does not drop data.

ALTER TYPE "SalesAgentStatus" RENAME TO "DeliveryPartnerStatus";

BEGIN;
CREATE TYPE "NotificationEvent_new" AS ENUM (
  'ORDER_PAID', 'ORDER_REFUNDED', 'CREDIT_GRANTED', 'CERTIFICATE_ISSUED',
  'INSTRUCTOR_APPLICATION_APPROVED', 'INSTRUCTOR_APPLICATION_REJECTED',
  'DELIVERY_PARTNER_APPLICATION_APPROVED', 'DELIVERY_PARTNER_APPLICATION_REJECTED',
  'PAYOUT_REQUESTED', 'PAYOUT_APPROVED', 'PAYOUT_PAID', 'REFERRAL_CONFIRMED',
  'COURSE_NEW_REVIEW', 'COURSE_NEW_ENROLLMENT', 'ORDER_NEW_PURCHASE',
  'COURSE_UPDATED_BY_ADMIN', 'ORG_MEMBER_JOINED', 'ORG_SEATS_LOW',
  'ORG_INVITE_EXPIRED', 'TABLE_SIZE_WARNING'
);
ALTER TABLE "Notification"
  ALTER COLUMN "event" TYPE "NotificationEvent_new"
  USING (CASE "event"::text
    WHEN 'SALES_AGENT_APPLICATION_APPROVED' THEN 'DELIVERY_PARTNER_APPLICATION_APPROVED'
    WHEN 'SALES_AGENT_APPLICATION_REJECTED' THEN 'DELIVERY_PARTNER_APPLICATION_REJECTED'
    ELSE "event"::text
  END::text::"NotificationEvent_new");
ALTER TYPE "NotificationEvent" RENAME TO "NotificationEvent_old";
ALTER TYPE "NotificationEvent_new" RENAME TO "NotificationEvent";
DROP TYPE "NotificationEvent_old";
COMMIT;

BEGIN;
CREATE TYPE "PayeeType_new" AS ENUM ('INSTRUCTOR', 'DELIVERY_PARTNER');
ALTER TABLE "Payout"
  ALTER COLUMN "payeeType" TYPE "PayeeType_new"
  USING (CASE "payeeType"::text
    WHEN 'AGENT' THEN 'DELIVERY_PARTNER'
    ELSE "payeeType"::text
  END::text::"PayeeType_new");
ALTER TYPE "PayeeType" RENAME TO "PayeeType_old";
ALTER TYPE "PayeeType_new" RENAME TO "PayeeType";
DROP TYPE "PayeeType_old";
COMMIT;

BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN', 'DELIVERY_PARTNER', 'ORG_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (CASE "role"::text
    WHEN 'SALES_AGENT' THEN 'DELIVERY_PARTNER'
    ELSE "role"::text
  END::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STUDENT';
COMMIT;

ALTER TABLE "SalesAgent" DROP CONSTRAINT "SalesAgent_userId_fkey";
ALTER TABLE "SalesAgentReferral" DROP CONSTRAINT "SalesAgentReferral_agentId_fkey";
ALTER TABLE "SalesAgentReferral" DROP CONSTRAINT "SalesAgentReferral_orderId_fkey";

DROP INDEX "Order_agentId_idx";
ALTER TABLE "Order" RENAME COLUMN "agentId" TO "partnerId";
ALTER TABLE "Order" RENAME COLUMN "agentReferralCode" TO "partnerReferralCode";

ALTER TABLE "SalesAgent" RENAME TO "DeliveryPartner";
ALTER TABLE "SalesAgentApplication" RENAME TO "DeliveryPartnerApplication";
ALTER TABLE "SalesAgentReferral" RENAME TO "DeliveryPartnerReferral";
ALTER TABLE "DeliveryPartnerReferral" RENAME COLUMN "agentId" TO "partnerId";

ALTER INDEX "SalesAgent_pkey" RENAME TO "DeliveryPartner_pkey";
ALTER INDEX "SalesAgent_userId_key" RENAME TO "DeliveryPartner_userId_key";
ALTER INDEX "SalesAgent_referralCode_key" RENAME TO "DeliveryPartner_referralCode_key";
ALTER INDEX "SalesAgent_status_idx" RENAME TO "DeliveryPartner_status_idx";
ALTER INDEX "SalesAgentApplication_pkey" RENAME TO "DeliveryPartnerApplication_pkey";
ALTER INDEX "SalesAgentApplication_status_idx" RENAME TO "DeliveryPartnerApplication_status_idx";
ALTER INDEX "SalesAgentReferral_pkey" RENAME TO "DeliveryPartnerReferral_pkey";
ALTER INDEX "SalesAgentReferral_orderId_key" RENAME TO "DeliveryPartnerReferral_orderId_key";
ALTER INDEX "SalesAgentReferral_agentId_idx" RENAME TO "DeliveryPartnerReferral_partnerId_idx";
CREATE INDEX "Order_partnerId_idx" ON "Order"("partnerId");

ALTER TABLE "DeliveryPartner"
  ADD CONSTRAINT "DeliveryPartner_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryPartnerReferral"
  ADD CONSTRAINT "DeliveryPartnerReferral_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "DeliveryPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryPartnerReferral"
  ADD CONSTRAINT "DeliveryPartnerReferral_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;