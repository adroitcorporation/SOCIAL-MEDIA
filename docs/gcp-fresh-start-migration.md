# Current staging decision: Cloud Run frontend + API

Use [the revised Cloud Run-only staging approval plan](gcp-cloud-run-staging-approval.md). Staging no longer uses Vercel; existing Vercel production remains unchanged. Firebase Auth stays in cynk-staging-e9c53 and infrastructure in cynk-staging. Earlier Vercel provisioning examples in this document are historical.

# CYNK: GCP fresh start

Status: **NO-GO for production. Repository implementation and local tests only.**
Branch: `feat/gcp-fresh-start`, isolated worktree `.local/gcp-fresh-start`, based on `586a300`.
The previous Seoul → Singapore production migration is abandoned. No existing users,
passwords, Auth identities, database rows, or files are imported. Existing users must
register again. Neither old Supabase project nor Render/Vercel production was changed.
No GCP resources were provisioned or deployed. Costs below are planning estimates,
not authorization to spend. Obtain separate approval before any cloud creation.

**2026-10-09 staging update:** primary region is now Delhi NCR (`asia-south2`), proposed
project `cynk-staging`, monthly staging alert budget ₹2,000. Authenticated CLI now confirms
the project is ACTIVE and billing is linked to an open INR account; actual identifiers
are recorded only in ignored local configuration.
Read [the revised staging plan](gcp-staging-deployment.md) and
[verified public regional costs](gcp-regional-costs.md) before using any commands below.
They supersede the earlier region/cost assumptions. Project creation/billing linkage,
APIs/IAM/resources, credential/Auth setup and build/deployment each require explicit
approval. The approved 11 APIs are now enabled. [Authenticated preflight](gcp-staging-preflight.md)
verified inventories, Run/build quotas and the existing budget; trial credit, the INR quote,
full SQL capacity and budget notification delivery remain unresolved.
No GCP deployed testing has occurred.

## Architecture and dependency audit

```mermaid
flowchart LR
  Browser --> Vercel[Existing Next.js frontend on Vercel]
  Browser --> Auth[Google Identity Platform]
  Vercel -->|same-origin API rewrite / bearer token| Run[Next.js API on Cloud Run Delhi NCR]
  Run -->|ADC / verified and revocation-checked token| Auth
  Run --> Prisma --> SQL[Fresh Cloud SQL PostgreSQL Delhi NCR]
  Run -->|ADC / bucket-scoped IAM| GCS[Private GCS buckets Delhi NCR]
  Run -->|55-second SSE / database polling| Browser
  Job[Bounded recommendation job] --> SQL
  Secrets[Secret Manager] --> Run
```

This is one Next.js 16 application, not a separate Express server. Entry points are
`src/app`, API route adapters, `src/backend/http/api-handler.ts`, `src/instrumentation.ts`,
and the start scripts. `src/frontend/api` and state consume the existing API contracts;
`src/backend/services` performs authorization/business transactions; Prisma remains
in `src/backend/database`. No Prisma models or existing migrations were changed.
Existing **SSE**, confirmed by the user, is retained; there is no Socket.IO dependency.

| Dependency                                                          | Existing responsibility                      | GCP treatment                                                      |
| ------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `session.ts`, `supabase-browser.ts`, `browser-auth.ts`              | Supabase Auth JWT/session                    | Explicit provider adapters; old provider stays default             |
| `profile-form.tsx`                                                  | Direct Supabase session check before upload  | Shared browser adapter with matching user ID                       |
| `file-storage.ts`, private ID/event services, profile-photo service | Supabase Storage / legacy DB files           | GCS adapter; same API permissions, limits and validation           |
| `supabase-project.mjs`, Avatar placeholder handling                 | Regional project and historical photo guards | Retained for old production; no old photos in fresh DB             |
| `database/client.ts`, Prisma schema/migrations                      | PostgreSQL, old project guard                | Explicit GCP socket/project/role/environment guard                 |
| `next.config.ts`, `page-session.ts`                                 | Vercel API/SSR identity forwarding to Render | Dedicated `BACKEND_URL`; GCP frontend fails build if absent        |
| `render.yaml`, `scripts/start.mjs`, demo/migration/backup scripts   | Old deployment and audits                    | Retained unchanged; never run for GCP                              |
| `recommendations`, worker CLI/instrumentation                       | DB-backed asynchronous index jobs            | Disable in-process worker; bounded Cloud Run job                   |
| Email/password/OAuth                                                | Supabase-managed email and redirects         | Identity Platform email templates/providers; manual setup required |

