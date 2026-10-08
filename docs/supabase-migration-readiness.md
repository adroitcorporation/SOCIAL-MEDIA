# Supabase migration readiness — 2026-10-08

**Recommendation: NO-GO for production cutover.** Source audit and database/Auth restoration to Singapore staging are verified. Full service rehearsal, existing-login/session continuity, Storage-file transfer and rollback rehearsal remain incomplete.

## Production stability gate

Render service `founder-circle-backend` (`srv-dapbeq8ae00c73ch1l5g`) is in Singapore, on the free plan with one instance. Its deployment `dep-db3miuegekts73drobqg` reports **live** for commit `d68403c`, completed 2026-10-08 10:01:10 UTC / 15:31:10 IST. Previous commit `635a172` reports build_failed. Direct and frontend-proxied health endpoints return 200; the backend health body is `status: ok` and executes SELECT 1. Frontend /api/config reports demo=false and configured=true. This verifies deployment and database reachability, not every authenticated production flow.

Running Render rootDir is empty (repository root); build is `npm ci --include=dev && npm run build`; start is `npm start`. Render startup logs identify `aws-0-ap-northeast-2.pooler.supabase.com`, confirming a Seoul Supabase pooler connection at startup. Actual runtime connection limit, port, TLS options, app origin and secret configuration cannot be inspected with the available Render tools. The running healthCheckPath is empty, although render.yaml declares /api/health. No service setting was changed.

## Git and prior audit

Recovered remote audit branch `audit/supabase-singapore-migration-2026-10-08`, containing audit commits 1161375 and f7ee2b7. The prior note had verified source region/services/migrations but not live Render configuration, benchmarks, backups or restoration. The branch lacked d68403c; its minimal security-test fix is cherry-picked as 7ec81e2. Main is unchanged by this audit. No merge or deployment is requested by these documentation changes.

## Actual architecture and dependencies

Vercel frontend -> same-origin API rewrite -> Render Next.js Node API handlers -> Supabase token validation -> Prisma/PostgreSQL. /api/config stays local to Vercel. Browser authentication uses Supabase Auth with persisted SDK sessions; backend calls getUser on incoming tokens. Auth UUIDs must continue matching public.User.id. ApprovedCollegeDomain and confirmed account email drive domain verification; profile completion and college verification gate new connection requests.

Supabase source SOCIAL-MEDIA (`rznbuzkgzsryadokvcfh`) is ACTIVE_HEALTHY in ap-northeast-2, PostgreSQL 17.6.1.166 platform build / PostgreSQL 17.6 engine. Source database size was 19,401,875 bytes at inventory time. Following explicit organization and $0/month cost confirmation, the creation request returned `founder-circle-singapore-rehearsal` (`lxofcmzgzbgqvlmwizgm`) in ap-southeast-1. The destination is ACTIVE_HEALTHY on PostgreSQL 17.11.0.003 / engine 17.11. All five required extensions match source versions. It has zero public application tables, Auth users and Storage objects. Auth and Storage managed migration counts match source (82 and 73); a restore must still review schema compatibility.

Supabase PostgreSQL, Auth and profile-photo Storage are used. No Socket.IO dependency/handlers or Supabase Realtime subscription calls exist in the application. Live updates are authenticated SSE, with a three-second database-backed notification cadence and a 55-second stream lifecycle. Supabase has one supabase_realtime publication, but application use is absent. No Edge Functions are deployed. Recommendation jobs use database triggers and a Node worker, not Supabase Edge Functions.

Prisma reads DATABASE_URL and DIRECT_URL; startup runs migrate deploy through DIRECT_URL before starting Next. The repository Blueprint's Render-managed database is not the running database demonstrated in startup logs: do not sync it blindly. Authentication URL/key are NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY at browser build time and backend runtime. Profile-photo uploads additionally need backend-only SUPABASE_SERVICE_ROLE_KEY. APP_URL/NEXT_PUBLIC_APP_URL control redirects/origin checks; BACKEND_URL controls API rewrites.

