-- CreateTable
CREATE TABLE "CourseOrgAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseOrgAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseOrgAssignment_courseId_idx" ON "CourseOrgAssignment"("courseId");

-- CreateIndex
CREATE INDEX "CourseOrgAssignment_orgId_idx" ON "CourseOrgAssignment"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOrgAssignment_courseId_orgId_key" ON "CourseOrgAssignment"("courseId", "orgId");

-- AddForeignKey
ALTER TABLE "CourseOrgAssignment" ADD CONSTRAINT "CourseOrgAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOrgAssignment" ADD CONSTRAINT "CourseOrgAssignment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: Course.orgId is being dropped below (single-org model -> many-to-
-- many via CourseOrgAssignment). Every existing single assignment must become
-- a row here first, or that org-course link is silently lost.
INSERT INTO "CourseOrgAssignment" ("id", "courseId", "orgId", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "id"), "id", "orgId", now()
FROM "Course"
WHERE "orgId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_orgId_fkey";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "orgId";
