#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ARCHIVE_SHA256="2a059ae35067385e868ed17e66c6581996f4364f3d61dba0a5d34db920d18d6c"
EXPECTED_HARDENING_SHA256="7c63ff760df5e3d0c4464ea9a775efe32efc8c40d1cee91d1fe9058bed53871e"
EXPECTED_CATALOG_SHA256="ad48c3ceaf1d3c01b1140a89bbab6ca1578ac4d87a71af20d910752e01b133e5"
EXPECTED_CATALOG_ENTRIES=233

usage() {
  cat <<'EOF'
Usage:
  scripts/verify-production-baseline.sh \
    --archive /path/to/steward-flow-post-hardening.dump \
    --schema /path/to/schema-only.sql \
    [--catalog /path/to/restored-catalog.txt]

The optional catalog file must be the output of
scripts/nas-runtime-rehearsal-catalog.sql against the restored target.
EOF
}

archive=""
schema=""
catalog=""

while (($# > 0)); do
  case "$1" in
    --archive)
      archive="${2:-}"
      shift 2
      ;;
    --schema)
      schema="${2:-}"
      shift 2
      ;;
    --catalog)
      catalog="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$archive" || -z "$schema" ]]; then
  usage >&2
  exit 2
fi

for input in "$archive" "$schema"; do
  if [[ ! -f "$input" ]]; then
    echo "Missing file: $input" >&2
    exit 2
  fi
done

if [[ -n "$catalog" && ! -f "$catalog" ]]; then
  echo "Missing file: $catalog" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hardening_file="$repo_root/supabase/migrations/20260824090000_harden_tenant_rls_boundaries.sql"
source_catalog_parser="$repo_root/scripts/nas-runtime-rehearsal-source-catalog.awk"

for input in "$hardening_file" "$source_catalog_parser"; do
  if [[ ! -f "$input" ]]; then
    echo "Required repository file is missing: $input" >&2
    exit 2
  fi
done

sha256() {
  shasum -a 256 "$1" | awk '{print $1}'
}

archive_hash="$(sha256 "$archive")"
hardening_hash="$(sha256 "$hardening_file")"

if [[ "$archive_hash" != "$EXPECTED_ARCHIVE_SHA256" ]]; then
  echo "Archive SHA-256 mismatch: $archive_hash" >&2
  exit 1
fi

if [[ "$hardening_hash" != "$EXPECTED_HARDENING_SHA256" ]]; then
  echo "Hardening SHA-256 mismatch: $hardening_hash" >&2
  exit 1
fi

source_inventory="$(mktemp "${TMPDIR:-/tmp}/steward-flow-source-catalog.XXXXXX")"
target_inventory=""
cleanup() {
  rm -f "$source_inventory"
  if [[ -n "$target_inventory" ]]; then
    rm -f "$target_inventory"
  fi
}
trap cleanup EXIT

awk -f "$source_catalog_parser" "$schema" | LC_ALL=C sort > "$source_inventory"
source_entries="$(wc -l < "$source_inventory" | tr -d '[:space:]')"
source_hash="$(sha256 "$source_inventory")"

if [[ "$source_entries" != "$EXPECTED_CATALOG_ENTRIES" ]]; then
  echo "Source catalog entry count mismatch: $source_entries" >&2
  exit 1
fi

if [[ "$source_hash" != "$EXPECTED_CATALOG_SHA256" ]]; then
  echo "Source catalog SHA-256 mismatch: $source_hash" >&2
  exit 1
fi

echo "Archive SHA-256: verified"
echo "Hardening migration SHA-256: verified"
echo "Source catalog: $source_entries entries, verified"

if [[ -n "$catalog" ]]; then
  target_inventory="$(mktemp "${TMPDIR:-/tmp}/steward-flow-target-catalog.XXXXXX")"
  LC_ALL=C sort "$catalog" > "$target_inventory"
  target_hash="$(sha256 "$target_inventory")"

  if [[ "$target_hash" != "$EXPECTED_CATALOG_SHA256" ]]; then
    echo "Restored catalog SHA-256 mismatch: $target_hash" >&2
    exit 1
  fi

  if ! cmp -s "$source_inventory" "$target_inventory"; then
    echo "Restored catalog differs from source catalog" >&2
    exit 1
  fi

  echo "Restored catalog: exact source match, verified"
fi
