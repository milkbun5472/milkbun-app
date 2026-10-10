// 她 2026-10-10：「后台 api 能不能选个无，这样可以强制不刷新」
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), s = src("screens.js");
test("后台选「无」：自己跑的一律关，自动抽记忆也停", () => {
  assert.match(a, /const bgOff = \(\) => loadJSON\("x_bgApi", null\) === "__off__";/);
  assert.match(a, /const autoRefreshOn = \(feature, charId\) => !bgOff\(\) &&/);
  assert.ok((a.match(/cfg\.autoExtract[^;]*bgOff\(\)\) return;/g) || []).length >= 5, "自动抽记忆还有没挡住的");
});
test("设置页和悬浮球都能选「无」", () => {
  assert.match(s, /"跟随主模型", "无（后台一律不跑）"\)/);
  assert.match(a, /lane\.key === "bg" \? \[choice\(lane, \{ id: "__off__"/);
});
