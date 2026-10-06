// 群里截图：图像 API 填了 MiniMax-M3（聊天模型），出图报「unsupported model: MiniMax-M3 (2013)」
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
test("MiniMax 出图：模型不是 image 开头就按 image-01", () => {
  assert.match(eng, /model: \/\^image-\/i\.test\(String\(a\.model \|\| ""\)\) \? a\.model : "image-01"/);
});
