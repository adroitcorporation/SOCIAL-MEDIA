# Delhi NCR versus Mumbai: public rate comparison

Reviewed **2026-10-09**, USD on-demand prices, 730 h/month, before tax and trial credits.
`pricing.usd.json` records region-labelled rates and official-source page hashes. Selected
SQL rates are Enterprise general-purpose custom/shared-core with SSD, not Enterprise Plus,
N4 Hyperdisk, HA or commitments. These are public list prices, not an authenticated INR quote.

| Charge                                | Delhi `asia-south2` | Mumbai `asia-south1` |
| ------------------------------------- | ------------------: | -------------------: |
| SQL `db-f1-micro` compute/hour        |             $0.0126 |              $0.0126 |
| SQL `db-g1-small` compute/hour        |              $0.042 |               $0.042 |
| SQL Enterprise custom vCPU/hour       |            $0.04956 |             $0.04956 |
| SQL custom memory GiB/hour            |             $0.0084 |              $0.0084 |
| SQL zonal SSD GiB/month               |              $0.204 |               $0.204 |
| SQL used backup GiB/month             |              $0.096 |               $0.096 |
| SQL IPv4 while idle/hour              |              $0.012 |               $0.012 |
| Run request-billed active vCPU/second |          $0.0000336 |            $0.000024 |
| Run active/idle-min memory GiB/second |          $0.0000035 |           $0.0000025 |
| Run idle min-instance CPU/second      |          $0.0000035 |           $0.0000025 |
| Run instance/job vCPU/second          |          $0.0000216 |            $0.000018 |
| Run instance/job memory GiB/second    |          $0.0000024 |            $0.000002 |
| Run requests/million                  |               $0.40 |                $0.40 |
| Single-region Standard GCS GiB/month  |              $0.023 |               $0.020 |

