import { spawnSync } from "node:child_process";

const [remoteBeforeArg, sourcePublishedArg] = process.argv.slice(2);
const shaPattern = /^[a-f0-9]{40,64}$/;

if (!shaPattern.test(remoteBeforeArg || "") || !shaPattern.test(sourcePublishedArg || "")) {
  throw new Error("Usage: node scripts/check-publish-transaction.mjs <remote-before-sha> <source-published-sha>");
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

const remoteBefore = resolveCommit(remoteBeforeArg);
const sourcePublished = resolveCommit(sourcePublishedArg);
const head = resolveCommit("HEAD");
const remoteHead = resolveCommit("github/main");

if (head !== sourcePublished) {
  throw new Error("Current HEAD differs from the pending source-published commit");
}

if (remoteBefore === sourcePublished) {
  if (remoteHead !== sourcePublished) throw new Error("github/main changed while finalizing a no-change publish");
  console.log("no-change 0");
  process.exit(0);
}

const ancestor = git(["merge-base", "--is-ancestor", remoteBefore, sourcePublished], { allowFailure: true });
if (ancestor.status !== 0) {
  throw new Error("The pending source commit is not a fast-forward descendant of the saved remote base");
}

const range = `${remoteBefore}..${sourcePublished}`;
const merges = git(["rev-list", "--merges", range]).stdout.trim();
if (merges) throw new Error("The publish range contains merge commits and cannot use scripted rollback");

const commitCount = Number(git(["rev-list", "--count", range]).stdout.trim());
if (!Number.isInteger(commitCount) || commitCount < 1) throw new Error("The publish range is empty or invalid");

if (remoteHead === remoteBefore) {
  console.log(`needs-push ${commitCount}`);
} else if (remoteHead === sourcePublished) {
  console.log(`published ${commitCount}`);
} else {
  throw new Error("github/main changed outside the saved publish transaction");
}
