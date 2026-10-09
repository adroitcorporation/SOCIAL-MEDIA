# Supabase Singapore migration runbook

**9 October update:** follow [the current plan](singapore-production-cutover-plan.md). The 11 approved historical images are synchronized, but no additional transfer or cloud mutation is authorized now. Earlier waiver/blocked-transfer instructions below are historical. Current source drift, extra destination grants, deployed fixture verification, all-writer freeze and independent recovery remain NO-GO gates.

Use [the final-gate deployment/recovery/cutover procedure](supabase-final-migration-gates.md) for the current ordered plan. It is prepared only: no push, merge, deployment or production freeze/cutover is authorized in this turn. Portable local database recovery and application maintenance tests now pass; full platform/deployed rehearsals remain mandatory before GO.

**Current policy:** historical Seoul Storage migration is waived. Earlier transfer/export instructions below are superseded and must not be executed. Use [current readiness](supabase-new-storage-readiness.md) and [manual configuration](supabase-migration-manual-blockers.md). New Singapore buckets and private-file authorization are tested; production cutover is still NO-GO pending deployment, full recovery and all-writer freeze/reconciliation. No live configuration change is authorized.

**Partially executed on Singapore staging only.** Source stays active in Seoul. Production cutover requires explicit approval after a successful full rehearsal. Never use production as a restore target or run database reset/db push.

Performed: destination `lxofcmzgzbgqvlmwizgm` is healthy on PostgreSQL 17.11 with matching extensions and a working session-pooler connection. The encrypted source archive restored application/Auth data, and all 54 table-content comparisons pass. Prisma status is up to date. Provider-owned default grants/helper were excluded; Auth COPY blocks were ordered by foreign keys in memory, with constraints/triggers enabled. Storage-file backup remains rejected by automatic approval review. Full application/Auth behavior and rollback remain untested; see readiness for evidence and blockers.

Follow-up: isolated localhost staging is running after operator launch; the user reports existing-account login, page refresh, profile loading and logout success. Runtime database/Auth/API routing checks passed. Stored photos still reference source Storage. A staging transactional rollback probe and paired local-client SELECT 1 benchmark passed; neither is full-service rollback or Render-origin performance evidence. Source/destination published ES256 keys differ, so session continuity must not be assumed. Use [the exact manual blocker procedure](supabase-migration-manual-blockers.md) for permitted Storage SDK/API transfer and remaining Auth/rollback checks. Do not retry policy-blocked operations through another mechanism.

Destination refresh endpoint, resumed session after reload, Auth/application identity linkage and five authenticated read flows are now agent-verified. Anonymous API and malformed JWT denials passed. Old production sessions, redirects, two-account mutations, private-file authorization and full-service rollback remain unverified. Temporary local-only audit instrumentation was removed; no runtime application changes are included in this commit.

## 1. Establish prerequisites

Confirm source project rznbuzkgzsryadokvcfh and authorized Singapore destination ID before every operation. Create a separate project in ap-southeast-1 only with approved plan/costs. Select PostgreSQL 17-compatible destination; verify supported versions of the five source extensions, collations, timezone, schema ownership and platform Auth/Storage migrations. Do not blindly overwrite Supabase-managed roles or schemas from a different platform version.

Obtain correctly scoped source export and destination restore credentials through a secret manager, not chat/committed files. Provision encrypted backup storage with restricted access, retention, checksum manifest and a verified recovery key. Use PostgreSQL 17-compatible client tools and discover Supabase CLI commands with --help. Do not log connection strings, roles passwords, Auth hashes or JWT keys. Source service-role credentials stay source-only; never reuse them for destination uploads.

Prepare an isolated app/backend deployment with background workers and outbound SMTP/providers disabled. Verify destination identity and prevent test email/webhook/job delivery to real users. No production credentials may be switched during rehearsal.

## 2. Capture configuration and establish a full backup

Record source Auth settings: email confirmation, password policy, SMTP, rate limits, providers/client credentials, CAPTCHA, MFA, Site URL, confirmation/recovery redirect allowlists, signing keys/rotation, JWT issuer/audience and custom access-token hooks. Store secret parts in the secret manager. Record Storage bucket limits/policies and objects, publication membership, custom roles/grants, RLS, functions/triggers/event triggers, extensions and scheduled/external integrations.

Use the current [Supabase logical backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) with source direct/session connection, never the transaction pooler. Export roles, application schema/data and supported Auth/Storage data, plus custom auth/storage policies/triggers and migration histories. Verify export contents explicitly include auth.users password hashes/UUIDs, identities, MFA and required authentication records, all public data and bytea values, _prisma_migrations, Storage metadata and custom permissions. CLI defaults and managed-schema exclusions must be inspected before accepting the archive. Inventory results in this repository are not a backup.

Separate CLI exports taken during live writes are not automatically mutually consistent. For rehearsal use a consistent database snapshot/export supported by the tools; label the snapshot time and keep Storage reconciliation manifests. Final cutover requires a write freeze covering application, Auth and Storage writers or another tested cross-service consistency mechanism.

A database backup does not contain Storage file bytes. Historical Seoul objects are intentionally excluded: do not export or copy them. Prepare durable encrypted backup/recovery for new Singapore files. Current Vault count is zero; review any required platform encryption material through supported procedures without reporting keys.

