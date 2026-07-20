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
RENDER_SOCIAL_PNG="true"
PREPARE_PUSH="false"
LOCAL_TARGET="$LOCAL_TARGET_DEFAULT"
VERIFY_LIVE="false"
LIVE_URL="https://dinopeng.com/tptrees"
PORTAL_TARGET="${TPTREES_PORTAL_TARGET:-}"

PUBLISH_ENTRIES=(
  index.html
  favicon.svg
  favicon.ico
  app
  daily
  data
  docs
  lifecycle
  public
  scripts
  species
  tests
  README.md
  AGENTS.md
  .gitignore
)

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
  --prepare-push      Run check-only mode and print git push readiness summary.
  --no-social-png     Do not render public/social-preview.png from SVG.
  --no-preflight      Skip release preflight checks.
  --no-sync-local     Do not copy files to outputs/local-tptrees.
  --local-target DIR  Copy the test mirror to another directory.
  --portal-target DIR Also copy the publish bundle to a portal repo /tptrees directory.
  --verify-live [URL] Verify the published site after push.
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
    --prepare-push)
      CHECK_ONLY="true"
      PREPARE_PUSH="true"
      shift
      ;;
    --no-social-png)
      RENDER_SOCIAL_PNG="false"
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
    --portal-target)
      PORTAL_TARGET="${2:-}"
      if [[ -z "$PORTAL_TARGET" ]]; then
        echo "Missing directory after --portal-target" >&2
        exit 1
      fi
      shift 2
      ;;
    --verify-live)
      VERIFY_LIVE="true"
      if [[ "${2:-}" != "" && "${2:-}" != --* ]]; then
        LIVE_URL="$2"
        shift 2
      else
        shift
      fi
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

copy_publish_entries(){
  local target="$1"
  local label="$2"
  mkdir -p "$target"
  for entry in "${PUBLISH_ENTRIES[@]}"; do
    if [[ -e "$SITE_ROOT/$entry" ]]; then
      cp -R "$SITE_ROOT/$entry" "$target/"
    fi
  done
  echo "$label: $target"
}

verify_live_site(){
  local base_url="${LIVE_URL%/}"
  local temp_dir
  temp_dir="$(mktemp -d)"
  echo "Live site: $base_url"

  fetch_live(){
    local url="$1"
    local output="$2"
    local label="$3"
    if ! curl -fsSL "$url" -o "$output"; then
      echo "Live verification failed: $label is not available at $url" >&2
      echo "This usually means the page HTML was deployed but this asset/path was not copied to the published site." >&2
      exit 1
    fi
  }

  declare -a routes=(
    "/|臺北市行道樹小幫手|app/analytics.js|app/heroicons.js"
    "/lifecycle/|樹木的生命履歷|tree-records.js|查驗"
    "/species/|樹種科普|species-image-sources.js|台北市常見樹木排行榜"
    "/daily/|今天給我一棵樹|share-card|download-card"
  )

  for route in "${routes[@]}"; do
    IFS="|" read -r path marker_a marker_b marker_c <<< "$route"
    local output="$temp_dir${path//\//_}.html"
    local url="$base_url$path"
    echo "  - $url"
    fetch_live "$url" "$output" "page $path"
    for marker in "$marker_a" "$marker_b" "$marker_c"; do
      if ! grep -q "$marker" "$output"; then
        echo "Live verification failed: $url missing marker '$marker'" >&2
        exit 1
      fi
    done
  done

  fetch_live "$base_url/app/analytics.js" "$temp_dir/analytics.js" "analytics script"
  fetch_live "$base_url/app/heroicons.js" "$temp_dir/heroicons.js" "heroicons script"
  fetch_live "$base_url/favicon.svg" "$temp_dir/favicon.svg" "favicon.svg"
  fetch_live "$base_url/favicon.ico" "$temp_dir/favicon.ico" "favicon.ico"
  fetch_live "$base_url/public/social-preview.png" "$temp_dir/social-preview.png" "social preview PNG"
  echo "Live verification complete."
}

