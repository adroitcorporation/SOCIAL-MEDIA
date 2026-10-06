# Recommendations

Founder Circle uses deterministic matching by default. External enrichment is optional and server-only. Discover, ideas and events never call a model while loading. Existing profile arrays remain authoritative and unchanged; canonical values, inferred metadata and vectors live in separate documents.

## Configuration

Profile posts also use this worker. Only recent public posts contribute temporary intent; connections-only posts are excluded from enrichment and ranking. See [PROFILE_POSTS.md](PROFILE_POSTS.md) for the migration, endpoints, privacy rules and configurable decay policy. Posts never overwrite explicit profile selections.

All variables below belong on the backend. Never use a `NEXT_PUBLIC_` prefix.

| Variable                        | Default / purpose                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RECOMMENDATIONS_ENABLED`       | Enabled unless `false`; disables personalized snapshot ordering when false.                                                                        |
| `RECOMMENDATION_WORKER_ENABLED` | Set `true` on the long-lived Render backend. `scripts/start.mjs` defaults it to true if absent. Leave false on frontend-only/serverless processes. |
| `AI_PROVIDER`                   | `disabled` or unset uses local extraction; `compatible` enables the HTTP adapter.                                                                  |
| `AI_BASE_URL`                   | HTTPS OpenAI-compatible API base, such as your own service's `/v1` endpoint.                                                                       |
| `AI_API_KEY`                    | Backend provider credential.                                                                                                                       |
| `EMBEDDING_MODEL`               | Model that supports **384 dimensions** and the `dimensions` request parameter.                                                                     |
| `AI_TEXT_MODEL`                 | Optional JSON-capable chat model. Empty uses local structured extraction.                                                                          |

Missing or invalid configuration falls back to local metadata and no vectors. Provider failures store deterministic metadata and retry; they never prevent profile saves or feed reads. A self-hosted compatible embedding service is supported. The zero-provider configuration has no model/API cost; do not provision a paid service merely to enable recommendations.

Ranking policy is centralized in `src/backend/recommendations/config.ts`. Reciprocal intent and complementary skills dominate; college is a filter, not a score boost. A displayed percentage is a fit score, not a calibrated probability. Inferred interests carry only a small supplemental weight. Reasons are deterministic and limited to three. Team selection draws from at most 80 candidates, with SQL shortlisting across each required skill before greedy coverage selection.

## Optional compatible provider setup

Set `AI_PROVIDER=compatible`, `AI_BASE_URL=https://provider.example/v1` (replace with your provider's API base), `EMBEDDING_MODEL` and `AI_API_KEY` in the backend environment. Store the real key in your deployment's secret settings or an ignored local environment file, never in source control or frontend configuration. Blank required settings keep the local provider active. Add `AI_TEXT_MODEL` only if structured extraction is wanted; without it, embeddings still run and extraction stays local.

The adapter sends `POST {AI_BASE_URL}/embeddings` with `model`, scrubbed `input` and `dimensions`. The dimension count comes from `ranking.embeddingDimensions` in `config.ts` (currently 384); returned vectors must have exactly that many finite numbers and cannot be all zero. The optional `POST {AI_BASE_URL}/chat/completions` uses JSON-object mode and validates canonical labels. Inferred skills are discarded so explicit profile skills stay authoritative.

Use HTTPS without URL credentials, query parameters or fragments. HTTP loopback is allowed only outside production. Redirects are rejected. Each request has an 8-second timeout and a 100,000-byte streamed response limit. Provider failures are handled by the worker's local fallback and bounded retry queue; request-time feed reads never call the provider.

## Migration and deployment

1. Back up the target database and test these commands against staging first. Configure the existing `DATABASE_URL` and migration `DIRECT_URL` for that environment.
2. Run `npm run db:migrate`. The two additive recommendation migrations create tables, functions, RLS, indexes and transactional queue triggers; existing source selections are preserved. Do not use `db push`, reset, or a destructive seed.
3. Deploy the backend before the frontend. The existing `npm start` flow already runs migrations. Use the existing trusted Prisma database role (table owner/BYPASSRLS); browser roles have no new RLS policies or helper execution grants.
4. Set the backend worker flag to true, or run `npm run recommendations:work` repeatedly to drain the initial queue. Each CLI call handles at most 100 jobs; `--once` handles five. Normal operation processes five jobs per tick, with a 15-second pause between batches.
5. Verify `/api/health`, an authenticated `/api/recommendations/people`, and a profile save. Check worker progress using the queries below.

Commands operate on the configured database. The worker CLI requires environment variables in its process, as do production jobs. For local UI work, `npm run db:local` and `npm run demo` explicitly use the loopback sample database, including the migration connection.

The CLI does not automatically load Next.js `.env` files. To load an ignored local `.env.local` explicitly, run:

```sh
node --env-file=.env.local --conditions=react-server --import tsx scripts/recommendation-worker.ts --once
```

That file must contain the intended `DATABASE_URL` and optional provider settings. Omit `--once` for a batch of up to 100 jobs; the CLI exits after its batch and is not a daemon. `RECOMMENDATION_WORKER_ENABLED` controls the long-lived Next.js worker, not this CLI. The example environment explicitly sets it to `false`, so change it to `true` on the backend even when using `npm start`.