## 3. Restore exclusively into Singapore staging

Review role/schema restore for provider-managed conflicts; recreate destination extensions first where required. Follow supported restoration sequencing with ON_ERROR_STOP and transaction behavior. Disable application/external triggers only on staging when the supported restore requires it; restore and verify them afterwards. Never suppress restore errors without explaining each provider-managed conflict.

Restore Auth records with original UUIDs and supported hashed-password data; verify password hashes by private comparisons, not reports. Preserve approved domains, verification source/status, account roles/status, completion fields, connections, membership constraints, messages/idempotency keys, ideas/posts and private image/attachment bytes. Keep application _prisma_migrations history intact; run Prisma migrate status against staging, not migrate reset or schema recreation.

Provision new Singapore buckets with `supabase/file-storage.sql`; do not populate them with historical Seoul files or metadata. Verify new synthetic uploads, integrity, ownership authorization, private access, deletion and recovery. These checks now pass in the recorded direct API-handler rehearsal; a deployed staging integration test remains required.

Keep historical photo URLs unchanged in the database. The existing Avatar fallback displays initials when a Storage photo belongs to a different project than the active Auth/Storage project. Offer optional reupload through the existing profile flow. Preserve external images, historical verification status and database-backed private documents. Review any newly discovered historical private Storage references for retention requirements before cutover.

## 4. Configure and verify isolated application

Use destination project URL/publishable key in frontend build and backend runtime, and destination service-role key only in backend runtime. Rebuild the frontend: changing runtime variables alone does not update NEXT_PUBLIC_* values. Leave production Vercel/Render settings unchanged.

For Prisma 6.19.3, select a tested direct/session runtime connection for the persistent Render process, or supported transaction pooling with the documented prepared-statement settings. Keep DIRECT_URL on direct/session mode for migrations; do not transaction-pool migrations. Verify TLS, connectivity, pooler port and instance/worker pool budget. Preserve serializable transaction/conflict retry behavior. Size total pools below destination connection capacity and validate transaction pooling in staging, rather than adopting an arbitrary connection_limit.

Configure staging Auth callback Site URL and exact confirmation/recovery redirects for its isolated hostname. Do not remove the existing production callback allowlists. Old tokens generally have source issuer/signing state and SDK storage is project-specific. Assume a controlled re-login may be needed; never promise refresh-token/session continuity until tested. Do not disable JWT verification or share unrelated keys to bypass this.

## 5. Rehearsal acceptance evidence

Record source snapshot and destination counts for every table; compare PK sets and secure full-data/bytea checksums, not counts alone. Check FK orphans, duplicates, validated constraints, owner/membership integrity, index/function/trigger definitions, permissions/RLS and completed migration histories. Auth acceptance includes existing password login without reset, UUID linkage, verified/unverified behavior, provider/MFA flows, and rejection of unauthorized tokens. Existing sessions, refresh, logout/login and recovery must have separately documented outcomes.

Using approved test accounts in staging, verify registration/confirmation, approved-domain auto-verification and revocation, profile-completion gating, connection creation/cancel/accept/block, direct/group messaging, membership removal, idea resonance/group creation, posts, events/attachment access, moderation roles, notifications/SSE and Storage uploads/reads/denials. Confirm lost-access users cannot read private documents or chat history.

Run typecheck, unit/integration/security tests, production build, applicable browser tests and paired benchmarks from the Render-origin staging host. Restore a second isolated copy from the backup and rehearse rollback. Capture timings, integrity outputs and test results without private rows. No rehearsal step is complete until its evidence exists.

## 6. Production cutover — approval gate

Present destination/project IDs, rehearsal evidence, measured downtime, rollback decision window and unresolved findings for explicit user approval. **Stop here until approved.**

After approval, announce the maintenance window. Freeze all application/worker/SSE-triggered writes plus independent Auth signup/profile updates and Storage uploads without deleting, pausing or changing the original project. The freeze mechanism must be rehearsed and approved: an app banner alone does not stop direct Supabase writers. If current external/direct Auth/Storage writers cannot be reliably frozen, abort cutover or use a tested synchronization mechanism.

Take and verify the final consistent encrypted backup and final Storage manifest. Restore/synchronize destination and validate all acceptance checks. Capture original Render/Vercel config/deployment references securely. Update approved Render DATABASE_URL, DIRECT_URL, Auth URL/public key and backend storage key; update approved Vercel build-time Auth values and any local database handler settings; preserve the Render BACKEND_URL routing destination. Verify production origin and destination Auth redirect URLs. Restart/redeploy backend and rebuild frontend in coordinated maintenance, allowing for both platform deploy durations.

Before opening writes, smoke-test health, existing-password sign-in, verification/profile state, connections, chat/SSE, private attachments/IDs, notification access, public photos and authorization denials. Compare data again. Decide GO or rollback while writes remain frozen. After GO, monitor errors, pool waits, query latency, auth failures, 429s, worker queue, uploads and delivery; maintain source and backups unchanged for the approved retention period.

Downtime is **not yet measured**. Budget = freeze + final export/copy + restore/checks + deployments/rebuild + smoke tests + rollback reserve. The observed ~19 MB database/~23 MB Storage do not justify a timing guarantee.
