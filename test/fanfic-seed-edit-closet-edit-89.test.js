// 群里 2026-11-19 许愿：「同人文的主题可以编辑和删除，衣柜里的衣服也可以编辑」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("预设世界观也能改、能拿掉：改动另存一份，读的时候盖上去", () => {
  const core = R("js/fanfic-core.js"), ui = R("js/fanfic.js");
  assert.match(core, /const K_SEED_EDITS = "x_fanfic_seedEdits";/);
  assert.match(core, /if \(!now\) ed\[s\.id\] = \{ gone: true \};/);
  assert.match(ui, /onClick: function \(\) \{ if \(on\) props\.onEdit\(tab\); else props\.onPick\(tab\.id\); \}/);
  assert.match(ui, /editing \? h\("button", \{ onClick: function \(\) \{ props\.onDelete\(editing\.id\); \}/);
});
test("衣柜／随身物能改名字和说明，钉着的跟着改", () => {
  const app = R("js/app.js"), s = R("js/screens-ui.js");
  assert.match(app, /const carryEditItem = \(charId, key, item, patch\) =>/);
  assert.match(app, /onEditItem: carryEditItem,/);
  assert.match(s, /"data-part": "edit", onClick: \(\) => setSheetEdit/);
  assert.match(R("js/theme-studio.js"), /\["carrysheetedit", /);
});
