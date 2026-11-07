import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const D = require("../js/stamp-duel.js");
// 桩照邮票册写卡那段的形状：id / charId / rarity / lv / kind / text{name,line,thought} / pokes{head,heart,hand}
const card = (i, charId, rarity, lv, kind) => ({ id: "c" + i, charId, rarity, lv, kind, text: { name: "卡" + i, line: "台词" + i, thought: "心声" + i }, pokes: rarity === "SSR" ? { head: ["h"], heart: ["赢了" + i], hand: ["疼" + i] } : undefined });
const mine = Array.from({ length: 20 }, (_, i) => card(i, i % 2 ? "a" : "b", ["R", "SR", "SSR"][i % 3], 1 + i * 2, i % 7 === 0 ? "bday" : ""));
const theirs = Array.from({ length: 6 }, (_, i) => card(100 + i, "b", "SR", 20));
test("同一张卡永远算出同一个数，等级越高越强", () => {
  assert.deepEqual(D.stampOf(mine[3]), D.stampOf(mine[3]));
  const lo = D.stampOf({ ...mine[2], lv: 1 }), hi = D.stampOf({ ...mine[2], lv: 50 });
  assert.ok(hi.pow > lo.pow && hi.maxHp > lo.maxHp);
  assert.equal(D.stampOf({ id: "x", rarity: "SSR" }).face, 3);
});
test("卡组随机从收藏里抽，不够数用通用票补；对面先拿自己的卡", () => {
  assert.equal(D.deckFrom(mine.slice(0, 3), 1).length, D.DECK_SIZE);
  const f = D.foeDeckFrom(mine.concat(theirs), "b", ["a"], 5);
  assert.equal(f.length, D.DECK_SIZE);
  assert.ok(f.every(s => s.charId === "b" || s.charId === "a"));
  assert.notDeepEqual(D.deckFrom(mine, 1).map(s => s.cardId), D.deckFrom(mine, 2).map(s => s.cardId));
});
test("对面的下一步开回合就亮出来，照着走", () => {
  const st = D.newDuel(D.deckFrom(mine, 3), D.foeDeckFrom(mine.concat(theirs), "b", ["a"], 3), 3);
  assert.ok(st.intent && Array.isArray(st.intent.place));
  const plan = st.intent.place.map(p => p.slot);
  D.endTurn(st);
  for (const s of plan) assert.ok(st.foe.board[s] || st.log.some(l => l.kind === "fall" && l.slot === s && l.who === "foe"));
});
test("贴票花面值、邮资不够贴不上、一回合只能撕一张", () => {
  const st = D.newDuel(D.deckFrom(mine, 9), D.deckFrom(mine, 10), 9);
  const before = st.me.postage, s = st.me.hand[0];
  assert.ok(D.place(st, "me", 0, 4).ok);
  assert.equal(st.me.postage, before - s.face);
  assert.equal(D.place(st, "me", 0, 4).ok, false);
  assert.ok(D.tear(st, "me", 4).ok);
  D.place(st, "me", 0, 0);
  if (st.me.board[0]) assert.equal(D.tear(st, "me", 0).ok, false);
});
test("四方连：四张同一个人凑成 2×2 觉醒一次、打到信封", () => {
  const four = Array.from({ length: 12 }, (_, i) => card(200 + i, "z", "R", 1));
  const st = D.newDuel(D.deckFrom(four, 1), D.deckFrom(theirs, 1), 1);
  st.me.postage = 9; st.me.hand = D.deckFrom(four, 2).slice(0, 4);
  const hp = st.foe.hp;
  [0, 1, 3, 4].forEach(s => D.place(st, "me", 0, s));
  assert.ok(st.log.some(l => l.kind === "wake"));
  assert.ok(st.foe.hp < hp);
  const n = st.log.filter(l => l.kind === "wake").length; D.tear(st, "me", 8); assert.equal(st.log.filter(l => l.kind === "wake").length, n);
});
test("整局能打完，有输赢；结束时给一句要不要记的话", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const st = D.newDuel(D.deckFrom(mine, seed), D.foeDeckFrom(mine.concat(theirs), "b", ["a"], seed), seed);
    let guard = 0;
    while (!st.over && guard++ < 50) {
      // 她这边：能贴就贴，从上往下
      for (let k = st.me.hand.length - 1; k >= 0; k--) { const free = st.me.board.findIndex(x => !x); if (free < 0) break; D.place(st, "me", k, free); }
      D.endTurn(st);
    }
    assert.ok(st.over, "seed " + seed);
    assert.ok(["me", "foe", "draw"].includes(st.over.winner));
    assert.match(D.memoryLine(st, "B", "她"), /打了一局对局/);
  }
});
