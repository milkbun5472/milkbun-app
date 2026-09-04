// v61.35 她 2026-09-03 问「另外仨咋触发啊」，查下来 拾/半/画 几乎永远轮不上：
//
//  · 思念攒够时只有 30% 会走「去空间里留一样东西」，其余直接发消息；
//  · 走到了，模型还要三选一（drawer / note / timeline），
//    而 note＝「往便签墙上贴一张」—— 便签墙 v59.23 就撤掉了，它的产物被当成悄悄话
//    塞进抽屉。等于三个出口里有两个通向同一样东西，模型还以为自己在往一面不存在的墙上贴。
//
// 她说「都改吧」：出口收成两档 + 概率抬到 0.45。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
// ⚠️只切这一个函数：切到 DRAWER_CAP 会把 genWhisper / drawerWhisper 一起吞进来，
// 那两处本来就该出现 drawerWhisper，断言会被它们喂假。
const leave = (() => {
  const a = app.indexOf("const leaveInCoupleSpace = async");
  return app.slice(a, app.indexOf("\n  const ", a + 40));
})();
// ⚠️只对着【代码】断言：注释里正写着这次的病情（「便签墙」「note＝」「drawerWhisper」都在里面），
// 连注释一起匹配的话，越把原因写清楚测试越红。这个坑今天已经踩过第二次了。
const code = leave.split("\n").map(l => l.split("//")[0]).join("\n");

test("出口都通向真实存在的东西，便签墙那一档整个拿掉", () => {
  // v62.10 加回第三档 qa（他出题）——跟 v61.35 砍掉的 note 不同：问答小本真实存在，
  // 这条测试守的从来是「不许让模型往不存在的东西上写」，不是「档数不许超过二」。
  assert.match(leave, /【留在哪儿】三选一/);
  assert.ok(code.indexOf("便签墙") < 0, "提示词里还写着一面不存在的墙");
  assert.ok(code.indexOf("note＝") < 0, "note 那一档还在");
  assert.match(leave, /\\"where\\":\\"drawer 或 timeline 或 qa\\"/);
});

test("qa 那一档：他那半封进 charAnswer，question 空的落不进来", () => {
  assert.match(code, /d\.where === "qa" && String\(d\.question \|\| ""\)\.trim\(\)/, "question 空也进了 qa 档");
  const box = code.slice(code.indexOf('d.where === "qa"'), code.lastIndexOf("} else {"));
  assert.match(box, /myAnswer: "", charAnswer: txt/, "他那半没封进 charAnswer");
  assert.match(box, /sealed: true, byCharacter: true/, "没按封存+他出的标");
});

test("认不出 where 的时候落进抽屉，不再变成第四个悄悄话", () => {
  const tail = code.slice(code.lastIndexOf("} else {"));
  assert.ok(tail.indexOf("drawerWhisper") < 0, "兜底还在写悄悄话");
  assert.match(tail, /kind: "word",[\s\S]{0,80}title: "",/);
});

test("抽屉那一档不再存标题（封面本来就不显示）", () => {
  const box = code.slice(code.indexOf('if (d.where === "drawer")'), leave.indexOf('else if (d.where === "timeline")'));
  assert.ok(box.indexOf("d.title") < 0, "还在存标题");
  assert.match(box, /title: "",/);
  // 提示词也别再问它要标题
  assert.match(leave, /drawer 和 qa 那两档【不要标题】/);   // v62.10 加了 qa 档，一样不要标题
});

test("概率抬到 0.45，而且是模块级常量（组件里写会踩 TDZ）", () => {
  assert.match(app, /^const COUPLE_LEAVE_P = 0\.45;$/m);
  assert.match(app, /Math\.random\(\) < COUPLE_LEAVE_P/);
  // 用它的地方必须在声明之后（同一个文件里按行号看）
  assert.ok(app.indexOf("const COUPLE_LEAVE_P") < app.indexOf("Math.random() < COUPLE_LEAVE_P"),
    "常量声明排在使用之后了");
  assert.ok(app.indexOf("  const COUPLE_LEAVE_P") < 0, "又挪回组件里去了");
});

test("生成悄悄话那处也别再提便签墙（那面墙 v59.23 撤了）", () => {
  const i = app.indexOf("const genWhisper = async");
  const fn = app.slice(i, i + 1400);
  assert.ok(fn.indexOf("便签墙") < 0, "还在让他往一面不存在的墙上贴");
  assert.match(fn, /往你俩私密的那个抽屉里放一张给用户的小纸条/);
});
