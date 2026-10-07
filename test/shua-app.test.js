// 刷刷（她 2026-10-07：「整体做抖音界面，直播做其中一个板块」「跟论坛一样分两个按钮，可以选刷谁的」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const S = R("js/shua.js"), A = R("js/app.js");
test("名字只写在一处，不叫抖音", () => {
  assert.match(S, /const APP_NAME = "刷刷";/);
  assert.ok(!/抖音/.test(S.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n")), "代码里（注释以外）出现了抖音");
});
test("刷新两颗：路人一批 / 挑人请TA们发", () => {
  assert.match(S, /function RefreshPage\(/);
  assert.match(S, /"刷几条路人的"/);
  assert.match(S, /"请TA们发"/);
  assert.match(S, /const genChars = async ids =>/);
  assert.match(S, /props\.probeAs\(c, charInstruction\(acc\.handle\), CHAR_SHAPE\)/);
});
test("直播是底栏一格，生图要点了才画", () => {
  assert.match(S, /tabBtn\("live", "直播"\)/);
  assert.match(S, /h\(window\.LiveApp, Object\.assign\(\{\}, props\.live/);
  assert.match(A, /draw: \(charId, desc, who\) => drawFromDesc\(/);
  assert.match(S, /onDraw: props\.canDraw \? \(\) => draw\(v\) : null/);
});
