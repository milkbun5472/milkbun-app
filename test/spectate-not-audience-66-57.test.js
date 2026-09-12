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
// 她 2026-09-11：「你看看这个是为啥旁观群会提到我」——「大晏趣闻·旁观中」里，
// 陆闻把话头扔进群里，然后说「Lisa你评评理」。
//
// ⚠️病根是【说了一次，反着说了四次】：dir 里只有一句「成员们并不知道有任何外人在旁观」，
//   而【身份铁律】那句「用户「X」不是可代写的群成员」读起来就是「她是群成员，只是不许代写」，
//   离输出还更近。
//
// ⚠️第一版（v66.56）我治过了头——把好感、情侣状态、关系隐私铁律、她是谁、想要清单
//   一并删掉了。她当场纠正：「我有旁观群就是看他们感情的，你去掉好感和情侣段怎么行。
//   而且有时候和他们好朋友在群聊肯定也会提到女朋友之类的吧」。
//   **「不在场」不等于「不存在」**：她照样是他们生活里的那个人，删掉那几层等于把
//   她开旁观群要看的东西一起删了。
//   所以旁观群唯一该变的只有一件事：**她听不见** → 不许对着她说话；
//   像聊一个不在场的人那样聊她，完全可以。
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
  // ⚠️禁的是【对着她说话】，不是【提起她】——这一句是她纠正出来的，不能少
  assert.match(seg, /⚠️但\*\*提起 Ta 是可以的\*\*/, "把「提起她」也一起禁了，那她的旁观群就没得看了");
  assert.match(seg, /想 Ta、提 Ta、抱怨 Ta、打趣谁跟 Ta 的事，都照你们本来的样子来/);
  assert.match(seg, /只是别转过头对着 Ta 说话/);
  // 「别代写她」那半句旁观群也要有（原来只长在普通群那一份里）
  assert.match(seg, /绝不生成 " \+ _uN \+ " 的台词、动作或心声/, "旁观群漏了「别代写她」");
  // 普通群那一份一个字都不许改（它治的是另一件事：别代写用户）
  assert.match(seg, /【身份铁律】用户「" \+ _uN \+ "」不是可代写的群成员：绝不生成用户的新台词、动作或心声/);
  // 两份都要保住「name 是唯一作者」那半句——那是输出格式，跟在不在场无关
  assert.equal((seg.match(/每个输出对象的 name 是该条唯一作者/g) || []).length, 2, "有一份漏了作者那半句");
  assert.match(app, /gPollHint \+ gIdRule \+ "\\n\\n【成员】/, "算出来了没拼进 system");
});

test("她不在场 ≠ 她不存在：好感、情侣、关系铁律、她是谁、想要清单，一层都不许少", () => {
  // ⚠️v66.56 我第一版把这几层全删了，她当场纠正：「我有旁观群就是看他们感情的，
  //   你去掉好感和情侣段怎么行。而且有时候和他们好朋友在群聊肯定也会提到女朋友之类的吧」。
  //   她开旁观群要看的就是这些。旁观群唯一该变的只有一件事：她听不见。
  assert.match(app, /afSeg: "\\n〔对 " \+ userName\(profile\) \+ " 的好感〕"/, "旁观群的好感被删了");
  assert.match(app, /cpSeg: \(\(\) => \{ const l = coupleLineFor/, "旁观群的情侣状态被删了");
  // 关系隐私铁律旁观群更需要：两个人都跟她有关系时，正是这条挡住互相拆穿
  assert.match(app, /const gRelRule = "\\n\\n【成员间关系 · ⚠️关系隐私铁律】/, "旁观群没了那条铁律");
  assert.ok(app.indexOf("const gRelRule = gSpec") < 0, "又给旁观群另写了一份阉割的关系段");
  // 她是谁：照给，只是标题不能再说她「和大家说话」
  assert.match(app, /const gMeBlock = \(profile && \(profile\.name \|\| profile\.persona\)\)/, "旁观群里她是谁被删了");
  assert.match(app, /gSpec \? "他们各自认识的那个人 · 「" \+ _uN \+ "」的设定（Ta 此刻不在这个群里）" : "和大家说话的人/);
  // 想要清单：照给，只把「在场的人」换成「认识她的人」
  assert.match(app, /const gWishHint = \(wishRef\.current \|\| \[\]\)\.length/);
  assert.match(app, /gs\.spectate \? "认识她的人都可能知道。" : "在场的人都可能知道。"/);
});

test("撤掉的东西是删掉，不是留个没人读的形参", () => {
  // groupNowSegs 那个 spectate 参数第一版加过，这一版不需要了——三处调用点都要回到原样
  assert.match(app, /const _now = groupNowSegs\(c, \{ interop: gs\.memoryInterop[^)]*\}\);/);
  assert.match(app, /const n = groupNowSegs\(c, \{ interop: gcInterop \}\);/);
  assert.ok(app.indexOf("gcSpectate") < 0, "群通话那个没人读的常量还留着");
  assert.ok(app.indexOf("o.spectate") < 0, "groupNowSegs 里还留着没人传的分支");
});

test("普通群一个字都没变（这一轮只动旁观那一支）", () => {
  // 普通群仍要有的那几样
  assert.match(app, /绝不生成用户的新台词、动作或心声/);
  assert.match(app, /每个成员和用户「" \+ _uN \+ "」是什么关系（恋人\/暧昧\/朋友…）【只有该成员本人知道】/);
  assert.match(app, /【" \+ userName\(profile\) \+ " 最近看上但没买的东西】/);
  assert.match(app, /〔对 " \+ userName\(profile\) \+ " 的好感〕/);
});
