# Current hosting decision

Staging now hosts frontend and API together on Cloud Run; no Vercel staging or upgrade. User confirmed ₹28,797 GCP trial credits expiring 8 January 2027 and business/commercial use. Earlier Vercel/credit-placeholder blockers below are superseded. See [revised scope and cost](gcp-cloud-run-staging-approval.md).

# Firebase + GCP staging status — 2026-10-09

Branch `feat/gcp-fresh-start`, isolated worktree `C:\SOCIAL MEDIA\.local\gcp-fresh-start`.
**Not deployed. Production readiness NO-GO.** This replaces the earlier single-project
Firebase assumptions and their irrelevant Auth 404/Firebase API blocker.

## Verified configuration and providers

- Infrastructure project: `cynk-staging`, Delhi `asia-south2`.
- Firebase Auth project: **`cynk-staging-e9c53`**.
- Updated values were found in ignored `.local/firebase-staging.env`, not root `.env`.
  Required public values match the registered ACTIVE Firebase web app through an
  authenticated Management API read. No values or provider secrets were logged.
- Created previously absent, ignored/untracked **`.env.local`** in this worktree by copying
  only four public Firebase values and explicit isolated-local settings. Existing environment
  files were not overwritten. A fresh `@next/env` process confirms automatic Next.js loading.
  The frontend uses `NEXT_PUBLIC_FIREBASE_*`; Vite variables are irrelevant.
- Identity Platform API confirms Email/Password enabled with password required,
  `google.com` and `github.com` enabled. OIDC list read succeeded with no enabled providers.
  Therefore `NEXT_PUBLIC_FIREBASE_OAUTH_PROVIDERS=google,github`; LinkedIn stays absent.
- Firebase Admin explicitly uses **FIREBASE_AUTH_PROJECT_ID** for token issuer/audience and
  matches it to the public Firebase project. Revocation, current-user disabled/email checks,
  college verification and database roles remain unchanged. Prisma IDs are not migrated.
- SQL/socket and private GCS bucket identities continue to use **GCP_PROJECT_ID**. Optional
  Firebase storage-bucket metadata supplied with web config is not used by the GCS adapter.
- Auth project billing is **disabled**, while infrastructure billing is enabled. No Auth
  billing linkage or upgrade was made; do not silently upgrade for LinkedIn/OIDC. The
  infrastructure gross budget does not monitor this separate Auth project if billing is
  enabled there later; that would require a revised combined budget/cost approval.
- Build templates now use `_AUTH_PROJECT_ID` separately from Cloud Build's `$PROJECT_ID`.
  Deployed JWT tests check Firebase audience/issuer separately from infrastructure identity.

## Runtime/build security correction

Next evaluates dynamic route modules during builds, with no SQL credentials. Database
module validation is deferred only for Next's official `phase-production-build`. It remains
strict for ordinary runtime. `scripts/gcp-start.mjs` unconditionally validates full SQL,
Auth, storage, HTTPS-origin, pool and legacy-credential guards before starting Cloud Run.
Tests verify secret-free build collection and rejection of incomplete runtime configuration.
The local `.env.local` is not a deployment env file and contains no SQL credentials; a
full local backend is not ready without a separately configured isolated database.

## IAM and approved-scope preparation

### Additional read-only billing-disabled Auth evidence

Firebase Admin SDK was initialized with explicit Auth project `cynk-staging-e9c53`,
using the current CLI user's OAuth credential in memory only and infrastructure project
`cynk-staging` for the request quota header. Lookup of a cryptographically random,
nonexistent synthetic UID returned **auth/user-not-found**, proving that this authenticated
Auth read path works while Firebase billing is disabled. No existing user's data was
read, no user created, and no token/credential persisted or logged. The real SDK rejected
a synthetic JWT with infrastructure audience/issuer (`auth/argument-error`).
This is not a successful real-user ID-token test or a runtime-service-account permission
test. The planned runtime identity does not exist yet and cannot be impersonated or
granted permissions before approval. A valid test login and the approved scoped grant
are required to verify positive token/revocation handling under that identity.

The linked infrastructure billing account is open and uses INR. An authenticated
account-specific Pricing API read returned **403 PERMISSION_DENIED / SERVICE_DISABLED**
for `cloudbilling.googleapis.com` in the infrastructure quota project. No API was enabled,
and no alternate quota project was used to bypass this restriction. Actual INR pricing
must be read in Billing Console → Pricing table, or extra API enablement must be explicitly
approved later. Credits/expiry remain a manual Billing Overview/Credits check; ordinary
account metadata does not expose them. Firebase billing remains disabled.

