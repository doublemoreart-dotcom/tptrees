#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CSV_ARGS=()
RUN_IMAGES="false"
IMAGE_LIMIT=""
RUN_PREFLIGHT="true"
CHECK_ONLY="false"
RENDER_SOCIAL_PNG="true"
PREPARE_PUSH="false"
VERIFY_LIVE="false"
VERIFY_LIVE_ONLY="false"
LIVE_URL="https://dinopeng.com/tptrees"

usage(){
  cat <<'USAGE'
Usage:
  bash scripts/update-site-data.sh
  bash scripts/update-site-data.sh --skip-download
  bash scripts/update-site-data.sh --from /path/to/TaipeiTree.csv
  bash scripts/update-site-data.sh --with-images --image-limit 120
  bash scripts/update-site-data.sh --prepare-push
  bash scripts/update-site-data.sh --verify-live-only [URL]

Options:
  --from FILE          Use a local CSV file instead of downloading.
  --skip-download      Rebuild generated files from existing data/TaipeiTree.csv.
  --no-backup          Do not create a timestamped CSV backup.
  --with-images        Update species image sources from public APIs.
  --image-limit N      Limit species image update attempts.
  --check-only         Skip data updates and run source-repo checks only.
  --prepare-push       Run check-only mode and print source push readiness.
  --no-social-png      Do not render public/social-preview.png from SVG.
  --no-preflight       Skip release preflight checks.
  --verify-live [URL]  Verify the published site after local checks.
  --verify-live-only [URL]
                       Compare the source fingerprint with the live site only.
  -h, --help           Show this help.

Project isolation:
  This script writes only inside the TP Trees source repository. It does not
  copy to local mirrors, portal repositories, or deployment directories.
USAGE
}

die(){
  echo "Update error: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from)
      [[ -n "${2:-}" ]] || die "Missing file after --from"
      CSV_ARGS+=("--from" "$2")
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
      [[ "$IMAGE_LIMIT" =~ ^[1-9][0-9]*$ ]] || die "--image-limit must be a positive integer"
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
    --verify-live)
      VERIFY_LIVE="true"
      if [[ -n "${2:-}" && "${2:-}" != --* ]]; then
        LIVE_URL="$2"
        shift 2
      else
        shift
      fi
      ;;
    --verify-live-only)
      VERIFY_LIVE="true"
      VERIFY_LIVE_ONLY="true"
      CHECK_ONLY="true"
      RUN_PREFLIGHT="false"
      RENDER_SOCIAL_PNG="false"
      if [[ -n "${2:-}" && "${2:-}" != --* ]]; then
        LIVE_URL="$2"
        shift 2
      else
        shift
      fi
      ;;
    --no-sync-local|--local-target|--portal-target|--no-sync-portal|--require-portal)
      die "$1 was removed by the project isolation policy; build a handoff bundle with scripts/release-site.sh prepare"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      die "Unknown option: $1"
      ;;
  esac
done

cd "$SITE_ROOT"