echo "== 1/5 Generate brand assets =="
node scripts/generate-brand-assets.mjs
if [[ "$RENDER_SOCIAL_PNG" == "true" ]]; then
  bash scripts/render-social-preview-png.sh
else
  echo "Skip social preview PNG render"
fi
echo ""

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo "== 2/5 Check existing generated records =="
else
  echo "== 2/5 Update Taipei tree CSV and generated records =="
  if [[ "$RUN_PREFLIGHT" == "true" ]]; then
    bash scripts/update-tree-csv.sh "${CSV_ARGS[@]}" --no-verify
  else
    bash scripts/update-tree-csv.sh "${CSV_ARGS[@]}"
  fi
fi

if [[ "$RUN_IMAGES" == "true" ]]; then
  echo ""
  echo "== 3/5 Update species image sources =="
  if [[ -n "$IMAGE_LIMIT" ]]; then
    node scripts/update-species-images.mjs "--limit=$IMAGE_LIMIT"
  else
    node scripts/update-species-images.mjs
  fi
  node scripts/check-species-images.mjs
else
  echo ""
  echo "== 3/5 Skip species image source update =="
  node scripts/check-species-images.mjs
fi

if [[ "$RUN_PREFLIGHT" == "true" ]]; then
  echo ""
  echo "== 4/5 Run preflight =="
  bash scripts/preflight-release.sh
else
  echo ""
  echo "== 4/5 Skip preflight =="
fi

if [[ "$SYNC_LOCAL" == "true" ]]; then
  echo ""
  echo "== 5/5 Sync local test mirror =="
  copy_publish_entries "$LOCAL_TARGET" "Local mirror"
  echo "Verify local mirror:"
  (cd "$LOCAL_TARGET" && node scripts/verify-static-pages.mjs)
else
  echo ""
  echo "== 5/5 Skip local test mirror sync =="
fi

if [[ -n "$PORTAL_TARGET" ]]; then
  echo ""
  echo "== Sync portal publish directory =="
  copy_publish_entries "$PORTAL_TARGET" "Portal target"
  echo "Verify portal target:"
  (cd "$PORTAL_TARGET" && node scripts/verify-static-pages.mjs)
fi

echo ""
echo "Update flow complete."
if [[ "$PREPARE_PUSH" == "true" ]]; then
  CURRENT_BRANCH="$(git branch --show-current)"
  UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  echo "Git push readiness:"
  echo "  branch: ${CURRENT_BRANCH:-unknown}"
  echo "  upstream: ${UPSTREAM:-not set}"
  echo "  github remote: $(git remote get-url github 2>/dev/null || echo "not set")"
  if [[ -n "$PORTAL_TARGET" ]]; then
    echo "  portal target: $PORTAL_TARGET"
  else
    echo "  portal target: not set"
  fi
  echo ""
  echo "Changed files:"
  git status --short
  echo ""
  echo "Diff summary:"
  git diff --stat
  echo ""
  echo "Next commands:"
  echo "  git add <files>"
  echo "  git commit -m \"Describe update\""
  if [[ -n "$CURRENT_BRANCH" ]]; then
    echo "  git push github $CURRENT_BRANCH:main"
  else
    echo "  git push github <branch>:main"
  fi
  if [[ -z "$PORTAL_TARGET" ]]; then
    echo ""
    echo "If this update changes visible pages or assets, also sync the portal repo /tptrees directory."
    echo "Use --portal-target /path/to/dinopeng-com/tptrees when that repo is available."
  fi
else
  echo "Review before commit / push:"
  echo "  git status --short"
  echo "  git diff --stat"
fi

if [[ "$VERIFY_LIVE" == "true" ]]; then
  echo ""
  echo "== Verify published site =="
  verify_live_site
fi
