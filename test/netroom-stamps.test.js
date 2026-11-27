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
test("邮区巡查、邮局值班：同一张图／同一个柜台，各走各的，最后比分", async () => {
  const w = load();
  for (const m of ["patrol", "shift"]) {
    const { st, res, A } = await run(w, m, 3);
    assert.ok(res, m + " 没打完"); assert.equal(st.sheets.length, 3);
    if (m === "patrol") { assert.ok(/一起巡查「/.test(res.text), res.text); assert.equal(st.sheets[1].p.cells.map(c => c.type).join(), st.sheets[2].p.cells.map(c => c.type).join()); }
    else assert.ok(/一起值班：/.test(res.text), res.text);
    const p0 = A.priv(st, 0); assert.ok(p0.sheet); const v = A.view(st); assert.equal(v.sheets[0].p, undefined);
  }
});
test("值班：柜台照轮次和刷新次数摆，同一轮大家一样；没买票不能开打", async () => {
  const w = load(), A = w.NetGameCore.ADAPTERS.stamps, iv = inv(2);
  let st = await A.init(iv, { prep: { mode: "shift" } });
  st = A.apply(st, 0, { deck: w.StampDuel.deckFrom(mk("a"), 1) }, { inv: iv }).st; st = A.apply(st, 1, { deck: w.StampDuel.deckFrom(mk("b"), 2) }, { inv: iv }).st;
  assert.deepEqual(st.sheets[0].sh.shop.map(u => u.cardId), st.sheets[1].sh.shop.map(u => u.cardId));
  assert.ok(A.apply(st, 0, { fight: true }, { inv: iv }).err);
});

// 她 11-26「集邮社从小游戏里面移出来到加号里面」：跟擂台、跑团一样单独一格，小游戏架子上不再摆
test("集邮社在 ＋ 里单独一格，不在小游戏架子上", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/netroom.js"), "utf8");
  assert.ok(/\["stamps", "集邮社", "stampEdge"\]/.test(src));
  assert.ok(/OWN_SLOT = \{[^}]*stamps: true/.test(src));
  assert.ok(/filter\(k => !OWN_SLOT\[k\]\)/.test(src));
  assert.ok(/if \(k === "stamps"\) \{ const D = GC\(\) && GC\(\)\.ADAPTERS\.stamps/.test(src));
});

// 她 11-26「联机擂台跑团邮票册页面能不能都做好看点参考一下他们原本的页面」：三盒开局页各带单机那页的地面和长相
test("擂台、跑团、集邮社的开局页照单机的样子：各有自己的地面", () => {
  const fs = require("node:fs"), path = require("node:path"), rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  const nr = rd("js/netroom.js"), db = rd("js/netroom-debate.js"), tr = rd("js/netroom-trpg.js"), st = rd("js/netroom-stamps.js");
  assert.ok(/shellOn\(prepA\.prepFloor \? prepA\.prepFloor\(t\) : null/.test(nr), "房间页要把开局页的地面铺满整页");
  assert.ok(/A\.prepFloor = t => \(typeof pageSkin === "function" \? pageSkin\("cloth"/.test(db));
  assert.ok(/A\.prepFloor = \(\) =>/.test(tr) && /"nrtrpgcard"/.test(tr));
  assert.ok(/A\.prepFloor = \(\) =>/.test(st) && /"nrstampsmodetile"/.test(st) && /"nrstampsmodehero"/.test(st));
});
test("打起来的牌桌也铺这一盒的地面；跑团桌上是纸卡和色条选项", () => {
  const fs = require("node:fs"), path = require("node:path"), rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
  assert.ok(/"nrgamearea"[^\n]*A\.prepFloor \? A\.prepFloor\(t\) : \{\}/.test(rd("js/netroom.js")));
  const tr = rd("js/netroom-trpg.js");
  assert.ok(/"nrtrpglog", style: Object\.assign\(paperCard\(t\)/.test(tr) && /borderLeft: "3px solid " \+ tone/.test(tr));
});
