-- AlterTable
ALTER TABLE "DeliveryPartnerApplication" DROP COLUMN "bio",
DROP COLUMN "phone",
DROP COLUMN "region",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "documents" JSONB NOT NULL DEFAULT '[]';

