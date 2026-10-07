# Repository Audit — 2026-10-07

This audit was rebased onto current main commit `0553ca57685c75612ae1097c3ca57d22d9322e3b`, including the approved-college-domain verification work that landed during the audit.

## Architecture reviewed

Next.js 16 App Router + React 19; Supabase authentication; Prisma/PostgreSQL services and migrations; recommendation engine; messaging/live updates; posts, ideas and events; moderation/RBAC; college verification; Vercel/Render split; and the repository CI/test surface.

## High-confidence fixes

- Restored skipped-profile exclusion in the non-recommendation Discover fallback and added a test that explicitly disables recommendations.
- Preserved reciprocal connection auto-accept while relying on the updated current-main regression coverage requiring one canonical relationship.
- Restored browser pinch zoom by removing restrictive viewport scaling.
- Upgraded vulnerable production dependencies: Next.js 16.3.5 → 16.4.0 and sharp 0.35.4 → 0.35.5; regenerated the lockfile and applied compatible audit fixes.
- Removed a database cleanup query from every mutation's critical path. Expired rate-limit rows are now swept at most once per minute per server instance while preserving the existing 90-mutations/minute enforcement.

## Security review notes

- Authentication is revalidated server-side and current-main college-domain approval uses exact normalized database domains plus confirmed provider email.
- Manual college-ID documents remain private database bytes with bounded image validation and moderator-only retrieval.
- Mutations enforce origin/content-type validation and a persistent per-user rate limit.
- No unsafe raw SQL APIs were found; raw queries use parameterized Prisma SQL.
- External AI provider endpoints require HTTPS in production, have timeouts, response-size bounds, and scrub public text before provider use.
- Block visibility is enforced in discovery, posts, messages and nested state queries.
- Production dependency audit is part of CI and was previously blocked by a stale unit assertion; the dependency advisories found once CI progressed were remediated here.

## Scale review notes for 1,000–10,000 active students

- Core discovery and feed queries are bounded and database-filtered; recommendation tests include a 1,000-profile fixture.
- Message and post histories use stable cursor-style pagination; broad feeds remain bounded.
- Existing indexes cover message ordering, reverse blocks, rate-limit expiry, discovery ordering, recommendation jobs/documents and taxonomy arrays.
- The mutation rate-limit cleanup hot path was reduced from one cleanup write query per mutation to one sweep/minute/server instance.
- Stateless live refresh currently emits frequent invalidations; the client throttles general snapshot refreshes and chat uses incremental reads. A dedicated pub/sub layer is a later-scale improvement, not required for the first 10k target.
- Notification and conversation badge state remains bounded in snapshots. Splitting those into a second polling contract was intentionally avoided without production evidence because it would add complexity and more requests.

## Remaining operational items

- Apply current-main database migrations in production before deploying the approved-domain verification feature.
- Confirm Render/Vercel environment variables and Supabase production email/OAuth configuration during deployment.
- For growth materially beyond the first 10k active users, revisit pub/sub for live invalidations, cursor pagination for deep moderation lists, and external object storage for growing binary attachment volume.

## Validation

The final audit branch is expected to pass the repository's full CI sequence: architecture boundaries, TypeScript, Vitest, production build, production dependency audit, and Chromium Playwright E2E. The CI result should be checked before merge.
