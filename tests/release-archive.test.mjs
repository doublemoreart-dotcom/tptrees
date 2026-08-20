import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const builder = new URL("../scripts/build-release-archive.mjs", import.meta.url);

function runBuilder(output) {
  return spawnSync(process.execPath, [builder.pathname, output], {
    cwd: siteRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

test("release archives are byte-for-byte reproducible", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "tptrees-release-archive-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = join(directory, "first.tar.gz");
  const second = join(directory, "second.tar.gz");

  for (const output of [first, second]) {
    const result = runBuilder(output);
    assert.equal(result.status, 0, result.stderr);
  }

  const firstData = await readFile(first);
  const secondData = await readFile(second);
  assert.equal(sha256(firstData), sha256(secondData));
  assert.deepEqual(firstData, secondData);
});

test("release archives contain only the expected public tree", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "tptrees-release-contents-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const archive = join(directory, "bundle.tar.gz");
  const build = runBuilder(archive);
  assert.equal(build.status, 0, build.stderr);

  const listing = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
  assert.equal(listing.status, 0, listing.stderr);
  const paths = new Set(listing.stdout.trim().split("\n"));
  for (const required of [
    "index.html",
    "lifecycle/index.html",
    "species/index.html",
    "daily/index.html",
    "data/site-release-manifest.json",
  ]) {
    assert.ok(paths.has(required), `archive should contain ${required}`);
  }
  for (const path of paths) {
    assert.doesNotMatch(path, /^(?:docs|scripts|tests|\.github|data\/backups)(?:\/|$)/);
    assert.notEqual(path, "CNAME");
  }

  const manifest = JSON.parse(await readFile(new URL("../data/site-release-manifest.json", import.meta.url), "utf8"));
  const archiveFiles = [...paths].filter((path) => !path.endsWith("/")).sort();
  const expectedFiles = [...Object.keys(manifest.files), "data/site-release-manifest.json"].sort();
  assert.deepEqual(archiveFiles, expectedFiles);
});

test("every static page dependency is part of the fingerprinted release", async () => {
  const manifest = JSON.parse(await readFile(new URL("../data/site-release-manifest.json", import.meta.url), "utf8"));
  const fingerprinted = new Set(Object.keys(manifest.files));
  const pages = ["index.html", "lifecycle/index.html", "species/index.html", "daily/index.html"];

  for (const page of pages) {
    const html = await readFile(new URL(`../${page}`, import.meta.url), "utf8");
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const reference = match[1];
      if (!reference || reference.startsWith("#") || reference.includes("${") || /^[a-z][a-z0-9+.-]*:/i.test(reference)) continue;
      const clean = reference.split(/[?#]/, 1)[0];
      if (!clean) continue;
      let dependency = normalize(join(dirname(page), clean)).replaceAll("\\", "/");
      if (dependency.endsWith("/")) dependency += "index.html";
      assert.ok(fingerprinted.has(dependency), `${page} dependency should be fingerprinted: ${dependency}`);
    }
  }
});
