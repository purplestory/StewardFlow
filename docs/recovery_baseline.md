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
- Isolated NAS verification: PostgreSQL 17.6, `profiles=6`, `organizations=2`, `auth.users=8`, public tables `35`, functions `29`, non-internal triggers `20`, policies `114`, RLS-enabled public tables `35`

## Do Not Use As A Baseline

- `supabase/schema.sql` and `supabase/rls.sql` are legacy bootstrap references. They predate the current hardening boundary and must not be run for a new environment or recovery.
- Do not replay every file in `supabase/migrations/`. The directory contains duplicate/nonstandard versions, diagnostics, and historical reset or RLS-disable scripts.
- Do not run `supabase db push`, `supabase db reset --linked`, bulk migration repair, or change production `supabase_migrations.schema_migrations` without a separate action-time approval.

## Verified DB Rehearsal

1. Create a new custom-format production archive with `scripts/backup-post-hardening.sh`; the PostgreSQL client prompts for the Database Password without echoing or storing it.
2. Verify its SHA-256, archive TOC, schema-only extraction, and data stream before transfer.
3. Transfer the archive to the NAS restricted backup directory using encrypted SSH and verify the checksum again.
4. Restore only into a new isolated Supabase PostgreSQL database with `supabase_admin`, `--exit-on-error`, and `--no-owner`.
5. A DB-only target lacks the Realtime runtime role `supabase_realtime_admin`; a privilege-inclusive restore currently stops at that missing role. For DB-level rehearsal, use `--no-privileges` and then reapply the idempotent hardening migration before security verification.
6. Run the RLS, anon invite, service-only RPC, and account-deletion FK postcheck. The verified post-hardening rehearsal passed these checks after the migration reapply.

This validates the database archive, data, schema, and hardening recovery path. It does not validate a production cutover or recreate Storage object binaries, Edge Function secrets, SMTP/OAuth settings, or Realtime runtime roles.

## Retention

- Local and NAS archive copies contain production data. Keep their directories at `700` and artifacts at `600`; never add them to Git or deployment uploads.
- Retention and deletion are manual operational decisions. Do not overwrite or remove a verified archive without separate approval.

## Remaining Baseline Work

1. Build a normalized source-vs-restored catalog comparison from the current snapshot before selecting a canonical schema artifact.
2. Define a full self-hosted Supabase stack that initializes every required runtime role before testing ACL-inclusive restoration.
3. Decide and document the future baseline/migration-lineage strategy. Preserve the observed `20260220103000` history and manual hardening evidence; do not edit production history until the decision is separately approved.
