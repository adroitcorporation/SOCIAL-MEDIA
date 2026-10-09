# CYNK staging execution status — 9 October 2026

Branch `feat/gcp-fresh-start`, local source commit
`2cd742e3f765b010c9cfd820493bcdc6c07ae5f1`. Nothing pushed or merged.

## Verified completed work

- Authenticated Billing reads succeeded: infrastructure `cynk-staging` billing enabled,
  Firebase `cynk-staging-e9c53` billing disabled. User-reported trial credits/expiry remain
  the prior Console evidence; no API claim about live remaining credit is made.
- [Linux capacity test](gcp-capacity-preflight-results.md) passed 1 CPU / 512 MiB,
  peak 240.98 MiB, database health/startup 2 seconds. Temporary source bucket/objects,
  preflight identity and logging grant were deleted. Estimated gross preflight cost
  under ₹7, including conservative rounded build time/storage/operations; not an invoice.
- Deployment build `f827df85-ac5c-455b-8e8f-7bf97054f351` **SUCCESS** in Delhi.
  Runtime digest `sha256:6b4fac6d4c8a30324b7204f7d99ad62c862ca0a62f53978de51d6054b72d2c56`;
  tooling digest `sha256:d0a22245623d439f56020f9b675dccc2c5e418a105b4c4dbe967a0eb1e9da7ac`.
  Both in `asia-south2-docker.pkg.dev/cynk-staging/cynk`, tagged `2cd742e`.
- SQL `cynk-staging-db` **RUNNABLE**, PostgreSQL 16 Enterprise, Delhi zonal micro,
  fixed 10 GiB SSD, autogrowth disabled, deletion protection, seven retained standard
  backups, PITR enabled with seven-day Cloud Storage logs. No authorized public networks
  were configured. Fresh `cynk_runtime`/`cynk_migrator` built-in users created securely.
- Two backend-only Secret Manager database URL secrets, version 1, Delhi replicas.
  Passwords were generated in memory and never printed or written to source files.
  Runtime/recommendations can read runtime secret only; migrator reads migration secret.
- Four approved private Standard Delhi buckets: `cynk-staging-staging-profile-photos`,
  `cynk-staging-staging-college-ids`, `cynk-staging-staging-event-attachments`,
  `cynk-staging-staging-build-source`. Uniform access and public access prevention enabled.
  Runtime get/create/delete object role is scoped to the three file buckets; build identity
  reads only the source bucket and writes only the `cynk` registry.
- Four approved workload identities created with Cloud SQL/client, secret and build
  permissions scoped by purpose. Cross-project Firebase reader permits only
  `firebaseauth.users.get`; no Firebase billing change or downloaded service-account key.
- New project-only gross budget `CYNK-staging-gross-INR-1694` excludes all credits,
  actual thresholds 50/75/90/100%, forecast 90/100%, default billing-recipient behavior.
  Existing budgets unchanged. Alert delivery is not claimed tested; alert is not a cap.
- Added the planned Run hostname to Firebase authorized domains while preserving existing
  entries. CLI-user Auth configuration requests used the infrastructure quota-project header;
  this changes neither Firebase billing nor runtime credentials.
- Full local suite: **466 tests / 45 files passed**, before fresh-owner bootstrap was added.
  Subsequent bootstrap/capacity/deployment checks: **23 tests / 3 files passed**, and
  TypeScript passed. Prior architecture boundaries and Linux production build passed.

## Current genuine deployment blocker

Cloud Run CLI refuses Cloud SQL integration because **`sql-component.googleapis.com`**
is disabled. `sqladmin.googleapis.com` is already enabled and the instance is running;
the CLI checks both. It prompted to enable the additional API. The prompt was declined
because the approved document says extra enablement is limited to Cloud Billing and
"No automatic cleanup or API/IAM creation outside this scope."

Approval has been requested for this one API in `cynk-staging`. No security check was
bypassed, SDK guard disabled, or alternative unsecured database connection substituted.
Once approved, enable only:

```powershell
gcloud services enable sql-component.googleapis.com --project=cynk-staging
```

This changes no sizing or cost estimate, does not enable Firebase billing, and may create
Google-managed service-agent configuration. All existing production remains untouched.

## Not yet completed / do not claim

- No Run service or migration job exists; **no live staging URL**.
- The fresh application database and its 15 migrations have **not yet run in Cloud SQL**.
  They passed only in the ephemeral capacity fixture. The migration job is prepared to
  create `cynk_staging` as its own migration owner and apply runtime privilege restrictions.
- No deployed password/OAuth login, sessions, account linking, API authorization, private
  uploads, business flows, authorized SSE or Cloud Run performance checks have run.
- Staging is **NO-GO pending this API prerequisite and deployed verification**; production
  cutover is not authorized and is not ready.

The approved resource model remains **₹1,784.43/month including an 18% tax reserve**, under
its documented usage assumptions. The micro instance now incurs usage even while Run is
blocked. The ₹9,000 planning budget does not authorize bigger tiers; no tier/memory increase
was made. Standard source/registry retention and existing deletion protection are preserved.

After API approval: create/execute the prepared private migration job; verify ledger, zero
imported users, constraints and runtime role restrictions; deploy digest-pinned 1 CPU/512 MiB
Run service with CPU boost disabled, max two replicas, min zero, concurrency 20, 300-second
timeout and initial maintenance; prove startup/isolation before public invocation; then run
synthetic two-account authentication/business/storage/SSE tests and measure deployed latency.
Do not alter Render, Supabase, Vercel, production DNS, billing linkage or deployment branches.
