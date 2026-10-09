# CYNK production-readiness rehearsal — 10 October 2026

This report supersedes the remaining-gates section of `gcp-staging-execution-status.md`.
No production cutover, DNS change, merge, production data access, or production configuration change occurred.
The existing staging service was not redeployed or reconfigured. Only newly created synthetic fixtures were
written through its application APIs; their temporary privileged roles were returned to `STUDENT`.

## Scope and preserved code

- Branch: `feat/gcp-fresh-start`. Existing work through `4ba96e9ec0a17725b91c9526ee1ba9d6950eeab4`
  was pushed before the rehearsal. No force push or merge occurred.
- Existing staging runtime: source `5b650ba`, revision `cynk-staging-backend-00004-dmw`, image
  `sha256:7fd2031116b798e2e96758665b09ddc5caddfbc8d6fa9c4b54f5a089e09e70c9`.
- Recovery runtime: source `4d80a6d`, image
  `sha256:94b4be151e0734165fd4a9cd21a70f135178ebfe22eed5fb63091c3c3aa0a276`, built successfully
  by Delhi Cloud Build `b775a319-4c06-422e-94c0-79c27e3b7672` in 2 minutes 44.82 seconds.
- Infrastructure project `cynk-staging`; Firebase Auth project `cynk-staging-e9c53` remains separate.
  The latter's billing is not enabled as part of this work.
- New recovery SQL instance `cynk-staging-recovery-20261010`, PostgreSQL 16, Delhi,
  zonal `db-f1-micro`, fixed 10 GiB SSD, no scheduled backups, no authorized networks.
- New recovery Run service `cynk-staging-recovery`, 1 CPU / 512 MiB, min 0 / max 1,
  concurrency 20, timeout 300 seconds, no CPU boost, existing `cynk-runtime` identity.
- Two new, Delhi-replicated recovery secrets. Runtime identity can access only its recovery runtime
  secret; migrator identity can access only its recovery migration secret. No project-wide secret grant.
- Existing staging Auth and GCS were deliberately reused under the approval. Only new synthetic file
  paths were uploaded. This is a database-recovery rehearsal, not an independent Auth/GCS disaster recovery.

## Gate results

FAIL below means an unmet readiness gate; it does not imply that an unexecuted test produced an observed defect.