Sources: [SQL pricing](https://cloud.google.com/sql/pricing),
[Run pricing](https://cloud.google.com/run/pricing),
[Run regional tiers](https://docs.cloud.google.com/run/docs/locations),
[Storage pricing](https://cloud.google.com/storage/pricing).
SQL shared-core has **no Cloud SQL SLA**. Minimum staging is not a production recommendation.
Small production below uses single-zone 1 vCPU/3.75 GiB `db-custom-1-3840`, no HA; compute
$59.1738/month. HA approximately doubles this compute and SSD rates; get a separate quote.
Backup usage includes retained snapshots/logs actually billed, not just provisioned disk:
2/10 GiB below are assumptions and must be updated after PITR/storage inspection.
Stopping SQL is not free: SSD/backups remain, and idle IPv4 may cost $8.76/month, nearly
the $9.198 running micro compute charge. No extra idle-IP fee is assumed while running.

Other services and exclusions:

| Service                                                                       | Rate / included allowance / scope                                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GCS operations, flat regional Standard                                        | $0.005/1,000 Class A; $0.0004/1,000 Class B. Soft-deleted/versioned bytes count; no US-only always-free storage assumption for India                                                                                     |
| [Artifact Registry](https://cloud.google.com/artifact-registry/pricing)       | $0.10/GiB-month; first 0.5 GiB/billing account free. Scanning not included/enabled                                                                                                                                       |
| [Secret Manager](https://cloud.google.com/secret-manager/pricing)             | $0.06/active version/location-month, first 6 free; $0.03/10,000 accesses, first 10,000 free/account. One Delhi replica only                                                                                              |
| [Cloud Build](https://cloud.google.com/build/pricing)                         | Default pool e2-standard-2 $0.006/minute; promotional first 2,500 minutes/account free. Source storage/egress separate                                                                                                   |
| [Logging/Monitoring](https://cloud.google.com/products/observability/pricing) | Logs first 50 GiB/project-month free then $0.50/GiB; >30-day retention $0.01/GiB-month. Google built-in nonchargeable metrics only; no paid custom metrics, synthetic monitors or metric-alert policy budgeted           |
| [Identity Platform](https://cloud.google.com/identity-platform/pricing)       | Email/social first 50,000 MAU free; no SMS/MFA phone or enterprise federation cost assumed. Auth is not Delhi-regional                                                                                                   |
| [Networking](https://cloud.google.com/vpc/network-pricing)                    | Same-region Run→SQL/GCS/registry no regional transfer fee; internet common India/NA/Europe destinations modeled at first-tier $0.12/GiB. Destination-specific rates differ; no Mumbai/Delhi internet free-GiB assumption |
| Connector/NAT/load balancer                                                   | $0 in this design: no VPC connector, NAT or external LB provisioned; managed SQL connector with empty authorized networks                                                                                                |

Files proxied from same-region GCS to Run then internet pay external egress at Run's boundary;
do not count a second GCS internet transfer for that same byte. Direct GCS exports/downloads
can incur GCS internet egress. Vercel charges are outside this GCP estimate. Builds currently
pull global public base images; app images/source storage are regional, not all build traffic.

## Reproducible scenarios

Run `node scripts/gcp-costs.mjs` for the full line-item calculation. Both scenarios min 0;
active **instance** hours include SSE time, not sum of users' hours (concurrency shares CPU).
Staging: 10 active hours, 1 CPU/0.5 GiB; micro SQL/10 GiB SSD/2 GiB backups; GCS including
build source 1 GiB, 1,000 A/10,000 B operations; 2 GiB artifacts; two secret versions and
1,000 accesses; 120 build minutes; 50,000 requests; 2 GiB egress; logs 2 GiB.
Production: 120 active hours, 1 CPU/1 GiB; custom SQL/20 GiB SSD/10 GiB backups; GCS 10 GiB,
10,000 A/100,000 B operations; 5 GiB artifacts; two secret versions/1,000 accesses;
300 build minutes; 500,000 requests; 20 GiB egress; logs 10 GiB. No scheduled job minutes
included until its invocation frequency is chosen; job rates above apply. No production
plan is provisioned by the staging planner.

| Monthly line item                              | Delhi staging | Mumbai staging | Delhi small production | Mumbai small production |
| ---------------------------------------------- | ------------: | -------------: | ---------------------: | ----------------------: |
| SQL compute                                    |        $9.198 |         $9.198 |                $59.174 |                 $59.174 |
| SQL SSD                                        |        $2.040 |         $2.040 |                 $4.080 |                  $4.080 |
| SQL used backups                               |        $0.192 |         $0.192 |                 $0.960 |                  $0.960 |
| Run active processing, gross                   |        $1.273 |         $0.909 |                $16.027 |                 $11.448 |
| Requests, gross                                |        $0.020 |         $0.020 |                 $0.200 |                  $0.200 |
| GCS capacity/operations                        |        $0.032 |         $0.029 |                 $0.320 |                  $0.290 |
| Registry                                       |        $0.200 |         $0.200 |                 $0.500 |                  $0.500 |
| Secret versions/access                         |        $0.123 |         $0.123 |                 $0.123 |                  $0.123 |
| Builds                                         |        $0.720 |         $0.720 |                 $1.800 |                  $1.800 |
| Internet egress                                |        $0.240 |         $0.240 |                 $2.400 |                  $2.400 |
| Basic Auth/logging under allowances            |            $0 |             $0 |                     $0 |                      $0 |
| **Before account-shared free discounts**       |    **$14.04** |     **$13.67** |             **$85.58** |              **$80.97** |
| **If all relevant free allowances are unused** |    **$11.85** |     **$11.85** |             **$78.19** |              **$73.58** |

Free Run processing allowance is applied as Tier-1 dollar credits: $4.32 CPU + $0.90
memory/account-month. Do not subtract 180,000 CPU seconds at Delhi's higher rate: this
would overstate its discount. Other account services consume these same allowances.
Trial credits are not deducted here. These scenarios are not maximum-cost guarantees.
At min 1, an idle Delhi 1 CPU/1 GiB container adds $0.0252 per idle hour before shared
discounts (610 idle hours = $15.372). At min 0, a continuously active Delhi 1 CPU/0.5 GiB
SSE instance for 730 hours alone costs $92.959 gross before discounts/requests. Therefore
19 users do not imply negligible Run cost. No latency or throughput measurements exist.

## Trial and INR approval

[Google's trial](https://docs.cloud.google.com/free/docs/free-cloud-features) offers eligible
new accounts $300 for 90 days. Existing remaining balance, eligibility and expiry are
**unverified**. Ordinary chosen services can use eligible credit; neither Cloud SQL nor
India GCS becomes indefinitely free. Trial restrictions include quota-increase requests,
GPUs/Marketplace and Windows Server VMs. Do not upgrade billing without approval; upgraded
billing can incur payable usage beyond credits, and trial expiry can interrupt services.

Billing currency/INR SKUs, taxes and credits need account inspection. No live exchange rate
or INR SKU price has been substituted. For Delhi's $14.04 gross scenario, ₹2,000 corresponds
to an all-in conversion factor of roughly ₹142.47/USD; this is a **break-even calculation**,
not a currency quote. Extra traffic, retained backups, jobs and tax can consume headroom.
Approve only after the INR calculator quote fits ₹2,000 with contingency. Standard budgets
are alerts; they do not stop billing or guarantee a hard cap. See the staging guide for
project creation, billing linkage, scoped budget and explicit approval checklist.

Delhi is geographically nearer Jaipur/northern India and may reduce RTT versus Mumbai.
That is an inference, not a benchmark; compare ISPs/cold starts/Vercel rewrite paths using
the staging checklist. Mumbai may perform better on western/southern routes. Real deployment,
regional capacity, app performance, recovery time and downtime remain unverified.
