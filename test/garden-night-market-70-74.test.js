"use strict";
// 夜市与吃的（她 2026-09-18：「做夜市，卖的跟吃的有关」「搞个吃东西的动作」「都可以宝宝做吧」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const html = rd("apps/fairy-garden/index.html");
const rules = rd("apps/fairy-garden/rules.js");
const marketView = rd("apps/fairy-garden/market-view.mjs");
const dollLife = rd("apps/fairy-garden/doll-life.mjs");
const brewingView = rd("apps/fairy-garden/brewing-view.mjs");
const W = () => import("../apps/fairy-garden/world.mjs");
const nearby = s => ({ ...s, companion: { ...s.companion, map: s.map, position: { ...s.position } } });
const J = x => JSON.parse(JSON.stringify(x));

test("夜市：一季一次两晚（13、14 日）、天黑才开；两晚同一批货；功绩不够拿材料换", async () => {
  const w = await W();
  assert.deepEqual([1, 12, 13, 14, 15, 27, 28].map(d => w.nightMarketDay(d)), [false, false, true, true, false, true, true]);
  assert.equal(w.nextNightMarket(1), 13); assert.equal(w.nextNightMarket(14), 27);
  const s = w.freshState(), at = { ...s, day: 13, position: { ...w.MAPS.garden.sites.market.target }, deeds: 3 };
  assert.equal(w.foodError({ ...s, day: 13 }, "tea"), "先走到灯串集市。");
  assert.match(w.foodError({ ...at, day: 12 }, "tea"), /今天没有夜市，下次是第 13 天/);
  assert.equal(w.foodError(at, "tea"), "夜市天黑才开，先做点别的。");
  assert.ok(!w.nightMarketOpen(at)); assert.deepEqual(w.nightStock({ ...s, day: 12 }), []);
  const open = { ...at, minute: w.seasonOf(13).dusk };
  assert.ok(w.nightMarketOpen(open));
  const stock = w.nightStock(open);
  assert.equal(stock.length, 5, "三样常货、一样时令、一张做法");
  assert.deepEqual(w.nightStock({ ...open, day: 14 }), stock, "第一晚没赶上，第二晚还是这一批");
  assert.notDeepEqual(w.nightStock({ ...open, day: 27 }), stock, "下一季换一批");
  assert.ok(stock.includes("spring"), "春天的夜市有春饼");
  assert.ok(stock.some(id => w.recipeOf(id)), "有一张她还不会的做法");
  assert.equal(w.nightStock({ ...open, epoch: "another" }).join() === stock.join(), false);
  // 买：功绩够付功绩；不够、手上有材料就换；篮子有上限
  const food = stock.find(id => w.foodOf(id) && w.FOODS[id].swap);
  assert.equal(w.foodError(open, food), "");
  let b = w.buyFood(open, food);
  assert.equal(b.pantry.length, 1); assert.equal(b.pantry[0].id, food); assert.equal(b.deeds, 3 - w.FOODS[food].cost); assert.equal(b.spent, w.FOODS[food].cost);
  assert.match(b.happenings[0].text, /在夜市用功绩换了/);
  const poor = { ...open, deeds: 0, ...w.FOODS[food].swap };
  assert.equal(w.foodError(poor, food), ""); assert.deepEqual(w.foodPay(poor, food), { swap: w.FOODS[food].swap });
  const swapped = w.buyFood(poor, food);
  for (const [k, n] of Object.entries(w.FOODS[food].swap)) assert.equal(swapped[k], 0, k + " 换掉了 " + n);
  assert.match(w.foodError({ ...open, deeds: 0 }, food), /功绩不够.*或者拿/);
  assert.match(w.foodError({ ...open, pantry: Array.from({ length: w.PANTRY_CAP }, (_, i) => ({ uid: "f" + i, id: "tea", day: 1, from: "fair" })) }, food), /篮子装满了/);
  const broke = { ...open, deeds: 0, herbs: 0, mushrooms: 0, potions: 0, harvest: 0, sand: 0 };
  assert.equal(w.buyFood(broke, food), broke, "功绩和材料都没有就买不成");
  // 做法：两分，买了就会；会了的不再上摊
  const rec = stock.find(id => w.recipeOf(id));
  const learned = w.buyFood({ ...open, deeds: 5 }, rec);
  assert.ok(learned.recipes.includes(w.recipeOf(rec))); assert.equal(learned.deeds, 5 - w.RECIPE_COST);
  assert.ok(!w.nightStock(learned).includes(rec), "会了就换一张，或者没有了");
  assert.match(w.foodError({ ...open, deeds: 1 }, rec), /一张做法要 2 分/);
  // 两晚都来过：相处册一格
  assert.ok(!w.bondKinds(b).has("fair"));
  const both = w.buyFood({ ...b, day: 14, deeds: 3 }, food);
  assert.ok(w.bondKinds(both).has("fair")); assert.equal(both.fairs.length, 2);
});

