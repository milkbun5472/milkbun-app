"use strict";
// 相处册＋礼物簿（她 2026-09-18：「先把那六个按钮修回来，然后做1和2」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const companion = rd("apps/fairy-garden/companion.mjs");
const host = rd("js/fairy-garden.js");
const rules = rd("apps/fairy-garden/rules.js");
const html = rd("apps/fairy-garden/index.html");
function service(callAI){const ctx={React:{},WeakMap,JSON,Error,extractJSON:JSON.parse,callAI,narrativeCore:()=> '共同文风',CONDESCENDING_TONE_BAN:'公共规则',REGISTER_FOLLOWS_SCENE:'',STOCK_REPLY_BAN:'',OVERREACH_BAN:'',ECHO_QUESTION_BAN:'',userName:p=>p.name};ctx.window=ctx;vm.runInNewContext(rules,ctx);vm.runInNewContext(host,ctx);return ctx.FairyGardenService;}
const W = () => import("../apps/fairy-garden/world.mjs");
const nearby = s => ({ ...s, companion: { ...s.companion, map: s.map, position: { ...s.position } } });

// ── 0. v69.63 删掉的那六行 ────────────────────────────────────────────
// ⚠️那一版撤地点下拉，顺手把六个按钮的接线一起删了：进不了家、床铺整套不可达、滑冰按钮死的。
//   后面的逻辑一行没坏，所以这儿钉的是【接线】本身。
test("走进小屋、床铺安排、起床、叫 TA 起床、去滑冰，六颗按钮都接着线", () => {
  assert.match(game, /\$\('enter-home'\)\.onclick=\(\)=>request\('enter'\)/);
  assert.match(game, /\$\('lie-down'\)\.onclick=\(\)=>request\('bed',\$\('bed-select'\)\.value\)/);
  assert.match(game, /\$\('wake-player'\)\.onclick=/);
  assert.match(game, /\$\('wake-companion'\)\.onclick=.*wakeSleeper\(data,'companion'\)/);
  assert.match(game, /\$\('skate-lake'\)\.onclick=.*MAPS\.garden\.lake\.skateStart/);
  // 床的下拉得有选项，不然「去床边休息」递过去的是空串
  assert.match(game, /for\(const \[id,b\]of Object\.entries\(MAPS\.home\.beds\)\)\{const o=document\.createElement\('option'\)/);
  for (const id of ["enter-home", "lie-down", "wake-player", "wake-companion", "skate-lake", "bed-select"]) assert.match(html, new RegExp('id="' + id + '"'));
});

// ── 1. 相处册 ───────────────────────────────────────────────────────────
test("刻度按【一起做过几种事】走，不按次数；同一天同一种只记一次", async () => {
  const w = await W();
  let s = w.freshState();
  assert.equal(w.bondLabel(s), w.BOND_TIERS[0][1]);
  for (let i = 0; i < 40; i++) s = w.noteBond({ ...s, day: 1 + i }, "gift", "第" + i + "次");
  assert.equal(w.bondTier(s), 0, "递四十次东西还是一格");
  const twice = w.noteBond(w.noteBond(s, "sit", "a"), "sit", "b");
  assert.equal(twice.bond.filter(x => x.kind === "sit").length, 1, "同一天并肩坐一下午不是坐了四十次");
  s = w.noteBond(s, "sit", "坐");
  assert.equal(w.bondTier(s), 1);
  for (const k of ["seed", "star", "bed"]) s = w.noteBond(s, k, k);
  assert.equal(w.bondTier(s), 2);
  assert.equal(w.noteBond(s, "affection", "x"), s, "不在名单上的不记");
  const loaded = w.restoreState(JSON.parse(JSON.stringify(s)));
  assert.equal(w.bondTier(loaded), 2);
  const book = w.bondBook(loaded);
  assert.equal(book.kinds.length, Object.keys(w.BOND_KINDS).length);
  assert.ok(book.kinds.find(k => k.kind === "gift").count >= 1);
  assert.ok(book.next && book.next.need >= 1);
});

test("十件真发生的事各记一笔：种子、铜环、同床、花笺、回信、他来找你、修东西、帮工、水灯、念咒、并肩坐", async () => {
  const w = await W();
  const c = await import("../apps/fairy-garden/companion.mjs");
  // 一起唤醒种子（他不在身边就不成，也就不记）
  let s = { ...w.freshState(), map: "forest", position: { ...w.MAPS.forest.stations.seed } };
  assert.equal(w.perform(s, "seed"), s);
  let out = w.perform(nearby(s), "seed");
  assert.ok(w.bondKinds(out).has("seed"));
  // 同床那一晚：分房不记，同床记
  const bed = Object.keys(w.MAPS.home.beds)[0], other = Object.keys(w.MAPS.home.beds)[1];
  s = w.freshState();
  assert.ok(!w.bondKinds(w.nextDay({ ...s, sleep: { player: bed, companion: other } })).has("bed"), "分房睡不是一起做的事");
  assert.ok(w.bondKinds(w.nextDay({ ...s, sleep: { player: bed, companion: bed } })).has("bed"));
  // 花笺、回信、他来找你
  s = w.sowSeed({ ...w.freshState(), position: { ...w.MAPS.garden.stations.sow } }, "miss", "问一句");
  s = { ...s, day: s.day + 3 };
  out = w.keepNotes(s, [{ id: s.seeds[0].id, reply: "答了" }]);
  assert.ok(w.bondKinds(out).has("note"));
  s = w.sealBottle(w.freshState(), "放下水");
  let b = s.bottles[0];
  if (!b.replyWanted) { s = { ...s, bottles: [{ ...b, replyWanted: true }] }; b = s.bottles[0]; }
  out = w.keepBottleReply({ ...s, day: b.openDay }, b.id, "回信", "他");
  assert.ok(w.bondKinds(out).has("reply"));
  assert.ok(w.bondKinds(w.missTaken(w.freshState())).has("talk"));
  // 修东西：他在身边才算「一起」
  s = { ...w.freshState(), map: "garden", position: { ...w.MAPS.garden.sites.lakeNorth.target }, herbs: 6, harvest: 3 };
  assert.ok(!w.bondKinds(w.doWork(s, "lakeShade")).has("work"));
  assert.ok(w.bondKinds(w.doWork(nearby(s), "lakeShade")).has("work"));
  // 帮工、念咒
  s = w.freshState(); s = { ...s, map: "watermill", position: { ...w.MAPS.watermill.stations.mill }, mushrooms: 2 };
  s = w.millAction(s, "powder");
  s = nearby(s);
  assert.ok(w.bondKinds(w.companionMillHelp(s)).has("help"));
  s = { ...w.freshState(), map: "forest", position: { ...w.MAPS.forest.stations.cast }, spells: ["echo"], shards: [{ id: "sh1", kind: "echo", text: "一句", day: 1, depth: 1, whole: false, pinned: false, curio: "shell" }] };
  assert.ok(w.bondKinds(w.castSpell(nearby(s), "echo", "sh1", "pond")).has("cast"));
  assert.ok(!w.bondKinds(w.castSpell(s, "echo", "sh1", "pond")).has("cast"));
  // 并肩坐：控制器把他带到旁边那张垫子坐下，坐稳了记一笔
  s = { ...w.freshState(), map: "forest", position: { ...w.MAPS.forest.seats.pond }, seat: "pond" };
  s.companion = { ...s.companion, map: "forest", mode: "follow", position: { x: s.position.x + 1.4, z: s.position.z } };
  const ctrl = c.makeCompanionController();
  for (let i = 0; i < 400; i++) s = ctrl.tick(s, .1).state;
  assert.ok(w.bondKinds(s).has("sit"), "坐下了却没记");
  assert.match(companion, /plan\.id==='sit-together'&&idle>=2\.8&&finishedKey!==key/);
});

test("处熟了他才答应去更多地方；聊天白名单认的是同一张表", async () => {
  const w = await W();
  const c = await import("../apps/fairy-garden/companion.mjs");
  const s = w.freshState();
  assert.deepEqual(Object.keys(w.companionDestinations(s)), ["pond", "garden", "well", "home"]);
  let far = s;
  for (const k of ["gift", "sit"]) far = w.noteBond(far, k, k);
  assert.ok(w.companionDestinations(far).market, "两种事之后集市该开了");
  assert.ok(!w.companionDestinations(far).tower, "旧塔还没到档");
  assert.ok(Object.values(w.COMPANION_DESTINATIONS).some(d => d.tier), "档位写在表上每一处，不另开一张表");
  // 存档里存着一个还没到档的地点：不丢（校验只看「这个世界里有没有」）
  const loaded = w.restoreState(JSON.parse(JSON.stringify({ ...s, companion: { ...s.companion, mode: "goto", destination: "tower" } })));
  assert.equal(loaded.companion.destination, "tower");
  assert.equal(w.restoreState({ ...s, companion: { ...s.companion, destination: "secret" } }).companion.destination, "home");
  // 没到档的地点，控制器退回屋前，不会拿 undefined 走路
  const plan = c.companionPlan({ ...loaded });
  assert.equal(plan.map, "garden");
  assert.ok(plan.target && Number.isFinite(plan.target.x));
  // 到档了就真去
  const go = c.companionPlan({ ...far, companion: { ...far.companion, mode: "goto", destination: "market" } });
  assert.equal(go.label, w.COMPANION_DESTINATIONS.market.label);
  // 四处地板只写在 rules.js 一处
  assert.match(rules, /const COMPANION_DESTINATIONS=\{pond:/);
  assert.doesNotMatch(world, /export const COMPANION_DESTINATIONS=\{/);
  assert.match(game, /if\(action\.kind==='goto'&&!companionDestinations\(data\)\[action\.target\]\)return false;/);
  const svc = service();
  assert.equal(svc.normalizeReply(JSON.stringify({ reply: "去", action: { kind: "goto", target: "market" } })).action.target, "market");
  assert.equal(svc.normalizeReply(JSON.stringify({ reply: "去", action: { kind: "goto", target: "secret" } })).action.kind, "none");
  // 提示词里那一串照游戏这头开到的档长（destinationChoices 按存档筛），宿主不另抄
  assert.match(game, /destinations:\(\)=>destinationChoices\(data\)/);
  assert.match(world, /export const destinationChoices=s=>Object\.entries\(companionDestinations\(s\)\)/);
  assert.equal(w.destinationChoices(s).split("、").length, 4);
  assert.ok(w.destinationChoices(far).includes("market"));
  assert.match(host, /处得越熟，能一起去的地方越多/);
  assert.match(game, /snapshot:\(\)=>\(\{bond:/);
});

// ── 2. 礼物簿 ───────────────────────────────────────────────────────────
test("背包里的东西都能递；每样扣对；一天一样；不喜欢不罚", async () => {
  const w = await W();
  let s = nearby({ ...w.freshState(), harvest: 2, potions: 1, herbs: 3, mushrooms: 1,
    magic: { ...w.freshMagic(), flowers: 1 },
    things: [{ id: "t1", name: "玻璃梦", note: "n", kind: "dream", way: "set", recipe: "dream:set", from: "f", day: 1, openDay: 0, spot: null },
             { id: "t2", name: "封着的", note: "n", kind: "echo", way: "ferment", recipe: "echo:ferment", from: "f", day: 1, openDay: 9, spot: null }],
    shards: [{ id: "s1", kind: "relic", text: "旧", day: 1, depth: 1, whole: false, pinned: false, curio: "relic" },
             { id: "s2", kind: "sense", text: "钉", day: 1, depth: 1, whole: false, pinned: true, curio: "thread" }] });
  const names = w.giftOptions(s).map(x => x.name);
  assert.deepEqual(names, ["月光花", "星铃花", "月露", "一束铃叶草", "荧光菇", "玻璃梦", "沉睡旧物"], "封着的和钉住的都不在名单里");
  const table = { flower: ["harvest", 1], dew: ["potions", 0], herb: ["herbs", 1], mushroom: ["mushrooms", 0] };
  for (const [type, [field, left]] of Object.entries(table)) {
    const out = w.giveGift(s, { type }, { stance: "dislike", words: ["不要。"] });
    assert.equal(out[field], left, type);
    assert.equal(out.gifts[0].stance, "dislike");
    assert.equal(out.miss.score, s.miss.score, "不喜欢不扣任何东西");
    assert.equal(w.giftError(out, { type }), "今天已经递过一样了，明天再递。");
  }
  assert.equal(w.giveGift(s, { type: "starflower" }, null).magic.flowers, 0);
  const thing = w.giveGift(s, { type: "thing", id: "t1" }, { stance: "love", words: ["嗯"] });
  assert.ok(!thing.things.some(x => x.id === "t1"));
  assert.equal(thing.gifts[0].family, "dream", "做出来的东西归它那片碎片的类");
  assert.equal(w.giveGift(s, { type: "thing", id: "t2" }, null), s, "封着的递不出去");
  assert.equal(w.giveGift(s, { type: "shard", id: "s2" }, null), s, "钉住的递不出去");
  assert.equal(w.giveGift(s, { type: "shard", id: "s1" }, null).shards.length, 1);
  // 旧名还在，老调用方不动
  assert.equal(w.giveMoonFlower(s).harvest, 1);
  assert.equal(w.flowerGiftError({ ...s, harvest: 0 }), "先收获一朵月光花，再拿给同行者。");
  assert.ok(w.flowerGiftError({ ...s, seat: "pond" }));
  // 一天一样是钉在 world 里的，不是界面上的
  assert.equal(w.GIFT_PER_DAY, 1);
  const next = w.giveGift(w.nextDay(w.giveGift(s, { type: "flower" }, null)), { type: "flower" }, null);
  assert.equal(next.harvest, 0, "第二天能再递");
});

test("第一次接过这一类他说的话记进册子；不知道就是不知道；册子读档不丢", async () => {
  const w = await W();
  let s = nearby({ ...w.freshState(), harvest: 3 });
  s = w.giveGift(s, { type: "flower" }, { stance: "like", words: ["哦。", "放着吧。"] });
  assert.deepEqual(s.gifts[0].said, ["哦。", "放着吧。"]);
  s = w.giveGift(w.nextDay(s), { type: "flower" }, { stance: "like", words: ["哦。"] });
  assert.deepEqual(s.gifts[0].said, [], "同一类第二次不再说一遍");
  const unknown = w.giveGift(nearby({ ...w.freshState(), harvest: 1 }), { type: "flower" }, null);
  assert.equal(unknown.gifts[0].stance, "");
  assert.doesNotMatch(unknown.happenings[0].text, /喜欢|想要/, "不知道就不替他说");
  const book = w.giftBook(w.restoreState(JSON.parse(JSON.stringify(s))));
  assert.equal(book.families.length, 8, "七类加 v70.74 的「吃的」");
  const flower = book.families.find(f => f.id === "flower");
  assert.equal(flower.stance, "like"); assert.equal(flower.count, 2); assert.deepEqual(flower.said, ["哦。", "放着吧。"]);
  assert.equal(book.families.find(f => f.id === "dew").stance, "");
  // 他开口时手上有这一件
  assert.ok(w.missMaterial(s).rows.some(r => r.kind === "她递给你的" && /月光花/.test(r.text)));
  assert.ok(w.bondKinds(s).has("gift"));
});

test("七类只写在 rules.js 一处，手机和游戏都问它", () => {
  assert.match(rules, /const GIFT_FAMILIES=\{flower:/);
  assert.match(rules, /const GIFT_STANCES=\{love:/);
  assert.match(world, /export const \{COMPANION_DESTINATIONS,GIFT_FAMILIES,GIFT_STANCES,/);
  assert.match(host, /Object\.keys\(rules\.GIFT_FAMILIES\)\.map\(family =>/);
  assert.doesNotMatch(host, /flower:\s*\{\s*label/, "手机那侧不许另抄一份类别表");
  // 喜欢什么不写在代码里：类别表里只有「这一类是什么」，没有态度
  const seg = rules.slice(rules.indexOf("const GIFT_FAMILIES="), rules.indexOf("const GIFT_STANCES="));
  assert.doesNotMatch(seg, /love|like|dislike|喜欢/);
});

test("喜好那一枪：一位角色只打一次，料在 system、user 一句触发、maxTokens 开满、不塞内容示范", async () => {
  let calls = 0, args;
  const svc = service(async (...a) => { calls++; args = a; return JSON.stringify({ tastes: [
    { family: "flower", stance: "dislike", words: ["拿走。"] }, { family: "relic", stance: "love", words: ["这个留下。", "哪儿挖的。"] },
    { family: "dew", stance: "meh", words: [] }, { family: "bogus", stance: "love", words: ["x"] }, { family: "echo", stance: "evil", words: ["y"] } ] }); });
  const rows = await svc.tastes({ active: { id: 1 }, character: { name: "他", persona: "全文人设" }, profile: { name: "她", persona: "p" }, world: { day: 1 } });
  assert.equal(calls, 1);
  assert.equal(rows.length, 8, "八类都得有一条（没答的就是不知道）");
  // ⚠️vm 另一个 realm 里的对象原型不同，deepStrictEqual 会因此红；按 JSON 比
  assert.equal(JSON.stringify(rows.find(r => r.family === "relic")), JSON.stringify({ family: "relic", stance: "love", words: ["这个留下。", "哪儿挖的。"] }));
  assert.equal(rows.find(r => r.family === "echo").stance, "", "四档之外的态度不认");
  assert.ok(!rows.some(r => r.family === "bogus"));
  const [, sys, messages, opts] = args;
  assert.match(sys, /全文人设/);
  assert.match(sys, /GIFT|类别标识|family/);
  assert.equal(messages.length, 1); assert.ok(messages[0].content.length <= 8, "user 只留一句触发");
  assert.equal(opts.maxTokens, 65535);
  // 全是「？」的回复不算读到
  const bad = service(async () => JSON.stringify({ tastes: [] }));
  await assert.rejects(() => bad.tastes({ active: {}, character: { name: "他" }, profile: {}, world: {} }), /没读出/);
  // 存在这一档里，跟季节安排一个放法；hasTastes 只认 ready
  assert.match(host, /tastes: \{ \.\.\.\(old\.tastes \|\| \{\}\), \[cid\]: \{ status: "ready", at: Date\.now\(\), rows \} \}/);
  assert.match(host, /if \(have && have\.status === "ready"\) return have\.rows;/, "问过一次就不再打");
  // 游戏那侧：先问表再递，表没读到这一样就还在手上
  assert.match(game, /const rows=await host\.tastes\(\);taste=\(rows\|\|\[\]\)\.find\(r=>r\.family===o\.family\)\|\|null;\}catch\(e\)\{say\(e\.message\);return;\}/);
  assert.match(game, /if\(same\)data=giveGift\(data,acting\.ref,acting\.taste\);/);
  assert.match(game, /if\(row&&row\.said&&row\.said\.length\)speak\(row\.said\);/, "第一次接过这一类，他那几句得说出口");
});

test("手机那一册有「相处」这一页，画的是 getBond 那一份", () => {
  assert.match(host, /\["bond", "相处",/);
  assert.match(host, /if \(g\.getBond\) setBond\(g\.getBond\(\)\);/);
  assert.match(game, /getBond:\(\)=>\(\{\.\.\.bondBook\(data\),gifts:giftBook\(data\),food:foodBook\(data\),guide:/);
  assert.match(host, /bond\.gifts\.families\.map\(/);
  assert.match(host, /bond\.kinds\.map\(/);
  // 标题不留英文
  const page = host.slice(host.indexOf('bookTab === "bond"'), host.indexOf('bookTab === "crew"'));
  assert.doesNotMatch(page, /h\("div", \{ style: \{ fontFamily: F_BODY, fontSize: 12, color: G\.ink, marginBottom: [48] \} \}, "[A-Za-z ]+"\)/);
  assert.match(html, /<dialog id="gift-dialog">/);
  assert.match(html, /<button id="give-flower" hidden>递一样东西<\/button>/);
});
