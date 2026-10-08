# Final migration gates — 8 October 2026

**Decision: NO-GO for production.** Commit `aea961c` component evidence remains valid. This follow-up prepares isolated deployment configuration, verifies portable database recovery and tests an application maintenance switch. It does not deploy staging, freeze production or establish Supabase service disaster recovery.

## Verified now

- Typechecked application maintenance switch: with `MIGRATION_MAINTENANCE=true`, all data API routes return 503 before authentication, request parsing or rate-limit/database writes. Only exact GET health/config routes remain available. New SSE streams and Auth-to-application identity synchronization are blocked; recommendation jobs return without writes. Normal behavior resumes when unset/false. Requests already running must drain, and all process instances must restart with the intended configuration.
- Singapore-only portable encrypted backup: PostgreSQL custom archive of `public` and `auth`, counts/content digests from the same exported repeatable-read snapshot, constraints, Storage policies, bucket configuration and Singapore file manifest/bytes. Backup read operations use Singapore only; no Seoul object operation occurs. Current Singapore Storage inventory is **zero objects**.
- AES-256-GCM authenticated encryption/decryption passed. A fresh process decrypted the backup with its separate recovery key. Wrong-key, ciphertext/header/nonce/tag corruption, truncation and empty COPY-block tests pass. Recovery is not tied to Windows DPAPI. Backup and key are excluded from Git and protected by owner-only Windows ACLs.
- PostgreSQL recovery into an isolated **in-memory** database: all **55 tables** have identical counts and canonical content digests, **188 comparable constraints** match, identity/application relationships have no orphans and **28 public tables** retain RLS. This count includes the Auth managed migration ledger for local verification; never overwrite a managed Supabase ledger during project recovery.
- Local transaction freeze/resume probe rejected a write in read-only mode and resumed with one row after a repeated idempotent fixture insert. This verifies a local mechanism, not a source Supabase platform freeze or production synchronization.
- Prepared `deployment/render.singapore-staging.yaml` validates against Render's official schema. Separate backend/frontend names, audit branch, automatic deployment off, explicit Singapore refs, no Render database provisioning, backend-only Storage secret, frontend without database/migration credentials. Existing `render.yaml` resources remain unchanged.
- Prepared `deployment/source-maintenance.patch` against the deployed source commit `d68403c`. Patch applicability, its three targeted tests and TypeScript passed in a detached local source checkout. The patch includes only the maintenance helper, API/Auth/SSE/worker guards and their tests; it excludes destination schema, private-Storage changes and startup migrations. It is a separately reviewable source-compatible maintenance candidate, not a deployment authorization. Its deployed/full source-build rehearsal remains required.

Observed backup duration: **37.08 seconds** for the corrected snapshot. Latest recovery duration is recorded in `supabase-disaster-recovery-evidence.json` (about 3.5 seconds locally). These are local component timings, not production downtime or RTO. Source/destination network benchmarks remain in the previous benchmark report; no new latency improvement is claimed.

The verifier normalizes timestamps to UTC and sorts canonical rows with `COLLATE "C"`. Initial attempts exposed Windows COPY line endings/empty blocks and timezone/collation differences; corrected comparisons preserve data and fail on mismatches. A socket-based local restore had a connection reset, so recovery uses the documented PGlite virtual Blob COPY interface without a listening server. This is not a retry of the previously policy-blocked staging app launch.

## Portable recovery materials

Encrypted backup: `.local/migration-backups/20261008-singapore/singapore-backup.enc`.
Separate key: `.local/migration-recovery-keys/singapore-recovery-key.bin`.
The original local-collation Singapore archive is retained separately; all old Seoul DPAPI materials are preserved.

The key is binary and secret: do not print it, paste it into chat or commit it. Before GO, the operator must escrow it in an approved password manager/KMS or protected recovery medium **separate from the encrypted backup**, and copy the ciphertext to durable restricted backup storage. Merely having separate directories on this machine does not survive loss of this machine. Verify retrieval/decryption on a second authorized machine.

To repeat **offline local recovery**, copy the ciphertext and key into the same ignored directory layout on a trusted machine, protect both directories, and create their `owner-only-confirmed.txt` markers only after validating ACLs. Install the pinned repository dependencies and PostgreSQL client tools. Set `MIGRATION_POSTGRES_BIN` to the client bin directory if it differs from the Windows default. Run:

```powershell
node scripts/migration-portable-backup.mjs --restore-only
```

This mode does not connect to Supabase or require database credentials. It restores only into new in-memory PGlite and writes aggregate evidence; decrypted SQL/data never become plaintext files. Database dumps contain sensitive Auth/password-hash/private-document data even though plaintext passwords are never requested.

