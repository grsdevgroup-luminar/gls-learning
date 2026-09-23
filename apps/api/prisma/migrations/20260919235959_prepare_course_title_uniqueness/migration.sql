-- Prepare the existing data before the immutable uniqueness migration
-- 20260920000000_unique_course_title_per_instructor creates its index.
--
-- Keep every course. The oldest course keeps its title; later duplicates get a
-- deterministic, non-destructive suffix containing their stable course id.
DO $$
BEGIN
  IF to_regclass('public."Course_instructorId_title_key"') IS NULL THEN
    WITH ranked AS (
      SELECT
        "id",
        "title",
        ROW_NUMBER() OVER (
          PARTITION BY "instructorId", "title"
          ORDER BY "createdAt", "id"
        ) AS duplicate_number
      FROM "Course"
    )
    UPDATE "Course" AS course
    SET "title" = ranked."title" || ' [duplicate ' || ranked."id" || ']'
    FROM ranked
    WHERE course."id" = ranked."id"
      AND ranked.duplicate_number > 1;
  END IF;
END $$;
