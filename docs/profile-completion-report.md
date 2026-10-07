# Connection-ready profiles

Outgoing connection requests now require seven essential profile requirements: name, bio, college, graduation year, a skill, an interest **or** domain, and a Looking for selection. `getProfileCompletion` in `src/shared/contracts/profile-completion.ts` supplies the same rules, percentage, and missing-field list to the backend and UI. Photo, links, city, degree, verification, and the legacy `onboarded` flag do not contribute to that percentage.

Text must contain a letter or number and respect existing field-length limits. Bio requires at least 20 characters after whitespace normalization. Graduation year uses the existing 2020–2040 range. Arrays need at least one meaningful entry, including existing custom selections. No schema migration or duplicate profile fields were introduced.

The connection service checks trusted database data in the existing serializable transaction before creating or reactivating an outgoing request. Rejections return HTTP 403 with the existing `error` plus `code: "PROFILE_INCOMPLETE"`, `message`, and `missingFields`. Client-provided flags cannot bypass this check. Existing incoming accept/reject paths and reciprocal acceptance remain available; existing connections, direct messages, and groups are unaffected. College verification remains a separate requirement.

The persistent app shell centralizes Connect behavior for Home/recommendations, Discover buttons/right swipes, and the user-profile Connect button. It shows the existing responsive dialog with a dynamic completed/missing checklist and a direct `/profile?edit=1` action. The action stays visible while the checklist scrolls on short screens. It also handles server rejections when the browser's profile snapshot is stale. Browsing is unrestricted. The owner's Profile screen shows a subtle completion indicator only while incomplete.

Saving uses the returned profile immediately, updates all cached views' authenticated user, and invalidates older in-flight prefetch results. Users can connect after saving without reloading or signing in again. The existing profile editor and college verification UI remain in use.

Directly opened profiles can be absent from the recommendation snapshot. The shared connection updater now accepts that already-loaded profile when constructing the pending connection, ensuring the user-profile button updates immediately without refetching recommendations.

## Changed areas

- Shared readiness: `src/shared/contracts/profile-completion.ts` and error contracts in `responses.ts`.
- Backend: `services/connections.ts`, `utils/errors.ts`, `http/error-response.ts`.
- Frontend: `api/http-client.ts`, `components/circle-app.tsx`, `components/profile-completion-prompt.tsx`, `components/student-card.tsx`, `state/circle-context.tsx`, `state/connection-update.ts`, `hooks/use-circle-controller.ts`, profile form/owner/visitor pages, and scoped styles in `globals.css`.
- Tests: shared helper/error transport, direct API enforcement and legacy connection behavior, complete fixtures for existing service tests, all three Connect surfaces at 320/390/1440px, incomplete browsing/right swipe, stale-server errors, immediate cache updates, and a real local database/browser profile-save-to-connection flow.

## Validation

- `npm test`: 305 tests passed across 24 files.
- Browser regression checks: 63 distinct checks passed across the broad regression run and focused reruns. The final Connect/Discover/performance run passed all 11 tests, including all seven new completion tests and the real database flow.
- Additional 320×568 check passed after making the dialog action sticky; screenshot visually inspected. The 390px and desktop entry-point tests also passed.
- `npm run typecheck`, `npm run check:boundaries`, Prettier checks, and `git diff --check`: passed.
- `npm run build`: Prisma generation, optimized Next.js build, TypeScript, and page generation passed.
- Real browser tests used only the loopback demo database, restored the profile and verification fixtures, and removed their temporary target. Temporary development processes were stopped after validation.

The repository has no lint script; Prettier and architecture-boundary checks are the available static checks alongside TypeScript. The seven previously reported theme-suite failures are unrelated to this change and were not rerun as part of the focused connection/profile regression suite.
