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
PUBLIC_RELEASE_PATHS=(index.html favicon.svg favicon.ico app daily data lifecycle public species)
SOURCE_PUBLISH_PATH_COUNT=3
SOURCE_PUBLISH_PATHS=(
  docs/PROJECT_BASELINE.md
  scripts/release-site.sh
  tests/release-site-integration.test.mjs
)

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
  rollback  Restore the public site tree from before the last scripted publish.

Isolation:
  No command searches or writes a local mirror, aidata-portal, dinopeng-com,
  Pages settings, workflow, CNAME, domain, or deployment directory.
  Cross-project integration and publication require separate authorization in
  a coordinating session using a source-ready handoff bundle.
USAGE
}

die(){
  echo "Release error: $*" >&2
  exit 1
}

require_valid_source_publish_cohort(){
  local actual_count unique_count
  actual_count="${#SOURCE_PUBLISH_PATHS[@]}"
  [[ "$actual_count" -eq "$SOURCE_PUBLISH_PATH_COUNT" ]] || \
    die "Source publish allowlist must contain exactly $SOURCE_PUBLISH_PATH_COUNT paths (found $actual_count)"
  unique_count="$(printf '%s\n' "${SOURCE_PUBLISH_PATHS[@]}" | LC_ALL=C sort -u | wc -l | tr -d '[:space:]')"
  [[ "$unique_count" -eq "$SOURCE_PUBLISH_PATH_COUNT" ]] || \
    die "Source publish allowlist must contain $SOURCE_PUBLISH_PATH_COUNT unique paths (found $unique_count)"
}

list_expected_source_publish_paths(){
  printf '%s\n' "${SOURCE_PUBLISH_PATHS[@]}" | LC_ALL=C sort -u
}

list_dirty_source_paths(){
  {
    git diff --name-only HEAD --
    git ls-files --others --exclude-standard
  } | LC_ALL=C sort -u
}

list_staged_source_paths(){
  git diff --cached --name-only -- | LC_ALL=C sort -u
}

require_exact_source_publish_paths(){
  local phase="$1"
  local list_actual="$2"
  local expected actual missing unexpected path
  expected="$(list_expected_source_publish_paths)"
  actual="$("$list_actual")"
  [[ "$actual" == "$expected" ]] && return 0

  missing="$(comm -23 <(printf '%s\n' "$expected") <(printf '%s\n' "$actual"))"
  unexpected="$(comm -13 <(printf '%s\n' "$expected") <(printf '%s\n' "$actual"))"
  echo "Source publish path mismatch ($phase)" >&2
  if [[ -z "$missing" ]]; then
    echo "  missing: (none)" >&2
  else
    while IFS= read -r path; do
      [[ -z "$path" ]] || echo "  missing: $path" >&2
    done <<< "$missing"
  fi
  if [[ -z "$unexpected" ]]; then
    echo "  unexpected: (none)" >&2
  else
    while IFS= read -r path; do
      [[ -z "$path" ]] || echo "  unexpected: $path" >&2
    done <<< "$unexpected"
  fi
  die "Source publish path set does not match the exact 3-path allowlist ($phase)"
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

handoff_bundle(){
  node -e '
const fs = require("node:fs");
const handoff = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const bundle = handoff.artifact?.bundle;
if (!bundle) throw new Error("release handoff is missing artifact.bundle");
process.stdout.write(bundle);
' "$STATE_DIR/release-handoff.json"
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

load_publish_state(){
  local file="$1"
  local name
  [[ -f "$file" ]] || die "Publish state is unavailable: ${file#$SITE_ROOT/}"
  unset CREATED_AT REMOTE_BEFORE SOURCE_BEFORE SOURCE_PUBLISHED SOURCE_BRANCH RELEASE_SHA256 BUNDLE PUBLISHED_COMMIT_COUNT
  # shellcheck disable=SC1090
  source "$file"
  for name in REMOTE_BEFORE SOURCE_BEFORE SOURCE_PUBLISHED SOURCE_BRANCH RELEASE_SHA256 BUNDLE PUBLISHED_COMMIT_COUNT; do
    [[ -n "${!name:-}" ]] || die "Publish state is missing $name: ${file#$SITE_ROOT/}"
  done
}

load_rollback_state(){
  local file="$1"
  local name
  [[ -f "$file" ]] || die "Rollback state is unavailable: ${file#$SITE_ROOT/}"
  unset CREATED_AT PHASE ORIGINAL_REMOTE_BEFORE ROLLBACK_REMOTE_BEFORE SOURCE_REVERTED REVERTED_COMMIT_COUNT SOURCE_ROLLBACK SOURCE_BRANCH ROLLBACK_COMMIT_COUNT RELEASE_SHA256 BUNDLE
  # shellcheck disable=SC1090
  source "$file"
  for name in PHASE ORIGINAL_REMOTE_BEFORE SOURCE_REVERTED REVERTED_COMMIT_COUNT SOURCE_BRANCH; do
    [[ -n "${!name:-}" ]] || die "Rollback state is missing $name: ${file#$SITE_ROOT/}"
  done
  case "$PHASE" in
    restoring) ;;
    committed)
      for name in ROLLBACK_REMOTE_BEFORE SOURCE_ROLLBACK ROLLBACK_COMMIT_COUNT RELEASE_SHA256; do
        [[ -n "${!name:-}" ]] || die "Rollback state is missing $name: ${file#$SITE_ROOT/}"
      done
      ;;
    ready)
      for name in ROLLBACK_REMOTE_BEFORE SOURCE_ROLLBACK ROLLBACK_COMMIT_COUNT RELEASE_SHA256 BUNDLE; do
        [[ -n "${!name:-}" ]] || die "Rollback state is missing $name: ${file#$SITE_ROOT/}"
      done
      ;;
    *) die "Rollback state has unknown phase: $PHASE" ;;
  esac
  if [[ "$PHASE" != "restoring" ]]; then
    [[ "$ROLLBACK_REMOTE_BEFORE" == "$SOURCE_REVERTED" ]] || die "Rollback state has inconsistent source transaction boundaries"
  fi
}

