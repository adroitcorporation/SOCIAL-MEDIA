# Profile Posts

Implemented on 6 October 2026. Posts live on student profiles and at `/posts/:id`. There is no global post feed, follower system, reposting, or new publishing workflow.

## Existing architecture and implementation

Founder’s Circle uses Next.js App Router, React client screens, a shared typed HTTP client, an authenticated catch-all API handler, Prisma services and PostgreSQL. Supabase supplies authentication and profile-photo storage; the application database is selected by `DATABASE_URL`, whether hosted on Render or Supabase. No database host has been changed.

The feature reuses active-account authentication, mutation origin checks, the persistent rate-limit table, serializable transactions, block relationships, accepted connections, existing moderation roles/reports, profile dialogs, avatars, design tokens and the optional recommendation worker. No dependencies were added.

Profiles now have **About / Posts** navigation, both on the owner’s Profile screen and in dialogs opened from Discover. There is no standalone Projects model in this repository, so an empty Projects tab or new project system was not invented. Existing GitHub/portfolio links remain separate from posts. Media attachments, optional titles, tags, replies and project references were intentionally omitted: they were optional, and the existing upload flow is specialized for profile photos and verification documents.

The composer requires content only and offers an audience selector. It supports 10,000 characters, with no distinction between short posts and articles. Cards show author, college, date, four clamped lines, likes and comment counts; lists return only 500 characters per post. “Read more” opens the full post. Posts can be edited/deleted by their author, liked/unliked, commented on, reported and shared by copying the stable URL. Comments are flat and can be deleted by their own author.

## Database models and indexes

- `Post`: ID, author relation, per-author submission UUID, content, visibility, creation/update timestamps. Hard deletion cascades to likes/comments and removes recommendation jobs/documents.
- `PostLike`: composite primary key `(postId, userId)` guarantees one like per student; index on `userId`.
- `PostComment`: ID, post/author relations, per-author submission UUID, content and creation timestamp.
- `User`: reverse relationships to the three models.
- `Report`: optional `postId` and `postContent` snapshot. The existing moderation interface shows the reported text. Evidence remains if a post is edited/deleted; deletion clears the post relation. Reporting does not automatically restrict accounts.
- Existing recommendation jobs/documents accept kind `POST`; no duplicate embedding table or provider framework was introduced.

Indexes support `Post(authorId, createdAt DESC, id DESC)`, `Post(visibility, createdAt DESC)`, `PostComment(postId, createdAt DESC, id DESC)` and `Report(postId)`. Unique `(authorId, clientId)` indexes prevent accidental duplicate posts/comments. Database checks enforce nonblank content and length limits. Relation foreign keys include appropriate cascade/retention behavior.

Posts load lazily when opening the Posts section, in pages of 10; comments load in pages of 20. Keyset cursors use creation time plus ID, so equal timestamps and deleted cursor rows are handled without duplicates. Author projections, filtered counts and the viewer’s like state are fetched in bounded relation queries, not one query per card/comment. Full histories, full like lists and enrichment documents are never sent with profile lists.

## API

All endpoints require an active authenticated account and return `Cache-Control: no-store`. There is no unauthenticated public post API. “Everyone in Founder’s Circle” means visible to eligible signed-in students.

| Method | Endpoint                                   | Purpose                                  |
| ------ | ------------------------------------------ | ---------------------------------------- |
| GET    | `/api/students/:authorId/posts?cursor=...` | Visible profile posts, newest first      |
| POST   | `/api/posts`                               | Create `{content, visibility, clientId}` |
| GET    | `/api/posts/:id`                           | Full visible post                        |
| PATCH  | `/api/posts/:id`                           | Replace own content/audience             |
| DELETE | `/api/posts/:id`                           | Delete own post and interactions         |
| POST   | `/api/posts/:id/like`                      | Idempotent `{enabled: true/false}`       |
| GET    | `/api/posts/:id/comments?cursor=...`       | Visible comments, newest first           |
| POST   | `/api/posts/:id/comments`                  | Create `{content, clientId}`             |
| DELETE | `/api/posts/:id/comments/:commentId`       | Delete own comment                       |
| POST   | `/api/posts/:id/report`                    | Submit `{reason}` to existing moderation |

## Current intent and recommendation processing

1. A public post is saved immediately. A database trigger enqueues a versioned `POST` job in the same transaction; no provider call occurs during creation or viewing.
2. The existing worker selects only post content for eligible active authors, scrubs it and performs local extraction or optional provider extraction/embeddings.
3. Temporary structured interests, collaboration needs and optional vectors are stored in `RecommendationDocument`, separate from permanent profile arrays. Explicit skills/interests/looking-for are never rewritten.
4. Discover can use recent public post needs against the other student’s explicit skills, in either direction, plus post topics against explicit interests. Local rules recognize designer, web developer and video editor requests; canonical topic matching includes hackathons and YouTube/content creation. Other phrasing may require the optional text provider. No classification or trust badge is shown.

