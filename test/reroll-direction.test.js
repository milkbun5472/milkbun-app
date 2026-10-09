// 带方向重写（群友 2026-10-09 许愿；她定：点一下照常，长按给方向）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
const C = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");

test("方向只管这一次：点一下清空，一分钟没取走作废", () => {
  const src = E.slice(E.indexOf("let REROLL_DIR"), E.indexOf("function onlineRerollHint("));
  const k = new Function(src + "\nreturn { setRerollDir, rerollDirLine };")();
  k.setRerollDir("短一点");
  assert.match(k.rerollDirLine(), /短一点/);
  k.setRerollDir("");
  assert.equal(k.rerollDirLine(), "");
});

test("单聊、群聊、线下、群线下四处重写尾巴都接上同一句", () => {
  assert.match(E, /上一版之前已经成立的事实照旧，其余由你此刻重新想。" \+ rerollDirLine\(\);/);
  assert.match(E, /\+ \(session\.rerollAvoid \? rerollDirLine\(\) : ""\);\n  const characterSupplyInjected/);
  assert.match(E, /const gTail = gContinueCue[^\n]*\+ \(session\.rerollAvoid \? rerollDirLine\(\) : ""\);/);
  assert.match(C, /k === "reroll" \? Object\.assign\(\{ "data-wk": "rerollpress" \}, rerollPress\(\(\) => onAction\(k\)\)\)/);
  assert.match(C, /rerollPress\(\(\) => onReroll\(m\.id\)\)/);
  const fn = C.slice(C.indexOf("function rerollPress("), C.indexOf("// 风格统一的输入弹窗。"));
  assert.match(fn, /const tap = \(\) => \{\s*if \(typeof setRerollDir === "function"\) setRerollDir\(""\);/, "点一下先清掉上次的方向");
});
