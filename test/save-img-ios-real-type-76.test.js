// iPhone 存图只给「共享相簿」（2026-11-01 再报）：按文件头认真实格式；文件名只用英文数字
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
test("看文件头，不信标签", () => {
  assert.match(eng, /async function _imgRealType\(blob\)/);
  assert.match(eng, /const real = await _imgRealType\(blob\);/);
});
test("文件名不带中文", () => {
  const a = eng.indexOf("function _imgFileOf("), b = eng.slice(a, a + 600);
  assert.match(b, /const fname = "photo-"/);
});
