-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEvent" ADD VALUE 'ORG_INVITE_DECLINED';
ALTER TYPE "NotificationEvent" ADD VALUE 'DELIVERY_PARTNER_INVITE_DECLINED';
ALTER TYPE "NotificationEvent" ADD VALUE 'DELIVERY_PARTNER_MEMBER_JOINED';

-- AlterTable
ALTER TABLE "DeliveryPartnerInvitation" ADD COLUMN     "declinedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrgInvitation" ADD COLUMN     "declinedAt" TIMESTAMP(3);
