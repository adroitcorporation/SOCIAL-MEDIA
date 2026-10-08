# Founder’s Circle: Supabase region audit (2026-10-08)

**Status:** Read-only audit. Production Vercel, Render and Supabase have not been changed.

## Verified
- The linked Supabase project is active in Seoul (ap-northeast-2), with existing Auth, application and Storage data.
- The codebase uses Next.js 16, Prisma/PostgreSQL, Supabase Auth and Storage, and server-sent events for notifications.
- Vercel forwards most API requests to the Render backend; Render is configured for Singapore in render.yaml.
- All 13 Prisma migrations appear successfully applied in the linked Supabase database.

## Key risk
The checked-in Render blueprint declares a Render-managed PostgreSQL database, whereas the linked Supabase project contains the active application tables. The running Render service configuration has not been verified. Confirm the actual DATABASE_URL host before any migration or redeployment.

## Migration scope
- Preserve Supabase Auth UUIDs so they still match public.User IDs.
- Transfer actual Storage files, not only database metadata.
- Update stored profile photo URLs after verifying the copied objects.
- Include private verification images and event attachments stored as database bytes.
- Reconfigure Auth providers, email, redirect URLs, keys and Storage policies.
- Coordinate backend database credentials with frontend build-time Supabase URL and key.

## Remaining checks
Confirm live Render configuration, take and restore-test backups, benchmark real p50/p95 database latency from Render, create a separate Singapore staging project only after approval, test full application flows, and obtain explicit approval before production cutover.

No live latency measurements or full test suite were run in this audit.
