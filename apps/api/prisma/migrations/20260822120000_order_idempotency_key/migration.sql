-- AlterTable
ALTER TABLE "Order" ADD COLUMN "providerRedirectUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
-- Postgres treats each NULL as distinct in a unique index, so legacy rows
-- (idempotencyKey IS NULL) do not collide — no backfill required.
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key"
  ON "Order"("userId", "idempotencyKey");