`ranking.posts` in `src/backend/recommendations/config.ts` centralizes the policy:

| Setting                           | Value         |
| --------------------------------- | ------------- |
| Maximum intent contribution       | 10 points     |
| Topic-only contribution           | 4 points      |
| Half-life                         | 14 days       |
| Maximum age                       | 90 days       |
| Recent posts considered           | 5 per student |
| Minimum contribution for a reason | 1 point       |

Contribution is `base × 0.5^(age in days / 14)`, measured from creation, not last edit. The strongest eligible signal wins; posting repeatedly cannot stack the bonus. This keeps post signals below explicit reciprocal intent/complementary skills. A concise “Current interests align” reason may appear, within the existing three-reason limit. Post embeddings are stored for later semantic use; this version’s Discover post contribution uses validated structured intent/topics, not post-to-post vector similarity. Idea/team ranking remains unchanged.

Only PUBLIC posts enter external processing. Connections-only posts never contribute to Discover or reach a provider. Edits invalidate old documents and supersede in-flight jobs. Switching to connections-only or deleting a post immediately removes its job/document. The worker checks the lease token and version again before writing, preventing stale enrichment from reappearing. Blocked/inactive candidates remain excluded by the existing Discover filters.

AI remains optional: unset/disabled uses local extraction and no vectors. The compatible adapter, timeout, response-size cap and configured vector validation remain in place. Inputs exclude account/auth fields, emails, IDs, chat and verification records; URL/email/phone and common token-like text are scrubbed. Only the first 6,000 scrubbed characters are processed. Provider errors preserve the post, store local fallback metadata and use the existing bounded retry queue (four attempts). Logs do not include post text or provider credentials. Scrubbing is a precaution, not a promise to detect every secret a user might type into public content.

## Privacy, safety and anti-spam

- Author IDs come from authenticated sessions; schemas reject client-supplied authors, counts or unsupported fields.
- Visibility is PUBLIC or CONNECTIONS_ONLY. Accepted connections in either direction may see the latter; removal of the connection revokes access. Both block directions and active/onboarded author status are enforced for reads and mutations. Hidden resources return “Post unavailable.”
- Comments/like counts omit blocked or inactive users. Comment loading also checks the parent post’s visibility in the actual list query.
- React renders content as escaped plain text. HTML, scripts and embedded event handlers are not executed; there is no HTML renderer or rich-text parser.
- New tables have RLS enabled with no browser policies, and browser/public table grants revoked. Access stays through the trusted Prisma backend role. No service-role credentials enter frontend code.
- Existing origin/JSON checks and the general 90 mutations/minute limit apply. Additional persistent limits allow 10 posts/hour and 60 comments/hour; comments allow 2,000 characters and post request bodies are capped at 80,000 bytes.
- Submission UUIDs and unique constraints make retries idempotent. Reusing a UUID for different content returns a conflict. UI controls disable during submission; destructive actions have confirmation copy.
- Reporting preserves evidence in the existing moderator-only queue; enforcement remains governed by existing moderation permissions. Posts do not imply identity verification.

## Migration and deployment

The additive migration is `src/backend/database/prisma/migrations/202610060001_profile_posts/migration.sql`. It creates tables/indexes/RLS and the post queue trigger, adds two nullable report columns and extends recommendation kind checks. It does not reset a database, delete profiles, wipe storage or modify existing user content.

Use the existing production `DATABASE_URL` and migration `DIRECT_URL`, then run:

```sh
npm run db:migrate
npm run build
```

This is equivalent to `prisma migrate deploy --schema src/backend/database/prisma/schema.prisma` followed by client generation and the Next.js production build. Apply the migration before deploying code that queries Post or the new Report columns. Test against staging and retain a normal backup first. Do not use `db push`, `migrate reset` or a destructive seed. Development verification used isolated test databases and the loopback demo database. At the user's subsequent request, the pending migration was also applied to the configured production Supabase database on 6 October 2026. Its migration record and RLS on all three new tables were verified; no user content was reset or seeded.

On Render, retain the existing start command; `scripts/start.mjs` already runs deployment migrations. Enable `RECOMMENDATION_WORKER_ENABLED=true` on the long-lived backend. Keep it false on frontend-only/serverless processes. The deployment must continue using its trusted Prisma database role rather than a browser `anon`/`authenticated` role. If the app database is on Supabase, use that database’s existing connection/direct migration URL; no separate Supabase CLI migration history or Storage bucket is required.

