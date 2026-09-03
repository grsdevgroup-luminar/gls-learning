ALTER TABLE "Certificate" ADD COLUMN "courseNumber" TEXT;

UPDATE "Certificate" AS certificate
SET "courseNumber" = course."courseNumber"
FROM "Enrollment" AS enrollment
JOIN "Course" AS course ON course."id" = enrollment."courseId"
WHERE certificate."enrollmentId" = enrollment."id";

ALTER TABLE "Certificate" ALTER COLUMN "courseNumber" SET NOT NULL;
