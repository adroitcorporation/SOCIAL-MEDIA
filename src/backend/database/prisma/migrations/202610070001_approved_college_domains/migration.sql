CREATE TYPE "CollegeVerificationSource" AS ENUM ('APPROVED_EMAIL_DOMAIN', 'COLLEGE_ID', 'EMAIL');
ALTER TABLE "User" ADD COLUMN "collegeVerificationSource" "CollegeVerificationSource";

CREATE TABLE "ApprovedCollegeDomain" (
  "domain" TEXT PRIMARY KEY,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovedCollegeDomain_normalized" CHECK (
    "domain" = lower(btrim("domain")) AND length("domain") <= 253 AND
    "domain" ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
  )
);
ALTER TABLE "ApprovedCollegeDomain" ENABLE ROW LEVEL SECURITY;

-- Preserve the formerly hardcoded approval, but make it revocable through the dashboard.
INSERT INTO "ApprovedCollegeDomain" ("domain") VALUES ('lnmiit.ac.in');
-- Import valid approvals left by the partial implementation. Keep its legacy record intact.
INSERT INTO "ApprovedCollegeDomain" ("domain")
SELECT DISTINCT lower(btrim(ltrim(value, '@')))
FROM "College", unnest("verifiedDomains") AS value
WHERE "id" = '__approved_email_domains__'
  AND length(lower(btrim(ltrim(value, '@')))) <= 253
  AND lower(btrim(ltrim(value, '@'))) ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'
ON CONFLICT DO NOTHING;
-- The placeholder is configuration, not a real college in student search results.
UPDATE "College" SET active = false WHERE id = '__approved_email_domains__';

-- Retain actual moderator approvals. A bare legacy Boolean is not evidence:
-- the old rejection logic also set it for any confirmed login email.
UPDATE "User" u SET "collegeVerificationSource" = r.method::text::"CollegeVerificationSource",
  "collegeVerified" = true
FROM (
  SELECT DISTINCT ON ("userId") "userId", method
  FROM "CollegeVerificationRequest" WHERE status = 'APPROVED'
  ORDER BY "userId", "createdAt" DESC
) r WHERE u.id = r."userId";
-- Domain approvals are re-established lazily from the authenticated provider email.
UPDATE "User" SET "collegeVerified" = false WHERE "collegeVerificationSource" IS NULL;