To take another Singapore backup, first verify owner-only directories and the destination migration credentials in the ignored environment, then run `node scripts/migration-portable-backup.mjs`. It is deliberately limited to the approved Singapore project. New backups retain a timestamped immutable ciphertext alongside the refreshed `singapore-backup.enc` convenience copy. Do not adapt it to download historical Seoul files.

## Deployed staging — prepared, not executed

The user prohibits push and deployment in this turn. Read-only Render inspection shows only the existing production backend on `main`, automatic deployment enabled, root directory empty, build `npm ci --include=dev && npm run build`, start `npm start`, and an empty live health-check path. No setting was changed. The separate staged Blueprint sets `/api/health` for the backend and `/api/config` for the frontend. Verify plan quotas/costs before creating either resource.

Vercel lists project `socialmedia`, but project details return **403 forbidden** for the available scope. No credential/environment read or modification was attempted through a bypass. An authorized operator must inspect the project or use a separately authorized project. Do not link a local staging checkout to the production Vercel project.

After separate approval:

1. Push the reviewed audit commit without merging `main`. Create a **new** Render Blueprint using `deployment/render.singapore-staging.yaml`; confirm that only the two staging names appear and no database/production resource is scheduled for update. If custom Blueprint paths are unavailable, create two new services manually with these exact settings. Approve any quoted cost separately.
2. Supply Singapore DB URLs and backend secret only to the backend. Use Singapore runtime/session pool settings compatible with Prisma and a non-transaction direct/session connection for migrations. Set backend `APP_URL` and `NEXT_PUBLIC_APP_URL` to the actual staging frontend HTTPS origin. Keep demo/AI/external integrations disabled and worker off for controlled tests.
3. For Vercel, create a separate Next.js project with repository root, `npm ci --include=dev` and `npm run build`. Set Singapore public Auth URL/key/ref, actual staging `BACKEND_URL`, `REQUIRE_EXPLICIT_BACKEND_URL=true`, `NEXT_PUBLIC_APP_URL`, demo false and worker false. Set no database URL, direct URL or service-role secret on the frontend. The Render frontend in the Blueprint is the equivalent fallback. Its start command runs Next directly, not database migrations.
4. Configure Singapore Auth Site URL to the actual stable staging frontend origin; add exact root and `/reset-password` redirects. Keep approved localhost redirects only if still needed. Verify SMTP delivery, providers and MFA modes actually used. No wildcard production redirect should be introduced to make staging work.
5. Deploy only the new services/project. Inspect the frontend's baked Auth config, backend project guard/startup logs, migrations and Storage target. With the public key, attempt direct private reads/writes and confirm denial. Verify traffic goes to Singapore and the dedicated staging backend; an old source photo rendering is not evidence of isolation.
6. With authorized disposable accounts, test signup **through the real browser flow and email confirmation**, existing-account login, refresh/logout/re-login, Discover, connection request/acceptance, Ideaboard creation/read, messaging and new photo/ID/attachment uploads/deletions. Record response targets/statuses and integrity in a sanitized checklist. Do not use synthetic admin-created accounts as proof of email-delivery signup.
7. Inspect the page-session cookie: HttpOnly, Secure over HTTPS, SameSite=Lax, path `/`; test expiry and logout deletion. API requests use bearer authentication, not cookie authorization. Requests proxy through the frontend's same-origin `/api` rewrite; mutation Origin must match backend APP_URL. Verify foreign-origin POST denial and browser CORS behavior. Auth URL/key changes require a new frontend build.
8. Realtime is authenticated **SSE**, not Socket.IO (no Socket.IO implementation/dependency). Verify `/api/live` ready/refresh/notification events survive the proxy, reconnect after its 55-second stream and stop for unauthorized accounts. Test message delivery/recipient refresh; do not invent a Socket.IO test result.
9. Set maintenance true only on staging backend instances, stop/drain worker/streams and demonstrate new app writes return 503 without changes. Restore false and verify normal flows. Separately rehearse provider Auth/Storage writer suspension in approved recovery infrastructure; the application switch alone cannot stop direct signup/refresh/password changes from old clients.

## Final local validation

The complete suite passed **373 tests in 37 files**. TypeScript checks, production build, architecture boundaries and official Render schema validation passed. Installed Prettier verifies formatting; the repository has no ESLint configuration/dependency or lint script. No deployed/browser end-to-end test is reported as passed without an isolated deployment.

## Unresolved production gates

