# Operator steps for the remaining migration blockers

Production remains **NO-GO**. These steps target Singapore staging (`lxofcmzgzbgqvlmwizgm`), never Seoul (`rznbuzkgzsryadokvcfh`). Do not change live Render/Vercel credentials or signing keys.

## Execution restrictions

Both the earlier encrypted Storage export command and the later isolated local-server launch were rejected by automatic approval review with only **“blocked by policy.”** Neither rejection identified a Windows execution-policy error, security rule, or permission category. There is no evidence that changing PowerShell execution policy would solve either rejection. No blocked operation was retried through another interpreter or transport.

The instructions below are for an authorized operator to review and run in their own environment. If organizational or local policy blocks them, stop and request the approved export/runtime method from its administrator. Do not use `ExecutionPolicy Bypass`, change policy, escalate privileges, or route private exports through third-party notebooks.

## Local existing-account login

An isolated detached worktree at `.local/migration-staging-app` is prepared at commit `1659280`. It does not contain the root `.env`. The ignored `.local/staging-public.json` contains only Singapore's public Auth URL and publishable key. No server was started by the agent.

1. From `C:\SOCIAL MEDIA`, review `scripts/migration-staging-login.ps1`. It validates the Singapore session-pooler host, port and project username before launching; it never runs migrations or seeds. It scopes environment overrides to its process and restores them when the server exits. Recommendation worker and external AI provider are disabled. Backend Storage uploads remain disabled because no destination backend key is configured.
2. In your own PowerShell, run:

   ```powershell
   & '.\scripts\migration-staging-login.ps1'
   ```

   If script execution is prohibited, stop; do not change execution policy. If port 3001 is occupied, stop and identify its owner rather than terminating an unrelated process.