test("摊主是邻居：按住进来的次序各占一座；跟邻居买一样，一晚一位交情走一格；白天的摊主让位", async () => {
  const w = await W();
  let s = w.freshState();
  s = w.moveIn(s, { charId: "n1", name: "阿桃" }); s = w.moveIn(s, { charId: "n2", name: "阿栗" });
  assert.equal(w.vendorAt(s, "herbs").name, "阿桃"); assert.equal(w.vendorAt(s, "curios").name, "阿栗"); assert.equal(w.vendorAt(s, "tea"), null);
  assert.equal(w.vendorOfFood(s, "roast").name, "阿桃", "烤菇在药草棚");
  assert.equal(w.vendorOfFood(s, "recipe:cake"), null, "做法在茶摊，这一档没邻居就还是白天的摊主");
  const open = { ...s, day: 13, minute: 1200, position: { ...w.MAPS.garden.sites.market.target }, deeds: 6 };
  const stock = w.nightStock(open), fromTao = stock.find(id => w.foodOf(id) && w.FOODS[id].stall === "herbs");
  if (fromTao){
    const b1 = w.buyFood(open, fromTao);
    assert.equal(w.metCount(b1, "n1"), 1); assert.match(b1.happenings[0].text, /跟阿桃/);
    assert.equal(b1.pantry[0].from, "n1");
    const b2 = w.buyFood(b1, fromTao);
    assert.equal(w.metCount(b2, "n1"), 1, "同一晚跟同一位买第二样不再加");
  }
  const spot = w.vendorSpot("herbs"), st = w.MAPS.garden.market.stalls.find(x => x.kind === "herbs");
  assert.ok(Math.hypot(spot.x - st.x, spot.z - st.z) > st.d / 2, "站在摊后");
  assert.equal(w.stallOf("tea"), "tea"); assert.equal(w.stallOf("recipe:cake"), "tea"); assert.equal(w.stallOf("herb"), "herbs"); assert.equal(w.stallOf("nope"), null);
  // 游戏那头：夜市那两晚天黑后邻居站到摊后，收摊了控制器重排；摊主让位
  assert.match(game, /const vend=nightMarketOpen\(data\)\?VENDOR_STALLS\.map\(k=>vendorAt\(data,k\)\):\[\];/);
  assert.match(game, /if\(!x\.vending\)\{x\.vending=VENDOR_STALLS\[vi\];x\.ctrl\.reset\(\);\}/);
  assert.match(game, /if\(x\.vending\)\{x\.vending='';x\.ctrl\.reset\(\);\}/);
  assert.match(marketView, /avatar\.root\.visible=!\(night&&vendorAt\(s,kind\)\)/);
  assert.match(marketView, /const stock=night\?nightStock\(s\):marketStock\(s\);lanterns\.visible=night;/);
  assert.match(marketView, /g\.group\.visible=g\.night===night&&stock\.includes\(id\)/);
  assert.doesNotMatch(marketView, /STALL_OF=/, "哪样货在哪座摊只在 world.stallOf 一处");
});

