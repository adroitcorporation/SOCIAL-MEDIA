# Latest staging architecture: combined Cloud Run

The user has replaced the Vercel staging plan with one Cloud Run service hosting the
existing Next.js frontend and Node API. Follow [the revised approval/deployment plan](gcp-cloud-run-staging-approval.md). Earlier Vercel instructions below are historical and must not be executed for staging. Production Vercel remains untouched.

# CYNK Delhi NCR staging preparation

Reviewed 2026-10-09 on `feat/gcp-fresh-start`, based on commit `5f3e128`.
Project: `cynk-staging`, authenticated ACTIVE project verified on 2026-10-09.
Billing is linked to an open INR account; actual nonsecret identifiers are kept in ignored
`.local/gcp-staging.json`. Primary region: **Delhi NCR, `asia-south2`**.
This guide supersedes the earlier Mumbai provisioning defaults and cost envelope.

Latest remaining-blocker review, exact resource names, itemized INR planning estimate,
gross-budget instructions and approval checklist: [final approval plan](gcp-staging-approval-plan.md).

**Current status: preflight only; NO-GO for deployment and production.** Only explicitly
approved API enables and their Google-managed dependencies/bindings were changed.
No billing link, custom IAM, credential, application resource or deployment was changed.
Authenticated CLI preflight is now partially complete; see
[the preflight status report](gcp-staging-preflight.md). Google Cloud SDK 588.0.0 is installed.
The 11 deployment/preflight APIs were enabled after explicit API-only approval. Inventories,
Run/build quota metadata, organization policies and the existing budget were read. Trial
credits, the INR quote and full SQL capacity limits remain unverified. Docker/Linux execution
is still unverified. No resources, custom IAM, credentials, budget changes or deployment
are authorized by that API-only approval.

## Availability and boundaries