inspect_publish_transaction(){
  node scripts/check-publish-transaction.mjs "$1" "$2"
}

finalize_pending_publish(){
  local state="$STATE_DIR/pending-publish.env"
  local publish_started_at current_branch transaction_output transaction_status commit_count bundle
  load_publish_state "$state"
  publish_started_at="${CREATED_AT:-unknown}"
  require_clean_repo
  current_branch="$(git branch --show-current)"
  [[ "$current_branch" == "$SOURCE_BRANCH" ]] || die "Pending publish belongs to branch $SOURCE_BRANCH, not ${current_branch:-detached}"

  git fetch github main
  transaction_output="$(inspect_publish_transaction "$REMOTE_BEFORE" "$SOURCE_PUBLISHED")"
  read -r transaction_status commit_count <<< "$transaction_output"
  [[ "$commit_count" == "$PUBLISHED_COMMIT_COUNT" ]] || die "Pending publish commit count changed"

  case "$transaction_status" in
    needs-push)
      git push github "$SOURCE_BRANCH:main"
      git fetch github main
      transaction_output="$(inspect_publish_transaction "$REMOTE_BEFORE" "$SOURCE_PUBLISHED")"
      read -r transaction_status commit_count <<< "$transaction_output"
      [[ "$transaction_status" == "published" ]] || die "Published source could not be confirmed on github/main"
      ;;
    published) ;;
    *) die "Unexpected pending publish state: $transaction_status" ;;
  esac

  [[ "$(release_fingerprint)" == "$RELEASE_SHA256" ]] || die "Release fingerprint changed while finalizing the pending publish"
  bash scripts/build-release-bundle.sh --release-status source-ready
  bundle="$(handoff_bundle)"
  write_state "$STATE_DIR/last-publish.env" \
    PUBLISH_STARTED_AT "$publish_started_at" \
    FINALIZED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    REMOTE_BEFORE "$REMOTE_BEFORE" \
    SOURCE_BEFORE "$SOURCE_BEFORE" \
    SOURCE_PUBLISHED "$SOURCE_PUBLISHED" \
    SOURCE_BRANCH "$SOURCE_BRANCH" \
    PUBLISHED_COMMIT_COUNT "$PUBLISHED_COMMIT_COUNT" \
    RELEASE_SHA256 "$RELEASE_SHA256" \
    BUNDLE "$bundle"
  rm "$state"
  echo "Published TP Trees source ${SOURCE_PUBLISHED:0:12} ($PUBLISHED_COMMIT_COUNT commit(s))."
  echo "aidata-portal and dinopeng-com were not modified. A coordinating session must process the source-ready handoff."
}

