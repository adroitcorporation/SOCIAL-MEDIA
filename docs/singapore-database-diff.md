# Singapore database comparison — 9 October 2026

**NO-GO: this candidate is not a current production snapshot.** Read-only catalog snapshots were taken at 2026-10-08 23:33 UTC, and repeatable-read row comparisons followed at approximately 23:34 UTC. Each project was read independently while production stayed open; this is an audit, not a cross-project consistent backup.

Source: Seoul `rznbuzkgzsryadokvcfh`, PostgreSQL 17.6. Destination: Singapore `lxofcmzgzbgqvlmwizgm`, PostgreSQL 17.11. Both ACTIVE_HEALTHY. Reproducible SELECT-only queries are in `scripts/sql/singapore-readiness-catalog.sql` and `scripts/sql/singapore-readiness-rows.sql`. Keep raw results in owner-only, Git-ignored storage: they contain object paths, IDs and row digests. [Aggregate evidence](singapore-readiness-evidence.json) excludes those details.

## Catalog comparison

Both have 63 ordinary tables across public/Auth/Storage, including 28 public tables; 208 constraints, 64 foreign keys and 200 indexes. All constraints are validated. Index definitions, ordinary triggers, enum definitions, sequence definitions, schema ACLs, default ACLs and five extension versions match. Auth/Storage provider tables are catalogued, not treated as application-owned schema.

Singapore has exactly two extra nullable EventAttachment columns: deletedAt and storagePath. Its modified CollegeVerificationRequest_document_shape constraint supports validated private Storage pointers while retaining legacy bytes. These are expected changes from the two destination-only migrations. Source has 13 finished Prisma migrations; destination has 15. Every shared migration checksum/status matches between databases; neither has a failed/rolled-back entry. All 15 local SQL files match a stored checksum using either LF or CRLF representation. Eleven match byte-for-byte; four Windows checkout files differ only in newline representation. Do not edit historical migrations or checksum records to normalize them.

One source-only function/event trigger is missing in Singapore: public.rls_auto_enable and ensure_rls, which automatically enables RLS after table creation. Other compared function definitions and six provider event triggers match. Existing public tables all have RLS. Treat automatic protection of future tables as a security/configuration gap; have the operator review supported destination configuration before future DDL. Do not blindly restore provider-owned event triggers.

**Additional destination grants:** anon/authenticated have seven privileges each on Post, PostComment and PostLike (42 grant rows), absent on Seoul. RLS/no policies currently denies ordinary row access, but TRUNCATE is outside RLS and the broad ACLs unnecessarily expand access. No demonstrated anonymous REST data leak is claimed. Before GO, review/revoke these extra grants in Singapore under separate approval, retain the backend/service role access and verify denial in recovery/staging. No grants changed here.

