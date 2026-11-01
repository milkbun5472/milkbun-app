// 25 问：猜的就是答案，代码自己认（2026-11-01 群里：打「馒头」，主持人说不是，答案就是馒头）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const a = src.indexOf("function q25Norm"); const q25Norm = new Function(src.slice(a, src.indexOf("\n", a)) + "; return q25Norm;")();
const hit = (sec, q) => { sec = q25Norm(sec); const x = q25Norm(q); return x === sec || (sec.length >= 2 && x.length <= sec.length + 4 && x.indexOf(sec) >= 0); };
test("直接说出答案、问「是不是X」「它是X吗」都算猜中；问性质的不算", () => {
  assert.ok(hit("馒头", "馒头"));
  assert.ok(hit("馒头", "是不是馒头？"));
  assert.ok(hit("馒头", "它是馒头吗"));
  assert.ok(!hit("馒头", "它是否需要经过蒸这道工序？"));
});
test("跑完主持人那一轮后先自己认，猜中就收题", () => {
  assert.match(src, /if \(uq && hitQ25\(uq\)\) \{ r\.userAnswer = \{ verdict: "是", note: "猜中了" \}; r\.solvedBy = me \? me\.name : r\.solvedBy;/);
});
test("问几个字代码自己数；主持人判的破题要真说中才算", () => {
  assert.match(src, /const lenAns = q =>/);
  assert.match(src, /if \(!hitQ25\(said\)\) \{ r\.solvedBy = ""; r\.reveal = ""; \}/);
});
