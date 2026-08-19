#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$SITE_ROOT/.release"
LIVE_URL="https://dinopeng.com/tptrees"
COMMAND="${1:-status}"
CONFIRM="false"
VERIFY_AFTER="false"
MESSAGE="Update TP Trees site"
ATTEMPTS=12
WAIT_SECONDS=15
UPDATE_ARGS=()

if [[ $# -gt 0 ]]; then
  shift
fi

usage(){
  cat <<'USAGE'
Usage:
  bash scripts/release-site.sh status
  bash scripts/release-site.sh refresh [update-site-data options]
  bash scripts/release-site.sh prepare
  bash scripts/release-site.sh publish --message "Describe update" --confirm
  bash scripts/release-site.sh verify [--attempts 12] [--wait 15]
  bash scripts/release-site.sh rollback --confirm

Commands:
  status    Show source branch, remote divergence, and release fingerprint.
  refresh   Update data/assets and run all source-repo checks.
  prepare   Validate source and build an isolated deployment handoff bundle.
  publish   Commit and push doublemoreart-dotcom/tptrees only.
  verify    Read the live site and compare its release fingerprint.
  rollback  Revert the last scripted TP Trees source publish only.

Isolation:
  No command writes to a local mirror, portal repository, Pages settings,
  workflow, domain, or deployment directory. Cross-project deployment must be
  handled by a coordinating session using the generated handoff bundle.
USAGE
}

die(){
  echo "Release error: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --confirm)
      CONFIRM="true"
      shift
      ;;
    --verify)
      VERIFY_AFTER="true"
      shift
      ;;
    --message)
      MESSAGE="${2:-}"
      [[ -n "$MESSAGE" ]] || die "Missing text after --message"
      shift 2
      ;;
    --attempts)
      ATTEMPTS="${2:-}"
      [[ "$ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || die "--attempts must be a positive integer"
      shift 2
      ;;
    --wait)
      WAIT_SECONDS="${2:-}"
      [[ "$WAIT_SECONDS" =~ ^[0-9]+$ ]] || die "--wait must be a non-negative integer"
      shift 2
      ;;
    --live-url)
      LIVE_URL="${2:-}"
      [[ -n "$LIVE_URL" ]] || die "Missing URL after --live-url"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      UPDATE_ARGS+=("$1")
      shift
      ;;
  esac
done

case "$COMMAND" in
  status|refresh|prepare|publish|verify|rollback) ;;
  *)
    usage
    die "Unknown command: $COMMAND"
    ;;
esac

cd "$SITE_ROOT"

release_fingerprint(){
  local manifest="$SITE_ROOT/data/site-release-manifest.json"
  if [[ ! -f "$manifest" ]]; then
    printf 'missing'
    return 0
  fi
  node -e 'const fs=require("node:fs");const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(value.releaseSha256||"invalid")' "$manifest"
}

