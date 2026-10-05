# Recommendation integration audit

Date: 2026-10-05. Written before implementation.

## 1. Current architecture

One Next.js 16.3 application, separated into app adapters, backend services/Prisma, frontend React features, and shared Zod/DTO contracts. Production Vercel forwards API requests to the existing Render backend. Supabase provides identity and profile-photo storage; application tables are accessed with Prisma, not the browser Data API. No infrastructure replacement is needed.

## 2. Current discovery

`services/discovery.ts` provides screen-scoped snapshots. Discover selects 12 profiles ordered by creation date, with explicit text/array filters, active/onboarded checks, bidirectional block exclusions, skips and accepted-connection exclusions. No compatibility ranking, embeddings or match reasons exist. Ideas use 24-row pages ordered by recency; events use dates. The swipe screen needs continuation beyond its first batch.

## 3. Database

Reviewed all seven migrations and User, Connection, Block, Skip, Idea, IdeaResonance, Event, SavedEvent, Conversation, ConversationMember, Message, moderation, verification and rate-limit relationships. Existing transaction/deferred-membership constraints protect chat/groups. Recommendation storage will be additive and will not replace these relationships.

## 4. Profile and college data

Skills, interests, domains and lookingFor are independent arbitrary string arrays, currently capped at 20. The form exposes many checkbox suggestions and comma-separated values. Primary skill suggestions contain languages/frameworks. Colleges are two frontend strings; the LNMIIT login-email verification rule is a separate security rule and must remain unchanged. Unknown college/taxonomy values must survive normalization. No private-profile setting or project entity exists: recommendation visibility will follow active/onboarded and block rules, and no project data will be invented.

## 5. Reusable infrastructure

Reuse bearer authentication, active-account authorization, mutation origin checks/rate limiting, presenters, typed API client, existing feature UI, page pagination, PGlite integration tests, Prisma migrations and the same Render process. Reuse existing connections/resonances/saves for trusted behavior signals. Keep SSE/chat untouched.

## 6. Performance findings

- Existing batched unread counts and bulk group membership inserts already avoid common N+1 queries.
- Discovery fetches complete User rows but only 12; recommendations should return bounded IDs first, then one profile fetch, never load the population into Node.
- Skills use raw exact array matches, so aliases fail. Normalized indexed document arrays will support canonical matching.
- Notifications/conversation summaries are still fetched for navigation badges on most snapshots. Do not add another recommendation polling request.
- Existing state requests are coalesced; the controller can display the prior view while a new view loads (known baseline browser regression from the UI cleanup). This is outside matching logic.
- Existing offset pagination is acceptable initially; deep-page and vector query plans need production measurement before scaling.
- There is no queue or background worker. A durable PostgreSQL job table with leases/retries is sufficient; no Redis dependency is justified.

## 7. Security

All new public endpoints must use existing authentication and active-account middleware. Target visibility must be checked in SQL before ranking, including team/idea suggestions. No auto-invites or notifications. Provider inputs are allowlisted public recommendation fields and scrubbed for emails/URLs; never read messages, verification records or tokens. Validate provider responses and embedding dimensions/model identity. Do not serialize internal enrichment documents through Student DTOs. New tables enable RLS with no browser policies; access is server-only. College aliases never grant verified status.

## 8. Proposed architecture

Shared broad taxonomy and alias normalization; database-backed college catalog with city/state/country and aliases; searchable accessible profile chips. Preserve original profile arrays and derive canonical documents, rather than rewriting historical data. Enforce configurable limits on new selections with a safe path for unchanged legacy lists.

Profile/idea/event writes enqueue durable jobs atomically via database triggers. Relevant-field changes invalidate stale enrichment; the worker normalizes first, then optionally enriches/embeds with a server-only provider abstraction. Missing credentials use local deterministic metadata, never fake semantic vectors. Content hashes and provider/model identifiers prevent repeated or incompatible embedding calls. PostgreSQL leases handle retries and process restarts.

Database-side ranking combines reciprocal intent, complementary skills, interests, collaboration intent, freshness, bounded behavioral signals and optional stored-vector similarity. College affects filters only. Reasons are deterministic, capped at three short chips. Ideas/events rank in SQL; team suggestions use a bounded candidate set and greedy uncovered-skill coverage, not just similarity.

## 9. Database changes

Add College, RecommendationDocument, RecommendationJob and RecommendationInteraction plus indexes and RLS. Keep existing profile and business tables intact. Store one embedding array per document for compatibility with existing Render PostgreSQL/PGlite. Optional pgvector expression indexes can index that same array on Supabase without maintaining duplicate vectors. No mandatory extension dependency for normal operation. Use parameterized queries and no SECURITY DEFINER functions.

## 10. Migration and rollout

Use the existing Prisma migration workflow, not a second Supabase migration history. Additive SQL creates tables/functions/triggers and queues existing records; original user selections stay untouched. Apply `npm run db:migrate` to a backup/staging database first, then run the bounded backfill worker. Deploy backend before frontend. No reset, destructive seed, production migration or external-provider calls will be run by this implementation. Document optional provider/vector setup and rollback by disabling recommendations/worker, leaving source data intact.

## Baseline

- `npm test`: 158/158 passed before edits.
- Browser baseline started before edits; results recorded in the final verification section.
- No lint script currently exists. Boundary checking, TypeScript, formatting checks and production build are available.

## Sources checked

- Installed Next.js docs: client boundaries and `after` lifecycle. Durable jobs remain necessary even with post-response execution.
- [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns): dimensions and model identity must match.
- [Supabase HNSW indexes](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes).
- [PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html): bounded selection and row locking.
- Supabase changelog reviewed; no existing auth/storage API upgrade is part of this change.
