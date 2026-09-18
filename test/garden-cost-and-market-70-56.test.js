"use strict";
// 死资源接到人身上；一天变短、事有代价（她 2026-09-18：「继续5 6吧」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const html = rd("apps/fairy-garden/index.html");
const museumView = rd("apps/fairy-garden/museum-view.mjs");
const W = () => import("../apps/fairy-garden/world.mjs");
const nearby = s => ({ ...s, companion: { ...s.companion, map: s.map, position: { ...s.position } } });

// ── 5 ────────────────────────────────────────────────────────────────────
test("集市：功绩是钱，得走到摊前；没攒过功绩摊位空着；买的真进背包", async () => {
  const w = await W();
  const s = w.freshState();
  assert.equal(w.marketError(s, "herb"), "先走到灯串集市。");
  const at = { ...s, position: { ...w.MAPS.garden.sites.market.target } };
  assert.ok(w.atMarket(at));
  assert.match(w.marketError(at, "herb"), /摊位还空着/);
  assert.equal(w.buy(at, "herb"), at);
  const rich = { ...at, deeds: 3 };
  const b = w.buy(rich, "dew");
  assert.equal(b.deeds, 1); assert.equal(b.potions, 1); assert.equal(b.spent, 2);
  assert.match(b.happenings[0].text, /茶摊.*月露/);
  assert.match(w.marketError(b, "sand"), /功绩不够/);
  assert.equal(w.buy(b, "herb").herbs, 2);
  assert.ok(w.marketOpen(w.buy(w.buy(rich, "flower"), "flower")), "花光了功绩摊主也不走");
  assert.equal(w.restoreState(JSON.parse(JSON.stringify(b))).spent, 2);
  // 游戏那头：货和价照 world.MARKET_GOODS 画，走到集市才有那颗按钮；功绩露在背包上
  assert.match(game, /for\(const \[id,gd\] of Object\.entries\(MARKET_GOODS\)\)/);
  assert.match(game, /\$\('market-open'\)\.hidden=!atMarket\(data\);/);
  assert.match(html, /<span>功绩 <b id="deeds">0<\/b><\/span>/);
  assert.match(html, /<dialog id="market-dialog">/);
});

test("第五颗井纹之后每一颗是一片星图：六片、夜里、两人都在旧塔，才有那一夜；不扣深度", async () => {
  const w = await W();
  const s = w.freshState();
  assert.equal(w.starChartPieces({ ...s, stones: 5 }), 0);
  assert.equal(w.starChartPieces({ ...s, stones: 11 }), 6);
  const tower = nearby({ ...s, stones: 11, map: "oldTower", position: { ...w.MAPS.oldTower.spawn }, minute: 1300 });
  assert.ok(w.starNightReady(tower));
  assert.ok(!w.starNightReady({ ...tower, minute: 600 }), "得是夜里");
  assert.ok(!w.starNightReady({ ...tower, stones: 10 }));
  const night = w.keepStarNight(tower);
  assert.equal(night.starNights, 1); assert.equal(night.stones, 11, "不扣井纹，深度不倒退");
  assert.equal(w.deepestAllowed(night), 12);
  assert.equal(w.starChartPieces(night), 0);
  assert.ok(w.bondKinds(night).has("night"));
  assert.equal(w.keepStarNight(night), night);
  assert.equal(w.restoreState(JSON.parse(JSON.stringify(night))).starNights, 1);
  assert.match(game, /starry=!dating&&starNightReady\(data\)/);
  assert.match(game, /data=keepStarNight\(data\);ui\(\);save\(\);/, "先记上再打");
  assert.match(host, /material && material\.starNight/);
});

test("水灯上留的那句进漂流池，哪天捞回来的就是它", async () => {
  const w = await W();
  let s = w.freshState();
  s = { ...s, casts: [{ place: "reedBridge", spell: "sense", kind: "sense", text: "x", day: 1 }], seat: "island", position: { ...w.MAPS.garden.seats.island } };
  const lit = w.floatIslandLight(s, "  明年还来  ");
  assert.equal(lit.wishes.length, 1); assert.equal(lit.wishes[0].text, "明年还来");
  assert.equal(w.floatIslandLight(s, "").wishes.length, 0, "空着就只是灯");
  const pick = w.driftPick({ ...lit, bottles: [], notes: [], shards: [], collection: [] });
  assert.equal(pick.kind, "wish"); assert.equal(pick.text, "明年还来");
  assert.equal(w.restoreState(JSON.parse(JSON.stringify(lit))).wishes[0].text, "明年还来");
  assert.match(game, /data=floatIslandLight\(data,wish\)/);
  assert.match(html, /<dialog id="wish-dialog">/);
  assert.match(host, /d\.kind === "wish" \? "水灯上留的那句"/);
});

