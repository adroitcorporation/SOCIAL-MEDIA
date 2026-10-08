-- Preserve both legacy byte documents and tightly scoped private Storage pointers.
ALTER TABLE "CollegeVerificationRequest"
  DROP CONSTRAINT "CollegeVerificationRequest_document_shape";
ALTER TABLE "CollegeVerificationRequest"
  ADD CONSTRAINT "CollegeVerificationRequest_document_shape" CHECK (
    ("documentBytes" IS NULL AND "documentMime" IS NULL) OR
    ("method" = 'COLLEGE_ID' AND "documentMime" IS NOT NULL
      AND "documentMime" IN ('image/jpeg', 'image/png', 'image/webp') AND (
        ("documentBytes" IS NOT NULL AND octet_length("documentBytes") BETWEEN 1 AND 4000000) OR
        ("documentBytes" IS NULL AND "documentUrl" IS NOT NULL
          AND "documentUrl" ~ '^storage://college-ids/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+$'
          AND position('..' in "documentUrl") = 0)
      ))
  );