Runtime code uses environment variables for project URLs/keys; there are no embedded production Supabase credentials/project refs in runtime source. Project-specific photo URLs are stored in User.photo; audit references to project IDs are identifiers, not credentials. README points to newagesocial.vercel.app while ARCHITECTURE.md still mentions lnmiitsocialmedia.vercel.app: actual Auth redirects and backend allowed origin must be verified, not inferred from either document.

## Read-only source integrity inventory

Inventory queries were SELECT-only. Counts are observation-time baselines, **not a consistent backup**; live writes continued. The attached source inventory JSON contains schemas, table counts, indexes, constraints, function signatures/ACLs, triggers, roles/membership and grants without user rows, passwords, tokens or key material.

- 28 public tables including _prisma_migrations; all have RLS enabled. 69 public indexes, 78 public constraints, 10 public functions, six non-internal public table triggers, 30 roles. All inventoried public constraints are validated (see JSON for definitions).
- All 13 Prisma migration records are finished with no rollback flag.
- Auth: 25 users, 25 nonempty password hashes, 25 identities, 27 sessions. No identities/sessions reference missing Auth users. All 19 application users have an Auth record; six Auth users have no application row. Preserve them; this alone is not evidence of corruption.
- Application: 27 connections, 13 messages, three conversations, nine memberships, one idea, four resonances, one post, eight verification requests, one event attachment, 67 notifications and two approved domains at the count snapshot. Preserve private verification and event attachment bytea values, not only metadata.
- Storage: one public profile-photos bucket; 11 objects, declared total 23,078,406 bytes, maximum 3,044,149 bytes, no missing buckets or objects exceeding the current 4,000,000-byte limit. MIME allowlist is JPEG/PNG/WebP. Object bytes, hashes, ownership and readability have not been downloaded/verified.
- Extensions: plpgsql 1.0, pg_stat_statements 1.11, uuid-ossp 1.1, pgcrypto 1.3, supabase_vault 0.3.1. Vault has zero secrets. Custom encrypted-column usage and platform encryption-key requirements still need backup-path review.
- Source Storage policy is the legacy authenticated own-folder INSERT policy. The restrictive policies in supabase/profile-photos.sql are **not reflected in live inventory**. Nine fc_* / membership functions are invoker functions; platform rls_auto_enable is security-definer with pg_catalog search_path. Backend-only function revocations also differ from checked-in guidance. Do not apply source policy changes as part of this migration audit; reconcile and test destination policy intent before approval.

## Encrypted source database backup

A PostgreSQL 18.3 pg_dump read-only session-pooler export succeeded using the existing local source connection, with no source writes. The custom archive is 6,299,729 bytes. It is stored only as Windows DPAPI CurrentUser ciphertext (6,299,958 bytes) at `.local/migration-backups/20261008-seoul/source-database.dump.dpapi`, inside a Git-ignored directory restricted by an owner-only ACL. Credentials were passed only through the child process environment, never command arguments or reports.

Full-archive encryption/decryption SHA-256 equality passed. pg_restore catalog inspection found required Auth users/identities/sessions, application users/messages/connections/private verification/event attachments, Prisma history and Storage metadata entries. No plaintext archive was written to disk. Database/Auth restoration is verified below; login continuity is not. Global role passwords and Storage file bytes are not included. The existing catalog inventory records role/grant metadata. The database export has its own consistent snapshot, but live Auth/Storage writes were not frozen, so cross-service consistency is not established.

DPAPI ties recovery to this Windows account/profile; a durable portable encrypted copy/recovery-key procedure is still required. No backup or sensitive export is committed. The attempted encrypted Storage-file backup command was rejected by automatic approval review as “blocked by policy”; no Storage-file export occurred, and no alternative export was attempted.

## Verified Singapore database/Auth rehearsal

The saved destination session-pooler connection now succeeds. Restore operations targeted only `lxofcmzgzbgqvlmwizgm`; production source and application settings remained unchanged. The initial whole-public restore failed with a permission error and rolled back; a read confirmed zero application tables afterward. The application-only restore excluded Supabase-owned default privileges and the platform `rls_auto_enable` helper, without escalating privileges. All application data, RLS, constraints, indexes and six application triggers restored successfully.

