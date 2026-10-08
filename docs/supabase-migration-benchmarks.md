# Migration benchmarks — 2026-10-08

Source: Seoul Supabase; backend: Singapore Render free-plan instance. These are small low-rate read-only observations, not a capacity test or a regional latency comparison. No production connection/chat mutations were performed.

## Measured public HTTP baseline

Origin: local Windows client, not the Render host. Ten sequential HTTPS requests per endpoint, using Invoke-WebRequest and Stopwatch; all returned HTTP 200. Nearest-rank percentiles (p50 = sorted sample 5, p95 = sample 10). No concurrency/load or destination traffic. Samples include network/TLS, application/database work and possible platform variability; do not label them database RTT.

| Endpoint           |   n | p50 ms | p95 ms | Raw samples ms                                     |
| ------------------ | --: | -----: | -----: | -------------------------------------------------- |
| Render /api/health |  10 |    438 |   1925 | 652, 1925, 1209, 467, 432, 449, 330, 336, 438, 346 |
| Vercel /api/health |  10 |    379 |    677 | 677, 365, 579, 379, 377, 478, 428, 341, 402, 357   |

Earlier single checks were 2743 ms for Render health, 910 ms for Vercel health and 590 ms for frontend /api/config. Separate samples are not mixed into percentiles. The health route executes SELECT 1 and reports status=ok; config was demo=false/configured=true.

## Paired local Prisma observation

At 2026-10-08T10:51:33Z, `scripts/migration-latency.mjs` measured SELECT 1 through Prisma 6.19.3 from this local Windows machine. Both projects used session pooling on port 5432, TLS required, connection_limit=1; each had three warm-ups followed by 30 samples. Order alternated between projects with 100 ms pauses between pairs; both pools stayed warm. All 60 timed queries succeeded. Nearest-rank percentiles:

| Project   | Samples | p50 ms | p95 ms |
| --------- | ------: | -----: | -----: |
| Seoul     |      30 | 161.97 | 202.49 |
| Singapore |      30 | 125.84 | 139.00 |

Singapore was 22.3% lower at p50 and 31.4% lower at p95 in this small local-client observation. This does not establish Render-origin improvement, application responsiveness or capacity. The earlier HTTP baseline measures a different workload and is not a before/after comparator. Raw samples are in `supabase-migration-follow-up-evidence.json`; no credentials or user records are included.

## Still unmeasured

| Metric                                         | Status / blocker                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Render-to-Seoul SELECT 1 round-trip            | No authorized Render execution/SSH tool or environment-read access; local/MCP SQL timing would have a different origin |
| Discover authenticated profile loading p50/p95 | Staging read returned 200; repeated timing samples were not measured                                                   |
| Auth and profile loading                       | Operator login/profile/logout passed; agent refresh and resumed session passed; no latency series                      |
| Connection create/cancel                       | Staging read passed; two authorized mutation test accounts are still needed; production mutations avoided              |
| Messaging/SSE latency                          | No end-to-end authorized messaging fixtures; Socket.IO is absent, so Socket.IO benchmark is not applicable             |
| Singapore comparison                           | Paired local-client query samples measured above; Render-origin execution remains unavailable                          |
| 1,000–10,000-user capacity                     | Registered users do not define concurrency; workload and staging restoration required                                  |

## Repeatable rehearsal protocol

From the same Render-origin measurement host, run a warm-up then at least 100 paced samples of SELECT 1 through the exact Prisma runtime pool, including separate cold connection/start and warm connection measurements. Use a read-only query, monotonic time and sanitized errors; record pool settings, host region, instance plan and connection wait. Distinguish query execution time from end-to-end RTT.

Measure paired Seoul/Singapore staging runs with identical application build, fixture snapshot, concurrency and runtime configuration. Record endpoint/page timings, errors, cold/warm state and database pool/CPU/pg_stat_statements. Use isolated test accounts for connection create/cancel and messages; record both writer completion and recipient SSE/refresh visibility. Test existing-password login, token refresh and profile completion separately.

Increase concurrent-active-user load gradually with explicit request-rate limits and abort thresholds on staging only. Record p50/p95/p99, error rate, query counts, pool waits, memory/CPU and recommendation backlog. Maintain idempotency/cleanup fixtures; never send synthetic load or mutations to real accounts.

Only the measured local-client query difference above is claimed. Render-origin latency improvement and user capacity remain unverified.
