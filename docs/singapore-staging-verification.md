# Singapore staging preparation — 9 October 2026

**Prepared, not deployed; production NO-GO.** Latest user instructions require a new approval before any cloud mutation or staging deployment, superseding previous staging authorization. Work is on `audit/singapore-staging-readiness-2026-10-09`; earlier uncommitted Storage work is preserved. No push, merge, deployment or production settings change occurred.

Read-only Render inventory still contains only the production backend in My Workspace, tracking main with automatic deployment. Do not apply a staging Blueprint there: shared free quotas can suspend production. Vercel project read returned Unknown tool(vercel.get_project); the earlier scope also returned 403. No access bypass was attempted. An authorized operator must reconnect access for a separate project/team or use the optional separate Render frontend.

## Configuration prepared

`deployment/render.singapore-staging.yaml` now selects this readiness branch, separate service names, Singapore region, automatic deployment off and **initial backend maintenance=true**. Worker/demo remain disabled. Backend startup refuses mismatched DB/Auth/Storage project refs before running migrations. Frontend requires explicit dedicated BACKEND_URL and contains no DB or service-role key. Do not deploy the root production Blueprint.

| Setting                                  | Backend only                                                                    | Frontend                  |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| Project ref                              | lxofcmzgzbgqvlmwizgm for DB/Auth/Storage guards                                 | Same public Auth guard    |
| DATABASE_URL                             | Singapore Prisma-compatible pool with bounded connection_limit/pool_timeout/TLS | Absent                    |
| DIRECT_URL                               | Singapore direct/session 5432 connection for migrations                         | Absent                    |
| SUPABASE_SERVICE_ROLE_KEY                | Singapore backend secret through secret manager                                 | Absent                    |
| SUPABASE_STORAGE_URL                     | https://lxofcmzgzbgqvlmwizgm.supabase.co                                        | Absent                    |
| NEXT_PUBLIC_SUPABASE_URL/key             | Singapore public Auth configuration                                             | Same public configuration |
| APP_URL/NEXT_PUBLIC_APP_URL              | Dedicated frontend HTTPS origin                                                 | Dedicated frontend origin |
| BACKEND_URL                              | Not production proxy                                                            | Dedicated staging backend |
| REQUIRE_EXPLICIT_BACKEND_URL             | Not required                                                                    | true                      |
| FILE_STORAGE_MODE                        | supabase                                                                        | Not required              |
| LOCAL_DEMO/RECOMMENDATION_WORKER_ENABLED | false/false                                                                     | false/false               |
| MIGRATION_MAINTENANCE                    | true until fixture access/testing approval                                      | API handled by backend    |

Render backend: root directory, Node 24.20.0, build npm ci --include=dev && npm run build, start npm start, health /api/health. Optional Render frontend starts Next directly and never runs migrations. Separate Vercel project: repository root, Next.js, npm ci --include=dev, npm run build; point to reviewed branch/commit and separate domain, not the production project. Confirm paid costs and request approval before creating any paid resource. The free template is not an account eligibility/zero-cost guarantee.

The existing Singapore restore contains real student profiles and Auth users. **Do not expose an unrestricted public test deployment or run fixture interactions against these records.** Prepare an approved isolated Singapore fixture database/Auth/Storage environment or an approved sanitized fixture-only clone with its own matching ref guards/configuration. Keep current restored candidate for integrity/recovery audit. No clone/sanitization was performed. Controlled test inboxes only; worker/external AI/webhooks disabled. Do not reuse source write credentials/environment groups.

## Operator steps after new approval

1. Confirm dedicated Render workspace quotas/billing and dedicated Vercel project permissions; quote any cost. Review the full branch diff and approve only the staging release. Push/deploy require separate approval.
2. Provide isolated Singapore-only fixture credentials via backend secret controls, public key only to frontend. Validate project identity before startup; set guards consistently if using a newly approved fixture project.
3. Configure exact Singapore Auth Site URL, root and reset-password HTTPS redirects. Verify SMTP reaches only owned test inboxes. No production Auth changes.
4. Deploy new services with maintenance enabled. Inspect build-time frontend Auth origin, request hosts, backend guards, Prisma target and Storage target. Old Seoul image URLs must not generate Seoul requests. Confirm frontend bundles contain no backend secrets.
5. Approve/open only staging maintenance for controlled disposable-account testing; production stays unchanged. Record two-account and moderator fixture outcomes below, including denied requests. Clean up only approved synthetic fixtures after evidence capture.
6. Rehearse staging-only maintenance/drain/resume. Separately obtain and rehearse provider-supported direct Auth/Storage writer suspension before production GO.

## Browser acceptance matrix

All deployed results below are **pending**, not passed by local unit/component tests.

| Flow                                     | Required evidence                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signup/login/email verification/recovery | Owned inbox confirmation; approved exact domain auto-verifies only after confirmed email; malformed/subdomain/unapproved email denied; UUID linkage |
| Session                                  | Refresh, reload, logout/relogin; Singapore issuer/targets; HTTPS cookie flags/deletion; old-source token denial                                     |
| Profile/photos                           | Synthetic edit, upload, read, replacement/deletion lifecycle; MIME/size/hash; all targets Singapore                                                 |
| Discover                                 | Fixture-only profiles; completion gates; foreign-photo initials; active navigation                                                                  |
| Connections                              | A requests B, B accepts, cancel/reject/idempotency; stranger C cannot act for A/B                                                                   |
| Direct/group chat                        | A/B membership and permitted group roles; C denied; ordering/read/clear; no student recipients                                                      |
| Idea Board                               | Fixture creation/list/resonance/idempotency/ownership                                                                                               |
| Notifications/live                       | Fixture recipients only; authenticated SSE ready/refresh/notification, reconnect after 55 seconds, unauthorized denial                              |
| Private files                            | College-ID moderator versus nonmoderator; authenticated attachment versus anonymous; CRUD/signed expiry/hash                                        |
| Browser transport                        | Same-origin /api proxy, foreign Origin mutation rejection, preflight/CORS, cookie isolation across domains                                          |
| Maintenance                              | App API writes and reads-with-side-effects 503; workers/in-flight requests/SSE drained; direct provider clients separately frozen                   |

Realtime is SSE, **not Socket.IO**; no Socket.IO implementation/dependency exists. Use real browser-to-dedicated-backend evidence with response hosts/statuses and sanitized logs. Earlier localhost login/refresh and synthetic component checks are useful historical evidence, not deployed acceptance.

## Local checks

TypeScript passed; Vitest passed **410 tests in 40 files**, including security, Storage, maintenance and the new offline URL/backup integrity tests. Production `npm run build`, architecture boundaries and official Render Blueprint schema validation passed. Changed-file formatting and diff checks passed. ESLint is not installed/configured and no lint script exists, so lint was unavailable. Playwright/deployed browser acceptance was not run in this audit; it remains pending isolated fixture infrastructure/approval. Production downtime and full rollback remain unmeasured.
