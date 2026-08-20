import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
const lifecycle = await readFile(new URL("../lifecycle/index.html", import.meta.url), "utf8");
const species = await readFile(new URL("../species/index.html", import.meta.url), "utf8");
const daily = await readFile(new URL("../daily/index.html", import.meta.url), "utf8");
const motion = await readFile(new URL("../app/motion.js", import.meta.url), "utf8");
const manifest = await readFile(new URL("../data/tree-data-manifest.json", import.meta.url), "utf8");
const releaseManifest = await readFile(new URL("../data/site-release-manifest.json", import.meta.url), "utf8");
const pages = [
  { html: home, file: new URL("../index.html", import.meta.url), canonical: "https://dinopeng.com/tptrees/" },
  { html: lifecycle, file: new URL("../lifecycle/index.html", import.meta.url), canonical: "https://dinopeng.com/tptrees/lifecycle/" },
  { html: species, file: new URL("../species/index.html", import.meta.url), canonical: "https://dinopeng.com/tptrees/species/" },
  { html: daily, file: new URL("../daily/index.html", import.meta.url), canonical: "https://dinopeng.com/tptrees/daily/" },
];
const sourceUrl = "https://data.taipei/dataset/detail?id=7a49d00c-a5ff-4a6b-be9e-aaa6dc1ff7e8";

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
  for (const { html } of pages) {
    assert.match(html, /臺北市行道樹小幫手/);
  }
});

test("all pages expose one main landmark separate from site navigation and footer", () => {
  for (const { html, file } of pages) {
    assert.match(html, /<html lang="zh-Hant">/);
    assert.equal(html.match(/<main\b/g)?.length, 1, `${file.pathname}: expected one main landmark`);
    assert.equal(html.match(/<h1\b/g)?.length, 1, `${file.pathname}: expected one h1`);

    const navigationStart = html.indexOf('<nav class="topNav"');
    const mainStart = html.indexOf("<main>");
    const mainEnd = html.indexOf("</main>");
    const footerStart = html.indexOf('<footer class="siteFooter"');
    assert.ok(navigationStart >= 0 && navigationStart < mainStart, `${file.pathname}: site navigation must precede main`);
    assert.ok(mainStart < mainEnd && mainEnd < footerStart, `${file.pathname}: footer must follow main`);
  }
});

test("interactive selector groups expose their selected button state", () => {
  assert.match(lifecycle, /<div class="modeGrid" role="group" aria-label="搜尋方式">/);
  const modeButtons = [...lifecycle.matchAll(/<button class="modeButton[^>]+>/g)].map((match) => match[0]);
  assert.equal(modeButtons.length, 4);
  assert.equal(modeButtons.filter((button) => button.includes('aria-pressed="true"')).length, 1);
  assert.ok(modeButtons.every((button) => /aria-pressed="(?:true|false)"/.test(button)));
  assert.match(lifecycle, /button\.setAttribute\("aria-pressed", String\(isActive\)\)/);

  assert.match(species, /<div class="speciesPicker" id="species-options" role="group" aria-label="樹種選項">/);
  assert.match(species, /data-pick-species=.*aria-pressed="\$\{String\(isActive\)\}"/);
  assert.match(species, /button\.setAttribute\("aria-pressed", String\(isActive\)\)/);
  assert.doesNotMatch(species, /role="listbox"|role="option"|aria-selected=/);
});

test("result dialogs expose labels and preserve keyboard focus context", () => {
  assert.match(lifecycle, /id="record" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="record-title"/);
  assert.match(lifecycle, /<h2 id="record-title">查驗結果與樹木履歷<\/h2>/);
  assert.match(lifecycle, /openModal\(resultModal, \(\) => modalClose\.focus\(\)\)/);
  assert.match(lifecycle, /if\(returnTarget\?\.isConnected\) returnTarget\.focus\(\)/);
  assert.match(lifecycle, /trapModalFocus\(resultModal,event\)/);

  assert.match(species, /id="species-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="detail-name"/);
  assert.match(species, /openModal\(modal, \(\) => closeButton\.focus\(\)\)/);
  assert.match(species, /if\(returnTarget\?\.isConnected\) returnTarget\.focus\(\)/);
  assert.match(species, /trapModalFocus\(modal,event\)/);
  assert.match(motion, /function openModal\(modal, ready\)/);
  assert.match(motion, /onComplete\(\)\{ if\(typeof ready === "function"\) ready\(\); \}/);
  assert.match(motion, /function trapModalFocus\(modal, event\)/);
  assert.match(motion, /window\.TPTreesMotion = \{openModal,closeModal,trapModalFocus,revealDynamic,animateNumber\}/);
});

test("query-string deep links restore lifecycle and species state", () => {
  assert.match(lifecycle, /function restoreSearchFromUrl\(\)/);
  assert.match(lifecycle, /params\.get\("treeId"\)/);
  assert.match(lifecycle, /params\.get\("district"\)/);
  assert.match(lifecycle, /params\.get\("species"\)/);
  assert.match(lifecycle, /if\(treeId\) selectedTreeId = treeId/);
  assert.match(lifecycle, /runSearch\(true\)/);
  assert.match(lifecycle, /if\(!restoreSearchFromUrl\(\)\) renderInitialState\(\)/);

  assert.match(species, /function getSourceContext\(\)/);
  assert.match(species, /params\.get\("treeId"\)/);
  assert.match(species, /params\.get\("district"\)/);
  assert.match(species, /const requested = new URLSearchParams\(location\.search\)\.get\("species"\)/);
  assert.match(species, /showSpecies\(initial\.name, initial\.shouldOpen\)/);
});

test("all pages declare canonical URLs that match their Open Graph URLs", () => {
  for (const { html, canonical } of pages) {
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}">`));
  }
});

test("all pages link to the official source dataset", () => {
  for (const { html } of pages) {
    assert.ok(html.includes(`href="${sourceUrl}"`));
    assert.match(html, /target="_blank" rel="noopener"/);
  }
});

test("all static local page references resolve within the deployment prefix", async () => {
  for (const { html, file } of pages) {
    const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

    for (const reference of references) {
      if (reference.includes("${") || /^(?:https?:|mailto:|tel:|data:)/.test(reference)) continue;
      assert.ok(!reference.startsWith("/"), `${file.pathname}: root-relative reference bypasses /tptrees/: ${reference}`);

      const target = new URL(reference, file);
      const fragment = decodeURIComponent(target.hash.slice(1));
      target.hash = "";
      target.search = "";
      const targetContents = await readFile(target, "utf8");

      if (fragment) {
        assert.ok(
          targetContents.includes(`id="${fragment}"`),
          `${file.pathname}: missing fragment target ${reference}`,
        );
      }
    }
  }
});

test("data manifest documents the current CSV snapshot", () => {
  const data = JSON.parse(manifest);
  assert.equal(data.rowCount, 164046);
  assert.equal(data.qualityChecks.requiredColumnsPresent, true);
  assert.equal(data.qualityChecks.duplicateTreeIds, 0);
});

test("release manifest fingerprints every public dependency", () => {
  const data = JSON.parse(releaseManifest);
  assert.match(data.releaseSha256, /^[a-f0-9]{64}$/);
  assert.ok(data.fileCount > 10);
  for(const path of [
    "index.html",
    "app/motion.css",
    "app/motion.js",
    "app/vendor/gsap.min.js",
    "public/social-preview.png",
    "data/tree-records.js"
  ]){
    assert.match(data.files[path], /^[a-f0-9]{64}$/, `${path} should be fingerprinted`);
  }
});
