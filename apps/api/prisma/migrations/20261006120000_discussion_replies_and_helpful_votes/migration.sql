-- Add one-level threaded replies while preserving existing top-level comments.
ALTER TABLE "Comment" ADD COLUMN "parentId" TEXT;

CREATE INDEX "Comment_parentId_createdAt_idx"
ON "Comment"("parentId", "createdAt");

ALTER TABLE "Comment"
ADD CONSTRAINT "Comment_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Comment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Persist one helpful vote per user/review. The existing Review.helpful value
-- remains the denormalized counter and is updated transactionally on first vote.
CREATE TABLE "ReviewHelpful" (
  "reviewId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReviewHelpful_pkey" PRIMARY KEY ("reviewId", "userId")
);

CREATE INDEX "ReviewHelpful_userId_idx" ON "ReviewHelpful"("userId");

ALTER TABLE "ReviewHelpful"
ADD CONSTRAINT "ReviewHelpful_reviewId_fkey"
FOREIGN KEY ("reviewId") REFERENCES "Review"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewHelpful"
ADD CONSTRAINT "ReviewHelpful_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
