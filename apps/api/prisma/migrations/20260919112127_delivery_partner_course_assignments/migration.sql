-- CreateTable
CREATE TABLE "DeliveryPartnerCourseAssignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "memberCap" INTEGER NOT NULL DEFAULT 10,
    "usedSeats" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPartnerCourseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPartnerMember" (
    "id" TEXT NOT NULL,
    "courseAssignmentId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPartnerMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPartnerInvitation" (
    "id" TEXT NOT NULL,
    "courseAssignmentId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryPartnerInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryPartnerCourseAssignment_courseId_idx" ON "DeliveryPartnerCourseAssignment"("courseId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerCourseAssignment_partnerId_idx" ON "DeliveryPartnerCourseAssignment"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartnerCourseAssignment_courseId_partnerId_key" ON "DeliveryPartnerCourseAssignment"("courseId", "partnerId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerMember_courseAssignmentId_idx" ON "DeliveryPartnerMember"("courseAssignmentId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerMember_userId_idx" ON "DeliveryPartnerMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartnerMember_courseAssignmentId_email_key" ON "DeliveryPartnerMember"("courseAssignmentId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPartnerInvitation_token_key" ON "DeliveryPartnerInvitation"("token");

-- CreateIndex
CREATE INDEX "DeliveryPartnerInvitation_courseAssignmentId_idx" ON "DeliveryPartnerInvitation"("courseAssignmentId");

-- CreateIndex
CREATE INDEX "DeliveryPartnerInvitation_token_idx" ON "DeliveryPartnerInvitation"("token");

-- AddForeignKey
ALTER TABLE "DeliveryPartnerCourseAssignment" ADD CONSTRAINT "DeliveryPartnerCourseAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerCourseAssignment" ADD CONSTRAINT "DeliveryPartnerCourseAssignment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "DeliveryPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerMember" ADD CONSTRAINT "DeliveryPartnerMember_courseAssignmentId_fkey" FOREIGN KEY ("courseAssignmentId") REFERENCES "DeliveryPartnerCourseAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerMember" ADD CONSTRAINT "DeliveryPartnerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPartnerInvitation" ADD CONSTRAINT "DeliveryPartnerInvitation_courseAssignmentId_fkey" FOREIGN KEY ("courseAssignmentId") REFERENCES "DeliveryPartnerCourseAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
