# Roles and moderation

New accounts start as **Student**. Privileged roles are stored in PostgreSQL, never in client metadata or an environment allowlist.

| Role               | Events                               | Verification / reports / accounts                                                        | Role assignment              |
| ------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------- |
| Student            | Browse and save                      | Submit verification and reports                                                          | No                           |
| Organiser          | Create, edit and delete owned events | Submit verification and reports                                                          | No                           |
| Moderator          | Browse and save                      | Review verification and reports; restrict, suspend, ban, deactivate and restore accounts | No                           |
| Ultimate Moderator | Create, edit and delete any event    | Full moderation                                                                          | All roles, including Student |

Moderators cannot restrict Ultimate Moderators. At least one active Ultimate Moderator must remain. Restrictions are indefinite until a moderator restores the account. All five account states are visible in account management and profile badges; any state other than Active denies authenticated app features.

## Activation

1. Apply the migration to the intended backend database: `npm run db:migrate`.
2. Choose an existing, trusted account and run `npm run roles:bootstrap -- <user-id>` with the backend database environment. The script refuses to run if an active Ultimate Moderator already exists and records an audit entry.
3. Sign in as that account. Open `/moderation/roles` to assign the other roles.

`MODERATOR_USER_IDS` is retired. Existing accounts default to Student; regrant privileges explicitly. Existing events retain a null owner because their authors cannot be inferred safely; only Ultimate Moderators can modify those events. New events always get the authenticated creator as owner, including events created by Ultimate Moderators. Clients cannot transfer ownership.

The migration enables row-level security on User, Event, Report and ModerationAction. These tables have no browser Data API policies. The existing server-side Prisma database connection must use the table owner or a trusted role with RLS bypass; do not expose its credentials to clients.

## Routes and enforcement

- `POST /api/events`, `PATCH /api/events/:id`, `DELETE /api/events/:id`: event permission and ownership checks inside serializable transactions.
- `GET /api/events/managed?search=&page=0`: authorised event management list, including past events.
- `POST /api/reports`: authenticated report submission with target ID and reason; duplicate open reports by the same reporter are rejected.
- `GET /api/moderation/reports?status=&search=&page=0`, `PATCH /api/moderation/reports/:id`: report queue and decisions (reviewed, resolved, dismissed, escalated).
- `GET /api/moderation/users?status=&search=&page=0`, `PATCH /api/moderation/users/:id/status`: account search and restrictions/restoration.
- `GET /api/moderation/roles?search=&page=0`, `PATCH /api/moderation/users/:id/role`: Ultimate Moderator-only role management.
- `GET /api/moderation/dashboard`: global counts, flagged accounts, recent events/reports/verifications, and audit activity.
- Existing `/api/moderation/verifications` routes now use database permissions and audit every decision.

Lists return 100 items per page. Search accepts names, or exact user IDs for accounts. Dashboard activity contains the most recent 50 actions; its summary counts all recorded actions. Each decision preserves its actor, target, timestamp and reason in the audit log. Verification and report rows also retain their latest reviewer and decision.

Every authenticated API request reloads account status. Privileged service functions reload roles inside their mutation transaction, so forged frontend state or stale identities do not grant access. Profile updates and verification submissions cannot set roles, ownership, moderation status or approval fields.

The browser still sends bearer tokens to APIs. `/session` validates a bearer token and creates an HttpOnly, SameSite cookie (Secure in production) only for server page checks. `/moderation` and `/moderation/roles` revalidate this token and current role before rendering. API mutations never use that cookie as authentication. Logout clears it. In the split Vercel/Render deployment, server page checks call the configured backend `/api/session` endpoint without caching.

Restricted accounts keep their database identity and status across subsequent sign-ins, and cannot recreate an active profile by signing in again. Identifying the same person registering with a different identity/email requires an identity or abuse-prevention policy outside this app; this change does not claim to detect that.

## Verification

`npm test` exercises the complete permission matrix, real PostgreSQL-compatible migrations and API/service operations, ownership forgery, report auditing, revoked access and server page guards. `npm run typecheck` and `npm run check:boundaries` check contracts and architecture.

For browser tests, use an isolated local demo database, apply migrations, seed it, and bootstrap `demo-aarav`. Then start the app with `LOCAL_DEMO=true`, `APP_URL=http://localhost:3000`, and that database URL. Run `npx playwright test tests/e2e/rbac.spec.ts tests/e2e/moderation.spec.ts`. RBAC browser tests modify only sample event/report/account data and restore the sample account's role/status. Never enable the demo in production.
