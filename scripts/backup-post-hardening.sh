#!/bin/zsh

set -euo pipefail

root_dir="$(cd -- "$(dirname -- "$0")/.." && pwd)"
backup_root="$root_dir/.local-backups/steward-flow"
timestamp="$(TZ=Asia/Seoul date '+%Y%m%d-%H%M%S-KST')"
backup_dir="$backup_root/$timestamp"
dump_path="$backup_dir/steward-flow-post-hardening-$timestamp.dump"
toc_path="$backup_dir/archive-list.txt"
schema_path="$backup_dir/schema-only.sql"
checksum_path="$backup_dir/SHA256SUMS"
manifest_path="$backup_dir/manifest.txt"

pg_dump_bin="/opt/homebrew/opt/libpq/bin/pg_dump"
pg_restore_bin="/opt/homebrew/opt/libpq/bin/pg_restore"
source_host="aws-1-ap-south-1.pooler.supabase.com"
source_port="5432"
source_user="postgres.avxlfcclupskctzhxbto"
source_database="postgres"
migration_path="$root_dir/supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql"

if [[ ! -t 0 || ! -t 1 ]]; then
  print -u2 "Run this script in an interactive terminal."
  exit 1
fi

if [[ ! -x "$pg_dump_bin" || ! -x "$pg_restore_bin" ]]; then
  print -u2 "Required PostgreSQL client binaries were not found."
  exit 1
fi

if [[ ! -f "$migration_path" ]]; then
  print -u2 "Hardening migration file was not found."
  exit 1
fi

umask 077
mkdir -p -m 700 "$backup_dir"
chmod 700 "$backup_dir"

unset PGPASSWORD PGPASSFILE
print "Creating protected post-hardening backup..."
print "PostgreSQL will request the Database Password with hidden input."
PGSSLMODE=require "$pg_dump_bin" \
  --password \
  --host="$source_host" \
  --port="$source_port" \
  --username="$source_user" \
  --dbname="$source_database" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="$dump_path"

chmod 600 "$dump_path"
"$pg_restore_bin" --list "$dump_path" > "$toc_path"
"$pg_restore_bin" --schema-only --file="$schema_path" "$dump_path"
"$pg_restore_bin" --data-only --file=/dev/null "$dump_path"
shasum -a 256 "$dump_path" > "$checksum_path"
chmod 600 "$toc_path" "$schema_path" "$checksum_path"

{
  print "created_at_kst=$(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M:%S %Z')"
  print "source_host=$source_host"
  print "source_port=$source_port"
  print "source_database=$source_database"
  print "dump_file=$(basename -- "$dump_path")"
  print "dump_bytes=$(stat -f '%z' "$dump_path")"
  print "git_head=$(git -C "$root_dir" rev-parse HEAD)"
  print "hardening_migration_sha256=$(shasum -a 256 "$migration_path" | awk '{print $1}')"
  print "pg_dump_version=$($pg_dump_bin --version)"
  print "pg_restore_version=$($pg_restore_bin --version)"
} > "$manifest_path"
chmod 600 "$manifest_path"

print "Backup verified: $backup_dir"
