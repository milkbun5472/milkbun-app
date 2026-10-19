// 安卓 Edge 选文件只给相册（群里 2026-10-18／19）：只写大类、不写后缀、不带图片
const test = require("node:test"), assert = require("node:assert");
const core = require("fs").readFileSync(require("path").join(__dirname, "../js/core.js"), "utf8");
test("Edge 那一支只有大类", () => {
  const m = core.match(/const ANY_FILE = [^?]+\?\s*"([^"]*)"/);
  assert.ok(m, "找不到 ANY_FILE");
  assert.doesNotMatch(m[1], /\.\w/, "又写了后缀");
  assert.doesNotMatch(m[1], /image/, "带了图片就开相册");
  assert.match(m[1], /application\/\*/);
});
