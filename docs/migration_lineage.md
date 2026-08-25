# Migration Lineage

Last updated: 2026-08-25

## Decision

StewardFlow uses an archive-backed canonical baseline, not an executable SQL
squash migration. The authoritative starting point is the verified
post-hardening production archive identified below. This avoids treating the
historical `supabase/migrations/` directory as a linear Supabase CLI history:
that directory contains duplicate, diagnostic, and RLS-disable scripts in
addition to legitimate historical changes.

This decision does not change production schema metadata. Production continues
to report the observed history entry
`20260220103000_bootstrap_books_schema`; the hardening revision remains
separately recorded as manually applied evidence.

## Canonical Baseline Evidence

| Item | Value |
| --- | --- |
| Baseline ID | `production-archive-20260825-100124-kst` |
| Archive format | PostgreSQL custom-format archive |
| Archive SHA-256 | `2a059ae35067385e868ed17e66c6581996f4364f3d61dba0a5d34db920d18d6c` |
| Archive TOC entries | `1,128` |
| Observed production history | `20260220103000_bootstrap_books_schema` only |
| Manual hardening revision | `20260824090000_harden_tenant_rls_boundaries.sql` |
| Hardening file SHA-256 | `7c63ff760df5e3d0c4464ea9a775efe32efc8c40d1cee91d1fe9058bed53871e` |
| Verified restore | NAS staged ACL-inclusive r3 restore with PostgreSQL 17.6 and Realtime 2.102.3 |
| Schema inventory | 233 normalized public table/function/policy/RLS/trigger entries |
| Inventory SHA-256 | `ad48c3ceaf1d3c01b1140a89bbab6ca1578ac4d87a71af20d910752e01b133e5` |

The archive itself remains in restricted local and NAS backup storage and is
never committed to Git. `scripts/verify-production-baseline.sh` verifies a
candidate archive, schema-only extraction, hardening file, and optionally a
restored catalog against these fixed values.

## Operating Rules

1. **Recovery and isolated rehearsal:** use the staged archive procedure in
   `docs/recovery_baseline.md`. A successful target must pass the postcheck and
   the 233-entry normalized catalog comparison before it is treated as a
   recovery candidate.
2. **Production history:** do not run `supabase db push`, `supabase db reset
   --linked`, `supabase migration repair`, or modify
   `supabase_migrations.schema_migrations`. The old local migration pile is
   evidence only, not a deployable chain.
3. **Future database changes:** create one reviewed, forward-only SQL file in
   `supabase/forward-migrations/` with a unique UTC timestamp prefix. Rehearse
   that exact file against an isolated restored baseline, take a fresh
   production backup, obtain action-time approval, and apply only that file
   with `psql` in a transaction. Record its SHA-256, application time, and
   postcheck result in `docs/DB_MIGRATION_STATUS.md` and
   `docs/EXECUTION_TRACKER.md`.
4. **A clean new hosted project:** is a separate data-migration/cutover
   project. It must not be initialized by replaying the legacy migration pile
   or by copying production migration history metadata. Its exact import and
   Auth/Storage/OAuth cutover plan require separate approval.

## Why There Is No Squash SQL Today

The proven artifact is a custom archive that includes the production schema,
data, RLS, ACLs, and Supabase extension state. An SQL-only squash would need a
separate clean-environment build and end-to-end validation of Supabase runtime
roles, Storage, Auth, Edge Functions, SMTP, and OAuth. Creating one from the
historical scripts would not be equivalent to the verified production state.

This archive-backed strategy closes the recovery-baseline decision without
claiming that the current data-bearing archive is a generic empty-project
installer.
