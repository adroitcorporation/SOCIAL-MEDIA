# Mobile navigation, gestures, and global activity

Implemented on the existing Founder’s Circle architecture without a schema change or new dependency.

## Causes and fixes

- Intrinsic grid/flex sizing and unbounded inputs made long names, URLs, idea descriptions, and the chat inbox exceed small containers. A conversation row also requested its parent's full width alongside a pin button. Fixed the offending children with zero minimum widths, wrapping, flexible row sizing, and responsive grid tracks.
- Page padding omitted the fixed bottom navigation footprint. Added navigation height plus safe-area clearance, dynamic viewport heights, scrollable mobile menus, and bounded dialogs. Profile sections remain present and reachable.
- Home and Discover shared a card-level `touch-action: pan-y`, preventing native horizontal carousel gestures. Home now uses native overflow scrolling, momentum, scroll snap, responsive card widths, hidden scrollbar, and drag-click suppression. Discover alone retains action gestures. Vertical scrolling and desktop trackpad scrolling remain available.
- Discover wrote styles for every pointer event, used an expensive drag shadow, reset before the action completed, and mounted only the current profile. It now coalesces transform writes through requestAnimationFrame, removes the drag shadow, animates transform/opacity, keeps the next keyed card and eager avatar mounted, and starts the existing action API concurrently with the exit animation. Duplicate-action guards and failure recovery remain in place. Reduced motion is respected.
- Completed route snapshots now use the existing cache for 15 seconds, matching the existing refresh throttle. Explicit refreshes and mutations bypass freshness. Existing in-flight deduplication remains; swipes update state locally without fetching the recommendation list.

## Notifications and backend behavior

The persistent authenticated app shell owns one existing SSE subscription. Previously its server emitted only generic refresh ticks every three seconds; app snapshots were throttled to fifteen seconds. The same server cadence now reads only the authenticated user's notification rows and total unread count, emits a `notifications` frame only when that snapshot changes, and rechecks account access. This is still the existing database-backed SSE mechanism, not a new WebSocket or client polling loop. Delivery can take up to roughly three seconds; the existing 55-second reconnect policy remains.

The global store merges notification snapshots across cached routes. Toasts suppress initial history, deduplicate event IDs across route changes/reconnects, reset on account changes, stack at most three, support dismiss/contextual navigation, and expire after eight seconds with hidden-document/focus/hover pauses. They use an accessible live region and safe-area positioning above navigation. The bell and More badge use the authoritative server count, including unread rows outside the latest 100-item history.

Existing notification creation for connections, resonances, and invitations is reused. Chat sends now create notifications in the existing transaction with batched recipient queries/inserts, excluding the sender, blocked peers, and inactive accounts. Retried message client IDs do not create duplicate activity. Reading delivered conversation messages marks corresponding activity read using the existing read watermark. No migration is required.

Notification read responses retain `count` and additionally return `items` and `unreadCount`; AppState adds `notificationUnread`. Existing endpoints, authentication, and ownership checks remain.

## Changed files

- Layout/cards: `src/frontend/styles/globals.css`, `src/frontend/pages/home-page.tsx`, `src/frontend/components/student-card.tsx`, `src/frontend/components/ui.tsx`, `src/frontend/features/discover/discover-page.tsx`.
- Global activity/state: `src/frontend/components/circle-app.tsx`, `src/frontend/components/notification-toasts.tsx`, `src/frontend/hooks/use-circle-controller.ts`, `src/frontend/hooks/use-notification-toasts.ts`, `src/frontend/state/notification-tracker.ts`, `src/frontend/state/notification-update.ts`, `src/frontend/features/notifications/notifications-page.tsx`.
- Transport/contracts: `src/frontend/api/live-updates.ts`, `src/frontend/api/community-client.ts`, `src/shared/contracts/responses.ts`.
- Backend: `src/backend/http/live-handler.ts`, `src/backend/services/notifications.ts`, `src/backend/services/discovery.ts`, `src/backend/services/messages.ts`.
- Tests: `tests/community.test.ts`, `tests/live-updates.test.ts`, `tests/live-notifications.test.ts`, `tests/notification-tracker.test.ts`, `tests/e2e/discover-feed.spec.ts`, `tests/e2e/screen-loading.spec.ts`, `tests/e2e/mobile-interactions.spec.ts`, `tests/e2e/support/mobile-fixture.ts`.

## Verification

Browser checks cover all nine primary screens at 320×568, 360×640, 375×667, 390×844, 393×873, 412×915, and 430×932 with deliberately long content; profile sections/verification/block access; bottom navigation clearance; chat composer/dialog; menu reachability/Escape; actual Chromium touch carousel/Discover gestures; desktop trackpad behavior; failures/retries; deduplicated popups on every main tab and More; one shared subscription; and real local database → SSE → toast → navigation → read state.

A burst of 100 pointer moves generates only two drag style mutations per frame. Gesture tests verify one action per swipe and no recommendation snapshot fetch during advancement. This establishes coalescing and flow correctness; physical Android/iOS 60fps and real browser safe-area behavior have not been measured.

Final results:

- `npm test`: 282 tests passed across 23 files.
- `npm run typecheck`: passed.
- `npm run check:boundaries`: passed.
- Prettier check of all changed source/test files and this report: passed.
- Stable browser run of all non-theme specs: 66 passed, two existing role/environment skips. Includes all 12 new mobile/global-activity tests.
- Complete browser suite was also run: seven theme failures described below, plus three intermediate failures resolved on the stable rerun (file-edit refresh timing, overlapping Playwright artifact directories, and the old three-second cache-expiry expectation). Browser suites should run sequentially with edits settled.
- `npm run build`: Prisma generation, optimized Next.js compilation, TypeScript, and page generation passed.
- `git diff --check`: passed. Generated `next-env.d.ts` returned to its original production state.

## Existing limitations outside this change

Seven existing theme tests expect a Dark mode control in the authenticated shell, which did not render the existing ThemeToggle component before this work. The login control remains functional. Those failures are reported separately; no theme UI redesign was introduced. Role-specific browser tests retain their existing environment skips. There is no configured lint script; formatting and architecture-boundary checks serve as the available static checks alongside TypeScript.
