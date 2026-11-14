// 深秋这一期：季节是这件事的起因、你们俩这层看、穿着跟季节（她 2026-11-05「改吧」）
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "stamps-core.js"), "utf8");
const seg = s.slice(s.indexOf('id: "lateautumn26"'), s.indexOf('id: "onsen26"'));
// 她 2026-11-15：硬要「换季就不成立」逼得一排 SSR 都在修东西 → 重心挪到你们俩，季节是发生的时候，不写干活
test("判据：季节落进你们之间，不是背景，也不写干活", () => {
  assert.match(seg, /深秋是它发生的时候/);
  assert.match(seg, /不是一张平常日子的卡/);
  assert.match(seg, /不写干活/);
  assert.doesNotMatch(seg, /换到别的季节就不成立/);
  assert.doesNotMatch(seg.slice(seg.indexOf("line:")), /不必点明季节/);
});
test("跟钩子对上：你们俩", () => { assert.match(seg, /这一刻是你们俩之间的事/); });
test("画面：穿着跟季节", () => { assert.match(seg, /人物穿着照这个季节/); });
test("测试券开着时卡池列表多摆下一期；送券那一路不读它", () => {
  const st = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "stamps.js"), "utf8");
  assert.match(s, /function nextLimited\(now\)/);
  assert.match(st, /st\.opt && st\.opt\.testInf && C\(\)\.nextLimited \? C\(\)\.nextLimited\(Date\.now\(\)\)/);
  assert.doesNotMatch(s.slice(s.indexOf("function grantOnOpen"), s.indexOf("function activeLimited")), /nextLimited/);
});
