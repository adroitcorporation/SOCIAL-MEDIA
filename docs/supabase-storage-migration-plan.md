# Storage synchronization plan and final checklist

The utility is `scripts/supabase-storage-sync.ts`, with safety logic in `scripts/lib/storage-sync.ts`. It defaults to read-only and hard-codes the approved Seoul source and Singapore rehearsal destination. It never deletes files, edits buckets/policies, rewrites database references, modifies Auth, or deploys the app. Source credentials are used only for read requests. Transfers use destination SDK upload with `upsert:false`; conflicts require a separately approved reconciliation, which this utility intentionally cannot perform.

## Preparation and exact commands

Use Node 24 and the pinned repository dependencies. Work on `audit/supabase-storage-singapore`. This branch builds on the earlier audit implementation; it must not be merged into production as a Storage tooling change. Do not run `npm start` or migration/seed scripts against production.

Protect `.local/storage-sync` with owner-only ACLs. On this Windows machine its explicit owner grant and removed inheritance were verified; `owner-only-confirmed.txt` records that check. On another machine verify ACLs yourself before creating that marker. This folder contains private paths, receipts and temporary plaintext bytes. Use an encrypted local disk and restricted backups. Unix creation modes alone do not secure Windows ACLs. A process crash can leave UUID `.part` files: review/remove only those local temporary files before resuming; do not delete cloud objects.

In the ignored root `.env`, configure `STORAGE_SYNC_SOURCE_KEY` using an authorized **Seoul backend-only** credential. Keep `MIGRATION_DESTINATION_STORAGE_KEY` as the existing Singapore backend-only credential. Never put either in `NEXT_PUBLIC_*`, paste them in chat, print the environment, or change production variables. API URLs are fixed to the project refs. Wrong-project keys fail authorized bucket listing; do not substitute publishable credentials for administrative inventory.

The completed metadata dry-run used management API inventories:

```powershell
& .\node_modules\.bin\tsx.cmd scripts/supabase-storage-sync.ts --dry-run --inventory .local/storage-sync/inventory.json
```

Once source credentials are available, refresh both inventories through Storage APIs (SDK paginated recursive list plus raw REST object info for version/custom metadata). Raw info avoids the SDK's recursive conversion of custom metadata key names:

```powershell
& .\node_modules\.bin\tsx.cmd scripts/supabase-storage-sync.ts --dry-run
```

This fresh dry-run does not download bytes, so hash verification is still pending. Review the protected timestamped report and confirm target identity, bucket compatibility, missing paths, extra paths and conflicts. Before any writes, test the adapter using an approved disposable source/destination fixture environment or an explicitly approved rehearsal object operation; do not claim the mocked tests are a live transfer test.

**Only after explicit approval of Singapore writes**, the operator command is:

```powershell
& .\node_modules\.bin\tsx.cmd scripts/supabase-storage-sync.ts --execute --approved-destination=lxofcmzgzbgqvlmwizgm
```

Re-run the identical command after an interruption. Atomic receipts record source fingerprint, SHA-256 and byte count only after verification. Every run re-inventories and re-hashes existing objects; receipts never bypass integrity checks. An upload that succeeds but loses its response can end the run with a conflict; the next run finds and verifies that path, without overwriting it. Destination-only files are retained.

## Integrity, capacity and metadata limits

Files stream from authenticated Storage REST downloads through SHA-256 and a 1 GiB per-object disk limiter, then SDK uploads stream the temporary file. One object is processed at a time; successful receipts release its temporary file. Requests time out at 120 seconds. Operations are paced by 150 ms and transient network, timeout, HTTP 429/5xx failures retry up to four attempts with exponential delays. Retry-After headers defer later requests; hints over 60 seconds stop the run for a later manual resume. This conservative operator utility is unsuitable for files exceeding 1 GiB or a sustained slow link without review; it fails rather than consuming unlimited disk/memory. Application files here are all below 4 MB.

MIME, compatible cache-control and custom metadata are forwarded. Owner IDs, provider object IDs, versions, creation times and ETags are server-generated and not cloned by upload. Destination objects are owned/created through the backend credential; destination restrictive policies must remain in force. Existing MIME/size/ETag conflicts halt execution before uploads; byte conflicts also halt without overwrite. Source version/metadata is checked before and after each transfer, and the final complete source inventory is compared for new/deleted/changed paths.

SHA-256 comparisons verify bytes actually returned by the APIs, not the integrity of an unseen original upload. Size mismatches fail. Metadata-only dry-run cannot prove byte correctness. Live listings can shift under concurrent writes; pre/final detection is a guard, not a transactional cross-service snapshot or full object version-history backup.

## Volume and cost estimate

Observed missing volume: **23,078,406 bytes (23.08 MB)**, 11 objects. A transfer plus destination checksum download reads about **46.16 MB** total across both projects, plus metadata, headers and retries. Repeated full verification incurs those reads again. Singapore's added object storage is approximately 0.023 GB. No new project or paid resource is needed for this inventory.

Supabase documents uncached egress at $0.09/GB above quota; the observed source plus destination verification reads would be approximately **$0.0042** if entirely billed at that rate. Within remaining included quota the incremental charge can be $0. Free-plan restrictions and shared organization usage still apply; current account usage/invoice was not inspected. Verify usage and plan before approval. Storage charges depend on the time-weighted destination volume and remaining quota; do not interpret this estimate as a provider quote. [Egress pricing](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Storage size billing](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size).

## Final delta and cutover checklist — separate future approval

1. Confirm source/destination project refs, credentials, backup escrow and approved volume/cost; fresh dry-run must show compatible buckets and no unresolved conflicts.
2. Obtain explicit Singapore write approval and execute the additive rehearsal transfer. Re-run and verify all 11 current paths by SHA-256/size, both private bucket flags, restrictive policies and authorized/unauthorized app access using two accounts. Never make a private document public for verification.
3. During continued production writes, refresh the dry-run and source manifest. New unique paths can be added after approval; changed existing paths require separate reconciliation because overwrite is disabled. Never silently delete destination files when source objects disappear.
4. For a future cutover only, obtain separate approval for a tested all-writer freeze, drain in-flight app requests and stop direct Auth/Storage writers through the supported procedure. The application maintenance flag alone does not freeze direct platform clients. No production freeze was executed here.
5. Capture fresh consistent DB/Auth backup plus source Storage inventory boundary. Execute approved final delta; verify the source inventory stays unchanged and that all source paths match destination SHA-256 and sizes. Repeated changes or conflicts require abort/review, not upsert.
6. Apply any separately reviewed URL/reference mapping only in the isolated candidate first. Verify legacy private bytea documents and college verification statuses remain intact. Test live login/refresh, profile images, moderator document reads and authenticated attachment access.
7. Production URL/environment switch, deployments and traffic cutover require separate explicit approval. Preserve Seoul and rollback backups. Once destination accepts writes, rollback requires lossless reconciliation or forward recovery; switching to an old snapshot loses new data.

Until source API credentials, live fixture adapter checks, fresh final inventory, access checks and write approval are complete, synchronization is **not safe to begin automatically**.
