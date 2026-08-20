import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const checker = new URL("../scripts/check-publish-transaction.mjs", import.meta.url);
const rollbackPreparer = new URL("../scripts/prepare-release-rollback.mjs", import.meta.url);

function run(command, args, cwd, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (!allowFailure) assert.equal(result.status, 0, result.stderr);
  return result;
}

function git(cwd, ...args) {
  return run("git", args, cwd).stdout.trim();
}

async function createLinearRepository(t) {
  const directory = await mkdtemp(join(tmpdir(), "tptrees-publish-transaction-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  git(directory, "init", "-q");
  git(directory, "config", "user.name", "TP Trees Test");
  git(directory, "config", "user.email", "tptrees-test@example.invalid");
  const file = join(directory, "index.html");
  const tool = join(directory, "scripts", "tool.sh");

  await mkdir(join(directory, "scripts"));
  await writeFile(file, "base\n");
  await writeFile(tool, "tool base\n");
  git(directory, "add", "index.html", "scripts/tool.sh");
  git(directory, "commit", "-q", "-m", "base");
  const base = git(directory, "rev-parse", "HEAD");
  git(directory, "update-ref", "refs/remotes/github/main", base);

  await writeFile(file, "first\n");
  await writeFile(tool, "tool first\n");
  git(directory, "commit", "-qam", "first");
  const first = git(directory, "rev-parse", "HEAD");
  await writeFile(file, "second\n");
  await writeFile(tool, "tool second\n");
  git(directory, "commit", "-qam", "second");
  const published = git(directory, "rev-parse", "HEAD");
  return { directory, file, tool, base, first, published };
}

function check(directory, remoteBefore, sourcePublished, { allowFailure = false } = {}) {
  return run(process.execPath, [checker.pathname, remoteBefore, sourcePublished], directory, { allowFailure });
}

function prepareRollback(directory, sourceBase, sourcePublished, sourceRollback, { allowFailure = false } = {}) {
  const args = [rollbackPreparer.pathname, sourceBase, sourcePublished];
  if (sourceRollback) args.push(sourceRollback);
  return run(process.execPath, args, directory, { allowFailure });
}

test("publish transaction distinguishes pending, published, and no-change states", async (t) => {
  const repo = await createLinearRepository(t);
  assert.equal(check(repo.directory, repo.base, repo.published).stdout.trim(), "needs-push 2");

  git(repo.directory, "update-ref", "refs/remotes/github/main", repo.published);
  assert.equal(check(repo.directory, repo.base, repo.published).stdout.trim(), "published 2");
  assert.equal(check(repo.directory, repo.published, repo.published).stdout.trim(), "no-change 0");

  git(repo.directory, "update-ref", "refs/remotes/github/main", repo.first);
  const changed = check(repo.directory, repo.base, repo.published, { allowFailure: true });
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /changed outside the saved publish transaction/);
});

test("rollback restores only the public tree and preserves release tooling", async (t) => {
  const repo = await createLinearRepository(t);
  git(repo.directory, "update-ref", "refs/remotes/github/main", repo.published);
  assert.match(prepareRollback(repo.directory, repo.base, repo.published).stdout, /restored 1 public release path/);
  assert.equal(await readFile(repo.file, "utf8"), "base\n");
  assert.equal(await readFile(repo.tool, "utf8"), "tool second\n");
  assert.equal(git(repo.directory, "diff", "--cached", "--name-only"), "index.html");

  assert.equal(prepareRollback(repo.directory, repo.base, repo.published).status, 0);
  git(repo.directory, "commit", "-q", "-m", "restore public release");
  const rollback = git(repo.directory, "rev-parse", "HEAD");
  assert.match(prepareRollback(repo.directory, repo.base, repo.published, rollback).stdout, /verified rollback commit/);
});

test("rollback recovery rejects manual and non-public worktree changes", async (t) => {
  const manual = await createLinearRepository(t);
  prepareRollback(manual.directory, manual.base, manual.published);
  await writeFile(manual.file, "manual edit\n");
  const changedRelease = prepareRollback(manual.directory, manual.base, manual.published, undefined, { allowFailure: true });
  assert.notEqual(changedRelease.status, 0);
  assert.match(changedRelease.stderr, /manually modified release file/);

  const outside = await createLinearRepository(t);
  await writeFile(outside.tool, "manual tool edit\n");
  const changedTool = prepareRollback(outside.directory, outside.base, outside.published, undefined, { allowFailure: true });
  assert.notEqual(changedTool.status, 0);
  assert.match(changedTool.stderr, /outside the public release tree/);
});

test("rollback transaction distinguishes pending, published, and remote drift states", async (t) => {
  const repo = await createLinearRepository(t);
  git(repo.directory, "update-ref", "refs/remotes/github/main", repo.published);
  prepareRollback(repo.directory, repo.base, repo.published);
  git(repo.directory, "commit", "-q", "-m", "rollback release");
  const rollback = git(repo.directory, "rev-parse", "HEAD");

  assert.equal(await readFile(repo.file, "utf8"), "base\n");
  assert.equal(check(repo.directory, repo.published, rollback).stdout.trim(), "needs-push 1");

  git(repo.directory, "update-ref", "refs/remotes/github/main", rollback);
  assert.equal(check(repo.directory, repo.published, rollback).stdout.trim(), "published 1");

  git(repo.directory, "update-ref", "refs/remotes/github/main", repo.first);
  const changed = check(repo.directory, repo.published, rollback, { allowFailure: true });
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /changed outside the saved publish transaction/);
});
