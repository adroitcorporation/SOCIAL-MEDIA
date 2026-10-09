# CYNK staging execution status — 10 October 2026

Subsequent recovery, moderator, load, SSE and billing evidence is recorded in
[the production-readiness rehearsal report](gcp-production-readiness.md). Its results supersede
the remaining-gates list below. The branch was subsequently pushed; no merge or production change occurred.

**GO for staging evaluation. NO-GO for production cutover until the remaining production checks below are completed and separately approved.**

Live frontend and backend: https://cynk-staging-backend-1002434130638.asia-south2.run.app

Infrastructure project: `cynk-staging`, Delhi `asia-south2`. Firebase Authentication project: `cynk-staging-e9c53`; its billing is still **disabled**, rechecked through Billing API. Existing Render, Supabase and Vercel production, production traffic and production data were not changed. Nothing was pushed or merged.

## Actual deployment

- Ready revision: `cynk-staging-backend-00004-dmw`, serving 100% of **staging** traffic.
- Runtime source commit: `5b650baa0a7c8a99b5119eca04eeddeabd0576a0`.
- Runtime image: `asia-south2-docker.pkg.dev/cynk-staging/cynk/backend@sha256:7fd2031116b798e2e96758665b09ddc5caddfbc8d6fa9c4b54f5a089e09e70c9`.
- Runtime production build: `3821da3b-2936-4e78-8dab-016354453fc9`, **SUCCESS**.
- Migration/recommendation tooling source: `91b098efc6631344cc52b400d15cdc44d0cdec0e`; build `fae359ad-745f-4be7-9783-020ac04d70b1`, **SUCCESS**.
- Tooling image: `asia-south2-docker.pkg.dev/cynk-staging/cynk/tooling@sha256:fe66c76f657e8d18b71edcbfb4356676fa0efc756267ef4e24b351f7fa4aad39`.
- One combined Next.js frontend/API service: 1 CPU, 512 MiB, request billing, CPU boost disabled, minimum zero, maximum two at both service and revision levels, concurrency 20, 300-second request timeout, generation 2.
- Dedicated `cynk-runtime` identity; Cloud SQL Unix socket, runtime database secret version 1, two-connection Prisma pool. No migration credential in the application or frontend.
- PostgreSQL 16 Enterprise zonal `db-f1-micro`, fixed 10 GiB SSD, autogrowth disabled, deletion protection, no authorized public networks. Fresh database `cynk_staging` owned by `cynk_migrator`.
- All **15 existing Prisma migrations** applied successfully. Ledger independently verified. Initially zero users; only newly created staging accounts/fixtures have subsequently used the application. No old user import.
- Runtime role: no superuser, CREATEDB, CREATEROLE or BYPASSRLS; no schema creation or migration-ledger access. Backend DML policies and existing authorization rules remain enforced.
- Seven retained automatic backups and seven-day PITR enabled. Automatic backup `1791562045516` succeeded in `asia-south2`; supplemental on-demand backup `1791575271312` succeeded in Google's default `asia` location. These are successful backups, **not a verified restore rehearsal**.
- Four private Standard Delhi buckets with uniform access and public access prevention: `cynk-staging-staging-profile-photos`, `cynk-staging-staging-college-ids`, `cynk-staging-staging-event-attachments`, `cynk-staging-staging-build-source`.
- Backend-only database secrets have Delhi replicas. Runtime Storage get/create/delete permissions are scoped to the three file buckets. Build identity accesses only its source bucket/registry/logs. Cross-project Firebase identity reader permits only `firebaseauth.users.get`. No downloaded service-account keys.
- Private migration job and manual recommendation job deployed with separate identities and 1 CPU / 512 MiB limits. Recommendation execution `cynk-staging-recommendations-m52v5` succeeded; it reported zero pending jobs, so this execution does not prove sustained queue-processing throughput. No scheduler was provisioned.

## Resolved deployment issues

