#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_ROOT="$(cd "$SITE_ROOT/../.." && pwd)"
LOCAL_TARGET_DEFAULT="$WORKSPACE_ROOT/outputs/local-tptrees"

CSV_ARGS=()
RUN_IMAGES="false"
IMAGE_LIMIT=""
RUN_PREFLIGHT="true"
SYNC_LOCAL="true"
CHECK_ONLY="false"
LOCAL_TARGET="$LOCAL_TARGET_DEFAULT"

usage(){
  cat <<'USAGE'
Usage:
  bash scripts/update-site-data.sh
  bash scripts/update-site-data.sh --skip-download
  bash scripts/update-site-data.sh --from /path/to/TaipeiTree.csv
  bash scripts/update-site-data.sh --with-images --image-limit 120

Options:
  --from FILE          Use a local CSV file instead of downloading.
  --skip-download     Rebuild generated files from existing data/TaipeiTree.csv.
  --no-backup         Do not create a timestamped CSV backup.
  --with-images       Update species image sources from public APIs.
  --image-limit N     Limit species image update attempts.
  --check-only        Skip data updates and run checks / local sync only.
  --no-preflight      Skip release preflight checks.
  --no-sync-local     Do not copy files to outputs/local-tptrees.
  --local-target DIR  Copy the test mirror to another directory.
  -h, --help          Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      CSV_ARGS+=("--from" "${2:-}")
      shift 2
      ;;
    --skip-download|--no-backup)
      CSV_ARGS+=("$1")
      shift
      ;;
    --with-images)
      RUN_IMAGES="true"
      shift
      ;;
    --image-limit)
      IMAGE_LIMIT="${2:-}"
      if [[ -z "$IMAGE_LIMIT" ]]; then
        echo "Missing number after --image-limit" >&2
        exit 1
      fi
      shift 2
      ;;
    --check-only)
      CHECK_ONLY="true"
      shift
      ;;
    --no-preflight)
      RUN_PREFLIGHT="false"
      shift
      ;;
    --no-sync-local)
      SYNC_LOCAL="false"
      shift
      ;;
    --local-target)
      LOCAL_TARGET="${2:-}"
      if [[ -z "$LOCAL_TARGET" ]]; then
        echo "Missing directory after --local-target" >&2
        exit 1
      fi
      shift 2
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

cd "$SITE_ROOT"

echo "== 0/4 Generate brand assets =="
node scripts/generate-brand-assets.mjs
echo ""

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo "== 1/4 Check existing generated records =="
else
  echo "== 1/4 Update Taipei tree CSV and generated records =="
  if [[ "$RUN_PREFLIGHT" == "true" ]]; then
    bash scripts/update-tree-csv.sh "${CSV_ARGS[@]}" --no-verify
  else
    bash scripts/update-tree-csv.sh "${CSV_ARGS[@]}"
  fi
fi

if [[ "$RUN_IMAGES" == "true" ]]; then
  echo ""
  echo "== 2/4 Update species image sources =="
  if [[ -n "$IMAGE_LIMIT" ]]; then
    node scripts/update-species-images.mjs "--limit=$IMAGE_LIMIT"
  else
    node scripts/update-species-images.mjs
  fi
  node scripts/check-species-images.mjs
else
  echo ""
  echo "== 2/4 Skip species image source update =="
  node scripts/check-species-images.mjs
fi

if [[ "$RUN_PREFLIGHT" == "true" ]]; then
  echo ""
  echo "== 3/4 Run preflight =="
  bash scripts/preflight-release.sh
else
  echo ""
  echo "== 3/4 Skip preflight =="
fi

if [[ "$SYNC_LOCAL" == "true" ]]; then
  echo ""
  echo "== 4/4 Sync local test mirror =="
  mkdir -p "$LOCAL_TARGET"
  for entry in index.html favicon.svg app daily data docs lifecycle public scripts species tests README.md AGENTS.md .gitignore; do
    if [[ -e "$SITE_ROOT/$entry" ]]; then
      cp -R "$SITE_ROOT/$entry" "$LOCAL_TARGET/"
    fi
  done
  echo "Local mirror: $LOCAL_TARGET"
  echo "Verify local mirror:"
  (cd "$LOCAL_TARGET" && node scripts/verify-static-pages.mjs)
else
  echo ""
  echo "== 4/4 Skip local test mirror sync =="
fi

echo ""
echo "Update flow complete."
echo "Review before commit / push:"
echo "  git status --short"
echo "  git diff --stat"
