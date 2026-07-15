import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const recordsPath = resolve(siteRoot, "data", "tree-records.js");
const sourcesPath = resolve(siteRoot, "data", "species-image-sources.json");
const sourcesJsPath = resolve(siteRoot, "data", "species-image-sources.js");
const today = new Date().toISOString().slice(0, 10);

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find(arg => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const dryRun = args.has("--dry-run");
const overwrite = args.has("--overwrite");

const speciesSearchTerms = {
  "阿勃勒": ["Cassia fistula", "golden shower tree"],
  "木棉": ["Bombax ceiba", "red silk cotton tree"],
  "垂榕": ["Ficus benjamina", "weeping fig"],
  "蒲葵": ["Livistona chinensis", "Chinese fan palm"],
  "烏桕": ["Triadica sebifera", "Chinese tallow"],
  "芒果": ["Mangifera indica", "mango tree"],
  "黃椰子": ["Dypsis lutescens", "areca palm"],
  "紫薇": ["Lagerstroemia indica", "crape myrtle"],
  "流蘇": ["Chionanthus retusus", "Chinese fringe tree"],
  "白玉蘭": ["Magnolia denudata", "yulan magnolia"],
  "桃花心木": ["Swietenia mahagoni", "mahogany tree"],
  "波羅蜜": ["Artocarpus heterophyllus", "jackfruit tree"],
  "山陀兒": ["Sandoricum koetjape", "santol tree"],
  "銀合歡": ["Leucaena leucocephala"],
  "柳橙": ["Citrus sinensis", "orange tree"],
  "梅": ["Prunus mume", "Japanese apricot"],
  "光蠟樹": ["Fraxinus griffithii"],
  "苦楝": ["Melia azedarach", "chinaberry tree"],
  "福木": ["Garcinia subelliptica"],
  "菩提樹": ["Ficus religiosa", "sacred fig"]
};

function stripHtml(value = ""){
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(title = ""){
  return String(title).replace(/^File:/, "");
}

function compactLicenseUrl(url = ""){
  return String(url || "").replace(/^http:/, "https:");
}

function getMetadata(imageInfo = {}, key){
  return imageInfo.extmetadata?.[key]?.value || "";
}

async function getJson(url){
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TP-Trees image source updater (https://dinopeng.com/tptrees/)"
    }
  });
  if(!response.ok){
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function buildSearchUrl(query){
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "8",
    gsrsearch: query,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime"
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

function buildImageInfoUrl(fileName){
  const title = fileName.startsWith("File:") ? fileName : `File:${fileName}`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: title,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime"
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

function buildWikidataSearchUrl(species){
  const params = new URLSearchParams({
    action: "wbsearchentities",
    format: "json",
    origin: "*",
    language: "zh",
    uselang: "zh",
    type: "item",
    limit: "5",
    search: species
  });
  return `https://www.wikidata.org/w/api.php?${params.toString()}`;
}

function buildWikidataEntityUrl(id){
  const params = new URLSearchParams({
    action: "wbgetentities",
    format: "json",
    origin: "*",
    ids: id,
    props: "labels|aliases|descriptions|claims",
    languages: "zh|zh-hant|en"
  });
  return `https://www.wikidata.org/w/api.php?${params.toString()}`;
}

function claimValue(entity, property){
  return entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
}

function entityNames(entity){
  const values = [];
  for(const value of Object.values(entity.labels || {})){
    if(value?.value) values.push(value.value);
  }
  for(const aliases of Object.values(entity.aliases || {})){
    for(const alias of aliases || []){
      if(alias?.value) values.push(alias.value);
    }
  }
  return values;
}

function entityMatchesSpecies(entity, species){
  return entityNames(entity).some(name => {
    const normalized = String(name).replace(/\s+/g, "");
    return normalized === species || normalized.includes(species);
  });
}

function scorePage(species, page, terms = []){
  const info = page.imageinfo?.[0] || {};
  const title = normalizeTitle(page.title || "");
  const description = stripHtml(getMetadata(info, "ImageDescription"));
  const categories = stripHtml(getMetadata(info, "Categories"));
  const mime = info.mime || "";
  const lowerTitle = title.toLowerCase();
  const lowerDescription = description.toLowerCase();
  const lowerCategories = categories.toLowerCase();
  const combined = `${lowerTitle} ${lowerDescription} ${lowerCategories}`;
  const hasPlantContext = /tree|plant|flora|leaf|leaves|flower|fruit|bark|trunk|botanic|botanical|arboretum|genus|species|樹|植物|葉|花|果|樹幹|森林|公園|園藝|木本/i.test(combined);
  const badContext = /logo|icon|map|diagram|svg|botanical magazine|theatre|theater|stage|performance|tour|sutra|juice|\bwood\b|timber|award|television|movie|festival|typhoon|disaster|手作|溜溜球|劇場|表演|經|木材|果汁|電視節|劇組|獎|颱風|災後|國軍|作戰/i.test(combined);
  let score = 0;
  if(/^image\/(jpeg|png|webp)$/i.test(mime)) score += 20;
  if(title.includes(species)) score += 60;
  if(description.includes(species)) score += 20;
  if(categories.includes(species)) score += 15;
  for(const term of terms){
    const normalized = String(term).toLowerCase();
    if(lowerTitle.includes(normalized)) score += 60;
    if(lowerDescription.includes(normalized)) score += 20;
    if(lowerCategories.includes(normalized)) score += 15;
  }
  if(getMetadata(info, "LicenseShortName")) score += 8;
  if(getMetadata(info, "Artist")) score += 4;
  if(hasPlantContext) score += 10;
  if(!hasPlantContext) score -= 50;
  if(badContext) score -= 80;
  return score;
}

function itemFromCommonsPage(species, page, scientificName = "", via = "Wikimedia Commons API"){
  const info = page.imageinfo?.[0] || {};
  const license = stripHtml(getMetadata(info, "LicenseShortName") || getMetadata(info, "UsageTerms") || "未提供");
  const licenseUrl = compactLicenseUrl(getMetadata(info, "LicenseUrl"));
  return {
    species,
    scientificName,
    provider: "Wikimedia Commons",
    imageTitle: page.title,
    imageUrl: info.url,
    sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`,
    author: stripHtml(getMetadata(info, "Artist") || "未提供"),
    license,
    licenseUrl,
    description: stripHtml(getMetadata(info, "ImageDescription")),
    retrievedAt: today,
    note: `由 scripts/update-species-images.mjs 透過 ${via} 補入；圖片來源與授權以 Wikimedia Commons 檔案頁為準。`
  };
}

async function findCommonsImage(species){
  const terms = speciesSearchTerms[species] || [];
  const queries = [...terms, `${species} tree`, species, `${species} 樹`];
  const seen = new Set();
  const candidates = [];

  for(const query of queries){
    const data = await getJson(buildSearchUrl(query));
    const pages = Object.values(data.query?.pages || {});
    for(const page of pages){
      if(seen.has(page.title)) continue;
      seen.add(page.title);
      const info = page.imageinfo?.[0];
      if(!info?.url || !/^image\/(jpeg|png|webp)$/i.test(info.mime || "")) continue;
      candidates.push({ page, score: scorePage(species, page, terms) });
    }
    if(candidates.some(candidate => candidate.score >= 80)) break;
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if(!best || best.score < 70) return null;

  return itemFromCommonsPage(species, best.page);
}

async function findWikidataImage(species){
  const search = await getJson(buildWikidataSearchUrl(species));
  for(const result of search.search || []){
    const entityData = await getJson(buildWikidataEntityUrl(result.id));
    const entity = entityData.entities?.[result.id];
    if(!entity || !entityMatchesSpecies(entity, species)) continue;

    const taxonName = claimValue(entity, "P225") || "";
    if(!taxonName) continue;
    const fileName = claimValue(entity, "P18");
    if(!fileName) continue;
    const imageData = await getJson(buildImageInfoUrl(fileName));
    const page = Object.values(imageData.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    if(!info?.url || !/^image\/(jpeg|png|webp)$/i.test(info.mime || "")) continue;
    return itemFromCommonsPage(species, page, taxonName, "Wikidata 圖片欄位與 Wikimedia Commons API");
  }
  return null;
}

async function findSpeciesImage(species){
  return await findCommonsImage(species) || await findWikidataImage(species);
}

function loadRecords(source){
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  const columns = context.window.TAIPEI_TREE_RECORD_COLUMNS || [];
  const records = context.window.TAIPEI_TREE_RECORDS || [];
  const speciesIndex = columns.indexOf("TreeType");
  const counts = new Map();
  for(const row of records){
    const species = String(row[speciesIndex] || "").trim();
    if(species) counts.set(species, (counts.get(species) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"));
}

function buildJs(items){
  return `// Generated from data/species-image-sources.json. Do not edit by hand.\nwindow.SPECIES_IMAGE_SOURCES=${JSON.stringify(items)};\n`;
}

const [recordsSource, sourcesSource] = await Promise.all([
  readFile(recordsPath, "utf8"),
  readFile(sourcesPath, "utf8")
]);
const speciesCounts = loadRecords(recordsSource);
const sources = JSON.parse(sourcesSource);
sources.items ||= {};

const missing = speciesCounts
  .filter(([species]) => overwrite || !sources.items[species]?.imageUrl)
  .slice(0, Number.isFinite(limit) ? limit : undefined);

let added = 0;
let missed = 0;
const failures = [];

for(const [species, count] of missing){
  try{
    const item = await findSpeciesImage(species);
    if(item){
      sources.items[species] = item;
      added += 1;
      console.log(`OK ${species} (${count}) -> ${item.imageTitle}`);
    }else{
      missed += 1;
      failures.push({ species, count, reason: "no suitable Wikimedia Commons or Wikidata image" });
      console.log(`MISS ${species} (${count})`);
    }
  }catch(error){
    missed += 1;
    failures.push({ species, count, reason: error.message });
    console.log(`FAIL ${species} (${count}) ${error.message}`);
  }
}

sources.updatedAt = new Date().toISOString();
sources.coverage = {
  totalSpecies: speciesCounts.length,
  imageSources: Object.values(sources.items).filter(item => item?.imageUrl).length,
  missing: speciesCounts.filter(([species]) => !sources.items[species]?.imageUrl).length
};
sources.lastRun = {
  date: new Date().toISOString(),
  attempted: missing.length,
  added,
  missed,
  failures
};

if(!dryRun){
  await writeFile(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");
  await writeFile(sourcesJsPath, buildJs(sources.items), "utf8");
}

console.log(`coverage: ${sources.coverage.imageSources}/${sources.coverage.totalSpecies}`);
console.log(`added: ${added}, missed: ${missed}${dryRun ? " (dry run)" : ""}`);
