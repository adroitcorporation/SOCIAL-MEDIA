# Seoul → Singapore Storage audit — 9 October 2026

## Approved snapshot transfer completed

Following explicit destination-only approval, all **11 approved profile images / 23,078,406 bytes** were copied to Singapore without overwrites. Completed at **2026-10-08 23:26:40 UTC / 9 October 04:56:40 IST**. All 11 source/destination SHA-256 pairs matched during transfer and again during independent, sequential authorized SDK downloads. The final inventory shows source 1 bucket / 11 objects and destination 3 buckets / 11 objects; zero missing, conflicting or extra objects. Paths, sizes, MIME and custom metadata match. Anonymous HEAD checks for all 11 destination profile images returned 200 with the expected MIME type. Both private buckets remain empty and private. Read-only SQL confirmed RLS enabled and policy definitions unchanged.

See [aggregate transfer evidence](supabase-storage-transfer-result.json). Exact file paths, byte counts and matched SHA-256 values are in the protected ignored `.local/storage-sync/completed-snapshot.json`; per-object resumable receipts remain in `.local/storage-sync/receipts.json`. Skipped: zero; failed: zero. The utility now requires the approved manifest and rejects changed source inventories/configuration or unapproved destination paths before writes.

**Storage synchronization is complete for this approved snapshot only.** This is not completion of the database/Auth migration or a production cutover. No source objects, database records, Auth, RLS, Render or Vercel settings were changed. No branch was merged or pushed and no deployment was triggered. Existing absolute Seoul photo URLs remain unchanged; reference mapping and future production-write deltas still require separate work/approval. Earlier no-transfer and missing-credential statements below are historical and superseded by this completion evidence.

## Fresh credential-backed dry run

The later read-only API inventory at **2026-10-08 23:12:27 UTC / 9 October 04:42:27 IST** confirmed the same counts: Seoul one bucket / 11 objects / 23,078,406 bytes; Singapore three buckets / zero objects. Both credential pairs were accepted by the appropriate project APIs. All 11 source object-info reads and all 11 authenticated HEAD requests succeeded; no file bodies were downloaded. Source custom metadata is empty for all current objects. Source/destination profile bucket privacy, MIME allowlist and size limit match. There are 11 missing paths, zero overlapping paths, zero conflicts and zero destination-only files.

`.env.storage-migration` is ignored and untracked. Its four values were parsed in memory without printing them or changing the root production environment. The URLs include the known REST suffix; the utility normalizes that suffix to the validated project origin and rejects other paths, swapped project refs, URL credentials/query strings and inappropriate legacy key roles. The user's existing `.gitignore` change was preserved.

Exact object paths, sizes, MIME/cache/custom metadata and versions are in the owner-only, Git-ignored report `.local/storage-sync/report-1791501147082.json`. HEAD evidence is `.local/storage-sync/read-permissions.json`. The older source-credential blocker below is resolved; transfer and upload authorization tests still require separate explicit write approval. Successful inventory reads do not prove destination upload permission or byte integrity. No cloud writes, file transfers, deployments or configuration changes occurred.

Branch: `audit/supabase-storage-singapore`. This new request supersedes the previous historical-Storage waiver for planning only. No Storage objects were transferred, changed or deleted. Production configuration and Auth are unchanged.

## Current read-only inventory

| Project                                                     | Region    | Buckets | Objects | Object bytes |
| ----------------------------------------------------------- | --------- | ------: | ------: | -----------: |
| SOCIAL-MEDIA (`rznbuzkgzsryadokvcfh`)                       | Seoul     |       1 |      11 |   23,078,406 |
| founder-circle-singapore-rehearsal (`lxofcmzgzbgqvlmwizgm`) | Singapore |       3 |       0 |            0 |

Both projects were reported ACTIVE_HEALTHY by the management API. Storage SQL inventory read bucket configuration, full object paths, sizes, MIME/cache metadata, ETags, versions, modification timestamps, custom metadata and policies. Inventories from two live projects are observation-time reads, not an atomic cross-project snapshot. The protected full-path inventory is `.local/storage-sync/inventory.json`; it is ignored by Git. The committed discrepancy report contains aggregates only.

