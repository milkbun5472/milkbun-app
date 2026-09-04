// v61.69 拖拽落点不许残留：手指回到被拖项自己身上时必须清掉旧落点
// （她 9/3：把地图往上挪一格，地图却跑到顶端——吃的是几秒前扫过顶部空格时留下的旧 dropRef）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("overKey===dragged 与空白同待遇：清 hover 清落点", () => {
  assert.match(src, /\} else \{ \/\/ 手指悬在被拖的那个自己身上/);
  assert.doesNotMatch(src, /else if \(!overKey\) \{ clearHover\(\); if \(dropRef\.current\)/);
});
