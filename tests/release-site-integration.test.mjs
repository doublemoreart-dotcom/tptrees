import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const releaseScript = new URL("../scripts/release-site.sh", import.meta.url);
const transactionChecker = new URL("../scripts/check-publish-transaction.mjs", import.meta.url);
const rollbackPreparer = new URL("../scripts/prepare-release-rollback.mjs", import.meta.url);
const releaseScriptSource = await readFile(releaseScript, "utf8");

const sourcePublishPaths = [
  "docs/PROJECT_BASELINE.md",
  "scripts/release-site.sh",
  "tests/release-site-integration.test.mjs",
];

const sourcePublishPathCount = 3;
assert.equal(sourcePublishPaths.length, sourcePublishPathCount);
assert.equal(new Set(sourcePublishPaths).size, sourcePublishPathCount);
const trackedPublishPaths = new Set(sourcePublishPaths);

function run(command, args, cwd, { allowFailure = false, env = {} } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (!allowFailure) assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function git(cwd, ...args) {
  return run("git", args, cwd).stdout.trim();
}

async function writeRepositoryFile(repository, path, body, executable = false) {
  const destination = join(repository, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, body);
  if (executable) await chmod(destination, 0o755);
}

async function writeExecutable(path, body) {
  await writeFile(path, body);
  await chmod(path, 0o755);
}

async function copyRuntimeScript(source, destination, executable = false) {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, await readFile(source, "utf8"));
  if (executable) await chmod(destination, 0o755);
}

