# College verification implementation

Completed the existing partial implementation without committing or deploying changes.

- Authenticated users can browse every regular section before profile completion or college verification.
- Only sending new connection requests requires college approval, enforced by the backend service. Existing connection actions, messages, ideas, events, and profile editing retain their existing permissions.
- Profile supports college-email submissions and JPG/PNG/WebP uploads up to 4,000,000 bytes. Images are decoded and sanitized on the server, stored privately, and omitted from JSON responses. Animated images and images over 20 megapixels are rejected.
- Moderators use /moderation to inspect pending submissions and private images, enter a review note, and approve/reject. Approval updates the user's flag atomically; rejection allows another submission. One pending submission per user and one decision per request are enforced.
- Submission history records applicant, method, email/image, status, reviewer, review note, and creation/update/review timestamps. Profile input cannot set verification fields.
- Existing backend/frontend/shared boundaries are preserved. The fictional demo actor is approved on fresh local seeding; existing accounts are not changed by seeding.

## Validation results

| Command | Result |
| --- | --- |
| npm run typecheck | Passed |
| npm test | Passed: 65 tests across 6 files |
| npm run check:boundaries | Passed |
| npx prisma validate --schema src/backend/database/prisma/schema.prisma | Passed |
| npm run build | Passed; Prisma generation and Next.js production build succeeded |
| npx playwright test tests/e2e/profile-form.spec.ts | Passed: 16 tests |
| npx playwright test tests/e2e/moderation.spec.ts | Passed: 2 tests |
| git diff --check | Passed |

No locked Prisma Windows DLL error occurred. An initial browser-test locator matched Next.js's route announcer as well as the intended error; it was scoped to the page content and both moderation tests passed afterward. The five database-backed community browser flows were not run in this session; the focused browser tests intercept API requests. Backend tests use real Prisma services and all migrations against isolated PGlite databases, never the live Supabase database.

## Configuration and migration

New backend-only environment variable:

```env
MODERATOR_USER_IDS=user-id-1,user-id-2
```

Use application/Supabase user IDs. Empty or missing configuration denies all moderation access. Do not use a NEXT_PUBLIC_ prefix.

Existing production variables remain required: DATABASE_URL, APP_URL, NEXT_PUBLIC_SUPABASE_URL, and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. BACKEND_URL remains an optional frontend API proxy override; LOCAL_DEMO is for local development only.

Before starting the updated application, apply the new migrations using npm run db:migrate. Production startup already runs migrations. No production migration or deployment was performed here. The private-document migration preserves legacy inline images and legacy URLs, but never fetches remote URLs. Legacy unavailable images can be rejected with a resubmission note. Resolve any duplicate pending rows from an earlier partial deployment before applying the unique pending-request index.

## All changed/new files

This inventory includes reused partial work that was already uncommitted when this task began, plus files completed or added during this task (35 files). Nothing was committed.

- `.env.example`
- `COLLEGE_VERIFICATION_REPORT.md`
- `README.md`
- `next.config.ts`
- `package-lock.json`
- `package.json`
- `src/app/[[...page]]/page.tsx`
- `src/backend/database/prisma/migrations/202609230001_college_verification/migration.sql`
- `src/backend/database/prisma/migrations/202609230002_private_verification_documents/migration.sql`
- `src/backend/database/prisma/schema.prisma`
- `src/backend/database/prisma/seed.ts`
- `src/backend/http/api-handler.ts`
- `src/backend/http/presenters.ts`
- `src/backend/services/community.ts`
- `src/backend/services/connections.ts`
- `src/backend/services/discovery.ts`
- `src/backend/services/verification-image.ts`
- `src/backend/services/verification.ts`
- `src/frontend/api/community-client.ts`
- `src/frontend/api/http-client.ts`
- `src/frontend/components/circle-app.tsx`
- `src/frontend/components/student-card.tsx`
- `src/frontend/features/moderation/moderation-page.tsx`
- `src/frontend/features/profile/profile-page.tsx`
- `src/frontend/styles/globals.css`
- `src/shared/contracts/enums.ts`
- `src/shared/contracts/requests.ts`
- `src/shared/contracts/responses.ts`
- `src/shared/contracts/schemas.ts`
- `src/shared/contracts/verification.ts`
- `tests/api-client.test.ts`
- `tests/community.test.ts`
- `tests/e2e/moderation.spec.ts`
- `tests/e2e/profile-form.spec.ts`
- `tests/verification.test.ts`
