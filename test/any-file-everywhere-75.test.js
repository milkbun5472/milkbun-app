// 她 2026-10-14：「把全部能发文件的地方都弄成公共的全部放行」——除了图片／音频／视频，选文件一律走 ANY_FILE
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "js");
// 2026-10-29 起安卓一律不写 accept：四次「只能选相册／选不了文件」都是安卓把 accept 翻成相机／相册 intent，
//   一个浏览器一个浏览器加名单加不完（见 core.js 那段）。iOS 照旧 */*，不写反而只剩照片。
{ const core = fs.readFileSync(path.join(dir, "core.js"), "utf8");
  assert.match(core, /const ANDROID_NO_ACCEPT = ua =>/, "安卓那条没集中成一处");
  assert.match(core, /\/Android\/\.test\(ua\)/, "没限定安卓：iOS 不写 accept 只剩照片和拍照");
  assert.match(core, /ANDROID_NO_ACCEPT\(navigator\.userAgent \|\| ""\)/);
  assert.match(core, /\n  \? undefined\n/, "安卓那支必须是 undefined：\"\" 会留下 accept=\"\"");
  assert.match(core, /\n  : "\*\/\*";/, "安卓以外还得是全部放行");
  // 直接写 DOM 的那两处不判断就会写成字符串 "undefined"——比原来还糟（谁都挑不中）
  ["components.js", "fanfic.js"].forEach(f => {
    const s = fs.readFileSync(path.join(dir, f), "utf8");
    (s.match(/inp\.accept = [A-Z_]+/g) || []).forEach(m =>
      assert.ok(/if \(ANY_FILE\) inp\.accept/.test(s), f + "：直接赋值前没判断 ANY_FILE"));
  }); }
const bad = [];
fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "assistant-manual.js").forEach(f => {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  (s.match(/accept(?::|\s*=)\s*"[^"]*"/g) || []).forEach(m => { if (!/image\/|audio\/|video\/|^accept: "\*\/\*"$/.test(m)) bad.push(f + " " + m); });
});
assert.deepEqual(bad, [], "这些选文件的地方还在用自己那份后缀清单");
console.log("ok");
