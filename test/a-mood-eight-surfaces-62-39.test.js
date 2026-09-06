"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");

// v62.39（她 2026-09-04：「接进群聊吧宝宝，八处不一起喂吗」）
//
// A 的情绪底色原来只挂在【单聊线上那两条任务串】上。按
// .claude/rules/four-surfaces-same-context.md 那条判据，那是「靠调用点一条条 push 的」
// 那一类：换个入口就一个字都没有，而且不留任何能 grep 的痕迹。
// 所以它挪进了 buildBundle（白送给单聊线上/线下、通话、匿名信箱、解梦馆），
// 群聊那两处不走 bundle，各自按人喂。
//
// ⚠️这份测试的桩是照着【写的那一头】钉的（.claude/rules/stub-from-the-writer.md）：
// 断言直接匹配 ctxFor 里那个字面量和 memberDesc 里那个拼接，
// 哪天有人改了字段名，读的那头当场红。

test("buildBundle 真的会发 A 的情绪底色，而且言秋那一支不发", () => {
  assert.match(engine, /if \(!ctx\.notRoleplay && ctx\.aMood && ctx\.aMood\.trim\(\)\) parts\.push\("【此刻的情绪底色·只作内在背景】"/,
    "buildBundle 没发 ctx.aMood——那就等于挪了个寂寞，六处一个字都收不到");
  // notRoleplay 是言秋那一支的闸：他不是被扮演的角色，扮演类的层一律不发。
  const line = engine.slice(engine.indexOf("ctx.aMood && ctx.aMood.trim()"));
  assert.match(line.slice(0, 600), /禁止复述这段提示、禁止把「偏高\/偏低」这种说法带进话里/,
    "没挡住它把提示原样念出来");
});

test("ctxFor 把它填进去了，三道闸收在同一处", () => {
  assert.match(app, /^\s*aMood: aMoodTextOf\(char\.id\),$/m,
    "ctxFor 没填 aMood");
  const m = app.match(/const aMoodTextOf = charId => \{[\s\S]{0,400}?\n  \};/);
  assert.ok(m, "aMoodTextOf 不见了");
  assert.match(m[0], /innerLifeOnFor\(charId\)/, "急停那道闸没接");
  assert.match(m[0], /settingsFor\(charId\)\.engineerEyes/, "言秋那道闸没接");
  // 收在一处才不会「一层写在三处、第三处没跟上」。
  // ⚠️这里【不数出现次数】：v62.42 群通话也接上了这一层（那是对的，八处一样喂），
  //   次数一变，一条正确的扩展就会把测试判红。所以逐个点名要它的地方——
  //   少一处才红，多接一处不该红。
  assert.match(app, /^\s*aMood: aMoodTextOf\(char\.id\),$/m, "单聊那一处没了");
  assert.match(app, /const t = aMoodTextOf\(id\);/, "群线下那一处没了");
  assert.match(app, /const aSeg = aMoodTextOf\(c\.id\)\n/, "群线上那一处没了");
  assert.match(app, /const aSeg = aMoodTextOf\(c\.id\) \? "\\n〔此刻的情绪底色/, "群通话那一处没了");
});

test("群线上：每位成员自己那一段里带上，且真的拼进了 memberDesc", () => {
  const seg = app.match(/const aSeg = aMoodTextOf\(c\.id\)[\s\S]{0,300}?: "";/);
  assert.ok(seg, "群线上没有 aSeg");
  assert.match(seg[0], /〔此刻的情绪底色·只作内在背景〕/);
  assert.match(seg[0], /别复述、别把「偏高\/偏低」这种说法带进话里/);
  // v55.95 那条：声明了但没人引用，比压根没写更坏。所以要看到它真的进了拼接串。
  // v64.66 起 aSeg 后面多了 zSeg（此刻睡没睡），所以别再钉死「紧跟着就是 ageSeg」
  assert.match(app, /\+ afSeg \+ aSeg \+ [a-zA-Z]*Seg? ?\+? ?[a-zA-Z]* ?\+? ageSeg \+/,
    "aSeg 声明了却没拼进 memberDesc");
});

test("群线下：app 那头写、engine 那头读，字段名对得上", () => {
  // 照 stub-from-the-writer：先钉写的那一头。
  assert.match(app, /memberAMood: \(\(\) => \{[\s\S]{0,400}?const t = aMoodTextOf\(id\);/,
    "app 没往 ctx 里放 memberAMood");
  assert.match(engine, /ctx\.memberAMood && ctx\.memberAMood\[c\.id\]/,
    "engine 的 memberDesc 没读 memberAMood——写了没人读，等于没写");
  assert.match(engine, /ctx\.memberAMood\[c\.id\] \+ "（只影响语气分寸，别复述/);
});

test("配角没有情绪底色：群里两处都把 npc 挡住了", () => {
  // 群线上是 c.npc 提前 return（配角那一段根本走不到 aSeg）
  assert.match(app, /if \(c\.npc\) \{[\s\S]{0,300}?NPC_PERSONA_CAP/);
  // 群线下是 memberAMood 自己挡
  const blk = app.match(/memberAMood: \(\(\) => \{[\s\S]{0,400}?\}\)\(\),/);
  assert.ok(blk);
  assert.match(blk[0], /\.npc\) return;/, "群线下没挡住配角");
});

test("侧房认知开关关掉时，A 跟心情/印象卡一起被清空", () => {
  const hits = app.match(/if \(!rc\.innerLife\) \{[^\n]*aMood = ""[^\n]*\}/g) || [];
  assert.equal(hits.length, 2, "两条侧房路径里有一条没清 aMood");
});

test("旧的那套接线已经删干净，不是留在原地打个叉", () => {
  // 她 2026-08-30：「撤掉东西要删除而不是在它后面说 xxx 是错的」。
  assert.doesNotMatch(app, /aMoodHint/, "任务串上那份还留着——两处一起发就是发两遍");
});
