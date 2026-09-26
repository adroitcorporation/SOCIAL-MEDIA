# Performance audit — 2026-09-27

## Confirmed screen-loading cause and targeted follow-up

The catch-all page remounts `CircleApp`/`useCircleController` during screen navigation. Its component-local `pageToken` marker resets, so an unchanged authenticated session repeats `/session` **before** fetching `/api/state`. The bridge itself verifies identity; on split deployments this adds another authentication/network round trip to the critical path.

Measured in an isolated local browser:

- Exactly one `/api/state` request per transition, taking 47–56 ms on the sample database. No duplicate state request was observed during ordinary navigation.
- Before the follow-up: one redundant `/session` POST on each of three screen changes, plus two during sign-in. A controlled 200 ms bridge delay confirmed the serial dependency; this is simulated latency, not a production benchmark.
- After: one initial bridge POST, zero on those three transitions. One state read per screen remains.
- The current section-comparison loop averaged 0.063 ms over 1,000 iterations of an 18,123-byte sample in Chromium. This does not establish CPU costs for large production accounts or measure React rendering.

Small follow-up: `src/frontend/api/page-session.ts` now coalesces in-flight syncs and reuses a successful same-token cookie-sync marker for at most 60 seconds across remounts. Token changes and failures trigger another sync; logout invalidates the marker and serializes deletion after pending writes. It caches no user data or authorization result. Endpoints, payloads, server authorization, and hosting configuration are unchanged by this follow-up.

Focused tests: `tests/page-session-client.test.ts` (five cases; three reproduced failures before the fix) and `tests/e2e/screen-loading.spec.ts` (real local state reads, simulated provider/session bridge).

## Earlier repository-wide audit findings and fixes

These changes were already made under the original broader audit request before the screen-loading follow-up.

| Severity | Confirmed problem                                                                                             | Implemented fix                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | Auth subscription could be installed after cleanup; SSE retained abort listeners                              | Guard async auth initialization; remove stream listeners and timers on closure/cancellation                                                         |
| P0       | Discovery loaded every skip; moderation fetched every flagged target; queued ID images downloaded immediately | SQL relation exclusions, database count, viewport-triggered private image fetching                                                                  |
| P1       | Every 3-second stream tick fetched all feature collections                                                    | Route-scoped state, 15-second visible-tab general refresh, independent 3-second chat ticks; ignore SSE ready frames                                 |
| P1       | One unread count per conversation; per-invite database loops                                                  | One grouped unread query; batch eligibility checks, member inserts, and notifications within existing transactions                                  |
| P1       | Open chat reloaded its latest 50 messages on every tick/send                                                  | `after` cursor reads, bounded 50-message deltas, deduplicated requests/results, preserved older-message pagination and scroll position              |
| P1       | Connection send/cancel/accept/reject refetched the app                                                        | Apply confirmed mutation responses to local connection state                                                                                        |
| P1       | Idea/event lists stopped at fixed caps, filtering only loaded rows                                            | 24-item server-filtered pages, deterministic ordering, debounced search; preserve partial case-insensitive idea skill search with parameterized SQL |
| P1       | Authentication rewrote unchanged profiles and changed `updatedAt` on reads                                    | Read unchanged verified profiles; retain provider verification and current account-status checks                                                    |
| P2       | All feature screens imported into the catch-all client shell                                                  | Dynamic feature imports; stable context value and unchanged state sections                                                                          |
| P2       | Full profiles repeated for every chat sender/member                                                           | Select only identity fields used by chat; omit nested chat detail on non-chat screens                                                               |

The five baseline unit-test failures involving block privacy and suspended idea creation are also fixed in the affected services. Existing authorization, RLS, private-image access, and transactional integrity remain enforced.

## Database / Supabase

Supabase supplies authentication; application data uses Prisma/PostgreSQL. No Supabase Data API `select('*')` calls or Realtime channels were present. No production database was modified.

Prisma migration: `src/backend/database/prisma/migrations/202609270001_performance_indexes/migration.sql`.

- Add `User(accountStatus, onboarded, createdAt DESC, id)` for discovery ordering/filtering.
- Add `Block(blockedId)` for reverse block lookups.
- Extend existing message, idea, and event ordering indexes with the pagination ID tiebreaker, replacing their shorter indexes.
- Add `RateLimit(expiresAt)` for existing expiry cleanup.

Generated from the Prisma schema diff and applied/tested on an isolated PGlite PostgreSQL-compatible database. Deployment still needs `npm run db:migrate`; ordinary index creation can lock writes, so schedule it for the actual table sizes.

Sample scoped response sizes: legacy full state 18,123 bytes; discovery 11,149; chat 9,666; ideas 5,674; events 3,159. These compare current scoped and legacy-full requests, not original-production latency.

## Changed files

- Backend: `auth/session.ts`; `http/api-handler.ts`, `http/live-handler.ts`; `services/{discovery,messages,ideas,conversations,moderation,query-shapes}.ts`; Prisma schema and migration above (all under `src/backend/`).
- Frontend: `api/{community-client,live-updates,page-session}.ts`; `hooks/{use-circle-controller,use-feed-filters}.ts`; `state/{circle-context.tsx,connection-update.ts}`; `components/{circle-app,student-card,feed-pagination}.tsx`; feature pages for discovery, connections, messages, ideas, events, and moderation (all under `src/frontend/`).
- Contract: `src/shared/contracts/responses.ts` (earlier audit adds feed metadata and narrows chat identities; deploy frontend/backend together).
- Tests: `tests/{performance,live-updates,page-session-client,security-auth-pass}.test.ts`; `tests/e2e/{performance,screen-loading,security-auth}.spec.ts`. Auth browser assertions were scoped to the form to exclude Next.js's route announcer.

## Verification and remaining limits

- Baseline: production build/typecheck/boundaries passed; 132/137 unit tests passed. Initial simultaneous build/tests hit a Windows Prisma engine lock; sequential build passed.
- Earlier audit: 144 unit/integration tests and all 38 browser tests passed. Focused navigation follow-up: all five unit cases and the new browser test passed.
- Final follow-up validation: `npm test` **149/149 passed**; focused navigation browser test **1/1 passed**; `npm run typecheck`, `npm run check:boundaries`, and `npm run build` **passed**. Earlier full browser suite: **38/38 passed**. Render Blueprint validation and `git diff --check` also passed. No lint command is configured.
- Production cold-start timing, real Supabase sign-in, database query plans at production scale, and real-user rendering/interaction latency remain unverified. Measure navigation-to-state timing, Render wake-up/TTFB, Supabase verification time, and `EXPLAIN (ANALYZE, BUFFERS)` before infrastructure changes or additional search indexes.
- Existing bounded caps remain for connections (500), conversations/notifications (100), and resonators (500). Profile block management still returns the user's block IDs. Monitor large accounts; dedicated pagination here remains follow-up work.
- General cross-tab updates can now take about 15 seconds; active chat polls every 3 seconds. Search and deep offset pages may still scan many rows. Profile images already lazy-load, but arbitrary external image dimensions/transfer sizes are not controlled.
