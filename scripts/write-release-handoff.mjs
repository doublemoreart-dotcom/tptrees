import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const [
  outputArg,
  bundleArg,
  releaseSha256,
  sourceCommit,
  sourceBranch,
  dirtyArg,
  releaseStatusArg,
  bundleSha256,
  bundleSizeArg,
] = process.argv.slice(2);

if (!outputArg || !bundleArg || !releaseSha256 || !sourceCommit || !releaseStatusArg || !bundleSha256 || !bundleSizeArg) {
  throw new Error(
    "Usage: write-release-handoff.mjs <output> <bundle> <release> <commit> <branch> <dirty> <status> <bundle-sha256> <bundle-size>",
  );
}

const output = resolve(outputArg);
const bundle = resolve(bundleArg);
const workingTreeDirty = dirtyArg === "true";
if (!new Set(["candidate", "source-ready"]).has(releaseStatusArg)) {
  throw new Error(`Invalid release status: ${releaseStatusArg}`);
}
if (releaseStatusArg === "source-ready" && workingTreeDirty) {
  throw new Error("A source-ready handoff requires a clean TP Trees worktree");
}
const handoff = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  source: {
    repository: "doublemoreart-dotcom/tptrees",
    branch: sourceBranch || "detached",
    commit: sourceCommit,
    releaseSha256,
    workingTreeDirty,
  },
  releaseStatus: releaseStatusArg,
  artifact: {
    bundle: relative(siteRoot, bundle).replaceAll("\\", "/"),
    filename: basename(bundle),
    sha256: bundleSha256,
    sizeBytes: Number(bundleSizeArg),
    destinationPath: "tptrees/",
  },
  externalActionRequired: {
    coordinationRequired: true,
    authorizationRequired: true,
    publicationRepository: "doublemoreart-dotcom/dinopeng-com",
    separatedRepositories: [
      "doublemoreart-dotcom/aidata-portal",
      "doublemoreart-dotcom/dinopeng-com",
    ],
    action: releaseStatusArg === "source-ready"
      ? "A coordinating task must validate this immutable source commit, then separately authorize any portal integration and publication through doublemoreart-dotcom/dinopeng-com."
      : "Candidate only. This handoff must not be deployed; publish the TP Trees source first and generate a source-ready handoff.",
    permittedInThisSession: false,
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(handoff, null, 2)}\n`);
console.log(`handoff: ${relative(siteRoot, output)}`);
