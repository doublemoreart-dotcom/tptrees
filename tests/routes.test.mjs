import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
const lifecycle = await readFile(new URL("../lifecycle/index.html", import.meta.url), "utf8");

test("publishes the two expected pages", () => {
  assert.match(home, /<title>臺北市行道樹公開資料現況<\/title>/);
  assert.match(lifecycle, /<title>查驗的城市樹木生命履歷<\/title>/);
});

test("home links to lifecycle below the tptrees prefix", () => {
  assert.match(home, /href="\/tptrees\/lifecycle\/"/);
});

test("lifecycle links back to the home sections", () => {
  assert.match(lifecycle, /href="\/tptrees\/#can-check"/);
  assert.match(lifecycle, /href="\/tptrees\/#gaps"/);
});

test("both pages expose the shared site identity", () => {
  for (const html of [home, lifecycle]) {
    assert.match(html, /class="siteMark" href="\/tptrees\/"/);
  }
});
