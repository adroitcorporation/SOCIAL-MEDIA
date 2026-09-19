# Founder Circle

A student collaboration platform for building, creating, competing, and finding your people across Indian colleges. Next.js App Router, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, and Supabase Auth.

## Run the local demo

Requires Node.js 24 and npm. No cloud account or Docker needed.

```sh
npm ci
npm run db:local
```

In a second terminal:

```sh
npm run demo
```

Open **http://localhost:3000**. The demo applies the checked-in migrations, seeds clearly labeled fictional students/events without overwriting existing records, and signs in as Aarav Mehta. Changes persist in `.local/postgres`. Keep the database terminal running. The embedded database listens only on localhost and is for development, not deployment.

`LOCAL_DEMO` is a server-only flag, ignored by production authentication. Production startup refuses to run with it enabled. The local demo is not evidence that live email delivery or Supabase account configuration has been verified.

## Run with real accounts

1. Copy `.env.example` to `.env`. Never commit credentials.
2. Set `DATABASE_URL` to a PostgreSQL direct/session connection with schema-owner permissions. For hosted databases use the provider's required TLS parameters. A transaction pooler is not appropriate for migrations.
3. Create a Supabase project for **Auth**. Its database does not need to be the application's database. Set the project URL and publishable key in both your local/build and runtime environments. No service-role key is used by this app.
4. Enable email/password auth and email confirmation. Configure the Site URL to your `APP_URL`, and allow both `APP_URL/` and `APP_URL/reset-password` as redirect URLs. Set a minimum password length of 12 in Supabase, enable leaked-password protection if available, and configure production SMTP. Sign-up confirmation and password-reset delivery depend on these settings.
5. Leave `LOCAL_DEMO=false`. Run:

```sh
npm run db:migrate
npm run dev
```

Sign up, confirm your email, and complete onboarding. Until email is confirmed, protected API operations return 403. Supabase stores and refreshes sessions; the server validates access tokens with `auth.getUser()` on every protected request. Auth screens include login, signup, password recovery, password update, and logout.

**Verification is honest:** email verification does not establish college enrollment. `collegeVerified` is server-controlled, defaults to false, and cannot be changed through profile APIs. A college-email/institution review workflow is an explicit future integration; the schema and UI already distinguish it.

Profile and group images currently accept HTTPS image URLs, with initials as a fallback. File uploads/storage provisioning are not included.

## Production / Render

`render.yaml` provisions the web service and a PostgreSQL database in Singapore. I used the Render Blueprint skill to prepare this configuration; no infrastructure has been provisioned or deployment triggered.

1. Push this repository to a connected GitHub/GitLab/Bitbucket repository.
2. Create a Render Blueprint using `render.yaml`.
3. Supply `APP_URL` (the canonical HTTPS origin, no trailing slash) and the two public Supabase variables. Public auth variables must be present **during the build** as Next.js embeds them in the client bundle. Redeploy after changing them.
4. Configure the same production origin/redirect URLs and SMTP in Supabase.
5. Deploy. `npm start` validates configuration, runs **`prisma migrate deploy`**, and only starts Next.js after migrations succeed. The health endpoint checks the database. No resets or `db push` occur.

The Blueprint defaults to free resources for evaluation. Choose paid web/database plans with the retention, backups, and uptime you need before a public launch. Keep your database backup/restore procedure and email delivery monitoring configured. For multiple application instances, the connection limit in `DATABASE_URL` must fit your database capacity. Use rolling, backwards-compatible migrations for future releases.

The Blueprint can be validated using `render blueprints validate` when the Render CLI is installed. There is no Git remote configured in this workspace, so a deployment link cannot yet identify a repository.

## Features and invariants

- Home with relevant students, ideas, and upcoming events; responsive sidebar and mobile navigation.
- Onboarding and editable profile: college, degree, graduation year, city, bio, skills, interests, domains, looking-for preferences, profile image URL, and optional social links.
- Discovery filters for every requested field, search, pagination, persisted skips, profile details, blocking/unblocking. Self, connected users, and either-direction blocks are excluded. Pending requests display the correct state.
- Request lifecycle: PENDING → ACCEPTED / REJECTED / CANCELLED. A canonical unique pair prevents duplicate reciprocal requests. Only the requester can cancel, and only the receiver can accept/reject. Cancelled/rejected relationships can be requested again.
- Direct conversations require an accepted, unblocked relationship. A unique canonical direct key prevents duplicates.
- Manual groups select accepted connections in either request direction. One other connection is the minimum; the creator is OWNER. Roles are OWNER, ADMIN, MEMBER, not an `isAdmin` flag.
- Owners rename, change image, add/remove members, promote/demote admins, transfer normal-group ownership, or delete a group. Admins add eligible users and remove only normal members. Members can read/send and leave. Owners must transfer ownership before leaving; idea ownership remains tied to the idea author.
- Removed members immediately lose API access to history and sending. All membership permissions are server-side. UI controls are not an authorization boundary.
- IdeaBoard posting, discovery, details, unique/idempotent resonance, withdrawal, owner-only resonance list with students/skills/time, and notifications.
- One official idea group enforced by unique `Conversation.ideaId`. `getOrCreateIdeaGroup` adds selected eligible resonators into the existing group and preserves history. Resonance alone never creates a group or automatically enrolls anyone. Removing resonance does not remove existing group membership; owners moderate membership separately.
- Messages have timestamps, last-message previews, unread counts, history loading, and retry idempotency through `(senderId, clientId)` uniqueness.
- Reconnecting SSE invalidations refresh messages, connections, and notifications about every three seconds while visible. Streams carry no private data; subsequent authenticated reads enforce current membership. This works across app instances without an in-memory event bus. It is bounded-latency refresh, not per-keystroke push. For high-volume operation, replace periodic invalidations with PostgreSQL LISTEN/NOTIFY or a managed pub/sub broker.
- Event category/search filters, details, external registration links, and saved events. Events are curated database records. There is no public event-submission/admin CMS. Sample events never link to fabricated registrations.
- Notifications for requests, acceptance, resonance, and group invitations, with read/unread state. New chat messages use conversation unread indicators.

