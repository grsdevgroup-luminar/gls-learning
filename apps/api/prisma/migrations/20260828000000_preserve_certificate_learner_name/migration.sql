ALTER TABLE "User" ADD COLUMN "nameChangeCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Certificate" ADD COLUMN "learnerName" TEXT;

UPDATE "Certificate" AS c
SET "learnerName" = u."name"
FROM "Enrollment" AS e
JOIN "User" AS u ON u."id" = e."userId"
WHERE c."enrollmentId" = e."id";

ALTER TABLE "Certificate" ALTER COLUMN "learnerName" SET NOT NULL;
