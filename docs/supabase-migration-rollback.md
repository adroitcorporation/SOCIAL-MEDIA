# Supabase migration rollback

**9 October update:** the approved historical 11-image snapshot is now transferred and included in the fresh encrypted backup. Earlier waiver/empty-Storage statements below are historical. Use the [current recovery and cutover plan](singapore-production-cutover-plan.md). Off-machine Supabase service recovery and post-write reconciliation remain unverified; production is NO-GO.

**Latest recovery evidence:** a portable encrypted Singapore snapshot restored all 55 PostgreSQL/Auth tables into a fresh in-memory database with matching canonical counts/content, 188 constraints, no identity orphans and 28 public tables with RLS. A local read-only/resume/idempotency probe passed. [Evidence](supabase-disaster-recovery-evidence.json) and [key escrow, service-recovery limits and ordered cutover/abort steps](supabase-final-migration-gates.md). This does not prove Supabase Auth/Storage service replacement, deployed configuration recovery or lossless post-write rollback; those remain NO-GO gates.

**Current update:** historical Seoul Storage migration is intentionally waived. New Singapore Storage recovery (delete/reupload a synthetic college-ID file with matching integrity), synthetic Auth ban/unban recovery and two-account application checks passed; see [evidence](supabase-new-storage-evidence.json). These are component tests, not a full backup restore or deployed environment rollback. Full-service recovery, portable backups, environment recovery and post-write reconciliation remain unverified. RPO/RTO remain unmeasured and production cutover is NO-GO.

Do not restore Seoul historical objects as part of readiness. Preserve historical database-backed private documents and college verification statuses. Back up and rehearse recovery of new Singapore files before accepting production writes. Maintain the source-compatible deployment/schema for a pre-write abort: the new private-Storage build requires additive columns absent from Seoul, so simply repointing that build at Seoul is unsafe. Rollback must restore the earlier compatible build and matching public Auth configuration; no source migrations are authorized.

The following earlier observations are historical; Storage-transfer blocker statements are superseded by the waiver above.

**Full-service plan remains unverified; database transactional recovery is rehearsed. Production cutover is NO-GO.**

An encrypted source database archive restored application/Auth data to Singapore staging, with matching canonical contents across all 54 tables. This tests the database restore portion only. Storage file bytes have not been backed up; login/session behavior, reverse synchronization and DPAPI recovery on another account/machine remain unverified. These limitations prevent a tested full rollback claim.

On 2026-10-08 at 10:53:47 UTC, `scripts/migration-rollback-probe.mjs` successfully recovered four deliberate, uncommitted changes in Singapore only: application profile name, Auth sign-in timestamp, event attachment bytes and private verification document bytes. A savepoint rollback restored exact canonical whole-table digests across User, auth.users, EventAttachment, CollegeVerificationRequest and RecommendationJob. Constraints/triggers stayed enabled; no persistent changes, production writes or credential changes occurred. This is transaction rollback evidence, not backup disaster recovery or service/configuration recovery. The initial failed probe transaction also aborted without persisting changes.

The user subsequently reported existing staging login, page refresh, profile loading and logout success. The agent verified destination refresh endpoint, refreshed session persistence and matching Auth/application identity. Auth-service recovery after a replacement restore remains unverified. Storage recovery is blocked by missing file backup/transfer. Follow [the manual procedure](supabase-migration-manual-blockers.md) for an approved full-service rehearsal; do not repeat the already verified original database/Auth restoration merely to relabel it as rollback.

## Preserved recovery materials

Keep the original Seoul project active and unchanged. Keep encrypted source backups, verified Storage manifest/object bytes, reversible URL mappings, original Render/Vercel environment snapshots and frontend build/deployment references in restricted storage. Never commit secrets, hashes of individual Auth passwords, user exports or signing keys. Record the source/destination snapshot boundaries and which system accepted each write.

Before cutover, rehearse restoration to a separate disposable project and rollback of isolated backend/frontend configuration. Measure recovery time, restore every service, and test existing login and private data authorization. This audit has not established a tested rollback path.

## Abort while maintenance is still active

Abort for data/checksum mismatch, missing storage bytes, failed existing-user login, incorrect UUID linkage, unavailable database/pools, unsafe RLS/permissions, broken private-document/chat access, unacceptable error rates or unverified config. Keep writes closed. Do not continue merely because health is 200.

If no destination production writes have occurred: restore original Render database/Auth/Storage environment from secure snapshots, restart the backend with source direct/session migration configuration, restore/redeploy the source-compatible frontend build with original public Auth URL/key and canonical app origin. Validate source health/login, connections/chat, uploads and notification access. Reopen writers only after all checks pass. Do not run new migrations against source as a rollback mechanism; the application/schema must remain backwards compatible.

Do not assume browsers switch SDK sessions automatically when project ref changes. Verify logout/re-login behavior and show clear recovery instructions where necessary. Keep passwords/accounts intact.

## Failure after destination accepts writes

**Do not simply point traffic back to Seoul.** It would discard new messages, connections, passwords, account creations, uploads and other changes.

Freeze all destination writers and record a final consistent destination database snapshot plus Storage manifest. Establish changes since the cutover boundary with a tested reconciliation/change-capture strategy. Copy new/updated/deleted records and file bytes back with preserved UUIDs, relationship/idempotency constraints, Auth state and reversible URL mappings. Resolve conflicts explicitly; count comparisons alone cannot recover deleted/updated records or Auth password changes.

Reverse migration is not currently implemented or tested. If reconciliation cannot be proven, keep maintenance active and escalate to the approved migration operator/provider support for forward recovery. Never discard destination writes to meet a rollback deadline. Define the post-write rollback/reconciliation window before approving cutover.

## Completion criteria

Verify all table/key/checksum comparisons, Auth password and provider/MFA continuity, private bytea objects, Storage hashes/access, Prisma migration status, RLS/membership permissions, canonical redirects, health and main application flows. Record RPO/RTO actually achieved and remaining incidents. Retain both projects/backups and do not delete/pause source.

Current RPO/RTO: unverified. No lossless post-write rollback guarantee exists yet.
