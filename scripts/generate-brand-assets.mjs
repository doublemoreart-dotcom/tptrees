import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const publicDir = resolve(siteRoot, "public");

const colors = {
  bg: "#f5f1e8",
  ink: "#102019",
  forest: "#174b3f",
  leaf: "#2f7f55",
  lime: "#bddc7a",
  clay: "#b96444",
  paper: "#fffdf7"
};

const socialPreview = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
  <title id="title">臺北市行道樹小幫手</title>
  <desc id="desc">用公開資料找到一棵樹、看懂它、知道資料缺口。</desc>
  <defs>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0H0V44" fill="none" stroke="#174b3f" stroke-opacity=".07" stroke-width="1"/>
    </pattern>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#102019" flood-opacity=".16"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="${colors.bg}"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="74" y="70" width="1052" height="490" rx="42" fill="${colors.ink}" filter="url(#softShadow)"/>
  <g transform="translate(850 146)">
    <circle cx="86" cy="86" r="86" fill="${colors.paper}" opacity=".98"/>
    <path fill="${colors.forest}" d="M86 150c-5.4 0-9.6-4.2-9.6-9.6v-36.5C67.3 112 56.4 116 43.9 116 20.9 116 6.4 102.1 6.4 80.5 6.4 57.2 24 42.1 50.1 42.1c16.5 0 28.7 6.2 35.9 17.6 7.1-11.4 19.4-17.6 35.9-17.6 26.1 0 43.7 15.1 43.7 38.4 0 21.6-14.5 35.5-37.5 35.5-12.5 0-23.3-4-32.5-12.1v36.5c0 5.4-4.2 9.6-9.6 9.6Z"/>
    <path fill="${colors.lime}" d="M47.6 98.2c-14.5 0-23-6.8-23-17.7 0-12 10-19.6 25.6-19.6 13.1 0 22.7 6 27.6 17.3-6.8 13.1-16.5 20-30.2 20Zm76.8 0c-13.7 0-23.3-6.9-30.2-20 4.8-11.3 14.5-17.3 27.6-17.3 15.7 0 25.6 7.7 25.6 19.6 0 10.8-8.5 17.7-23 17.7Z"/>
  </g>
  <text x="126" y="154" fill="${colors.clay}" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif" font-size="28" font-weight="800">臺北市行道樹小幫手</text>
  <text x="126" y="254" fill="${colors.paper}" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif" font-size="78" font-weight="900">找到它・看懂它</text>
  <text x="126" y="344" fill="${colors.paper}" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif" font-size="78" font-weight="900">知道缺口</text>
  <text x="126" y="426" fill="#d9dfd8" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif" font-size="32" font-weight="700">從臺北市行道樹公開資料開始，查位置、樹種、尺寸與資料狀態。</text>
  <g transform="translate(126 480)">
    <rect x="0" y="0" width="158" height="50" rx="25" fill="#e7f0e7"/>
    <rect x="174" y="0" width="158" height="50" rx="25" fill="#e7f0e7"/>
    <rect x="348" y="0" width="158" height="50" rx="25" fill="#e7f0e7"/>
    <text x="32" y="34" fill="${colors.forest}" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif" font-size="23" font-weight="850">樹木履歷</text>
    <text x="206" y="34" fill="${colors.forest}" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif" font-size="23" font-weight="850">樹種科普</text>
    <text x="380" y="34" fill="${colors.forest}" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif" font-size="23" font-weight="850">今日一樹</text>
  </g>
</svg>
`;

function pngChunk(type, data){
  const typeBuffer = Buffer.from(type);
  const chunk = Buffer.concat([typeBuffer, data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(chunk), 8 + data.length);
  return out;
}

function crc32(buffer){
  let crc = 0xffffffff;
  for(const byte of buffer){
    crc ^= byte;
    for(let bit = 0; bit < 8; bit += 1){
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPng(width, height, drawPixel){
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for(let y = 0; y < height; y += 1){
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for(let x = 0; x < width; x += 1){
      const [r, g, b, a] = drawPixel(x, y);
      const offset = rowStart + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function hexToRgba(hex, alpha = 255){
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    alpha
  ];
}

function inRoundedRect(x, y, width, height, radius){
  const rx = Math.min(x, width - 1 - x);
  const ry = Math.min(y, height - 1 - y);
  if(rx >= radius || ry >= radius) return true;
  return (rx - radius) ** 2 + (ry - radius) ** 2 <= radius ** 2;
}

function inEllipse(x, y, cx, cy, rx, ry){
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

function makeFaviconIco(){
  const size = 32;
  const png = createPng(size, size, (x, y) => {
    if(!inRoundedRect(x, y, size, size, 8)) return [0, 0, 0, 0];
    const forest = hexToRgba(colors.forest);
    const paper = hexToRgba(colors.paper);
    const lime = hexToRgba(colors.lime);
    const trunk = x >= 14 && x <= 17 && y >= 17 && y <= 27;
    const canopyLeft = inEllipse(x, y, 11, 14, 8, 7);
    const canopyRight = inEllipse(x, y, 21, 14, 8, 7);
    const center = inEllipse(x, y, 16, 12, 7, 6);
    const leafLeft = inEllipse(x, y, 11, 14, 5, 4);
    const leafRight = inEllipse(x, y, 21, 14, 5, 4);
    if(trunk || canopyLeft || canopyRight || center) return paper;
    if(leafLeft || leafRight) return lime;
    return forest;
  });
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);
  iconDir.writeUInt16LE(1, 2);
  iconDir.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size;
  entry[1] = size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([iconDir, entry, png]);
}

await mkdir(publicDir, { recursive: true });

async function writeIfChanged(path, content, encoding){
  let existing = null;
  try{
    existing = await readFile(path, encoding);
  }catch(error){
    if(error.code !== "ENOENT") throw error;
  }
  const same = Buffer.isBuffer(content)
    ? Buffer.isBuffer(existing) && existing.equals(content)
    : existing === content;
  if(same){
    console.log(`Unchanged ${path.replace(`${siteRoot}/`, "")}`);
    return;
  }
  await writeFile(path, content, encoding);
  console.log(`Generated ${path.replace(`${siteRoot}/`, "")}`);
}

await writeIfChanged(resolve(siteRoot, "favicon.ico"), makeFaviconIco());
await writeIfChanged(resolve(publicDir, "social-preview.svg"), socialPreview, "utf8");
