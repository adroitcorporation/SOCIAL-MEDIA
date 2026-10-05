# UI cleanup audit

Completed 6 October 2026. Targeted cleanup preserves Founder Circle's palette, typography, navigation and existing components. Recommendations appear as results and short match reasons, without AI branding.

## Screens reviewed

| Area                                                | Result                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home                                                | Short greeting and one primary discovery action; concise section labels; compact people/idea cards. Decorative sparkle symbols and the illustration's promotional caption were removed.                                                          |
| Discover                                            | Photo/name/college/year hierarchy, three skill chips, looking-for label, match percentage and at most three reasons. Bios stay in the opened profile. Skip/Connect remain visible; filters retain their values; loading more has error handling. |
| Profile and onboarding                              | Searchable selection chips, visible limits and removable selections; college autocomplete supports aliases and custom values. Existing values survive edits. Full bios remain on profiles.                                                       |
| Connections                                         | Compact profile cards, short actions and short empty states with a discovery link.                                                                                                                                                               |
| Chat and groups                                     | Short headings and empty states. Group selection and member/settings dialogs retain eligibility, ownership and destructive-action explanations.                                                                                                  |
| Idea Board                                          | One-line feed descriptions, title, author, tags and resonance actions. Full descriptions and collaboration management remain in the detail dialog.                                                                                               |
| Events                                              | Feed cards show event identity, organizer, type, date, location and action. Full descriptions stay in the detail dialog. Management empty copy was shortened.                                                                                    |
| Notifications                                       | Short page controls; new sample welcome copy is concise. Historical notifications and user-generated text are preserved.                                                                                                                         |
| Settings and navigation                             | Reviewed theme control, mobile navigation, profile controls, blocked accounts and group settings. There is no separate Settings route in this app; none was invented.                                                                            |
| Authentication, moderation, modals and empty states | Redundant introductory/marketing copy removed or shortened. Access errors, validation, moderation reasons and confirmations retained.                                                                                                            |

## Copy removed or shortened

Redundant heading subtitles, promotional onboarding/empty-state text, repeated feature explanations, biography text in discovery cards, multi-line idea feed descriptions, and event feed descriptions. Buttons use direct actions such as Connect, Message, Resonate, Create group, Post idea and Save. Matching has no AI badge, algorithm paragraph or generated explanation block. AI-related skills and interests remain legitimate student-selected topics.

## Copy intentionally retained

- Form validation, required-field markers, selection limits and custom-value instructions prevent ambiguous input.
- College verification eligibility and the distinction between verified email and college enrollment prevent misleading trust claims.
- ID-review privacy text and pending-review status explain visibility and access.
- Group eligibility/ownership information explains who can be invited and who can manage a group.
- Chat/group deletion confirmations explain scope, history retention and irreversible effects.
- Provider/authentication/network errors and moderator access restrictions remain actionable.
- Full student bios, idea/event details, messages and historical notifications are content, not interface boilerplate.

## Components and responsive behavior

Reused PageHeading, Empty, Modal, Tag, Avatar and existing button tokens. Reduced hero, heading and empty-state spacing; shortened feed cards; bounded chips and wrapped long identity text. New profile controls use existing light/dark theme tokens, keyboard-operable selections and a bounded college suggestion list. Desktop discovery uses its existing split card; mobile uses a stacked card with accessible actions. A navigation fix keeps the shell while waiting for destination data, instead of displaying an incorrect empty screen from the previous snapshot.

## Visual verification

Reviewed at **390, 768 and 1440 pixels**. The latest local audit captured 33 main-screen/dialog views plus 15 additional onboarding, auth, event-detail, group-settings and empty-state views. No horizontal overflow was reported; the main audit recorded no browser errors. Screenshots and machine-readable results are under `.local/ui-audit/` (local, not committed). Browser tests also cover mobile layouts, light/dark themes, validation, profile persistence, connections, chat and group actions.

## Later design work

The profile form is still long because the app collects required identity fields plus optional links. A separate, considered progressive-onboarding design could shorten perceived effort. A dedicated settings page could consolidate theme, account and privacy controls when more controls exist. Neither requires rebuilding the current screens, and neither blocks this cleanup.
