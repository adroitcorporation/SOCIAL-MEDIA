# CYNK Cloud Run-only staging approval — 9 October 2026

This supersedes the Vercel staging plan. **The user approved this staging scope,
conditional on all mandatory preflight gates. The Linux capacity gate has now passed,
temporary preflight resources are cleaned up, and the approved 512 MiB staging
infrastructure is being provisioned.** Existing Vercel, Render and Supabase production
remain untouched. The historical blocked attempts below are superseded by
[the measured capacity result](gcp-capacity-preflight-results.md). No live deployment
success is claimed until deployed integration tests complete.

## Conditional approval execution status — 9 October 2026

### Subsequent capacity-preflight approval and blocked execution

The user separately approved a temporary Cloud Build capacity preflight, with a
**₹30 maximum estimated gross cost including temporary storage**, testing genuine
Linux limits of 1 vCPU and 512 MiB, followed by 1/2 GiB only if necessary. Temporary
build access/source storage and subsequent cleanup are authorized; no permanent
SQL/Run service is authorized by that preflight. The planning budget is now up to
₹9,000/month during the trial, but materially changed permanent specifications or
costs still require approval. The existing fixed resource scope/budgets are unchanged.

Execution stopped at the required billing retry: authenticated project billing-info
GETs timed out at 45 seconds and again at 20 seconds. Retrying without the optional
quota-project header did not resolve the timeout. Independent unauthenticated curl
HEAD probes to both `cloudbilling.googleapis.com` and `cloudbuild.googleapis.com`
failed with curl exit 28, connection timeout after approximately five seconds.
CLI local authentication inventory still identifies the approved account, but this
does not establish current billing linkage or network/API access.
An additional retry also failed to refresh the CLI OAuth token: connection to
`oauth2.googleapis.com:443` timed out (SDK connect timeout 120 seconds). Explicit
IPv4 probes to Billing and Cloud Build also timed out. This is connectivity evidence,
not an IAM-denial response; do not change permissions or credentials to address it.

**No Cloud Build submission, build ID, container measurement, synthetic database,
temporary bucket/IAM grant/artifact, cleanup operation or paid resource exists from
this preflight attempt.** The smallest stable memory size is unmeasured. Previously
passed local tests are not substituted for a Linux container capacity result.

Resume the already authorized preflight when normal HTTPS access to the official
Billing and Cloud Build APIs is restored; do not bypass network/security restrictions
or request the same preflight approval again. Reconfirm infrastructure billing enabled
and Firebase billing disabled before any paid build. Then use a maximum 30-minute
build timeout (quoted build compute about ₹20.39 with 18% tax), ensure all associated
temporary storage/other charges keep the estimate below ₹30, test the runtime with
no swap and 1 CPU, preserve only sanitized measurement evidence locally, and remove
the temporary source objects/access/resources created by this preflight. No upgrade,
deployment or permanent provisioning is implied by an increased planning budget.

- Enabled only `cloudbilling.googleapis.com` in `cynk-staging`, as explicitly approved.
  Authenticated account-specific Pricing API requests now succeed in INR. No API or
  billing change was made in `cynk-staging-e9c53`.
- A final project billing-info recheck timed out after 20 seconds; the SDK default
  build-service-account lookup also stalled and was canceled. Earlier verified billing
  linkage/Firebase billing-disabled evidence is retained, but these calls do not provide
  a new successful revalidation. Retry read-only checks before any provisioning.
- The account quote in `deployment/gcp/pricing.inr.json` supersedes the USD/FX table
  below for the approval gate. `accountStagingEstimate()` in `scripts/gcp-costs.mjs`
  computes **₹1,512.23 before tax + ₹272.20 at 18% = ₹1,784.43/month**. This excludes
  trial credits and conservatively ignores available free consumption tiers other
  than the documented project logging allowance and Spark Auth quotas.
- The estimate now also includes 1 GiB build-source archive storage (2 GiB aggregate
  GCS), 30 aggregate job minutes, and the correct **first-tier** Asia-Pacific egress
  price. Usage assumptions: 20 aggregate Run instance-hours, 100,000 requests,
  5 GiB internet egress, 120 build minutes, 2 GiB aggregate retained backups,
  2 GiB registry and 2 GiB logs/month. Soft-deleted objects/versions count toward
  these storage assumptions. It is not a hard cap; SSE keeps active instances billed.
- Authenticated `gcloud sql tiers list` confirms `db-f1-micro` in `asia-south2`.
  Google's Enterprise shared-core documentation supports seven-day PITR and backups.
  Creation must explicitly select Enterprise, enable PITR and seven-day retention;
  CLI-created instances do not enable PITR by default. Actual configured backup
  recovery still requires a deployed restore test. The micro tier has no SQL SLA.
