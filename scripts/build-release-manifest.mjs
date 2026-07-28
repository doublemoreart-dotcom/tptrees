import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const outputPath = resolve(siteRoot, "data/site-release-manifest.json");
const publishEntries = [
  "index.html",
  "favicon.svg",
  "favicon.ico",
  "app",
  "daily",
  "data",
  "lifecycle",
  "public",
  "species"
];
const excludedPaths = new Set([
  "data/site-release-manifest.json"
]);

async function collectFiles(path){
  const details = await stat(path);
  if(details.isFile()) return [path];

  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter(entry => entry.name !== "backups" && entry.name !== ".DS_Store")
    .map(entry => collectFiles(join(path, entry.name))));
  return nested.flat();
}

const files = (await Promise.all(publishEntries.map(entry => collectFiles(resolve(siteRoot, entry)))))
  .flat()
  .map(path => ({ path, name: relative(siteRoot, path).replaceAll("\\", "/") }))
  .filter(file => !excludedPaths.has(file.name))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const hashes = {};
for(const file of files){
  const content = await readFile(file.path);
  hashes[file.name] = createHash("sha256").update(content).digest("hex");
}

const releaseSha256 = createHash("sha256")
  .update(Object.entries(hashes).map(([name, hash]) => `${name}\0${hash}\n`).join(""))
  .digest("hex");

const manifest = {
  schemaVersion: 1,
  releaseSha256,
  fileCount: Object.keys(hashes).length,
  files: hashes
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`site release: ${releaseSha256.slice(0, 12)} (${manifest.fileCount} files)`);
