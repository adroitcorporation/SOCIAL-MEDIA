# Singapore production cutover plan — prepared, unexecuted

**NO-GO. No production cutover or staging deployment is approved by this request.** This plan supersedes earlier Storage-waiver/empty-backup notes: the approved 11-image snapshot was transferred, and a fresh encrypted backup now includes those images. It does not authorize copying subsequent objects, overwriting files or rewriting URLs.

## Mandatory approval and evidence gates

1. Review current DB drift, including Seoul's thirteenth college verification and destination rehearsal records. Approve/rehearse lossless final reconciliation in an inactive candidate; preserve UUIDs, membership, messages, approvals, private bytes and deletion semantics.
2. Resolve destination broad Post/PostComment/PostLike grants and future-table RLS protection, with separate destination-write approval. Preserve backend-only authorization and private Storage policies; review shared function search_path advisor warnings.
3. Obtain dedicated deployment access/quotas and approve fixture-only Singapore staging. Pass every browser acceptance check in [staging plan](singapore-staging-verification.md), exact Auth redirects/mail delivery, sessions and private-file denial.
4. Retrieve encrypted backup and separate key from off-machine escrow on another authorized machine; restore into an approved isolated Supabase recovery environment. Verify real service Auth login/refresh, DB constraints/ACLs, populated Storage hashes and authorization, and environment recovery.
5. Demonstrate **all-writer** freeze/drain/resume, consistent final DB/Auth/Storage boundary, lossless synchronization and pre/post-write recovery on isolated infrastructure. Record measured downtime/RPO/RTO and abort thresholds.
6. Obtain separate explicit production approval and approved maintenance window. Until all gates pass, stop.

## Available executable preparation commands

