import { readFile } from "node:fs/promises";
import { Script } from "node:vm";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const pagePaths = [
  "index.html",
  "lifecycle/index.html",
  "species/index.html",
  "daily/index.html"
];

const results = [];

for(const pagePath of pagePaths){
  const absolutePath = resolve(siteRoot, pagePath);
  const html = await readFile(absolutePath, "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .filter(script => script.trim());
  const issues = [];

  scripts.forEach((script, index) => {
    try{
      new Script(script, { filename: `${pagePath}#inline${index + 1}` });
    }catch(error){
      issues.push(`inline ${index + 1}: ${error.message}`);
    }
  });

  results.push({
    file: relative(siteRoot, absolutePath),
    inlineScripts: scripts.length,
    issues
  });
}

for(const result of results){
  if(result.issues.length){
    console.error(`${result.file}: ${result.issues.join("; ")}`);
  }else{
    console.log(`${result.file}: ok (${result.inlineScripts} inline script${result.inlineScripts === 1 ? "" : "s"})`);
  }
}

if(results.some(result => result.issues.length)){
  process.exit(1);
}
