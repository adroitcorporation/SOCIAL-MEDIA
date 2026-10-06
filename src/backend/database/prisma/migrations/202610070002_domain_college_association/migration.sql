ALTER TABLE "ApprovedCollegeDomain" ADD COLUMN "collegeId" TEXT;
ALTER TABLE "ApprovedCollegeDomain" ADD CONSTRAINT "ApprovedCollegeDomain_collegeId_fkey"
  FOREIGN KEY ("collegeId") REFERENCES "College" (id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ApprovedCollegeDomain_collegeId_idx" ON "ApprovedCollegeDomain" ("collegeId");