finalize_pending_rollback(){
  local state="$STATE_DIR/pending-rollback.env"
  local rollback_started_at current_branch transaction_output transaction_status commit_count bundle
  load_rollback_state "$state"
  [[ "$PHASE" == "ready" ]] || die "Pending rollback is not ready for source publication"
  rollback_started_at="${CREATED_AT:-unknown}"
  require_clean_repo
  current_branch="$(git branch --show-current)"
  [[ "$current_branch" == "$SOURCE_BRANCH" ]] || die "Pending rollback belongs to branch $SOURCE_BRANCH, not ${current_branch:-detached}"

  git fetch github main
  transaction_output="$(inspect_publish_transaction "$ROLLBACK_REMOTE_BEFORE" "$SOURCE_ROLLBACK")"
  read -r transaction_status commit_count <<< "$transaction_output"
  [[ "$commit_count" == "$ROLLBACK_COMMIT_COUNT" ]] || die "Pending rollback commit count changed"

  case "$transaction_status" in
    needs-push)
      git push github "$SOURCE_BRANCH:main"
      git fetch github main
      transaction_output="$(inspect_publish_transaction "$ROLLBACK_REMOTE_BEFORE" "$SOURCE_ROLLBACK")"
      read -r transaction_status commit_count <<< "$transaction_output"
      [[ "$transaction_status" == "published" ]] || die "Published source rollback could not be confirmed on github/main"
      ;;
    published) ;;
    *) die "Unexpected pending rollback state: $transaction_status" ;;
  esac

  [[ "$commit_count" == "$ROLLBACK_COMMIT_COUNT" ]] || die "Published rollback commit count changed"
  [[ "$(release_fingerprint)" == "$RELEASE_SHA256" ]] || die "Release fingerprint changed while finalizing the pending rollback"
  bash scripts/build-release-bundle.sh --release-status source-ready
  bundle="$(handoff_bundle)"
  write_state "$STATE_DIR/last-rollback.env" \
    ROLLBACK_STARTED_AT "$rollback_started_at" \
    FINALIZED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    SOURCE_REMOTE_BEFORE "$ORIGINAL_REMOTE_BEFORE" \
    ROLLBACK_REMOTE_BEFORE "$ROLLBACK_REMOTE_BEFORE" \
    SOURCE_REVERTED "$SOURCE_REVERTED" \
    REVERTED_COMMIT_COUNT "$REVERTED_COMMIT_COUNT" \
    SOURCE_ROLLBACK "$SOURCE_ROLLBACK" \
    SOURCE_BRANCH "$SOURCE_BRANCH" \
    ROLLBACK_COMMIT_COUNT "$ROLLBACK_COMMIT_COUNT" \
    RELEASE_SHA256 "$RELEASE_SHA256" \
    BUNDLE "$bundle"
  rm "$state"
  echo "TP Trees public release rollback published for a $REVERTED_COMMIT_COUNT-commit source transaction."
  echo "aidata-portal and dinopeng-com remain unchanged and require a separately authorized coordinating session."
}

