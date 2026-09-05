// v63.05 玩法②（她 2026-09-05「都可以做，按顺序来」的第三件）：从梦里带一样东西出来。
// 抵达 / 直面那一次调用顺手多要一件【能拿在手里的小东西】，不另花一次；「带出梦去」进她的物品；
// Ta 那边只拿到一句「眼熟」——它来自 Ta 自己的梦，Ta 不知道，永远不说破。她握着一个 Ta 自己都不知道的秘密。
// 铁律：梦≠记忆——东西进的是 x_inventory（物件），不进记忆库；不算礼物（giftLog 写着「真实发生过，你记得」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const dream = read("js/dream.js"), app = read("js/app.js"), engine = read("js/engine.js"), screens = read("js/screens.js");

function loadDream() {
  const g = { window: null, loadJSON: () => ({}), saveJSON: () => true, useState: v => [typeof v === "function" ? v() : v, () => {}], useRef: () => ({ current: null }), useEffect: () => {}, React: { Fragment: "f" },
    h: () => null, Head: () => null, Avatar: () => null, F_BODY: "a", F_DISPLAY: "b", requestAppConfirm: () => {}, isOocMsg: () => false };
  g.window = g; g.DreamLoop = { markEntered: () => Promise.resolve(), excerptsFor: () => [], listDreams: () => Promise.resolve([]) };
  vm.runInNewContext(dream, g); return g;
}

test("两种收束（抵达/直面）都在同一次调用里多要那件东西，写法一处（KEEPSAKE_ASK）", () => {
  const E = dream.slice(dream.indexOf("async function weaveEnding("), dream.indexOf("async function weaveShatter(") );
  assert.equal((E.match(/KEEPSAKE_ASK/g) || []).length, 2, "抵达和直面得各带一次，且都是同一句");
  assert.match(dream, /const KEEPSAKE_ASK = /);
  assert.match(dream, /能拿在手里】的东西/, "得是能拿在手里的小东西，不是一句话、一种感觉");
  assert.match(E, /\\"keepsake\\":\{\\"name\\":\\"东西的名字\\",\\"note\\":\\"它在梦里是什么\\"\}/, "schemaHint 的占位得是【说明】不是样例内容");
  assert.equal((E.match(/keepsake: normKeepsake\(p\.keepsake\)/g) || []).length, 2);
  // 没有多一次调用：结局函数里 callAI 仍各一次
  assert.equal((E.match(/await callAI\(/g) || []).length, 3, "抵达/挣扎/直面各一次调用，多了就是另花了");
});

test("归一：空名字不算；名字 ≤12、note ≤60；taken 起手为 false", () => {
  const N = loadDream().Dream.normKeepsake;
  assert.equal(N(null), null); assert.equal(N({ note: "x" }), null);
  const k = N({ name: "  一把没齿的  钥匙 ", note: "锁着阁楼那扇门的" });
  assert.equal(k.name, "一把没齿的 钥匙"); assert.equal(k.note, "锁着阁楼那扇门的"); assert.equal(k.taken, false);
  assert.equal(N({ name: "一二三四五六七八九十一二三四" }).name.length, 12);
});

test("带出梦去：进她的物品，标着从谁的梦里来；梦这边记「已带出」；回档不收回已带出的", () => {
  assert.match(dream, /const item = \{ id: "iv_dream_" \+ Date\.now\(\), name: k\.name, fromCharId: null, dreamCharId: s\.charId, dreamNote: k\.note \|\| "", source: "dream", addedTs: Date\.now\(\) \};/, "物件的形状变了——读它的那头（ctxFor / 购物页）照这行认字段");
  assert.match(dream, /props\.onKeepsake && props\.onKeepsake\(item\);/);
  assert.match(dream, /keepsake: Object\.assign\(\{\}, k, \{ taken: true, itemId: item\.id \}\)/);
  assert.match(dream, /keepsake: \(s\.keepsake && s\.keepsake\.taken\) \? s\.keepsake : null/, "回档把已带出的也抹了——可东西已经在她物品里");
  assert.equal((dream.match(/h\(KeepsakeCard, \{ keepsake: s\.keepsake, onKeep: keep \}\)/g) || []).length, 2, "抵达和直面两个结局块都得有那张卡");
  assert.match(dream, /"带出梦去"/); assert.match(dream, /onKeepsake: props\.onKeepsake,/, "Dream 没把 onKeepsake 透传给 DreamView");
  // App 那头接住：进 x_inventory
  assert.match(app, /onKeepsake: item => setInventory\(inv => \{ const n = \[item, \.\.\.inv\]; saveJSON\("x_inventory", n\); return n; \}\)/);
});

test("Ta 那边只有「眼熟」：单独一层 dreamKeep，不进 giftLog，不进记忆；群里不给（写了理由）", () => {
  assert.match(app, /dreamKeep: \(\(\) => \{\s*\n\s*const mine = \(inventory \|\| \[\]\)\.filter\(x => x && x\.source === "dream" && x\.dreamCharId === char\.id\)/, "ctxFor 没按 source/dreamCharId 认——桩照写入方");
  assert.match(app, /群里不给——那是她和 Ta 两个人之间的东西/, "群聊不给这层得写明理由（four-surfaces）");
  assert.match(engine, /if \(ctx\.dreamKeep && String\(ctx\.dreamKeep\)\.trim\(\)\) parts\.push\("【她身上带着的一样东西：/, "buildBundle 没接这层");
  assert.match(engine, /你不知道，永远别说破/);
  assert.match(engine, /giftLog: "", dreamKeep: "", carryLog: ""/, "ctx 默认值没登记");
  const gi = app.indexOf("giftLog: (() => {"); const G = app.slice(gi, app.indexOf("})(),", gi));
  assert.doesNotMatch(G, /dream/, "梦里带出来的混进礼物往来了——那一栏写着「真实发生过，你记得」");
});

test("购物页「我的物品」：梦里带出来的自成一组，写着从谁的梦里来", () => {
  assert.match(screens, /const dreamy = it\.source === "dream";/);
  assert.match(screens, /" 的梦里带出来的"/);
});
