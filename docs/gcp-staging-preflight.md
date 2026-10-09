# CYNK authenticated staging preflight — STOP / NO-GO

**Remaining-blocker review:** see [the final approval plan](gcp-staging-approval-plan.md).
The SQL count-limit concern is resolved through published 100–1000 instance limits,
not a nonexistent regional quota read. Billing linkage/currency remain confirmed. INR
planning totals now include explicit conversion/tax assumptions; account INR pricing,
trial credit and delivered alerts still require manual evidence. No new cloud changes.

2026-10-09, `feat/gcp-fresh-start`, project `cynk-staging`, primary region `asia-south2`.
The three migration/staging/cost guides were read. The user subsequently approved **only
the 11 listed API enables**, which completed successfully; Google automatically enabled
dependencies and created managed service-agent bindings. All subsequent commands were
read-only. No custom IAM, credential, billing link, resource, migration or deployment was changed.
Existing production was not inspected or altered. No push/merge occurred.

## Verified by Google Cloud CLI

| Check                         | Evidence/result                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| CLI                           | Google Cloud SDK **588.0.0**, official Windows `gcloud.cmd` entry point                                                               |
| Active account                | One authenticated active account; same account holds project Owner. No login, ADC or token export was performed                       |
| Active configuration/project  | Configuration `cynk-staging`; active project `cynk-staging`                                                                           |
| Project                       | ACTIVE; project number **1002434130638**                                                                                              |
| Billing                       | `billingEnabled=true`; linked account is open; **INR** currency                                                                       |
| Enabled services              | The approved 11 APIs plus Google-managed dependencies are enabled; initial baseline was Compute/OS Login only                         |
| Compute inventory             | **0 VMs, 0 disks, 0 reserved addresses**                                                                                              |
| Service accounts/custom roles | Only Compute default service account; **0 custom roles**; no dedicated CYNK identities                                                |
| Existing IAM                  | Project Owner for active human account; Compute default service account has **Editor**; Google-managed Compute agent roles also exist |
| Nonsecret plan identifiers    | Actual IDs saved only in ignored `.local/gcp-staging.json`; concrete offline plan generated in ignored `.local/gcp-staging-plan.json` |

Read-only CLI commands used (no credentials returned):

```powershell
gcloud version --format=json
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud config get-value project
gcloud projects describe cynk-staging --format='json(projectId,projectNumber,lifecycleState)'
gcloud billing projects describe cynk-staging --format=json
gcloud billing accounts describe BILLING_ACCOUNT_ID --format='json(name,open,displayName,currencyCode)'
gcloud services list --enabled --project=cynk-staging --format='value(config.name)'
gcloud projects get-iam-policy cynk-staging --format=json
gcloud compute instances list --project=cynk-staging --format='json(name,zone,status)'
gcloud compute disks list --project=cynk-staging --format='json(name,zone,sizeGb,type)'
gcloud compute addresses list --project=cynk-staging --format='json(name,region,status,addressType)'
gcloud iam service-accounts list --project=cynk-staging --format='json(email,disabled,displayName)'
gcloud iam roles list --project=cynk-staging --format='json(name,title,stage)'
```

## Critical blockers — do not provision

1. Approved API enablement is complete. Current inventory is **0 Run services/jobs in Delhi,
   0 SQL instances, 0 GCS buckets, 0 Delhi registry repositories and 0 secrets**. Delhi
   Run quota metadata reports CPU allocation 20,000 (milli-vCPU units), memory 40 GiB;
   Cloud Build default public pool reports 4 CPUs and 5 ongoing builds. Micro SQL tier is
   advertised for Delhi. SQL quota metadata exposes API rate limits, not a verified
   standard-instance capacity limit; confirm that in Console. Quotas/tier availability
   do not guarantee provisioning capacity. Auth provider/web-app configuration remains unverified.
2. Trial balance/expiry is not exposed by the billing-account description. Check Billing
   → Overview/Credits in Console. Open billing does **not** prove a trial is active or
   that $300 remains. No billing upgrade is approved.
3. Existing project-scoped **INR 2000/month** budget is verified. It uses
   `INCLUDE_ALL_CREDITS`, actual thresholds 50/90/100/150%, no forecast rules and no custom
   notification channels. Defaults route to eligible billing IAM recipients; actual email
   delivery is unverified. This differs from the proposed gross-usage/exclude-credits alert
   configuration. Do not create a duplicate or update it without approval. It is not a hard cap.
4. The minimum-cost configuration still needs an account-specific **INR SKU/calculator
   quote and taxes**, plus explicit spend approval. Public USD estimates below are not
   sufficient to assert a payable INR amount or cap.
5. Runtime/build/migration identities and scoped IAM do not exist. Do not use the existing
   default Compute account with Editor for builds/runtime. Its grant was left unchanged.
   Resolve its least-privilege disposition with separately approved IAM changes; do not
   remove a grant blindly. Organization location/public-invocation policies remain unverified.
6. Accept the documented Auth residency exception (Firebase Auth processing is US-only),
   choose a dedicated staging frontend origin, and approve credentials/Auth setup separately.
