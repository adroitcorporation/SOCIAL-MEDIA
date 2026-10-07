# College verification and profile completion

## Existing behavior and scope

Inspection found that most requested behavior was already implemented. `ApprovedCollegeDomain` is the authoritative database table, managed exclusively by Ultimate Moderators. Authentication calls Supabase `getUser(token)`, checks the confirmed account email, extracts its exact normalized domain and looks it up in this table. Matching accounts receive `collegeVerified = true` and existing enum source `APPROVED_EMAIL_DOMAIN`. Existing `EMAIL`/`COLLEGE_ID` approvals are preserved. Domain removal is applied on subsequent authenticated requests; manual approvals survive removal.

The existing API and frontend already shared profile-completion validation and allowed incomplete accounts to browse. Profile already hid its manual verification form whenever the backend returned `collegeVerified = true`. No reproduced approved-domain bypass or incorrect upload form was found in the inspected current revision, so those working paths were retained and covered with regression tests.

The trusted auth boundary remains provider `getUser`, consistent with [Supabase’s getUser documentation](https://supabase.com/docs/reference/javascript/auth-getuser). It does not use profile fields, `user_metadata`, claimed collegeEmail, or a user-selected college as verification evidence. SDK APIs, authentication policy and database permissions are unchanged.

## Changes and files

| Area / file                                                       | Change                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend: `src/backend/auth/session.ts`                            | Reuses the existing `isVerifiedCollegeEmail` evaluator when assigning domain-based verification, keeping normalization, confirmation and exact-domain matching in one helper. Manual verification sources retain precedence.                                                                                   |
| Frontend: `src/frontend/components/profile-completion-prompt.tsx` | Adds the requested Not now action to the existing dialog, alongside missing/complete requirements and Complete Profile.                                                                                                                                                                                        |
| Frontend: `src/frontend/features/profile/profile-page.tsx`        | Clarifies that a manually verified but incomplete account still needs profile completion; hides manual-review privacy copy for verified accounts; responds to the existing `?edit=1` completion CTA even when Profile is already mounted. Approved-domain wording and form suppression remain intact.          |
| Frontend: `src/frontend/styles/globals.css`                       | Adds spacing and wrapping for the two dialog actions, retaining sticky mobile actions.                                                                                                                                                                                                                         |
| Tests: `tests/verification.test.ts`                               | Tests approved-provider-email authentication → persisted verification → Profile state response → incomplete connection rejection → completed profile success → duplicate rejection. Rejects forged college-email/verification claims and verifies manually approved accounts can Connect after domain removal. |
| Tests: `tests/e2e/approved-domain-journey.spec.ts`                | Tests approved-domain UI at 390/1440px, zero manual verification forms/calls, Not now browsing, missing-field prompt, profile edit/save, successful Pending, new-account browsing and unapproved-domain ID form.                                                                                               |
| Report: `docs/college-verification-profile-flow-report.md`        | This implementation/verification report.                                                                                                                                                                                                                                                                       |

## Profile completeness and connection protection

The unchanged `src/shared/contracts/profile-completion.ts` defines seven requirements: meaningful name (1–80), bio (20–1000), college (1–150), integer graduation year (2020–2040), at least one skill, at least one interest **or** domain, and at least one Looking for entry. List entries must contain meaningful text within 50 characters. Degree is not part of this existing connection-readiness rule. Verification and the legacy `onboarded` flag do not determine completion.

The shared frontend Connect handler checks blocked/existing relationships and duplicate-click guards, then completion before a new outgoing POST. Incomplete users get the existing field-aware modal and `/profile?edit=1` CTA. Complete users still require backend-provided college verification. Approved-domain users need no manual verification interruption. Existing incoming-request acceptance behavior remains separate from creating a new outgoing request.

The unchanged backend `src/backend/services/connections.ts` repeats `getProfileCompletion` inside the transaction before creating/reopening an outgoing relationship, returning HTTP 403, `PROFILE_INCOMPLETE` and missing fields. It also enforces college verification, blocking and the pair-key uniqueness safeguard. The HTTP handler authenticates first, so verification is evaluated from the current provider email before the connection service runs. Existing pending/accepted relationships cannot create another record. The frontend already surfaces structured completion errors from stale client state.

## Normalization, moderation and persistence

The unchanged `normalizeApprovedDomain` trims, lowercases and removes one leading `@`, then validates a full domain. `normalizeCollegeEmailDomain` extracts the single email domain and applies the same normalization. Comparison is exact: no substring or automatic subdomain match. `@LNMIIT.AC.IN`, `LNMIIT.AC.IN` and surrounding whitespace normalize to `lnmiit.ac.in`. Invalid domains are rejected.

Ultimate Moderator add/remove/list and optional college association remain unchanged; existing database-backed tests cover normalization, duplicate approvals, malformed input, role restrictions, associations and removal. No database migration or schema change was needed. No verification records were reset or deleted.

## Verification results and limits

- Full unit/service suite: 308 tests passed across 24 files; final focused verification suite also passed all 30 tests after the additional Profile-state and manual-Connect assertions.
- Browser journey/completion/Connect tests: all 28 passed in the final combined run, including the real loopback API/database flow.
- Typecheck and architecture boundary check: passed.
- Production build: passed (`npm run build`), including Prisma generation, Next compilation, TypeScript, page-data collection and static generation.
- Lint: `npm run lint` reports a missing script; this repository has no configured lint command. No linter was introduced for this flow change.
- Prettier and `git diff --check`: passed.

Backend verification tests execute actual authentication code with a mocked Supabase provider, actual API handlers and an isolated PostgreSQL-compatible PGlite database. Browser journey tests use deterministic API fixtures; existing real loopback connection tests exercise network/API/database integration. Live production signup/email confirmation was not performed. The report distinguishes those boundaries rather than claiming a live production identity was tested.

The 320px dialog screenshot was inspected: both CTAs remain accessible, with the existing scrollable requirement list and sticky actions. An initial new journey fixture contained intentionally overlong tags; it was corrected to valid profile attributes before the final passing run. Product validation was not weakened.
