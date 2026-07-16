-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
-- At most one featured coupon platform-wide: every indexed row has featured =
-- true, so uniqueness on the column allows exactly one. Partial indexes have no
-- Prisma schema equivalent, so this constraint lives here rather than in
-- schema.prisma -- keep it when editing this migration.
CREATE UNIQUE INDEX "Coupon_single_featured" ON "Coupon" ("featured") WHERE "featured";
