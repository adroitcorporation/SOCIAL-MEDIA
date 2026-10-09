# Singapore performance baseline — 9 October 2026

Only observed measurements are reported. There was no deployed staging load test or authenticated production traffic generated.

## Paired database observations

`node scripts/migration-latency.mjs` ran read-only SELECT 1 from the local Windows client at 2026-10-08T23:35:41.795Z. Each project used session pooler port 5432, TLS, connection_limit=1 and pool_timeout=10. Three warm-ups/project; 30 paced samples/project; alternating order; zero errors. Percentiles use nearest-rank. Raw current samples are protected locally in .local/singapore-readiness/latency.json.

| Observation                   | Seoul p50/p95 ms | Singapore p50/p95 ms |
| ----------------------------- | ---------------- | -------------------- |
| Prior, 2026-10-08 10:51 UTC   | 161.97 / 202.49  | 125.84 / 139.00      |
| Current, 2026-10-08 23:35 UTC | 169.80 / 263.58  | 105.77 / 122.64      |

Current Singapore latency is approximately 37.7% lower at p50 and 53.5% lower at p95 **for this small local-client SELECT 1 sample**. It is not Render-to-database RTT, application improvement or capacity. Separate observations cannot establish a trend or production SLA. Prior public HTTP samples are in [original benchmark](supabase-migration-benchmarks.md) and are not a Singapore after-cutover measurement.

## Pool/index inspection

Both PostgreSQL projects currently report max_connections=60; one read-only observation saw 14 source and 15 destination total connections, one active each. These are point-in-time values, not spare application capacity or Supavisor client limits. Both have matching 200 index definitions across public/Auth/Storage and 64 foreign keys. Existing recommendations/performance index migrations match; no new index is justified without query plans/representative workload.

Prisma 6.19.3 uses DATABASE_URL; migrations use DIRECT_URL at npm start. Select the actual deployed runtime pooling mode and size from provider limits; do not copy the local benchmark's pool limit as a load-tested production choice. Reserve connections for Auth/Storage/admin/workers and every backend instance. Transaction pooling requires Prisma-compatible configuration; DIRECT_URL must remain direct/session for migration/export. Current Render runtime pool settings are not available through this connector and remain unverified.

## Unmeasured application benchmarks

Render-origin DB RTT, deployed API p50/p95, Discover/recommendation latency, connection operations, direct/group chat, Auth confirmation/login/refresh and recipient SSE latency remain unavailable. No write workload is authorized now.

After approved fixture-only staging deployment, collect at least 100 warm samples plus separate cold-start/connection samples for each endpoint at a declared request rate. Record exact commit, host region/plan, pool limits, fixture snapshot, errors, query counts and concurrency. Measure mutation latency and recipient visibility separately using controlled A/B/C accounts. Increase load only with explicit limits/abort thresholds; never target real students or production. Use slow-query plans and pool waits to guide indexes/pooling, not distance alone.

## Recovery timings are not downtime

The fresh read-only Singapore encrypted backup including 11 Storage objects took 48.90 seconds; initial local in-memory PostgreSQL/Auth restoration took 3.57 seconds, with 55 tables and 188 applicable constraints checked. The subsequent offline-only restore took 3.70 seconds and also independently checked decrypted Storage payload SHA-256/size for all 11 objects, totaling 23,078,406 bytes. This does not include cloud restore, writer drain, final delta, deployment, Auth/Storage recovery or smoke testing. **Production downtime range, RPO and full-service RTO are not established.** Do not promise a window from these timings.
