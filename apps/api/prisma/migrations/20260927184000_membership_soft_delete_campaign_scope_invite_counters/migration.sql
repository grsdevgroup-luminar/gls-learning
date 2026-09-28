-- CreateEnum
CREATE TYPE "DeliveryPartnerCampaignScope" AS ENUM ('GLOBAL', 'SPECIFIC');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEvent" ADD VALUE 'ORG_MEMBER_RESTORED';
ALTER TYPE "NotificationEvent" ADD VALUE 'DELIVERY_PARTNER_MEMBER_RESTORED';

-- DropIndex
DROP INDEX "DeliveryPartnerMember_courseAssignmentId_email_key";

-- DropIndex
DROP INDEX "OrgMember_orgId_email_key";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "affectedUserId" TEXT;

-- AlterTable
ALTER TABLE "DeliveryPartnerCampaign" ADD COLUMN     "scope" "DeliveryPartnerCampaignScope" NOT NULL DEFAULT 'GLOBAL';

-- AlterTable
ALTER TABLE "DeliveryPartnerCourseAssignment" ADD COLUMN     "totalInvitesSent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DeliveryPartnerMember" ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedBy" TEXT,
ADD COLUMN     "removedReason" TEXT;

-- AlterTable
ALTER TABLE "OrgMember" ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedBy" TEXT,
ADD COLUMN     "removedReason" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "totalInvitesSent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DeliveryPartnerCampaignCourse" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPartnerCampaignCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryPartnerCampaignCourse_campaignId_idx" ON "DeliveryPartnerCampaignCourse"("campaignId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerCampaignCourse_courseId_idx" ON "DeliveryPartnerCampaignCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartnerCampaignCourse_campaignId_courseId_key" ON "DeliveryPartnerCampaignCourse"("campaignId", "courseId");

-- CreateIndex
CREATE INDEX "AuditLog_affectedUserId_idx" ON "AuditLog"("affectedUserId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerMember_courseAssignmentId_email_idx" ON "DeliveryPartnerMember"("courseAssignmentId", "email");

-- CreateIndex
CREATE INDEX "OrgMember_orgId_email_idx" ON "OrgMember"("orgId", "email");

-- AddForeignKey
ALTER TABLE "DeliveryPartnerCampaignCourse" ADD CONSTRAINT "DeliveryPartnerCampaignCourse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DeliveryPartnerCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerCampaignCourse" ADD CONSTRAINT "DeliveryPartnerCampaignCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- At most one *active* (removedAt IS NULL) membership per org+email — a
-- soft-removed row no longer occupies the slot, so the same email can be
-- re-invited/re-claimed. Partial indexes have no Prisma schema equivalent,
-- so this constraint lives here rather than in schema.prisma -- keep it when
-- editing this migration.
CREATE UNIQUE INDEX "OrgMember_orgId_email_active_key" ON "OrgMember"("orgId", "email") WHERE "removedAt" IS NULL;

-- CreateIndex
-- Same idea, one level deeper (per course-assignment, not per-org) — mirrors
-- OrgMember_orgId_email_active_key above.
CREATE UNIQUE INDEX "DeliveryPartnerMember_courseAssignmentId_email_active_key" ON "DeliveryPartnerMember"("courseAssignmentId", "email") WHERE "removedAt" IS NULL;
