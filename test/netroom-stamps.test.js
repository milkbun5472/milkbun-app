// 联机：集邮社（js/netroom-stamps.js）——邮票册那几样玩法搬进房间（她 2026-11-22）。
//   规则只认 StampDuel 那一份；对局两边各交一串动作、两边都交了才结算；接力那几样一人一回合；死信各解各的比分。
const test = require("node:test"), assert = require("node:assert");
const fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
function load() {
  const w = {}; w.StampDuel = require("../js/stamp-duel.js"); w.StampDuelParts = {};
  new Function("window", read("js/netroom-games.js"))(w); new Function("window", read("js/netroom-stamps.js"))(w);
  return w;
}
const inv = n => ({ key: "stamps", seats: Array.from({ length: n }, (_, i) => ({ kind: i ? "npc" : "user", name: "座" + i })), host: "A" });
const mk = p => Array.from({ length: 12 }, (_, i) => ({ id: p + i, rarity: ["R", "SR", "SSR"][i % 3], lv: 5, charId: p, text: { name: p + "票" + i } }));
async function run(w, mode, n, extra) {
  const A = w.NetGameCore.ADAPTERS.stamps, iv = inv(n);
  let st = await A.init(iv, { prep: Object.assign({ mode }, extra || {}) });
  for (let guard = 0; guard < 400 && !A.result(st, iv); guard++) {
    const v = A.view(st), seats = A.turns(v); assert.ok(seats.length, "卡住了：" + v.phase);
    for (const i of seats) { const mv = i === 0 && st.phase === "deck" ? { deck: w.StampDuel.deckFrom(mk("a"), 3) } : A.npcMove(st, i, iv); const r = A.apply(st, i, mv, { inv: iv }); assert.ok(r.st, r.err); st = r.st; if (A.result(st, iv)) break; }
  }
  return { A, st, res: A.result(st, iv), iv };
}
test("对局：两边都寄出才结算；坐对面的那位看到的是换过个儿的，手牌只在自己那份", async () => {
  const w = load(), A = w.NetGameCore.ADAPTERS.stamps, iv = inv(2);
  let st = await A.init(iv, { prep: { mode: "duel" } });
  st = A.apply(st, 0, { deck: w.StampDuel.deckFrom(mk("a"), 1) }, { inv: iv }).st;
  st = A.apply(st, 1, { deck: w.StampDuel.deckFrom(mk("b"), 2) }, { inv: iv }).st;
  assert.equal(st.phase, "play");
  const v = A.view(st); assert.equal(v.ds.me.hand.length, 0); assert.equal(v.ds.foe.hand.length, 0); assert.ok(v.ds.me.handN > 0);
  const p1 = A.priv(st, 1); assert.ok(p1.ds.me.hand.length > 0); assert.equal(p1.ds.foe.hand.length, 0);
  assert.equal(p1.ds.me.board.length, 9); assert.equal(String(p1.ds.me.hand[0].cardId).slice(0, 1), "b");
  const t0 = st.ds.turn;
  st = A.apply(st, 0, A.npcMove(st, 0, iv), { inv: iv }).st; assert.equal(st.ds.turn, t0); assert.deepEqual(A.turns(A.view(st)), [1]);
  assert.ok(A.apply(st, 0, { ops: [] }, { inv: iv }).err);
  st = A.apply(st, 1, A.npcMove(st, 1, iv), { inv: iv }).st; assert.equal(st.ds.turn, t0 + 1);
  const { res } = await run(w, "duel", 2);
  assert.ok(/对 座1，对局打了 \d+ 回合/.test(res.text), res.text);
});
test("接力、积压件、护信、封缄令：一张信封一人一回合轮着下，卡组是大家那几副拼起来的", async () => {
  const w = load();
  for (const m of ["relay", "raid", "siege", "edict"]) {
    const { st, res } = await run(w, m, 3);
    assert.ok(res && res.text.indexOf("一起打") > 0, m + "：" + (res && res.text));
    assert.equal(st.ds.me.draw.concat(st.ds.me.hand, st.ds.me.discard, st.ds.me.board.filter(Boolean)).length > 0, true);
    if (m === "edict") assert.equal(st.edicts.length, 3);
  }
});
test("死信：同一道题各解各的，比谁打得多", async () => {
  const w = load(); const { res, st } = await run(w, "puzzle", 3, { lv: 5 });
  assert.equal(st.sheets.length, 3); assert.ok(/死信第 5 关/.test(res.text), res.text);
});
test("交来的卡组只收白名单、数夹在范围里；不够 6 张换通用票", async () => {
  const w = load(), A = w.NetGameCore.ADAPTERS.stamps, iv = inv(2);
  let st = await A.init(iv, { prep: { mode: "duel" } });
  const bad = w.StampDuel.deckFrom(mk("a"), 1).map(u => Object.assign({}, u, { pow: 999, maxHp: 999, evil: 1 }));
  st = A.apply(st, 0, { deck: bad }, { inv: iv }).st; assert.equal(st.decks[0][0].pow, 40); assert.equal(st.decks[0][0].evil, undefined);
  st = A.apply(st, 1, { deck: [] }, { inv: iv }).st; assert.equal(st.decks[1].length, 12);
});
test("接线：大厅架子上有这一盒；index 里在 netroom.js 前面；牌桌拿得到角色名", () => {
  const w = load(); assert.equal(w.NetGameCore.ADAPTERS.stamps.shelf.key, "stamps");
  const html = read("index.html"); assert.ok(html.indexOf("js/netroom-stamps.js") > 0 && html.indexOf("js/netroom-stamps.js") < html.indexOf("js/netroom.js"));
  assert.match(read("js/netroom.js"), /h\(A\.Table, \{ charsById, inv:/);
  assert.match(read("js/stamp-duel-ui.js"), /window\.StampDuelParts = \{ Envelope, Ticket/);
});