1. User explicitly approved `sql-component.googleapis.com`; enabled only in `cynk-staging`. Migration execution `cynk-staging-migrate-q22x7` succeeded. All 15 migrations and runtime access SQL completed.
2. Browser login exposed HTTPS-proxy origin rejection at `/session`. The session bridge now prefers the explicitly configured public `APP_URL`, retaining cross-origin rejection and the existing fallback for frontend deployments without that setting. A regression test covers HTTPS-to-HTTP proxying.
3. Mixed-case Firebase IDs exposed a Cloud SQL locale mismatch with JavaScript's sorted connection pair keys. The **fresh GCP database access setup** now specifies `COLLATE "C"` in the existing canonical-pair constraint. It retains the same integrity rule; the original 15 migrations and production databases are unchanged. The mismatch was measured in staging; regression tests accept the correct mixed-case pair and reject reversed keys. Connection requests then passed.
4. Windows multiline CLI argument quoting affected an auxiliary test job, not the application. Structured supported Cloud Run REST execution overrides were used for the test payload. No execution policy or authorization check was bypassed. The temporary job was deleted after successful verification.

## Verified tests

- Full local suite: **471 tests / 46 files passed**; TypeScript and architecture boundary checks passed. Changed TypeScript/test/helper files were formatted. No ESLint script/configuration exists; no ESLint pass is claimed.
- Linux production image builds succeeded. [Genuine 512 MiB capacity preflight](gcp-capacity-preflight-results.md): 1 vCPU, peak 240.98 MiB, no OOM. No RAM/CPU increase was made.
- Actual deployed Firebase signup/password login with random synthetic credentials kept in memory, unverified-email rejection, stable UID preservation, refresh-token exchange and authenticated API use after refresh passed. Invalid token rejected with 401.
- Separate Firebase/GCP projects worked through the deployed Admin SDK and dedicated workload identity; no Firebase billing enablement was required.
- **User manually verified** Google login, GitHub login and provider linking on staging; existing account/session remained intact. This is user-reported browser evidence, not an automated OAuth-consent test.
- Two real Playwright browser tests passed (16.4 seconds on final reusable-helper run): password login, HttpOnly/Secure cookie, page refresh, Discover, Connections, Messages, Idea Board, Events, Profile, Notifications, and logout/cookie removal. No browser requests to Supabase or Render were observed.
- Deployed API tests passed profile completion, approved-domain college verification, unapproved-domain remaining unverified, request creation/recipient acceptance, rejection of requester self-acceptance, direct messages/readback, nonmember conversation rejection, idea creation/resonance/group collaboration, group messages, notifications and rejection of student moderation access.
- Real profile image upload/download and private college-ID submission passed. Two other student identities could not access the submitted document. **Positive moderator document retrieval and review are not yet tested with a designated staging moderator.**
- Runtime-identity Storage verification passed for **all three file buckets**: upload, content-type metadata, CRC32C download, SHA-256 comparison, overwrite precondition rejection, anonymous-read rejection, generation-protected deletion and absence afterward. The temporary verification objects/job were removed. Successful execution `cynk-staging-runtime-verify-kh78m`; no source/production objects were touched.
- Authenticated SSE returned the real `event: ready` stream. A sustained 55-second close/reconnect/load test is still outstanding; no Socket.IO claim is made because the application uses SSE.
- The event-attachment bucket passed Storage integrity tests; the event-attachment **business API** is not claimed end-to-end tested.

Reproducible deployed fixture/browser harness (Windows, authenticated authorized staging operator, public Firebase config in ignored `.env.local`):

```powershell
$env:GCP_STAGING_ALLOW_SYNTHETIC_USERS = 'true'
node scripts/gcp-deployed-verification.cjs
Remove-Item Env:\GCP_STAGING_ALLOW_SYNTHETIC_USERS
```

This creates three new staging-only identities and synthetic application records on each run. It marks only those freshly created test identities email-verified through the operator's authenticated access; it never reads passwords from existing users. Passwords/tokens are not written to files or logs. Fixtures remain in staging; no bulk cleanup or deletion of existing accounts is performed. Google/GitHub consent/linking remain manual checks.

## Measured performance