7. Local Delhi changes remain uncommitted on the isolated worktree. Review/freeze an exact
   source revision before approved Cloud Build; do not tag dirty source as if it were `5f3e128`.

## Candidate deployment and itemized cost — not approved

All regional resources in Delhi; PostgreSQL 16 Enterprise, zonal `db-f1-micro`, SSD 10 GiB,
auto-growth ceiling 20 GiB, 7 backups/PITR days, deletion protection. Cloud Run 1 CPU/512 MiB,
request billing, min 0/max 2, concurrency 20/timeout 300 s. SSE remains unchanged and counts
as active request time. Private GCS app buckets plus build-source bucket, single Delhi secret
replicas, named restricted service accounts, managed SQL connector, zero SQL authorized
networks, no VPC connector/NAT/load balancer. All 15 migrations are preserved; no old users.

| Monthly cost assumption                                   | USD before shared discounts/tax |
| --------------------------------------------------------- | ------------------------------: |
| SQL compute, 730 h                                        |                          $9.198 |
| SQL 10 GiB SSD                                            |                          $2.040 |
| SQL used backups, assumed 2 GiB                           |                          $0.192 |
| Run, assumed 10 active instance-hours + 50,000 requests   |                          $1.293 |
| GCS, 1 GiB total + 1,000 A/10,000 B operations            |                          $0.032 |
| Artifact Registry, 2 GiB                                  |                          $0.200 |
| Secret Manager, 2 active versions + 1,000 accesses        |                          $0.123 |
| Cloud Build, assumed 120 min/month                        |                          $0.720 |
| Internet egress, assumed 2 GiB                            |                          $0.240 |
| Email/password Auth, logs 2 GiB under included allowances |                              $0 |
| **Total**                                                 |                **$14.04/month** |

With unused applicable account-shared free allowances, modeled total is **$11.85/month**;
trial credits are not deducted. SQL 20 GiB auto-growth adds up to $2.04/month over the
10 GiB base; backups/egress/SSE can exceed assumptions. Shared micro has no SLA and must
pass actual migration/load tests. A tier upgrade requires a new quote/approval.

One-time work uses normal metered rates, not a flat setup fee: a 30-minute initial build
is $0.18 gross; a 10-minute 1 CPU/512 MiB migration job is about $0.014 gross. Image/source
storage, synthetic uploads, email/provider operations and network usage are additional
where billed. Initial build minutes must not be counted twice if included in the monthly
120-minute allowance. Actual build/job duration is unknown. Recovery infrastructure and
paid load/latency test resources are excluded and require separate quotes/approval.

Sources/rates and usage caveats: [regional cost report](gcp-regional-costs.md),
[SQL pricing](https://cloud.google.com/sql/pricing),
[Run pricing](https://cloud.google.com/run/pricing).
No deployed tests, real GCP latency, Auth delivery, SQL/GCS access or recovery passed this turn.
Earlier local 449-test/build results are not deployed verification.

## Exact commands and next approval scope

Generate reviewed argument arrays using actual locally recorded nonsecret identifiers:

```powershell
# OFFLINE ONLY; does not invoke gcloud.
node scripts/gcp-staging-plan.mjs .local/gcp-staging.json
```

The generated `provision`, `budget` and `cleanup` sections are **not approved for execution**.
Build, migration and deployment commands are in the staging guide; they also remain unapproved.
Do not replay the full provision phase merely to enable APIs.

The following **API-only approval was received and executed successfully**:

```powershell
# Historical approved operation; do not repeat as a deployment approval.
gcloud services enable run.googleapis.com sqladmin.googleapis.com storage.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com identitytoolkit.googleapis.com cloudbuild.googleapis.com logging.googleapis.com cloudquotas.googleapis.com billingbudgets.googleapis.com orgpolicy.googleapis.com --project=cynk-staging
```

API enablement created Google-managed service identities/bindings; it does not authorize
custom IAM bindings, SQL/Run/GCS resources, Auth provider setup, secret versions, builds or
deployment. Effective resource-location, IAM member-domain and Run ingress policies allow
all; managed Run invoker-IAM requirement is not enforced. Project IAM still has the
preexisting Compute-default Editor grant, unchanged. Named restricted identities remain
mandatory. Stable `gcloud quotas info list` works; the old beta command attempted a SDK
component installer and failed. No workaround, policy bypass or explicit component install
was performed; the planner now uses the stable command.

Next: confirm trial balance/expiry, INR cost quote and standard SQL instance limits in
Console; review budget credit/recipient settings and accept the Auth residency exception;
then approve **separately** any budget/custom-IAM/credential/provisioning/deployment changes.

## Cleanup candidate

Only after separate cleanup/retention approval: freeze staging writes; verify portable
backup off-project; remove confirmed staging jobs/service, approved images/secrets/accounts/
roles; delete only empty staging buckets. The plan never recursively deletes object data.
SQL deletion protection requires its own approved removal and final backup decision.
Remove only the exact staging budget after confirming its ID. Do not delete the project,
unlink billing, or touch Render/Supabase/Vercel production. Verify residual resource inventory
and retained storage charges. This cleanup list has not been executed.
