// 她 2026-09-18：「我能不能给他们买了漂亮衣服放进他们的衣柜哈哈哈 / 他们有的人的审美堪忧 / 看了着急」，
// 接着自己点了落点：「他收到礼物那里能不能做一个订进衣柜，但是就是不知道怎么判定是不是衣物类的」。
//
// 病根不是「没有衣柜」：礼物本来就会进 carryMaterialFor 当【提示词素材】，让模型自己写进衣柜——
// 于是她买的那件不一定出现，出现了名字也常被改写。她要的是【这一件、原名原样、由我说了算】，
// 所以这条路不经过模型，直接 closetMerge 进 carry[charId].outfit。
//
// 判定那一问的答案写在 closetGiftLike 上面：它只决定【按钮默不默认露出来】，
// 永远不决定【能不能挂】——做成「判定为衣物才允许挂」的话，正则漏一个词就是一堵她绕不过去的墙。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const screens = R("js/screens.js"), app = R("js/app.js");
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const S = strip(screens), A = strip(app);

// 真跑那几支纯函数（抠法照 carry-scroll-and-closet-more-67-33 那一份）
const F = (() => {
  const head = screens.slice(screens.indexOf("const CLOSET_MAX_OCCASIONS"), screens.indexOf("function carryProbeSpec"));
  return new Function(head + "\nreturn { closetGroups, closetCount, closetRoom, closetMerge, closetGiftLike };")();
})();

test("判定：品类认新礼物，名字认老礼物（老存档里没有 cat）", () => {
  assert.equal(F.closetGiftLike("米白色针织开衫", "fashion"), true);
  assert.equal(F.closetGiftLike("不知道什么玩意", "fashion"), true, "购物 app 标了「穿的」就算数，名字看不出来也算");
  assert.equal(F.closetGiftLike("藏青色长衫", null), true, "老礼物没有 cat，只能靠名字");
  assert.equal(F.closetGiftLike("一双短靴", undefined), true);
  assert.equal(F.closetGiftLike("桂花糖", null), false);
});

test("判定错了也挡不住她：界面上另有一条不看判定的路", () => {
  assert.ok(/这是件衣服？挂进衣柜/.test(screens), "看着不像衣服时，必须仍有一条能挂进去的路");
  assert.ok(/giftOccOpen/.test(S), "那条路自己带展开状态，不跟判定共用");
  // ⚠️这一条是这个功能的地板：判定只准决定「默不默认露出来」
  const gate = screens.slice(screens.indexOf("closetGiftLike(openGift.name"), screens.indexOf("closetGiftLike(openGift.name") + 90);
  assert.ok(/\|\|\s*giftOccOpen/.test(gate), "判定必须是 (像衣服 || 她自己展开了)，不许是单独的准入条件");
});

test("挂进去走的是 closetMerge：只添不换，老的一身不动", () => {
  const set = n => ({ name: n, note: n + "的说明" });
  const known = { closet: [
    { occasion: "上朝", sets: [set("绯色官袍")] },
    { occasion: "在家", sets: [set("灰麻常服")] }
  ] };
  const merged = F.closetMerge(known, { closet: [{ occasion: "在家", sets: [{ name: "月白棉袍", note: "你送的" }] }] });
  const groups = F.closetGroups(merged);
  assert.deepEqual(groups.map(g => g.occasion), ["上朝", "在家"], "不许新开一个重名场合");
  assert.deepEqual(groups[0].sets.map(x => x.name), ["绯色官袍"], "老的一身不许动");
  assert.deepEqual(groups[1].sets.map(x => x.name), ["灰麻常服", "月白棉袍"]);
  assert.equal(F.closetCount(merged), 3);
});

test("撞名挂不上就不许报「挂好了」（假回执防线，同 genClosetMore）", () => {
  const known = { closet: [{ occasion: "在家", sets: [{ name: "月白棉袍", note: "旧的" }] }] };
  const merged = F.closetMerge(known, { closet: [{ occasion: "在家", sets: [{ name: "月白棉袍", note: "你送的" }] }] });
  assert.equal(F.closetCount(merged) - F.closetCount(known), 0, "撞名会被静默挡掉");
  const fn = app.slice(app.indexOf("const closetGiftToChar"), app.indexOf("const genGiftThought"));
  assert.ok(/closetCount\(merged\) - closetCount\(known\) <= 0/.test(strip(fn)), "没真挂上就得走另一句话");
  assert.ok(/衣柜里已经有这一身了/.test(fn));
  assert.ok(/closetRoom\(known\) <= 0/.test(strip(fn)) && /衣柜已经挂满了/.test(fn), "满了也要说实话");
});

test("挂完顺手钉住：不钉的话下次重新翻衣柜会被换掉", () => {
  const fn = strip(app.slice(app.indexOf("const closetGiftToChar"), app.indexOf("const genGiftThought")));
  assert.ok(/setCarryPin\([^)]*"outfit"[^)]*true\)/.test(fn), "要的是【一定钉上】");
  // ⚠️不许用 toggleCarryPin：已经钉着的那件会被翻成取消
  assert.ok(!/toggleCarryPin/.test(fn));
});

test("钉／取消钉只有一处：toggleCarryPin 自己也走 setCarryPin", () => {
  assert.ok(/const toggleCarryPin = \(charId, key, name\) => setCarryPin\(charId, key, name\);/.test(app),
    "别让翻面和钉死各留一份实现（施工规则/one-public-mechanism.md）");
});

test("礼物落盘只有一处，而且带着品类", () => {
  // 只数【新收一件礼物】那一路：写想法（genGiftThought）是另一件事，它改的是已经在册的那一条
  assert.equal((A.match(/receivedTs: /g) || []).length, 1, "当面给和快递送达不许各写一份");
  const fn = A.slice(A.indexOf("const recordGiftReceived"), A.indexOf("const sendGiftToChar"));
  assert.ok(/cat: g\.cat \|\| null/.test(fn), "cat 半路丢了的话，衣柜那条路只能靠名字猜");
  assert.ok(/recordGiftReceived\(charId, \{ id: giftId, name: itemName, cat: cat \|\| null/.test(A), "当面给/转赠这一路也要带 cat");
  assert.ok(/recordGiftReceived\(g\.charId, \{ id: g\.id, name: g\.name, cat: g\.cat \|\| null/.test(A), "快递送达这一路也要带 cat");
});

test("场合先摆柜子里真有的那几个，再补常见的", () => {
  const blk = strip(screens.slice(screens.indexOf("const closetOccs"), screens.indexOf("const closetOccs") + 520));
  assert.ok(blk.indexOf("closetGroups(closetData)") < blk.indexOf('"日常"'), "已有的场合要排在前面");
  assert.ok(/slice\(0, 8\)/.test(blk));
});

test("礼物那一栏拿得到衣柜数据和挂衣柜的手（换个入口就什么都没有，是这仓库的老病）", () => {
  assert.ok(/closetData: data\.outfit/.test(screens), "CarryAll 要把衣柜那一栏交给礼物那一栏");
  ["function CarryAll", "function CarrySection", "function Carry("].forEach(sig => {
    const line = screens.slice(screens.indexOf(sig), screens.indexOf(sig) + 400);
    assert.ok(/onClosetGift/.test(line), sig + " 没接上 onClosetGift");
  });
  assert.ok(/onClosetGift: closetGiftToChar/.test(app), "App 那头没把手递出去");
});
