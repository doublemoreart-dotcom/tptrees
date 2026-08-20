import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, readFile, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createGzip } from "node:zlib";
import { dirname, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const outputArg = process.argv[2];

if (!outputArg || process.argv.length !== 3) {
  throw new Error("Usage: node scripts/build-release-archive.mjs <output.tar.gz>");
}

const output = resolve(outputArg);
const temporaryOutput = `${output}.tmp-${process.pid}`;
const releaseManifestPath = "data/site-release-manifest.json";
const releaseManifest = JSON.parse(await readFile(resolve(siteRoot, releaseManifestPath), "utf8"));
if (!releaseManifest.files || typeof releaseManifest.files !== "object" || Array.isArray(releaseManifest.files)) {
  throw new Error("Release manifest is missing its files map");
}
const entries = [];

function comparePaths(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function collectFile(path, expectedSha256) {
  const absolute = resolve(siteRoot, path);
  const local = relative(siteRoot, absolute).replaceAll("\\", "/");
  if (local === ".." || local.startsWith("../") || local !== path) {
    throw new Error(`Release path escapes the source repository: ${path}`);
  }

  const stat = await lstat(absolute);
  if (!stat.isFile()) throw new Error(`Unsupported release entry type: ${path}`);
  if (expectedSha256 && await sha256File(absolute) !== expectedSha256) {
    throw new Error(`Release file hash differs from site-release-manifest.json: ${path}`);
  }
  entries.push({ absolute, path, size: stat.size, mode: 0o644, type: "file" });
}

function writeString(header, value, offset, length) {
  const encoded = Buffer.from(value, "utf8");
  if (encoded.length > length) throw new Error(`Tar field is too long: ${value}`);
  encoded.copy(header, offset);
}

function writeOctal(header, value, offset, length) {
  const encoded = Math.trunc(value).toString(8).padStart(length - 1, "0");
  if (encoded.length >= length) throw new Error(`Tar number is too large: ${value}`);
  writeString(header, `${encoded}\0`, offset, length);
}

function createHeader(entry) {
  const header = Buffer.alloc(512);
  writeString(header, entry.path, 0, 100);
  writeOctal(header, entry.mode, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, entry.size, 124, 12);
  writeOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = entry.type === "directory" ? 0x35 : 0x30;
  writeString(header, "ustar", 257, 6);
  writeString(header, "00", 263, 2);
  writeString(header, "root", 265, 32);
  writeString(header, "root", 297, 32);

  const checksum = header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, "0");
  writeString(header, checksum, 148, 6);
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

async function* archiveChunks() {
  for (const entry of entries) {
    yield createHeader(entry);
    if (entry.type === "directory") continue;
    for await (const chunk of createReadStream(entry.absolute)) yield chunk;
    const remainder = entry.size % 512;
    if (remainder) yield Buffer.alloc(512 - remainder);
  }
  yield Buffer.alloc(1024);
}

const manifestFiles = Object.entries(releaseManifest.files).sort(([a], [b]) => comparePaths(a, b));
for (const [path, expectedSha256] of manifestFiles) await collectFile(path, expectedSha256);
await collectFile(releaseManifestPath);

const directories = new Set();
for (const { path } of entries) {
  const parts = path.split("/");
  parts.pop();
  while (parts.length) {
    directories.add(`${parts.join("/")}/`);
    parts.pop();
  }
}
for (const path of directories) entries.push({ path, size: 0, mode: 0o755, type: "directory" });
entries.sort((a, b) => comparePaths(a.path, b.path));

await mkdir(dirname(output), { recursive: true });
await rm(temporaryOutput, { force: true });

try {
  await pipeline(
    Readable.from(archiveChunks()),
    createGzip({ level: 9 }),
    createWriteStream(temporaryOutput, { mode: 0o644 }),
  );
  await rename(temporaryOutput, output);
} catch (error) {
  await rm(temporaryOutput, { force: true });
  throw error;
}

console.log(`deterministic archive: ${relative(siteRoot, output).replaceAll("\\", "/")} (${entries.length} entries)`);
