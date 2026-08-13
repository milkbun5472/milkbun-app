#!/usr/bin/env node
// 一条命令发版（2026-08-12 她的「48.x手感」提案）：node scripts/bump-version.mjs 52.30 [--dry]
// 自动做齐三处同步：APP_VERSION、index.html 里【真正改过的文件】的 ?v= 指纹、manifest 指纹、
// rescue.html 版本串。改哪些指纹由「工作区哈希 vs HEAD」判定，不靠人的记性。
// 不自动 commit——改完打印摘要和下一步命令（iCloud git 请用底层三件套，见《版本更新手册.md》）。
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ver = (process.argv[2] || "").replace(/^v/, "");
const dry = process.argv.includes("--dry");
if (!/^\d+\.\d+$/.test(ver)) { console.error("用法: node scripts/bump-version.mjs 52.30 [--dry]"); process.exit(1); }

const read = p => readFileSync(p, "utf8");
const save = (p, s) => { if (!dry) writeFileSync(p, s); };
const changed = [];

// 1. APP_VERSION
let app = read("js/app.js");
const oldVer = (app.match(/APP_VERSION = "v([\d.]+)"/) || [])[1];
app = app.replace(/APP_VERSION = "v[\d.]+"/, `APP_VERSION = "v${ver}"`);
save("js/app.js", app);
changed.push(`APP_VERSION v${oldVer} → v${ver}`);

// 2. index.html：manifest 必 bump；js 指纹只 bump「工作区 != HEAD」的文件（含本次 app.js）
let idx = read("index.html");
idx = idx.replace(/manifest\.json\?v=[\d.]+/, `manifest.json?v=${ver}`);
const fp = [...idx.matchAll(/src="(js\/[\w-]+\.js)\?v=([\d.]+)"/g)].map(m => ({ file: m[1], v: m[2] }));
const dirty = new Set(["js/app.js"]);
// 批量两发，别逐文件排队过 iCloud 安检（首版逐文件 15s×40 直接把自己卡死了）
try {
  const files = fp.map(x => x.file);
  const wLines = execSync(`git hash-object ${files.map(f => `"${f}"`).join(" ")}`, { timeout: 60000 }).toString().trim().split("\n");
  const hOut = execSync(`git ls-tree HEAD -- ${files.map(f => `"${f}"`).join(" ")}`, { timeout: 60000 }).toString();
  const headHash = {};
  for (const line of hOut.split("\n")) { const m = line.match(/blob (\w+)\t(.+)$/); if (m) headHash[m[2]] = m[1]; }
  files.forEach((f, i) => { if (wLines[i] && headHash[f] && wLines[i] !== headHash[f]) dirty.add(f); });
} catch (e) { console.warn("⚠️ git 探测超时，只 bump app.js/manifest/rescue；改过别的文件请手动补指纹"); }
for (const { file, v } of fp) {
  if (dirty.has(file) && v !== ver) {
    idx = idx.replace(new RegExp(`${file.replace(/[/.]/g, "\\$&")}\\?v=${v.replace(".", "\\.")}`), `${file}?v=${ver}`);
    changed.push(`${file} ?v=${v} → ${ver}`);
  }
}
save("index.html", idx);

// manifest.json 本体里的 PWA 启动地址也属于发布目标，不能只 bump index 的 href。
let manifest = read("manifest.json");
manifest = manifest.replace(/(index\.html\?launch=)[\d.]+/, `$1${ver}`);
save("manifest.json", manifest);
changed.push(`manifest.json launch → ${ver}`);

// 3. rescue.html 版本串整体换代
let rescue = read("rescue.html");
const rOld = new Set(rescue.match(/\d+\.\d+/g) || []);
rescue = rescue
  .replace(/(app\.js\?v=|launch=|v)(5[0-9]\.[0-9]+)/g, (m, pre) => pre + ver)
  // JS 正则字面量里的点是转义形态，例如 app\.js\?v=52\.30 / v52\.30。
  .replace(/(app\\\.js\\\?v=|v)(5[0-9]\\\.[0-9]+)/g, (m, pre) => pre + ver.replace(".", "\\."));
save("rescue.html", rescue);
changed.push(`rescue.html 版本串 → ${ver} (原含: ${[...rOld].slice(0, 4).join(", ")})`);

// 4. 自检
const a = (app.match(/APP_VERSION = "v([\d.]+)"/) || [])[1];
const b = (idx.match(/js\/app\.js\?v=([\d.]+)/) || [])[1];
console.log(changed.map(x => "  · " + x).join("\n"));
if (a !== b) { console.error(`❌ 自检失败: APP_VERSION v${a} vs index 指纹 ${b}`); process.exit(1); }
console.log(`✅ 指纹同步自检通过 (v${a})${dry ? "【dry-run 未写盘】" : ""}`);
console.log(`下一步: git add js/app.js index.html manifest.json rescue.html ${[...dirty].filter(f => f !== "js/app.js").join(" ")}\n然后按《版本更新手册.md》的三件套提交推送。`);
