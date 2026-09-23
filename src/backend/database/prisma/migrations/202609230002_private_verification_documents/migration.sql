-- Keep legacy documentUrl data for compatibility; new submissions use private bytes.
ALTER TABLE "CollegeVerificationRequest"
  ADD COLUMN "documentBytes" BYTEA,
  ADD COLUMN "documentMime" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

UPDATE "CollegeVerificationRequest" SET "reviewedAt" = "updatedAt" WHERE "status" <> 'PENDING';

CREATE UNIQUE INDEX "CollegeVerificationRequest_one_pending_per_user"
  ON "CollegeVerificationRequest" ("userId") WHERE "status" = 'PENDING';

ALTER TABLE "CollegeVerificationRequest" ADD CONSTRAINT "CollegeVerificationRequest_document_shape"
  CHECK (("documentBytes" IS NULL AND "documentMime" IS NULL) OR
    ("documentBytes" IS NOT NULL AND "documentMime" IS NOT NULL AND "method" = 'COLLEGE_ID' AND octet_length("documentBytes") BETWEEN 1 AND 4000000
      AND "documentMime" IN ('image/jpeg', 'image/png', 'image/webp')));