verify_live_site(){
  local base_url="${LIVE_URL%/}"
  local temp_dir
  temp_dir="$(mktemp -d)"
  trap 'rm -rf "$temp_dir"' EXIT
  echo "Live site: $base_url"

  fetch_live(){
    local url="$1"
    local output="$2"
    local label="$3"
    if ! curl -fsSL "$url" -o "$output"; then
      echo "Live verification failed: $label is unavailable at $url" >&2
      exit 1
    fi
  }

  local route path marker_a marker_b marker_c output url marker
  local routes=(
    "/|臺北市行道樹小幫手|app/analytics.js|app/heroicons.js"
    "/lifecycle/|樹木的生命履歷|tree-records.js|查驗"
    "/species/|樹種科普|ranking-limit|台北市常見樹木排行榜"
    "/daily/|今天給我一棵樹|share-card|download-card"
  )

  for route in "${routes[@]}"; do
    IFS="|" read -r path marker_a marker_b marker_c <<< "$route"
    output="$temp_dir${path//\//_}.html"
    url="$base_url$path"
    echo "  - $url"
    fetch_live "$url" "$output" "page $path"
    for marker in "$marker_a" "$marker_b" "$marker_c"; do
      grep -q "$marker" "$output" || die "$url is missing marker '$marker'"
    done
  done

  fetch_live "$base_url/app/analytics.js" "$temp_dir/analytics.js" "analytics script"
  fetch_live "$base_url/app/heroicons.js" "$temp_dir/heroicons.js" "heroicons script"
  fetch_live "$base_url/app/motion.css" "$temp_dir/motion.css" "motion stylesheet"
  fetch_live "$base_url/app/motion.js" "$temp_dir/motion.js" "motion script"
  fetch_live "$base_url/app/vendor/gsap.min.js" "$temp_dir/gsap.min.js" "GSAP script"
  fetch_live "$base_url/app/vendor/ScrollTrigger.min.js" "$temp_dir/ScrollTrigger.min.js" "ScrollTrigger script"
  fetch_live "$base_url/favicon.svg" "$temp_dir/favicon.svg" "favicon.svg"
  fetch_live "$base_url/favicon.ico" "$temp_dir/favicon.ico" "favicon.ico"
  fetch_live "$base_url/public/social-preview.png" "$temp_dir/social-preview.png" "social preview PNG"
  fetch_live "$base_url/data/site-release-manifest.json" "$temp_dir/site-release-manifest.json" "release manifest"

  local expected_release live_release
  expected_release="$(node -p 'JSON.parse(require("node:fs").readFileSync("data/site-release-manifest.json", "utf8")).releaseSha256')"
  live_release="$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).releaseSha256' "$temp_dir/site-release-manifest.json")"
  if [[ "$expected_release" != "$live_release" ]]; then
    echo "Live verification failed: the published version differs from this source repo." >&2
    echo "  source: ${expected_release:0:12}" >&2
    echo "  live:   ${live_release:0:12}" >&2
    echo "External deployment handoff is required; this repository will not modify the portal project." >&2
    exit 1
  fi
  echo "Live verification complete: ${live_release:0:12}"
  rm -rf "$temp_dir"
  trap - EXIT
}

if [[ "$VERIFY_LIVE_ONLY" == "true" ]]; then
  node scripts/build-release-manifest.mjs
  verify_live_site
  exit 0
fi

echo "== 1/4 Generate brand assets =="
node scripts/generate-brand-assets.mjs
if [[ "$RENDER_SOCIAL_PNG" == "true" ]]; then
  bash scripts/render-social-preview-png.sh
else
  echo "Skip social preview PNG render"
fi

if [[ "$CHECK_ONLY" == "true" ]]; then
  echo ""
  echo "== 2/4 Check existing generated records =="
else
  echo ""
  echo "== 2/4 Update Taipei tree CSV and generated records =="
  if [[ "$RUN_PREFLIGHT" == "true" ]]; then
    bash scripts/update-tree-csv.sh ${CSV_ARGS[@]+"${CSV_ARGS[@]}"} --no-verify
  else
    bash scripts/update-tree-csv.sh ${CSV_ARGS[@]+"${CSV_ARGS[@]}"}
  fi
fi

echo ""
if [[ "$RUN_IMAGES" == "true" ]]; then
  echo "== 3/4 Update species image sources =="
  if [[ -n "$IMAGE_LIMIT" ]]; then
    node scripts/update-species-images.mjs "--limit=$IMAGE_LIMIT"
  else
    node scripts/update-species-images.mjs
  fi
else
  echo "== 3/4 Check species image sources =="
fi
node scripts/check-species-images.mjs

echo ""
echo "== Build release fingerprint =="
node scripts/build-release-manifest.mjs

echo ""
if [[ "$RUN_PREFLIGHT" == "true" ]]; then
  echo "== 4/4 Run source-repo preflight =="
  bash scripts/preflight-release.sh
else
  echo "== 4/4 Skip preflight =="
fi

echo ""
echo "Source update complete. No external directory was modified."
if [[ "$PREPARE_PUSH" == "true" ]]; then
  CURRENT_BRANCH="$(git branch --show-current)"
  UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
  echo "Git readiness:"
  echo "  branch: ${CURRENT_BRANCH:-unknown}"
  echo "  upstream: ${UPSTREAM:-not set}"
  echo "  github remote: $(git remote get-url github 2>/dev/null || echo "not set")"
  echo ""
  echo "Changed files:"
  git status --short
  echo ""
  echo "Diff summary:"
  git diff --stat
  echo ""
  echo "Next source-only step:"
  echo "  bash scripts/release-site.sh prepare"
fi

if [[ "$VERIFY_LIVE" == "true" ]]; then
  echo ""
  echo "== Verify published site =="
  verify_live_site
fi
