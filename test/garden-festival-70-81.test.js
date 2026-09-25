"use strict";
// 换季那晚的灯会、第一天少露按钮（她 2026-09-18：「一季一件要准备的大事」「前十分钟太满」「做吧」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const comp = rd("apps/fairy-garden/companion.mjs");
const html = rd("apps/fairy-garden/index.html");
const book = rd("apps/fairy-garden/season-book.mjs");
const lake = rd("apps/fairy-garden/lake-view.mjs");
const keep = rd("apps/fairy-garden/keepsake-view.mjs");
const W = () => import("../apps/fairy-garden/world.mjs");
const C = () => import("../apps/fairy-garden/companion.mjs");
const J = x => JSON.parse(JSON.stringify(x));
const nearby = s => ({ ...s, companion: { ...s.companion, map: s.map, position: { ...s.position } } });

test("灯会：每季最后一晚天黑后，在月潭栈桥，两个人都在，三样齐了才放；攒不齐就等下一季", async () => {
  const w = await W();
  const s = w.freshState();
  assert.deepEqual([1, 13, 14, 15, 28, 56].map(d => w.festivalDay(d)), [false, false, true, false, true, true]);
  assert.equal(w.nextFestival(1), 14); assert.equal(w.nextFestival(14), 28);
  assert.match(w.festivalError({ ...s, day: 5 }), /每季最后一晚，下次是第 14 天/);
  assert.match(w.festivalError({ ...s, day: 14 }), /天黑才开/);
  const night = { ...s, day: 14, minute: w.seasonOf(14).dusk };
  assert.ok(w.festivalOpen(night));
  assert.equal(w.festivalError(night), "还差：一朵星铃花、三朵月光花、一样吃的。");
  assert.deepEqual(w.festivalMissing({ ...night, harvest: 3 }).map(n => n.id), ["starflower", "food"]);
  const ready = { ...night, harvest: 3, magic: { ...s.magic, flowers: 1 }, pantry: [{ uid: "f1", id: "cake", day: 14, from: "fair" }] };
  assert.ok(w.festivalReady(ready));
  assert.equal(w.festivalError(ready), "先走到月潭栈桥。");
  const at = { ...ready, position: { ...w.MAPS.garden.stations.bottle }, companion: { ...s.companion, map: "home" } };
  assert.equal(w.festivalError(at), "等他到了一起放。");
  const both = nearby(at);
  assert.equal(w.festivalError(both), "");
  const h = w.holdFestival(both, "明年还来");
  assert.notEqual(h, both);
  assert.equal(h.harvest, 0); assert.equal(h.magic.flowers, 0); assert.equal(h.pantry.length, 0, "三样真用掉");
  assert.deepEqual(h.festivals, [{ season: 0, day: 14, wish: "明年还来", together: true }]);
  assert.ok(w.bondKinds(h).has("festival"));
  assert.equal(h.things[0].id, "fl_0"); assert.equal(h.things[0].recipe, "festivallantern"); assert.match(h.things[0].name, /春天灯会的灯笼/); assert.match(h.things[0].note, /明年还来/);
  assert.ok(w.thingReady(h, h.things[0]), "灯笼当晚就摆得出来");
  assert.equal(h.waterLights.length, 2); assert.ok(h.waterLights.every(l => l.where === "deck" && l.together), "两盏灯从栈桥漂出去");
  assert.equal(h.wishes[0].text, "明年还来");
  assert.match(h.happenings[0].text, /在月潭栈桥放了灯会的灯，分着吃了铃叶糕/);
  assert.match(w.festivalError(h), /已经放过了/); assert.equal(w.holdFestival(h, ""), h);
  assert.ok(w.festivalDone(h)); assert.ok(!w.festivalDone({ ...h, day: 28 }), "下一季又能放");
  const again = w.holdFestival(nearby({ ...h, day: 28, minute: w.seasonOf(28).dusk, harvest: 3, magic: { ...h.magic, flowers: 1 }, pantry: [{ uid: "f2", id: "tea", day: 28, from: "home" }] }), "");
  assert.equal(again.things.length, 2); assert.equal(again.things[0].id, "fl_1"); assert.equal(again.wishes.length, 1, "空着就不进漂流池");
  // 读档不丢
  const back = w.restoreState(J(h));
  assert.deepEqual(back.festivals, h.festivals); assert.deepEqual(back.waterLights, h.waterLights); assert.equal(back.things[0].recipe, "festivallantern");
  assert.deepEqual(w.restoreState({}).festivals, []);
  assert.equal(w.ACTION_MINUTES.festival, 20);
  assert.equal(w.BOND_KINDS.festival, "一起放过灯会的灯");
});

