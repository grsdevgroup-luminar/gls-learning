-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "pptxDurationSec" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pptxName" TEXT,
ADD COLUMN     "pptxSizeLabel" TEXT,
ADD COLUMN     "pptxStorageKey" TEXT;

-- AlterTable
ALTER TABLE "LessonProgress" ADD COLUMN     "pptxCompleted" BOOLEAN NOT NULL DEFAULT false;
