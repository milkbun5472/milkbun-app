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
  // ⚠️v67.20：记账不再按【模型交回来几条】记了——她设的是 50，她数的是**屏幕上的行**，
  //   一条会被 splitLongBubble 拆成好几泡、动描还要再占一行（她 2026-09-11：设 50 出到 61）。
  //   现在每落一行记一笔，而且到顶当场停手。要证的还是「真发了多少才算多少」。
  // ⚠️先把注释剥掉再断言：app.js 里那段病历写着「这里原来是 addAutoChatMessages(...safeArr.length)」，
  //   连注释一起搜的话，**越把原因写清楚这条越红**（这两天第七次踩这个坑）。
  const _noComment = app.split("\n").map(l => l.split("//")[0]).join("\n");
  assert.ok(_noComment.indexOf("addAutoChatMessages(groupId, safeArr.length)") < 0, "又回去按条记了");
  assert.match(app, /const autoTook = \(\) => \{/, "每落一行记一笔那道闸没了");
  assert.match(app, /if \(!rgOpts\.borrowed\) addAutoChatMessages\(groupId, 1\);/, "一行一笔");
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
  assert.match(app, /dir \+ common \+ gSameRoomHint \+ gBdayHint \+ gTimeHint/, "算出来了却没发下去");
});

// 她 2026-09-10：「我都关了自发聊天他们还是在聊」。
// ⚠️「群里自己聊起来」这道闸【只写在线上那条巡检里】，群线下那条自主续演一个字都没跟上——
//    她关掉的是「他们自己往下聊」这件事本身，不是「线上的那一半」。
test("关掉自发聊天，线上线下两条自主续聊都得停", () => {
  // 线上那条本来就有
  assert.match(app, /if \(!gs\.memoryInterop \|\| gs\.autoChat === false\) continue;/, "线上那道闸没了");
  // 线下那条（群线下浮层里自己往下演）
  const i = app.indexOf("  // ---- 群线下 dongnian 驱动自发");
  assert.ok(i > 0, "群线下那条自主续演不见了");
  const eff = app.slice(i, app.indexOf("  // ---- 默认进线下", i));
  assert.match(eff, /if \(gsFor\(gid\)\.autoChat === false\) return;/, "线下这条没跟上——关了还在演");
  // ⚠️闸装了还得刷新：deps 里没有 groupSettings 的话，interval 闭包着旧设置照跑
  assert.match(eff, /\}, \[offlineGroup, groupSettings, chatSettings, sending\]\);/, "关掉后这个 interval 不会重建，闸等于没装");
  // 闸要排在 setInterval 之前：装在回调里每 20 秒白算一遍
  assert.ok(eff.indexOf("gsFor(gid).autoChat === false") < eff.indexOf("const timer = setInterval"), "闸装到回调里去了");
});

// 她 2026-09-10：「不要Lisa，改成设置里可以替换的名字」
test("生日那几行的名字来自设置，不是写死的", () => {
  const seg = app.slice(app.indexOf("    dateNote: (() => {"), app.indexOf("      // —— 纪念日：和这个角色在一起满几周年 ——"));
  assert.match(seg, /const uName = userName\(profile\);/, "又自己写了一份兜底");
  assert.ok(!/Lisa/.test(seg), "生日这一段里出现了写死的名字");
  // 群里那一句同理
  const g = app.slice(app.indexOf("      const gBdayHint = (() => {"), app.indexOf("      const gEmotes = emotesForGroup"));
  assert.match(g, /const uN = userName\(profile\);/);
  assert.ok(!/Lisa/.test(g), "群里那一句出现了写死的名字");
});
