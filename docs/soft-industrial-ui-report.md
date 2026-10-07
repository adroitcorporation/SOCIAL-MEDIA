# Founder Circle Soft Industrial UI adaptation

The reference was used as a moodboard. Existing data, navigation, routes, brand mark, permissions and feature behavior remain the source of truth. No concept statistics, people, events or community features were added.

## Files changed

| File                                            | Change                                                                                                                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/layout.tsx`                            | Loads variable Sora and Inter with `next/font/google`, self-hosted by Next, with font fallback adjustment and preload.                                                                                                                                         |
| `src/frontend/styles/tokens.css`                | Centralized light/dark semantic colors, borders, focus, photo overlays, badges, font families and compatibility aliases for existing components. Logo identity colors remain separate and unchanged.                                                           |
| `src/frontend/styles/globals.css`               | Replaces legacy literal colors and serif typography with tokens. Restyles the shell, sidebar, header, buttons, shared cards, Discover, profiles, messaging, notifications and moderation. Adds responsive typography, touch targets and long-content wrapping. |
| `src/frontend/pages/home-page.tsx`              | Editorial hero, real dynamic greeting, supporting copy, existing Discover/Idea Board links, optimized image, and a responsive full-width ideas section. Continues rendering API-backed people, events and ideas.                                               |
| `src/frontend/features/events/event-poster.tsx` | Uses a CSS property for the real attachment image instead of an inline blue gradient; attachment loading and permissions remain unchanged.                                                                                                                     |
| `public/images/campus-collaboration.webp`       | New decorative hero photograph, generated with the built-in imagegen tool and converted to a 135 KB WebP. This is not a profile, event, or user record.                                                                                                        |
| `tests/e2e/theme.spec.ts`                       | Updates expected surface colors while retaining theme persistence, system preference, cross-tab, pre-hydration and Profile-only control checks.                                                                                                                |
| `tests/e2e/soft-industrial.spec.ts`             | Covers both themes, active font loading, main screens, header controls and overflow at seven widths. Moderation checks use the fixed loopback demo database and restore the original role.                                                                     |
| `docs/soft-industrial-ui-report.md`             | Change report, validation evidence and asset provenance.                                                                                                                                                                                                       |

## Tokens and typography

Dark: graphite `#1C2021`, secondary `#252A2B`, elevated `#303638`, higher `#383E3F`, bone text `#E8E4DB`, sage `#B8C2A5`, dusty rust `#B86F50`, and translucent neutral borders. Selected navigation uses a translucent sage surface and a narrow indicator.

Light: warm background `#F1F0EB`, surface `#E8E7E1`, cards `#F8F7F3`, text `#202323`, secondary text `#696E6C`, neutral borders `#D7D7D0`. Light CTA sage is slightly deeper (`#637258`) for small-label contrast. Dark metadata uses `#A8AFAD` instead of the darker suggested muted shade so it remains readable on elevated surfaces. Badge foregrounds differ by theme for contrast.

Semantic roles include `--background`, `--surface`, `--surface-elevated`, `--text-primary`, `--text-secondary`, `--text-muted`, `--brand-primary`, `--brand-secondary`, `--border`, `--success`, `--warning`, `--danger`, plus focus and badge roles. Existing aliases such as `--card`, `--ink` and `--primary` reuse these roles. Legacy profile/Discover palettes and literal color fallbacks no longer override the theme.

Sora 600 is used for headings and key profile names; Inter is used for body, navigation, buttons, metadata and forms. Hero typography reaches 56 px on desktop and 30–36 px on mobile. No serif fonts remain. Next manages font preload, self-hosting and adjusted fallbacks; browser checks confirm active Latin faces load.

## Responsive behavior and preserved functionality

Verified 1440, 1280, 1024, 768, 430, 390 and 360 px in both themes; existing mobile tests additionally cover 320, 375, 393 and 412 px. Hero copy and photography stack on tablet/mobile. Ideas use three, two and one columns. People retain their native horizontal tray. Profile long words/tags wrap on tablet as well as mobile. Primary actions, icon buttons and bottom navigation provide approximately 44 px or larger touch targets.

Sidebar order remains Home → Idea Board → Discover → Events → Connections → Messages, then Moderation only for authorized users. Notifications remain in the header bell. The sole theme control remains inside Profile. Existing active states, drawer focus behavior, mobile bottom navigation and routes are preserved.

Backend APIs, schema, authentication, authorization, swipe mechanics, connection requests, groups, messages, notifications/SSE, Idea Board and event behavior were not changed. Global search continues to search the existing people discovery flow; its placeholder does not promise idea search that it does not implement.

## Validation

- Frontend typecheck: passed.
- Unit tests: 24 files, 305 tests passed.
- Focused browser verification: 76 distinct tests passed across runs, including both-theme responsive screens, navigation, swipe gestures, native tray scrolling, SSE, connections, groups/chat, Idea Board, profile upload/forms and moderation permissions/actions.
- Two light-mode tablet Profile overflow failures were fixed and passed on rerun. An initial font assertion queried unused fallback faces; it was corrected to check the active Latin faces.
- Production build: passed, including Prisma generation, compilation, TypeScript and static page generation.
- Compiled frontend smoke check: passed against `next start` with controlled API fixtures; the dark-mode desktop test checked main screens, self-hosted fonts, navigation, Profile theme selection and overflow.
- Formatting, architecture boundary and diff checks: passed.
- Lint: attempted; unavailable because this repository has no lint script, ESLint dependency or ESLint configuration. No unrelated lint setup was introduced.
- Screenshots reviewed for all requested main sections and both themes. Review artifacts are in `.local/design-review/` and are not application data.

## Remaining limitations

People without uploaded photographs retain initials; events without uploaded posters retain the existing category artwork. These were intentionally preserved rather than supplying invented user/event imagery. Real production account data and remote services were not modified; browser integration checks used the local demo and controlled fixtures. The original blue/orange logo colors remain intentionally intact.

## Generated hero provenance

Built-in imagegen was used. Final workspace asset: `public/images/campus-collaboration.webp`.

Prompt:

> Create one wide 3:2 editorial photograph for the right half of Founder Circle's home hero. Candid scene of three Indian college students, young adults age 20-24, collaborating around a laptop and sketchbook at an outdoor campus table, warm stone architecture and trees softly out of focus. Two women and one man in understated casual clothes, natural unposed expressions, quiet optimism. Muted graphite, warm bone and sage palette, soft natural late afternoon light, tactile documentary photography, premium but authentic student community atmosphere. Compose people in center and right, no text, no logos, no UI, no watermark, no decorative graphics. Landscape photo only, suitable for responsive cropping.
