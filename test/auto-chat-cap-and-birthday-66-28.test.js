// 她 2026-09-10 两件事：
//  ①「群自发聊天怎么感觉停不下来了，都超了限制还在发」
//  ②「他们生日还是总是觉得是我生日说我是寿星」
//
// 病根是同一种：**该由代码保证的事，只写在提示词里**。
//  ① 每轮条数只写成「一次产出 n~m 条」，模型多写几条就照单全收，
//     她设的「自发总条数上限」等于摆设。
//  ② 生日那几行只说了【是谁的】，一个字没说【不是谁的】——
//     而陪伴类对话的训练先验默认过生日的是用户，模型塌的正是没说的那一半。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js");

test("自发那一轮的条数是代码截的，不是求模型少写", () => {
  assert.match(app, /const _autoBudget = \(rgOpts\.auto && Number\(rgOpts\.msgBudget\) > 0\) \? Math\.floor\(Number\(rgOpts\.msgBudget\)\) : 0;/,
    "没算出本轮预算");
  assert.match(app, /const safeArr = _autoBudget \? \(guarded\.items \|\| \[\]\)\.slice\(0, _autoBudget\) : guarded\.items;/,
    "多出来的还是会落地——上限只是句提示词");
  // ⚠️截完再记账，否则额度卡记的是【模型写了多少】不是【真发了多少】
  assert.ok(app.indexOf("const safeArr = _autoBudget ?") < app.indexOf("if (rgOpts.auto) addAutoChatMessages(groupId, safeArr.length)"),
    "记账排在截断前面了");
  // 非自发轮（她按回复键）一条都不许截
  assert.match(app, /: guarded\.items;/, "非自发轮也被截了");
});

test("额度紧的时候，提示词别再喊「别三两句就收场」", () => {
  const i = app.indexOf("const common = ");
  const seg = app.slice(i, i + 900);
  assert.match(seg, /nMax >= 5 \? "现在群里在场 "/, "预算再小也照喊「多聊几个来回」");
  assert.match(seg, /这一轮的额度只剩这么多，说到就停/, "额度紧的那一档没有自己的说法");
});

test("他生日那天，说清今天【不是】她的生日", () => {
  const seg = app.slice(app.indexOf("      // —— 角色自己的生日 ——"), app.indexOf("      // —— 纪念日：和这个角色在一起满几周年 ——"));
  assert.match(seg, /const _uBdDu = daysUntilBirthday\(profile && profile\.birthday, today\);/, "没去算今天是不是她生日");
  assert.match(seg, /别祝 Ta 生日快乐、别叫 Ta 寿星/, "只说了是谁的，没说不是谁的");
  // 真同一天的时候不许说反
  assert.match(seg, /_uBdDu === 0[\s\S]{0,80}你俩同一天/, "同一天生日会被说成不是她的");
  // 提前几天那一档也得说清是谁的
  assert.match(seg, /是【你的】生日，不是 " \+ uName \+ " 的/, "提前几天那一句没说清是谁的");
  assert.match(seg, /_uBdDu === cdu \? "（也是 " \+ uName \+ " 的生日，你俩同一天）"/, "同一天时提前几天那句会说反");
});

test("群里也说清：今天是谁的生日、不是谁的", () => {
  const seg = app.slice(app.indexOf("      const gBdayHint = (() => {"), app.indexOf("      const gEmotes = emotesForGroup"));
  assert.match(seg, /if \(gs\.spectate\) return "";/, "旁观群里她不在场，没有「不是她的」这回事");
  assert.match(seg, /members\.filter\(c => c && !c\.npc && daysUntilBirthday\(c\.birthday, _t\) === 0\)/, "没找出今天过生日的是谁");
  assert.match(seg, /\*\*不是 " \+ uN \+ " 的生日\*\*/, "群里没说清不是她的");
  assert.match(seg, /hers \? "，也是 " \+ uN \+ " 的生日（同一天）。"/, "同一天生日会被说反");
  // 没人过生日就一个字都不发（十轮里九轮用不上的层不该常驻）
  assert.match(seg, /if \(!who\.length\) return "";/, "没人过生日也照发一段");
  // 真挂进 system 了
  assert.match(app, /dir \+ common \+ gBdayHint \+ gTimeHint/, "算出来了却没发下去");
});
