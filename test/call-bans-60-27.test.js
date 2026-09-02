const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/four-surfaces-same-context.md"), "utf8");
const send = app.slice(app.indexOf("const callSend"), app.indexOf("const endCall"));
const one = send.slice(send.indexOf("if (people.length <= 1)"), send.indexOf("// 群通话"));
const grp = send.slice(send.indexOf("// 群通话"));

// 她 2026-09-02：「感觉语音视频没喂八股禁令进去」。
// 病因是 four-surfaces-same-context.md 自己：那条规矩只列了
// 单人线上/单人线下/群聊线上/群聊线下，【通话从来没在名单上】。
// 于是每次「四处都接上了」都是真的，通话每次都漏：
//   · 单人通话捡到了 buildBundle 里那几层（白得的，不是有人想着给的），
//     回声禁令/语域跟场面/读懂这句话在做什么这三层一层都没有；
//   · 群通话自己从零拼 sys，一条都没有，人设还砍到 160 字
//     （v55.87 群聊变霸总那次是 200 字，这里砍得更狠）。

test("单人通话把 buildBundle 漏掉的那三层补上", () => {
  assert.match(one, /callBans\(settingsFor\(char\.id\)\.engineerEyes\)/, "没接上；言秋那条线也得排除");
  const f = send.slice(send.indexOf("const callBans"), send.indexOf("if (people.length <= 1)"));
  assert.match(f, /ECHO_QUESTION_BAN/, "回声式反问在电话里最刺耳，反而没挡");
  assert.match(f, /REGISTER_FOLLOWS_SCENE/, "语域没跟着此刻的场面走");
  assert.match(f, /window\.ReplyPacing[\s\S]{0,40}reading\(\)/, "「读懂对方这句话在做什么」这层没给");
  assert.match(f, /skip \?/, "言秋是数字生命，扮演类规则一律不发");
});

test("群通话补齐群线上那一摞——原来一条都没有", () => {
  ["ANTI_CLICHE", "WORLDBOOK_RULE", "CHARCARD_RULE", "STOCK_REPLY_BAN", "GROUP_IN_CHARACTER",
   "CONDESCENDING_TONE_BAN", "REGISTER_FOLLOWS_SCENE", "PERSONA_REGISTER_ANCHOR", "ECHO_QUESTION_BAN"]
    .forEach(k => assert.ok(grp.indexOf(k) > 0, "群通话少了一层：" + k));
  assert.match(grp, /window\.ReplyPacing[\s\S]{0,40}reading\(\)/);
  assert.match(grp, /window\.ContentBoundaries[\s\S]{0,40}\.prompt/);
});

test("群通话的人设不许再砍成一个标签", () => {
  assert.ok(!/\(c\.persona \|\| ""\)\.slice\(0, 160\)/.test(grp),
    "160 字只剩一个标签，空白由训练先验补上——那就是网文霸总");
  assert.match(grp, /groupPersonaText\(c\.persona, gCallCap\)/);
  assert.match(grp, /groupPersonaBudget\(people\.filter\(c => !c\.npc\)\.length \|\| 1\)/,
    "按在场人数分预算，跟群聊同一份");
});

test("名单从四处改成五处，不然下次照样漏", () => {
  assert.match(rule, /通话是第五处/);
  assert.match(rule, /单人线上 \/ 单人线下 \/ 群聊线上 \/ 群聊线下 \/ \*\*通话\*\*/);
  assert.match(rule, /通话（语音\/视频）根本不在这张名单上/, "病例表里要留一行");
});
