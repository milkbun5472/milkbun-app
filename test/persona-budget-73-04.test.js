// 她 2026-09-22 问：「7 个人的话每个人人设能吃到多少字」。
// 查的时候发现【分母】四处有一处不一样：群线上／群线下／群通话都排掉配角
//（配角走固定的 3000，不参与平分），只有投票那一处把配角也算进了分母 ——
// 于是同一个群、同一个人，在投票那一枪里拿到的人设额度比别处少一截。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");

const budget = new Function(
  eng.match(/^const GROUP_PERSONA_BUDGET = .*$/m)[0] + "\n" +
  eng.slice(eng.indexOf("function groupPersonaBudget("), eng.indexOf("// 群文字、群通话、群线下的六层背景")) +
  "\nreturn groupPersonaBudget;")();

test("七个人：每人 7142 字", () => {
  assert.equal(budget(5), 10000, "五人以内不砍");
  assert.equal(budget(6), 8333);
  assert.equal(budget(7), 7142);
  assert.equal(budget(10), 5000);
  assert.equal(budget(40), 2500, "地板");
  assert.match(eng, /const NPC_PERSONA_CAP = 3000;/, "配角那一档变了");
});

test("分母四处一个口径：配角不参与平分", () => {
  assert.equal((app.match(/groupPersonaBudget\(members\.length\)/g) || []).length, 0, "app 里还有人把配角算进分母");
  assert.equal((eng.match(/groupPersonaBudget\(members\.length\)/g) || []).length, 0, "engine 里还有人把配角算进分母");
  assert.match(app, /const gPersonaCap = groupPersonaBudget\(members\.filter\(c => !c\.npc\)\.length\)/, "群线上");
  assert.match(eng, /const gPersonaCap = groupPersonaBudget\(members\.filter\(c => !c\.npc\)\.length\)/, "群线下");
  assert.match(app, /const gCallCap = groupPersonaBudget\(people\.filter\(c => !c\.npc\)\.length \|\| 1\)/, "群通话");
  assert.match(app, /groupPersonaBudget\(members\.filter\(x => !x\.npc\)\.length\)/, "投票");
  assert.match(eng, /groupPersonaBudget\(members\.filter\(x => !x\.npc\)\.length\)/, "群里那位 OOC 助手");
});

test("超了额度是截断＋明说，不是悄悄丢", () => {
  assert.match(eng, /〔人设过长，按在场人数分到的额度截断〕/);
  assert.match(eng, /const b = Math\.max\(200, Number\(budget\) \|\| 200\);/, "额度没给下限，传错就截成空的");
});
