import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
globalThis.StampDuel = require("../js/stamp-duel.js");
const RN = require("../js/stamp-run.js");
const D = globalThis.StampDuel;
const card = (i, c, r, lv) => ({ id: "c" + i, charId: c, rarity: r, lv, text: { name: "k" + i, line: "台词" + i } });
const cards = Array.from({ length: 30 }, (_, i) => card(i, ["a", "b", "c", "d"][i % 4], ["R", "R", "SR", "SSR"][i % 4], 1 + i * 2));
const play = o => { const st = D.newDuel(o.meDeck, o.foeDeck, o.seed, o);
  while (!st.over) { st.me.board.forEach((u, i) => { if (u && u.charge >= u.need && st.me.postage >= 1) D.stamp(st, "me", i); });
    for (let k = st.me.hand.length - 1; k >= 0; k--) { const sc = st.me.hand[k]; const ord = sc.role === "火漆" ? [0,1,2,3,4,5,6,7,8] : [6,7,8,3,4,5,0,1,2]; const f = ord.find(i => !st.me.board[i] && st.me.terrain[i] !== "破损"); if (f == null) continue; D.place(st, "me", k, f); }
    D.endTurn(st); } return st; };
test("远信：路线图六站、终点是 TA；起手挑六张；血带着走；能一路走到底", () => {
  let wins = 0, ends = 0;
  for (let n = 1; n <= 60; n++) {
    const run = RN.newRun({ cards, toId: "a", seed: n, core: ["a"] });
    assert.equal(run.map.length, RN.ROWS); assert.equal(run.map[RN.ROWS - 1][0].type, "boss");
    RN.takeStart(run, [0, 1, 2, 3, 4, 5]); assert.equal(run.deck.length, 6);
    while (!run.done) {
      const nd = RN.enter(run, RN.reachable(run)[0]); assert.ok(nd);
      if (["fight", "elite", "boss"].includes(nd.type)) {
        const b = RN.battleFor(run, nd, cards, () => [], ["a", "b", "c"]);
        assert.equal(b.meHp, run.hp);
        if (nd.type === "boss") assert.equal(b.foeId, "a");
        const st = play(Object.assign({}, b, { meDeck: run.deck.map(x => Object.assign({}, x)) }));
        const r = RN.afterBattle(run, st, nd, cards); if (r.offer && r.offer[0]) run.deck.push(r.offer[0]);
      } else if (nd.type === "event") RN.doEvent(run, RN.eventFor(run), 0, cards);
      else if (nd.type === "shop") RN.buy(run, RN.shopFor(run, cards), "heal", 0);
      else if (nd.type === "rest") RN.rest(run, "heal");
    }
    ends++; if (run.done.win) wins++;
  }
  assert.equal(ends, 60); assert.ok(wins > 10 && wins < 60, "wins " + wins);
});
test("信物在对局里生效：胶水罐多 1 胶水、厚信封加上限", () => {
  const st = D.newDuel(D.deckFrom(cards, 1), D.deckFrom(cards, 2), 1, { relics: ["胶水罐"] });
  assert.equal(st.me.postage, 4);
  const run = RN.newRun({ cards, toId: "a", seed: 3 }); RN.addRelic(run, "厚信封"); assert.equal(run.max, 70);
  assert.ok(Object.keys(D.RELICS).length >= 20);
});
test("界面：对局页进远信；打仗用对局页、打完交回；回信存起来；路上能聊", () => {
  const ui = readFileSync(new URL("../js/stamp-run-ui.js", import.meta.url), "utf8"), du = readFileSync(new URL("../js/stamp-duel-ui.js", import.meta.url), "utf8");
  const st = readFileSync(new URL("../js/stamps.js", import.meta.url), "utf8"), app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(st, /tab === "run" && window\.StampRunPage/);
  assert.match(du, /"data-wk": "duelrunnext", onClick: \(\) => runBattle\.onDone\(st\)/);
  assert.match(ui, /const SAVE = "x_stampRun", LETTERS = "x_stampRunLetters"/);
  assert.match(ui, /mode: "road"/); assert.match(ui, /mode: "letter"/);
  assert.match(app, /d\.mode === "letter"/);
});
test("岔路十六种，每个选项都有结果；同一趟不重样", () => {
  assert.ok(RN.EVENTS.length >= 16);
  const run = RN.newRun({ cards, toId: "a", seed: 9 }); RN.takeStart(run, [0, 1, 2, 3, 4, 5]);
  const seen = new Set(); for (let k = 0; k < RN.EVENTS.length; k++) { run.step = k + 1; seen.add(RN.eventFor(run).key); }
  assert.equal(seen.size, RN.EVENTS.length);
  for (const ev of RN.EVENTS.filter(e => e.opts)) ev.opts.forEach((_, oi) => { const r = RN.newRun({ cards, toId: "a", seed: 9 }); RN.takeStart(r, [0, 1, 2, 3, 4, 5]); assert.ok(RN.doEvent(r, ev, oi, cards)); });
});
test("信的事件：七种都在岔路池里，各有奖励；回信带上卡组里每张卡的那一刻；寄给以后的信封着到下一趟", () => {
  const kinds = RN.EVENTS.filter(e => e.letter).map(e => e.letter);
  for (const k of ["postcard", "note", "memory", "oneline", "ask", "future", "swap"]) assert.ok(kinds.includes(k), k);
  const run = RN.newRun({ cards, toId: "a", seed: 4 }); RN.takeStart(run, [0, 1, 2, 3, 4, 5]);
  for (const k of kinds) assert.ok(RN.letterReward(run, k, 0) !== undefined);
  const ui = readFileSync(new URL("../js/stamp-run-ui.js", import.meta.url), "utf8"), app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(ui, /mode: "letter", text: "", withName: [^,]+, cards: run\.deck\.map\(cardStory\)/);
  assert.match(ui, /sealed: ev\.letter === "future"/);
  assert.match(ui, /x\.sealed \? Object\.assign\(\{\}, x, \{ sealed: false/);
  for (const m of ["postcard", "note", "memory", "oneline", "ask", "answer", "future", "swap"]) assert.ok(app.includes('d.mode === "' + m + '"'), m);
});
test("邮路等级、陪你走的人、终点特别规则、邮册图鉴、明信片照片", () => {
  const r = RN.newRun({ cards, toId: "a", withId: "b", level: 3, seed: 2 });
  assert.equal(r.withId, "b"); assert.equal(r.level, 3); assert.equal(r.max, 52);
  r.bonds = { a: "偏执" }; RN.takeStart(r, [0, 1, 2, 3, 4, 5]);
  const boss = RN.battleFor(r, { type: "boss", r: 5, k: 0 }, cards, () => [], ["a", "b"]);
  assert.equal(boss.bossRule, "偏执"); assert.ok(boss.bossRuleZh);
  const st = D.newDuel(r.deck, boss.foeDeck, 3, boss); D.endTurn(st); assert.ok((st.rage || 0) >= 1);
  const ui = readFileSync(new URL("../js/stamp-run-ui.js", import.meta.url), "utf8"), app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(ui, /const POSTMARKS = "x_stampRunPostmarks", LEVELK = "x_stampRunLevel", DEX = "x_stampRunDex"/);
  assert.match(ui, /const writer = mode === "postcard" \|\| mode === "future" \? run\.toId : withId;/);
  assert.match(app, /onRunPhoto: async \(charId, desc\) =>/);
  assert.match(app, /d\.toId && d\.toId !== char\.id/);
});