Transactions are serializable with bounded conflict retries. Database constraints enforce canonical relationships, unique idea groups, unique resonance, exactly one matching group owner, and two-member direct conversations. RLS is enabled on application tables with no browser policies: all access goes through server APIs. If using Supabase PostgreSQL, do not grant browser roles direct table access.

## Code map

```text
src/app/                      Routes, protected API, live stream, global styles
src/components/               UI components and client data/session controller
src/services/community.ts     Transactional business rules and data queries
src/lib/auth.ts               Server token verification and local-only demo guard
src/lib/validation.ts         Input schemas and safe HTTPS URLs
src/lib/brand.ts              Central product name, tagline, description
prisma/schema.prisma          Models and relationships
prisma/migrations/            Initial schema + RLS/integrity constraints
prisma/seed.ts                Guarded, non-destructive fictional sample data
scripts/                      Local database/demo and migration-first production start
tests/                        Database regression and browser flow tests
```

Change visible branding in `src/lib/brand.ts`. Infrastructure/package names in `render.yaml` and `package.json` are independent deployment identifiers.

## API

Protected endpoints take `Authorization: Bearer <Supabase access token>`. Mutations require JSON and reject foreign browser origins. User identity always comes from server token validation, never an actor ID in the request body. Mutations have a PostgreSQL-backed per-user limit of 90 per minute. Authentication rate limits are configured in Supabase. Error bodies are `{ "error": "message" }` with 400/401/403/404/409/413/415/429 or generic 500 responses.

| Endpoint                                       | Behavior                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /api/state`                               | Authenticated home/discovery state; search/filter query params and zero-based `page` |
| `PATCH /api/profile`                           | Validated profile save/onboarding                                                    |
| `GET /api/students/:id`                        | Profile, subject to blocks                                                           |
| `POST /api/connections`                        | `{ userId }` creates/resends request                                                 |
| `PATCH /api/connections/:id`                   | `{ action: "accept" \| "reject" \| "cancel" }`                                       |
| `POST /api/conversations`                      | Direct: `{ type: "DIRECT", userId }`; group: `{ type: "GROUP", name, memberIds }`    |
| `PATCH /api/conversations/:id`                 | `{ action, userId?, value? }` membership/settings operations                         |
| `GET/POST /api/conversations/:id/messages`     | Read history / `{ body, clientId }` send                                             |
| `POST /api/ideas`                              | `{ title, description, category, skills, tags }`                                     |
| `POST /api/ideas/:id/resonate`                 | `{ enabled: boolean }`                                                               |
| `GET /api/ideas/:id/resonances`                | Author-only people list                                                              |
| `POST /api/ideas/:id/group`                    | `{ memberIds }` get/create and add to official group                                 |
| `POST/DELETE /api/blocks/:userId`              | Block/unblock                                                                        |
| `POST /api/skips/:userId`, `DELETE /api/skips` | Persist skip / restore skipped profiles                                              |
| `POST /api/events/:id`                         | `{ saved: boolean }`                                                                 |
| `PATCH /api/notifications[/:id]`               | Mark one/all read                                                                    |
| `GET /api/live`                                | Authenticated SSE invalidations, reconnects every 55s                                |
| `GET /api/health`                              | Database readiness                                                                   |

Lists are bounded to protect response size (discovery 12/page, ideas 50, events/notifications/conversations 100, connections/resonances 500). Extend cursor pagination on these community-wide lists before operating beyond those sizes. Messages load 50 per request.

## Verification

```sh
npm run typecheck
npm test
npm run build
npm audit
npm run render:validate
# With npm run db:local + npm run demo already running:
npx playwright install chromium
npm run test:e2e
```

Database tests use an isolated in-memory PGlite PostgreSQL engine with the real SQL migrations and Prisma services, not mocked repositories. They exercise requester-only cancellation, persistence/resend, reciprocal uniqueness, accepted-only groups, role permissions, revocation, unread counts, message retry idempotency, atomic ownership transfer, unique idea groups, new-resonator reuse, blocking, and database constraints. PGlite serializes connections, so full PostgreSQL contention/load testing remains a deployment validation step.

Browser tests run against the local demo only and verify cancellation across refresh, group creation/member management/message persistence, persistent idea-group reuse, live refresh in another browser, and all eight mobile screens. They must never run against a real user database.

Verification completed in this workspace: **18 database/security tests and 5 browser flow tests pass**, TypeScript and the production build pass, the dependency audit reports zero vulnerabilities, and `render.yaml` validates against Render's official JSON schema. GitHub Actions runs the build, database/security tests, and browser flows on pushes and pull requests.

On Windows, stop the development server before running `npm run build`: Prisma cannot replace its loaded query-engine DLL while Next.js is running. Restart with `npm run demo` afterward.

Live Supabase signup, confirmation, recovery, SMTP delivery, and Render deployment require your project configuration and have not been exercised against a hosted account in this workspace. The pasted brief ends mid-sentence in section 15; requirements beyond that point were not available.
