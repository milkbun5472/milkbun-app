#!/usr/bin/env node
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = p => fs.readFileSync(p, "utf8");
const appText = read("js/app.js");
const appVersion = appText.match(/APP_VERSION\s*=\s*["']v([0-9.]+)["']/)?.[1];
const html = read("index.html");
const manifest = JSON.parse(read("manifest.json"));
const rescue = read("rescue.html");
const failures = [];

if (!appVersion) failures.push("APP_VERSION missing");
if (manifest.start_url !== `./index.html?launch=${appVersion}`) failures.push(`manifest launch=${manifest.start_url}`);
if (!html.includes(`manifest.json?v=${appVersion}`)) failures.push("manifest fingerprint stale");
if (!rescue.includes(`app.js?v=${appVersion}`) || !rescue.includes(`index.html?launch=${appVersion}`) || !rescue.includes(`v${appVersion}`)) failures.push("rescue target stale");

// “没改不动”：只有相对 HEAD 真正改过的脚本才必须取得本次 APP_VERSION 指纹。
// clean 脚本允许保留旧指纹；否则每次发布都会无意义击穿全部浏览器缓存。
const refs = [...html.matchAll(/src=["'](js\/[\w-]+\.js)\?v=([0-9.]+)["']/g)].map(m => ({ file: m[1], version: m[2] }));
let dirty = new Set();
try {
  const out = execFileSync("git", ["diff", "--name-only", "HEAD", "--", ...refs.map(x => x.file)], { encoding: "utf8", timeout: 30000 });
  dirty = new Set(out.split("\n").filter(Boolean));
} catch (error) {
  failures.push("cannot inspect git changed set: " + String(error.message || error));
}
dirty.add("js/app.js");
for (const ref of refs) if (dirty.has(ref.file) && ref.version !== appVersion) failures.push(`${ref.file} changed but fingerprint=${ref.version}`);

if (failures.length) {
  console.error(`Version check failed (APP_VERSION=${appVersion || "missing"}):\n- ` + failures.join("\n- "));
  process.exit(1);
}
console.log(`Version check OK: v${appVersion}; changed refs=${[...dirty].sort().join(",")}`);