Spark Auth limits are distinct from billed Identity Platform allowances. For Firebase
Auth with Identity Platform on Spark, Google documents 3000 Tier-1 DAU, 1000 verification
emails/day and 150 password-reset emails/day. No phone/SMS or paid OIDC upgrade is assumed.
[Official Auth limits](https://firebase.google.com/docs/auth/limits).
Focused local auth/security/configuration checks rerun after this inspection: 64 passed.

Read-only IAM permission tests verified `iam.roles.create` and
`resourcemanager.projects.setIamPolicy` in both projects. **No grants were applied.**
The offline planner creates custom `cynkIdentityReader` (`firebaseauth.users.get` only) in
**cynk-staging-e9c53**, bound to `cynk-runtime@cynk-staging.iam.gserviceaccount.com`.
All SQL, bucket, registry and secret grants remain scoped to infrastructure resources.
Cleanup removes this cross-project grant before deleting the runtime identity. No
service-account keys, Editor grants or Auth-user-write grants are proposed for runtime.

Exact resources, IAM, commands and cleanup references:
[approval plan](gcp-staging-approval-plan.md), [deployment guide](gcp-staging-deployment.md).
No extra Firebase Management API enablement in cynk-staging is required for Auth inspection.
Before deployed tests, approve new staging authorized domain/action URLs in the Auth project;
leave existing domains/settings intact unless a separate explicit change is approved.

## Validation

- Final full suite after all code corrections: **459 tests / 44 files passed**.
- Focused authentication/security/configuration checks: **64 tests / 5 files passed**.
- **Production `npm run build` passed** using the real public Firebase configuration.
  Compiled browser chunks were checked for all four matching public config values and
  the verified OAuth provider list; no values were printed. No remote database is queried.
- TypeScript, architecture boundaries and Git whitespace checks passed.
- Existing local browser regression evidence: 26 security-auth/profile tests passed in the
  preceding turn, with mocked provider/upload responses; not repeated without relevant UI changes.
- No deployed E2E tests, new Auth accounts, SQL migrations, uploads, latency/cold-start
  measurements or recovery rehearsal executed. No staging URLs or deployed commit exist.

## Genuine external blockers and next action

1. **Billing evidence:** infrastructure billing is enabled; trial balance/expiry and actual
   account INR/tax quote remain unavailable through current CLI. User accepted the
   **₹1,656.44/month planning estimate only**, before credits, at ₹100/USD allowance and
   18% modeled GST. Their balance/expiry reply still contains placeholders, not evidence.
   Model assumes 10 active Run instance-hours/month; persistent SSE can exceed the target.
   SQL growth to 20 GiB raises the modeled total to about ₹1,897.16. Alerts are not caps.
2. **Vercel:** account/team and Hobby/Pro fields were also placeholders. No authenticated
   deployment connection/session or eligible plan/actual incremental cost has been verified.
   Vercel cost is excluded from the GCP subtotal. Do not silently purchase/upgrade a plan.
3. **Final authorization:** no billable resources, IAM, secrets, Auth configuration changes,
   builds or external staging deployments have been approved. Planning acceptance is not
   execution authorization. Present one consolidated final scope after the above facts
   and scope/cost/eligibility are verified.

Next action: replace the credit balance/expiry and Vercel account/plan placeholders with
actual nonsecret facts and establish Vercel access. The staged scope is one Delhi micro SQL
instance, bounded Run backend/manual jobs, four private buckets, registry, two DB secrets,
four scoped service identities, cross-project Auth read grant, gross-cost budget, empty-DB
15 migrations, Cloud Build and separate Vercel staging deployment/testing. No push/merge,
old users/data, production changes, region/tier upgrades, SMS, paid frontend upgrade or
production cutover are included.

Firebase Auth processing is US-only; accept this exception to regional SQL/backend/GCS:
[Firebase privacy](https://firebase.google.com/support/privacy#us-only_services).
Token verification uses the configured Firebase audience:
[Admin verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

Production Render/Supabase/Vercel remains unchanged. Staging rollback/cleanup is review-only;
retain verified backup and reviewed image/env versions, do not remove SQL deletion protection
or recursively remove bucket contents without separate approval.