- From this Windows execution environment, 20 warm sequential samples per route: `/api/config` p50 **68 ms**, p95 **189 ms**; `/api/health` p50 **69 ms**, p95 **123 ms**. These include client network/TLS/HTTP overhead and are not a measured Jaipur-versus-other-city comparison.
- From a Delhi Cloud Run job to Delhi Cloud SQL, 50 `SELECT 1` samples: p50 **1.79 ms**, p95 **2.35 ms**; first connection/query **435.74 ms**. This uses the migration identity with pool one, not a full business-query workload or HTTP cold-start measurement.
- Cloud SQL `max_connections`: **25**. Service pool two x maximum two instances permits four app connections, plus separately bounded jobs.
- Cloud Monitoring memory data read successfully: 17 interval samples, highest **interval mean** utilization **22.60%** of 512 MiB. This is not an instantaneous peak or sustained production capacity guarantee.
- Real Cloud Run HTTP cold-start latency, sustained authorized concurrency, queue throughput and long-lived SSE scaling remain unmeasured.

## Cost and monitoring

Account-specific INR model remains **₹1,784.43/month**, including an **18% tax reserve**, before credits, under the documented usage assumptions: SQL micro 730h/10 GiB SSD, 2 GiB aggregate backup storage, Run 20 aggregate active instance-hours, 100k requests, 2 GiB Storage/registry each, 120 build minutes, 5 GiB egress, two secrets, 30 aggregate job minutes and logging allowance. Additional test builds/jobs remain within the modeled monthly activity allowance. This is an estimate, not a posted invoice or hard cap; actual usage, backup location/storage, taxes and trial eligibility must be monitored.

Gross budget `CYNK-staging-gross-INR-1694` excludes all credits and has actual 50/75/90/100% and forecast 90/100% thresholds; existing net budget unchanged. Default billing recipients configured. **Alert delivery is not verified.** Monitor Billing → Reports with credits excluded, Budgets & alerts, Cloud Run metrics, Cloud SQL connections/storage/backups, and Logs Explorer. The user-reported trial balance/expiry are prior Console evidence, not an independently refreshed API balance. The ₹9,000 planning ceiling did not authorize larger resources and no such increase occurred.

## Remaining production-readiness actions

1. Designate and explicitly bootstrap a staging `ULTIMATE_MODERATOR` using the existing guarded role-bootstrap procedure; then test positive document retrieval/review, organiser/event attachment flows and role changes. No real account was silently promoted.
2. Rehearse backup/PITR restoration in a **separately approved** recovery environment; test identities, constraints, policies and files. Do not restore over production or this working staging database. Retain source code, image digests, secret-version references and recovery instructions securely.
3. Run sustained SSE reconnect/concurrency, application business-load and genuine cold-start tests within the approved limits. Manual recommendation execution works; approve a scheduling strategy separately if automatic recurring processing is required.
4. Confirm gross-budget recipient delivery and current remaining credits in the Console; review actual billed usage after reporting catches up. Budget alerts are not a spending cap.
5. Complete end-user staging acceptance and separately approve any production architecture/configuration/cutover scope. Fresh-start account/data consequences must be communicated before moving real traffic.

## Rollback and cleanup

Production rollback is unnecessary: production routing/configuration never changed. For a staging problem, enable **staging-only** maintenance:

```powershell
gcloud run services update cynk-staging-backend --project=cynk-staging --region=asia-south2 --update-env-vars=MIGRATION_MAINTENANCE=true
```

Review a schema-compatible known image/configuration before changing staging traffic; do not blindly reverse Prisma migrations or deploy the earlier proxy-bug image. Pin the verified runtime/tooling digests above and secret version 1. Restore only to a separately approved recovery destination if database recovery is needed. This rollback procedure is documented, **not a full disaster-recovery rehearsal**.

Permanent cleanup requires separate approval and retention review. `scripts/gcp-staging-plan.mjs` produces a named-resource review list; do not execute it automatically. Keep SQL deletion protection until approved, avoid recursive/nonempty bucket deletion, and remove workload grants only when retiring the associated resources. Never delete a project, unlink billing, remove Firebase users, alter old production, or retire Seoul/Render/Vercel as part of staging cleanup. Cloud SQL continues to incur charges while running even if Cloud Run scales to zero.
