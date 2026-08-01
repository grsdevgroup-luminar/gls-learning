-- AlterTable
-- Nullable: existing rows keep their seeded fxRate and report "never refreshed"
-- until the daily FX job writes one.
ALTER TABLE "Region" ADD COLUMN "fxUpdatedAt" TIMESTAMP(3);
