import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const csvPath = resolve(siteRoot, "data", "TaipeiTree.csv");
const manifestPath = resolve(siteRoot, "data", "tree-data-manifest.json");
const recordsPath = resolve(siteRoot, "data", "tree-records.js");
const sourceCsvUrl = "https://tppkl.blob.core.windows.net/blobfs/TaipeiTree.csv";

const text = await readFile(csvPath, "utf8");

async function readExistingManifest(){
  try{
    return JSON.parse(await readFile(manifestPath, "utf8"));
  }catch{
    return null;
  }
}

function parseCsv(csvText){
  const parsedRows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for(let index = 0; index < csvText.length; index += 1){
    const char = csvText[index];
    const next = csvText[index + 1];
    if(char === "\"" && inQuotes && next === "\""){
      cell += "\"";
      index += 1;
    }else if(char === "\""){
      inQuotes = !inQuotes;
    }else if(char === "," && !inQuotes){
      row.push(cell.trim());
      cell = "";
    }else if((char === "\n" || char === "\r") && !inQuotes){
      if(char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if(row.some(value => value !== "")) parsedRows.push(row);
      row = [];
      cell = "";
    }else{
      cell += char;
    }
  }
  row.push(cell.trim());
  if(row.some(value => value !== "")) parsedRows.push(row);
  return parsedRows;
}

function countBy(rows, index){
  const counts = new Map();
  for(const row of rows){
    const value = row[index] || "";
    if(!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"));
}

function isReasonableNumber(value, min, max){
  if(value === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

const parsedRows = parseCsv(text);
const headers = parsedRows[0] ?? [];
const dataRows = parsedRows.slice(1);
const recordColumns = ["TreeID","Dist","Region","RegionRemark","TreeType","Diameter","TreeHeight","SurveyDate","TWD97X","TWD97Y"];
const requiredColumns = ["TreeID","Dist","Region","TreeType","Diameter","TreeHeight","SurveyDate"];
const missingRequiredColumns = requiredColumns.filter(column => !headers.includes(column));

if(!headers.length){
  throw new Error("CSV has no header row.");
}

if(missingRequiredColumns.length){
  throw new Error(`CSV missing required columns: ${missingRequiredColumns.join(", ")}`);
}

if(dataRows.length < 50000){
  throw new Error(`CSV row count is unexpectedly low: ${dataRows.length}`);
}

const recordIndexes = recordColumns.map(column => headers.indexOf(column));
const compactRecords = dataRows.map(row => recordIndexes.map(index => index >= 0 ? row[index] || "" : ""));
const headerIndexes = Object.fromEntries(headers.map((header, index) => [header, index]));
const treeIdIndex = headerIndexes.TreeID;
const districtIndex = headerIndexes.Dist;
const roadIndex = headerIndexes.Region;
const speciesIndex = headerIndexes.TreeType;
const diameterIndex = headerIndexes.Diameter;
const heightIndex = headerIndexes.TreeHeight;
const surveyDateIndex = headerIndexes.SurveyDate;
const xIndex = headerIndexes.TWD97X;
const yIndex = headerIndexes.TWD97Y;

const seenIds = new Set();
let duplicateTreeIds = 0;
let missingTreeIds = 0;
let missingSpecies = 0;
let missingDistrict = 0;
let missingRoad = 0;
let missingSurveyDate = 0;
let missingCoordinates = 0;
let suspiciousDiameter = 0;
let suspiciousHeight = 0;

for(const row of dataRows){
  const treeId = row[treeIdIndex] || "";
  if(!treeId){
    missingTreeIds += 1;
  }else if(seenIds.has(treeId)){
    duplicateTreeIds += 1;
  }else{
    seenIds.add(treeId);
  }

  if(!(row[speciesIndex] || "")) missingSpecies += 1;
  if(!(row[districtIndex] || "")) missingDistrict += 1;
  if(!(row[roadIndex] || "")) missingRoad += 1;
  if(!(row[surveyDateIndex] || "")) missingSurveyDate += 1;
  if(!(row[xIndex] || "") || !(row[yIndex] || "")) missingCoordinates += 1;
  if(!isReasonableNumber(row[diameterIndex] || "", 0.1, 500)) suspiciousDiameter += 1;
  if(!isReasonableNumber(row[heightIndex] || "", 0.1, 80)) suspiciousHeight += 1;
}

const topSpecies = countBy(dataRows, speciesIndex).slice(0, 10).map(([name, count]) => ({ name, count }));
const districtCounts = countBy(dataRows, districtIndex).map(([name, count]) => ({ name, count }));
const csvHash = createHash("sha256").update(text).digest("hex");
const recordsHash = createHash("sha256").update(JSON.stringify(compactRecords)).digest("hex");
const existingManifest = await readExistingManifest();
const csvUnchanged = existingManifest?.csvSha256 === csvHash;
const now = new Date().toISOString();

const qualityChecks = {
  requiredColumnsPresent: true,
  rowCountAboveMinimum: dataRows.length >= 50000,
  missingTreeIds,
  duplicateTreeIds,
  missingSpecies,
  missingDistrict,
  missingRoad,
  missingSurveyDate,
  missingCoordinates,
  suspiciousDiameter,
  suspiciousHeight
};

const manifest = {
  dataset: "臺北市行道樹分布圖",
  resource: "行道樹資料_CSV",
  sourcePage: "https://data.taipei/dataset/detail?id=7a49d00c-a5ff-4a6b-be9e-aaa6dc1ff7e8",
  sourceCsv: sourceCsvUrl,
  localCsv: relative(siteRoot, csvPath),
  generatedAt: csvUnchanged && existingManifest?.generatedAt ? existingManifest.generatedAt : now,
  updatedAt: csvUnchanged && existingManifest?.updatedAt ? existingManifest.updatedAt : now,
  csvSha256: csvHash,
  recordsSha256: recordsHash,
  rowCount: dataRows.length,
  columns: headers,
  generatedFiles: [
    relative(siteRoot, manifestPath),
    relative(siteRoot, recordsPath)
  ],
  fieldMap: {
    treeId: "TreeID",
    district: "Dist",
    road: "Region",
    note: "RegionRemark",
    species: "TreeType",
    diameterCm: "Diameter",
    heightM: "TreeHeight",
    surveyDate: "SurveyDate",
    coordinateX: "TWD97X",
    coordinateY: "TWD97Y",
    sourceUpdatedAt: "UpdDate"
  },
  summary: {
    topSpecies,
    districtCounts
  },
  qualityChecks,
  websiteUse: [
    "lifecycle/index.html 與 species/index.html 會優先讀取 data/tree-records.js 作為本機靜態資料鏡像",
    "data/tree-records.js 由 data/TaipeiTree.csv 產生，供 file:// 與靜態測試使用",
    "CSV 僅作為內部資料來源，不提供一般使用者手動匯入",
    "首頁仍為說明頁；生命履歷頁負責資料查驗與欄位異常提示"
  ]
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(
  recordsPath,
  `// Generated from data/TaipeiTree.csv. Do not edit by hand.\nwindow.TAIPEI_TREE_RECORD_COLUMNS=${JSON.stringify(recordColumns)};\nwindow.TAIPEI_TREE_RECORDS=${JSON.stringify(compactRecords)};\n`,
  "utf8"
);

console.log(`manifest written: ${manifestPath}`);
console.log(`records written: ${recordsPath}`);
console.log(`rows: ${manifest.rowCount}`);
console.log(`csv sha256: ${manifest.csvSha256}`);
console.log(`quality: ${JSON.stringify(qualityChecks)}`);
