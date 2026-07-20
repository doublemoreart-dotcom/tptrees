#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SITE_ROOT/data/tree-data-manifest.json"

cd "$SITE_ROOT"

echo "1/7 Verify inline JavaScript"
node scripts/verify-static-pages.mjs

echo ""
echo "2/7 Verify routes and data manifest"
node --test tests/routes.test.mjs

echo ""
echo "3/7 Data snapshot"
node -e '
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync("data/tree-data-manifest.json", "utf8"));
console.log(`rows: ${manifest.rowCount}`);
console.log(`generatedAt: ${manifest.generatedAt}`);
console.log(`csvSha256: ${manifest.csvSha256}`);
console.log(`missingRoad: ${manifest.qualityChecks.missingRoad}`);
console.log(`missingSurveyDate: ${manifest.qualityChecks.missingSurveyDate}`);
console.log(`suspiciousDiameter: ${manifest.qualityChecks.suspiciousDiameter}`);
console.log(`suspiciousHeight: ${manifest.qualityChecks.suspiciousHeight}`);
'

echo ""
echo "4/7 Species image source snapshot"
node scripts/check-species-images.mjs

echo ""
echo "5/7 Brand asset snapshot"
node -e '
const fs = require("node:fs");
const required = ["favicon.svg", "favicon.ico", "public/social-preview.svg", "public/social-preview.png", "app/analytics.js", "app/heroicons.js"];
for(const file of required){
  const stat = fs.statSync(file);
  console.log(`${file}: ${stat.size} bytes`);
}
const svgStat = fs.statSync("public/social-preview.svg");
const pngStat = fs.statSync("public/social-preview.png");
if(svgStat.mtimeMs - pngStat.mtimeMs > 1000){
  throw new Error("public/social-preview.png is older than public/social-preview.svg; run bash scripts/render-social-preview-png.sh");
}
const pages = ["index.html", "lifecycle/index.html", "species/index.html", "daily/index.html"];
for(const page of pages){
  const html = fs.readFileSync(page, "utf8");
  if(!html.includes("favicon.ico") || !html.includes("og:image") || !html.includes("twitter:image")){
    throw new Error(`${page} missing favicon or social image metadata`);
  }
  if(!html.includes("app/analytics.js")){
    throw new Error(`${page} missing analytics script`);
  }
  if(!html.includes("app/heroicons.js")){
    throw new Error(`${page} missing heroicons script`);
  }
}
console.log("social metadata, analytics and heroicons: ok");
'

echo ""
echo "6/7 Daily card interaction snapshot"
node -e '
const fs = require("node:fs");
const html = fs.readFileSync("daily/index.html", "utf8");
const checks = [
  ["draw tree button", "id=\"draw-card\""],
  ["share tree button", "id=\"share-card\""],
  ["download share image button", "id=\"download-card\""],
  ["share current card function", "function shareCurrentCard()"],
  ["download current card function", "async function downloadCurrentCard()"],
  ["canonical daily share URL", "https://dinopeng.com/tptrees/daily/?tree="]
];
for(const [label, needle] of checks){
  if(!html.includes(needle)){
    throw new Error(`daily/index.html missing ${label}`);
  }
}
console.log("daily card share and download interactions: ok");
'

echo ""
echo "7/7 Git status"
git status --short

echo ""
echo "Preflight complete."
