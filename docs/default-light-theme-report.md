# Default Light theme

## Storage and previous behavior

Theme preference remains in the existing browser localStorage key `founder-circle-theme`. There is no theme preference field/service on the account backend. Preferences are browser/origin-local, not synchronized across accounts or devices; that existing mechanism is unchanged.

Previously, a valid stored `light` or `dark` choice won. Otherwise, the head initializer and React provider used `prefers-color-scheme`, and the provider followed OS changes until a manual choice was saved.

## New resolution

A stored `light` or `dark` choice still wins. Missing, invalid or inaccessible storage resolves to `light`. Theme resolution no longer consults browser/OS color-scheme preferences or subscribes to their changes. Defaults are not written to storage: only an explicit user choice saves a preference.

The existing synchronous head script applies the saved/default theme before the body paints. The provider uses the same fallback after hydration, avoiding a conflicting dark-to-light or light-to-dark startup change. Profile remains the only theme-control location; no header/signup controls or signup theme step were added. Light and Dark toggles, manual persistence and cross-tab synchronization remain intact.

Existing stored preferences are never cleared, reset or rewritten by signup/login/logout. Users with no saved choice—including new users on a dark OS—now see Light. If a browser already has a saved choice, it retains priority, consistent with preserving the existing storage mechanism. No schema change or migration was required. The Soft Industrial colors and college-verification/profile-completion flow were not changed by this task.

## Files changed for this task

| File                                    | Change                                                                                                                                                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/frontend/theme/theme-script.ts`    | Uses saved preference or Light in the pre-paint initializer; removes OS fallback.                                                                                                                                                                                                 |
| `src/frontend/theme/theme-provider.tsx` | Uses saved preference or Light during hydration and storage events; removes OS listener; retains explicit toggle persistence.                                                                                                                                                     |
| `tests/theme.test.ts`                   | Executes the actual initializer to verify saved Light/Dark, missing/invalid preference, unavailable storage and no dependency on OS APIs.                                                                                                                                         |
| `tests/e2e/theme.spec.ts`               | Updates fallback expectations; tests dark OS default, manual persistence, pre-hydration saved/default resolution, cross-tab updates, login Light, Profile-only controls, and a new account's first login followed by Dark logout/login persistence and Light refresh persistence. |
| `tests/e2e/soft-industrial.spec.ts`     | Theme-specific visual fixtures now explicitly save their requested theme instead of depending on system preference.                                                                                                                                                               |
| `tests/e2e/connect-refinement.spec.ts`  | Same explicit preference setup for both-theme responsive checks.                                                                                                                                                                                                                  |
| `docs/default-light-theme-report.md`    | This report.                                                                                                                                                                                                                                                                      |

Earlier college-verification/profile-completion changes remain in the workspace and were preserved.

## Verification

- Unit/service suite: all **314 tests passed in 25 files**.
- Browser tests: **53 distinct targeted checks passed** across runs: 40 navigation/Soft Industrial/Connect checks and the final 13-test theme suite, including logout/login persistence. An initial auth-fixture test raced logout navigation; waiting for the login route and reloading resolved the test timing issue.
- Typecheck and architecture boundaries: passed.
- Production build: **passed**, including Prisma generation, optimized Next compilation, TypeScript and static page generation.
- Prettier/diff checks: passed.
- Lint: unavailable; `npm run lint` reports no configured lint script.

Startup browser tests block Next hydration JavaScript and assert the HTML theme plus the actual body background for no preference, saved Light and saved Dark on a dark OS. The logout/login test uses the real frontend login/logout handlers and SDK with a synthetic auth-provider response and deterministic app/session API fixtures; it does not create a production account. Existing real loopback connection tests and moderation data tests remain in the browser run.
