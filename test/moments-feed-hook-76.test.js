// 群友 2026-10-29：美化写了整页背景，朋友圈动态流还是主题的黄底——那一层自己铺了底色，没挂点选不到
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
test("朋友圈信息流那张底有挂点 mofeed，工作台里登记了", () => {
  assert.match(comp, /"data-wk": "mofeed",\n    className: "pb-8 min-h-full",\n    style: \{ background: t\.bg2 \}/);
  assert.match(ts, /\["mofeed", "/);
});
