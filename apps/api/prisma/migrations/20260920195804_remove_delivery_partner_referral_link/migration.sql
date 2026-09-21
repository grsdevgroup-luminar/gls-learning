-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_referredByPartnerId_fkey";

-- DropIndex
DROP INDEX "DeliveryPartner_referralCode_key";

-- DropIndex
DROP INDEX "User_referredByPartnerId_idx";

-- AlterTable
ALTER TABLE "DeliveryPartner" DROP COLUMN "referralCode";

-- AlterTable
ALTER TABLE "DeliveryPartnerCourseAssignment" ALTER COLUMN "memberCap" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "partnerReferralCode";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "referredByPartnerId";

