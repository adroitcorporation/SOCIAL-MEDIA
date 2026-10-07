# Founder Circle security audit

Date: 8 October 2026. Scope: repository, installed dependencies, isolated local PostgreSQL fixtures, Chromium browser journeys, production build, and read-only inspection of the connected Supabase project. No production user records were read or modified, no production exploit payloads were sent, and no deployment or live policy changes were made.

## Summary and counts

Counts below include dependency advisories separately identified in the issue descriptions. An installed vulnerable package does not establish a reachable application exploit. No reachable Critical or High application exploit was confirmed.

| Severity |                              Found | Fixed and verified locally | Needs live action |
| -------- | ---------------------------------: | -------------------------: | ----------------: |
| Critical |              1 dependency advisory |                          1 |                 0 |
| High     |            2 dependency advisories |                          2 |                 0 |
| Medium   | 4 application/configuration issues |                          3 |                 1 |
| Low      | 3 application/configuration issues |                          1 |                 2 |

“Fixed” means the repository/workspace protection was tested, not that production has been deployed. The three remaining configuration issues have explicit actions below. Browser subscription churn was also corrected to keep normal navigation within the new SSE limit; it is part of the rate-limit fix, not an additional vulnerability count.

## Architecture and trust boundaries

- Next.js App Router serves the UI and route adapters. A Vercel frontend can proxy protected APIs to the Render backend; `/api/config` stays local. Prisma owns application PostgreSQL access. The connected project's public schema currently contains the application tables, all with RLS enabled.
- Supabase owns passwords, confirmed emails, access/refresh tokens, signup, login and password recovery. Backend data APIs validate a bearer token through `auth.getUser`; they derive identity from that response and roles/status from Prisma. Editable provider metadata and request IDs do not grant identity, college affiliation or roles. Read-only public Auth settings confirmed `mailer_autoconfirm=false`, so email confirmation is required; this setting is defined in the [provider implementation](https://github.com/supabase/auth/blob/master/internal/api/settings.go).
- The HttpOnly page-session cookie is a bridge for server-rendered page permissions. Data APIs require bearer authentication. Production cookie flags and page identity validation are covered by existing tests.
- STUDENT, ORGANISER, MODERATOR and ULTIMATE_MODERATOR permissions are enforced in backend services. Only Ultimate Moderators manage approved domains and roles. Event organisers manage owned events; group membership/admin/owner checks remain independent of global roles.
- Chat uses authenticated, scoped SSE invalidation and database messages rather than Socket.IO. Streams recheck active-account access, close on failure/abort and have a 55-second lifetime.
- College ID images are private database bytes, returned only to reviewers. Event attachments are bounded database bytes with authenticated access and owner-controlled mutations. Profile photos intentionally have public reads; their write path was the storage-policy gap identified below.
- Optional recommendation providers use administrator-configured URLs/credentials and scrub public text. No user-controlled server fetch URL was found. Themes remain browser preferences and do not affect authorization.

## FIXED

### F1 — Medium: revoked direct-chat previews remained accessible

**Location:** `src/backend/services/discovery.ts`, `/api/state`.

**Risk/root cause:** After block/unblock cancelled a connection, the direct-message endpoint denied access, but the state snapshot still returned the conversation and its latest-message preview. Snapshot filtering checked block membership without requiring a current accepted connection.

**Fix:** Direct conversations in snapshots now require an active peer and an accepted connection, while preserving existing group and blocked-user filtering.

**Verification:** A database regression reproduced the old preview leak. It now checks all relevant state views, denied direct history access, and restored access after a new accepted connection. Previously delivered, recipient-owned notifications are intentionally retained.

### F2 — Medium: in-flight requests could mutate after account revocation

**Location:** `access.ts`, `connections.ts`, `conversations.ts`, `ideas.ts`, `profiles.ts`, `skips.ts`, `events.ts` in `src/backend/services/`.

**Risk/root cause:** Authentication checked account status before reading the request body; several service mutations did not check it again at their transaction boundary. A suspension/ban committed during that interval could still be followed by a connection or message mutation.

**Fix:** Recheck active actors inside existing Serializable transactions and membership/accepted-connection helpers. Deny inactive connection targets and group invitees. Profile saves, skips, unblocks and saved-event changes now use transactions containing the status check. Saved-event flags must be booleans.

**Verification:** Deterministically pause requests after authentication, revoke the actor, then resume: old code returned 200; fixed code returns 403 without writes. Seventeen direct service cases and inactive-target cases cover the other boundaries. Existing role, ownership, profile-completion and incoming-connection behavior still pass.

### F3 — Medium: authenticated reads and SSE opens lacked abuse limits

**Location:** `src/backend/http/middleware.ts`, `api-handler.ts`, `live-handler.ts`; `src/frontend/hooks/use-circle-controller.ts`.

**Risk/root cause:** Mutation limits existed, but repeated searches/snapshots and live-stream opens had no application budget. Navigation also reran startup configuration when the router reference changed, recreating the live subscription.

**Fix:** Shared database counters limit authenticated GET requests to 240/minute, SSE opens to 20/minute, and photos to 6/minute per actor. The existing 90/minute mutation budget remains separate. Apply SSE limits before allocating streams and return the correct error status. Initialize the auth/config subscription once per mounted controller while using the latest router for recovery redirects.

**Verification:** Search request 241, stream open 21 and photo request 7 return 429. Separate actors/budgets remain usable. Stream cancellation and access-revocation tests pass. The browser test now verifies one global subscription across navigation, deduplicated popups and authoritative unread badges.

These fixed-window budgets do not replace edge-level unauthenticated traffic controls or provider email limits.

### F4 — Low: unexpected exception text was logged without redaction

**Location:** `src/backend/http/error-response.ts`.

**Risk/root cause:** Raw exception messages can contain private payloads or ORM/provider details. Unexpected errors were logged by message.

**Fix:** Log only a structured event, safe error category and allowlisted Prisma error code. Preserve generic client responses.

**Verification:** Synthetic private-message and token markers were present in the old log and are absent after the fix. No actual leaked credential was discovered.

### D1 — Critical dependency advisory: installed Next.js version drift

**Location:** installed `next` 16.3.5; manifest/lockfile already specified 16.4.0.

**Risk/root cause:** Installed packages were older than the patched lockfile. The [Next.js advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) concerns attacker-controlled SVG values passed to Node `next/og` ImageResponse. No such application route or import was found; application RCE was not demonstrated.

**Fix/verification:** `npm ci` installed the already-pinned 16.4.0 and matching Next native/env packages. Actual installed-version auditing now reports zero advisories; the production build and browser suite pass on 16.4.0.

### D2 — High dependency advisory: old Sharp native image dependencies

**Location:** installed `sharp` 0.35.4; image loaders in `verification-image.ts` and `event-attachments.ts`.

**Risk/root cause:** The [Sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) covers a librsvg memory issue with possible RCE under particular Linux runtime conditions. Windows testing did not reproduce RCE. The old application did invoke native metadata parsing before rejecting a disguised unsupported format, making pre-decoder validation relevant.

**Fix:** Install the already-pinned Sharp/native package 0.35.5. Add a shared JPEG/PNG/WebP signature gate before native parsing, reused by verification, event-image and profile-photo paths. Retain decoder-based validation, re-encoding, pixel, size and animation limits.

**Verification:** Tests prove SVG disguised as each allowed MIME is rejected before the native parser is called on both loader paths. Existing supported image, malformed-image, oversized, animated and MIME-mismatch tests pass; installed audit is clean.

### D3 — High dependency advisory: old source-map-js

**Location:** installed transitive `source-map-js` 1.2.1.

**Risk/root cause:** The [advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) describes excessive event-loop work for malicious indexed source maps. No application endpoint accepting user source maps was found; application exploitability was not established.

**Fix/verification:** `npm ci` installed the already-locked 1.2.2. Installed and lockfile audits report zero known vulnerabilities; build succeeds. No manifest or lockfile edits or forced upgrades were needed.

## NEEDS MANUAL ACTION

### N1 — Medium: live direct photo uploads bypass application validation/status

**Location:** `supabase/profile-photos.sql`, live `storage.objects` INSERT policy, previous direct-browser upload in `profile-form.tsx`.

**Risk/root cause:** The live policy checks an authenticated provider UID and folder ownership, but not the application's ban status or decoded file contents. Bucket MIME/size limits do not establish that the bytes are a valid image. Public reads are intentional.

**Repository fix completed:** `/api/profile/photo` authenticates the actor, bounds the binary request, applies an upload budget, validates/re-encodes the image and creates an actor-owned UUID path. A server-only Supabase key performs the upload. Account status is rechecked before/after the provider write, with removal attempted on lost access. The existing form/client now use this endpoint. The SQL script adds restrictive browser INSERT/UPDATE/DELETE policies for this bucket, including protection against other permissive policies.

**Verification:** Server tests cover status denial, forged bytes/MIME, oversize, safe paths, metadata stripping, missing-key failure, provider errors and revocation during upload. Local PostgreSQL policy tests cover anon/authenticated denial despite permissive legacy policies, forbidden bucket reassignment, preserved reads/other buckets and service-role writes. Browser upload/preview/save/error regressions pass. The 22 compiled browser JavaScript bundles contain no synthetic server-key marker.

**Action:** Configure `SUPABASE_SERVICE_ROLE_KEY` only on the API backend, rebuild with the real deployment environment, deploy the new frontend/backend together, and apply `supabase/profile-photos.sql` in the same Supabase project. Coordinate the cutover: the old browser uploader stops working once restrictive policies are applied; the new endpoint intentionally returns 503 until its backend key is configured. Verify a valid upload and rejection of direct browser storage writes after deployment. The live policy was inspected but not changed. The locally audited build used synthetic configuration and should not be reused as the deployment artifact.

### N2 — Low: backend-only functions retain browser EXECUTE grants

**Location:** live public `fc_*` helpers, membership trigger helper and `rls_auto_enable`; `supabase/backend-only-functions.sql`.

**Risk/root cause:** Existing explicit anon/authenticated grants survive the historical migrations' `REVOKE ... FROM PUBLIC`. This leaves unnecessary public RPC/helper exposure and lets applicable helper calls bypass application request budgets. No privilege escalation or private-data disclosure was confirmed: application helpers are invokers, RLS remains enabled, and trigger/event-trigger functions cannot be called as ordinary functions.

**Repository fix/verification:** A repeatable SQL script revokes both inherited PUBLIC and explicit browser EXECUTE grants for the identified helpers without changing bodies/data. A PostgreSQL test verifies denial to both browser roles, preservation of backend execution and unrelated functions, and repeatability.

**Action:** Apply `supabase/backend-only-functions.sql` in the application's Supabase SQL editor, then rerun security advisors and verify browser EXECUTE is false. The database owner retains execution; if a separate backend database role relies on PUBLIC privileges, grant that trusted role execution before this cleanup. This script has not been applied live.

### N3 — Low: leaked-password protection disabled

**Location:** connected project's Supabase Auth settings; confirmed by live security advisors.

**Risk/root cause:** Provider configuration does not reject known compromised passwords using the available breach-password feature. This does not prove account takeover or that existing users have compromised passwords.

**Action:** Enable [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) in Auth settings if available for the project. Review provider email limits, CAPTCHA, confirmed-email requirements, redirect allowlists and JWT/session lifetimes there. No dashboard configuration or plan change was made.

## NOT EXPLOITABLE / FALSE POSITIVE

- **RLS enabled without policies:** Live advisors report this for all 28 public tables. It intentionally denies browser Data API row access; trusted Prisma services own application access. Adding broad browser policies would weaken this boundary. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- **Mutable search-path warnings:** Nine application helper functions are invokers, and anon/authenticated cannot CREATE in public. No search-path privilege escalation was established. The cleanup script narrows execution exposure; it does not rewrite unrelated function bodies. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- **Public SECURITY DEFINER warning:** `rls_auto_enable` is an event-trigger function with `search_path=pg_catalog`, not an ordinary callable RPC. Its unnecessary browser grants are covered by N2. No arbitrary privileged SQL endpoint was confirmed. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- **Public profile photos/events:** Public photo URLs and authenticated event attachment reads are intended. Verification documents remain private; non-reviewers are denied at both API and service boundaries.
- **Mass assignment/IDOR:** Existing database tests deny forged ownership/roles/verification, other users' post/comment/message changes, outsider group access, unauthorized verification reads/reviews, organiser access to other events, moderator role assignment and disabling the last active Ultimate Moderator.
- **XSS/SSRF/SQL injection:** User text is rendered as React text, external profile links require HTTPS, and SQL uses Prisma parameters. The HTML startup script contains static theme logic rather than user HTML. No user-controlled server fetch or executable user markup path was found.
- **CSRF/CORS:** Data mutations require bearer authentication, enforce the expected Origin when present and reject unsupported content types. The page cookie is not data-API authorization. No reflected credentialed cross-origin allow policy was found.

## DEFERRED AND VERIFICATION LIMITS

- **Live production HTTP checks:** Automatic approval review rejected starting the loopback production server twice, returning only “blocked by policy.” The production build and source/unit header checks passed, but actual production response headers/cookie behavior and deployed versions were not asserted from a live server. Verify these after deployment.
- **Provider-owned auth lifecycle:** Provider doubles test expired/manipulated/error responses, confirmations, metadata spoofing, redirects, session cookies and password-recovery calls. A real disposable Supabase account's reset-token reuse, email delivery, refresh revocation and CAPTCHA were not exercised. Access JWTs can remain valid until expiry after logout; strict immediate logout invalidation needs an explicit session check/product decision. [Supabase session behavior](https://supabase.com/docs/guides/auth/sessions).
- **Unauthenticated/edge abuse controls:** New budgets are per authenticated actor and applied after provider authentication. Provider auth/email and infrastructure IP limits need dashboard/edge verification. No untrusted forwarding-header IP limiter was added.
- **CSP nonce tightening/PDF malware scanning:** Existing CSP permits inline Next/theme scripts. No user-controlled script injection was found. Nonce migration and antivirus/quarantine infrastructure were not introduced as speculative rewrites. PDFs remain bounded, signature-checked downloads; that is not a malware-free guarantee.
- **Secret scanning:** Common private-key, provider-key and JWT patterns found no matches in tracked files or 702 unique historical text blobs across 59 reachable commits; no historical `.env` was found. This is not a guarantee against unknown secret formats, untracked files, external logs or prior public exposure. No credential rotation was indicated by observed exposure; any separately known exposure still requires rotation.

## Files changed

| File                                             | Change                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `.env.example`                                   | Documents the backend-only photo key and storage setup dependency.                                                             |
| `AGENTS.md`                                      | Next.js 16.4 regenerated its heading; instruction content retained.                                                            |
| `src/backend/http/api-handler.ts`                | Authenticated GET budget and bounded photo-upload route.                                                                       |
| `src/backend/http/error-response.ts`             | Safe structured exception logging.                                                                                             |
| `src/backend/http/live-handler.ts`               | Stream-open budget and correct denial/rate-limit responses.                                                                    |
| `src/backend/http/middleware.ts`                 | Shared read/live/photo counters; existing mutation budget retained.                                                            |
| `src/backend/http/request.ts`                    | Reusable binary size-limit error text.                                                                                         |
| `src/backend/services/access.ts`                 | Active-account checks in shared membership/accepted-connection gates.                                                          |
| `src/backend/services/connections.ts`            | Transactional actor/target checks and guarded unblock.                                                                         |
| `src/backend/services/conversations.ts`          | Guarded group creation and active invitees.                                                                                    |
| `src/backend/services/discovery.ts`              | Restrict revoked direct-chat snapshot previews.                                                                                |
| `src/backend/services/event-attachments.ts`      | Signature validation before native decoding.                                                                                   |
| `src/backend/services/events.ts`                 | Transactional active actor and boolean saved-event validation.                                                                 |
| `src/backend/services/ideas.ts`                  | Transactional active checks for groups/resonance.                                                                              |
| `src/backend/services/profile-photos.ts`         | New authenticated, validated backend storage gateway.                                                                          |
| `src/backend/services/profiles.ts`               | Profile save and active check in one transaction.                                                                              |
| `src/backend/services/skips.ts`                  | Transactional active checks for skip/clear.                                                                                    |
| `src/backend/services/verification-image.ts`     | Signature gate before native decoding.                                                                                         |
| `src/backend/utils/image-signature.ts`           | Shared supported-image header validation.                                                                                      |
| `src/frontend/api/community-client.ts`           | Profile-photo gateway client method.                                                                                           |
| `src/frontend/api/http-client.ts`                | Reuse binary upload with the appropriate MIME header.                                                                          |
| `src/frontend/features/profile/profile-form.tsx` | Preserve upload UI while using the backend gateway.                                                                            |
| `src/frontend/hooks/use-circle-controller.ts`    | Keep startup auth/config/live subscription stable through navigation.                                                          |
| `supabase/profile-photos.sql`                    | Restrictive browser storage-write policies.                                                                                    |
| `supabase/backend-only-functions.sql`            | Remove public and explicit browser helper EXECUTE grants.                                                                      |
| `tests/security-pass.test.ts`                    | Revoked previews, paused mutation races, 17 service cases, inactive targets, read/live/photo budgets and binary gateway tests. |
| `tests/security-logging.test.ts`                 | Synthetic private log-marker regression.                                                                                       |
| `tests/profile-photos.test.ts`                   | Validated bytes/paths, state revocation, provider errors and missing-key cases.                                                |
| `tests/profile-photo-policies.test.ts`           | Browser write denial and service/other-bucket preservation.                                                                    |
| `tests/backend-function-policies.test.ts`        | Explicit/inherited grant cleanup and retained backend/unrelated access.                                                        |
| `tests/image-signature.test.ts`                  | Disguised SVG rejected before native parsing on both paths.                                                                    |
| `tests/live-notifications.test.ts`               | Mock the rate-limit dependency in isolated stream lifecycle tests; real counters tested separately.                            |
| `tests/deployment-routing.test.ts`               | Production header regression.                                                                                                  |
| `tests/e2e/community.spec.ts`                    | Align assertions with current Connect button behavior; keep persistence/two-tab checks.                                        |
| `tests/e2e/profile-form.spec.ts`                 | Exercise gateway upload/preview/save/error UI instead of direct Storage uploads.                                               |
| `tests/e2e/support/mobile-fixture.ts`            | Wait for and scope primary navigation before choosing More, avoiding a hydration race.                                         |
| `SECURITY_AUDIT.md`                              | Findings, evidence, deployment actions and limitations.                                                                        |

Generated evidence is in `artifacts/security-audit/`: before/after installed dependency audits, lockfile audit, bundle check and browser failure traces from earlier runs. No dependency declarations/lockfile, database schemas, routes for existing features, visual design or authentication provider were replaced.

## Test/build results

- Full unit/database suite: **359 passed across 31 files**. Baseline was 317 tests; **42 security regressions added**.
- Browser suite: **57 passed** on the patched packages. Covers auth UI/provider errors, approved-domain journey, connections, two-tab SSE, chat/group permissions, moderation/private verification, profile completion, photo UI and mobile/desktop layouts.
- Frontend typecheck: **passed** after the final code changes and header regression.
- Production build: **passed**, using synthetic Auth configuration and loopback database settings; no production data was used.
- Architecture boundary check: **passed**. `git diff --check`: **passed**.
- Lint: **unavailable**; `npm run lint` fails because the repository has no lint script/configured lint workflow. No unrelated lint installation was added.
- Dependency audits: lockfile and actual installed-package audits now show **0 known vulnerabilities**. Before installed-package reconciliation: 1 Critical and 2 High advisories.
- Browser-bundle check: **22 JavaScript bundles checked; private server-key marker absent**.
- Live Supabase inspection: **28/28 public tables have RLS**; direct photo INSERT and explicit helper EXECUTE grants remain pending cleanup; leaked-password protection remains disabled.
- Production runtime HTTP verification: **blocked by automatic approval review**, not reported as passed.
