#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST="$SITE_ROOT/data/tree-data-manifest.json"

cd "$SITE_ROOT"

echo "1/5 Verify inline JavaScript"
node scripts/verify-static-pages.mjs

echo ""
echo "2/5 Verify routes and data manifest"
node --test tests/routes.test.mjs

echo ""
echo "3/5 Data snapshot"
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
echo "4/5 Species image source snapshot"
node scripts/check-species-images.mjs

echo ""
echo "5/5 Git status"
git status --short

echo ""
echo "Preflight complete."
