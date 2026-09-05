-- CreateEnum
CREATE TYPE "OrgSuspensionMode" AS ENUM ('LOCK_NOW', 'GRACE_PERIOD');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "accessLocksAt" TIMESTAMP(3),
ADD COLUMN     "suspensionMode" "OrgSuspensionMode";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: orgs already SUSPENDED before this migration have no
-- accessLocksAt yet, which the enforcement formula (status === SUSPENDED &&
-- accessLocksAt <= now) reads as "not locked". Without this, every
-- currently-suspended org would silently regain full access the moment this
-- ships. LOCK_NOW + now() reproduces "suspended" under the new formula.
UPDATE "Organization" SET "suspensionMode" = 'LOCK_NOW', "accessLocksAt" = now() WHERE "status" = 'SUSPENDED';
