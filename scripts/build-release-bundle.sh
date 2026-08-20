#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$SITE_ROOT/.release"
BUNDLE_DIR="$STATE_DIR/bundles"
HANDOFF="$STATE_DIR/release-handoff.json"
RELEASE_STATUS="candidate"

if [[ $# -gt 0 ]]; then
  if [[ "$1" != "--release-status" || -z "${2:-}" ]]; then
    echo "Usage: bash scripts/build-release-bundle.sh [--release-status candidate|source-ready]" >&2
    exit 1
  fi
  RELEASE_STATUS="$2"
  shift 2
fi

[[ $# -eq 0 ]] || {
  echo "Unexpected release bundle arguments: $*" >&2
  exit 1
}

case "$RELEASE_STATUS" in
  candidate|source-ready) ;;
  *)
    echo "Invalid release status: $RELEASE_STATUS" >&2
    exit 1
    ;;
esac

cd "$SITE_ROOT"
node scripts/build-release-manifest.mjs

RELEASE_SHA256="$(node -p 'JSON.parse(require("node:fs").readFileSync("data/site-release-manifest.json","utf8")).releaseSha256')"
SHORT_RELEASE="${RELEASE_SHA256:0:12}"
BUNDLE="$BUNDLE_DIR/tptrees-$SHORT_RELEASE.tar.gz"
WORKTREE_DIRTY="false"
if [[ -n "$(git status --porcelain=v1)" ]]; then
  WORKTREE_DIRTY="true"
fi

if [[ "$RELEASE_STATUS" == "source-ready" && "$WORKTREE_DIRTY" == "true" ]]; then
  echo "A source-ready bundle requires a clean TP Trees worktree" >&2
  exit 1
fi

if [[ "$RELEASE_STATUS" == "source-ready" ]]; then
  git rev-parse --verify github/main >/dev/null 2>&1 || {
    echo "A source-ready bundle requires a fetched github/main" >&2
    exit 1
  }
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse github/main)" ]]; then
    echo "A source-ready bundle requires HEAD to match the published github/main commit" >&2
    exit 1
  fi
fi

mkdir -p "$BUNDLE_DIR"
node scripts/build-release-archive.mjs "$BUNDLE"

for required in index.html lifecycle/index.html species/index.html daily/index.html data/site-release-manifest.json; do
  tar -tzf "$BUNDLE" | grep -qx "$required" || {
    echo "Release bundle is missing $required" >&2
    exit 1
  }
done

BUNDLE_SHA256="$(shasum -a 256 "$BUNDLE" | awk '{print $1}')"
BUNDLE_SIZE_BYTES="$(wc -c < "$BUNDLE" | tr -d ' ')"

node scripts/write-release-handoff.mjs \
  "$HANDOFF" \
  "$BUNDLE" \
  "$RELEASE_SHA256" \
  "$(git rev-parse HEAD)" \
  "$(git branch --show-current)" \
  "$WORKTREE_DIRTY" \
  "$RELEASE_STATUS" \
  "$BUNDLE_SHA256" \
  "$BUNDLE_SIZE_BYTES"

echo "Release bundle: ${BUNDLE#$SITE_ROOT/}"
echo "Release handoff: ${HANDOFF#$SITE_ROOT/}"
