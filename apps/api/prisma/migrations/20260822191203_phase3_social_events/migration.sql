-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEvent" ADD VALUE 'COURSE_NEW_REVIEW';
ALTER TYPE "NotificationEvent" ADD VALUE 'COURSE_NEW_ENROLLMENT';
ALTER TYPE "NotificationEvent" ADD VALUE 'ORG_MEMBER_JOINED';
ALTER TYPE "NotificationEvent" ADD VALUE 'ORG_SEATS_LOW';
ALTER TYPE "NotificationEvent" ADD VALUE 'ORG_INVITE_EXPIRED';
ALTER TYPE "NotificationEvent" ADD VALUE 'TABLE_SIZE_WARNING';