prepare_committed_rollback(){
  local state="$STATE_DIR/pending-rollback.env"
  local rollback_started_at original_remote_before source_reverted reverted_commit_count source_rollback source_branch rollback_commit_count release bundle transaction_output transaction_status commit_count
  load_rollback_state "$state"
  [[ "$PHASE" == "committed" ]] || die "Pending rollback is not in the committed phase"
  rollback_started_at="${CREATED_AT:-unknown}"
  original_remote_before="$ORIGINAL_REMOTE_BEFORE"
  source_reverted="$SOURCE_REVERTED"
  reverted_commit_count="$REVERTED_COMMIT_COUNT"
  source_rollback="$SOURCE_ROLLBACK"
  source_branch="$SOURCE_BRANCH"
  rollback_commit_count="$ROLLBACK_COMMIT_COUNT"
  release="$RELEASE_SHA256"

  require_clean_repo
  [[ "$(git branch --show-current)" == "$source_branch" ]] || die "Pending rollback belongs to branch $source_branch"
  node scripts/prepare-release-rollback.mjs "$original_remote_before" "$source_reverted" "$source_rollback"
  git fetch github main
  transaction_output="$(inspect_publish_transaction "$source_reverted" "$source_rollback")"
  read -r transaction_status commit_count <<< "$transaction_output"
  [[ "$transaction_status" == "needs-push" || "$transaction_status" == "published" ]] || die "Unexpected committed rollback state: $transaction_status"
  [[ "$commit_count" == "$rollback_commit_count" ]] || die "Committed rollback count changed"
  [[ "$(release_fingerprint)" == "$release" ]] || die "Release fingerprint changed after the rollback commit"

  bash scripts/build-release-bundle.sh
  bundle="$(handoff_bundle)"
  write_state "$state" \
    CREATED_AT "$rollback_started_at" \
    PHASE ready \
    ORIGINAL_REMOTE_BEFORE "$original_remote_before" \
    ROLLBACK_REMOTE_BEFORE "$source_reverted" \
    SOURCE_REVERTED "$source_reverted" \
    REVERTED_COMMIT_COUNT "$reverted_commit_count" \
    SOURCE_ROLLBACK "$source_rollback" \
    SOURCE_BRANCH "$source_branch" \
    ROLLBACK_COMMIT_COUNT "$rollback_commit_count" \
    RELEASE_SHA256 "$release" \
    BUNDLE "$bundle"
  finalize_pending_rollback
}

record_rollback_commit(){
  local state="$STATE_DIR/pending-rollback.env"
  local rollback_started_at original_remote_before source_reverted reverted_commit_count source_branch source_rollback release transaction_output transaction_status rollback_commit_count
  load_rollback_state "$state"
  [[ "$PHASE" == "restoring" ]] || die "Pending rollback is not in the restoring phase"
  rollback_started_at="${CREATED_AT:-unknown}"
  original_remote_before="$ORIGINAL_REMOTE_BEFORE"
  source_reverted="$SOURCE_REVERTED"
  reverted_commit_count="$REVERTED_COMMIT_COUNT"
  source_branch="$SOURCE_BRANCH"
  source_rollback="$(git rev-parse HEAD)"

  require_clean_repo
  node scripts/prepare-release-rollback.mjs "$original_remote_before" "$source_reverted" "$source_rollback"
  release="$(release_fingerprint)"
  transaction_output="$(inspect_publish_transaction "$source_reverted" "$source_rollback")"
  read -r transaction_status rollback_commit_count <<< "$transaction_output"
  [[ "$transaction_status" == "needs-push" || "$transaction_status" == "published" ]] || die "Unexpected new rollback state: $transaction_status"

  write_state "$state" \
    CREATED_AT "$rollback_started_at" \
    PHASE committed \
    ORIGINAL_REMOTE_BEFORE "$original_remote_before" \
    ROLLBACK_REMOTE_BEFORE "$source_reverted" \
    SOURCE_REVERTED "$source_reverted" \
    REVERTED_COMMIT_COUNT "$reverted_commit_count" \
    SOURCE_ROLLBACK "$source_rollback" \
    SOURCE_BRANCH "$source_branch" \
    ROLLBACK_COMMIT_COUNT "$rollback_commit_count" \
    RELEASE_SHA256 "$release"
  prepare_committed_rollback
}