test("吃：篮子里挑一样，尝过记食谱册；他在跟前就是一起吃的；热茶／热汤那两条轻 buff 只管今天", async () => {
  const w = await W();
  const s = { ...w.freshState(), day: 3, pantry: [{ uid: "f1", id: "tea", day: 3, from: "fair" }, { uid: "f2", id: "soup", day: 3, from: "home" }, { uid: "f3", id: "roast", day: 3, from: "him" }] };
  assert.equal(w.eatError(s, "nope"), "篮子里没有这一样。");
  const away = { ...s, companion: { ...s.companion, map: "home" } };
  let alone = w.eat(away, "f3");
  assert.equal(alone.pantry.length, 2); assert.deepEqual(alone.tasted, ["roast"]); assert.ok(!w.bondKinds(alone).has("meal"));
  assert.equal(alone.happenings[0].text, "吃了烤荧光菇");
  let e = w.eat(nearby(s), "f1");
  assert.ok(w.bondKinds(e).has("meal")); assert.match(e.happenings[0].text, /和同行者一起吃了一盏热茶，今天做事快三分钟/);
  assert.ok(w.hasBuff(e, "quick")); assert.ok(!w.hasBuff({ ...e, day: 4 }, "quick"), "只管今天");
  assert.equal(w.spendTime({ ...e, minute: 600 }, "well").minute, 602, "取水 5 分变 2 分");
  assert.equal(w.spendTime({ ...e, minute: 600 }, "board").minute, 602, "最少也过一分钟");
  assert.equal(w.spendTime({ ...s, minute: 600 }, "well").minute, 605);
  e = w.eat(e, "f2");
  assert.ok(w.hasBuff(e, "warm")); assert.deepEqual(e.tasted, ["tea", "soup"]);
  const wet = { ...e, epoch: [..."abcdefghijklmnopqrstuvwxyz"].map(c => c + "1").find(ep => w.weather(3, ep) === "细雨") || e.epoch };
  if (w.weather(wet.day, wet.epoch) === "细雨"){ assert.equal(w.diveWeight(wet), 1, "喝过热汤下井不慢"); assert.equal(w.diveWeight({ ...wet, buffs: {} }), w.DIVE_WET); }
  assert.deepEqual(w.eat(e, "f2"), e, "吃过的不在篮子里了");
  assert.equal(w.ACTION_MINUTES.eat, 5); assert.equal(w.ACTION_MINUTES.cook, 15);
  // 读档不丢；老档没有这几样也读得出
  const back = w.restoreState(J(e));
  assert.deepEqual(back.pantry, e.pantry); assert.deepEqual(back.tasted, e.tasted); assert.deepEqual(back.buffs, e.buffs);
  assert.deepEqual(w.restoreState({}).recipes, w.FIRST_RECIPES); assert.deepEqual(w.restoreState({}).pantry, []);
  assert.deepEqual(w.restoreState({ ...J(e), pantry: [{ uid: "x", id: "nope" }], tasted: ["nope", "tea"], buffs: { bogus: 3, quick: "x" } }).tasted, ["tea"]);
  // 游戏那头：吃是一个带姿势的动作，他在跟前也捧碗
  assert.match(dollLife, /if\(job\.kind==='eat'\)return 'eat';/);
  assert.match(dollLife, /bowl\.visible=eating;/);
  assert.match(game, /if\(kind==='eat'\)\{const uid=acting\.uid;acting=null;\$\('progress'\)\.hidden=true;const err=eatError\(data,uid\);if\(err\)\{say\(err\);ui\(\);return;\}const together=companionNearby\(data\);data=eat\(data,uid\);data=spendTime\(data,'eat'\);if\(together\)eatingUntil=clock\+3\.4;/);
  assert.match(game, /companionAvatar\.animate\(clock,\{gesture:'eat',height:floorHeight\(data\.map,data\.companion\.position,data\)\}\)/);
  assert.match(game, /\$\('eat-open'\)\.hidden=!restorePantry\(data\.pantry\)\.length;/);
  assert.match(html, /<button id="eat-open" hidden>吃点东西<\/button>/);
  assert.match(html, /<dialog id="eat-dialog">/);
});

test("小灶：在家、会做、材料够才做；一开始只会热茶和烤菇；走锅边那套近景", async () => {
  const w = await W();
  const s = w.freshState();
  assert.equal(w.cookError(s, "wine"), "这一样不是灶上能做的。");
  assert.equal(w.cookError({ ...s, herbs: 2 }, "tea"), "小灶在自己家里。");
  const home = { ...s, map: "home", herbs: 2 };
  assert.equal(w.cookError(home, "tea"), "");
  assert.match(w.cookError(home, "cake"), /还不会做/);
  assert.match(w.cookError({ ...home, herbs: 1 }, "tea"), /材料不够：要铃叶草 ×2/);
  const c = w.cook(home, "tea");
  assert.equal(c.herbs, 0); assert.equal(c.pantry.length, 1); assert.equal(c.pantry[0].from, "home"); assert.equal(c.happenings[0].text, "在自家灶上做了一盏热茶");
  assert.equal(w.cook({ ...home, herbs: 1 }, "tea").pantry.length, 0, "材料不够做不成");
  const learned = w.cook({ ...home, recipes: ["cake"], herbs: 2, harvest: 1 }, "cake");
  assert.equal(learned.pantry[0].id, "cake"); assert.equal(learned.harvest, 0);
  const book = w.foodBook(c);
  assert.equal(book.total, 12); assert.equal(book.items.filter(i => i.cook).length, 6); assert.deepEqual(book.items.filter(i => i.known).map(i => i.id), ["tea", "roast"]);
  assert.equal(book.pantry[0].label, "一盏热茶");
  assert.match(brewingView, /export function makeBrewingView\(\{scene,camera,site,onClose,id='brewing-dialog',pot=false\}\)\{const base=site\.y||0;/);
  assert.match(game, /const cooking=makeBrewingView\(\{scene,camera,site:cookSite,onClose:restoreActivityView,id:'cooking-dialog',pot:true\}\);/);
  assert.match(game, /if\(at\.map==='home'&&\['kitchen','island','dining'\]\.includes\(at\.kind\)\)appendSpotAction\(\$\('cook-open'\),list\);/);
  assert.match(game, /commit:\(\)=>\{const before=data;data=cook\(data,id\);if\(data===before\)return cookError\(data,id\)\|\|'这一锅没成，材料还在。';data=spendTime\(data,'cook'\);/);
  assert.match(game, /if\(cooking\.active\)\{/);
});

test("吃的接进已有的三处进度：礼物簿多「吃的」一类、他在夜市给她买一样、日历与今天想做的、相处页食谱册", async () => {
  const w = await W();
  assert.match(rules, /food:\{label:'吃的',what:'夜市上买的、自家灶上做的/);
  assert.equal(Object.keys(w.GIFT_FAMILIES).length, 8);
  assert.deepEqual(Object.keys(w.BOND_KINDS).slice(-3), ["meal", "fair", "festival"]);
  // 递吃的给他：走礼物簿那条路，类别是「吃的」
  const g = nearby({ ...w.freshState(), pantry: [{ uid: "f1", id: "cake", day: 1, from: "home" }] });
  assert.deepEqual(w.giftOptions(g).map(x => [x.name, x.family]), [["铃叶糕", "food"]]);
  const gave = w.giveGift(g, { type: "food", uid: "f1" }, { stance: "like", words: ["还热着。"] });
  assert.equal(gave.pantry.length, 0); assert.equal(gave.gifts[0].family, "food"); assert.deepEqual(gave.gifts[0].said, ["还热着。"]);
  assert.ok(w.giftBook(gave).families.some(f => f.id === "food" && f.stance === "like"));
  // 他给她买：只在夜市开着、两个人都在集市上；挑的是今晚摊上有的
  const open = nearby({ ...w.freshState(), day: 13, minute: 1200, position: { ...w.MAPS.garden.sites.market.target } });
  assert.equal(w.himGiveError(open, "food"), "");
  assert.match(w.himGiveError({ ...open, minute: 600 }, "food"), /夜市开着、两个人都在集市上/);
  assert.match(w.himGiveError(nearby({ ...open, position: { ...w.START } }), "food"), /两个人都在集市上/);
  const hg = w.himGive(open, "food");
  assert.equal(hg.pantry.length, 1); assert.equal(hg.pantry[0].from, "him"); assert.ok(w.nightStock(open).includes(hg.pantry[0].id));
  assert.equal(hg.gifts[0].from, "him"); assert.equal(hg.gifts[0].family, "food"); assert.match(hg.happenings[0].text, /在夜市上给你买了/);
  assert.ok(w.bondKinds(hg).has("given"));
  assert.equal(w.himGive(hg, "food"), hg, "一天一样");
  // 日历、今天想做的
  const marks = w.calendarMarks({ ...w.freshState(), day: 13 });
  assert.ok(marks[13].includes("夜市")); assert.ok(marks[14].includes("夜市")); assert.ok(!(marks[12] || []).includes("夜市"));
  assert.deepEqual(w.todayHints({ ...w.freshState(), day: 13 }).map(h => h.kind), ["fair", "festival"], "第十三天起灯会也提醒（v70.81）");
  assert.match(w.todayHints({ ...w.freshState(), day: 13, minute: 1200 })[0].text, /夜市开了/);
  assert.equal(w.todayHints({ ...w.freshState(), day: 12 }).some(h => h.kind === "fair"), false);
  // 手机那一册：喜好表长了一类，老档缺这一类再问一次；食谱册从 getBond 的 food 画
  assert.match(host, /Object\.keys\(root\.FairyGardenRules\.GIFT_FAMILIES\)\.every\(f => \(have\.rows \|\| \[\]\)\.some\(r => r && r\.family === f\)\)/);
  assert.match(host, /"食谱册 · 尝过 " \+ bond\.food\.tasted \+ " \/ " \+ bond\.food\.total/);
  assert.match(game, /getBond:\(\)=>\(\{\.\.\.bondBook\(data\),gifts:giftBook\(data\),food:foodBook\(data\),/);
  assert.match(game, /food:\(f=>\(\{pantry:f\.pantry\.map\(p=>p\.label\),tasted:f\.tasted,total:f\.total,tonight:f\.tonight,open:f\.open,nextFair:f\.next,buffs:f\.buffs\}\)\)\(foodBook\(data\)\)/);
  // 夜市上买跟白天买走同一条路（点货→走到摊前→结算），只是结算问 buyFood
  assert.match(game, /const food=!!\(foodOf\(id\)\|\|recipeOf\(id\)\);const err=food\?foodError\(data,id\):marketError\(data,id\);if\(err\)\{say\(err\);ui\(\);return;\}data=food\?buyFood\(data,id\):buy\(data,id\);/);
  assert.match(game, /\$\('market-open'\)\.textContent=nightMarketOpen\(data\)\?'逛夜市':marketDay\(data\.day\)\?'逛集市':nightMarketDay\(data\.day\)\?'今晚有夜市':/);
});