Routes include session/config/health, profile/photo/posts, Discover/recommendations,
connections, conversations/messages/live, ideas/resonances/comments, events/attachments,
notifications, moderation/reports/college verification and role administration. Existing
services and tests remain authoritative. Roles come from database records, never Google
custom claims. Registration starts as STUDENT; the first ULTIMATE operator is assigned
through existing `scripts/bootstrap-role.ts` after an approved staging registration.
Exact approved-domain matching, malformed/subdomain rejection, manual college verification,
active-account checks and profile-completion connection gates are preserved. An approved
domain enables college verification; it does not turn every verified email into an approved
college account or a privileged role.

## Repository implementation

- `AUTH_PROVIDER=identity-platform` and `NEXT_PUBLIC_AUTH_PROVIDER=identity-platform`
  select Google. Missing flags retain Supabase; unknown provider values fail closed.
- Firebase browser SDK persists sessions, obtains current ID tokens, verifies email,
  handles password resets and signs out unverified accounts. Tokens are not logged.
  Existing HTTP-only page-session bridge and bearer API remain unchanged.
  Google refresh events update the existing SSR cookie even when signed-in state stays
  true; event ordering prevents an older asynchronous refresh from undoing logout.
- Backend verifies ID tokens with the Admin SDK, the configured project, revocation
  checking and current account state. Disabled users/email changes are rejected.
  Production emulator configuration is rejected. ADC uses attached service identity:
  no downloadable service-account JSON key and no server secrets in public variables.
- `FILE_STORAGE_MODE=gcs` selects three private, environment-specific buckets.
  Objects use existing actor/UUID paths. Upload limits are 4 MB photos/IDs, 8 MB
  attachments. Existing decoding/signature checks remain in the upload services.
  CRC32C is checked and uploads use `ifGenerationMatch=0`; failures do not overwrite.
- All buckets require uniform bucket-level access and public-access prevention.
  Public profile images are served through bounded `/api/public/photos/:owner/:file`.
  College IDs and attachments use authenticated application downloads and existing
  moderator/event permissions, not public bucket URLs. No IAM signing permission is
  needed; there is no new private-file signed-URL endpoint to expose.
- GCP startup validates project, environment, canonical frontend origin, exact Delhi NCR
  instance, database name, distinct runtime user, explicit bounded pool and absence
  of old-provider/emulator/demo credentials. Migration jobs require a separate user.
  Runtime never runs migrations. Docker is nonroot, excludes credential files, and
  uses standalone Next.js output. The tooling image is separate from the service image.
- Background workers are disabled in request-billed service instances. Invoke the
  existing bounded recommendation CLI as a separate job; it uses existing DB locking.

## Fresh PostgreSQL initialization

Use a new **staging project** and a distinct future production project. Use PostgreSQL
16 in Delhi NCR, a database named `cynk_staging`, instance `cynk-staging-db`. Create users
`cynk_migrator` (migration owner) and `cynk_runtime` (application). Keep passwords only
in Secret Manager. Do not use old `.env` files. Do not run `db:seed` (demo data).
Existing 15 migrations initialize schema, constraints, indices, RLS and reference
college/taxonomy metadata only; fresh `User` remains empty. Review the default
`lnmiit.ac.in` approved domain before allowing real registrations.

After migration, execute `deployment/gcp/database-access.sql` through Cloud SQL Studio
as the migration owner against the NEW database. It refuses unrelated database names,
removes runtime elevated role membership, preserves RLS, grants DML without schema
creation or migration-ledger access, and adds a trusted backend-role RLS policy.
Browsers have no SQL credentials; per-user authorization remains in API services.
After each future migration rerun this privilege script for newly added tables.
Local PGlite tests cover all migrations and runtime grants; Cloud SQL role behavior
still requires deployed staging validation. Cloud SQL owns system/admin roles; runtime
must not be the schema owner or inherit any additional elevated role.

