// 安卓选文件只给相册／选不了文件（群里 2026-10-18 Edge、10-19 再报、10-29 夸克、10-29 又一台、11-01 不写 accept 也只给相机）：
//   安卓一律写「文档和文字两大类」，不带图片、不写后缀；iOS 照旧 */*。来回改过一次，记录在 core.js ANY_FILE 那段
const test = require("node:test"), assert = require("node:assert");
const core = require("fs").readFileSync(require("path").join(__dirname, "../js/core.js"), "utf8");
test("安卓写大类、不带图片；别处全部放行", () => {
  const m = core.match(/const ANY_FILE = [^?]+\?\s*([^\n]+)\n\s*:\s*"([^"]*)";/);
  assert.ok(m, "找不到 ANY_FILE");
  assert.strictEqual(m[1].trim(), '"application/*,text/*,font/*"');
  assert.doesNotMatch(m[1], /image|\*\/\*|\./, "安卓那串不能带图片、*/* 或后缀");
  assert.strictEqual(m[2], "*/*", "安卓以外还得是全部放行");
});
