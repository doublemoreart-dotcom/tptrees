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
  bundleSha256,
  bundleSizeArg,
] = process.argv.slice(2);

if (!outputArg || !bundleArg || !releaseSha256 || !sourceCommit || !bundleSha256 || !bundleSizeArg) {
  throw new Error(
    "Usage: write-release-handoff.mjs <output> <bundle> <release> <commit> <branch> <dirty> <bundle-sha256> <bundle-size>",
  );
}

const output = resolve(outputArg);
const bundle = resolve(bundleArg);
const workingTreeDirty = dirtyArg === "true";
const handoff = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    repository: "doublemoreart-dotcom/tptrees",
    branch: sourceBranch || "detached",
    commit: sourceCommit,
    releaseSha256,
    workingTreeDirty,
  },
  releaseStatus: workingTreeDirty ? "candidate" : "source-ready",
  artifact: {
    bundle: relative(siteRoot, bundle).replaceAll("\\", "/"),
    filename: basename(bundle),
    sha256: bundleSha256,
    sizeBytes: Number(bundleSizeArg),
    destinationPath: "tptrees/",
  },
  externalActionRequired: {
    repository: "doublemoreart-dotcom/aidata-portal",
    action: "After the source commit is published, replace the tptrees/ snapshot with the verified bundle contents, then deploy and verify the live release fingerprint.",
    permittedInThisSession: false,
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(handoff, null, 2)}\n`);
console.log(`handoff: ${relative(siteRoot, output)}`);
