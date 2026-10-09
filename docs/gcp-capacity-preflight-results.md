# CYNK Linux capacity preflight — 9 October 2026

Project `cynk-staging`, Delhi `asia-south2`. No production credentials or data were used.

## Observed result

**Smallest tested stable configuration: 1 CPU / 512 MiB.** Docker imposed 536,870,912
bytes memory, the same total memory/swap allowance (no swap), and 1,000,000,000 NanoCPUs.
The cgroup's reported memory limit matched 512 MiB. Startup's PostgreSQL-backed
`/api/health` check succeeded in 2 seconds. Over 60 seconds with 20 concurrent HTTP
clients, direct synthetic Prisma queries and image processing:

| Measurement                                                      |                         Result |
| ---------------------------------------------------------------- | -----------------------------: |
| Peak cgroup memory (server + synthetic workload processes/cache) | 252,690,432 bytes / 240.98 MiB |
| HTTP requests                                                    |                          6,977 |
| Synthetic Prisma iterations                                      |                          4,977 |
| Image operations                                                 |                            108 |
| HTTP p50                                                         |                      114.37 ms |
| HTTP p95                                                         |                      372.45 ms |
| Container running at completion                                  |                            Yes |
| Container OOM-killed                                             |                             No |

All 15 existing migrations applied to an ephemeral PostgreSQL 16 container. Fifty
synthetic profiles were inserted. The database fixture was outside the application's
512 MiB allocation, reflecting the separate Cloud SQL architecture. Runtime privileges
were applied from the existing database-access SQL. No authentication bypass or
production-only guard was disabled. The workload exercised anonymous pages/config,
database health and rejection of unauthenticated profile/live requests, plus direct
Prisma and Sharp workloads sharing the app's cgroup.

**Limitations:** no successful Firebase login, authorized SSE stream, GCS upload,
Cloud SQL network latency, Cloud Run cold start or sustained production stability was
proved by this test. Those require deployed integration tests. The test's p50/p95
describe this synthetic mix, not production API latency. 1/2 GiB were not tested because
512 MiB passed. No larger permanent memory allocation is recommended from this evidence.

## Build evidence and cost

- `b04caa00-cfbb-4b07-b839-27fe751b43ec`: failed synthetic PostgreSQL initialization,
  15:47:01–15:50:09 UTC. The fixture initially replaced PostgreSQL's normal initialization
  socket; the corrected fixture preserves that socket alongside the Cloud SQL-shaped one.
- `9fd7265e-7b58-4a43-ae21-80740b553f3a`: **SUCCESS**, 15:51:47–15:55:04 UTC.
- Total build wall time about 6.42 minutes. At the authenticated gross INR quote,
  compute is approximately ₹4.37 including 18% tax; reserving eight whole minutes plus
  temporary source/operations remains **under ₹7 estimated**, within the approved ₹30.
  This is a quote-based estimate, not a posted invoice; free tiers/trial credits excluded.
- Both temporary source objects, their private bucket, the temporary build service
  account and its project logging grant were deleted. Worker containers/images/volumes
  were ephemeral and the script's cleanup trap ran. Sanitized evidence remains in ignored
  `.local/capacity-evidence.json`; Cloud Build's execution history/logs remain for auditing.
- The preferred Storage endpoint timed out locally. Google's documented alternate
  `www.googleapis.com` JSON API worked with the same OAuth credentials and unchanged
  IAM/security checks; it was used for inventory, upload and cleanup.
  [Supported endpoints](https://docs.cloud.google.com/storage/docs/request-endpoints).

The existing account-quoted staging model remains **₹1,784.43/month including an 18%
tax reserve**, under its stated activity/storage assumptions. The user's newer ₹9,000
planning ceiling does not authorize larger resource specifications. The approved
512 MiB staging scope can proceed to deployment validation; production remains NO-GO
until deployed security, authentication and application integration checks are complete.
