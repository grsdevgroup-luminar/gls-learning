-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'PENDING', 'REJECTED');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "proposedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE INDEX "Category_status_idx" ON "Category"("status");
CREATE INDEX "Category_proposedById_idx" ON "Category"("proposedById");

-- ForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_proposedById_fkey"
  FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the original platform taxonomy as admin-approved categories.
INSERT INTO "Category" ("id", "name", "status", "updatedAt") VALUES
  ('category_cloud', 'Cloud', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_communication', 'Communication', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_data_science', 'Data Science', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_design', 'Design', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_development', 'Development', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_finance', 'Finance', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_health_wellness', 'Health & Wellness', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_language_learning', 'Language Learning', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_marketing', 'Marketing', 'ACTIVE', CURRENT_TIMESTAMP),
  ('category_personal_development', 'Personal Development', 'ACTIVE', CURRENT_TIMESTAMP);
