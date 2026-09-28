-- Isolated instructor edits for live, organization-assigned courses.
CREATE TYPE "CourseRevisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

DROP INDEX IF EXISTS "Course_instructorId_title_key";
ALTER TABLE "Course" ADD COLUMN "revisionOfId" TEXT;
ALTER TABLE "Section" ADD COLUMN "sourceSectionId" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "sourceLessonId" TEXT;
ALTER TABLE "Section" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Lesson" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Course_revisionOfId_idx" ON "Course"("revisionOfId");
CREATE UNIQUE INDEX "Course_live_instructor_title_key" ON "Course"("instructorId", lower("title")) WHERE "revisionOfId" IS NULL;

ALTER TABLE "Course" ADD CONSTRAINT "Course_revisionOfId_fkey"
  FOREIGN KEY ("revisionOfId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseRevisionRequest" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "revisionCourseId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "status" "CourseRevisionStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedBy" TEXT,
  "reviewNote" TEXT,
  CONSTRAINT "CourseRevisionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseRevisionRequest_revisionCourseId_key"
  ON "CourseRevisionRequest"("revisionCourseId");
CREATE INDEX "CourseRevisionRequest_status_idx" ON "CourseRevisionRequest"("status");
CREATE INDEX "CourseRevisionRequest_courseId_idx" ON "CourseRevisionRequest"("courseId");
CREATE INDEX "CourseRevisionRequest_instructorId_idx" ON "CourseRevisionRequest"("instructorId");

ALTER TABLE "CourseRevisionRequest" ADD CONSTRAINT "CourseRevisionRequest_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseRevisionRequest" ADD CONSTRAINT "CourseRevisionRequest_revisionCourseId_fkey"
  FOREIGN KEY ("revisionCourseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseRevisionRequest" ADD CONSTRAINT "CourseRevisionRequest_instructorId_fkey"
  FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;