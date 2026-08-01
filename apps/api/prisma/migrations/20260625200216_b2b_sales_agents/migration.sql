-- CreateEnum
CREATE TYPE "CourseVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SalesAgentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrgMemberRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'SALES_AGENT';
ALTER TYPE "UserRole" ADD VALUE 'ORG_ADMIN';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "visibility" "CourseVisibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "agentReferralCode" TEXT;

-- CreateTable
CREATE TABLE "SalesAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "region" TEXT NOT NULL DEFAULT '',
    "status" "SalesAgentStatus" NOT NULL DEFAULT 'PENDING',
    "totalEarningsCents" INTEGER NOT NULL DEFAULT 0,
    "pendingEarningsCents" INTEGER NOT NULL DEFAULT 0,
    "paidEarningsCents" INTEGER NOT NULL DEFAULT 0,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAgentApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "region" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "status" "SalesAgentStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "SalesAgentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAgentReferral" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "commissionCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesAgentReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "adminEmail" TEXT NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'TRIAL',
    "seatCount" INTEGER NOT NULL DEFAULT 10,
    "usedSeats" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgInvitation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesAgent_userId_key" ON "SalesAgent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesAgent_referralCode_key" ON "SalesAgent"("referralCode");

-- CreateIndex
CREATE INDEX "SalesAgent_status_idx" ON "SalesAgent"("status");

-- CreateIndex
CREATE INDEX "SalesAgentApplication_status_idx" ON "SalesAgentApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesAgentReferral_orderId_key" ON "SalesAgentReferral"("orderId");

-- CreateIndex
CREATE INDEX "SalesAgentReferral_agentId_idx" ON "SalesAgentReferral"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

-- CreateIndex
CREATE INDEX "OrgMember_orgId_idx" ON "OrgMember"("orgId");

-- CreateIndex
CREATE INDEX "OrgMember_userId_idx" ON "OrgMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_email_key" ON "OrgMember"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvitation_token_key" ON "OrgInvitation"("token");

-- CreateIndex
CREATE INDEX "OrgInvitation_orgId_idx" ON "OrgInvitation"("orgId");

-- CreateIndex
CREATE INDEX "OrgInvitation_token_idx" ON "OrgInvitation"("token");

-- CreateIndex
CREATE INDEX "Course_visibility_idx" ON "Course"("visibility");

-- CreateIndex
CREATE INDEX "Order_agentId_idx" ON "Order"("agentId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAgent" ADD CONSTRAINT "SalesAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAgentReferral" ADD CONSTRAINT "SalesAgentReferral_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "SalesAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAgentReferral" ADD CONSTRAINT "SalesAgentReferral_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInvitation" ADD CONSTRAINT "OrgInvitation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
