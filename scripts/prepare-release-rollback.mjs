import { spawnSync } from "node:child_process";

const [sourceBaseArg, sourcePublishedArg, sourceRollbackArg] = process.argv.slice(2);
const shaPattern = /^[a-f0-9]{40,64}$/;
const releasePaths = [
  "index.html",
  "favicon.svg",
  "favicon.ico",
  "app",
  "daily",
  "data",
  "lifecycle",
  "public",
  "species",
];

if (
  !shaPattern.test(sourceBaseArg || "")
  || !shaPattern.test(sourcePublishedArg || "")
  || (sourceRollbackArg !== undefined && !shaPattern.test(sourceRollbackArg))
) {
  throw new Error("Usage: node scripts/prepare-release-rollback.mjs <source-base-sha> <source-published-sha> [source-rollback-sha]");
}

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result;
}

function resolveCommit(value) {
  return git(["rev-parse", "--verify", `${value}^{commit}`]).stdout.trim();
}

function nulPaths(value) {
  return value.split("\0").filter(Boolean);
}

function isReleasePath(path) {
  return releasePaths.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

function matchesTree(commit, path) {
  return git(["diff", "--quiet", commit, "--", path], { allowFailure: true }).status === 0;
}

function existsInTree(commit, path) {
  return git(["cat-file", "-e", `${commit}:${path}`], { allowFailure: true }).status === 0;
}

const sourceBase = resolveCommit(sourceBaseArg);
const sourcePublished = resolveCommit(sourcePublishedArg);
const head = resolveCommit("HEAD");
const activeReleasePaths = releasePaths.filter((path) => existsInTree(sourceBase, path) || existsInTree(sourcePublished, path));

if (!activeReleasePaths.length) {
  throw new Error("Neither source commit contains a public release tree");
}

const unmerged = nulPaths(git(["diff", "--name-only", "--diff-filter=U", "-z"]).stdout);
if (unmerged.length) {
  throw new Error(`Rollback has unresolved conflicts: ${unmerged.join(", ")}`);
}

const untracked = nulPaths(git(["ls-files", "--others", "--exclude-standard", "-z"]).stdout);
if (untracked.length) {
  throw new Error(`Rollback recovery found untracked files: ${untracked.join(", ")}`);
}

if (sourceRollbackArg !== undefined) {
  const sourceRollback = resolveCommit(sourceRollbackArg);
  if (head !== sourceRollback) {
    throw new Error("Current HEAD differs from the rollback commit being verified");
  }
  if (git(["status", "--porcelain=v1", "-z"]).stdout) {
    throw new Error("Rollback commit verification requires a clean worktree");
  }

  const parents = git(["rev-list", "--parents", "-n", "1", sourceRollback]).stdout.trim().split(" ");
  if (parents.length !== 2 || parents[1] !== sourcePublished) {
    throw new Error("Rollback commit is not a single-parent child of the published source commit");
  }

  const committed = nulPaths(git(["diff", "--name-only", "-z", sourcePublished, sourceRollback, "--"]).stdout);
  if (!committed.length) {
    throw new Error("Rollback commit contains no public release changes");
  }
  for (const path of committed) {
    if (!isReleasePath(path)) {
      throw new Error(`Rollback commit changes a file outside the public release tree: ${path}`);
    }
  }

  const restoredTree = git(["diff", "--quiet", sourceBase, sourceRollback, "--", ...activeReleasePaths], { allowFailure: true });
  if (restoredTree.status !== 0) {
    throw new Error("Rollback commit public tree does not match the saved source base");
  }

  console.log(`verified rollback commit ${sourceRollback.slice(0, 12)} (${committed.length} public path(s))`);
  process.exit(0);
}

if (head !== sourcePublished) {
  throw new Error("Current HEAD differs from the source commit being rolled back");
}

const changed = nulPaths(git(["diff", "--name-only", "-z", sourcePublished, "--"]).stdout);
for (const path of changed) {
  if (!isReleasePath(path)) {
    throw new Error(`Rollback recovery found a change outside the public release tree: ${path}`);
  }
  if (!matchesTree(sourceBase, path) && !matchesTree(sourcePublished, path)) {
    throw new Error(`Rollback recovery found a manually modified release file: ${path}`);
  }
}

git(["restore", `--source=${sourceBase}`, "--staged", "--worktree", "--", ...activeReleasePaths]);

const restoredTree = git(["diff", "--quiet", sourceBase, "--", ...activeReleasePaths], { allowFailure: true });
if (restoredTree.status !== 0) {
  throw new Error("Public release tree does not match the saved source base after restore");
}

const restored = nulPaths(git(["diff", "--cached", "--name-only", "-z", sourcePublished, "--", ...activeReleasePaths]).stdout);
if (!restored.length) {
  throw new Error("The saved publish has no public release changes to roll back");
}

console.log(`restored ${restored.length} public release path(s) from ${sourceBase.slice(0, 12)}`);
