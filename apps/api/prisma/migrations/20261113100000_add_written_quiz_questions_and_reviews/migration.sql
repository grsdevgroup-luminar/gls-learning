CREATE TYPE "QuizQuestionType" AS ENUM ('MCQ', 'WRITTEN');
CREATE TYPE "QuizAttemptReviewStatus" AS ENUM ('AUTO_GRADED', 'PENDING_REVIEW', 'GRADED');

ALTER TABLE "QuizQuestion"
  ADD COLUMN "questionType" "QuizQuestionType" NOT NULL DEFAULT 'MCQ',
  ADD COLUMN "marks" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "wordLimitMin" INTEGER,
  ADD COLUMN "wordLimitMax" INTEGER,
  ADD COLUMN "modelAnswer" TEXT,
  ADD COLUMN "gradingRubric" TEXT;

ALTER TABLE "QuizAttempt"
  ADD COLUMN "reviewStatus" "QuizAttemptReviewStatus" NOT NULL DEFAULT 'AUTO_GRADED',
  ADD COLUMN "earnedMarks" INTEGER,
  ADD COLUMN "totalMarks" INTEGER;

ALTER TABLE "QuizResult"
  ADD COLUMN "reviewStatus" "QuizAttemptReviewStatus" NOT NULL DEFAULT 'AUTO_GRADED';

CREATE TABLE "WrittenAnswerSubmission" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "score" INTEGER,
  "feedback" TEXT,
  "gradedById" TEXT,
  "gradedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WrittenAnswerSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WrittenAnswerSubmission_attemptId_questionId_key"
  ON "WrittenAnswerSubmission"("attemptId", "questionId");
CREATE INDEX "WrittenAnswerSubmission_questionId_idx"
  ON "WrittenAnswerSubmission"("questionId");
CREATE INDEX "WrittenAnswerSubmission_gradedById_idx"
  ON "WrittenAnswerSubmission"("gradedById");

ALTER TABLE "WrittenAnswerSubmission" ADD CONSTRAINT "WrittenAnswerSubmission_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WrittenAnswerSubmission" ADD CONSTRAINT "WrittenAnswerSubmission_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WrittenAnswerSubmission" ADD CONSTRAINT "WrittenAnswerSubmission_gradedById_fkey"
  FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