| Gate                                            | Result                    | Evidence / limitation                                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve and push existing branch               | PASS                      | Remote branch was verified at `4ba96e9`; no merge.                                                                                                                                                                                            |
| Backend event create/read/update/delete         | PASS                      | Organizer owner CRUD; admin edit of organizer event; cross-owner update/delete denied. Newly created events deleted.                                                                                                                          |
| Backend moderator/organizer/admin authorization | PASS                      | Moderator event creation denied; organizer report dashboard denied; moderator report review allowed; moderator role assignment denied; admin college-document review allowed.                                                                 |
| Independent frontend authorization              | PASS                      | Actual Chromium password sessions; organizer/admin event-management UI present, moderator absent; organizer moderation page denied, moderator/admin dashboard present. Waited for authenticated page cookie.                                  |
| Reporting and private documents                 | PASS                      | New report reviewed; unauthorized document reads denied; authorized moderator retrieval and admin review succeeded.                                                                                                                           |
| Cloud SQL backup and restore                    | PASS                      | Successful on-demand source backup `1791576254230`; restored only into disposable instance.                                                                                                                                                   |
| Restored schema / constraints / identities      | PASS                      | 15 completed migrations, no pending migrations; 28 table inventories, 35 foreign keys without orphans, validated constraints/indexes; all 15 restored user UIDs found in Firebase.                                                            |
| Recovery application integration                | PASS                      | New synthetic users: login, token refresh, college rules, profiles, Discover, connections, direct/group messages, Idea Board, notifications, profile/private-document uploads, SSE; two browser login/refresh/navigation/logout tests passed. |
| Independent Auth/GCS recovery                   | FAIL (not verified)       | Approved rehearsal reused these services; no Auth or GCS destructive restoration attempted.                                                                                                                                                   |
| Warm API latency / bounded traffic              | PASS within tested limits | 50 warm samples per route; request batches at concurrency 10. This is not a 100/500/1,000 concurrent-distinct-user test.                                                                                                                      |
| Representative 1,000-user capacity              | FAIL (not verified)       | Three synthetic identities shared; stopped the 1,000-request phase on HTTP 429, preserving security limits. No scaling increase or bypass.                                                                                                    |
| SSE natural closure and reconnect               | PASS within tested limits | 10 and 20 simultaneous streams followed by authenticated reconnect; extended 20-stream soak passed six natural-close/reconnect cycles over 5 minutes 37 seconds. Not an hours-long soak.                                                      |
| Genuine HTTP scale-from-zero                    | PASS, one sample          | Both active and idle recovery instance counts were zero; authenticated `/api/state` returned HTTP 200 in 4,428.05 ms, with a correlated AUTOSCALING new-instance log.                                                                         |
| Budget configuration and recipient eligibility  | PASS                      | Gross credits-excluded budget and eligible default billing administrator verified by API; user confirmed Console email settings.                                                                                                              |
| Budget email delivery                           | FAIL (not verified)       | User has not received an alert; no threshold has crossed. No budget settings or artificial spending changed to trigger delivery.                                                                                                              |
| Local quality checks                            | PASS                      | 472 tests / 46 files; TypeScript; architecture boundaries; `npm run build`. No ESLint script/configuration is installed. Non-blocking timer-overflow warnings appeared during tests.                                                          |
| Recovery cleanup                                | PASS                      | SQL deletion completed successfully; recovery service/secrets/hostname, six owned Auth fixtures, two owned file generations, new source archive/image digests and local proxy removed. Source backup and original staging retained.           |

## Measured HTTP performance

Client is this Windows execution environment, not multiple Indian cities. Values include network, TLS,
Firebase token verification, application work and database work. All values below are milliseconds.
Quantiles use the recorded samples; p99 from 50 samples is effectively the maximum and has limited precision.

| Workload                      | Successful samples | Concurrency |    p50 |      p95 |      p99 |
| ----------------------------- | -----------------: | ----------: | -----: | -------: | -------: |
| Warm profile read             |                 50 |           1 | 762.81 |   901.20 |   970.56 |
| Warm Discover recommendations |                 50 |           1 | 754.37 |   882.96 | 1,754.75 |
| 100-request profile batch     |                100 |          10 | 711.30 | 1,461.77 | 1,723.32 |
| 500-request profile batch     |                500 |          10 | 705.15 | 1,030.68 | 1,319.83 |
| Stopped 1,000-request phase   |                503 |          10 | 678.29 |   796.33 | 1,170.65 |

The stopped phase issued 515 requests: 503 HTTP 200 and 12 HTTP 429. Parallel in-flight requests
explain why more than three errors completed after the stop threshold. Percentiles cover successful responses
only. No HTTP 5xx was found in the bounded main-service request-log window. Three identities were used in
every phase, so the request counts must not be described as distinct users or simultaneous connections.
Connection-request and direct/group messaging authorization were tested functionally, not at bulk-write load.

Ten SSE streams had minimum observed lifetime 55,676 ms; twenty had minimum 55,763 ms.
All received `event: ready`, closed naturally, and reconnected. A separate extended run held 20 streams across six automatic server-limited cycles (120 stream lifetimes) over 336.747 seconds, with every cycle passing. The maximum **tested simultaneous SSE load
is 20**; maximum API request concurrency is 10. Cloud Run remained min 0 / max 2, concurrency 20.

## Cold-start result

