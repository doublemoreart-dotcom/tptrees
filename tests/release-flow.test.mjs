import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const writer = new URL("../scripts/write-release-handoff.mjs", import.meta.url);
const updateScriptUrl = new URL("../scripts/update-site-data.sh", import.meta.url);
const updateScript = await readFile(updateScriptUrl, "utf8");
const releaseScript = await readFile(new URL("../scripts/release-site.sh", import.meta.url), "utf8");
const bundleScript = await readFile(new URL("../scripts/build-release-bundle.sh", import.meta.url), "utf8");
const archiveScript = await readFile(new URL("../scripts/build-release-archive.mjs", import.meta.url), "utf8");
const transactionScript = await readFile(new URL("../scripts/check-publish-transaction.mjs", import.meta.url), "utf8");
const rollbackPreparerScript = await readFile(new URL("../scripts/prepare-release-rollback.mjs", import.meta.url), "utf8");

async function writeHandoff(t, { dirty, status }) {
  const directory = await mkdtemp(join(tmpdir(), "tptrees-handoff-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, "handoff.json");
  const bundle = join(directory, "bundle.tar.gz");
  const result = spawnSync(
    process.execPath,
    [
      writer.pathname,
      output,
      bundle,
      "a".repeat(64),
      "b".repeat(40),
      "test-branch",
      String(dirty),
      status,
      "c".repeat(64),
      "123",
    ],
    { cwd: siteRoot, encoding: "utf8" },
  );
  return { directory, output, result };
}

test("dirty worktrees produce an explicit candidate handoff", async (t) => {
  const { output, result } = await writeHandoff(t, { dirty: true, status: "candidate" });
  assert.equal(result.status, 0, result.stderr);
  const handoff = JSON.parse(await readFile(output, "utf8"));
  assert.equal(handoff.schemaVersion, 2);
  assert.equal(handoff.releaseStatus, "candidate");
  assert.equal(handoff.source.workingTreeDirty, true);
  assert.equal(handoff.source.repository, "doublemoreart-dotcom/tptrees");
  assert.equal(handoff.externalActionRequired.permittedInThisSession, false);
  assert.equal(handoff.externalActionRequired.authorizationRequired, true);
  assert.equal(handoff.externalActionRequired.publicationRepository, "doublemoreart-dotcom/dinopeng-com");
  assert.deepEqual(handoff.externalActionRequired.separatedRepositories, [
    "doublemoreart-dotcom/aidata-portal",
    "doublemoreart-dotcom/dinopeng-com",
  ]);
  assert.match(handoff.externalActionRequired.action, /must not be deployed/);
});

test("clean published sources can produce a source-ready handoff", async (t) => {
  const { output, result } = await writeHandoff(t, { dirty: false, status: "source-ready" });
  assert.equal(result.status, 0, result.stderr);
  const handoff = JSON.parse(await readFile(output, "utf8"));
  assert.equal(handoff.releaseStatus, "source-ready");
  assert.equal(handoff.source.workingTreeDirty, false);
  assert.equal(handoff.artifact.destinationPath, "tptrees/");
  assert.match(handoff.externalActionRequired.action, /coordinating task/);
});

test("dirty sources cannot be labeled source-ready", async (t) => {
  const { result } = await writeHandoff(t, { dirty: true, status: "source-ready" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires a clean TP Trees worktree/);
});

test("release tooling preserves the source-only isolation boundary", () => {
  assert.doesNotMatch(updateScript, /detect_portal_target|copy_publish_entries|TPTREES_PORTAL_TARGET/);
  assert.match(updateScript, /removed by the project isolation policy/);
  assert.doesNotMatch(releaseScript, /\brsync\b|copy_publish_entries|PORTAL_TARGET/);
  assert.match(releaseScript, /external writes: disabled/);
  assert.match(releaseScript, /handoff\.artifact\?\.bundle/);
  assert.match(releaseScript, /git merge-base --is-ancestor github\/main HEAD/);
  assert.match(releaseScript, /Source is behind cached github\/main/);
  assert.match(releaseScript, /publish_release\(\)\{[\s\S]+git fetch github main[\s\S]+require_cached_remote_base/);
  assert.doesNotMatch(releaseScript, /Source HEAD is not current with github\/main/);
  assert.match(bundleScript, /node scripts\/build-release-archive\.mjs/);
  assert.match(archiveScript, /Object\.entries\(releaseManifest\.files\)/);
  assert.match(archiveScript, /Release file hash differs from site-release-manifest\.json/);
  assert.match(archiveScript, /mode: 0o644/);
  assert.match(archiveScript, /mode: 0o755/);
  assert.match(bundleScript, /source-ready[\s\S]+WORKTREE_DIRTY/);
  assert.match(bundleScript, /source-ready[\s\S]+HEAD to match the published github\/main commit/);
  assert.match(releaseScript, /REMOTE_BEFORE[\s\S]+PUBLISHED_COMMIT_COUNT/);
  assert.match(releaseScript, /Pending TP Trees source publish found; validating and resuming it/);
  assert.match(releaseScript, /pending-rollback\.env/);
  assert.match(releaseScript, /Pending TP Trees source rollback found; validating and resuming it/);
  assert.match(releaseScript, /ROLLBACK_REMOTE_BEFORE[\s\S]+ROLLBACK_COMMIT_COUNT/);
  assert.match(releaseScript, /PHASE restoring/);
  assert.match(releaseScript, /PHASE committed/);
  assert.match(releaseScript, /PHASE ready/);
  assert.match(releaseScript, /A TP Trees source rollback is pending; rerun rollback --confirm before publishing/);
  assert.match(releaseScript, /A TP Trees source publish is pending; rerun publish --confirm before rolling back/);
  assert.match(releaseScript, /node scripts\/prepare-release-rollback\.mjs/);
  assert.doesNotMatch(releaseScript, /git revert|reset --hard|force push/);
  assert.match(rollbackPreparerScript, /git\(\["restore", `--source=\$\{sourceBase\}`/);
  assert.match(rollbackPreparerScript, /outside the public release tree/);
  assert.match(rollbackPreparerScript, /manually modified release file/);
  assert.match(transactionScript, /needs-push[\s\S]+published[\s\S]+changed outside the saved publish transaction/);
});

test("legacy portal sync options fail before touching an external path", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "tptrees-forbidden-target-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, "portal-checkout");
  const result = spawnSync("bash", [updateScriptUrl.pathname, "--portal-target", target], {
    cwd: siteRoot,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /removed by the project isolation policy/);
  await assert.rejects(access(target), { code: "ENOENT" });
});

test("the source repository does not own a CNAME", async () => {
  await assert.rejects(access(new URL("../CNAME", import.meta.url)), { code: "ENOENT" });
});
