import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(new URL("..", import.meta.url).pathname);
const sourcesPath = resolve(siteRoot, "data", "species-image-sources.json");

const badPattern = /logo|icon|map|diagram|svg|botanical magazine|theatre|theater|stage|performance|tour|sutra|juice|\bwood\b|timber|award|television|movie|festival|typhoon|disaster|手作|溜溜球|劇場|表演|經|木材|果汁|電視節|劇組|獎|颱風|災後|國軍|作戰/i;

const source = JSON.parse(await readFile(sourcesPath, "utf8"));
const items = source.items || {};
const entries = Object.entries(items).filter(([, item]) => item?.imageUrl);
const missingAttribution = entries
  .filter(([, item]) => !item.imageTitle || !item.sourceUrl || !item.author || !item.license)
  .map(([species, item]) => ({
    species,
    imageTitle: item.imageTitle || "未提供圖片標題",
    missing: [
      ["imageTitle", item.imageTitle],
      ["sourceUrl", item.sourceUrl],
      ["author", item.author],
      ["license", item.license]
    ].filter(([, value]) => !value).map(([key]) => key)
  }));
const suspicious = entries
  .filter(([, item]) => badPattern.test([
    item.imageTitle,
    item.description,
    item.sourceUrl
  ].join(" ")))
  .map(([species, item]) => ({
    species,
    imageTitle: item.imageTitle
  }));

const totalSpecies = source.coverage?.totalSpecies || 0;
const imageSources = entries.length;
const missing = Math.max(totalSpecies - imageSources, 0);
const coverageRate = totalSpecies ? imageSources / totalSpecies : 0;

console.log(`species images: ${imageSources}/${totalSpecies}`);
console.log(`missing species images: ${missing}`);
console.log(`coverage rate: ${(coverageRate * 100).toFixed(1)}%`);

if(source.lastRun){
  const failures = source.lastRun.failures || [];
  console.log(`last image update: ${source.lastRun.updatedAt || source.lastRun.date || source.updatedAt || "unknown"}`);
  console.log(`last attempted: ${source.lastRun.attempted || 0}`);
  console.log(`last added: ${source.lastRun.added || 0}`);
  console.log(`last failed: ${failures.length}`);
  if(failures.length){
    console.log("");
    console.log("Recent missing image candidates:");
    for(const item of failures.slice(0, 12)){
      console.log(`- ${item.species}: ${item.reason || "not found"}`);
    }
    if(failures.length > 12){
      console.log(`...and ${failures.length - 12} more`);
    }
  }
}

if(missingAttribution.length){
  console.log("");
  console.log("Image sources missing attribution fields:");
  for(const item of missingAttribution.slice(0, 20)){
    console.log(`- ${item.species}: ${item.imageTitle} (${item.missing.join(", ")})`);
  }
  if(missingAttribution.length > 20){
    console.log(`...and ${missingAttribution.length - 20} more`);
  }
  process.exitCode = 1;
}

if(suspicious.length){
  console.log("");
  console.log("Suspicious image titles:");
  for(const item of suspicious.slice(0, 20)){
    console.log(`- ${item.species}: ${item.imageTitle}`);
  }
  if(suspicious.length > 20){
    console.log(`...and ${suspicious.length - 20} more`);
  }
  process.exitCode = 1;
}
