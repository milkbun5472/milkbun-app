"use strict";
// 他带路、日历、今天想做的、生日（她 2026-09-18：「引路那几句都放一天，用自己的口气；日历也做；生日按人格档案馆换算」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const rules = rd("apps/fairy-garden/rules.js");
const book = rd("apps/fairy-garden/season-book.mjs");
const html = rd("apps/fairy-garden/index.html");
function service(callAI){const ctx={React:{},WeakMap,JSON,Error,extractJSON:JSON.parse,callAI,narrativeCore:()=> '共同文风',CONDESCENDING_TONE_BAN:'公共规则',REGISTER_FOLLOWS_SCENE:'',STOCK_REPLY_BAN:'',OVERREACH_BAN:'',ECHO_QUESTION_BAN:'',userName:p=>p.name};ctx.window=ctx;vm.runInNewContext(rules,ctx);vm.runInNewContext(host,ctx);return ctx.FairyGardenService;}
const W = () => import("../apps/fairy-garden/world.mjs");
const nearby = s => ({ ...s, companion: { ...s.companion, map: s.map, position: { ...s.position } } });

test("他带路：七件放同一天，做没做看的是存档；换季那天另一站；默认关，进庭院房开一次", async () => {
  const w = await W();
  const c = await import("../apps/fairy-garden/companion.mjs");
  const off = w.freshState();
  assert.equal(w.guideStep(off), null, "试玩和测试里默认关着");
  assert.equal(c.companionPlan(off).id.startsWith("guide:"), false);
  let s = w.setGuide(off, true);
  assert.equal(w.guideStep(s).id, "well");
  assert.ok(w.restoreGuide(s.guide).asked);
  // 他站到井边旁边（不是井口那个点上）等她
  const ctrl = c.makeCompanionController();
  for (let i = 0; i < 300; i++) s = ctrl.tick(s, .1, { allowCare: true }).state;
  assert.equal(ctrl.view().status, "在这儿等你");
  const well = w.MAPS.garden.stations.well, d = Math.hypot(s.companion.position.x - well.x, s.companion.position.z - well.z);
  assert.ok(d > .5 && d < 1.3, "站旁边：" + d);
  // 做了就翻页；老存档已经做过的直接算过
  s = w.guideAdvance({ ...s, water: 3 });
  assert.equal(w.guideStep(s).id, "garden");
  s = w.guideAdvance({ ...s, blooms: 1, herbs: 2, gifts: [{ day: 1, name: "x", family: "herb", stance: "", said: [], from: "me" }] });
  assert.equal(w.guideStep(s).id, "sow");
  assert.equal(w.restoreGuide(s.guide).step, 4);
  s = w.guideAdvance({ ...s, seeds: [{ id: "a", kind: "miss", ask: "", day: 1, done: false }], quests: [{ id: "q", kind: "find", from: "x", need: 1, season: 0, cycle: 0, lastDay: 4, done: false }] });
  assert.equal(w.guideStep(s).id, "sit");
  s = w.guideAdvance(w.noteBond(s, "sit", "坐"));
  assert.equal(w.guideStep(s), null, "七件走完，春天没有换季那一站");
  // 说过的那句只说一次
  assert.ok(!w.guideSaid(s, "sit")); s = w.markGuideSaid(s, "sit"); assert.ok(w.guideSaid(s, "sit"));
  assert.equal(w.markGuideSaid(s, "sit"), s);
  // 夏天第一天：带她去看水磨；走到跟前就算看过，第二天不再带
  let summer = w.setGuide({ ...w.freshState(), day: 15, water: 3, blooms: 1, herbs: 2, gifts: [{ day: 1, name: "x", family: "herb", stance: "", said: [], from: "me" }], seeds: [{ id: "a", kind: "miss", ask: "", day: 1, done: false }], deeds: 1, bond: [{ kind: "sit", day: 1, text: "" }] }, true);
  assert.equal(w.guideStep(summer).id, "season:1");
  const at = w.guideTarget(summer);
  summer = w.guideAdvance({ ...summer, map: at.map, position: { ...at.target } });
  assert.equal(w.guideStep(summer), null);
  assert.deepEqual(w.restoreGuide(summer.guide).seasons, [1]);
  assert.equal(w.guideStep({ ...summer, day: 16 }), null);
  // 关了就不带；读档不丢
  assert.equal(w.guideStep(w.setGuide(summer, false)), null);
  assert.deepEqual(w.restoreState(JSON.parse(JSON.stringify(summer))).guide, w.restoreGuide(summer.guide));
  // 游戏那头：点记号说那句，零调用；他站着等的时候才有记号
  assert.match(game, /function guideTalkReady\(\)\{const step=guideStep\(data\);return !!step&&!guideSaid\(data,step\.id\)&&companionNearby\(data\)&&companionController\.view\(\)\.status==='在这儿等你';\}/);
  assert.match(game, /if\(!restoreGuide\(data\.guide\)\.asked\)data=setGuide\(data,true\);/, "庭院房第一次开档打开一次");
  assert.match(game, /const g=guideAdvance\(data\);if\(g!==data\)\{data=g;companionController\.reset\(\);ui\(\);\}/);
  assert.match(host, /bond\.guide\.on \? "开着" : "关着"/);
});

