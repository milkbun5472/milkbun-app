// 群里 2026-09-29 问：「抽卡那个兑换了的不能删吗」——确实删不了，而且没兑的也删不了：
// 抽卡整块压根没有删除。原来那条「票根永不删除」是她 2026-09-14 定的
// （「票根永远留痕有时间戳」）——那句话管的是【系统不许自己清】，不是【她自己也不许扔】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), screens = R("screens.js"), gacha = R("gacha.js");

global.window = global.window || {};
require("../js/gacha.js");
const K = global.window.GachaKit;

test("按【这一张】删，不按款——同款的别的张不能跟着走", () => {
  const cards = [
    { id: "gc_1", poolId: "r_photo", ts: 1 },
    { id: "gc_2", poolId: "r_photo", ts: 2 },                 // 同款
    { id: "gc_3", poolId: "sr_song", ts: 3, redeemedTs: 9, result: { title: "那首歌" } }
  ];
  const left = K.removeCard(cards, "gc_1");
  assert.deepEqual(left.map(c => c.id), ["gc_2", "gc_3"], "同款那张被误删了");
  // 兑过的也删得掉——这正是她问的那一条
  assert.deepEqual(K.removeCard(cards, "gc_3").map(c => c.id), ["gc_1", "gc_2"]);
});

test("id 给空/给不存在的，原样返回，不许清空整副", () => {
  const cards = [{ id: "gc_1" }, { id: "gc_2" }];
  assert.equal(K.removeCard(cards, "").length, 2);
  assert.equal(K.removeCard(cards, null).length, 2);
  assert.equal(K.removeCard(cards, "没这张").length, 2);
  assert.deepEqual(K.removeCard(null, "gc_1"), []);
});

test("判据和写入方对得上：每张卡真有唯一 id", () => {
  // 桩照【写存档那段】写（施工规则/stub-from-the-writer）：gc_时间_序号_随机
  assert.match(app, /id: "gc_" \+ now \+ "_" \+ i \+ "_" \+ Math\.random\(\)/);
  // 盖戳那一处也是按 id 找的，两边同一个键
  assert.match(app, /gachaCardsRef\.current\.map\(c => c\.id === cardId/);
});

test("会让数据消失的动作要先问一句", () => {
  const i = app.indexOf("onGachaDelete:");
  assert.ok(i > 0, "app 那头没接");
  const seg = app.slice(i, i + 900);
  assert.match(seg, /requestAppConfirm\("撕掉/);
  assert.match(seg, /删了不可恢复/);
  assert.match(seg, /GachaKit\.removeCard/, "算法只有一份，别在这儿手写 filter");
});

test("券夹和纪念册共用同一颗按钮，不是各画一颗", () => {
  assert.match(screens, /function GachaCard\(\{ card, busy, onRedeem, onShow, onTitle, onShoot, onCarve, shooting, fresh, character, stackLeft, onDelete \}\)/);
  const gSeg = screens.slice(screens.indexOf("function GachaCard({"), screens.indexOf("function gachaCapsule("));
  assert.equal((gSeg.match(/"撕掉"/g) || []).length, 1, "撕掉那颗只许有一处");
  const uSeg = screens.slice(screens.indexOf("function Gacha({"), screens.indexOf("function GachaCard({") + 1);
  const both = screens.slice(screens.indexOf("const album = K.albumOf"), screens.indexOf("// ═══ 情侣空间·惊喜抽屉"));
  assert.equal((both.match(/onDelete: onDelete/g) || []).length, 2, "券夹和纪念册两处都要递下去");
  assert.match(screens, /onDelete: onGachaDelete/);
  assert.match(screens, /onGachaPin, onGachaDelete, onGachaTitle/, "Us 的形参要收下它，不然一路是 undefined");
});

test("原来那条规矩的来历留着，别让以后的人以为是漏的", () => {
  assert.match(gacha, /票根永不删除/);
  assert.match(gacha, /系统照旧永不自动删/);
});