continue_pending_rollback_restore(){
  local state="$STATE_DIR/pending-rollback.env"
  local original_remote_before source_reverted reverted_commit_count source_branch transaction_output transaction_status commit_count current_head
  load_rollback_state "$state"
  [[ "$PHASE" == "restoring" ]] || die "Pending rollback is not in the restoring phase"
  original_remote_before="$ORIGINAL_REMOTE_BEFORE"
  source_reverted="$SOURCE_REVERTED"
  reverted_commit_count="$REVERTED_COMMIT_COUNT"
  source_branch="$SOURCE_BRANCH"
  [[ "$(git branch --show-current)" == "$source_branch" ]] || die "Pending rollback belongs to branch $source_branch"

  current_head="$(git rev-parse HEAD)"
  if [[ "$current_head" != "$source_reverted" ]]; then
    echo "Rollback commit already exists; validating it before resuming."
    record_rollback_commit
    return 0
  fi

  git fetch github main
  transaction_output="$(inspect_publish_transaction "$original_remote_before" "$source_reverted")"
  read -r transaction_status commit_count <<< "$transaction_output"
  [[ "$transaction_status" == "published" ]] || die "Saved publish is not the current github/main transaction"
  [[ "$commit_count" == "$reverted_commit_count" ]] || die "Saved publish commit count changed"

  node scripts/prepare-release-rollback.mjs "$original_remote_before" "$source_reverted"
  node scripts/build-release-manifest.mjs
  bash scripts/preflight-release.sh
  git add -- "${PUBLIC_RELEASE_PATHS[@]}"
  git diff --cached --quiet "$original_remote_before" -- "${PUBLIC_RELEASE_PATHS[@]}" || die "Restored public tree differs from the saved source base"
  git diff --cached --quiet && die "The saved publish has no public release changes to roll back"
  git commit -m "Restore TP Trees public release before ${source_reverted:0:12}"
  record_rollback_commit
}

resume_pending_rollback(){
  load_rollback_state "$STATE_DIR/pending-rollback.env"
  case "$PHASE" in
    restoring) continue_pending_rollback_restore ;;
    committed) prepare_committed_rollback ;;
    ready) finalize_pending_rollback ;;
  esac
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
  if [[ -f "$STATE_DIR/pending-publish.env" ]]; then
    echo "  publish transaction: pending (rerun publish --confirm to resume)"
  elif [[ -f "$STATE_DIR/last-publish.env" ]]; then
    echo "  publish transaction: finalized"
  else
    echo "  publish transaction: none"
  fi
  if [[ -f "$STATE_DIR/pending-rollback.env" ]]; then
    echo "  rollback transaction: pending (restore, bundle, or publish; rerun rollback --confirm)"
  elif [[ -f "$STATE_DIR/last-rollback.env" ]]; then
    echo "  rollback transaction: finalized"
  else
    echo "  rollback transaction: none"
  fi
  echo "  external writes: disabled"
}

