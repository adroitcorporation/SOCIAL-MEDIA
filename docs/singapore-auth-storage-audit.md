# Singapore Auth and Storage audit — 9 October 2026

**Compatibility is partially verified; deployed validation remains pending.** This turn used only SELECTs, GETs and HEADs against cloud services. No account, session, object, policy or production configuration was modified.

## Authentication

Current Auth settings GET succeeds with independently validated project credentials. Both projects enable email authentication and signup, require email confirmation (mailer_autoconfirm=false), disable anonymous/phone authentication and disable the listed OAuth providers. The app offers OAuth buttons; provider enablement must be reviewed, not assumed from UI presence. No provider was enabled here.

All 25 users have matching UUIDs and password-hash fingerprints, 25 identities match exactly, and 19 emails are confirmed in both projects. Profile/Auth relationships match. Five Auth user rows differ only in activity timestamps. The earlier human-operated existing-password login and agent-observed Singapore refresh/reload are historical successful checks; they were not repeated using real student credentials. Existing password compatibility is supported by matching hashes and that prior login, not a fresh automated login claim.

Both current JWKS endpoints return ES256 keys with different key IDs and different public key material. Backend authorization calls getUser against the configured project, then requires confirmed email, an active account and explicit permissions. Exact approved domains come from ApprovedCollegeDomain; malformed email and deceptive subdomains remain rejected. User-editable metadata is not used to assign authorization. Profile completion and college verification continue gating connection requests.

The destination security advisor also reports leaked-password protection disabled. Review its availability, plan/cost and approved password policy before GO; no Auth setting was changed. [Supabase password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Plan forced re-login.** Restoring Auth sessions does not make Seoul JWTs valid against Singapore's issuer/keys; old refresh-token compatibility is unverified. Do not rotate/import production keys to avoid re-login. [Supabase signing-key behavior](https://supabase.com/docs/guides/auth/signing-keys), [Auth migration guidance](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects).

Last approved Singapore redirect setup was localhost:3001 with exact root and /reset-password redirects. Current public settings do not expose Site URL/allowlist/SMTP/password policy/MFA/hook configuration. Management configuration access was unavailable in this turn, so current values require dashboard read verification. Before approved staging deployment, set Singapore Site URL and exact redirects to the separate stable HTTPS frontend, verify controlled-mailbox confirmation/recovery and record provider/SMTP/rate-limit/MFA settings. Never send test emails to student addresses. Browser sessions use the existing SDK persistence/refresh; APIs use bearer tokens. Verify page-session cookie Secure/HttpOnly/SameSite=Lax and logout deletion on HTTPS staging.

## Storage

Current credential-backed bucket listing and read-only inventory pass. Seoul has one public profile-photos bucket with 11 objects; Singapore has three buckets and the same 11 paths. Total profile bytes: 23,078,406. Fresh dry-run: zero missing, metadata conflicts, extra objects or bucket conflicts; zero transfers. All 11 destination public image HEAD requests return 200 with expected MIME. Prior independent source/destination SHA-256 downloads passed for all 11, recorded in [transfer evidence](supabase-storage-transfer-result.json); this audit does not relabel HEAD as a new hash comparison.

| Bucket            | Access  |           Limit | Types             | Singapore objects |
| ----------------- | ------- | --------------: | ----------------- | ----------------: |
| profile-photos    | Public  | 4,000,000 bytes | JPEG/PNG/WebP     |                11 |
| college-ids       | Private | 4,000,000 bytes | JPEG/PNG/WebP     |                 0 |
| event-attachments | Private | 8,000,000 bytes | PDF/JPEG/PNG/WebP |                 0 |

Storage tables retain RLS in both projects. Seoul permits authenticated INSERT into a profile folder matching auth.uid(). Singapore uses restrictive browser read denial for private buckets and restrictive browser INSERT/UPDATE/DELETE denial for all application buckets, with no permissive policies. Backend secret access bypasses RLS and therefore depends on API authorization.

Uploads are **backend-mediated**, not browser Storage SDK uploads: profile-photos.ts validates/decodes images and active actors before a privileged non-overwriting upload. file-storage.ts requires matching Auth/Storage origins and expected project ref. College verification bytes/pointers are returned only after moderator permission. Event attachments are available to active authenticated community users through the existing API; edit/delete additionally require event permissions. They are not owner-only download documents. No access model changed.

Prior authorized two-account synthetic CRUD/private-access/signed-URL expiry checks passed in [component evidence](supabase-new-storage-evidence.json). Live fixture creation/upload/update/delete/signed URLs were not repeated because this request forbids cloud mutations. They remain required on the deployed fixture-only staging environment after approval. Empty private buckets and static RLS inspection alone do not prove live private-document authorization.

## Historical URLs and retention

Five current User.photo fields still contain absolute Seoul public-photo URLs. The Singapore build intentionally renders initials for foreign Supabase photos, so transferred files will not automatically display until references are safely mapped. Seoul remains accessible; no deletion is authorized.

`scripts/singapore-photo-url-plan.ts` now prepares an **offline, idempotent dry-run only**. It accepts a reviewed local profile export and verified transfer manifest, permits only exact trusted Seoul public profile URLs with hash-verified destination paths, rejects credentials/query strings/traversal/private paths, and emits expected old value plus replacement for compare-and-swap review. Current plan: five changes, zero unresolved, zero cloud writes. Running it against already-mapped references produces zero changes.

```powershell
& .\node_modules\.bin\tsx.cmd scripts/singapore-photo-url-plan.ts --profiles .local/singapore-readiness/profiles.json --manifest .local/storage-sync/completed-snapshot.json --output .local/singapore-readiness/photo-url-plan-reviewed.json
```

Use a fresh owner-only profile export and freshly verified final manifest before cutover. Apply only to the approved Singapore candidate in a reviewed transaction with project identity checks, expected-photo predicates, exact affected-count assertion and reversible mapping. No bulk rewrite executor is shipped or run. Do not rewrite signed/private URLs or arbitrary external links. Missing images retain initials and optional user reupload.

Four legacy college-ID documents and historical verification decisions are preserved in PostgreSQL, not copied to public Storage. Review retention/privacy rules for these documents before source retirement; never downgrade verification because an old document is absent. Seoul's newer approval must be synchronized. Preserve all backups and original files.