## IAM, secrets and separate environments

| Identity                   | Required scope                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime service account    | Cloud SQL Client; Secret Accessor on runtime DB secret only; custom `firebaseauth.users.get` at project; bucket-specific object get/create/delete only |
| Migration account          | Cloud SQL Client; Secret Accessor on migration DB secret only; no GCS/Auth administration                                                              |
| Recommendation job account | Cloud SQL Client; runtime DB secret only; no Storage/Auth privileges                                                                                   |
| Build account              | Artifact Registry Writer on `cynk`; build logging permissions; no runtime/migration secrets                                                            |
| Approved deployer          | Cloud Run deployment and service-account impersonation; narrow resource administration during approved provisioning                                    |
| Backup/recovery operator   | Separate approved identity; export/restore rights and bucket object list/read; never runtime credentials                                               |

The custom Storage role contains `storage.objects.get`, `storage.objects.create`,
`storage.objects.delete`. Bind it individually on the three new buckets, not at
project scope. Runtime does not need listing, bucket/policy administration or public ACLs.
Secret versions are pinned (`:1` initially), not `latest`. No `DIRECT_URL` in runtime.
Use built-in Cloud SQL connector Unix socket `/cloudsql/PROJECT:asia-south2:cynk-staging-db`.
A public-IP instance with **zero authorized networks** plus IAM connector avoids an
extra VPC connector; verify no public CIDR access was added. Do not share production
project, instance, IAM account, secrets, buckets, domains or API keys with staging.

## Manual staging deployment — only after separate cost/resource approval

These commands are instructions, **not executed**. Run them from this isolated worktree
or a clean checkout of the reviewed GCP branch, never the older audit checkout.
`.gcloudignore` excludes credentials/local backups from build-source uploads, while
`.dockerignore` excludes them from container context. Replace placeholders and review
every target. Use a dedicated project and named staging Vercel project. First obtain
a Delhi NCR-region Console cost quote and approve a monthly cap. Do not reuse the existing
production Vercel project, Render service or Supabase credentials.

```powershell
$GcpStageProject = 'REPLACE-DEDICATED-STAGING-PROJECT'
$GcpRelease = 'REPLACE-REVIEWED-COMMIT'
gcloud auth login
gcloud config set project $GcpStageProject
gcloud services enable run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com identitytoolkit.googleapis.com storage.googleapis.com
gcloud artifacts repositories create cynk --repository-format=docker --location=asia-south2
gcloud iam service-accounts create cynk-runtime
gcloud iam service-accounts create cynk-migrator
gcloud iam service-accounts create cynk-recommendations
gcloud sql instances create cynk-staging-db --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro --region=asia-south2 --storage-type=SSD --storage-size=10 --backup-start-time=20:00 --enable-point-in-time-recovery --deletion-protection
gcloud sql databases create cynk_staging --instance=cynk-staging-db
```

Console: verify Delhi NCR, smallest quoted instance, public authorized networks empty,
backups/PITR enabled, deletion protection enabled. Create both SQL users via Console,
avoiding passwords on command lines. Do not approve a more expensive machine silently
if the selected tier is unavailable. Shared-core sizing must pass load tests; it is
not a high-availability production recommendation.

Identity Platform Console: enable email/password and required OAuth providers; enforce
a password policy; configure separate staging OAuth client IDs/secrets, consent screen
and callbacks. Enable LinkedIn only after configuring `oidc.linkedin`; otherwise that
button cannot work. Reuse the registered Firebase web app in `cynk-staging-e9c53` and copy **public**
web API key/app ID. Restrict the API key to required Identity Toolkit/Secure Token APIs
and allowed web referrers, verifying API-key restrictions do not break login/refresh.
Add only dedicated staging frontend and auth domains to Authorized Domains. In email
templates set custom action URL to `https://STAGING_FRONTEND/login`; reset links carry
`mode=resetPassword&oobCode=...` and verification links `mode=verifyEmail&oobCode=...`.
Configure verified sender/template and test delivery/reset/expired links. No old signing
key or old session is imported: users must sign up/sign in again after the fresh start.

Create private buckets (run only for the approved new project):