No new environment variables are required. `AI_PROVIDER=disabled` is fully supported. For optional external enrichment, configure backend-only `AI_PROVIDER=compatible`, `AI_BASE_URL`, `AI_API_KEY`, `EMBEDDING_MODEL` and optionally `AI_TEXT_MODEL`, as documented in [RECOMMENDATIONS.md](RECOMMENDATIONS.md). Never use a `NEXT_PUBLIC_` key for provider secrets.

The worker CLI handles a bounded batch and exits:

```sh
npm run recommendations:work -- --once
```

For ignored local environment files:

```sh
node --env-file=.env.local --conditions=react-server --import tsx scripts/recommendation-worker.ts --once
```

`--requeue` now includes public posts. Use it after provider/extraction-policy changes, then drain normally. `--retry-failed` resets exhausted jobs after an outage. New post saves enqueue automatically; no backfill is needed for an empty Post table. Confirm a post save, profile list, detail URL, comment and worker document after deployment. No real provider was called in tests. `render.yaml` now explicitly enables the backend worker; updating the live service and deploying code await the Render connector's required workspace selection.

## Verification

Baseline: 224 tests passed before implementation. Focused tests use isolated PGlite PostgreSQL-compatible databases, real Prisma/services/API routing, synthetic users and mocked authentication/providers. Coverage includes creation/edit/delete, session-derived ownership, unauthorized mutations, both block directions, accepted-connection privacy, stable pagination, likes/unlikes, comments/deletion, input limits, literal XSS content, persistent rate limits, reporting/evidence, current intent, decay/expiry, capped non-stacking signals, private-signal exclusion, embedding/classification failure, stale worker results and RLS. Existing HTTP provider tests continue to cover the compatible adapter.

Final results:

| Check                                           | Result                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm test`                                      | 251 passed across 19 files                                                                     |
| Focused post tests after final retry validation | 27 passed                                                                                      |
| `npx playwright test`                           | 55 passed; 2 existing RBAC tests skipped because the demo account is not an Ultimate Moderator |
| New browser tests                               | All four passed, including 390px, 768px, 1440px and Discover access                            |
| `npm run typecheck`                             | Passed                                                                                         |
| `npm run check:boundaries`                      | Passed                                                                                         |
| Prettier check on changed TS/TSX/CSS/docs       | Passed                                                                                         |
| `npm run build`                                 | Passed, including production TypeScript and page generation                                    |
| Prisma migration deployment on loopback demo DB | Passed                                                                                         |
| Migrated database vs Prisma schema diff         | Empty; no drift                                                                                |
| `git diff --check`                              | Passed                                                                                         |

Browser tests exercise real local demo API writes and clean up their own fixtures: composer, card truncation, literal HTML text, detail URL, likes/unlikes, comments/delete, edit, audience change, refresh persistence, deletion and Discover profile access. Screenshots cover 390px mobile, 768px tablet and 1440px desktop. Existing application browser tests are included in the regression run.

There is no configured `lint` script or ESLint dependency in this repository. `npm run lint` reports “Missing script: lint”; this is not reported as a passed lint run. The existing architecture boundary checker and Prettier checks cover the changed code without adding a lint dependency.

## File inventory

Created:

```text
PROFILE_POSTS.md
src/backend/database/prisma/migrations/202610060001_profile_posts/migration.sql
src/backend/recommendations/post-signals.ts
src/backend/services/posts.ts
src/shared/contracts/posts.ts
src/frontend/features/posts/post-card.tsx
src/frontend/features/posts/post-editor.tsx
src/frontend/features/posts/post-page.tsx
src/frontend/features/posts/profile-posts.tsx
src/frontend/features/profile/profile-content.tsx
tests/posts.test.ts
tests/e2e/profile-posts.spec.ts
```

Modified:

```text
RECOMMENDATIONS.md
render.yaml
scripts/recommendation-worker.ts
src/app/(circle)/[[...page]]/page.tsx
src/backend/database/prisma/schema.prisma
src/backend/http/api-handler.ts
src/backend/recommendations/config.ts
src/backend/recommendations/provider.ts
src/backend/recommendations/service.ts
src/backend/recommendations/worker.ts
src/frontend/api/community-client.ts
src/frontend/components/circle-app.tsx
src/frontend/components/circle-screen.tsx
src/frontend/features/moderation/dashboard.tsx
src/frontend/features/profile/profile-page.tsx
src/frontend/styles/globals.css
src/shared/contracts/moderation.ts
tests/community.test.ts
```

The old community test fixture was updated to apply the new migrations before testing services; its existing assertions were retained. No Home feed or Project functionality was replaced.