test("灯会写在日历、今天想做的、季节手册上，前三天就提醒还差什么；他那一晚排去栈桥，雨天照常", async () => {
  const w = await W(), c = await C();
  const s = w.freshState();
  assert.ok(w.calendarMarks({ ...s, day: 14 })[14].includes("灯会"));
  assert.deepEqual(w.todayHints({ ...s, day: 10 }).map(h => h.kind), ["free"], "第十天还不催");
  assert.match(w.todayHints({ ...s, day: 11 })[0].text, /第 14 天晚上灯会，还差一朵星铃花、三朵月光花、一样吃的/);
  assert.match(w.todayHints({ ...s, day: 14 }).find(h => h.kind === "festival").text, /今晚灯会，还差/);
  assert.match(w.todayHints({ ...s, day: 14, minute: 1200, harvest: 3, magic: { ...s.magic, flowers: 1 }, pantry: [{ uid: "f1", id: "tea", day: 14, from: "home" }] }).find(h => h.kind === "festival").text, /灯会开了，去月潭栈桥放灯/);
  const b = w.festivalBook({ ...s, day: 12, harvest: 3 });
  assert.equal(b.day, 14); assert.deepEqual(b.needs.map(n => n.have), [false, true, false]); assert.equal(b.ready, false); assert.equal(b.held, 0);
  assert.ok(w.ACTIVITIES.festival && w.ACTIVITIES.festival.map === "garden");
  assert.equal(c.dailySchedule({ ...s, day: 14 }).find(x => x.id === "festival").start, 1140);
  assert.ok(!c.dailySchedule({ ...s, day: 13 }).some(x => x.id === "festival"), "十三号是夜市不是灯会");
  assert.ok(!c.dailySchedule({ ...s, day: 3 }).some(x => x.id === "festival"));
  const plan = { season: 0, days: Array.from({ length: 14 }, (_, i) => ({ day: i + 1, note: "", activities: [{ id: "walk", note: "" }, { id: "bridge", note: "" }, { id: "study", note: "" }] })) };
  const at = c.dailySchedule({ ...s, day: 14, seasonPlan: plan }).find(x => x.id === "festival");
  assert.equal(at.start, 1080); assert.equal(at.note, "今晚是换季的灯会。");
  const rainy = [..."abcdefghijklmnopqrstuvwxyz"].map(ch => ch + "7").find(ep => w.weather(14, ep) === "细雨");
  if (rainy) assert.ok(c.dailySchedule({ ...s, day: 14, epoch: rainy }).some(x => x.id === "festival"), "灯会雨天照常");
  assert.match(comp, /id!=='fair'&&id!=='festival'&&reachable\(id,s\)/);
  assert.match(comp, /\[1140,festivalDay\(s\.day\)\?'festival':nightMarketDay\(s\.day\)\?'fair':c\]/);
  // 游戏那头：按钮只在那一天露出来；走到栈桥才开小页；结算走 holdFestival；栈桥的灯从栈桥漂；灯笼是一件摆得出来的东西
  assert.match(game, /\$\('festival'\)\.hidden=!\(festivalDay\(data\.day\)&&data\.map==='garden'&&!festivalDone\(data\)\);/);
  assert.match(game, /if\(err==='先走到月潭栈桥。'\)\{if\(go\(MAPS\.garden\.stations\.bottle,\{kind:'festival'\}\)\)say\('走到月潭栈桥去。'\);return;\}/);
  assert.match(game, /data=holdFestival\(data,wish\);\$\('festival-dialog'\)\.close\(\);if\(data===before\)\{say\('这一盏没放成。'\);return;\}data=spendTime\(data,'festival'\);/);
  assert.match(game, /function beginAction\(job\)\{if\(job\.kind==='festival'\)\{openFestival\(\);return;\}/);
  assert.match(html, /<dialog id="festival-dialog">/); assert.match(html, /<div id="season-festival" class="festival"/);
  assert.match(book, /const f=festivalBook\(s\),box=\$\('season-festival'\)/);
  assert.match(lake, /if\(lamp\.where==='deck'\)g\.position\.set\(12\.3\+i\*\.26\+drift\*\.4,/);
  // ⚠️2026-09-18 起【每一样摆上去的东西都有模型】（她：「是真的有模型摆上去吗」）：
  //   这三样各有各的样子，别的按它出自井里的哪一类给一个小物件。
  assert.match(keep, /\['dreamflower','repairedrelic','festivallantern','travelframe'\]\.includes\(t\.recipe\)\|\|!!KIND_FORM\[t\.kind\]/);
  assert.match(keep, /t\.recipe==='festivallantern'\?makeLantern\(\)/);
});

test("第一天少露按钮：他带路那七步没走完只露他带的那几颗，带完或关掉就全出来；只是藏，不是禁", async () => {
  const w = await W();
  assert.match(game, /const FIRST_DAY_KEEP=new Set\(\['well','garden','travel','sow','notes','board','sit-pond','give-flower','rest','enter-home','walk-together','follow-him','lie-down','wake-player','wake-companion'\]\);/);
  assert.match(game, /function firstDay\(\)\{const step=guideStep\(data\);return !!step&&!String\(step\.id\)\.startsWith\('season:'\);\}/);
  assert.match(game, /b\.classList\.toggle\('first-day-hide',trim&&!FIRST_DAY_KEEP\.has\(b\.id\)\)/);
  assert.match(game, /function refreshLeisure\(\)\{trimFirstDay\(\);/);
  assert.match(html, /<p id="first-day-note" class="scene-hint" hidden>他带完这一圈，别的按钮就都出来了。<\/p>/);
  assert.match(rd("apps/fairy-garden/style.css"), /\.first-day-hide\{display:none !important\}/);
  // 带路那七步里要按的按钮都在名单里
  for (const id of ["well", "garden", "sow", "board", "give-flower", "sit-pond", "travel"]) assert.ok(/FIRST_DAY_KEEP=new Set\(\[[^\]]*'\w*'/.test(game) && game.includes("'" + id + "'"), id);
  // 换季那一站不算第一天；试玩档带路默认关着
  const s = w.freshState();
  assert.equal(w.guideStep(s), null);
  const summer = w.setGuide({ ...s, day: 15, water: 3, blooms: 1, herbs: 2, gifts: [{ day: 1, name: "x", family: "herb", stance: "", said: [], from: "me" }], seeds: [{ id: "a", kind: "miss", ask: "", day: 1, done: false }], deeds: 1, bond: [{ kind: "sit", day: 1, text: "" }] }, true);
  assert.equal(w.guideStep(summer).id, "season:1");
});
