# Forward Migrations

This directory is the only location for future StewardFlow database changes.
It is deliberately outside `supabase/migrations/` because that historical
directory is not a safe, linear Supabase CLI migration chain.

Each file must use a unique UTC timestamp prefix, for example
`20260825143000_add_example.sql`, and include a short header that identifies
the required verification queries.

Before an approved production application:

1. Rehearse the exact file against an isolated database restored from the
   canonical archive in `docs/migration_lineage.md`.
2. Create and verify a fresh production backup.
3. Obtain action-time approval for the target and SQL file.
4. Apply the one file with `psql` in an explicit transaction. Do not use
   `supabase db push`, migration repair, or a bulk replay.
5. Record the file SHA-256, application time, and postcheck result in
   `docs/DB_MIGRATION_STATUS.md` and `docs/EXECUTION_TRACKER.md`.

Do not move old files into this directory and do not add production data,
credentials, or dumps to Git.
