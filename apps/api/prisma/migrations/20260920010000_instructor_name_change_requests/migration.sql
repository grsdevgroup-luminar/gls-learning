CREATE TYPE "NameChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "InstructorNameChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentName" TEXT NOT NULL,
    "requestedName" TEXT NOT NULL,
    "status" "NameChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "InstructorNameChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstructorNameChangeRequest_status_idx" ON "InstructorNameChangeRequest"("status");
CREATE INDEX "InstructorNameChangeRequest_userId_status_idx" ON "InstructorNameChangeRequest"("userId", "status");
ALTER TABLE "InstructorNameChangeRequest" ADD CONSTRAINT "InstructorNameChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;