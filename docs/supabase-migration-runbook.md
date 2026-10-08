# Supabase Singapore migration runbook

**Prepared, not executed.** Source stays active in Seoul. Production cutover requires explicit approval after a successful rehearsal. Never use production as a restore target or run database reset/db push.

Preparation performed: approved Singapore project `lxofcmzgzbgqvlmwizgm` is healthy on PostgreSQL 17.11 with matching required extensions; a DPAPI-encrypted read-only source database archive was captured and its checksum/catalog verified. No destination restore has run. The direct destination URL could not resolve locally; use its verified session-pooler connection. Storage-byte backup was rejected by automatic approval review. See readiness for exact blockers.

## 1. Establish prerequisites

Confirm source project rznbuzkgzsryadokvcfh and authorized Singapore destination ID before every operation. Create a separate project in ap-southeast-1 only with approved plan/costs. Select PostgreSQL 17-compatible destination; verify supported versions of the five source extensions, collations, timezone, schema ownership and platform Auth/Storage migrations. Do not blindly overwrite Supabase-managed roles or schemas from a different platform version.

Obtain correctly scoped source export and destination restore credentials through a secret manager, not chat/committed files. Provision encrypted backup storage with restricted access, retention, checksum manifest and a verified recovery key. Use PostgreSQL 17-compatible client tools and discover Supabase CLI commands with --help. Do not log connection strings, roles passwords, Auth hashes or JWT keys. Source service-role credentials stay source-only; never reuse them for destination uploads.

Prepare an isolated app/backend deployment with background workers and outbound SMTP/providers disabled. Verify destination identity and prevent test email/webhook/job delivery to real users. No production credentials may be switched during rehearsal.

## 2. Capture configuration and establish a full backup

Record source Auth settings: email confirmation, password policy, SMTP, rate limits, providers/client credentials, CAPTCHA, MFA, Site URL, confirmation/recovery redirect allowlists, signing keys/rotation, JWT issuer/audience and custom access-token hooks. Store secret parts in the secret manager. Record Storage bucket limits/policies and objects, publication membership, custom roles/grants, RLS, functions/triggers/event triggers, extensions and scheduled/external integrations.

Use the current [Supabase logical backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) with source direct/session connection, never the transaction pooler. Export roles, application schema/data and supported Auth/Storage data, plus custom auth/storage policies/triggers and migration histories. Verify export contents explicitly include auth.users password hashes/UUIDs, identities, MFA and required authentication records, all public data and bytea values, _prisma_migrations, Storage metadata and custom permissions. CLI defaults and managed-schema exclusions must be inspected before accepting the archive. Inventory results in this repository are not a backup.

Separate CLI exports taken during live writes are not automatically mutually consistent. For rehearsal use a consistent database snapshot/export supported by the tools; label the snapshot time and keep Storage reconciliation manifests. Final cutover requires a write freeze covering application, Auth and Storage writers or another tested cross-service consistency mechanism.

A database backup does not contain Storage file bytes. Export every object via supported Storage/S3 API to encrypted staging storage, preserving bucket/path, content type, size, ownership and a cryptographic hash. Compare 11 source objects only as today's baseline; recount at each snapshot. Copy any required encryption root key via supported secure provider procedure if Vault/encrypted columns use it; do not put it in reports. Current Vault count is zero, not proof that every encrypted column is absent.

## 3. Restore exclusively into Singapore staging

Review role/schema restore for provider-managed conflicts; recreate destination extensions first where required. Follow supported restoration sequencing with ON_ERROR_STOP and transaction behavior. Disable application/external triggers only on staging when the supported restore requires it; restore and verify them afterwards. Never suppress restore errors without explaining each provider-managed conflict.

Restore Auth records with original UUIDs and supported hashed-password data; verify password hashes by private comparisons, not reports. Preserve approved domains, verification source/status, account roles/status, completion fields, connections, membership constraints, messages/idempotency keys, ideas/posts and private image/attachment bytes. Keep application _prisma_migrations history intact; run Prisma migrate status against staging, not migrate reset or schema recreation.

Copy all Storage bytes and reconcile bucket/object metadata using the supported API path without duplicate/orphan records. Verify hashes, names, MIME types, ownership, public/private access and byte sizes. Apply reviewed destination policy intent in a separate reviewed step; source legacy upload policies differ from current backend gateway design. Verify browser direct writes are denied under the intended destination policy and validated backend uploads still work.

Stored project-host URLs require an explicit staging-only rewrite plan. Rewrite only URLs belonging to the source Supabase bucket/path and only after the matching copied object hash is verified. Inventory User.photo, Conversation.image, post/media/text links and any other URL-bearing fields; keep external image URLs untouched. Record reversible old/new mappings. Never run broad string replacement or re-encode source photos.

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
