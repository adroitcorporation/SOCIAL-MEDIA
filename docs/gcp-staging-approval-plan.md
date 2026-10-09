# Superseded staging approval scope

Follow [the revised Cloud Run-only approval plan](gcp-cloud-run-staging-approval.md). It includes frontend traffic, fixed 10-GiB SQL storage, a tax-reserved gross budget and no Vercel staging. Earlier resource/cost instructions below are historical, not execution authorization.

# CYNK final staging approval plan — NO-GO pending manual evidence

2026-10-09; `feat/gcp-fresh-start`; project `cynk-staging`; region `asia-south2`.
This updates the remaining blockers in the earlier preflight report. No additional APIs,
IAM, billing, credentials, resources or deployments were changed. No push/merge occurred.

## Verified Firebase project separation (latest update)

Infrastructure remains `cynk-staging`; Firebase authentication is the existing project
`cynk-staging-e9c53`. Authenticated reads verified its active web app, matching local web
configuration, Email/Password enabled with password required, Google/GitHub enabled,
and no enabled OIDC providers. No extra Firebase Management API enablement is needed
in the infrastructure project. Earlier Auth 404s there are superseded by this separation.
Backend `FIREBASE_AUTH_PROJECT_ID` and public Firebase project target the Auth project;
SQL/socket/GCS/build billing continue to use `GCP_PROJECT_ID=cynk-staging`.
The custom `cynkIdentityReader` role must be created/bound in **cynk-staging-e9c53** to
`cynk-runtime@cynk-staging.iam.gserviceaccount.com`, not in the infrastructure project.
Read-only IAM permission tests verified `iam.roles.create` and
`resourcemanager.projects.setIamPolicy` in both projects. No IAM changes were made.

The user accepts ₹1,656 as a planning estimate only. Their latest credit balance/expiry
and Vercel team/plan answer contains placeholders, not verified values. These remain
real prerequisites; it is not final provisioning approval or proof of plan eligibility.

## What is resolved

Authenticated read-only CLI reconfirmed billing enabled and the linked account open in INR.
Billing account IAM has one Billing Administrator. The existing budget is unchanged:
INR 2000/month, project number 1002434130638 only, all credits included, actual thresholds
50/90/100/150%, no forecast rules or custom notification channels. Empty inventory and
Run/build quotas from completed preflight are reused rather than rerun.

