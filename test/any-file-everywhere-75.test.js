// 她 2026-10-14：「把全部能发文件的地方都弄成公共的全部放行」——除了图片／音频／视频，选文件一律走 ANY_FILE
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "js");
assert.match(fs.readFileSync(path.join(dir, "core.js"), "utf8"), /const ANY_FILE = "\*\/\*";/);
const bad = [];
fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "assistant-manual.js").forEach(f => {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  (s.match(/accept(?::|\s*=)\s*"[^"]*"/g) || []).forEach(m => { if (!/image\/|audio\/|video\/|^accept: "\*\/\*"$/.test(m)) bad.push(f + " " + m); });
});
assert.deepEqual(bad, [], "这些选文件的地方还在用自己那份后缀清单");
console.log("ok");
