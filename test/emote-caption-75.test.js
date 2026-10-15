// 表情面板每张底下写描述（群友 2026-10-16）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/components.js"), "utf8");
test("StickerPanel：有 keyword 的那张底下摆一行字", () => {
  const i = src.indexOf("function StickerPanel("), seg = src.slice(i, src.indexOf("// 底下那一排", i));
  assert.ok(/em\.keyword \? h\("div"/.test(seg) && /textOverflow: "ellipsis"/.test(seg));
});