These commands either validate repository code, read cloud data or prepare offline reports; none execute a production cutover. Use an owner-only local environment, never paste credentials into terminals/logs or copy source credentials to a frontend.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run check:boundaries
npm.cmd run render:validate
npm.cmd run build
& .\node_modules\.bin\tsx.cmd scripts/supabase-storage-sync.ts --dry-run --env-file .env.storage-migration
& .\node_modules\.bin\tsx.cmd scripts/singapore-photo-url-plan.ts --profiles .local/singapore-readiness/profiles.json --manifest .local/storage-sync/completed-snapshot.json --output .local/singapore-readiness/photo-url-plan-final-review.json
node scripts/migration-portable-backup.mjs --restore-only
```

Refresh the profile export/manifest before preparing final URL mapping; the current inputs are a dated audit. Execute the two read-only SQL files through approved project connections and protect raw results. Existing Storage --execute is **not** a final-delta command: its approval guard is fixed to the prior 11-object manifest. New paths/changes/deletions need a separately reviewed manifest and approval; do not weaken the guard.

## Backup/recovery boundary

Fresh Singapore backup at 2026-10-08T23:37:27.384Z contains 55 public/Auth tables and 11 Storage object byte payloads/metadata/policies/buckets, encrypted AES-256-GCM. Local decryption/content checks, 188 applicable constraints, UUID relationships, 28 public RLS flags and local freeze/resume probe passed. Immutable ciphertext and previous Seoul/Singapore archives are preserved in ignored owner-only directories; no secret/key/user export is committed.

The offline restore was rerun with explicit validation of each decrypted file's SHA-256, byte count and unique bucket/path. All 11 payloads (23,078,406 bytes) passed; this is backup payload verification, not a live Storage restore. The helper now rejects duplicate objects, malformed base64, size mismatches and hash mismatches. [Latest recovery evidence](supabase-disaster-recovery-evidence.json).

This is a portable **local** restore, not off-machine or Supabase service recovery. The dump excludes owners/ACLs; policy snapshots alone do not restore provider service configuration, secret encryption keys, signing keys, SMTP, role grants and Storage access. Do not replay managed Auth/Storage migration ledgers over a different provider installation. Escrow archive/checksum separately from its recovery key, preserve configuration secrets in the secret manager, test retrieval and an independent supported provider restore. Inventory before/after object versions guards concurrent file change, but does not provide atomic cross-service capture.

## Write-freeze gaps — hard stop before export

MIGRATION_MAINTENANCE=true blocks app data routes before authentication/rate-limit/profile-sync effects, leaves exact GET health/config open and disables worker work/new SSE. Already accepted requests and streams must drain on **all** instances. Existing browser tabs can call Supabase Auth directly for signup, token refresh, account/password changes and recovery. Seoul's Storage INSERT policy allows direct authenticated uploads. Application maintenance, CORS, disabling signup or database network restrictions alone do not close those paths.

Obtain a provider-supported suspension/isolation mechanism for direct Auth/Storage writers, background integrations and scheduled jobs; test it with old clients in an approved fixture project. Do not invent managed-schema triggers/revokes or rotate production keys as an untested freeze. No supported all-writer suspension has been verified: **do not start final export until it is proven**.

## Ordered operator procedure after GO and explicit production approval

| Step | Execute/review                                                                                                                                                                                      | Success condition / abort                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Record reviewed source-compatible and destination-compatible commits/deployments, domains, secret-manager config versions, signed-off gates, operator and recovery artifacts                        | Recoverable immutable configs; no unknown migration/deployment side effects                                                                   |
| 2    | Release the separately reviewed source-compatible maintenance patch; enable on all source instances; stop/drain workers/in-flight requests/SSE; apply tested direct-provider writer controls        | Old browser/API/direct Auth/Storage attempts denied; no accepted writes after recorded boundary                                               |
| 3    | Capture fresh consistent PostgreSQL/Auth snapshot through supported direct/session exporter, config inventory and source Storage manifest; preserve UUID/password hashes/private bytes              | Source quiescent throughout; complete constrained snapshot and encrypted/escrowed artifacts                                                   |
| 4    | Restore/reconcile **inactive Singapore candidate** using the separately rehearsed provider process; apply only approved destination schema additions                                                | 13 shared migration checksums + 2 destination additions; no managed-ledger overwrite; no schema replay over additive candidate                |
| 5    | Reconcile new/changed/deleted Storage against the final approved manifest through supported APIs                                                                                                    | All referenced files present/hash-matched; conflicts explicitly resolved; destination-only new files retained; never modify Seoul             |
| 6    | Apply separately approved canonical public-photo URL plan in candidate using expected-value transaction and affected-count assertion                                                                | Exact verified path allowlist; repeat application zero changes; rollback mapping retained; missing/private/external URLs not broadly replaced |
| 7    | Compare full keys/content/relationships/constraints/ACLs/RLS/approvals/private bytes and Auth credentials to frozen source; account for approved destination differences                            | Zero unexplained mismatches; destination rehearsal artifacts excluded; newer verification preserved                                           |
| 8    | Configure approved Singapore production Auth redirects/SMTP/providers and coordinated backend DB/direct/Auth/Storage credentials/guards; rebuild frontend with public Auth and explicit backend URL | All five services target Singapore, no backend secret in frontend, production writes still closed                                             |
| 9    | Deploy reviewed destination-compatible releases; verify health/config/project identity and approved smoke tests; require re-login                                                                   | Login/recovery/refresh, profiles, Discover, connections, chat/Ideas/SSE, private/public files all pass                                        |
| 10   | Reopen **Singapore only** in controlled order, observe accepted writes/errors/queues/files; keep Seoul frozen under tested mechanism through rollback window                                        | No source writes from stale clients; complete write-boundary journal; agreed observation/abort thresholds met                                 |

Do not reopen Seoul merely because new frontend code is live. Root npm start automatically runs migrations: verify expected project and DIRECT_URL before any approved startup. The new Storage build cannot safely be repointed to Seoul's old schema as rollback. Render/Vercel env switches are coordinated production mutations, never a background step of this readiness task.

The exact provider freeze and final-data restore/reconciliation executions remain **unimplemented/unrehearsed blockers**, not guessed runnable commands. Use supported [Supabase backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) in the approved recovery rehearsal first. No generic TRUNCATE/reset/disable-RLS script is supplied to make the plan appear complete.

## Rollback and safe resume

Abort for identity/hash/constraint/policy mismatches, lost approval/private files, broken login/recovery, mixed project requests, missing writer freeze, or breached agreed error/latency thresholds.

**Before destination production writes:** keep both writer sets closed, restore recorded source-compatible frontend/backend and original configuration; verify source Auth/DB/files and undo provider suspension through its rehearsed process, then reopen Seoul. Source data is never overwritten by a staging restore.

**After destination production writes:** do not simply repoint to Seoul. Freeze destination, capture its DB/Auth/Storage boundary, preserve new/deleted messages/accounts/passwords/files and use a tested reverse reconciliation or forward recovery. That procedure is not yet verified. Do not sacrifice new writes to meet an arbitrary rollback deadline. Maintain both archives/projects; source deletion or retirement requires another approval.

Current decision: **NO-GO**. Downtime range/RPO/full-service RTO are unmeasured; local backup/restore timings are insufficient. Staging deployment, provider configuration/writer controls, off-machine full-service recovery and lossless final/post-write reconciliation are the remaining approval/testing gates.
