// 频道第二批（她 2026-11-20）：小活动机器人、每周称号、接龙、悄悄话，以及旁观频道一律不露她在场
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const grab = (src, name) => { const i = src.indexOf("function " + name + "("); return src.slice(i, src.indexOf("\n}\n", i) + 3); };
const ctx = {}; vm.createContext(ctx);
vm.runInContext("const SPACE_BOT_NAME='小频';const WEEK_TITLE_CAP=6;const SPACE_ASK_POOL=['a','b','c'];" + grab(en, "spaceAskPick") + grab(en, "spaceBotLine") + grab(en, "chainAppend") + grab(en, "spaceWeekTitles") + ";this.o={spaceAskPick,spaceBotLine,chainAppend,spaceWeekTitles};", ctx);
const o = ctx.o;
test("每日一问同一天同一个空间抽到的是同一句", () => { assert.equal(o.spaceAskPick("2026-11-20", "sp1"), o.spaceAskPick("2026-11-20", "sp1")); });
test("接龙：接最新那张没收的卡，同一个人不连着接两棒", () => {
  const msgs = [{ kind: "spacebot", bot: "chain", topic: "t", items: [{ who: "me", text: "一" }] }];
  const r = o.chainAppend(msgs, "c1", "阿屿", "二"); assert.equal(r.idx, 0); assert.equal(r.msg.items.length, 2);
  assert.equal(o.chainAppend([r.msg], "c1", "阿屿", "三"), null);
  assert.match(o.spaceBotLine(r.msg), /"chain":\{"text"/);
});
test("称号只照这一周真聊天的条数算，她不算在里面", () => {
  const now = 10 * 86400000, chs = [{ id: "a" }, { id: "b" }];
  const chats = { a: [{ role: "assistant", senderId: "x", ts: now - 1 }, { role: "assistant", senderId: "x", ts: now - 2 }, { role: "user", senderId: "me", ts: now - 3 }, { role: "assistant", senderId: "z", ts: now - 4 }], b: [{ role: "assistant", senderId: "z", ts: now - 5 }] };
  const t = o.spaceWeekTitles(chs, id => chats[id] || [], ["x", "y", "z"], now, 7);
  assert.equal(t.x, "本周话最多"); assert.equal(t.y, "潜水冠军"); assert.equal(t.z, "最爱歪楼"); assert.ok(!("me" in t));
});
test("旁观频道不露她：机器人和欢迎只往非旁观频道贴，一起听、悄悄话、接龙在旁观里都不给，她收的旁观精华不被提起，新人不塞进旁观频道", () => {
  assert.match(ap, /const spaceHomeChannel = spId => \{\n\s+const chs = [^\n]*!groupSpectating\(g\)\);/);
  assert.match(ap, /const welcomeNew = [\s\S]{0,400}const g = spaceHomeChannel\(spId\);/);
  assert.match(ap, /gListenHint = group && group\.spaceId && group\.chListen && !groupSpectating\(group\)/);
  assert.match(ap, /L0 = spect \? null : chListenOf\(activeGroup\.id\)/);
  assert.match(ap, /filter\(x => !\(x && x\.by === "me" && chSpectId\(x\.gid\)\)\)/);
  assert.match(ap, /_priv \? \[\] : added\.filter/);
  assert.match(cs, /!_gSpect \? \[\["chain"/);
  assert.match(cs, /members\.length && !_gSpect \? \[\["whisper"/);
});
test("悄悄话和机器人卡不出现在别的频道的动态里；她的悄悄话在群里显示成灰字一行", () => {
  assert.match(en, /m\.role !== "system" && !m\.whisper && m\.kind !== "spacebot"\)\.slice\(-2\)/);
  assert.match(cs, /text: m\.who === "char" \|\| m\.whisper \? groupActText\(m\) : m\.content/);
  assert.match(ap, /m\.kind === "spacebot" \? spaceBotLine\(m\)/);
});
test("群聊那边自己定义 _gSpect（v89.883 只在单聊里定义，进群白屏）", () => {
  const cs = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
  const i = cs.indexOf("function GroupThread("), j = cs.indexOf("const PANEL = [", i);
  assert.match(cs.slice(i, j), /const _gSpect = /);
});
