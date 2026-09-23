CREATE TYPE "RatingStage" AS ENUM ('STARTED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "Course"
  ADD COLUMN "ratingWeightedCount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "completedReviewCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Review"
  ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ratingStage" "RatingStage" NOT NULL DEFAULT 'STARTED',
  ADD COLUMN "ratingWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.35;

UPDATE "Course" c SET "ratingWeightedCount" = c."reviewCount" * 0.35 WHERE c."reviewCount" > 0;
