// 她 2026-09-11：「你看看这个是为啥旁观群会提到我」——「大晏趣闻·旁观中」里，
// 陆闻把话头扔进群里，然后说「Lisa你评评理」。
//
// ⚠️病根是【说了一次，反着说了四次】。dir 里只有一句「成员们并不知道有任何外人在旁观」，
//   而那一整份系统提示词里，她的名字以【在场的人】的身份出现了四遍，而且都离输出更近：
//     ①【身份铁律】「用户「X」不是可代写的群成员」——读起来她就是群成员，只是不许代写；
//     ②【和大家说话的人 ·「X」的设定】——这个标题本身就在说她正在跟大家说话；
//     ③【成员间关系】整段的前提是「她在群里，别人会不会知道你和她的关系」；
//     ④ 她想要什么那一段写着「在场的人都可能知道」。
//   外加成员那一段里的〔对 X 的好感〕——好感 87 的人，一开口当然想找她。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");

test("旁观群有自己的身份铁律：不许对她说话，不是「不许代写她」", () => {
  assert.match(app, /const gSpec = !!gs\.spectate;/);
  const seg = app.slice(app.indexOf("const gIdRule = gSpec"), app.indexOf("const gMeBlock ="));
  assert.match(seg, /【身份铁律·旁观】/, "旁观群还在用普通群那一份");
  assert.match(seg, /\*\*绝不许对着 " \+ _uN \+ " 说话、@ Ta、向 Ta 提问、请 Ta 评理、把话头扔给 Ta、或者等 Ta 回答\*\*/,
    "「请她评理」正是她截到的那一句，得点名禁掉");
  assert.match(seg, /Ta 听不见，也不会回/);
  assert.match(seg, /旁白是这个场景本身，不是谁说出口的话/, "没说清旁白不是她在讲话");
  // 普通群那一份一个字都不许改（它治的是另一件事：别代写用户）
  assert.match(seg, /【身份铁律】用户「" \+ _uN \+ "」不是可代写的群成员：绝不生成用户的新台词、动作或心声/);
  // 两份都要保住「name 是唯一作者」那半句——那是输出格式，跟在不在场无关
  assert.equal((seg.match(/每个输出对象的 name 是该条唯一作者/g) || []).length, 2, "有一份漏了作者那半句");
  assert.match(app, /gPollHint \+ gIdRule \+ "\\n\\n【成员】/, "算出来了没拼进 system");
});

test("旁观群里，凡是「她在场／她跟你有关系」的层一律不发", () => {
  // ②【和大家说话的人】：她压根没在跟大家说话，这个标题就是错的
  assert.match(app, /const gMeBlock = \(!gSpec && profile && \(profile\.name \|\| profile\.persona\)\)/);
  // ③【成员间关系】：那一整段的前提是「她在群里」
  // ⚠️右边界要从 gRelRule 那儿往后找——gWishHint 声明在它【前面】，从头找会切出一段空的
  const _ri = app.indexOf("const gRelRule = gSpec");
  const rel = app.slice(_ri, app.indexOf("\n", app.indexOf(": \"\\n\\n【成员间关系 · ", _ri)));
  assert.match(rel, /【成员间关系】\\n下面是这几位【彼此之间】是什么关系/, "旁观群还在用「关系隐私铁律」那一大段");
  assert.match(rel, /【成员间关系 · ⚠️关系隐私铁律】/, "普通群那一份被删了——那条铁律还得守着");
  // ④ 想要清单：那一段写着「在场的人都可能知道」
  assert.match(app, /const gWishHint = \(!gs\.spectate && \(wishRef\.current \|\| \[\]\)\.length\)/);
  // ⑤ 成员那一段里的好感和情侣状态
  assert.match(app, /afSeg: o\.spectate \? "" : "\\n〔对 " \+ userName\(profile\) \+ " 的好感〕"/);
  assert.match(app, /cpSeg: \(\(\) => \{ if \(o\.spectate\) return ""; const l = coupleLineFor/);
  // system 里那三段都换成了变量，旧的那几串不许再原地留着
  assert.ok(app.indexOf('+ "\\n\\n【和大家说话的人 · 「" + userName(profile)') < 0, "旧的那一串还原地留着");
});

test("「这是不是旁观群」三处调用点都得传下去（少传一处，那一处照旧把她拽进场）", () => {
  assert.match(app, /const _now = groupNowSegs\(c, \{ interop: gs\.memoryInterop, spectate: !!gs\.spectate \}\);/, "群聊线上");
  assert.match(app, /const now = groupNowSegs\(c, \{ interop: gsp\.memoryInterop, spectate: !!gsp\.spectate \}\);/, "投票那一处");
  assert.match(app, /const n = groupNowSegs\(c, \{ interop: gcInterop, spectate: !!gcSpectate \}\);/, "群通话");
  assert.match(app, /const gcSpectate = !!\(cgs && cgs\.spectate\);/, "群通话没算旁观");
  assert.equal((app.match(/groupNowSegs\(c, \{ interop/g) || []).length, 3, "多了一处调用点，检查它传没传 spectate");
});

test("普通群一个字都没变（这一轮只动旁观那一支）", () => {
  // 普通群仍要有的那几样
  assert.match(app, /绝不生成用户的新台词、动作或心声/);
  assert.match(app, /每个成员和用户「" \+ _uN \+ "」是什么关系（恋人\/暧昧\/朋友…）【只有该成员本人知道】/);
  assert.match(app, /【" \+ userName\(profile\) \+ " 最近看上但没买的东西】/);
  assert.match(app, /〔对 " \+ userName\(profile\) \+ " 的好感〕/);
});