```powershell
foreach ($GcpBucket in @('profile-photos','college-ids','event-attachments')) {
  gcloud storage buckets create "gs://$GcpStageProject-staging-$GcpBucket" --location=asia-south2 --uniform-bucket-level-access --public-access-prevention
}
```

Console IAM: create custom roles with permissions above; bind runtime Storage role on
each bucket in infrastructure project `cynk-staging`. Create/bind the custom Auth read
role in `cynk-staging-e9c53` to `cynk-runtime@cynk-staging.iam.gserviceaccount.com`.
Set backend `FIREBASE_AUTH_PROJECT_ID=cynk-staging-e9c53`, matching public Firebase
project/domain; retain `GCP_PROJECT_ID=cynk-staging` for SQL and GCS. Bind Cloud SQL Client to the three
service accounts. In Secret Manager create `cynk-runtime-database-url` and
`cynk-migration-database-url`, and grant secret access individually as in the matrix.
Enter values through Console secret controls, never paste into chat/logs or public env.
Percent-encode passwords in connection URLs. Runtime URL example:

```text
postgresql://cynk_runtime:ENCODED_PASSWORD@localhost/cynk_staging?host=/cloudsql/PROJECT:asia-south2:cynk-staging-db&connection_limit=2&pool_timeout=10
```

Migration secret uses `cynk_migrator` with the same database/socket. Its job needs
`DIRECT_URL` and `DATABASE_URL` set to migration secret; Prisma uses DIRECT_URL for
migrate deploy. Fill `deployment/gcp/backend.env.example` into a **separate ignored**
local YAML key/value file `.local/gcp-staging-public-env.yaml` for `--env-vars-file`,
not a committed credential file. Replace `REVIEWED_STAGING_PUBLIC_ENV.yaml` below with
that reviewed ignored path.
Populate all values; env files are not directly interchangeable with dotenv format.
Backend build uses the dedicated staging frontend origin and public Firebase config:

```powershell
gcloud builds submit --config=deployment/gcp/cloudbuild.yaml --substitutions="_RELEASE=$GcpRelease,_PUBLIC_AUTH_KEY=PUBLIC_KEY,_PUBLIC_APP_ID=PUBLIC_APP_ID,_FRONTEND_ORIGIN=https://STAGING_FRONTEND.vercel.app"
gcloud run jobs create cynk-staging-migrate --image="asia-south2-docker.pkg.dev/$GcpStageProject/cynk/tooling:$GcpRelease" --region=asia-south2 --service-account="cynk-migrator@$GcpStageProject.iam.gserviceaccount.com" --set-cloudsql-instances="$($GcpStageProject):asia-south2:cynk-staging-db" --env-vars-file=REVIEWED_STAGING_PUBLIC_ENV.yaml --set-secrets=DATABASE_URL=cynk-migration-database-url:1,DIRECT_URL=cynk-migration-database-url:1 --tasks=1 --max-retries=0 --task-timeout=600s
gcloud run jobs execute cynk-staging-migrate --region=asia-south2 --wait
# Apply database-access.sql in Cloud SQL Studio BEFORE starting runtime.
gcloud run deploy cynk-staging-backend --image="asia-south2-docker.pkg.dev/$GcpStageProject/cynk/backend:$GcpRelease" --region=asia-south2 --service-account="cynk-runtime@$GcpStageProject.iam.gserviceaccount.com" --add-cloudsql-instances="$($GcpStageProject):asia-south2:cynk-staging-db" --env-vars-file=REVIEWED_STAGING_PUBLIC_ENV.yaml --set-secrets=DATABASE_URL=cynk-runtime-database-url:1 --min-instances=0 --max-instances=2 --concurrency=20 --cpu=1 --memory=512Mi --timeout=300s --allow-unauthenticated
```

Public Cloud Run invocation is needed for browser/Vercel requests. It does **not** bypass
application bearer authentication, account/role checks or private-file authorization.
The YAML service template is for review and must be expanded with all public env values;
do not deploy its placeholders. Start with `MIGRATION_MAINTENANCE=true`; health/config
work, data routes do not. Turn maintenance off only for approved isolated staging tests.
Do not log authorization headers, email action URLs, connection strings or tokens.