- **BLOCKER: the required 1 CPU / 512 MiB Linux runtime test has not been executed.**
  No Docker or Podman CLI is installed; `wsl --list --quiet` reports WSL is not
  installed. Build/unit-test success does not establish memory fitness for concurrent
  SSR, Prisma, Firebase, image processing and SSE. Do not provision SQL/Run/IAM/secrets
  or run paid builds merely to work around this mandatory pre-provisioning gate.
- Next action: provide a working local Linux Docker runtime for the bounded container
  test, or explicitly authorize a separate, bounded Cloud Build preflight verification
  before the remaining gates pass. A 30-minute e2-standard-2 build is approximately
  **₹20.39 including 18%**, before source/log storage, at the verified gross quote;
  a ₹30 test allowance would require separate approval and least-privilege build access.
  This is a proposed gate-resolution option, not an executed build or authorization.
- Deployment status: **NO-GO pending measured runtime capacity**. No live staging URL,
  SQL instance, private buckets, registry, secrets, custom IAM grants, new budget,
  deployed authentication tests or performance measurements exist from this execution.

Sources: [account-specific pricing API](https://docs.cloud.google.com/billing/docs/reference/pricing-api/rest/v1beta/billingAccounts.skus.prices/get),
[Enterprise editions](https://docs.cloud.google.com/sql/docs/postgres/choose-edition),
[instance creation/PITR defaults](https://docs.cloud.google.com/sql/docs/postgres/create-instance),
[India GST](https://docs.cloud.google.com/billing/docs/resources/vat-overview).
The 18% reserve follows Google's India billing-address rule; final invoice treatment
depends on the account's payments profile. No payments-profile or billing setting changed.

## Architecture

One `cynk-staging-backend` Cloud Run service in **asia-south2** serves the existing
Next.js standalone frontend, Node API, session bridge, static files and SSE. The name is
retained to reuse existing templates; no second frontend container/service is needed.
Browser requests to pages, `/api`, `/session` and `/api/live` use the same HTTPS origin.
No Vercel staging, paid frontend feature, rewrite to Render, self-rewrite, load balancer,
NAT, CDN, domain purchase or proxy service is included. Legacy production paths remain.
Runtime and Next build reject BACKEND_URL/VERCEL_ENV in Cloud Run configuration.

- Infrastructure/SQL/GCS/registry/secrets/builds: **cynk-staging**.
- Firebase Auth: **cynk-staging-e9c53**, billing stays **disabled**.
- Google, GitHub and password login verified enabled; no enabled OIDC/LinkedIn.
- Backend explicit Firebase project controls token audience/issuer; the infrastructure
  project controls SQL sockets and private GCS buckets. No old users/data imported.
- Preserve 15 migrations, college rules, database roles, API contracts, UI and SSE.

## Read-only evidence and trial eligibility

User-confirmed Billing Console credit balance **₹28,797**, expiry **8 January 2027**.
CLI reconfirmed the infrastructure billing account open/INR and linked, while Firebase
billing is disabled. Account API metadata does not independently expose remaining credit.
Prior empty-resource inventory and regional quota evidence are reused; a fresh Delhi Run
inventory returned no services. No Vercel account check is needed under the new decision.

The standard Google-owned Run, SQL, GCS, Secret Manager, Artifact Registry, Cloud Build
and logging services are not listed as trial exclusions. No GPU, Marketplace purchase,
Windows VM, quota increase, partner AI or prohibited trial usage is proposed.
[Google trial conditions](https://docs.cloud.google.com/free/docs/free-cloud-features).
These are eligible service categories, not a guarantee of capacity or the credit's final
tax treatment. Do not upgrade billing, enable Firebase billing, buy commitments or change
regions/tiers automatically. Stop if trial restrictions/capacity prevent the named scope.

Current SDK read probe with CLI-user credentials succeeds against billing-disabled Auth;
the SDK rejects infrastructure-audience synthetic tokens. Runtime-SA and valid-user token
tests still await approved identity/grant and a synthetic login. No existing user read.
IAM permission tests confirm custom-role creation/policy-update access in both projects.

Hobby is unsuitable for the user's commercial startup development under
[Vercel rules](https://vercel.com/docs/limits/fair-use-guidelines). CLI whoami returned
logged out after an updater-worker timeout. No login, project linking, deployment,
temporary deployment or upgrade was performed; Vercel is now removed from staging scope.

## Itemized combined frontend/API estimate

Delhi public list rates from `deployment/gcp/pricing.usd.json`. **₹100/USD is a planning
allowance, not an account INR SKU quote; 18% GST is a modeled reserve.** Auth-project Spark
quotas apply, not a paid upgrade. Credits/free-tier offsets are excluded from approval base.

| Monthly charge                     | Assumption                                            | INR before modeled tax |
| ---------------------------------- | ----------------------------------------------------- | ---------------------: |
| SQL compute                        | PostgreSQL 16 Enterprise zonal db-f1-micro, 730 hours |                 919.80 |
| SQL SSD                            | Fixed 10 GiB, no automatic growth                     |                 204.00 |
| SQL backup/PITR                    | 2 GiB used; inspect actual retained usage             |                  19.20 |
| Combined frontend/API Run          | 20 aggregate active instance-hours, 1 CPU/512 MiB     |                 254.52 |
| Run requests                       | 100,000 including pages/assets/API                    |                   4.00 |
| Private GCS storage/operations     | 1 GiB, 1000 A/10,000 B operations                     |                   3.20 |
| Registry                           | 2 GiB                                                 |                  20.00 |
| Secret versions/access             | 2 versions/1000 accesses                              |                  12.30 |
| Builds                             | 120 e2-standard-2 minutes                             |                  72.00 |
| Internet egress                    | 5 GiB, common first-tier destinations                 |                  60.00 |
| Auth/logging                       | Existing Spark Auth limits; 2 GiB logs                |                   0.00 |
| **Subtotal**                       |                                                       |           **1,569.02** |
| **Modeled GST reserve**            | 18%                                                   |             **282.42** |
| **Combined total, before credits** |                                                       |    **₹1,851.44/month** |

Previous ₹1,656.44 backend-only scenario is superseded. Extra frontend load adds about
₹195.01/month; separate frontend hosting fee is zero because it shares the service.
Unused account-shared free allowances could reduce this to ₹1,441.02; do not rely on them.
The ₹2,000 target leaves just **₹148.56** modeled headroom. Automatic disk growth is now
disabled: growing to 20 GiB would produce **₹2,092.16**, requiring revised approval.
Fixed disk can fill and interrupt writes; inspect SQL storage regularly and stop/escalate
before capacity exhaustion. Do not silently resize, enable auto-growth or increase tier.

20 active instance-hours includes all frontend/API/SSE time across all replicas. Persistent
SSE can keep instances billable and exceed this model; max 2 is not a spending cap. The
initial approved test window should be bounded (up to 2 hours, max 2 replicas, no sustained
load) and recorded. Initial 30-minute build costs about ₹21.24 modeled taxed if outside
free allowances, already inside the 120-minute assumption. One 10-minute migration or
recommendation job adds about ₹1.61 modeled taxed; stop/review further test batches.

The actual account pricing API read returns 403 SERVICE_DISABLED for Cloud Billing API.
No bypass/extra enablement occurred. Approval may include enabling **only
cloudbilling.googleapis.com in cynk-staging** for a read-only INR quote; verify actual
SKU/tax totals **before resource creation**, and stop for revised approval if >₹2,000.
Alternatively the user supplies a Console INR quote for the same quantities. No API
enablement is authorized merely by preparing this plan.

Reproduce offline: `inrStagingEstimate({ fullStack: true })` in `scripts/gcp-costs.mjs`.

## Exact resources and authorization requested

1. **SQL:** cynk-staging-db, Delhi, PostgreSQL 16 Enterprise, zonal db-f1-micro, fixed 10 GiB
   SSD, 7 retained backups/7 PITR days, deletion protection, public IP with no authorized
   networks; managed connector. Database cynk_staging, migrator/runtime owners unchanged.
2. **Run:** cynk-staging-backend, Delhi, request billing, 1 CPU/512 MiB, min 0/max 2,
   concurrency 20, timeout 300 s. Single full-stack app. Manual cynk-staging-migrate and
   cynk-staging-recommendations jobs, 1 task, no retries, 600 s; no scheduler.
3. **Private Delhi buckets:** cynk-staging-staging-profile-photos,
   cynk-staging-staging-college-ids, cynk-staging-staging-event-attachments and
   cynk-staging-staging-build-source; Standard, uniform access, public-access prevention.
4. **Registry/secrets:** Delhi Docker repository cynk; two Delhi-replicated secrets
   cynk-runtime-database-url and cynk-migration-database-url with pinned numeric versions.
   Generate/set fresh DB credentials securely; no credential values in commands/logs/source.
5. **Identities:** cynk-runtime, cynk-migrator, cynk-build, cynk-recommendations in infrastructure.
   Runtime SQL Client + three-bucket custom object get/create/delete + runtime secret;
   migrator SQL Client + migration secret; recommendation SQL Client + runtime secret;
   build repo Writer + Log Writer + source-bucket Viewer. Approved scoped deployer actAs/
   build/Run permissions only; no Owner/Editor grants or downloadable SA keys.
6. **Cross-project Auth:** custom cynkIdentityReader in cynk-staging-e9c53 with only
   firebaseauth.users.get, bound to cynk-runtime@cynk-staging.iam.gserviceaccount.com.
   Add only the new Run staging hostname to Firebase authorized domains and configure
   staging email-action URLs; preserve existing provider/domain settings. No Auth billing.
7. **Cost monitoring:** preserve existing net ₹2,000 budget; add gross usage budget
   CYNK-staging-gross-INR-1694 excluding all credits, infrastructure project only, actual
   50/75/90/100% and forecast 90/100%, billing-admin email recipients. ₹1,694 + modeled
   18% tax is ₹1,998.92. This is an alert, not a tax-inclusive bill or hard cap. Verify
   recipients; stop/escalate when forecast exceeds target. No paid monitoring add-ons.
8. **Build/deploy/test:** reviewed local source, Cloud Build, original 15 fresh migrations,
   runtime SQL privilege restrictions, separate synthetic accounts/files, full-stack
   staging deployment and bounded real E2E/security/SSE/latency checks. No push or merge.

Accept Firebase Auth US processing exception; SQL/Run/GCS stay in Delhi. No Vercel changes,
production traffic, old-user import, production cutover or old-service retirement.

## Reproducible execution sequence — only after approval

1. Confirm approved scope, fresh inventories/quotas/credit availability and actual INR quote;
   stop on conflicting resources, extra cost, denied permissions or trial restriction.
2. Generate review-only command arrays: `node scripts/gcp-staging-plan.mjs .local/gcp-staging.json`.
   Review project/region on every command, then execute only provision/budget arrays approved
   above. No automatic cleanup or API/IAM creation outside this scope.
3. Obtain project number read-only. Google documents the predictable URL format:
   `https://cynk-staging-backend-PROJECT_NUMBER.asia-south2.run.app`.
   [Official URL format](https://docs.cloud.google.com/run/docs/triggering/https-request).
   Use this planned canonical origin for public build/Auth actions. It is not a live URL
   until deployed; verify returned `status.url` and redirect responses afterward.
4. Fill ignored backend-staging.yaml from backend.env.yaml.example; use matching HTTPS
   APP_URL/NEXT_PUBLIC_APP_URL, actual public Firebase config, providers google,github,
   Firebase project cynk-staging-e9c53. No BACKEND_URL/VERCEL_ENV. Keep maintenance true.
5. Securely configure SQL users/secrets, build runtime/tooling images using cloudbuild.yaml
   with explicit build SA and source bucket. `_FRONTEND_ORIGIN` now means the **Run app origin**;
   `_AUTH_PROJECT_ID=cynk-staging-e9c53`. Use tilde-delimited substitutions for provider commas.
6. Execute migration job with migrator secret; verify 15 ledger entries, empty user tables,
   constraints/indexes and reference-only records. Apply database-access.sql privileges.
7. Deploy the app with pinned image digest/runtime SA/secret version, maintenance true.
   Permit public Run invocation only after startup/isolation checks; app Auth remains mandatory
   for protected APIs. Confirm actual HTTPS origin and Firebase domain/action settings.
8. Release staging maintenance only; run synthetic two-account auth/authorization, profile,
   Discover, connections, chats, ideas, notifications, uploads/private files and SSE tests.
   `playwright.gcp.config.ts`: same Run origin as frontend, separate infrastructure/Auth
   project variables. Inspect browser targets/cookies, p50/p95/cold-start/SQL measurements.
   Do not claim success from HTTP 200 alone. Stop on security failure or cost overrun.

## Rollback/cleanup

Keep production untouched. For staging rollback, enable staging maintenance, deploy the
previous reviewed image/env/secret versions only if schema-compatible; never blindly reverse
migrations. Restore a verified synthetic-data backup to separately approved recovery storage
if necessary; no restore over production or unquoted extra recovery resources.
Planner cleanup lists named staging resources only and removes cross-project Auth read
binding before deleting the runtime identity. It is review-only, separate deletion approval
required. SQL deletion protection must stay on until retention approval. Nonempty bucket
deletion must fail; no recursive deletion, project deletion, billing unlink or Firebase
project/user deletion is included. New Auth domain removal needs separate approval.

**Decision:** ready for consolidated scope review, **NO-GO for execution until explicit
approval and actual INR quote gate**. No deployed integration/performance/recovery claim.