write_state(){
  local file="$1"
  shift
  mkdir -p "$STATE_DIR"
  : > "$file"
  while [[ $# -gt 0 ]]; do
    printf '%s=%q\n' "$1" "$2" >> "$file"
    shift 2
  done
  chmod 600 "$file"
}

require_clean_repo(){
  if [[ -n "$(git status --porcelain=v1)" ]]; then
    git status --short >&2
    die "TP Trees source repo has uncommitted changes"
  fi
}

require_cached_remote_base(){
  git rev-parse --verify github/main >/dev/null 2>&1 || die "Cached github/main is unavailable; fetch the TP Trees source repo first"
  git merge-base --is-ancestor github/main HEAD || die "Source is behind cached github/main; integrate the remote source change before preparing a release"
}

show_status(){
  local head branch dirty release remote_head counts behind ahead
  head="$(git rev-parse --short HEAD)"
  branch="$(git branch --show-current)"
  dirty="$(git status --porcelain=v1 | wc -l | tr -d ' ')"
  release="$(release_fingerprint)"
  remote_head="$(git rev-parse --short github/main 2>/dev/null || echo unavailable)"
  counts="$(git rev-list --left-right --count HEAD...github/main 2>/dev/null || echo '0 0')"
  ahead="$(printf '%s' "$counts" | awk '{print $1}')"
  behind="$(printf '%s' "$counts" | awk '{print $2}')"

  echo "TP Trees source status"
  echo "  scope: doublemoreart-dotcom/tptrees only"
  echo "  source: ${branch:-detached}@$head"
  echo "  cached remote: github/main@$remote_head"
  echo "  divergence: ahead $ahead, behind $behind"
  echo "  release: ${release:0:12}"
  echo "  uncommitted paths: $dirty"
  if [[ -f "$STATE_DIR/release-handoff.json" ]]; then
    echo "  handoff: .release/release-handoff.json"
  else
    echo "  handoff: not prepared"
  fi
  echo "  external writes: disabled"
}

prepare_release(){
  require_cached_remote_base
  bash scripts/update-site-data.sh --prepare-push ${UPDATE_ARGS[@]+"${UPDATE_ARGS[@]}"}
  bash scripts/build-release-bundle.sh

  local release bundle
  release="$(release_fingerprint)"
  bundle="$(node -p 'JSON.parse(require("node:fs").readFileSync(".release/release-handoff.json","utf8")).bundle')"
  write_state "$STATE_DIR/last-prepare.env" \
    CREATED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    SOURCE_BASE "$(git rev-parse HEAD)" \
    SOURCE_BRANCH "$(git branch --show-current)" \
    RELEASE_SHA256 "$release" \
    BUNDLE "$bundle"
  echo "Prepared source-only release handoff: $bundle"
  echo "Required external action: sync this bundle to doublemoreart-dotcom/aidata-portal tptrees/ in a coordinating session."
}

verify_release(){
  local attempt
  for ((attempt=1; attempt<=ATTEMPTS; attempt++)); do
    echo "Live verification attempt $attempt/$ATTEMPTS"
    if bash scripts/update-site-data.sh --verify-live-only "$LIVE_URL"; then
      return 0
    fi
    if (( attempt < ATTEMPTS )); then
      echo "Live deployment is not current; retrying in ${WAIT_SECONDS}s."
      sleep "$WAIT_SECONDS"
    fi
  done
  die "Live site did not match after $ATTEMPTS attempts"
}

publish_release(){
  [[ "$CONFIRM" == "true" ]] || die "publish requires --confirm"
  git fetch github main
  [[ "$(git rev-parse HEAD)" == "$(git rev-parse github/main)" ]] || die "Source HEAD is not current with github/main; integrate the remote change before publishing"

  prepare_release
  local source_before release branch
  source_before="$(git rev-parse HEAD)"
  release="$(release_fingerprint)"
  branch="$(git branch --show-current)"
  [[ -n "$branch" ]] || die "Source repo is in detached HEAD state"

  git add --all
  if ! git diff --cached --quiet; then
    git commit -m "$MESSAGE"
  fi
  local source_published
  source_published="$(git rev-parse HEAD)"
  require_clean_repo
  bash scripts/build-release-bundle.sh

  local bundle
  bundle="$(node -p 'JSON.parse(require("node:fs").readFileSync(".release/release-handoff.json","utf8")).artifact.bundle')"

  write_state "$STATE_DIR/pending-publish.env" \
    CREATED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    SOURCE_BEFORE "$source_before" \
    SOURCE_PUBLISHED "$source_published" \
    SOURCE_BRANCH "$branch" \
    RELEASE_SHA256 "$release" \
    BUNDLE "$bundle"

  git push github "$branch:main"
  cp "$STATE_DIR/pending-publish.env" "$STATE_DIR/last-publish.env"
  rm "$STATE_DIR/pending-publish.env"
  echo "Published TP Trees source ${source_published:0:12}."
  echo "External deployment was not modified. A coordinating session must process .release/release-handoff.json."
  [[ "$VERIFY_AFTER" == "false" ]] || verify_release
}

rollback_release(){
  [[ "$CONFIRM" == "true" ]] || die "rollback requires --confirm"
  local state="$STATE_DIR/last-publish.env"
  [[ -f "$state" ]] || die "No scripted TP Trees publish state found"
  # shellcheck disable=SC1090
  source "$state"
  require_clean_repo
  git fetch github main
  [[ "$(git rev-parse HEAD)" == "$SOURCE_PUBLISHED" ]] || die "Source HEAD changed since the saved publish; review manually"
  [[ "$(git rev-parse github/main)" == "$SOURCE_PUBLISHED" ]] || die "Remote source changed since the saved publish; review manually"

  git revert --no-commit "$SOURCE_PUBLISHED"
  node scripts/build-release-manifest.mjs
  bash scripts/preflight-release.sh
  git add --all
  git commit -m "Revert TP Trees release ${SOURCE_PUBLISHED:0:12}"
  local rollback_commit
  rollback_commit="$(git rev-parse HEAD)"
  bash scripts/build-release-bundle.sh
  git push github "$(git branch --show-current):main"
  write_state "$STATE_DIR/last-rollback.env" \
    CREATED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    SOURCE_REVERTED "$SOURCE_PUBLISHED" \
    SOURCE_ROLLBACK "$rollback_commit"
  echo "TP Trees source rollback published without rewriting history."
  echo "External deployment remains unchanged and requires a coordinating session."
  [[ "$VERIFY_AFTER" == "false" ]] || verify_release
}

case "$COMMAND" in
  status)
    show_status
    ;;
  refresh)
    bash scripts/update-site-data.sh ${UPDATE_ARGS[@]+"${UPDATE_ARGS[@]}"}
    echo "Refresh complete. Run: bash scripts/release-site.sh prepare"
    ;;
  prepare)
    prepare_release
    ;;
  publish)
    publish_release
    ;;
  verify)
    verify_release
    ;;
  rollback)
    rollback_release
    ;;
esac