Create a separate Vercel staging project from the reviewed branch, no production domain.
Set public-only values from `frontend.env.example`, `BACKEND_URL` to the actual staging
Cloud Run HTTPS origin, `REQUIRE_EXPLICIT_BACKEND_URL=true`, and canonical staging
`APP_URL`/`NEXT_PUBLIC_APP_URL`. Remove all Supabase values. Never add DATABASE_URL,
service-account keys, migration secrets or storage credentials to Vercel. Rebuild:
Next public variables and rewrite target are build-time values. Verify resolved API
and SSR identity targets; do not accept Render fallback.

Recommendation job: create another job with tooling image, runtime DB secret and
`cynk-recommendations` identity, command `node`, args
`--conditions=react-server,--import,tsx,scripts/recommendation-worker.ts,--once`.
Use the same guarded public env and socket. Run once manually for synthetic staging
records. A recurring Cloud Scheduler trigger and invoker IAM need separate approval;
production cannot be marked ready until queue processing cadence is configured/tested.

## Deployed acceptance gates (not yet performed)

Use synthetic staging accounts and files only; do not use production user data.
Capture redacted evidence with release SHA, project IDs, bucket names and timestamps.

1. Signup, confirmation, exact approved-domain verification, malformed/subdomain rejection,
   unapproved-domain manual flow, login/logout, password reset, expired links and OAuth.
2. Refresh after reload/token expiry; page-session cookie Secure/HttpOnly/SameSite settings;
   revoked/disabled token rejection, no role promotion from custom claims or client payloads.
3. Profiles/Discover, incomplete-profile connection denial, complete-profile request/accept,
   duplicate retries, conversations/message delivery, unread notifications, ideas/comments,
   events and moderation. Two independent accounts must fail cross-user private requests.
4. Upload valid photo/ID/PDF; reject spoofed MIME, oversize and traversal. Download authorized
   files, reject unauthorized college-ID access, delete only owned/editable files. Verify
   private raw GCS URL denies anonymous access, profile API intentionally serves images,
   no overwrite, CRC/hash match, and no secret appears in frontend bundles/network logs.
5. SSE across multiple instances: 55-second close/reconnect and token renewal; preserved
   database-authoritative polling every 3 seconds. Restart a revision during chat and
   verify recovery and no duplicate messages. Confirm Vercel proxy does not buffer/time out
   prematurely. Do not add Socket.IO/Redis or assume session affinity is required.
6. Origin/CSRF checks: allowed staging same-origin calls succeed; arbitrary Origin mutation
   fails. Direct backend unauthorized APIs fail. CORS/cookies/proxy behavior tested in browser.
7. Exercise recommendation job, cold starts and bounded pool under two instances and SSE.
   Monitor SQL connections, memory, error rate, job backlog and read/write latencies.
8. Run existing Playwright UI suite against an isolated synthetic database. SDK mocks and
   PGlite integration tests below do not replace deployed Google API/browser tests.

An additional Google browser smoke suite is prepared in `playwright.gcp.config.ts` and
`tests/gcp-e2e/smoke.spec.ts`. It checks two synthetic logins, JWT project audience,
HTTP-only secure page cookie, reload and feature navigation, and forbids browser
requests to Supabase/Render. It has **not** run against deployed GCP. Choose a staging
project ID containing `-staging`, provide `APP_ENV=staging`, `GCP_STAGING_PROJECT_ID`,
`GCP_STAGING_FRONTEND_ORIGIN`, and `GCP_STAGING_TEST_EMAIL_A/B` plus corresponding
`GCP_STAGING_TEST_PASSWORD_A/B` via a secure ignored environment. Emails must begin
`cynk-gcp-`; these accounts must be synthetic, already email-confirmed and in the
approved staging project. Use `npx playwright test --config=playwright.gcp.config.ts`.
Artifacts/traces/screenshots are disabled to avoid retaining login secrets. This is
a smoke gate; signup delivery, cross-user mutation/file denial, token expiry and
recovery still require the additional acceptance gates above.

## Backups, recovery, cutover and rollback