At `2026-10-09T20:45:21.907Z`, after Monitoring showed **both active and idle counts zero** for
`cynk-staging-recovery-00002-t4x`, the first authenticated `/api/state` request returned HTTP 200 in
**4,428.05 ms**. Its Firebase token had been obtained before the timed request; the response UID matched
that newly created synthetic identity. A new-instance `AUTOSCALING` log at `20:45:22.153Z` corroborates
scale-from-zero. The service used min 0, 1 CPU / 512 MiB and no startup CPU boost. This is one cold sample,
not a measured cold p95/p99; it includes network, startup, authentication and application/database work.
No forced shutdown, scaling change or traffic interruption of the existing staging service was used.
Cloud Run had retained an idle instance after the last 55-second SSE request ended; intermediate probes
stopped at the zero-instance prerequisite and did not wake it prematurely.

## Utilization evidence

Monitoring windows: 9 October 2026, 19:55:27–20:25:27 UTC (core load) and 20:10:33–20:40:33 UTC (extended SSE). Existing ready revision only:

- Highest CPU distribution **interval mean**: 24.16% of one CPU.
- Highest memory distribution **interval mean**: 23.01% of 512 MiB, approximately 117.83 MiB.
- Maximum observed active instances: 2; no scaling configuration changes.
- Highest staging SQL CPU gauge: 11.36%.
- Maximum total SQL backends, summed across database metric labels at the same timestamp: 7 of configured 25.
  This includes administrative sessions, not just Prisma connections.
- Highest recovery SQL CPU gauge: 18.26%; maximum total backends: 4.

These metrics are interval samples, not instantaneous peaks. They do not establish headroom at
1,000 concurrent users. Existing runtime pool is two per instance, at most four across two instances.
Prior measured Delhi SQL `SELECT 1` p50/p95 1.79/2.35 ms is retained from the earlier report; it was not
invented or substituted for application-query latency in this rehearsal.

## Restore timing and reproducible recovery

Source backup is successful and retained. Restore operation `ba86c6f5-f08d-4d9a-a527-a5c000000049`:

- Start: `2026-10-09T20:09:28.702Z`.
- Finish: `2026-10-09T20:17:32.816Z`.
- **Database restore: 8 minutes 4.114 seconds.**
- Disposable SQL creation time: `2026-10-09T20:04:07.462Z`.
- Recovery browser/API testing finished by `2026-10-09T20:27:53.865Z`: approximately 23 minutes 46 seconds
  after SQL creation, or 18 minutes 25 seconds after the restore started. This includes configuration and
  integration checks and is an observed rehearsal envelope, not a guaranteed future RTO.

For a future approved rehearsal, use a new explicitly approved destination and adjust the narrow recovery
guard/test before building. Never restore into `cynk-staging-db` or an existing production instance.

```powershell
gcloud sql backups create --instance=cynk-staging-db --project=cynk-staging --location=asia-south2 --async
# Wait for successful completion; record the returned backup ID.
gcloud sql backups restore BACKUP_ID --backup-instance=cynk-staging-db `
  --restore-instance=NEW_APPROVED_RECOVERY_INSTANCE --project=cynk-staging --async