3. Open `http://localhost:3001/api/health` and `http://localhost:3001/api/config`. Require health 200/status=ok and config demo=false/configured=true. Confirm browser Auth requests target `lxofcmzgzbgqvlmwizgm.supabase.co`, never the source project or live Render service. API calls stay on localhost.
4. Open `http://localhost:3001/login` and enter an authorized existing account's password yourself. Do not send the password, tokens, HAR export, session JSON or private response bodies to the agent. Report only success or a sanitized error. Login may update staging Auth timestamps/session rows; the earlier snapshot comparison remains pre-login evidence.
5. Verify profile and approved-domain verification state, Discover, existing connections, existing message history and Idea Board. Use two authorized test accounts for create/accept/cancel and message delivery. Do not send test messages or connection requests to ordinary migrated users. Verify incomplete-profile connection gating and unauthorized chat/document denial.
6. Refresh the page and verify the signed-in state persists. Separately exercise SDK `auth.refreshSession()` using an approved browser test harness, then server `auth.getUser()` and an authenticated app API with the refreshed token. A page reload alone does not prove refresh-token exchange. Report booleans/statuses only; never copy tokens. Log out, then sign in again.
7. In **Singapore only**, open [Authentication → URL Configuration](https://supabase.com/dashboard/project/lxofcmzgzbgqvlmwizgm/auth/url-configuration). Read-only dashboard inspection found Site URL `http://localhost:3000` and **no redirect URLs**; no setting was changed. For local confirmation/recovery tests, the operator must set staging Site URL to `http://localhost:3001` and add exact redirect URLs `http://localhost:3001/` and `http://localhost:3001/reset-password`. These correspond to the existing browser-auth adapter; do not use broad wildcard domains. Keep production settings unchanged. Disable outbound test emails to ordinary users; use an approved test mailbox. Password sign-in does not validate email recovery/provider redirects. Verify actual confirmation/recovery/provider return behavior after the staging-only configuration correction.
8. Stop the server with Ctrl+C. Verify localhost:3001 closes and the root `.env` and production project settings are unchanged. The isolated worktree can be retained for further testing; do not recursively delete an unchecked path.

   The worktree shares the root `node_modules` through a junction. A running or lingering staging Next.js process can lock the Windows Prisma engine DLL and cause `npm run build` to fail with EPERM during generation. Identify the port-3001 listener and its Next.js parent before stopping anything; do not terminate all Node processes. During this rehearsal the identified staging server/parent had to be stopped after Ctrl+C was reported; the subsequent normal production build passed.

## Storage inventory and transfer

Baseline: one public `profile-photos` bucket, 11 objects, declared 23,078,406 bytes, 4,000,000-byte per-file limit, JPEG/PNG/WebP allowlist. All 11 owner IDs match Auth users and folder prefixes; there is no custom object metadata or disallowed MIME metadata. These SQL checks do not prove byte integrity/access. Recount immediately before transfer because source writes remain live. Four college-verification documents (5,189,494 bytes) and one event attachment (37,987 bytes) are **database bytea**, not Storage files; their encrypted-snapshot restoration is already verified. Do not export private documents again unnecessarily.

No source/destination backend Storage key is available in the local migration environment, and file export is policy-blocked. SDK/API support does not authorize circumventing that block. An approved operator needs separately scoped server-only source and destination credentials from a secret manager; never reuse the source key on the destination or put either in `NEXT_PUBLIC_*`.

### Approved SDK/API procedure

1. In the source Supabase SQL Editor, run these **read-only** queries. Keep path/owner-bearing results in restricted encrypted operator storage, not this repository or chat:

   ```sql
   select id, name, public, file_size_limit, allowed_mime_types
   from storage.buckets order by id;
   select bucket_id, name, owner_id, metadata, user_metadata,
          created_at, updated_at, last_accessed_at, version
   from storage.objects order by bucket_id, name;
   select policyname, permissive, roles, cmd, qual, with_check
   from pg_policies where schemaname = 'storage' order by tablename, policyname;
   ```

   Review schema compatibility before exporting fields if the platform changes. Inventory bucket/path identity, owner, MIME, size, cache behavior, custom metadata and public/private status. SDK `.list()` alone is insufficient for ownership: its documented response omits deprecated owner fields. [SDK listing documentation](https://supabase.com/docs/reference/javascript/file-buckets-list).

2. Use the installed `@supabase/supabase-js` version 2.116.0 in an approved isolated operator process. Construct separate source and destination clients with `auth: { persistSession: false, autoRefreshToken: false }`. Validate both project URLs before any operation. Store credentials through the approved secret manager, not command-line arguments.
3. Call `source.storage.listBuckets()` and recursively page each `source.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })`. A folder has `id === null`; recurse, and continue each page until fewer than the limit is returned. Compare the complete bucket/path set against the SQL manifest. Do not mistake the first page or root folders for the entire inventory.
4. In Singapore, create the matching bucket using `destination.storage.createBucket(id, { public, fileSizeLimit, allowedMimeTypes })`. For this baseline these are `true`, `4000000`, and `['image/jpeg','image/png','image/webp']`. If it already exists, inspect its configuration rather than blindly overwriting it. Do not create metadata-only object records through SQL.
5. Fetch original bytes through the supported Storage API: for public objects use the original, **untransformed** URL from `getPublicUrl(path)`; for private objects use authenticated `.download(path)` or a short-lived signed download. Never use resized image URLs as originals. Check HTTP/SDK errors before accepting bytes. Keep file contents only in memory for direct transfer, or in approved encrypted backup storage; calculate SHA-256 of the original bytes. No database dump contains these bytes. [Download documentation](https://supabase.com/docs/reference/javascript/file-buckets-download).
6. Upload to the **same destination bucket/path** with `.upload(path, originalBytes, { upsert: false, contentType: sourceMime, cacheControl: sourceCacheSeconds, metadata: sourceCustomMetadata })`. Obtain custom metadata/cache behavior from the reviewed manifest rather than inventing values. Never overwrite an existing destination object without first downloading and comparing it; an existing identical object can be skipped, while a mismatch must stop the transfer. [Upload documentation](https://supabase.com/docs/reference/javascript/file-buckets-upload).
7. Download every destination original and compare SHA-256 and actual byte length with the source. Re-inventory SQL and SDK bucket/path sets; require no missing/extra files. Compare MIME, bucket limits/public flag, custom metadata, cache behavior and owner semantics. Object UUIDs, provider timestamps/version and service-role upload ownership can change; record those differences. The SDK upload does **not** promise preservation of source owner IDs. If an access policy depends on original ownership, stop and obtain a provider-supported ownership-preserving migration procedure. Do not directly rewrite managed `storage.objects` to conceal differences.
8. Save a restricted encrypted manifest of bucket/path, original/destination hashes, lengths and metadata differences, plus the encrypted file backup and tested recovery key. Publish only aggregate verification results. Recount source at the end; changed/new/deleted objects require reconciliation. A live-write copy is a rehearsal, not a cutover-consistent snapshot.
9. Review `supabase/profile-photos.sql`, then apply it **only in Singapore** using that project's SQL Editor. This implements the application's backend-only validated upload policy; it intentionally differs from the legacy source own-folder INSERT policy. Verify anon/authenticated direct INSERT/UPDATE/DELETE are denied, public photo reads work, and a destination-key backend upload succeeds for an authorized account. Test invalid MIME/oversize/another user's path. Do not apply this policy to Seoul as part of migration.
10. Verify database-private-file routes: unauthenticated callers are denied; verification documents require authorized moderation access; event attachment access follows the application's authenticated event rules. Use approved fixtures and record HTTP status/content hash only, not private contents. Database integrity proves preserved bytes, not authorization behavior.
11. Only after each object's integrity/access checks pass, prepare a staging-only `User.photo` URL mapping. Restrict it to the source host plus `profile-photos` path, preserve external URLs, and keep an encrypted reversible mapping. No URL rewrite has been run. Source-linked photos rendering successfully is not proof that staging Storage works.

Supabase's [official restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/dashboard-restore) also links a Storage transfer utility. Review its current code, credential handling, encryption and supported ownership behavior before adoption. Its third-party notebook workflow has not been approved or used here.

## Full rollback rehearsal still required

The SQL savepoint probe is verified, but cannot exercise Storage service recovery, Auth login recovery or a deployment environment switch. Follow `supabase-migration-rollback.md` in a separately approved disposable recovery project. Capture destination configuration securely, restore the encrypted snapshot and approved file backup, validate Auth login/refresh and authorization, then switch **isolated staging** app configuration between the rehearsed environments and rebuild public Auth values. Restore the original staging configuration and retest. Never use Seoul as the restore/reconciliation target during a rehearsal. Record elapsed recovery time and measured data-loss boundary; until this passes, RTO/RPO remain unverified.