No old-to-new synchronization is planned. Preserve existing Seoul/Singapore backups and
projects untouched. For NEW GCP staging, enable automated SQL backups/PITR and test a
portable `pg_dump --format=custom --no-owner --no-acl` using a separate backup identity and
approved Cloud SQL Auth Proxy session. Supply credentials through an ignored pgpass/secure
process environment, not CLI output. Include Prisma ledger. Export Google Auth users with
the supported Admin SDK/Identity Platform export tooling; hash material is sensitive and
must be encrypted with strictly controlled operator access. Export provider/configuration
and secrets references separately. GCS backup requires object bytes AND metadata/generations
plus bucket IAM/config, not SQL `storage` tables. Use an approved separate recovery bucket,
object versioning and retention settings after pricing approval; don't give runtime bucket
listing or backup permissions. No backup/export containing user data was made this turn.

Restore rehearsal needs another approved isolated project/instance: recreate schema owners,
restore dump, apply runtime grants, import **synthetic** Auth users with original UIDs and
hash config, restore GCS paths/content metadata, recreate IAM/private access, pin secret
versions and deploy the same artifact against recovery resources. Test identity↔User
relationships, FKs/RLS/grants, login/reset and two-account private files. Record start/end,
counts/hashes and denied accesses. Firebase password hash export/import permissions, portable
Auth recovery and off-machine restoration remain blockers until demonstrated. Never restore
over old production or claim SQL backup alone recovers Auth/files.

Production checklist, requiring separate explicit approval for each live change:

1. Approve fresh-start account/data-loss UX and communicate re-registration to 19 existing
   users without importing their data. Choose retention/retirement policy separately.
2. Pass all deployed staging gates, recover a synthetic off-machine backup, quote/approve
   production cost and provision a separate Delhi NCR production project/instance/keys/buckets.
3. Build a reviewed production artifact using production public Auth/origin values; migrate
   only the EMPTY production DB, apply SQL privileges, bootstrap approved admin, verify jobs.
4. Freeze old application via approved Render maintenance setting and independently freeze
   old Supabase Auth signups and direct Storage writes. The existing backend maintenance flag
   **does not block direct Auth APIs**. GCP similarly requires separate Identity Platform
   registration/provider controls during rehearsal. Test native provider controls first;
   don't improvise RLS changes or bypass safeguards. No live freeze was performed.
5. Record old Vercel env/artifact and Render/Supabase configuration references securely.
   Change Vercel production frontend/provider/rewrite public env only with approval; rebuild,
   then smoke-test new isolated resources and authorize opening registrations/writes.
6. Watch Auth failures, API errors, SQL connections, storage access, SSE and job backlog.
   Expected downtime is **unmeasured**: time the rehearsal from freeze through verified
   frontend availability; do not promise a duration based on local builds.
7. Pre-write rollback: restore old Vercel deployment/environment and resume old service only
   with approval; revoke new-provider tokens for that deployment. Old Supabase sessions do
   not become Google sessions. Once new writes exist, reverting splits user identities/data:
   freeze new writes, preserve new data/backups, explicitly approve recovery/data reconciliation
   before resuming old writes. There is no automatic conflict-free cross-provider rollback.
8. Retire old services only after accepted recovery, retention/legal review and explicit
   approval. No automatic deletion, disconnect, migration, push, merge or deploy is included.

## Performance and budget

No Delhi NCR deployment measurements exist. `scripts/gcp-benchmark.mjs` provides bounded,
GET-only staging config/DB-health measurements (20 samples each), first/median/p95/max:

```powershell
$env:APP_ENV='staging'
$env:BENCHMARK_STAGING_ORIGIN='https://STAGING_FRONTEND.vercel.app'
node scripts/gcp-benchmark.mjs $env:BENCHMARK_STAGING_ORIGIN
```

Record client region, cold/warm condition, revision and sample times. Health includes SQL
roundtrip and is not a pure database benchmark. Measure real API/SSE/upload latency using
synthetic browser flows and Cloud Monitoring. Do not assert improvements over Seoul.

