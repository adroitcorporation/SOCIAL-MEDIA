# Founder Circle UI and Connect refinement

## Root cause and traced flow

The reproducible defects were frontend state handling, rather than an incorrect receiver payload or a missing backend connection operation:

- `StudentCard` excluded Discover from pending-request handling and always offered Connect, including incoming and existing requests.
- A successful Discover button click immediately dismissed the card, hiding the result instead of showing Pending.
- Mutation results updated only the active view. Other cached screens could retain obsolete connection controls.
- Connection animation previously ran concurrently with the request. The card could move before success was known.

The flow is `StudentCard` → shared `requestConnection` → `createCommunityClient.connections.request({ userId })` → authenticated HTTP POST `/api/connections` → existing API handler → `requestConnection(actor, input.userId)` → transactional pair-key upsert and notification → serialized connection → `applyConnection` and view-cache updates → Pending. The target ID and backend `userId` contract already matched. There is no React Query or SWR in this flow; the controller owns local state and a view cache.

The existing HTTP client obtains the session access token in configured authentication mode and sends `Authorization: Bearer …`. A transport test now explicitly checks that header and the connection payload. Local browser/database verification uses the app's existing fixed demo identity. Live production Supabase login was not exercised, and no authentication code was changed.

## Exact files changed

| File                                                     | Change                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/components/student-card.tsx`               | Derives active connection state in both modes; processing spinner; disabled Pending/Connected; incoming Respond; hides blocked Connect; keeps successful button clicks visible; preserves right-swipe advancement after successful requests; category tags and primary interests. |
| `src/frontend/components/circle-app.tsx`                 | Shared pending/connected/blocked guards; preserves completion and college verification; request finishes before optional animation; retry toast for unexpected failures; refreshes stale 409 state and surfaces refresh errors.                                                   |
| `src/frontend/hooks/use-circle-controller.ts`            | Applies connection mutation responses across existing cached screens, retaining the existing local state architecture.                                                                                                                                                            |
| `src/frontend/components/ui.tsx`                         | Adds an optional typed category to the existing shared Tag component.                                                                                                                                                                                                             |
| `src/frontend/features/profile/profile-form.tsx`         | Assigns Skills, Interests, Domains and Looking for categories to profile attributes.                                                                                                                                                                                              |
| `src/frontend/features/profile/taxonomy-select.tsx`      | Reuses category styling for the existing interactive taxonomy chips.                                                                                                                                                                                                              |
| `src/frontend/features/connections/connections-page.tsx` | Uses skill category tags.                                                                                                                                                                                                                                                         |
| `src/frontend/features/ideas/ideas-page.tsx`             | Uses skill category tags in cards and details; retains neutral idea categories and hashtags.                                                                                                                                                                                      |
| `src/frontend/styles/tokens.css`                         | Adds semantic chip colors, card borders/shadows and Connect interaction colors in both themes.                                                                                                                                                                                    |
| `src/frontend/styles/globals.css`                        | Shared chip sizing/contrast; restrained card depth; profile spacing; action divider; rectangular Skip; spinner; long-name cover growth and wrapping; removes unused circular Connect-symbol CSS.                                                                                  |
| `tests/api-client.test.ts`                               | Explicit authenticated connection POST contract test.                                                                                                                                                                                                                             |
| `tests/community.test.ts`                                | Extends real database acceptance checks to both users and verifies duplicate requests remain rejected with one relationship.                                                                                                                                                      |
| `tests/e2e/connect-refinement.spec.ts`                   | Real API/database lifecycle, duplicate-click and failure states, cached view state, accepted/incoming/blocked/incomplete controls, both themes at six requested widths with long attributes.                                                                                      |
| `tests/e2e/discover-feed.spec.ts`                        | Updates successful-click expectations to visible Pending, followed by explicit Skip; checks request-error recovery.                                                                                                                                                               |
| `tests/e2e/mobile-interactions.spec.ts`                  | Sets the swipe fixture to an unconnected profile and expects Respond for the existing incoming desktop fixture.                                                                                                                                                                   |
| `tests/e2e/performance.spec.ts`                          | Expects disabled Pending while continuing to assert no state refetch after a connection action.                                                                                                                                                                                   |
| `tests/e2e/theme.spec.ts`                                | Updates the dark card-surface expectation to the requested card color.                                                                                                                                                                                                            |
| `docs/ui-connect-refinement-report.md`                   | This change and verification report.                                                                                                                                                                                                                                              |

Next regenerated `next-env.d.ts` during dev/build; the final production build restored its original paths, leaving no source diff.

## Component reuse and design tokens

The existing Tag component remains shared by Profile, Home/Discover person cards, Connections and Idea Board skills. Interactive taxonomy buttons keep their selection behavior and inherit the same category variables. Neutral role/status/event/idea-category labels remain semantically neutral rather than being assigned an unrelated attribute color.

Each of `skill`, `interest`, `domain`, `looking` has `--chip-<category>-bg`, `--chip-<category>-text`, `--chip-<category>-border` in both themes. Layout uses shared aliases so interactive and static chips use one system. Chips are Inter 500, 12px, 5px × 9px padding and 7px corners. Profile groups have 22px separation and an 8px heading gap.

Depth tokens: `--card-border`, `--shadow-card`, `--shadow-elevated`. Connect states: `--connect-hover`, `--connect-active`, using existing semantic brand/on-primary tokens for its default state.

Dark mode uses the requested muted sage, steel, rust and warm beige chip palettes, #252A2B cards, neutral translucent borders and restrained 6/24 or 8/30 shadows. Connect retains sage #B8C2A5, with #C4CDAF hover and #AAB596 active.

Light mode uses the requested category palettes, #F1F0EB page, #F8F7F3 cards, #DDDCD5 borders and 4/18 or 8/24 shadows. The existing deeper sage #637258 was retained for small CTA text contrast, rather than switching to the suggested lighter #748269. Hover is #68775E. The name remains strongest, degree/college secondary, bio readable and attribute groups distinct.

## Connection behavior and verification boundaries

Button clicks now stay on the profile and show disabled Pending after success. Right swipes still advance after success. Incoming Discover requests show Respond and open the existing Connections screen, where the Incoming Requests tab provides Accept/Decline. Connected cards cannot resend; blocked cards offer no Connect. Existing shared ref guards, local processing state, disabled buttons and the database pair-key safeguard prevent duplicates. Known API errors remain visible; profile-incomplete responses use the existing completion prompt; unexpected failures use “Couldn't send connection request. Please try again.”

A fresh backend Discover fetch already excludes PENDING and ACCEPTED relationships. That policy was preserved: the current card shows Pending immediately; after a fresh fetch, that person is accessed through Connections. Skip behavior and backend authorization were not changed.

The real loopback test creates a temporary peer, uses the actual demo browser → HTTP → backend → database flow and restores the profile fixture. It verifies one POST, success, correct requester/receiver, one PENDING record, disabled Pending, backend duplicate 409, persisted cancellation, incoming acceptance/rejection, connected discovery exclusion, incomplete-profile 403 and blocked 403. Incoming requests are seeded because demo mode uses one fixed identity. The isolated database service suite additionally executes A → B request, B acceptance and both users' accepted snapshots. A live second production account was not used.

## Responsive and visual checks

Discover and Profile checked in light and dark at 1440, 1280, 1024, 768, 430 and 390px. Tests check document/chip overflow, long-name containment within the cover, full attribute-category presence, at least 40px Connect height and separated action buttons. The mobile interaction suite also covers 320–430px, vertical scrolling, touch gestures, horizontal Home cards and active navigation. Local screenshots under `.local/design-review/refined-*.png` were visually inspected; long names expand the cover instead of clipping or overlapping fallback initials. No sidebar/nav redesign was introduced.

## Results

- Frontend typecheck: passed.
- Unit/service suite: **306 tests passed across 24 files** in the final full run, including the new authenticated connection transport test and both users’ acceptance assertions.
- Browser tests: **49 tests passed** in one final combined Playwright run: Connect refinement, Discover feed, mobile interactions, performance, navigation and theme suites.
- Production build: **passed** (`npm run build`), including Prisma client generation, optimized Next compilation, TypeScript, page-data collection and static generation. Post-build typecheck also passed.
- Lint: `npm run lint` cannot run because no lint script, ESLint dependency or lint configuration exists. No linter was added solely for this cleanup.
- Architecture boundary check: passed. Prettier checks on changed code and `git diff --check`: passed.

Two intermediate Playwright runs overlapped and collided in their shared artifact directory; final verification uses one combined process. Earlier expectations for immediate Connect dismissal, incoming Connect, and the former dark card surface were updated to reflect the requested behavior.

Navigation, routes, backend services/schema, auth, messages, events and moderation logic remain unchanged. Production authentication was intentionally not altered; no production-only failure was reproduced or claimed fixed.