function dirtyPaths(repository) {
  const tracked = git(repository, "diff", "--name-only", "HEAD", "--").split("\n").filter(Boolean);
  const untracked = git(repository, "ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "tptrees-release-site-integration-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repository = join(root, "source");
  const remote = join(root, "github.git");
  await mkdir(repository, { recursive: true });

  await writeRepositoryFile(repository, ".gitignore", ".release/\n");
  await writeRepositoryFile(repository, "favicon.svg", "fixture svg\n");
  await writeRepositoryFile(repository, "favicon.ico", "fixture ico\n");
  for (const directory of ["app", "daily", "lifecycle", "species"]) {
    await writeRepositoryFile(repository, `${directory}/fixture.txt`, "public fixture\n");
  }
  await writeRepositoryFile(repository, "index.html", "base site\n");
  await writeRepositoryFile(
    repository,
    "data/site-release-manifest.json",
    `${JSON.stringify({ releaseSha256: "a".repeat(64) }, null, 2)}\n`,
  );
  await writeRepositoryFile(repository, "public/fixture.txt", "public fixture\n");
  await writeRepositoryFile(repository, "scripts/update-site-data.sh", "#!/usr/bin/env bash\nset -euo pipefail\n", true);
  await writeRepositoryFile(repository, "scripts/preflight-release.sh", "#!/usr/bin/env bash\nset -euo pipefail\n", true);
  await writeRepositoryFile(repository, "scripts/build-release-manifest.mjs", "// Fixture manifest is restored directly from Git.\n");
  await writeRepositoryFile(
    repository,
    "scripts/build-release-bundle.sh",
    "#!/usr/bin/env bash\nset -euo pipefail\nnode scripts/test-build-release-bundle.mjs \"$@\"\n",
    true,
  );
  await copyRuntimeScript(transactionChecker, join(repository, "scripts", "check-publish-transaction.mjs"));
  await copyRuntimeScript(rollbackPreparer, join(repository, "scripts", "prepare-release-rollback.mjs"));
  await writeRepositoryFile(
    repository,
    "scripts/test-build-release-bundle.mjs",
    `import { mkdir, readFile, writeFile } from "node:fs/promises";
const sourceReady = process.argv.includes("--release-status") && process.argv.includes("source-ready");
if (!sourceReady && process.env.TPTREES_TEST_FAIL_CANDIDATE_BUNDLE === "1") {
  throw new Error("intentional candidate bundle interruption");
}
const manifest = JSON.parse(await readFile("data/site-release-manifest.json", "utf8"));
await mkdir(".release/bundles", { recursive: true });
const bundle = ".release/bundles/fixture.tar.gz";
await writeFile(bundle, manifest.releaseSha256);
await writeFile(".release/release-handoff.json", JSON.stringify({
  releaseStatus: sourceReady ? "source-ready" : "candidate",
  artifact: { bundle },
}) + "\\n");
`,
  );

  for (const path of trackedPublishPaths) {
    const executable = path.endsWith(".sh");
    const body = executable
      ? `#!/usr/bin/env bash\n# base ${path}\n`
      : `base ${path}\n`;
    await writeRepositoryFile(repository, path, body, executable);
  }

  git(repository, "init", "-q", "-b", "main");
  git(repository, "config", "user.name", "TP Trees Integration Test");
  git(repository, "config", "user.email", "tptrees-integration@example.invalid");
  git(repository, "add", "--all");
  git(repository, "commit", "-q", "-m", "base");
  const base = git(repository, "rev-parse", "HEAD");

  git(root, "init", "-q", "--bare", remote);
  git(repository, "remote", "add", "github", remote);
  git(repository, "push", "-q", "-u", "github", "main");

  for (const path of trackedPublishPaths) {
    if (path === "scripts/release-site.sh") continue;
    await writeRepositoryFile(repository, path, `published ${path}\n`);
  }
  await copyRuntimeScript(releaseScript, join(repository, "scripts", "release-site.sh"), true);

  assert.deepEqual(dirtyPaths(repository), sourcePublishPaths);
  return { root, repository, remote, base };
}

function assertUnpublished(fixture) {
  assert.equal(git(fixture.repository, "rev-parse", "HEAD"), fixture.base);
  assert.equal(git(fixture.repository, "rev-parse", "github/main"), fixture.base);
}

test("release-site publishes and resumes the exact 3-path scope, then resumes a public-tree rollback", async (t) => {
  const allowlistBlock = releaseScriptSource.match(/SOURCE_PUBLISH_PATHS=\(\n([\s\S]*?)\n\)/);
  assert.ok(allowlistBlock, "production source publish allowlist should exist");
  const productionPaths = [...allowlistBlock[1].matchAll(/^\s+(\S+)\s*$/gm)].map((match) => match[1]);
  assert.deepEqual(productionPaths, sourcePublishPaths);
  assert.match(releaseScriptSource, /^SOURCE_PUBLISH_PATH_COUNT=3$/m);
  assert.match(releaseScriptSource, /Source publish allowlist must contain exactly \$SOURCE_PUBLISH_PATH_COUNT paths/);
  assert.match(releaseScriptSource, /Source publish allowlist must contain \$SOURCE_PUBLISH_PATH_COUNT unique paths/);
  const publishStart = releaseScriptSource.indexOf("publish_release(){");
  const cohortGate = releaseScriptSource.indexOf("\n  require_valid_source_publish_cohort\n", publishStart);
  const prepareCall = releaseScriptSource.indexOf("\n  prepare_release\n", publishStart);
  assert.ok(publishStart >= 0 && cohortGate > publishStart && cohortGate < prepareCall);
  assert.doesNotMatch(releaseScriptSource, /git add --all|git add -A|git add \.(?:\s|$)/);
  assert.match(releaseScriptSource, /git add -- "\$\{SOURCE_PUBLISH_PATHS\[@\]\}"/);
  const fixture = await createFixture(t);
  const rejectMarker = join(fixture.remote, "reject-once");
  await writeFile(rejectMarker, "reject the next push\n");
  await writeExecutable(
    join(fixture.remote, "hooks", "pre-receive"),
    `#!/usr/bin/env bash
set -euo pipefail
marker=${JSON.stringify(rejectMarker)}
if [[ -f "$marker" ]]; then
  rm "$marker"
  echo "intentional first-push rejection" >&2
  exit 1
fi
`,
  );

  const interruptedPublish = run(
    "bash",
    ["scripts/release-site.sh", "publish", "--message", "fixture publish", "--confirm"],
    fixture.repository,
    { allowFailure: true },
  );
  assert.notEqual(interruptedPublish.status, 0);
  assert.match(interruptedPublish.stderr, /intentional first-push rejection/);
  const pendingPublish = await readFile(join(fixture.repository, ".release", "pending-publish.env"), "utf8");
  assert.match(pendingPublish, /PUBLISHED_COMMIT_COUNT=1/);
  assert.equal(git(fixture.repository, "rev-parse", "github/main"), fixture.base);
  assert.deepEqual(git(fixture.repository, "diff", "--name-only", fixture.base, "HEAD").split("\n"), sourcePublishPaths);

  const resumedPublish = run(
    "bash",
    ["scripts/release-site.sh", "publish", "--confirm"],
    fixture.repository,
  );
  assert.match(resumedPublish.stdout, /Pending TP Trees source publish found/);
  const published = git(fixture.repository, "rev-parse", "HEAD");
  assert.equal(git(fixture.repository, "rev-parse", "github/main"), published);
  assert.equal(JSON.parse(await readFile(join(fixture.repository, ".release", "release-handoff.json"), "utf8")).releaseStatus, "source-ready");

  await writeFile(join(fixture.repository, "index.html"), "published site\n");
  await writeFile(
    join(fixture.repository, "data", "site-release-manifest.json"),
    `${JSON.stringify({ releaseSha256: "c".repeat(64) }, null, 2)}\n`,
  );
  git(fixture.repository, "add", "--", "index.html", "data/site-release-manifest.json");
  git(fixture.repository, "commit", "-q", "-m", "fixture public publish");
  const publicPublished = git(fixture.repository, "rev-parse", "HEAD");
  git(fixture.repository, "push", "-q", "github", "main");
  await writeFile(
    join(fixture.repository, ".release", "last-publish.env"),
    `CREATED_AT=2026-08-20T00:00:00Z
REMOTE_BEFORE=${published}
SOURCE_BEFORE=${published}
SOURCE_PUBLISHED=${publicPublished}
SOURCE_BRANCH=main
PUBLISHED_COMMIT_COUNT=1
RELEASE_SHA256=${"c".repeat(64)}
BUNDLE=.release/bundles/fixture.tar.gz
`,
  );

  const interruptedRollback = run(
    "bash",
    ["scripts/release-site.sh", "rollback", "--confirm"],
    fixture.repository,
    { allowFailure: true, env: { TPTREES_TEST_FAIL_CANDIDATE_BUNDLE: "1" } },
  );
  assert.notEqual(interruptedRollback.status, 0);
  assert.match(interruptedRollback.stderr, /intentional candidate bundle interruption/);
  const pendingRollback = await readFile(join(fixture.repository, ".release", "pending-rollback.env"), "utf8");
  assert.match(pendingRollback, /PHASE=committed/);
  assert.equal(git(fixture.repository, "rev-parse", "github/main"), publicPublished);

  const resumedRollback = run(
    "bash",
    ["scripts/release-site.sh", "rollback", "--confirm"],
    fixture.repository,
  );
  assert.match(resumedRollback.stdout, /Pending TP Trees source rollback found/);
  const rollback = git(fixture.repository, "rev-parse", "HEAD");
  assert.equal(git(fixture.repository, "rev-parse", "github/main"), rollback);
  assert.equal(await readFile(join(fixture.repository, "index.html"), "utf8"), "base site\n");
  assert.equal(
    JSON.parse(await readFile(join(fixture.repository, "data", "site-release-manifest.json"), "utf8")).releaseSha256,
    "a".repeat(64),
  );
  assert.equal(
    await readFile(join(fixture.repository, "docs", "PROJECT_BASELINE.md"), "utf8"),
    "published docs/PROJECT_BASELINE.md\n",
  );
  assert.deepEqual(git(fixture.repository, "diff", "--name-only", publicPublished, rollback).split("\n"), [
    "data/site-release-manifest.json",
    "index.html",
  ]);
  assert.equal(JSON.parse(await readFile(join(fixture.repository, ".release", "release-handoff.json"), "utf8")).releaseStatus, "source-ready");
  await assert.rejects(readFile(join(fixture.repository, ".release", "pending-rollback.env")), { code: "ENOENT" });
});

test("release-site rejects an extra untracked path before staging", async (t) => {
  const fixture = await createFixture(t);
  await writeFile(join(fixture.repository, "unexpected.txt"), "not authorized\n");

  const result = run(
    "bash",
    ["scripts/release-site.sh", "publish", "--message", "must reject extra", "--confirm"],
    fixture.repository,
    { allowFailure: true },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source publish path mismatch \(after prepare, before staging\)/);
  assert.match(result.stderr, /missing: \(none\)/);
  assert.match(result.stderr, /unexpected: unexpected\.txt/);
  assert.match(result.stderr, /exact 3-path allowlist \(after prepare, before staging\)/);
  assertUnpublished(fixture);
});

test("release-site rejects a missing expected path before staging", async (t) => {
  const fixture = await createFixture(t);
  git(fixture.repository, "restore", "--", "tests/release-site-integration.test.mjs");

  const result = run(
    "bash",
    ["scripts/release-site.sh", "publish", "--message", "must reject missing", "--confirm"],
    fixture.repository,
    { allowFailure: true },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source publish path mismatch \(after prepare, before staging\)/);
  assert.match(result.stderr, /missing: tests\/release-site-integration\.test\.mjs/);
  assert.match(result.stderr, /unexpected: \(none\)/);
  assert.match(result.stderr, /exact 3-path allowlist \(after prepare, before staging\)/);
  assertUnpublished(fixture);
});

test("release-site rejects staging drift after the allowlisted git add", async (t) => {
  const fixture = await createFixture(t);
  const bin = join(fixture.root, "bin");
  const gitWrapper = join(bin, "git");
  const realGit = run("which", ["git"], fixture.repository).stdout.trim();
  await mkdir(bin, { recursive: true });
  await writeExecutable(
    gitWrapper,
    `#!/usr/bin/env bash
real_git=${JSON.stringify(realGit)}
"$real_git" "$@"
status=$?
if [[ "$status" -eq 0 && "\${1:-}" == "add" && "\${2:-}" == "--" && -n "\${TPTREES_TEST_STAGE_DRIFT_PATH:-}" ]]; then
  printf 'staging drift\n' > "$TPTREES_TEST_STAGE_DRIFT_PATH"
  "$real_git" add -- "$TPTREES_TEST_STAGE_DRIFT_PATH"
fi
exit "$status"
`,
  );

  const result = run(
    "bash",
    ["scripts/release-site.sh", "publish", "--message", "must reject drift", "--confirm"],
    fixture.repository,
    {
      allowFailure: true,
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        TPTREES_TEST_STAGE_DRIFT_PATH: "staging-drift.txt",
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source publish path mismatch \(after staging\)/);
  assert.match(result.stderr, /missing: \(none\)/);
  assert.match(result.stderr, /unexpected: staging-drift\.txt/);
  assert.match(result.stderr, /exact 3-path allowlist \(after staging\)/);
  assertUnpublished(fixture);
});