The earlier $15–25 staging/$30–60 production envelope is superseded by
[the Delhi/Mumbai line-item comparison](gcp-regional-costs.md). With documented low-use
assumptions, Delhi staging is **$14.04/month before shared free discounts/tax**; a dedicated
single-zone small-production configuration is **$85.58/month**. These are not spending caps
or measured workloads. An account-currency INR quote fitting the **₹2,000 staging budget**
with headroom is mandatory before approval. SQL compute/storage/backups run continuously;
HA, egress, retained backups and persistent SSE can materially increase costs.
Basic email/social Identity Platform has a free MAU allowance sufficient for 19 users;
phone/SMS and enterprise federation have different pricing. Avoid unneeded providers.
Request-billed Cloud Run scales to zero when idle, but an open SSE request keeps processing
and can consume credits. Do not assume SSE is free or that $300 is a hard spending cap.

Create project-filtered billing budgets after approval with actual/forecast alerts at
50/75/90/100%, track trial balance/expiry weekly, and set instance/job limits. Budgets
send alerts rather than guaranteeing a spend ceiling. Plan low-traffic load tests before
choosing production sizing. Review monthly SQL, Run request duration, egress and logs.

Official references reviewed: [Cloud SQL pricing](https://cloud.google.com/sql/pricing),
[Cloud Run pricing](https://cloud.google.com/run/pricing),
[request billing](https://docs.cloud.google.com/run/docs/configuring/billing-settings),
[Identity Platform pricing](https://cloud.google.com/identity-platform/pricing),
[GCS pricing](https://cloud.google.com/storage/pricing),
[trial credits](https://docs.cloud.google.com/free/docs/free-cloud-features),
[Cloud SQL/Run connection](https://docs.cloud.google.com/sql/docs/postgres/connect-run),
[token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[email actions](https://firebase.google.com/docs/auth/web/passing-state-in-email-actions),
[Secret Manager integration](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

## Validation record and remaining blockers

Local provider tests use synthetic SDK fixtures; migration/service tests use isolated
PGlite. They never contact old production. Final check results are recorded below after
running. No ESLint command/config is installed; architecture checks, TypeScript and
Prettier are the applicable existing static checks. No lint check is silently disabled.

Verified locally on 2026-10-09:

| Check                                                          | Result                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| TypeScript `npm run typecheck`                                 | PASS                                                                                                   |
| Full Vitest unit/service suite                                 | 42 files, 435 tests PASS                                                                               |
| Existing Playwright browser suite                              | 181 PASS, 2 fixture-prerequisite skips; both RBAC tests then PASS after local-only moderator bootstrap |
| `npm run build`, existing provider mode                        | PASS                                                                                                   |
| `npm run build`, GCP standalone/public synthetic configuration | PASS; server and Prisma/Google dependencies traced                                                     |
| Architecture boundaries / Render schema validation             | PASS; existing Render definitions unchanged                                                            |
| Prettier changed files / Git whitespace                        | PASS                                                                                                   |
| `npm audit`, including dev dependencies                        | 0 reported vulnerabilities                                                                             |
| Deployed GCP smoke suite / ADC / real Cloud SQL and GCS        | NOT RUN; resources and approval unavailable                                                            |
| Docker Linux image execution                                   | NOT RUN; Docker unavailable on this machine                                                            |
| Off-machine recovery / deployed latency / cutover downtime     | NOT MEASURED; approval and infrastructure required                                                     |

The temporary local browser server and local database were stopped after tests. Local
fixture data stays ignored in `.local`; no production data was used. No migrations or
Render deployment definitions changed. The new SDKs are pinned; the compatible gRPC
override removes an audit finding in the new Firebase dependency tree. Mocked SDK
success is not evidence of actual IAM, email delivery, token refresh or Storage access.

Remaining blockers: approved dedicated project IDs and spending quote; IAM/secret setup;
actual container startup on Linux/ADC; Cloud SQL migrations/privileges validation; Auth
provider/email configuration and token/session verification; private Storage permissions;
deployed browser integration/SSE/two-account checks; recommendation scheduling; portable
Auth/files/off-machine recovery; write-freeze rehearsal and measured downtime; separately
approved production provisioning/cutover and fresh-start user communication.

Next manually approved step: review this branch and Delhi NCR staging quote, select a NEW
staging project and approve only the quoted staging provisioning/deployment. Until then,
**NO-GO for production**. The old environment remains functional.
