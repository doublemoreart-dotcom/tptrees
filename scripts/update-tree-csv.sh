#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$SITE_ROOT/data"
BACKUP_DIR="$DATA_DIR/backups"
CSV_URL="${TAIPEI_TREE_CSV_URL:-https://tppkl.blob.core.windows.net/blobfs/TaipeiTree.csv}"
CSV_PATH="$DATA_DIR/TaipeiTree.csv"
MODE="download"
LOCAL_SOURCE=""
SKIP_BACKUP="false"
RUN_VERIFY="true"

usage(){
  cat <<'USAGE'
Usage:
  bash scripts/update-tree-csv.sh
  bash scripts/update-tree-csv.sh --from /path/to/TaipeiTree.csv
  bash scripts/update-tree-csv.sh --skip-download

Options:
  --from FILE       Use a local CSV file instead of downloading.
  --skip-download  Rebuild generated files from the existing data/TaipeiTree.csv.
  --no-backup      Do not create a timestamped backup before replacing CSV.
  --no-verify      Rebuild data only; skip page and route verification.
  -h, --help       Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      MODE="local"
      LOCAL_SOURCE="${2:-}"
      if [[ -z "$LOCAL_SOURCE" ]]; then
        echo "Missing file after --from" >&2
        exit 1
      fi
      shift 2
      ;;
    --skip-download)
      MODE="skip"
      shift
      ;;
    --no-backup)
      SKIP_BACKUP="true"
      shift
      ;;
    --no-verify)
      RUN_VERIFY="false"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

mkdir -p "$DATA_DIR" "$BACKUP_DIR"

backup_existing_csv(){
  if [[ "$SKIP_BACKUP" == "true" || ! -s "$CSV_PATH" ]]; then
    return
  fi
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  cp "$CSV_PATH" "$BACKUP_DIR/TaipeiTree-$stamp.csv"
  echo "Backup created: $BACKUP_DIR/TaipeiTree-$stamp.csv"
}

install_csv(){
  local source_path="$1"
  local bytes
  bytes="$(wc -c < "$source_path" | tr -d ' ')"
  if [[ "$bytes" -lt 1000000 ]]; then
    echo "CSV looks too small: ${bytes} bytes" >&2
    exit 1
  fi
  backup_existing_csv
  cp "$source_path" "$CSV_PATH"
}

if [[ "$MODE" == "download" ]]; then
  tmp_csv="$(mktemp "${TMPDIR:-/tmp}/taipei-tree.XXXXXX.csv")"
  echo "Downloading official Taipei street tree CSV..."
  curl -L --fail --retry 3 --retry-delay 2 "$CSV_URL" -o "$tmp_csv"
  install_csv "$tmp_csv"
  rm -f "$tmp_csv"
elif [[ "$MODE" == "local" ]]; then
  if [[ ! -s "$LOCAL_SOURCE" ]]; then
    echo "Local CSV not found or empty: $LOCAL_SOURCE" >&2
    exit 1
  fi
  echo "Using local CSV: $LOCAL_SOURCE"
  install_csv "$LOCAL_SOURCE"
else
  if [[ ! -s "$CSV_PATH" ]]; then
    echo "Existing CSV not found: $CSV_PATH" >&2
    exit 1
  fi
  echo "Rebuilding from existing CSV: $CSV_PATH"
fi

echo "Building data manifest and static records..."
node "$SCRIPT_DIR/build-tree-manifest.mjs"

if [[ "$RUN_VERIFY" == "true" ]]; then
  echo "Verifying static pages..."
  node "$SCRIPT_DIR/verify-static-pages.mjs"

  if [[ -f "$SITE_ROOT/tests/routes.test.mjs" ]]; then
    echo "Running route and manifest tests..."
    node --test "$SITE_ROOT/tests/routes.test.mjs"
  fi
else
  echo "Skipping verification. Run: bash scripts/preflight-release.sh"
fi

echo "Done."
echo "CSV: $CSV_PATH"
echo "Manifest: $DATA_DIR/tree-data-manifest.json"
echo "Static records: $DATA_DIR/tree-records.js"
echo ""
echo "Next:"
echo "  bash scripts/preflight-release.sh"
echo "  git diff --stat"