| Service                                                                                               | Delhi support and selected configuration                                                                          | Account validation still needed                                                                                                                            |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Cloud Run](https://docs.cloud.google.com/run/docs/locations)                                         | Services/jobs available; **Tier 2**. Request billing, 1 vCPU, 512 MiB, min 0/max 2, concurrency 20, timeout 300 s | Regional CPU/memory quotas, max-instance limits, org policy allowing public API invocation                                                                 |
| [Cloud SQL PostgreSQL](https://docs.cloud.google.com/sql/docs/postgres/region-availability-overview)  | PostgreSQL 16 Enterprise, zonal, `db-f1-micro`, 10 GiB SSD, `cynk-staging-db` in `asia-south2`                    | Tier capacity/quotas and current Console quote; micro's 0.6 GiB RAM may be inadequate under load                                                           |
| [Cloud Storage](https://docs.cloud.google.com/storage/docs/locations)                                 | Single-region Standard, `asia-south2`, private/PAP/uniform access                                                 | Bucket names globally unique; residency policy, soft-delete retention                                                                                      |
| [Artifact Registry](https://docs.cloud.google.com/artifact-registry/docs/repositories/repo-locations) | Docker repository `cynk` in Delhi                                                                                 | Repository quota; no vulnerability-scanning API automatically enabled                                                                                      |
| [Secret Manager](https://docs.cloud.google.com/secret-manager/docs/locations)                         | User-managed replication only in Delhi                                                                            | Use global Secret Manager API with one Delhi replica, compatible with Run secret references; do not substitute regional-only secret syntax without testing |
| [Cloud Build](https://cloud.google.com/build/pricing)                                                 | Delhi default pool; explicit build service account                                                                | Build concurrency and pool quota; source bucket/read access; no production trigger                                                                         |
| [Identity Platform](https://cloud.google.com/identity-platform/docs)                                  | Project-level Auth; no Delhi region selector                                                                      | Email delivery/providers, authorized domains, registration controls, quotas                                                                                |

**Auth residency exception:** this app uses Firebase Auth/Admin APIs. Firebase documents
[Authentication processing as US-only](https://firebase.google.com/support/privacy#us-only_services).
Do not represent the whole stack as Delhi-resident. Obtain acceptance of this exception,
or resolve residency requirements with Google before provisioning. Vercel remains an
external frontend; its edge location and rewrite path also affect residency and latency.
IAM and billing are project/global control planes, not regional app instances.

Backend, SQL, app buckets, secrets' replica, build and registry must all use `asia-south2`.
The startup guard rejects a Mumbai SQL connection, including one hidden in `DATABASE_URL`.
The Dockerfile is region-neutral; it copies the updated startup guard. All **15 existing
Prisma migrations**, SSE, college-domain rules and API authorization remain unchanged.
Application data city options named Mumbai are unrelated and deliberately retained.

## Offline plan and approval gates

Run these local commands without contacting GCP:

```powershell
node scripts/gcp-staging-plan.mjs deployment/gcp/staging-plan.example.json
node scripts/gcp-costs.mjs
```

The first generates structured `gcloud` argument arrays and a plan hash. It **never
executes commands**, including with extra flags. Copy the nonsecret config to ignored
`.local/gcp-staging.json`, insert actual identifiers once available, and regenerate for
review. Only dedicated `cynk-staging` or `cynk-staging-SUFFIX` projects are accepted;
region mismatch, secret fields and unsafe identifiers fail. No passwords, API tokens,
service-account key files, user identities or connection URLs belong in this config.

Plan phases: `preflight` (read-only), `provision` (billable resources/APIs/IAM), `budget`
(billing alert changes), `cleanup` (destructive review list). These are not a single
executable script. A human must review commands and run only the specifically approved
phase. Do not replay provisioning against existing resources: stop, inventory and revise
the plan. No automatic adoption, overwrite, rollback deletion or retries of mutations.
Do not flatten JSON command arguments into an interpolated shell string.

Separate approvals are required for:

1. Project creation and linking the specified existing trial billing account.
2. Quoted regional resources, API enablement, scoped IAM and budget creation.
3. SQL passwords/secret versions and Identity Platform/provider/domain configuration.
4. Container build, fresh migrations and isolated staging deployment; opening test writes.
5. Any cleanup, billing upgrade, paid quota increase, production resource or cutover.

Installing a CLI does not authorize login, ADC login, credential changes or billing updates.
Do not change execution policy to run any local script.

## Console: project and billing, after separate approval

**Already completed externally and verified read-only:** project creation and INR billing
linkage. Do not recreate or relink them. The steps below are retained for reproducibility.

1. Open Google Cloud Console → project selector → **New Project**. Name `CYNK Staging`;
   edit ID to `cynk-staging`. If unavailable, choose `cynk-staging-SUFFIX` and update all
   nonsecret templates. Choose the approved organization/folder; create only after approval.
2. Select that new project. Open **Billing → Link a billing account**. Choose the existing
   account showing the trial, confirm its account ID and currency, and link only after
   approval. Do not upgrade or attach a different payment account to work around limits.
3. Billing → Overview/Credits: record remaining trial credit and expiry (no screenshots
   containing payment details). IAM & Admin → Settings: record project ID/number.
4. There is **no universal project region switch**. Explicitly select Delhi `asia-south2`
   in every service's creation form. Default resource location alone does not enforce Run,
   SQL or bucket locations. Inspect organization resource-location restrictions first.
5. IAM & Admin → Quotas & System Limits: filter Cloud Run, Cloud SQL Admin and Cloud Build;
   inspect Delhi CPU/memory capacity, instances and build concurrency. Also inspect Auth
   signup/email limits. Document actual results; do not request increases without approval.

If approved CLI read-only access later exists, run the plan's `preflight` arrays with
explicit `--project`. Project/billing describe, service/resource lists and quota reads
must succeed or show a documented permission/API blocker. A failed quota API read is not
permission to enable another API. In Console verify organization policies and current IAM.
Never use `--log-http`, read secret versions, export tokens or disclose keys for this audit.

## Cost and ₹2,000 budget

See [regional cost comparison](gcp-regional-costs.md) and `deployment/gcp/pricing.usd.json`.
Public USD list rates are **not** the account's INR SKU quote. Use Cloud Pricing Calculator:
select Delhi, PostgreSQL Enterprise/shared micro, zonal, 730 h/month, 10 GiB SSD; add
actual backup/log retention, Run request billing/512 MiB/min 0/max 2, GCS, registry/build,
network egress. Capture the INR total, tax treatment and assumptions before approving.

After approval, Billing → Budgets & alerts → Create budget → name `CYNK staging ₹2,000`:
scope **only this project's number**, all services, monthly specified amount **INR 2000**;
exclude credits to expose usage while trial credit pays the bill. Set actual thresholds
50/75/90/100%, forecast 90/100%, notify existing billing admins/users; verify email routing.
The plan supplies matching `gcloud billing budgets create` arguments. Its `2000INR` amount
is valid only when the billing account currency is INR. For any other currency, stop and
approve an account-currency equivalent; do not silently substitute 2000 USD.

This is a standard notification budget, **not an enforced ₹2,000 spend cap**. No billing
disconnect automation or preview spend-cap feature is configured. Check SQL storage,
egress, Run active-instance time, logs and credit expiry weekly. Max instances does not
guarantee a spending ceiling, and deployment overlap can temporarily add capacity.

## IAM and credentials, after approval

Operator needs only temporary service-specific provisioning permissions: Project Creator
and Billing Account User/Project Billing Manager for creation/linking; Service Usage Admin,
SQL Admin, Run Admin, Artifact Registry Admin, Storage Admin, Secret Manager Admin, IAM
Service Account Admin/Role Admin and Project IAM Admin for setup. Budget creator needs
Billing Costs Manager or equivalent budget permissions. Use these on the dedicated staging
project/account only; remove unneeded grants after setup. Do not give runtime Owner/Editor.

| Identity                | Required grants                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cynk-runtime`          | Cloud SQL Client in cynk-staging; custom `firebaseauth.users.get` in cynk-staging-e9c53 only; get/create/delete on **only** 3 infrastructure buckets; accessor on runtime DB secret |
| `cynk-migrator`         | Cloud SQL Client; accessor on **only** migration DB secret; no app buckets or Auth administration                                                                                   |
| `cynk-build`            | Log Writer; repository-scoped Artifact Registry Writer; viewer on **only** build-source bucket; no DB/Auth/secret access                                                            |
| Human deployer          | Run Admin, repository reader, `iam.serviceAccounts.actAs` on relevant staging identities; Cloud Build submit permissions and create objects on build-source bucket                  |
| Platform service agents | Preserve Google's service-agent roles. Verify Run image pulls and Cloud Build token delegation; never replace them with runtime admin access                                        |

Runtime does not need object listing, bucket administration, `signBlob`, Auth admin or
secret creation. Downloads use backend ADC and application authorization, not publicly
readable buckets. Browser Firebase **web** API key is public configuration; restrict it
to intended APIs/origins after testing. No SQL password or backend credential goes to
Vercel or a `NEXT_PUBLIC_*` variable. No downloadable service-account keys are generated.

Create SQL users `cynk_migrator` and `cynk_runtime` using approved Console actions, use
unique strong passwords without sharing them. Save socket URLs as Secret Manager version 1
through its Console, never CLI arguments or source files. Use runtime/migration URLs from
the original guide with `asia-south2`; only the job gets the migrator URL. Apply
`deployment/gcp/database-access.sql` in the **fresh staging DB** after migrations; inspect
resulting privileges/RLS. Runtime's broad inherited Cloud SQL user role must be removed.

Public SQL IP is used by the managed Run SQL connector, with **zero authorized networks**.
Verify no direct public-IP connection works; do not add `0.0.0.0/0`. This avoids a VPC
connector, NAT and load-balancer baseline. If an org policy requires private IP, stop:
private networking needs a revised configuration, cost quote and approval.

## Build and deploy, after separate deployment approval

1. Enable approved APIs/create approved resources using the reviewed `provision` plan.
   In Console verify SQL Delhi/zonal/SSD, backups and PITR, deletion protection; cap storage
   auto-growth at 20 GiB. Verify app buckets/private access, repository Delhi, one Delhi
   replica per secret. No dummy credentials may be used for an actual deployment.
2. Identity Platform → enable Email/Password, email verification/password-reset templates,
   approved staging authorized domains, registration controls and anti-abuse quotas. Add
   confirm the existing Firebase web app in **cynk-staging-e9c53**, separate from infrastructure
   project **cynk-staging**, rather than registering another.
   Record public key/app ID and enable approved Google/GitHub settings securely. No SMS
   or LinkedIn integration until separately configured/tested. Production college/role rules stay intact.
3. Copy `backend.env.yaml.example` to ignored `.local/backend-staging.yaml`. Replace public
   placeholders and project IDs; keep maintenance true. The `.env` example is **not** a
   gcloud YAML env-vars file. Use only real staging URLs/config, secret references pinned
   to numeric versions and an exact reviewed commit tag (not `latest`).
4. Build from this clean isolated checkout, with the explicit staging build identity and
   regional source bucket. Set PowerShell variables to reviewed **public** config only:

```powershell
# NOT authorized for execution yet. Confirm approval/project/quote/credentials first.
# Set only to providers already verified enabled. Tilde delimiter preserves comma in this list.
$GcpAuthProviders = 'google,github'
gcloud builds submit --project=$GcpStageProject --region=asia-south2 --config=deployment/gcp/cloudbuild.yaml --service-account="projects/$GcpStageProject/serviceAccounts/cynk-build@$GcpStageProject.iam.gserviceaccount.com" --gcs-source-staging-dir="gs://$GcpStageProject-staging-build-source/source" --substitutions="^~^_RELEASE=$GcpRelease~_PUBLIC_AUTH_KEY=$GcpPublicAuthKey~_PUBLIC_APP_ID=$GcpPublicAppId~_FRONTEND_ORIGIN=$GcpFrontendOrigin~_PUBLIC_AUTH_PROVIDERS=$GcpAuthProviders"
```

5. Review image digest and build log. Create/execute the fresh migration job using the
   original guide's Delhi commands, explicit `--project`, 1 task, 0 retries, 600 s and only
   migrator credentials. Preserve 15 migrations; verify ledger, constraints and empty-user
   state. Apply runtime privilege SQL. Seed **reference taxonomy/colleges only**, no demo
   users. Create the bounded recommendation job separately; scheduler not yet approved.
6. Deploy backend from the original guide with explicit `--project`, region Delhi, reviewed
   public YAML and numeric runtime secret version. No migration on service startup.
   The service YAML now contains every required public variable but is an unapplied
   template; replace placeholders and review invocation IAM before applying.
7. Obtain actual `status.url`; **do not invent a `region.run.app` hostname**. Put that URL
   in a **separate** Vercel staging project's `BACKEND_URL` and Google public config, never
   existing Vercel production settings. Deploy that isolated frontend only after approval.
8. Test Auth registration controls before opening maintenance. The application flag does
   not block direct Identity Platform signups; use native provider controls separately.

## Verification checklist and evidence

These checks are planned, **NOT executed against GCP**. Save evidence without passwords,
tokens, cookies, secret URLs, personal data or API keys.

- Read service/revision/SQL/bucket/secret metadata: exact project and region, correct
  service account, no old provider environment values, private access, empty SQL allowlist.
- Run readiness/health with SQL roundtrip; 15 migration ledger rows, runtime cannot create
  tables/read migration ledger; migration identity not attached to backend. Check container
  startup on Linux/ADC and DB pool bounds; micro capacity may require a newly approved tier.
- Browser synthetic two-account signup, verified approved-domain login, refresh, expiry/
  revocation, logout, password reset and redirects. Reject malformed/subdomain college
  emails. Test DB-based roles, incomplete-profile connection gate, moderator boundaries.
- Discover/profile, connection create/accept/decline, Ideaboard, notification and messaging;
  SSE reconnect after 55 s, token refresh, multi-tab logout, instance/revision turnover.
- New profile photo, college ID and attachment upload/download/delete; compare hashes,
  wrong-user signed/private access and direct anonymous GCS reads denied. No source users.
- Check rewrite network target, CSP, cookie/SameSite/secure flags, CORS and canonical origin;
  no Render/Supabase calls. Maintenance blocks API writes; native Auth signup is separately
  disabled/re-enabled in rehearsal. GCS has no browser write IAM.
- Run existing `tests/gcp-e2e/smoke.spec.ts` through its staging-only config after approved
  synthetic-account setup. Record commit/digest/resource names and actual pass/fail count.
- Portable PostgreSQL/Auth/file backup and isolated restore with UID relationships,
  policies/authorization and hashes; do not assume regional SQL backups cover Auth/GCS.
  Off-machine backups, write-freeze/rollback and measured downtime remain readiness blockers.
- Run `gcp-benchmark.mjs` from Jaipur and representative north/west/south/east India ISPs.
  Record cold/warm first/median/p95, real API/SQL/SSE measurements, Vercel rewrite region and
  RTT. Delhi is geographically nearer Jaipur; this is an expectation, **not a measured
  latency improvement**. Mumbai could be better for western/southern routes; ISP peering,
  cold starts and frontend routing can outweigh distance. Do not provision a comparison
  stack without approval. Same-region SQL avoids an unnecessary inter-region roundtrip.

## Cleanup and next approval

`node scripts/gcp-staging-plan.mjs .local/gcp-staging.json` produces a `cleanup` list,
not deletion execution. Only after separate cleanup approval and recovery/retention review:
stop new staging writes, preserve portable backups off-project, inventory and verify exact
project/resource ownership; delete only confirmed staging Run jobs/service, empty buckets,
approved registry/secrets/identities/roles. Nonrecursive `storage rm gs://BUCKET` must fail
on nonempty buckets; do not add `--recursive`. SQL deletion protection remains enabled:
removing it is another explicit manual action. Review final backup before SQL deletion.
Remove the exact staging budget through Billing after recording its ID. This intentionally
does not delete the project, unlink billing or touch old services. Partial cleanup continues
to incur SQL/artifact/retained-object charges; verify inventory and billing afterwards.

Before proceeding, obtain: actual project ID/number and billing ID/currency; ₹2,000 INR
quote with tax/headroom; trial balance/expiry; region/org-policy/quota checks; Auth residency
acceptance; scoped operator/IAM approval; secret/Auth configuration approval; separate
staging build/migration/deployment approval. No provisioning approval has been given.
**NO-GO remains for deployment until those gates clear, and for production until deployed
integration, recovery and cutover rehearsal succeed.**

## Local validation of this revision

On 2026-10-09: TypeScript and architecture boundaries passed; the complete unit/service
suite passed **449 tests in 43 files**. The final targeted configuration/provider suite
passed **44 tests in 3 files** after strengthening region-consistency assertions. The
standalone Cloud Run `npm run build` passed using synthetic public Firebase configuration,
with no deployment or connection to GCP. Changed code/docs formatting and Git whitespace
checks passed. No ESLint configuration exists in this repository.

The region scan found `asia-south1` only in intentional price comparisons and negative
configuration tests. The 15 migration files, SSE implementation and college rules have
no diff. Docker execution, real Auth/SQL/GCS/IAM tests, account billing/quotas, deployed
browser tests, latency and recovery/downtime measurements were **not run**. Previous local
browser results in the main migration guide are historical, not new Delhi deployment evidence.
