# Singapore manual configuration and remaining gates

Historical Seoul Storage migration is intentionally waived. Do not export, copy, rewrite or delete Seoul objects. The earlier blocked export is no longer required; no execution restriction was bypassed. Historical database-backed private documents remain preserved.

## Staging configuration

Singapore project: `lxofcmzgzbgqvlmwizgm`. The corrected backend credential passed Storage and Auth API validation. Never commit the ignored `.env`, copy it wholesale to staging, or put a backend secret in `NEXT_PUBLIC_*` variables.

Configure the isolated backend:

- `DATABASE_URL` and `DIRECT_URL`: Singapore connections; use the session pooler on port 5432 for this machine.
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_STORAGE_URL`: `https://lxofcmzgzbgqvlmwizgm.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: Singapore backend-only secret from the approved secret store.
- `SUPABASE_EXPECTED_PROJECT_REF=lxofcmzgzbgqvlmwizgm`.
- `FILE_STORAGE_MODE=supabase`. The compatibility default `database` must not be used at the future cutover.
- `APP_URL` / `NEXT_PUBLIC_APP_URL`: actual isolated frontend origin.

Build the frontend with the Singapore public publishable key, Singapore Auth URL, `NEXT_PUBLIC_SUPABASE_EXPECTED_PROJECT_REF=lxofcmzgzbgqvlmwizgm`, and `BACKEND_URL` targeting the isolated staging backend. Rebuild when public configuration changes. Never give the frontend service-role/secret keys.

The reviewed local launcher scopes migration overrides to its child process. Its isolated worktree must contain the current audit commit before testing the new UI. Do not run root `npm start`: existing root variables still target Seoul. Do not change PowerShell execution policy to run a blocked launcher.

Singapore already has all three buckets and restrictive policies from `supabase/file-storage.sql`. Both new Prisma migrations were applied only to Singapore: attachment pointers/tombstones and the scoped private college-document constraint. Do not apply them to Seoul during this audit.

Singapore Auth Site URL is `http://localhost:3001`; exact redirects are `http://localhost:3001/` and `http://localhost:3001/reset-password`. Recovery redirect was tested with a synthetic account. Before approved deployment, configure its actual staging/canonical origins and retest recovery. Verify providers, SMTP delivery, MFA settings and origin restrictions for the modes actually used. Migrating Auth rows does not copy dashboard settings. Plan re-login because project keys/issuers differ.

## Remaining production blockers

1. Deploy the reviewed build to isolated Render/Vercel staging and test browser → API integration, placeholders, uploads and recovery. Direct API-handler rehearsal is not a deployed integration test. Vercel project-scoped inspection previously returned 403; an authorized operator must verify project settings.
2. Secure portable encrypted database/Auth backups and a supported backup/recovery procedure for **new Singapore files**. Test restoration into approved disposable infrastructure and environment recovery. The existing DPAPI source backup is tied to this Windows account. Synthetic file reupload and Auth unban are component recovery tests, not full disaster recovery.
3. Rehearse controlled all-writer freeze and final database/Auth synchronization. New build guards do not disable old browser tabs, workers or direct Seoul clients. Do not freeze/disable Seoul now; cutover requires explicit approval.
4. Define recovery after Singapore accepts production writes. Pointing back to Seoul loses new data. Test reconciliation or keep maintenance active and use forward recovery. Measure RPO/RTO.
5. Review inherited advisor warnings: nine mutable function search paths and disabled leaked-password protection. RLS-without-policy notices reflect the backend-only data design; do not add public policies to silence them. [Function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

After these gates pass, obtain separate approval for merge/push, live environment changes and cutover. No live Render/Vercel credentials were changed.
