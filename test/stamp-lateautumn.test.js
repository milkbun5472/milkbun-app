// 深秋这一期：季节是这件事的起因、你们俩这层看、穿着跟季节（她 2026-11-05「改吧」）
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "stamps-core.js"), "utf8");
const seg = s.slice(s.indexOf('id: "lateautumn26"'), s.indexOf('id: "onsen26"'));
test("判据：季节落进事情里，不是背景", () => {
  assert.match(seg, /【因为到了这个时节才会发生】/);
  assert.match(seg, /换到别的季节就不成立/);
  assert.doesNotMatch(seg.slice(seg.indexOf("line:")), /不必点明季节/);
});
test("跟钩子对上：你们俩", () => { assert.match(seg, /你们俩在这个时节里的一刻/); });
test("画面：穿着跟季节", () => { assert.match(seg, /人物穿着照这个季节/); });
test("测试券开着时卡池列表多摆下一期；送券那一路不读它", () => {
  const st = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "stamps.js"), "utf8");
  assert.match(s, /function nextLimited\(now\)/);
  assert.match(st, /st\.opt && st\.opt\.testInf && C\(\)\.nextLimited \? C\(\)\.nextLimited\(Date\.now\(\)\)/);
  assert.doesNotMatch(s.slice(s.indexOf("function grantOnOpen"), s.indexOf("function activeLimited")), /nextLimited/);
});
