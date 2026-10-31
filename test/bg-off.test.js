// 她 2026-10-10：「后台 api 能不能选个无，这样可以强制不刷新」
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), s = (src("screens.js") + "\n" + src("screens-ui.js"));
test("后台选「无」：自己跑的一律关，自动抽记忆也停", () => {
  // 免打扰时段（v75.906）也算「后台不跑」，后面多了一截 quietNow("bg")
  assert.match(a, /const bgOff = \(\) => loadJSON\("x_bgApi", null\) === "__off__"( \|\| quietNow\("bg"\))?;/);
  // 2026-10-31：TA 亲笔的那几样（主动私聊、日记、朋友圈…）走自己的线路，只认免打扰，不认「后台选无」
  assert.match(a, /const autoRefreshOn = \(feature, charId\) => !\(OWN_LINE_FEATURES\[feature\] \? quietNow\("bg"\) : bgOff\(\)\) &&/);
  assert.ok((a.match(/cfg\.autoExtract[^;]*bgOff\(\)\) return;/g) || []).length >= 5, "自动抽记忆还有没挡住的");
});
test("设置页和悬浮球都能选「无」", () => {
  assert.match(s, /"跟随主模型", "无（记忆、日程这些后台活不跑）"\)/);
  assert.match(a, /lane\.key === "bg" \? \[choice\(lane, \{ id: "__off__"/);
});
