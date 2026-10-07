# Mobile navigation cleanup

Implemented Home → Discover → Idea Board → More. Desktop navigation order and routes are unchanged.

## Files changed

- `src/frontend/components/circle-app.tsx`: derives the three mobile links and secondary links from the existing desktop configuration; replaces the sidebar-based More action with a native dialog bottom sheet; retains Events, Connections, Messages, Notifications, Profile, Settings, authorized Moderation, and the existing logout action. Adds aggregate unread count (99+ cap), per-destination unread badges, sage active state, and explicit focus restoration on dismissal. Closes the sheet when switching to desktop width.
- `src/frontend/components/ui.tsx`: adds an optional CSS class to the existing Modal; reuses its native dialog, Escape handling, backdrop dismissal, and close button.
- `src/frontend/features/profile/profile-page.tsx`: adds a settings anchor around the existing theme control. Settings links to `/profile#profile-settings`; no new route or duplicate theme control.
- `src/frontend/styles/globals.css`: four equal columns, single-line labels, compact active state, and bottom-sheet styling using existing semantic palette tokens. Retains bottom navigation and content clearance using `env(safe-area-inset-bottom)`; sheet padding also respects side and bottom insets.
- `tests/e2e/navigation.spec.ts`: updates the mobile order assertion while preserving desktop/sidebar route checks.
- `tests/e2e/mobile-interactions.spec.ts`: verifies More through the sheet and dismisses it before interacting with a toast outside the modal.
- `tests/e2e/support/mobile-fixture.ts`: routes secondary mobile navigation through More instead of the sidebar.
- `tests/e2e/mobile-navigation.spec.ts`: adds width, landscape, destination, badge, moderation, focus, theme-access, overflow, and content-clearance coverage.
- `docs/mobile-navigation-report.md`: this report.
- `artifacts/mobile-navigation/{bar-390,more-390,bar-dark-360,more-dark-360}.png`: visually inspected light/dark screenshots.

## Configuration and behavior

Previously the bottom bar took the first five desktop links and added More, which reopened the desktop sidebar. Mobile now selects existing links by path. Home, Discover, and Idea Board are absent from More. The desktop sidebar and its authorized Moderation item remain unchanged. The header hamburger retains its existing drawer behavior.

The More badge sums the existing message unread counts and authoritative notification unread count. Messages and Notifications show their individual counts inside More. Existing notification APIs, SSE subscription, permissions, theme storage, and logout logic are unchanged.

Settings uses the existing Profile settings because the application has no standalone Settings route. There is no backend change or route addition.

## Verification

- Frontend typecheck (`npm run typecheck`): passed.
- Unit suite (`npm test`): 314 tests across 25 files passed.
- Browser suite (navigation, mobile navigation, mobile interactions): 24 tests passed on the final rerun.
- Production build (`npm run build`): passed, including compilation, TypeScript and static page generation.
- Architecture boundaries and changed-file Prettier checks: passed.
- Lint (`npm run lint`): unavailable; package.json has no lint script. No lint configuration was added as part of this UI cleanup.

Browser coverage includes 430, 390, 375, 360px and 740×360 landscape; existing coverage also exercises 320px, tablet and desktop. Checks include single-line labels, overflow, primary active state, all More destinations, Profile theme access, focus return, moderator visibility, individual and aggregate badges, touch interactions, a single global live subscription and real database SSE notification navigation.

Headless Chromium exposes zero native safe-area insets and does not support the attempted experimental CDP safe-area command. The final safe-area test evaluates the application's actual CSS formulas with a simulated 24px bottom inset, confirming increased bar height and full last-card visibility above it. Physical iOS Safari was not tested. Light/dark screenshots were manually inspected.

Initial browser failures caught missing focus return, which was fixed. A subscription-count failure during live source edits passed on the stable final rerun. No backend or unrelated layout redesign was performed.
