-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "campaignCode" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "campaignCode" TEXT,
ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "DeliveryPartnerCampaign" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryPartnerCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartnerCampaign_code_key" ON "DeliveryPartnerCampaign"("code");

-- CreateIndex
CREATE INDEX "DeliveryPartnerCampaign_partnerId_idx" ON "DeliveryPartnerCampaign"("partnerId");

-- CreateIndex
CREATE INDEX "Order_campaignId_idx" ON "Order"("campaignId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DeliveryPartnerCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerCampaign" ADD CONSTRAINT "DeliveryPartnerCampaign_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DeliveryPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
