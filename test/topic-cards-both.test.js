"use strict";
// 话题卡两行（她 2026-11-21）：「只我用」「我俩都能用」；TA 偶尔顺口问、她点「让 TA 来问」就下一轮一定问
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const comp = R("components.js"), app = R("app.js"), nest = R("nest.js"), studio = R("theme-studio.js");

// 从 components.js 原样切出存取与掷骰那一段（topicCardsOf 起，到 PairPick 之前）
function load() {
  const a = comp.indexOf("const topicCardsOf = "), b = comp.indexOf("function PairPick(");
  assert.ok(a > 0 && b > a);
  const store = {};
  const ctx = { window: {}, loadJSON: (k, d) => store[k] ? JSON.parse(store[k]) : d, saveJSON: (k, v) => { store[k] = JSON.stringify(v); } };
  vm.createContext(ctx);
  vm.runInContext(comp.slice(a, b) + "\nglobalThis.of = topicCardsOf; globalThis.put = topicCardsPut; globalThis.turn = topicCardTurn; globalThis.pick = topicCardPick;", ctx);
  return ctx;
}
const FORCED = t => "\n【这一轮顺口问一句】你想问 Ta：「" + t + "」。照你自己的口气，接在这轮的话里问出来。";
const RAND = t => "\n【手边的一个话题】你心里挂着这个，聊到合适的地方可以顺口问 Ta 或者聊起来：「" + t + "」。接不上就不提。";

test("没选过的卡在只我用：不会被 TA 拿去", () => {
  const c = load();
  c.put("a", () => [{ id: "1", text: "甲" }, { id: "2", text: "乙" }]);
  for (let i = 0; i < 20; i++) assert.equal(c.turn("a", Date.now(), () => 0), null);
});

test("写卡、小窝放进聊天：默认只我用，选了才带 both", () => {
  assert.match(comp, /useState\(false\);   \/\/ 自己写／导入的那几张放哪一行/);
  assert.match(comp, /writeBoth \? \{ both: true \} : \{\}/);
  assert.match(nest, /useState\(false\);   \/\/ 梗与话题放进聊天/);
  assert.match(nest, /topicBoth \? \{ both: true \} : \{\}/);
});

test("让 TA 来问：那一行原样带上，回复成功后清掉", () => {
  const c = load(), now = Date.UTC(2026, 10, 21, 4);
  const long = "很长".repeat(400);
  c.put("a", () => [{ id: "1", text: "甲", both: true }, { id: "2", text: long, both: true, ask: true }]);
  const r = c.turn("a", now, () => 0.99);
  assert.equal(r.forced, true);
  assert.equal(r.line, FORCED(long), "整张原样，不截");
  r.commit();
  const card = c.of("a").find(x => x.id === "2");
  assert.equal(card.ask, undefined); assert.equal(card.offeredTs, now);
  assert.equal(c.turn("a", now, () => 0.99), null, "清掉以后不再强带");
});

test("随机：25%、一天 3 次、一张歇 3 天", () => {
  const c = load(), day = Date.UTC(2026, 10, 21, 4);
  c.put("a", () => [1, 2, 3, 4, 5].map(i => ({ id: String(i), text: "卡" + i, both: true })));
  assert.equal(c.turn("a", day, () => 0.25), null, "掷到 0.25 不带");
  const r = c.turn("a", day, () => 0.1);
  assert.equal(r.forced, false);
  assert.ok(/^卡\d$/.test(r.line.slice(r.line.indexOf("「") + 1, r.line.lastIndexOf("」"))));
  assert.equal(r.line, RAND(r.line.slice(r.line.indexOf("「") + 1, r.line.lastIndexOf("」"))));
  r.commit(); c.turn("a", day + 1000, () => 0.1).commit(); c.turn("a", day + 2000, () => 0.1).commit();
  assert.equal(c.turn("a", day + 3000, () => 0), null, "今天满 3 次");
  // 第二天：只剩两张没歇着的能出
  const next = day + 86400e3, seen = new Set();
  for (let k = 0; k < 10; k++) { const x = c.turn("a", next, () => k / 10 * 0.2); if (x) seen.add(x.line); }
  const offered = c.of("a").filter(x => x.offeredTs).map(x => "卡" + x.id);
  offered.forEach(o => assert.ok(![...seen].some(l => l.includes("「" + o + "」")), o + " 还在歇"));
  // 三天后歇完
  c.put("a", l => l.map(x => Object.assign({}, x, x.offeredTs ? { offeredTs: day } : {})));
  const later = day + 3 * 86400e3, fresh = c.pick(c.of("a").filter(x => x.offeredTs), later, () => 0.1);
  assert.ok(fresh && !fresh.forced);
});

test("app.js：单聊回复（含主动）挂这一行，群/配角/本体不带，成功才记账", () => {
  assert.match(app, /const _topicCard = \(!sideRoom && !_body && !char\.npc && typeof window\.topicCardTurn === "function"\) \? window\.topicCardTurn\(charId\) : null;/);
  assert.match(app, /desireHint \+ topicCardHint \+/);
  assert.match(app, /if \(delivered && _topicCard\) _topicCard\.commit\(\);/);
  const n = (app.match(/【这一轮顺口问一句】|【手边的一个话题】/g) || []).length;
  assert.equal(n, 0, "提示词只写在 components.js 那一处");
});

test("新挂点都登记了", () => {
  const wks = new Set();
  for (const src of [comp, nest]) for (const m of src.matchAll(/(?:"data-wk"|wk): "(topiccard[a-z]*|nesttopicrow)"/g)) wks.add(m[1]);
  ["topiccardrow", "topiccardboth", "topiccardrowpick", "topiccardmenu", "topiccardmenuitem", "nesttopicrow"].forEach(k => assert.ok(wks.has(k), k + " 在代码里"));
  wks.forEach(k => assert.ok(studio.includes('["' + k + '", '), k + " 登记在 theme-studio"));
});
