-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('ORDER_PAID', 'CERTIFICATE_ISSUED', 'INSTRUCTOR_APPLICATION_APPROVED', 'INSTRUCTOR_APPLICATION_REJECTED', 'SALES_AGENT_APPLICATION_APPROVED', 'SALES_AGENT_APPLICATION_REJECTED', 'PAYOUT_APPROVED', 'PAYOUT_PAID', 'REFERRAL_CONFIRMED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "unreadNotificationCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