Changing `AI_TEXT_MODEL` invalidates cached extraction for requeued jobs while preserving embedding-model compatibility. Requeue existing records after changing this setting; configuration changes alone do not enqueue records.

After switching providers/models, or changing normalization/inference policy, run `npm run recommendations:work -- --requeue`, then drain normally. It queues source records without changing their content. After resolving an outage, `npm run recommendations:work -- --retry-failed` resets exhausted jobs and processes a bounded batch. Neither command is an automatic deployment step.

```sql
SELECT kind, count(*) AS pending, max(attempts) AS attempts
FROM "RecommendationJob" GROUP BY kind;
SELECT kind, "lastError", count(*)
FROM "RecommendationJob" WHERE attempts >= 4 GROUP BY kind, "lastError";
SELECT kind, "embeddingModel", count(*)
FROM "RecommendationDocument" GROUP BY kind, "embeddingModel";
```

Jobs use leases, unique tokens and content versions. Expired leases are reclaimable; retries stop after four attempts. Edits invalidate old documents and supersede in-flight jobs. Only relevant source text/selection changes enqueue work; name, photo, college, city and graduation-year changes do not regenerate embeddings. Deleted source records clean up their documents, jobs and target feedback.

## PostgreSQL / vector decision

The application database is the existing Prisma PostgreSQL database, which can be Render-managed; Supabase currently provides auth/storage. This implementation stores one `double precision[]` per document and uses exact database-side cosine similarity for matching model identities. It works with the existing PGlite tests and ordinary PostgreSQL without an extension or another vector database. GIN indexes cover normalized selection arrays, and queue/feedback indexes cover their access patterns.

No pgvector index is installed or claimed to accelerate this query. At the initial ~1,000-user scale, bounded results and exact SQL ranking preserve complementary/reciprocal matches. Before much larger rollout, measure `EXPLAIN (ANALYZE, BUFFERS)` on real distributions. A future pgvector HNSW candidate path can index a cast of the existing array per model/dimension, merge semantic candidates with structured-skill candidates, and rerank. Adding an unused HNSW index now would increase write/storage cost without speeding the current weighted ranking. This is an intentional scale-dependent optimization, not a requirement for enabling recommendations.

## API and security

All routes require existing active-account authentication. Mutation origin checks and rate limits remain in force.

- `GET /api/colleges?search=LNMIIT`: at most 20 catalog matches, including aliases. Custom colleges remain valid; catalog entries never grant verification.
- `GET /api/recommendations/people`: paginated ranked students, short reasons and total. Existing filters remain, with `collegeScope=mine|other` and `state` added.
- `GET /api/recommendations/ideas/:ideaId`: suggested collaborators for a visible idea.
- `POST /api/recommendations/team`: `{ideaId?, requiredSkills?, teamSize?}`; returns users, individual reasons/scores, covered/missing skills and overall compatibility. Does not invite or notify anyone.
- `POST /api/recommendations/interactions`: only `{targetId, action:"PROFILE_OPENED"}` is client-reportable. Other feedback comes from successful, authorized product actions.

Active/onboarded status, both block directions and skips apply before ranking. Ordinary Discover excludes pending/accepted connections. Idea suggestions also check author visibility. Enrichment never reads chat, ID documents, tokens or auth records. Allowlisted public text is scrubbed for email addresses, phone-like numbers and URLs before provider calls. Responses are schema/dimension checked; API responses never include enrichment documents or vectors.

Feedback stores one action/target/day, no message content or session traces. The worker removes records older than 90 days. Recent profile feedback has a small bounded influence; idea resonances also contribute capped engagement. Other stored product actions are groundwork, not a trained behavioral model. Logs contain event type, duration and attempt count, never provider bodies/keys or user text.

## Taxonomy maintenance

`src/shared/recommendations/taxonomy.json` defines separate skill, interest and looking-for concepts and aliases. `taxonomy.ts` defines selection limits (7 / 7 / 4), complementary pairs and intent-to-skill relationships. New selections use canonical labels; legacy/custom values are preserved and can be removed individually. Unchanged or reduced legacy lists above the limit remain saveable.

SQL alias/link tables mirror that configuration for ranking without loading all students into Node. Future taxonomy changes must include an additive data migration and a requeue; normalization parity tests cover every alias. Colleges are seeded into a database catalog with country/state/city fields for future expansion. JECRC University and JECRC Foundation remain distinct.

## Rollback

Set `RECOMMENDATIONS_ENABLED=false` to restore the original snapshot ordering, and `RECOMMENDATION_WORKER_ENABLED=false` to pause enrichment. Source writes still enqueue durable work. Keep the additive tables and triggers during rollback; no reverse migration or source-data deletion is needed. Remove provider credentials if external processing should stop. In-flight calls can finish until the old process exits.

## Verification

See `AI_INTEGRATION_AUDIT.md` for the baseline and final checks, and `UI_CLEANUP_AUDIT.md` for the screen/copy review. Provider responses were exercised with mocks; no live provider billing or production migration was performed.
