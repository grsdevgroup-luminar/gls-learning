-- CreateEnum
CREATE TYPE "CourseDeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationEvent" ADD VALUE 'INSTRUCTOR_APPLICATION_SUBMITTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'DELIVERY_PARTNER_APPLICATION_SUBMITTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'COURSE_DELETION_REQUESTED';
ALTER TYPE "NotificationEvent" ADD VALUE 'COURSE_DELETION_REQUEST_APPROVED';
ALTER TYPE "NotificationEvent" ADD VALUE 'COURSE_DELETION_REQUEST_REJECTED';

-- CreateTable
CREATE TABLE "CourseDeletionRequest" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "courseTitle" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CourseDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "CourseDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseDeletionRequest_status_idx" ON "CourseDeletionRequest"("status");

-- CreateIndex
CREATE INDEX "CourseDeletionRequest_courseId_idx" ON "CourseDeletionRequest"("courseId");

-- CreateIndex
CREATE INDEX "CourseDeletionRequest_instructorId_idx" ON "CourseDeletionRequest"("instructorId");

-- AddForeignKey
ALTER TABLE "CourseDeletionRequest" ADD CONSTRAINT "CourseDeletionRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDeletionRequest" ADD CONSTRAINT "CourseDeletionRequest_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