test("带路那十句：一位角色一枪，料在 system、user 一句触发；不塞内容示范", async () => {
  let calls = 0, args;
  const svc = service(async (...a) => { calls++; args = a; return JSON.stringify({ lines: [
    { step: "well", text: "水在下面。" }, { step: "garden", text: "浇。" }, { step: "herbs", text: "草。" }, { step: "gift", text: "给我。" }, { step: "sow", text: "写。" }, { step: "bogus", text: "x" } ] }); });
  const rows = await svc.guideLines({ active: {}, character: { name: "他", persona: "全文人设" }, profile: { name: "她" }, world: { day: 1 } });
  assert.equal(calls, 1); assert.equal(rows.length, 5);
  assert.equal(JSON.stringify(rows[0]), JSON.stringify({ step: "well", text: "水在下面。" }));
  const [, sys, messages, opts] = args;
  assert.match(sys, /全文人设/); assert.match(sys, /十站/);
  assert.equal(messages.length, 1); assert.ok(messages[0].content.length <= 8);
  assert.equal(opts.maxTokens, 65535);
  await assert.rejects(() => service(async () => JSON.stringify({ lines: [{ step: "well", text: "一句" }] })).guideLines({ active: {}, character: { name: "x" }, profile: {}, world: {} }), /没读出/);
  assert.match(host, /guides: \{ \.\.\.\(old\.guides \|\| \{\}\), \[cid\]: \{ status: "ready", at: Date\.now\(\), rows \} \}/);
  const seg = host.slice(host.indexOf("async function guideLines("), host.indexOf("return normalizeGuide(raw);"));
  assert.doesNotMatch(seg, /"text":"[^"]*[，。！][^"]*"/, "输出格式里的 text 只能是说明");
});

test("日历：集市、换板子、他约你、花开、开封、瓶子到、他的生日，全从存档算", async () => {
  const w = await W();
  let s = w.freshState();
  s = { ...s, day: 2, invite: { place: "market", day: 5, note: "" }, seeds: [{ id: "a", kind: "miss", ask: "", day: 2, done: false }],
    things: [{ id: "t", name: "x", note: "", kind: "echo", way: "ferment", recipe: "r", from: "", day: 6, openDay: 8, spot: null }],
    bottles: [{ id: "b", text: "x", day: 3, openDay: 10, taken: false, replyWanted: false }] };
  const marks = w.calendarMarks(s, w.gameBirthday(4, 20));
  assert.deepEqual(marks[4], ["集市"]); assert.deepEqual(marks[1], ["换板子"]); assert.deepEqual(marks[5], ["换板子", "他约你", "花开"]);
  assert.deepEqual(marks[8], ["集市", "开封", "他的生日"], "四月二十换算成春天第八天"); assert.deepEqual(marks[10], ["瓶子到"]);
  assert.ok(!Object.values(w.calendarMarks({ ...s, day: 20 }, w.gameBirthday(4, 20))).some(m => m.includes("他的生日")), "夏天没有他的生日");
  assert.match(book, /const marks=calendarMarks\(s,s\.birthday\);for\(let d=1;d<=14;d\+\+\)/);
  assert.match(html, /<div id="season-calendar" class="calendar"/);
});

test("生日：公历月日换算成村里的一年；生日那天递东西相处册多一格", async () => {
  const w = await W();
  assert.equal(w.gameBirthday(3, 1), 1); assert.equal(w.gameBirthday(5, 31), 14);
  assert.equal(w.gameBirthday(6, 1), 15); assert.equal(w.gameBirthday(12, 25), 46); assert.equal(w.gameBirthday(2, 28), 56);
  assert.equal(w.gameBirthday(13, 1), 0);
  const svc = service();
  assert.equal(svc.gameBirthday(7, 15), w.gameBirthday(7, 15), "宿主那份算法和 world 的一致");
  const bday = w.gameBirthday(3, 20);
  let s = nearby({ ...w.freshState(), birthday: bday, day: bday, harvest: 1 });
  assert.ok(w.isBirthday(s)); assert.ok(!w.isBirthday({ ...s, day: bday + 1 })); assert.ok(w.isBirthday({ ...s, day: bday + 56 }), "每年都过");
  const g = w.giveGift(s, { type: "flower" }, null);
  assert.ok(w.bondKinds(g).has("birthday")); assert.match(g.happenings[0].text, /他生日这天/);
  assert.equal(w.restoreState(JSON.parse(JSON.stringify(s))).birthday, bday);
  assert.match(host, /birthday: gameBirthdayOf\(c\)/);
  assert.match(game, /data\.birthday=Math\.max\(0,Math\.min\(56,Number\(boundPartner\.birthday\)\|\|0\)\)/);
});

test("今天想做的：三条，按存档现算，带路那条排最前", async () => {
  const w = await W();
  const s = w.setGuide(w.freshState(), true);
  assert.equal(w.todayHints(s)[0].kind, "guide");
  const busy = { ...w.freshState(), day: 4, deeds: 2, magic: { ...w.freshMagic(), planted: true, growth: 1, wateredDay: 1, plantedDay: 1, wilted: true },
    quests: [{ id: "q", kind: "find", from: "x", need: 1, season: 0, cycle: 0, lastDay: 4, done: false }] };
  const hints = w.todayHints(busy);
  assert.equal(hints.length, 3);
  assert.deepEqual(hints.map(h => h.kind), ["wilt", "quest", "market"]);
  assert.match(hints[2].text, /集市日.*2 分/);
  assert.equal(w.todayHints(w.freshState())[0].kind, "free");
  assert.match(game, /const hints=todayHints\(data\);const list=\$\('today-list'\);/);
  assert.match(html, /<ul id="today-list" class="today-list" hidden><\/ul>/);
});