1. No deployed staging verification: prohibited until separate approval; Vercel scope access unresolved.
2. No independent Supabase recovery project/service restoration. Local restore verifies PostgreSQL data and constraints, not Supabase role ACLs, platform extensions, encryption root keys, Auth login/refresh against restored services, SMTP/provider/MFA settings or restored Storage policy enforcement. Obtain an approved disposable recovery project with an explicit cost limit, then restore through the supported provider process and verify these independently.
3. No durable off-machine backup/key escrow test. Current Storage backup is empty; populated new-file backup/restore into recovery infrastructure still requires a synthetic fixture rehearsal and integrity/private-access checks.
4. No proven all-writer freeze or final current Seoul synchronization. Database/Auth snapshot consistency is verified locally; cross-service consistency and lossless post-write rollback are not established. Source live writes continue.
5. No measured production downtime/RPO/RTO. Full dry-run deployment/freeze/synchronization must establish these. Do not use 37-second dump or 3.5-second local restore as a downtime promise.

## Exact ordered production procedure — do not execute until GO and approval

1. Complete every gate above; record immutable source-compatible and destination-compatible frontend/backend deployments, configuration versions, backup manifests, operator ownership and abort thresholds. Snapshot live environment/configuration securely without printing secrets. Obtain explicit cutover approval.
2. Announce a tested maintenance window based on full rehearsal measurements. Separately review/apply `deployment/source-maintenance.patch` to a source-compatible checkout of `d68403c`; run its checks and rehearse on isolated infrastructure before approving a source release. Then deploy/enable the reviewed maintenance switch on **all** source application instances, stop external writers and workers, close/drain SSE and in-flight mutations. Do not deploy the complete audit branch's destination private-Storage schema changes onto Seoul just to gain the switch.
3. Freeze direct Supabase writers through a **provider-supported, rehearsed procedure**. Disabling signup alone leaves token refresh, account/password updates and existing clients active. Supabase database network restrictions do not imply Auth/Storage API suspension. Obtain provider/operator confirmation that all relevant Auth/Storage/application writers are quiescent; verify denied attempts from old clients. If that mechanism is unavailable, abort before export. Do not invent or deploy untested triggers/privilege revocations on managed production schemas.
4. After draining writers, record the freeze boundary and take a fresh consistent source PostgreSQL/Auth snapshot plus secure configuration inventory. Preserve all hashes/UUID relationships, private database bytes and schema/migration metadata. Historical Storage objects remain intentionally excluded. Verify the source remains unchanged throughout the boundary with the rehearsed writer/transaction checks.
5. Synchronize **only the inactive Singapore candidate** using the separately rehearsed Supabase restore procedure. The old source schema has 13 migrations; destination has 15. Do not replay source schema over the existing destination or blindly overwrite managed Auth/Storage ledgers. Rehearse a clean candidate restore or a reviewed data synchronization that preserves additive destination schema, enabled constraints and Auth dependency order before this production step is allowed. No generic TRUNCATE/reset command is authorized here.
6. Apply/verify the two destination-only Prisma migrations and destination bucket policies. Compare canonical table contents to the frozen source snapshot (accounting for explicitly documented destination migration history/configuration), UUID relationships, constraints, RLS/ACLs, private legacy bytes and historical verification status. Do not count-only validate. Require zero unintended differences and zero historical Storage copy operations.
7. Keep application writers closed. Configure production Singapore Auth origins/redirects/providers/SMTP/MFA. Configure backend DATABASE_URL, DIRECT_URL, Auth URL/public key, Storage URL/backend secret, `FILE_STORAGE_MODE=supabase`, expected project ref and canonical APP_URL. Rebuild frontend with corresponding public values, explicit backend URL and expected ref. No secret enters a public variable. Changes require the previously obtained production approval.
8. Switch/redeploy traffic with maintenance still active. Verify health, configuration, project targets and new public/private Storage policy behavior. Source/destination JWKS/issuer differ: instruct users to re-login. Restored Auth session rows do not establish compatibility of old access/refresh tokens.
9. Run approved production smoke checks, record statuses and targets, then reopen **only Singapore** writers and workers in a controlled order. Keep source writer suspension in place through the rollback window so old tabs cannot create Seoul writes. Do not reopen source Auth/Storage merely because the frontend deployment changed.
10. Observe accepted writes, errors, message delivery, verification and uploads for the agreed interval. Keep both projects/backups and reconciliation boundaries. Source retirement requires later explicit approval; no deletion is part of this procedure.

## Failure and safe resume

Before Singapore accepts production writes, keep writers closed and restore the source-compatible deployments/configuration snapshots; verify source login/DB/private files and restore source writer controls through the rehearsed procedure, then reopen source. Reverting only URLs while leaving the new schema-dependent backend is unsafe.

After Singapore accepts writes, **never simply repoint to Seoul**. Freeze Singapore, capture consistent DB/Auth/new-file state and use a tested reconciliation or forward-recovery plan. Otherwise messages, accounts, passwords and files can be lost. That plan is still unverified and remains a GO blocker.

Reference: [Supabase logical backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [PGlite virtual Blob COPY](https://pglite.dev/docs/api#query-options).
