// 她 2026-10-11：随身物里能直接进「我的衣柜」（聊天「我」页那个，同一页同一份），返回回随身物
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
test("随身物顶上多一颗「我的衣柜」，进的是同一个 MyCloset，返回回随身物", () => {
  assert.match(scr, /"data-wk": "carrymycloset", onClick: onOpenMyCloset/);
  assert.match(app, /onOpenMyCloset: \(\) => \{ setClosetBack\("carry"\); setScreen\("mycloset"\); \},/);
  assert.match(app, /onBack: \(\) => \{ const b = closetBack; setClosetBack\(null\); setScreen\(b \|\| "home"\); \}/);
  assert.equal((app.match(/h\(MyCloset, \{/g) || []).length, 1, "衣柜只许有一份");
  assert.match(ts, /\["carrymycloset", /);
});
