// 她 2026-10-14：「把全部能发文件的地方都弄成公共的全部放行」——除了图片／音频／视频，选文件一律走 ANY_FILE
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "js");
// 2026-10-18 起安卓 Edge 例外（它见到 */* 只弹相机）：只在它身上换成一串后缀，别处照旧 */*
{ const core = fs.readFileSync(path.join(dir, "core.js"), "utf8");
  assert.match(core, /const ANY_FILE = \(typeof navigator !== "undefined" && \/EdgA\\\/\/\.test\(navigator\.userAgent \|\| ""\)\)/);
  assert.match(core, /\n  : "\*\/\*";/, "除了安卓 Edge 以外还得是全部放行"); }
const bad = [];
fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "assistant-manual.js").forEach(f => {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  (s.match(/accept(?::|\s*=)\s*"[^"]*"/g) || []).forEach(m => { if (!/image\/|audio\/|video\/|^accept: "\*\/\*"$/.test(m)) bad.push(f + " " + m); });
});
assert.deepEqual(bad, [], "这些选文件的地方还在用自己那份后缀清单");
console.log("ok");