Storage policy differences are intentional backend-only access; see [Auth/Storage audit](singapore-auth-storage-audit.md). Nine shared public functions have mutable search_path warnings in the destination security advisor; review them with the application roles before GO. The advisor reports 28 RLS/no-policy INFO notices: these tables use the privileged Node backend, so deny-by-default browser Data API access is intended. [Search-path remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Actual rows and keys

Comparison uses each table's actual primary key, including composite keys, and SHA-256 of canonical PostgreSQL jsonb rows. EventAttachment comparison excludes only the two destination-added columns; full digests are also retained locally. This avoids incorrectly collapsing membership/interaction rows by userId. Unchanged counts alone are insufficient.

| Table                             | Seoul | Singapore | Source-only keys | Destination-only keys | Changed shared keys |
| --------------------------------- | ----: | --------: | ---------------: | --------------------: | ------------------: |
| auth.identities                   |    25 |        25 |                0 |                     0 |                   0 |
| auth.refresh_tokens               |    48 |        47 |                4 |                     3 |                   6 |
| auth.sessions                     |    27 |        29 |                1 |                     3 |                   4 |
| auth.users                        |    25 |        25 |                0 |                     0 |                   5 |
| public.ApprovedCollegeDomain      |     2 |         2 |                0 |                     0 |                   0 |
| public.Block                      |     2 |         2 |                0 |                     0 |                   0 |
| public.College                    |    24 |        24 |                0 |                     0 |                   0 |
| public.CollegeVerificationRequest |     8 |         8 |                0 |                     0 |                   0 |
| public.Connection                 |    27 |        28 |                0 |                     1 |                   0 |
| public.Conversation               |     3 |         3 |                0 |                     0 |                   0 |
| public.ConversationMember         |     9 |         9 |                0 |                     0 |                   1 |
| public.Event                      |     1 |         1 |                0 |                     0 |                   0 |
| public.EventAttachment            |     1 |         1 |                0 |                     0 |                   0 |
| public.Idea                       |     1 |         1 |                0 |                     0 |                   0 |
| public.IdeaResonance              |     5 |         4 |                1 |                     0 |                   0 |
| public.Message                    |    13 |        13 |                0 |                     0 |                   0 |
| public.ModerationAction           |    20 |        20 |                0 |                     0 |                   0 |
| public.Notification               |    68 |        68 |                1 |                     1 |                   0 |
| public.Post                       |     1 |         1 |                0 |                     0 |                   0 |
| public.PostComment                |     0 |         0 |                0 |                     0 |                   0 |
| public.PostLike                   |     2 |         2 |                0 |                     0 |                   0 |
| public.RateLimit                  |     3 |         9 |                3 |                     9 |                   0 |
| public.RecommendationDocument     |    22 |        22 |                0 |                     0 |                   0 |
| public.RecommendationInteraction  |    92 |        87 |                7 |                     2 |                   0 |
| public.RecommendationJob          |     0 |         0 |                0 |                     0 |                   0 |
| public.RecommendationSkillLink    |    62 |        62 |                0 |                     0 |                   0 |
| public.Report                     |     1 |         1 |                0 |                     0 |                   0 |
| public.SavedEvent                 |     1 |         1 |                0 |                     0 |                   0 |
| public.Skip                       |    11 |         6 |                6 |                     1 |                   0 |
| public.TaxonomyAlias              |   232 |       232 |                0 |                     0 |                   0 |
| public.User                       |    19 |        19 |                0 |                     0 |                   1 |

All 25 Auth user UUIDs and identity rows match; identities and application profiles have zero Auth orphans. Six Auth users have no application profile in both projects; this is existing state, not a new migration loss. All 25 password hashes match using server-side fingerprints; no password or individual password fingerprint is included in this report.

## Classification and required reconciliation

- **Expected live-source drift:** a new IdeaResonance at 13:29:39 UTC and its notification; one profile changed at 14:17:06 UTC in updatedAt, collegeVerified and collegeVerificationSource. Seoul now has 13 verified profiles versus Singapore's 12. Preserve the newer approval; never reset verified status as a migration shortcut. Recommendation interactions/skips and notification state also differ.
- **Destination rehearsal contamination:** one extra connection and one notification created at 10:57:24 UTC, plus membership/rate-limit/session changes. These are not source data. Exact key lists are restricted in `.local/singapore-readiness/audit.json`. Do not automatically delete them or union both snapshots. Determine approved fixture/rehearsal ownership and rebuild/reconcile the inactive candidate from the final frozen source.
- **Expected Auth activity:** five users differ only in updated_at, with last_sign_in_at also different for one. Passwords/confirmation fields match; session, refresh-token and AMR rows differ after local staging use. Session-table equality would not prove signing-key continuity.
- **Expected schema changes:** two columns, one constraint and two migration entries described above.
- **Security/configuration gaps:** extra post-table grants and missing automatic future-table RLS protection; mutable search-path notices need review.
- **No established structural data loss:** matching indexes/FKs, validated constraints and matching unchanged table hashes support the restoration. This does not resolve live drift.

Legacy private data remains byte-identical under row hashing: four college-ID byte documents totaling 5,189,494 bytes and one event attachment of 37,987 bytes. Neither is made public or migrated to an object bucket here. Five profile-photo URLs still point at Seoul in each database. Final synchronization must compare keys/content and tombstones after freezing all writers, not replay the old schema over Singapore.
