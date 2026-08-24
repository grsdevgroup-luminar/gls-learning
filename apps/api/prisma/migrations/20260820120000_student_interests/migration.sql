-- Learner interest onboarding. Arrays are deliberately stored on the existing
-- one-to-one student profile: the categories are small, ordered preferences
-- rather than a shared taxonomy that needs its own management UI.
ALTER TABLE "StudentProfile"
  ADD COLUMN "interestCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "interestKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "interestsCompletedAt" TIMESTAMP(3);
