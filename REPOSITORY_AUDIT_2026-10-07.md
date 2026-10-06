# Repository Audit — 2026-10-07

Scope: end-to-end review of the current Founder Circle repository for correctness, security, database/API efficiency, scalability, and UX regressions. Target operating range: roughly 1,000–10,000 active students.

## Architecture reviewed

- Next.js 16 App Router frontend and route adapters.
- React 19 client shell and feature modules.
- Supabase authentication with server-side authorization checks.
- Prisma/PostgreSQL service layer and migrations.
- Recommendation subsystem with bounded database ranking and optional external AI provider.
- Render/Vercel production split, live-update stream, messaging, moderation, verification, posts, ideas, and events.
- Existing boundary, TypeScript, Vitest, production build, npm audit, and Playwright CI pipeline.

## High-confidence fixes made

1. **Fallback discovery respected skips again.**
   - Restored the missing `Skip` exclusion in the non-recommendation discovery query.
   - Strengthened the regression test by explicitly disabling recommendations so the fallback path is exercised.

2. **Reciprocal connection requests now have correct regression coverage.**
   - Preserved the current auto-accept behavior when both students request each other concurrently.
   - Updated the test to require both calls to succeed while still producing exactly one canonical, accepted relationship.

3. **Pinch zoom accessibility restored.**
   - Removed `maximumScale: 1` and `userScalable: false` from the viewport configuration.
   - Kept the responsive viewport and safe-area behavior.

4. **Critical/high production dependency advisories fixed.**
   - Upgraded Next.js from 16.3.5 to 16.4.0.
   - Upgraded sharp from 0.35.4 to 0.35.5.
   - Regenerated the lockfile and applied the compatible npm audit lockfile fixes, including the vulnerable source-map dependency.

5. **Rate-limit cleanup removed from every mutation hot path.**
   - Expired rate-limit rows are now swept at most once per minute per server instance instead of after every successful mutation.
   - Existing per-user mutation enforcement and the indexed `expiresAt` cleanup predicate are unchanged.

## Findings reviewed but intentionally not redesigned

- The live-update endpoint emits stateless refresh invalidations. The client throttles general state refreshes and uses incremental chat reads. A dedicated pub/sub layer may become worthwhile above the current target range, but replacing this architecture now would be a larger redesign.
- State snapshots still fetch bounded notification/conversation data for global badges. This is bounded and already route-scoped for heavy nested data; splitting badge counters into another endpoint would add contract and polling complexity without enough evidence at the current target scale.
- Offset pagination remains in a few moderation/feed paths. User-facing messages and posts already use stable cursor pagination. Deep moderation pagination is not a first-10k bottleneck.
- Recommendation ranking uses bounded pages, database-side filtering, block/skip enforcement, and a 1,000-profile fixture. No external provider call is required for the normal request path.
- No unsafe raw SQL calls were found. Parameterized Prisma SQL is used where raw SQL is necessary.
- Uploaded verification/event images are byte-bounded and decoded/validated before persistence. Event downloads require authenticated API access and are served with no-store/nosniff headers.

## Validation

After the first functional/accessibility patch:
- Architecture boundaries: passed.
- TypeScript: passed.
- Vitest: 261/261 passed.
- Production build: passed.
- npm audit then exposed previously hidden production dependency advisories; dependency remediation followed.

The final branch must pass the complete CI sequence, including production dependency audit and Chromium Playwright E2E, before merge.
