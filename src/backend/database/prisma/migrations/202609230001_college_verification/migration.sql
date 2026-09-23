-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('EMAIL', 'COLLEGE_ID');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CollegeVerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "collegeEmail" TEXT,
    "documentUrl" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollegeVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollegeVerificationRequest_status_createdAt_idx" ON "CollegeVerificationRequest"("status", "createdAt");
CREATE INDEX "CollegeVerificationRequest_userId_createdAt_idx" ON "CollegeVerificationRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CollegeVerificationRequest" ADD CONSTRAINT "CollegeVerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollegeVerificationRequest" ADD CONSTRAINT "CollegeVerificationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CollegeVerificationRequest" ENABLE ROW LEVEL SECURITY;