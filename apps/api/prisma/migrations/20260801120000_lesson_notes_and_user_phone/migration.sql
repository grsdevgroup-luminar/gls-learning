-- Per-lesson learner notes (previously localStorage-only) and the phone number
-- the SMS reminder channel needs. Both additive: nothing existing changes.

-- AlterTable
-- Nullable: SMS reminders are simply skipped for users who never add a number.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "LessonNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LessonNote_pkey" PRIMARY KEY ("id")
);

-- One note per learner per lesson; the write path upserts on this.
CREATE UNIQUE INDEX "LessonNote_userId_lessonId_key" ON "LessonNote"("userId", "lessonId");
CREATE INDEX "LessonNote_lessonId_idx" ON "LessonNote"("lessonId");

ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonNote" ADD CONSTRAINT "LessonNote_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
