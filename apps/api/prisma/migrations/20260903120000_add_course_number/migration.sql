ALTER TABLE "Course" ADD COLUMN "courseNumber" TEXT;

UPDATE "Course"
SET "courseNumber" = 'CRS-' || UPPER(SUBSTRING(MD5("id") FROM 1 FOR 12))
WHERE "courseNumber" IS NULL;

ALTER TABLE "Course" ALTER COLUMN "courseNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Course_courseNumber_key" ON "Course"("courseNumber");