The SQL instance-count concern is resolved as a **published limit**, not a missing regional
quota. Google explicitly says some resource limits are not shown on the Quotas page:
[SQL limits](https://docs.cloud.google.com/sql/docs/quotas) allow 1000 instances/project
with new SQL network architecture, 100 with old, or an intermediate count with both.
One instance in the verified empty project is below either limit. Delhi micro tier was
returned by `gcloud sql tiers list`; SQL API rate limits were read previously. This does
not reserve capacity or prove allocation will succeed. Do not spend money creating an
instance merely to test availability. If provisioning later fails on quota/capacity, stop;
no automatic tier upgrade, region change or quota-increase request is approved.

Run quota is 20 vCPUs/40 GiB for Delhi; proposed max two 1-CPU/512-MiB service instances
fits. Build public-pool CPU limit is 4, sufficient for one e2-standard-2 build. SQL connector
has a 100-connection/container ceiling, but the application's pool is deliberately 2:
two backend instances use up to 4 application connections, plus bounded jobs/operator
connections. Actual PostgreSQL `max_connections`, micro memory and 15-migration execution
must be checked after approved provisioning, not claimed verified now.

## Itemized INR planning estimate

Rates are the current reviewed Google public Delhi on-demand USD rates in
`deployment/gcp/pricing.usd.json`; [sources and workload assumptions](gcp-regional-costs.md).
**INR conversion allowance ₹100/USD is a planning assumption, not live FX or an account
INR SKU quote.** No account-specific pricing API was enabled. The public Catalog/Pricing
API requires Cloud Billing API access; enabling extra APIs is outside this task. No
connected browser surface was available for an authenticated Console price/trial read.

GST modeled at **18%** when sold by Google Cloud India Private Limited to an Indian billing
address, per [Google's tax documentation](https://docs.cloud.google.com/billing/docs/resources/vat-overview).
Actual seller, tax treatment and credits must be checked in the account; no input-tax
credit/refund or trial tax exemption is assumed. Taxes are added as a planning reserve,
not asserted to be included in the budget's usage calculation.

| Monthly line item                         | Assumption                                   |         Pre-tax INR |
| ----------------------------------------- | -------------------------------------------- | ------------------: |
| SQL compute                               | micro, 730 h at $0.0126/h                    |             ₹919.80 |
| SQL SSD                                   | 10 GiB at $0.204/GiB-month                   |             ₹204.00 |
| SQL backups/PITR used data                | assumed 2 GiB at $0.096                      |              ₹19.20 |
| Run processing                            | 10 active instance-hours, 1 CPU/512 MiB      |             ₹127.26 |
| Run requests                              | 50,000                                       |               ₹2.00 |
| GCS capacity/operations                   | 1 GiB total; 1000 A / 10,000 B ops           |               ₹3.20 |
| Registry                                  | 2 GiB                                        |              ₹20.00 |
| Secret Manager                            | two active versions / 1000 accesses          |              ₹12.30 |
| Builds                                    | 120 e2-standard-2 minutes/month              |              ₹72.00 |
| Internet network                          | 2 GiB, common first-tier destination         |              ₹24.00 |
| Auth/logging                              | email/social under MAU allowance; 2 GiB logs |               ₹0.00 |
| **Subtotal before shared free discounts** |                                              |       **₹1,403.76** |
| **18% modeled GST reserve**               |                                              |         **₹252.68** |
| **Total planning amount**                 |                                              | **₹1,656.44/month** |

If all eligible account-shared free allowances are unused, this model becomes
₹1,398.54 including modeled GST, before trial credits. Do not rely on that discount for
approval. ₹2,000 minus the conservative base case leaves ₹343.56 (17.2%) nominal headroom.
SSD auto-growth to 20 GiB adds ₹240.72 including GST: ₹1,897.16 total, leaving little
traffic/backup margin. Continuous SSE can alone exceed ₹10,000/month under this conversion.
There is no hard cap. Choose an approved spending envelope and stop/review unexpected
cost signals; alerts may be delayed and cannot enforce the envelope.

One-time examples: initial 30-minute build ₹18 pre-tax/₹21.24 modeled taxed; 10-minute
1-CPU/512-MiB job ₹1.368 pre-tax/₹1.61 taxed. Initial build minutes are already included if
they fall inside the 120 monthly minutes: do not double count. Recommendation jobs are
manual only; allow one additional 10-minute test batch (~₹1.61 taxed). No Scheduler, NAT,
load balancer, recovery stack, phone/SMS or paid monitoring/scanning provisioned. Portable
recovery resources/data transfers and tier upgrades require separate estimates/approval.

Reproduce the INR calculation locally:

```powershell
node --input-type=module -e "import { inrStagingEstimate } from './scripts/gcp-costs.mjs'; console.log(JSON.stringify(inrStagingEstimate(), null, 2));"
```

**Still required:** a Console INR calculator/account-pricing estimate with these same
quantities, tax and date. The planning conversion cannot be represented as verified INR
prices or a promise to remain under ₹2,000.

## Credits and alert delivery: exact manual checks

1. Console → Billing → select the linked account → Overview/Credits: record trial versus
   paid-account state, remaining promotional balance and expiry date. Do not upgrade,
   link another account or share payment details. CLI account description does not expose
   these fields; standard CLI account commands contain no trial-credit query.
2. Billing → Pricing table: choose INR and inspect Delhi SQL micro/SSD/backup, Run CPU/RAM,
   GCS/egress and other listed SKUs. Or use the Pricing Calculator with India/Delhi and
   the quantities above; record the estimate currency and tax exclusions. Calculator
   capacity is not allocation capacity. Do not enable pricing exports/extra APIs.
3. Billing → Budgets & alerts → existing ₹2,000 project budget → inspect recipients and
   whether billing IAM recipients are enabled. One Billing Administrator exists; verify
   the destination mailbox, Spam and corporate filtering allow budget notification mail.
   No delivered email has been observed; role membership alone is not delivery evidence.
4. The current INCLUDE_ALL_CREDITS budget can show low/zero net cost while promotional
   credits offset usage. Keep it for payable/net tracking if desired, but approve an
   **additional distinct gross-cost budget**, not an accidental duplicate replacement:
   name `CYNK-staging-gross-INR-2000`, project number 1002434130638, all services, monthly
   INR 2000, **exclude all credits**, actual 50/75/90/100%, forecast 90/100%. Check enabled
   billing recipients and any existing verified email channels. No budget was created.
5. Alert email triggers on a threshold crossing; do not claim a universal "send test"
   button exists. If a notification-channel verification/test control is available, the
   user can use it after approval; this tests that channel, not Billing's end-to-end path.
   For a real budget delivery rehearsal, separately approve a temporary gross-budget
   threshold below already accrued gross spend (if any), await billing processing and
   record receipt; restore/delete the test budget only with approval. Do not generate
   spend solely to trigger mail. A fabricated Pub/Sub message tests a subscriber, not
   Google Billing email delivery. No Pub/Sub/Monitoring changes are authorized now.

[Budget credit filters](https://docs.cloud.google.com/billing/docs/how-to/budgets),
[recipient behavior](https://docs.cloud.google.com/billing/docs/how-to/budgets-notification-recipients).

## Exact resources and least-privilege identities

| Resource       | Name/configuration                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run service    | `cynk-staging-backend`, Delhi; 1 CPU, 512 MiB, request billing, min 0/max 2, concurrency 20, 300 s; maintenance initially true                                                  |
| SQL            | `cynk-staging-db`, PostgreSQL 16 Enterprise, zonal micro, 10 GiB SSD/max auto-grow 20, 7 retained backups/7 PITR days, deletion protected                                       |
| Database/users | `cynk_staging`; owner `cynk_migrator`, nonowner DML user `cynk_runtime`; 15 unchanged migrations and existing privilege SQL                                                     |
| App buckets    | `cynk-staging-staging-profile-photos`, `cynk-staging-staging-college-ids`, `cynk-staging-staging-event-attachments`                                                             |
| Build bucket   | `cynk-staging-staging-build-source`; same Delhi Standard/private/PAP/uniform access                                                                                             |
| Registry       | `cynk` Docker repo, `asia-south2-docker.pkg.dev/cynk-staging/cynk`; backend/tooling images tagged with reviewed source and pinned digest                                        |
| Secrets        | `cynk-runtime-database-url`, `cynk-migration-database-url`; single Delhi user-managed replica; numeric versions; never in frontend                                              |
| Auth           | Existing Firebase project `cynk-staging-e9c53`: email/password and Google/GitHub verified enabled; new staging domain/action URLs require approval; US Auth residency exception |
| Jobs           | `cynk-staging-migrate`, `cynk-staging-recommendations`; 1 task, 0 retries, 600 s, bounded/manual, no Scheduler                                                                  |
| Networking     | Managed SQL connector/socket, zero SQL authorized networks; no NAT/VPC connector/LB; Run invocation public only after approved application Auth verification                    |

The doubled `staging` in bucket names is intentional: existing adapter uses project ID
plus environment. Do not shorten bucket names without changing/validating the adapter.
Runtime identity `cynk-runtime` gets SQL Client in infrastructure, custom Auth
`firebaseauth.users.get` in `cynk-staging-e9c53`,
get/create/delete objects only on three app buckets, accessor only on runtime DB secret.
`cynk-migrator` gets SQL Client + migration secret only. `cynk-recommendations` gets SQL
Client + runtime DB secret only; no Auth/Storage rights. `cynk-build` gets repo Writer,
Log Writer and build-source Viewer only. Human deployer needs approved scoped actAs/build/
Run permissions; preserve Google-managed service-agent roles. Never use Compute-default
Editor identity; disposition of that existing grant needs separate IAM approval.

Offline exact command arrays, with actual identifiers held in Git-ignored local config:

```powershell
node scripts/gcp-staging-plan.mjs .local/gcp-staging.json
```

The `provision` phase no longer repeats completed API enablement. The candidate `budget`
phase is a separate gross budget, never an update to the existing net budget. Build/deploy
commands and environment templates are in the staging guide. Secrets/password entry,
Auth settings and initial role bootstrap remain manual approved steps. An actual dedicated
frontend origin and reviewed source revision are prerequisites; no old users imported.

## Cleanup commands — review only, never executed

The planner's `cleanup` arrays include explicit project/region on every resource command.
Examples below need separate deletion/backup-retention approval:

```powershell
gcloud run services delete cynk-staging-backend --region=asia-south2 --project=cynk-staging
gcloud run jobs delete cynk-staging-migrate --region=asia-south2 --project=cynk-staging
gcloud run jobs delete cynk-staging-recommendations --region=asia-south2 --project=cynk-staging
gcloud storage rm gs://cynk-staging-staging-build-source --project=cynk-staging
gcloud artifacts repositories delete cynk --location=asia-south2 --project=cynk-staging
gcloud sql instances delete cynk-staging-db --project=cynk-staging
```

SQL delete must fail while deletion protection is on: removing it needs an approved final
backup/retention decision. Bucket deletion must fail if nonempty; do not add recursive
object removal. Freeze staging writes and verify portable backups off-project first.
The planner also lists the other empty-bucket, secret, identity and role cleanup commands;
gross budget deletion requires its actual ID after creation. Keep the preexisting net
budget and default identities unless separately approved. No project deletion, billing
unlink, production cleanup or implicit cleanup on deployment failure.

## Explicit approval checklist and recommendation

- [ ] Confirm trial balance/expiry and whether billing is trial or upgraded.
- [ ] Accept INR Console quote, tax/headroom and metered overrun risk; approve maximum
      envelope and stop/escalation process, not merely the ₹2,000 alert.
- [ ] Approve separate gross budget/verified recipients; keep existing net budget intact.
- [ ] Accept Auth residency exception and select dedicated staging frontend domain.
- [ ] Review/freeze exact local source revision; no push/merge unless separately approved.
- [ ] Approve named resources/scoped IAM and secure credential/Auth setup explicitly.
- [ ] Approve build, empty-DB migrations and staging deployment/test writes explicitly.
- [ ] Require real Auth, private-file/two-account authorization, SSE and deployed E2E
      evidence, then synthetic backup/restore and measured latency before production readiness.

**NO-GO for provisioning/deployment now**: manual credit/INR quote, alert delivery and
explicit resource/IAM/credential/deployment approval are missing. SQL count-limit blocker
is resolved on documented limits; provisioning capacity, runtime performance and real
integration remain untested. Production remains untouched.