| Bucket            | Seoul            | Singapore      | Size limit | MIME types           |
| ----------------- | ---------------- | -------------- | ---------: | -------------------- |
| profile-photos    | public, 11 files | public, empty  |  4,000,000 | JPEG, PNG, WebP      |
| college-ids       | absent           | private, empty |  4,000,000 | JPEG, PNG, WebP      |
| event-attachments | absent           | private, empty |  8,000,000 | PDF, JPEG, PNG, WebP |

All 11 source paths are absent in Singapore. There are zero destination-only objects and zero overlapping paths, so there are no observed cross-project size/ETag conflicts. Corruption is **unknown**, not zero: this audit did not download files or compute byte hashes. ETags exist on source objects but must not be assumed to be cryptographic checksums. Several different source paths have matching size/ETag metadata; preserve every path because these may be legitimate repeated uploads. Never deduplicate by hash without separate approval.

The common profile bucket has matching privacy, limits and MIME settings. The two additional destination buckets are intentional new-file infrastructure, not disposable extras. No bucket creation or update is necessary for this inventory.

## Policies and application authorization

Storage `buckets` and `objects` have RLS enabled in both projects (not FORCE RLS). Seoul has one permissive INSERT policy for authenticated users uploading to their own UUID folder in `profile-photos`. No source Storage SELECT/UPDATE/DELETE policies were listed. Public profile downloads bypass private read authorization by design.

Singapore has restrictive INSERT/UPDATE/DELETE policies denying anon/authenticated access to all three application buckets, and a restrictive SELECT policy denying private-bucket reads. There were no permissive object policies listed. Backend secret credentials bypass RLS; application authorization must run before using them. Do not copy Seoul's direct-upload policy onto Singapore: destination uploads deliberately go through validated backend routes. A private bucket flag alone is insufficient authorization; policies and backend checks both matter. [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

`src/backend/services/file-storage.ts` checks Storage/Auth URL consistency and optional expected project ref. Profile-photo upload validates actor, MIME and byte bounds; private college documents are served only through moderation permission checks in `verificationDocument`. Attachment downloads are available to authenticated active application users through the API; the current function does not impose an additional attachment-owner read restriction. Upload/delete requires the appropriate event permissions. This audit preserves that existing access model rather than claiming owner-only attachment reads. Prior isolated two-account/private-file tests are historical evidence, not new live tests in this turn.

## Database references and URL behavior

Read-only queries in both projects found five `User.photo` values pointing to Seoul Storage, four college-verification documents with database bytea content and one event attachment with database bytes. There are zero Seoul Storage URL references in college verification documents. All five source photo references resolve to inventory entries. The other six source objects are not referenced by current `User.photo` rows; that does not establish that they are safe to delete.

Restoring `storage.objects` metadata does not restore object bytes. Private legacy files in database columns are not Storage objects and are outside this tool's scope. Preserve their rows and college verification status.

Copying files with identical paths does **not** change existing absolute Seoul URLs. They still depend on Seoul availability. The Singapore app's foreign-project avatar fallback can show initials instead. A separately approved reference update/reupload strategy is required before retiring Seoul: map exact trusted source URLs to the matching destination path only after byte verification; do not rewrite arbitrary external URLs or change production records now. No URL is switched by this utility.

## Credential evidence and blockers

The following describes the earlier metadata audit; the fresh credential-backed update above supersedes its missing-source-key status.

The local public Auth URL identifies Seoul. `MIGRATION_DESTINATION_STORAGE_KEY` was accepted by Singapore's read-only `listBuckets` API, returning its three expected buckets. No secret was logged or sent to the frontend. A backend-only Seoul Storage credential is absent locally (`SUPABASE_SERVICE_ROLE_KEY` and `STORAGE_SYNC_SOURCE_KEY` are not configured). Management SQL permission does not substitute for Storage API authorization. The source API listing/download and destination upload adapter have not been validated with live authorized credentials/fixtures in this turn.

**Execution remains NO-GO:** obtain the source credential securely, run a fresh API dry-run, validate an independently approved fixture transfer, review costs and manifests, then obtain explicit approval for Singapore writes. No production cutover is authorized.

## Validation

TypeScript and production build passed. The latest full Vitest suite passed **398 tests across 39 files**, including **20 migration safety tests and five isolated credential-loading tests**. Architecture boundaries, changed-file Prettier and Git whitespace checks passed. No ESLint configuration or lint script exists, so ESLint was not run. The fresh API dry-run reported 11 missing objects and zero transfers. Stream/upload adapter behavior has code review and mock coordination coverage, but no authorized live upload test was performed; it remains a readiness gate.