# Wait for DONE with no error, then verify target name/project/region again.
```

Reset only the restored destination's runtime/migrator passwords to new random values and write them
directly to destination Secret Manager versions. Do not print passwords, use command-line password
arguments, read them from existing users, or reuse source SQL credentials. Bind access separately.
Use the official signed Cloud SQL Auth Proxy with the authenticated authorized operator, bound only to
127.0.0.1, for the recovery connection. No authorized-network change is necessary.

1. Validate the target connection name and database before giving it to Prisma.
2. With destination credentials only, run `prisma migrate status`, `prisma migrate deploy`, and apply
   `deployment/gcp/database-access.sql`. In this rehearsal deploy found no pending migrations.
3. Validate every FK for orphan records; validate constraints/indexes; inventory row counts and hashes;
   verify runtime cannot create schemas, create roles/databases, bypass RLS or read the migration ledger.
4. Match restored Prisma UIDs to Firebase account UIDs through authorized Admin lookup, without passwords.
5. Deploy the pinned compatible image to an isolated recovery service; use its own DB secret, canonical
   origin and approved hostname. Initial maintenance mode/private invocation allows isolation checks.
6. Run new synthetic account and application/browser tests against that exact origin. Confirm GCS private
   access and new uploads. This validates shared Storage availability, not a Storage backup restore.
7. Preserve evidence, then delete only newly created rehearsal resources.

The table hashes are a restored-snapshot inventory, not proof of equality to today's changing source.
Writes after the snapshot are deliberately absent. Without final write freeze or an approved PITR/catch-up
procedure, recovery can lose all writes since the selected backup. No live write freeze was performed.
An initial recovery test attempt encountered a refreshed-token HTTP 401 immediately after deployment. A subsequent full run passed without changing authentication/security logic. Its cause was not established; a longer auth/session soak remains warranted. Expected invalid-token/logout 401s are separate negative-test evidence.
PITR timestamp recovery, off-project backup recovery, independent Firebase/GCS restoration and a simultaneous
regional outage remain untested. A zonal micro instance is not HA.

## Cost and billing safeguards

Account-specific INR SKU quotes were rechecked on 10 October and matched 9 October rates. Trial credits
are not deducted from this estimate. 18% is a planning tax reserve, not confirmation of invoice tax treatment.

| Temporary rehearsal allowance                                          |             Including 18% tax |
| ---------------------------------------------------------------------- | ----------------------------: |
| SQL micro + 10 GiB SSD, maximum 8 hours                                |                        ₹13.95 |
| Recovery Run, maximum 30 active instance-minutes                       |                         ₹7.21 |
| Cloud Build, conservative 6 minutes (actual build 2.75 minutes)        |                         ₹4.08 |
| Bounded existing-staging load reserve                                  |                        ₹30.00 |
| Secrets, new backup/storage/operations, bounded egress and contingency |                        ₹19.76 |
| **Conservative approved-scope estimate**                               | **₹75.00, below ₹80 ceiling** |

The SQL instance must be removed before `2026-10-10T04:04:07Z` (eight hours from creation).
This estimate is not a final posted bill. Raw account quote and build/restore operation evidence are preserved
in ignored `.local` files without secret payloads. No larger resource was provisioned.

The previous light-staging model is ₹1,784.43/month including tax, assuming only **20 aggregate active
Run instance-hours/month**. It must not be presented as a production traffic forecast.
In the measured 30-minute load window, the existing ready revision accrued 811.56 billable instance-seconds.
At the same intensity for 730 hours, Run compute/memory would be approximately ₹4,744.21/month including tax;
keeping the other modeled line items yields **₹6,240.35/month**. This is a test-window extrapolation, not a
posted bill, sustainable benchmark or actual user-demand prediction. Requests/egress can also exceed the old
model. One continuously active SSE instance alone would cost approximately ₹10,522.45/month including tax;
adding the other model costs yields approximately ₹12,018.60. Two continuously active instances cost more.
The later 30-minute window including the extended SSE soak accrued 2,091.16 billable instance-seconds: at that intensity for 730 hours, modeled total would be approximately **₹13,720.65/month including tax**, above the ₹9,000 planning budget. The two windows show how sensitive cost is to long-lived requests; neither is a normal-use forecast. No sustained test traffic was left running.
No free allowance or trial-credit discount is assumed. A ₹9,000 planning budget does not authorize new sizing.

Gross budget `CYNK-staging-gross-INR-1694` excludes all credits and has actual 50/75/90/100% plus forecast
90/100% thresholds. The old ₹2,000 budget includes credits and can hide gross usage. One eligible default
billing administrator was verified by IAM; the user confirmed email notifications are enabled. Delivery
has not been observed because no threshold has crossed. Do not spend money or edit thresholds solely to
force an email without approval. Review the mailbox/spam folder when a real threshold is crossed and verify
remaining credits/expiry in Billing → Credits. Previously reported trial balance is not a refreshed API balance.

These are **alerts-only budgets, not hard spending caps**. Billing reporting/alerts have delay. Do not
disable billing, change quotas or reconfigure running services as an unapproved cost-control experiment.
See [Google's alerts-only budget documentation](https://docs.cloud.google.com/billing/docs/how-to/budgets).

## Rollback procedure — documented, not executed on existing staging

Production rollback is currently unnecessary because production traffic/configuration never changed.
After a separately approved future staging release, application rollback requires schema compatibility:

1. Review the new migration effects and choose a still-compatible known revision.
2. Freeze writes only with separate authorization; existing guard covers application writes, but external
   Firebase signup and independently issued upload URLs require their own verified freeze strategy.
3. For application-only failure with compatible schema, route staging traffic back to the known revision:

```powershell
gcloud run services update-traffic cynk-staging-backend --project=cynk-staging `
  --region=asia-south2 --to-revisions=cynk-staging-backend-00004-dmw=100
```

