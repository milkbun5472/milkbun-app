"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");

// 她 2026-09-18：「直接把示例同行者删了吧。玩秋秋机的都是有角色的。
//                 所以主要 focus 还是角色互动和关系」
// ⚠️那条路本来就是残的：没有角色时井里刨不出碎片 → 做不了东西 → 收藏馆空 →
//   念不了咒 → 三条会开的路一条都开不了。摆着它＝请人去玩一个阉割版。
test("选人页上没有「不挑人」那条出口了", () => {
  assert.doesNotMatch(host, /\}, "先和示例同行者试玩"\)/, "那颗按钮还在");
  assert.match(host, /const pickForNew = id => \{ setPicking\(false\); if \(id\) props\.onNewGardenRoom\(id\); \};/,
    "挑了人才有下文，没有 else 那一支");
  assert.match(host, /onClick: \(\) => setPicking\(true\)/, "「＋ 新开一段」只剩挑人这一条路");
});

// 撤掉一件东西就把它删掉，不许留在原地当死代码
test("开示例档那个函数删干净了", () => {
  assert.doesNotMatch(host, /const createSolo = /);
  assert.doesNotMatch(host, /setSaves\(next\); setOpenSolo\(true\)/);
  // read() 兜底那份空存档还要留着
  assert.match(host, /const blankSave = \(\) => \(\{ version: 1, id: "garden_"/);
});

// ⚠️「这一步执行完，有没有哪一份数据只剩一个副本了」——以前开的那些示例档不许弄没
test("以前开的示例档照样列着、照样进得去", () => {
  assert.match(host, /card\(\(\) => \{ setOpenSolo\(!meta\.partnerId\); setOpenId\(saveKeyOf\(row\)\); \}/,
    "没有同行者的旧档要直接进去，不能摆一张它逃不掉的选人页");
  assert.match(host, /以前开的示例档没有同行者：直接进去接着玩/);
  assert.match(host, /【以前开的那些示例档不动】/);
});

// 一个角色都没有的时候，「挑一位」没有对象
test("没有角色的人看到的是「先去创建一位」，不是一句挑不了的话", () => {
  assert.match(host, /rows\.length \? note : "这个世界是和你手机里的角色一起过的。先去人格档案馆创建一位，再回来开一段。"/);
  assert.doesNotMatch(host, /"也可以先去人格档案馆创建角色。"/, "那句「也」暗示还有别的选择，而那条已经撤了");
});

// 挑了人一律去开一间新房（一间房＝一个庭院存档），所以哪一边都不是「换」
test("那颗按钮不再说「换同行者」", () => {
  assert.doesNotMatch(host, /"换同行者"/);
  assert.match(host, /\}, "另开一间"\)\)/);
});
