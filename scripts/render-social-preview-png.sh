#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SOURCE="$SITE_ROOT/public/social-preview.svg"
TARGET="$SITE_ROOT/public/social-preview.png"
SOURCE_REL="public/social-preview.svg"
TARGET_REL="public/social-preview.png"

if [[ ! -x "$CHROME" ]]; then
  echo "Google Chrome not found at: $CHROME" >&2
  exit 1
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing source SVG: $SOURCE" >&2
  exit 1
fi

if [[ -f "$TARGET" ]]; then
  if git -C "$SITE_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git -C "$SITE_ROOT" rev-parse --verify HEAD >/dev/null 2>&1 \
      && git -C "$SITE_ROOT" ls-files --error-unmatch -- "$SOURCE_REL" >/dev/null 2>&1 \
      && git -C "$SITE_ROOT" ls-files --error-unmatch -- "$TARGET_REL" >/dev/null 2>&1 \
      && git -C "$SITE_ROOT" diff --quiet HEAD -- "$SOURCE_REL"; then
      echo "Unchanged public/social-preview.png (tracked SVG matches HEAD)"
      exit 0
    fi
  elif [[ "$TARGET" -nt "$SOURCE" ]]; then
    echo "Unchanged public/social-preview.png"
    exit 0
  fi
fi

"$CHROME" \
  --headless=new \
  --disable-gpu \
  --screenshot="$TARGET" \
  --window-size=1200,630 \
  "file://$SOURCE"

echo "Rendered public/social-preview.png"