Auth schema compatibility checks matched all 271 source/destination column definitions. Staging has no custom Auth triggers. Its database role cannot disable `session_replication_role`; instead, Auth records were restored in foreign-key dependency order with constraints/triggers enabled and a single transaction. Managed Auth migration records were not overwritten. Reordering a custom archive over non-seekable stdin initially failed and rolled back; the corrected procedure extracted COPY blocks in memory, reordered those blocks, and streamed transactional SQL to staging without plaintext files.

Canonical row-content checks across **all 54 application/Auth tables** match the encrypted source snapshot, including UUIDs, password-hash fields and private bytea fields. Only aggregate match results are reported; no private rows or individual password hashes were displayed or committed. Staging has 25 Auth users with password hashes, 25 identities, 27 session records, 19 application users, 13 messages and 27 connections. No application-to-Auth, identity or session orphans were found. All 28 public tables have RLS; all 78 public constraints are validated; 69 indexes and six application triggers are present. Prisma `migrate status` returned success and “Database schema is up to date”; no migrations were applied.

Storage buckets/objects remain zero on staging because file transfer is blocked. Restored profile URLs still reference source photos; no URL rewrites were performed. Restored session rows **do not prove sessions will authenticate** under new project keys/issuer. Existing-password login, providers/MFA, recovery, redirects, uploads, full app flows and reverse migration remain untested. This is a verified database/Auth data rehearsal, not a complete Supabase migration.

## Access and readiness blockers

1. Singapore database/Auth data restoration and compatibility are verified. Destination Auth configuration, keys, isolated application deployment and end-to-end login/session flows still need verification.
2. PostgreSQL 18.3 tools and the encrypted database restore are verified. Storage-file export was blocked by policy. A full service backup, global-role password recovery and durable portable backup procedure remain unverified. SQL MCP was not used to export password/token data.
3. Vercel project socialmedia was discovered, but scoped project/environment inspection returned 403 for the owning scope. Vercel CLI fallback is not installed. Build-time configuration/deployment commit remains unverified.
4. Render exposes service/deploy/log reads, but no read-environment or execution capability is available here. Pool parameters and Render-origin benchmark need authorized operator access.
5. Supabase Auth provider, SMTP, callback URLs, signing keys, key rotation, project plan/backup capability and quotas are not available through the current inventory tools. No credentials or keys were retrieved.
6. No authorized migration test accounts/session fixtures or isolated app deployment. Password-hash preservation is verified; actual existing-password login, MFA/provider sign-in, old refresh/access tokens and uploads remain unverified.
7. Database/Auth backup restoration is verified, but full-service recovery and post-write rollback are untested. No cutover downtime commitment is possible.

## Validation and capacity planning

On the audit branch: TypeScript passed; all 359 tests in 31 unit/integration/security files passed; combined production frontend/Node API build passed; architecture boundaries and Render Blueprint schema validation passed. ESLint is not installed/configured. Production UI flows and destination browser tests were not executed. No production migrations or writes were performed.

Performance changes are deferred until rehearsal succeeds. Candidates to measure, not implement now: free-plan cold starts; SSE query fan-out (1,000 simultaneously connected clients imply roughly 333 notification cycles/second, each potentially issuing multiple queries); Prisma pool usage per instance; recommendation worker contention; bounded discovery queries and notification/connection indexes already present. Do not add indexes, remove indexes or size pools from registered-user counts alone. Use concurrent-active-user load, EXPLAIN plans, pg_stat_statements, pool waits, CPU and query latency after staging restoration.

## GO gates

Require all runbook acceptance checks, encrypted backup verification, two successful restore/rollback rehearsals or an explicitly reviewed equivalent, measured downtime, authenticated production stability checks, reconciled configuration/policies, destination integrity evidence and explicit user cutover approval. Current status is **NO-GO**.

Sources checked 2026-10-08: [migration overview](https://supabase.com/docs/guides/platform/migrating-within-supabase), [logical backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [clone limitations](https://supabase.com/docs/guides/platform/clone-project), [Prisma connection guide](https://supabase.com/docs/guides/database/prisma). Current clone documentation describes same-region restoration; do not assume that feature relocates Seoul to Singapore.
