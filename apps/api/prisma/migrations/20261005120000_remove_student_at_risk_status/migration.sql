-- Removes the manual "flag at risk" admin action: nothing in the codebase ever
-- set StudentStatus to AT_RISK except that one admin button, so the value is
-- dropped. Existing AT_RISK rows fall back to IDLE, the closest remaining
-- non-active state.

UPDATE "StudentProfile" SET "status" = 'IDLE' WHERE "status" = 'AT_RISK';

CREATE TYPE "StudentStatus_new" AS ENUM ('ACTIVE', 'IDLE');

ALTER TABLE "StudentProfile" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StudentProfile" ALTER COLUMN "status" TYPE "StudentStatus_new" USING ("status"::text::"StudentStatus_new");
ALTER TABLE "StudentProfile" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "StudentStatus";
ALTER TYPE "StudentStatus_new" RENAME TO "StudentStatus";