prepare_release(){
  require_cached_remote_base
  bash scripts/update-site-data.sh --prepare-push ${UPDATE_ARGS[@]+"${UPDATE_ARGS[@]}"}
  bash scripts/build-release-bundle.sh

  local release bundle
  release="$(release_fingerprint)"
  bundle="$(handoff_bundle)"
  write_state "$STATE_DIR/last-prepare.env" \
    CREATED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    SOURCE_BASE "$(git rev-parse HEAD)" \
    SOURCE_BRANCH "$(git branch --show-current)" \
    RELEASE_SHA256 "$release" \
    BUNDLE "$bundle"
  echo "Prepared source-only release handoff: $bundle"
  echo "Candidate only: do not deploy this handoff."
  echo "After source publication, a coordinating session must validate the source-ready handoff and separately authorize portal integration and dinopeng-com publication."
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
  [[ ! -f "$STATE_DIR/pending-rollback.env" ]] || die "A TP Trees source rollback is pending; rerun rollback --confirm before publishing"
  require_valid_source_publish_cohort
  if [[ -f "$STATE_DIR/pending-publish.env" ]]; then
    echo "Pending TP Trees source publish found; validating and resuming it."
    finalize_pending_publish
    [[ "$VERIFY_AFTER" == "false" ]] || verify_release
    return 0
  fi

  git fetch github main
  require_cached_remote_base
  local remote_before
  remote_before="$(git rev-parse github/main)"

  prepare_release
  local source_before release branch
  source_before="$(git rev-parse HEAD)"
  release="$(release_fingerprint)"
  branch="$(git branch --show-current)"
  [[ -n "$branch" ]] || die "Source repo is in detached HEAD state"

  require_exact_source_publish_paths "after prepare, before staging" list_dirty_source_paths
  git add -- "${SOURCE_PUBLISH_PATHS[@]}"
  require_exact_source_publish_paths "after staging" list_staged_source_paths
  if ! git diff --cached --quiet; then
    git commit -m "$MESSAGE"
  fi
  local source_published
  source_published="$(git rev-parse HEAD)"
  require_clean_repo
  bash scripts/build-release-bundle.sh

  local bundle
  bundle="$(handoff_bundle)"

  local transaction_output transaction_status published_commit_count
  transaction_output="$(inspect_publish_transaction "$remote_before" "$source_published")"
  read -r transaction_status published_commit_count <<< "$transaction_output"
  if [[ "$transaction_status" == "no-change" ]]; then
    bash scripts/build-release-bundle.sh --release-status source-ready
    echo "TP Trees source is already published at ${source_published:0:12}; no publish transaction was recorded."
    echo "aidata-portal and dinopeng-com were not modified."
    [[ "$VERIFY_AFTER" == "false" ]] || verify_release
    return 0
  fi
  [[ "$transaction_status" == "needs-push" ]] || die "Unexpected new publish state: $transaction_status"

  write_state "$STATE_DIR/pending-publish.env" \
    CREATED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    REMOTE_BEFORE "$remote_before" \
    SOURCE_BEFORE "$source_before" \
    SOURCE_PUBLISHED "$source_published" \
    SOURCE_BRANCH "$branch" \
    PUBLISHED_COMMIT_COUNT "$published_commit_count" \
    RELEASE_SHA256 "$release" \
    BUNDLE "$bundle"

  finalize_pending_publish
  [[ "$VERIFY_AFTER" == "false" ]] || verify_release
}

rollback_release(){
  [[ "$CONFIRM" == "true" ]] || die "rollback requires --confirm"
  [[ ! -f "$STATE_DIR/pending-publish.env" ]] || die "A TP Trees source publish is pending; rerun publish --confirm before rolling back"
  if [[ -f "$STATE_DIR/pending-rollback.env" ]]; then
    echo "Pending TP Trees source rollback found; validating and resuming it."
    resume_pending_rollback
    [[ "$VERIFY_AFTER" == "false" ]] || verify_release
    return 0
  fi

  local state="$STATE_DIR/last-publish.env"
  local transaction_output transaction_status commit_count
  load_publish_state "$state"
  local original_remote_before source_reverted reverted_commit_count published_branch
  original_remote_before="$REMOTE_BEFORE"
  source_reverted="$SOURCE_PUBLISHED"
  reverted_commit_count="$PUBLISHED_COMMIT_COUNT"
  published_branch="$SOURCE_BRANCH"
  require_clean_repo
  local branch
  branch="$(git branch --show-current)"
  [[ "$branch" == "$published_branch" ]] || die "Saved publish belongs to branch $published_branch, not ${branch:-detached}"
  git fetch github main
  transaction_output="$(inspect_publish_transaction "$original_remote_before" "$source_reverted")"
  read -r transaction_status commit_count <<< "$transaction_output"
  [[ "$transaction_status" == "published" ]] || die "Saved publish is not the current github/main transaction"
  [[ "$commit_count" == "$reverted_commit_count" ]] || die "Saved publish commit count changed"
  if git diff --quiet "$original_remote_before" "$source_reverted" -- "${PUBLIC_RELEASE_PATHS[@]}"; then
    die "Saved publish contains no public release changes; no rollback transaction was created"
  fi

  write_state "$STATE_DIR/pending-rollback.env" \
    CREATED_AT "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    PHASE restoring \
    ORIGINAL_REMOTE_BEFORE "$original_remote_before" \
    SOURCE_REVERTED "$source_reverted" \
    REVERTED_COMMIT_COUNT "$reverted_commit_count" \
    SOURCE_BRANCH "$branch"

  continue_pending_rollback_restore
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