4. For database damage, restore into a **new approved destination**, using the recovery steps above. Validate
   it before changing any live service secret/Cloud SQL attachment. Never restore over the working source
   or blindly reverse Prisma migrations. Reconcile post-backup writes before resuming, or explicitly accept
   the resulting data loss. Traffic rollback alone does not undo database writes.
5. Keep Firebase UIDs/signing configuration stable when reusing that Auth project; database restoration
   does not restore deleted Firebase users or GCS files. Restore those from separately tested retained
   backups if needed. Existing production Supabase sessions cannot be assumed valid under Firebase.

This rehearsal proved isolated database recovery and application operation. It did not switch source
traffic, test production rollback, overwrite source data, or retire any old service.

## Cleanup evidence and exact boundaries

Only the newly created recovery service, SQL instance and two recovery secrets were selected for deletion.
The source backup `1791576254230` is retained. Two new recovery-fixture objects were removed with exact
GCS generation-match preconditions; six newly created recovery-only Auth identities were removed after
checking their UID membership, synthetic email prefix and creation time. Existing Auth users were preserved.
Only the new recovery hostname was removed from the latest authorized-domain list, preserving every
original hostname. The local proxy was stopped only after matching its PID to its exact executable path.
Only source object generation `1791576369496250` and the two new `4d80a6d` image digests were removed.
No bucket, repository, project, old image, original secret or existing staging database was deleted.

The named-resource cleanup commands below describe this completed rehearsal; do not rerun them to remove
other resources. A future rehearsal needs its own approval and names. Firebase/config and GCS cleanup used
supported APIs with exact ownership checks rather than replacing an entire project configuration or
deleting a prefix recursively.

```powershell
gcloud run services delete cynk-staging-recovery --project=cynk-staging --region=asia-south2 --quiet
gcloud sql instances delete cynk-staging-recovery-20261010 --project=cynk-staging --quiet
gcloud secrets delete cynk-recovery-runtime-database-url --project=cynk-staging --quiet
gcloud secrets delete cynk-recovery-migration-database-url --project=cynk-staging --quiet
```

SQL deletion operation: `2b3fdfdb-5588-4b0e-8262-12bf00000049`. Final deletion completion is recorded
in the gate table and ignored operation evidence. The original staging service still reports revision
`cynk-staging-backend-00004-dmw` and health HTTP 200. Main-staging synthetic test fixtures remain; no
bulk deletion of its database or Auth accounts was performed.

Raw sanitized restore, integrity, pricing, metrics, cold-start, SSE and cleanup evidence remains in the
Git-ignored `.local` directory. This committed report preserves the measured results without passwords,
ID tokens, API secret payloads or production data. Public staging configuration and source-code commits
are sufficient to rebuild the disposable image; its artifact was intentionally removed after verification.

## Remaining gates and decision

Before production approval: establish representative distinct-user
load/SSE capacity and acceptable business-write latency within a separately approved test envelope; observe
alert delivery; approve an operating-cost envelope consistent with sustained SSE; test independent Auth/GCS
and off-project recovery/PITR where required; decide the recurring recommendation-worker scheduling strategy;
complete a longer auth/session soak, end-user acceptance and fresh-start account/data communication. Event-attachment business API
upload/download/delete remains unverified; profile and college-document APIs passed.

No production cutover is authorized by this rehearsal. Request separate explicit approval only after the
remaining gates and final production scope are satisfied.

**Decision: NO-GO for production cutover.**
