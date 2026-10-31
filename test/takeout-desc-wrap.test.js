// 外卖菜品介绍会换行、最多两行（群友 2026-10-31「太长了」：不换行把卡撑出屏幕）
require("node:test")("菜的介绍不再用不换行的小标签", () => {
  const assert = require("node:assert/strict");
  const ui = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "screens-ui.js"), "utf8");
  assert.doesNotMatch(ui, /"tkodishdesc", style: \{ marginTop: 4 \} \}, tag\(x\.desc\)\)/);
  assert.match(ui, /"data-wk": "tkodishdesc", style: \{ marginTop: 4, maxWidth: "100%" \} \},\n\s*h\("span", \{ "data-wk": "tkotag", style: \{ display: "-webkit-box", WebkitLineClamp: 2/);
});
