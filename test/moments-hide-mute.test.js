// 朋友圈「不给谁看」和「不看 TA 的朋友圈」（群友 2026-10-31）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(require.resolve("../js/" + f), "utf8");
const app = R("app.js"), cmp = R("components.js"), ts = R("theme-studio.js");
test("发朋友圈能挑不给谁看，存成 hiddenFrom；提醒了的人不藏", () => {
  assert.match(cmp, /\["hide", "不给谁看"\]/);
  assert.match(cmp, /hiddenFrom: vis === "hide" \? sel\.filter\(id => !remind\.includes\(id\)\) : null/);
  assert.match(app, /hiddenFrom: hiddenFrom\.map\(String\)/);
});
test("角色、配角、查手机三处都认 hiddenFrom", () => {
  assert.match(app, /!\(m\.hiddenFrom \|\| \[\]\)\.includes\(String\(charId\)\)/);
  assert.match(app, /!\(mom && \(mom\.hiddenFrom \|\| \[\]\)\.includes\(String\(n\.id\)\)\)/);
  assert.match(app, /\(m\.hiddenFrom \|\| \[\]\)\.includes\(String\(viewerId\)\)/);
});
test("不看 TA 的朋友圈：TA 主页一颗开关，刷朋友圈时藏掉", () => {
  assert.match(cmp, /saveJSON\("x_momMute", next\)/);
  assert.match(cmp, /momTopFirst\(moments\)\.filter\(m => !m \|\| m\.mine \|\| !momMutedIds\(\)\.includes\(String\(m\.characterId\)\)\)/);
  assert.match(cmp, /"data-wk": "momute"/);
  assert.match(ts, /\["momute", /);
});
