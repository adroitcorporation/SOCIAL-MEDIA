# Supabase migration rollback

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
