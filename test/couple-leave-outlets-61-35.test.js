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
  // v66.15：档的说明（OUTLET_PICK）住在函数外面、紧挨着它，一起收进来。
  // ⚠️右边界要从【函数自己】那儿算，别从 OUTLET_PICK 算——它俩之间就隔着一个 const，
  //   拿 OUTLET_PICK 的位置去找下一个 const，切出来的只有那张表。
  const p = app.indexOf("const OUTLET_PICK = {");
  const a = app.indexOf("const leaveInCoupleSpace = async");
  return app.slice(p, app.indexOf("\n  const ", a + 40));
})();
// ⚠️只对着【代码】断言：注释里正写着这次的病情（「便签墙」「note＝」「drawerWhisper」都在里面），
// 连注释一起匹配的话，越把原因写清楚测试越红。这个坑今天已经踩过第二次了。
const code = leave.split("\n").map(l => l.split("//")[0]).join("\n");

test("出口都通向真实存在的东西，便签墙那一档整个拿掉", () => {
  // v62.10 加回第三档 qa（他出题）——跟 v61.35 砍掉的 note 不同：问答小本真实存在，
  // 这条测试守的从来是「不许让模型往不存在的东西上写」，不是「档数不许超过二」。
  // v66.15：三选一整个撤掉，档由代码挑（她：另外几种从来没收到过）。
  //   这条测试守的从来是「不许让模型往不存在的东西上写」，那一条照旧守着。
  assert.ok(code.indexOf("便签墙") < 0, "提示词里还写着一面不存在的墙");
  assert.ok(code.indexOf("note＝") < 0, "note 那一档还在");
  assert.ok(!/【留在哪儿】三选一/.test(leave), "又让模型自己挑了");
  assert.match(leave, /const OUTLET_PICK = \{/, "档的说明没了");
  // 每一档说的都得是真实存在的东西
  assert.match(leave, /往你俩的抽屉里放/);
  assert.match(leave, /往你俩的时光轴上/);
  assert.match(leave, /往你俩的问答小本里/);
});

test("qa 那一档：他那半封进 charAnswer，question 空的落不进来", () => {
  // v66.15：档是代码挑的，所以判的是「挑中了 qa 却没出题」——那就算这次没写成
  assert.match(code, /if \(!String\(\(d && d\.question\) \|\| ""\)\.trim\(\)\) return false;/, "没出题也硬塞进去了");
  const box = code.slice(code.indexOf('_pick === "qa"'), code.lastIndexOf("} else {"));
  assert.match(box, /myAnswer: "", charAnswer: txt/, "他那半没封进 charAnswer");
  assert.match(box, /sealed: true, byCharacter: true/, "没按封存+他出的标");
});

test("抽屉那三档落进抽屉，绝不许再变成第四个悄悄话", () => {
  const tail = code.slice(code.lastIndexOf("} else {"));
  assert.ok(tail.indexOf("drawerWhisper") < 0, "兜底还在写悄悄话");
  assert.match(tail, /kind: kind,[\s\S]{0,80}title: "",/);
  // ⚠️注释要对着 leave 断言，不是 code——code 是把注释剥掉的那一份（见文件头那条）
  assert.match(leave.slice(leave.lastIndexOf("} else {")), /绝不许再变成第四个悄悄话/, "那条教训的注释没了");
});

test("抽屉那一档不再存标题（封面本来就不显示）", () => {
  const box = code.slice(code.lastIndexOf("} else {"));
  assert.ok(box.indexOf("d.title") < 0, "还在存标题");
  assert.match(box, /title: "",/);
  // 提示词也别再问它要标题：只有 timeline 那一档要
  assert.match(leave, /这一档【不要标题】，留空——她拆开之前封面上什么都不显示/);
  assert.match(leave, /_pick === "timeline" \? "一个短标题"/);
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