test("炼金笔记三十种写满：馆中央那座展台亮", async () => {
  const w = await W();
  const s = w.freshState();
  assert.ok(!w.centralLit(s));
  const full = { ...s, made: w.recipeIndex().map(r => r.key) };
  assert.ok(w.centralLit(full));
  assert.match(world, /炼金笔记写满了三十种做法，收藏馆中央那座展台亮了/);
  assert.match(museumView, /central\.visible=centralLit\(s\)/);
});

// ── 6 ────────────────────────────────────────────────────────────────────
test("地面上的事也花时间：一张表，perform 走它，锅前／捐馆／念咒那几处也走它", async () => {
  const w = await W();
  const s = w.freshState();
  assert.equal(w.perform({ ...s, position: w.targetFor(s, "well") }, "well").minute, s.minute + w.ACTION_MINUTES.well);
  const forest = { ...s, map: "forest", position: { x: -2.8, z: .2 } };
  assert.equal(w.perform(forest, "gather", "herb-a").minute, s.minute + w.ACTION_MINUTES.gather);
  assert.equal(w.spendTime(s, "craft").minute, s.minute + 20);
  assert.equal(w.spendTime(s, "sit"), s, "坐下不花时间");
  // 到了晚上还在做：advanceTime 会自己跨天，不在这儿另算日期
  const late = w.spendTime({ ...s, minute: 1375 }, "craft");
  assert.equal(late.day, 2);
  assert.match(game, /data=castSpell\(data,spell,shard,place\);if\(data===before\)return \{ok:false,text:'这一下没念成。'\};data=spendTime\(data,'cast'\);/);
  assert.match(game, /data=donate\(data,t\.id\);if\(data===before\)\{say\('这一件没能捐进去。'\);return;\}data=spendTime\(data,'museum'\);/);
  assert.equal((game.match(/data=spendTime\(data,'craft'\)/g) || []).length, 2, "两处做东西的入口都走表");
  assert.doesNotMatch(world, /advanceTime\(s,10\)|advanceTime\(out,20\)/, "分钟数只许写在 ACTION_MINUTES 里");
});

test("委托到期没交：委托人是村里的人，交情退一格；不是村里的人不罚", async () => {
  const w = await W();
  let s = w.moveIn(w.freshState(), { charId: "c1", name: "阿棠", look: {} });
  s = w.noteMeet(s, { a: "me", b: "c1", nameA: "你", nameB: "阿棠", place: "集市" });
  s = w.noteMeet({ ...s, minute: 900 }, { a: "me", b: "c1", nameA: "你", nameB: "阿棠", place: "集市" });
  assert.equal(w.metCount(s, "c1"), 2);
  const late = { ...s, day: 9, quests: [{ id: "q1", kind: "find", from: "阿棠", need: 1, season: 0, cycle: 0, lastDay: 4, done: false },
    { id: "q2", kind: "keep", from: "一张没有落款的字条", need: 0, season: 0, cycle: 0, lastDay: 4, done: false }] };
  const out = w.expireQuests(late);
  assert.equal(out.quests.length, 0);
  assert.equal(w.metCount(out, "c1"), 0, "退两格、不许负数");
  assert.match(out.happenings[0].text, /没赶上阿棠托的那件事/);
  assert.equal(out.herbs, s.herbs, "只退交情，不扣东西");
});

test("星铃花三天没浇会蔫：不枯死，浇一次救回来，那一天不长", async () => {
  const w = await W();
  let s = { ...w.freshState(), magic: { ...w.freshMagic(), planted: true, growth: 1, wateredDay: 1, plantedDay: 1 } };
  for (let i = 0; i < 2; i++) s = w.nextDay(s);
  assert.ok(!s.magic.wilted, "第三天早上还没蔫");
  s = w.nextDay(s);
  assert.ok(s.magic.wilted);
  const at = { ...s, map: "garden", water: 1, position: w.targetFor(s, "star") };
  assert.equal(w.magicError({ ...at, water: 0 }, "star"), "它蔫了。先取一壶清水来，浇一次就救得回来。");
  const saved = w.perform(at, "star");
  assert.ok(!saved.magic.wilted); assert.equal(saved.magic.growth, 1, "救回来那一浇不长");
  assert.equal(saved.water, 0);
  // 刚种下的也算：种下那天起三天没管
  let fresh = w.perform(nearby({ ...w.freshState(), map: "forest", position: { ...w.MAPS.forest.stations.seed } }), "seed");
  fresh = { ...fresh, map: "garden" }; fresh = w.perform({ ...fresh, position: w.targetFor(fresh, "star") }, "star");
  assert.equal(fresh.magic.wateredDay, 0, "种下那天还能浇");
  for (let i = 0; i < 3; i++) fresh = w.nextDay(fresh);
  assert.ok(fresh.magic.wilted);
  assert.equal(w.restoreState(JSON.parse(JSON.stringify(fresh))).magic.wilted, true);
});
