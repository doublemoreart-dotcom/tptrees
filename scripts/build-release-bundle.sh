#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$SITE_ROOT/.release"
BUNDLE_DIR="$STATE_DIR/bundles"
HANDOFF="$STATE_DIR/release-handoff.json"

cd "$SITE_ROOT"
node scripts/build-release-manifest.mjs

RELEASE_SHA256="$(node -p 'JSON.parse(require("node:fs").readFileSync("data/site-release-manifest.json","utf8")).releaseSha256')"
SHORT_RELEASE="${RELEASE_SHA256:0:12}"
BUNDLE="$BUNDLE_DIR/tptrees-$SHORT_RELEASE.tar.gz"
WORKTREE_DIRTY="false"
if [[ -n "$(git status --porcelain=v1)" ]]; then
  WORKTREE_DIRTY="true"
fi

mkdir -p "$BUNDLE_DIR"
tar -czf "$BUNDLE" \
  --exclude='data/backups' \
  index.html favicon.svg favicon.ico app daily data lifecycle public species

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
  "$BUNDLE_SHA256" \
  "$BUNDLE_SIZE_BYTES"

echo "Release bundle: ${BUNDLE#$SITE_ROOT/}"
echo "Release handoff: ${HANDOFF#$SITE_ROOT/}"
