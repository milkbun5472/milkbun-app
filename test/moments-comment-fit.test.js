const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("朋友圈评论框不把「发送」挤出屏幕", () => {
  assert.match(src, /border: `1px solid \$\{t\.line\}`,\n\s*\/\/ iPhone 上输入框按默认宽度撑[^\n]*\n\s*minWidth: 0,\n\s*width: 0/);
  assert.match(src, /className: "shrink-0 px-3 rounded-full",[\s\S]{0,160}whiteSpace: "nowrap"\s*\}\s*\}, "发送"\)/);
});
