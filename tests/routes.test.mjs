import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
const lifecycle = await readFile(new URL("../lifecycle/index.html", import.meta.url), "utf8");
const species = await readFile(new URL("../species/index.html", import.meta.url), "utf8");
const daily = await readFile(new URL("../daily/index.html", import.meta.url), "utf8");
const manifest = await readFile(new URL("../data/tree-data-manifest.json", import.meta.url), "utf8");

test("publishes the expected pages", () => {
  assert.match(home, /<title>臺北市行道樹小幫手現況<\/title>/);
  assert.match(lifecycle, /<title>樹木的生命履歷<\/title>/);
  assert.match(species, /<title>樹種科普｜臺北市行道樹小幫手<\/title>/);
  assert.match(daily, /<title>今天給我一棵樹｜臺北市行道樹小幫手<\/title>/);
});

test("home links to the core sections and pages", () => {
  assert.match(home, /href="#can-check"/);
  assert.match(home, /href="#gaps"/);
  assert.match(home, /href="\.\/lifecycle\/index\.html"/);
  assert.match(home, /href="\.\/species\/index\.html"/);
  assert.match(home, /href="\.\/daily\/index\.html"/);
});

test("lifecycle links back to the home sections", () => {
  assert.match(lifecycle, /href="\.\.\/index\.html#can-check"/);
  assert.match(lifecycle, /href="\.\.\/index\.html#gaps"/);
});

test("all pages expose the shared site identity", () => {
  for (const html of [home, lifecycle, species, daily]) {
    assert.match(html, /臺北市行道樹小幫手/);
  }
});

test("data manifest documents the current CSV snapshot", () => {
  const data = JSON.parse(manifest);
  assert.equal(data.rowCount, 164046);
  assert.equal(data.qualityChecks.requiredColumnsPresent, true);
  assert.equal(data.qualityChecks.duplicateTreeIds, 0);
});
