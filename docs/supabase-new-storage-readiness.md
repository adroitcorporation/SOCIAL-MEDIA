# New Singapore Storage readiness — 2026-10-08

**Production decision: NO-GO pending the documented manual gates.** Historical Seoul Storage transfer is intentionally waived. Seoul files and production configuration remain unchanged.

## Implementation and inventory

Profile-photo uploads retain the existing validated backend route. New college IDs and event attachments use backend-only Singapore Storage with `FILE_STORAGE_MODE=supabase`; database mode preserves compatibility. Private reads remain proxied through existing authorized routes. Clients cannot upload or directly read/sign private objects. Public profile photos remain public.

Private uploads happen before the database transaction, with cleanup on failure. Attachment deletion retains a hidden tombstone until provider deletion succeeds, allowing retry. Event deletion removes attachments before metadata cascades. Provider and SQL operations are not atomic: interrupted operations require reconciliation/backup monitoring.

Buckets: `profile-photos` public, JPEG/PNG/WebP, 4,000,000 bytes; `college-ids` private, same image types/limit; `event-attachments` private, PDF plus images, 8,000,000 bytes. Restrictive policies deny client writes/private reads. Backend secrets remain server-only. Expected-project guards reject mismatched Auth/database/Storage endpoints when configured.

Restored-data inventory found five user-photo references to Seoul Storage, no source Storage conversation-image or college-document references, four preserved database-backed college IDs (5,189,494 bytes), one database-backed attachment (37,987 bytes), and twelve verified users. Verification statuses were not reset. No college-ID record was flagged as lacking retained bytes/legacy inline documents by the inventory predicate; this is technical inventory, not a legal retention determination.

With Singapore active, Avatar uses its existing initials placeholder for foreign-project Supabase Storage photo URLs. Database URLs remain unchanged and reversible; external non-Supabase photos remain allowed. Users may optionally reupload through the existing profile flow. No historical photo bytes were read or transferred. Legacy private database documents remain available to authorized staff.

## Verified evidence

`supabase-new-storage-evidence.json` records a successful real-service rehearsal with two disposable Singapore accounts: profile upload/download integrity; private college-ID authorization and integrity; signed-URL expiry; synthetic Storage recovery; attachment upload/download/deletion and ownership; connection request/acceptance and messaging; synthetic Auth recovery; exact recovery redirect. Fixture cleanup and preserved historical verification count passed. SHA-256 comparisons happened in memory; no credentials, tokens or private document contents are reported.

Earlier completed evidence remains valid: all 54 database/Auth tables restored and compared; existing-account login reported by the operator; destination refresh and matching Auth/application identity observed by the agent. Signing keys differ, so production session continuity is not guaranteed; plan re-login. Provider/SMTP/MFA and full-service recovery are not established by these tests.

Latency results remain in `supabase-migration-benchmarks.md`; no new performance improvement is inferred from Storage tests. A local build is distinct from a deployed Render/Vercel integration test.

## Local validation

TypeScript typecheck, production build (including Next TypeScript), all 366 tests in 33 files, architecture boundaries and Render Blueprint validation passed. Formatting is checked with the installed Prettier. No ESLint dependency/configuration or lint script exists; ESLint was not reported as passed. The first build attempt hit a shared Prisma DLL lock while the synthetic rehearsal was running; it passed after that process exited. No execution-policy bypass was used.

Post-cleanup Singapore SQL confirmed 25 Auth users, zero orphan identities/application users, twelve verified users, zero Storage objects and fifteen finished Prisma migrations. Synthetic accounts/files were removed; these zero objects do not imply historical files were migrated.

## Remaining approval gates

Follow `supabase-migration-manual-blockers.md` for exact configuration and deployment/recovery/writer-freeze gates, and `supabase-migration-rollback.md` for recovery boundaries. Do not execute production cutover or delete/disable Seoul without explicit approval.
