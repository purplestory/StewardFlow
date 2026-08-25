# Recovery Baseline

Last updated: 2026-08-25

## Purpose

This document defines the only approved starting point for StewardFlow recovery and future migration-baseline work. It prevents an old bootstrap file or the historical migration pile from being mistaken for the current production schema.

## Authoritative Evidence

- Current production snapshot: `.local-backups/steward-flow/20260825-100124-KST/`
- Custom archive SHA-256: `2a059ae35067385e868ed17e66c6581996f4364f3d61dba0a5d34db920d18d6c`
- Archive metadata: 1,128 TOC entries; `pg_dump` and `pg_restore` 18.4
- Production migration history in the restored snapshot: `20260220103000_bootstrap_books_schema` only
- Manual hardening revision: `20260824090000_harden_tenant_rls_boundaries.sql`, SHA-256 `7c63ff760df5e3d0c4464ea9a775efe32efc8c40d1cee91d1fe9058bed53871e`
- Isolated NAS ACL-inclusive verification: PostgreSQL 17.6 with Realtime 2.102.3 initialized the global `supabase_realtime_admin` role. The final r3 restore has `profiles=6`, `organizations=2`, `auth.users=8`, public tables `35`, functions `29`, non-internal triggers `20`, policies `114`, and RLS-enabled public tables `35`.
- Normalized source archive versus r3 catalog: 233 public table/function/policy/RLS/trigger entries match exactly; both sorted inventories SHA-256 to `ad48c3ceaf1d3c01b1140a89bbab6ca1578ac4d87a71af20d910752e01b133e5`.

## Do Not Use As A Baseline

- `supabase/schema.sql` and `supabase/rls.sql` are legacy bootstrap references. They predate the current hardening boundary and must not be run for a new environment or recovery.
- Do not replay every file in `supabase/migrations/`. The directory contains duplicate/nonstandard versions, diagnostics, and historical reset or RLS-disable scripts.
- Do not run `supabase db push`, `supabase db reset --linked`, bulk migration repair, or change production `supabase_migrations.schema_migrations` without a separate action-time approval.

## Verified ACL-Inclusive Rehearsal

1. Create a new custom-format production archive with `scripts/backup-post-hardening.sh`; the PostgreSQL client prompts for the Database Password without echoing or storing it.
2. Verify its SHA-256, archive TOC, schema-only extraction, and data stream before transfer.
3. Transfer the archive to the NAS restricted backup directory using encrypted SSH and verify the checksum again.
4. Start a separate PostgreSQL plus Realtime runtime pair with fresh local-only secrets. The pair is isolated from Vercel, OAuth, SMTP, and the existing NAS projects; Realtime shares the DB network namespace because the NAS host firewall blocks forwarding across a newly created bridge. Do not change NAS firewall rules for this rehearsal.
5. Confirm the Realtime migration completed and `supabase_realtime_admin` exists before attempting an ACL-inclusive restore.
6. A direct one-pass ACL restore into an otherwise blank DB is expected to stop at archive TOC entry `5260` (`graphql_public.graphql` ACL): the archive expects a GraphQL wrapper installed by a Supabase event trigger, while the trigger is restored after that ACL. Preserve that failed target only as diagnostic evidence; do not treat it as a successful restore and do not replace the test with `--no-privileges`.
7. For an ACL-inclusive blank-DB restore, use the archive TOC with only entry `5260` commented, restore pre-data as `supabase_admin` with `ON_ERROR_STOP`, run `scripts/nas-runtime-rehearsal-graphql-prelude.sql`, then restore the archive data and post-data sections with `--no-owner`. The prelude recreates the production-equivalent wrapper and the exact skipped grants; it does not alter the archive or production database.
8. Run `scripts/nas-runtime-rehearsal-postcheck.sql` and the normalized catalog comparison (`scripts/nas-runtime-rehearsal-source-catalog.awk` plus `scripts/nas-runtime-rehearsal-catalog.sql`). The verified r3 result has anon invite SELECT `false`, service-only RPCs `4/4`, authenticated execute `0`, service-role execute `4`, account-deletion FK `SET NULL` `3`, and an exact 233-entry normalized catalog match.

This validates the database archive, data, schema, RLS, ACLs, and required Realtime runtime role. It does not validate a production cutover, Storage object binaries, Edge Function secrets, SMTP/OAuth settings, or an externally reachable Auth/Storage/Realtime service workflow.

## Retention

- Local and NAS archive copies contain production data. Keep their directories at `700` and artifacts at `600`; never add them to Git or deployment uploads.
- Retention and deletion are manual operational decisions. Do not overwrite or remove a verified archive without separate approval.

## Remaining Baseline Work

1. Decide and document the future baseline/migration-lineage strategy. Preserve the observed `20260220103000` history and manual hardening evidence; do not edit production history until the decision is separately approved.
2. If a full self-hosted application-service rehearsal is required, obtain separate approval for the NAS networking/firewall design first. The current result is intentionally limited to database recovery and ACL validation.
