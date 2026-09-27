CREATE TABLE "InstructorExpertiseChangeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentExpertise" TEXT,
    "requestedExpertise" TEXT NOT NULL,
    "status" "NameChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "InstructorExpertiseChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstructorExpertiseChangeRequest_status_idx" ON "InstructorExpertiseChangeRequest"("status");
CREATE INDEX "InstructorExpertiseChangeRequest_userId_status_idx" ON "InstructorExpertiseChangeRequest"("userId", "status");
ALTER TABLE "InstructorExpertiseChangeRequest" ADD CONSTRAINT "InstructorExpertiseChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;