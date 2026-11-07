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
  st.me.terrain = st.me.terrain.map(() => ""); st.events = [];
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
  st.me.terrain = st.me.terrain.map(() => ""); st.events = [];
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

const blank = st => { st.me.terrain = st.me.terrain.map(() => ""); st.foe.terrain = st.foe.terrain.map(() => ""); st.events = []; return st; };
test("票的作用跟卡上的字走：写拔刀的是投递、写撑伞的是火漆、写下雨的是邮戳", () => {
  assert.equal(D.stampOf({ id: "a", rarity: "R", text: { narration: "他拔刀挡在前面打了起来" } }).role, "投递");
  assert.equal(D.stampOf({ id: "b", rarity: "R", text: { narration: "他撑伞护着你，把外套披在你肩上" } }).role, "火漆");
  assert.equal(D.stampOf({ id: "c", rarity: "R", text: { narration: "雨夜里他喝醉了" } }).role, "邮戳");
  assert.ok(D.ROLES.includes(D.stampOf({ id: "d", rarity: "R", text: { name: "无" } }).role));
});
test("盖章：章攒满才能盖、花 1 邮资；挪票只能挪到旁边空格；留牌最多两张留到下回合", () => {
  const st = blank(D.newDuel(D.deckFrom(mine, 4), D.deckFrom(mine, 5), 4));
  st.me.postage = 9; D.place(st, "me", 0, 4);
  assert.equal(D.stamp(st, "me", 4).ok, false);
  st.me.board[4].charge = st.me.board[4].need; const pg = st.me.postage;
  assert.ok(D.stamp(st, "me", 4).ok); assert.equal(st.me.postage, pg - 1); assert.equal(st.me.board[4] ? st.me.board[4].charge : 0, 0);
  if (st.me.board[4]) { assert.equal(D.move(st, "me", 4, 0).ok, false); assert.ok(D.move(st, "me", 4, 1).ok); }
  const keepA = st.me.hand[0], keepB = st.me.hand[1];
  assert.ok(D.keep(st, "me", 0).ok); assert.ok(D.keep(st, "me", 1).ok); assert.equal(D.keep(st, "me", 2).ok, false);
  D.endTurn(st);
  if (!st.over) { assert.ok(st.me.hand.includes(keepA) && st.me.hand.includes(keepB)); }
});
test("前排挡着，后排挨不着；破损格贴不上", () => {
  const st = blank(D.newDuel(D.deckFrom(mine, 6), D.deckFrom(mine, 7), 6));
  st.foe.terrain[0] = "破损"; st.foe.postage = 9;
  assert.equal(D.place(st, "foe", 0, 0).ok, false);
  st.me.board[2] = Object.assign(D.stampOf(mine[1]), { uid: 99, hp: 99, maxHp: 99, shield: 0, marks: {}, charge: 0, role: "投递", pow: 5 });
  st.foe.board[8] = Object.assign(D.stampOf(mine[2]), { uid: 98, hp: 10, maxHp: 10, shield: 0, marks: {}, charge: 0, role: "补票" });
  st.foe.board[2] = Object.assign(D.stampOf(mine[3]), { uid: 97, hp: 50, maxHp: 50, shield: 0, marks: {}, charge: 0, role: "火漆" });
  st.intent = { place: [], stamp: [] };
  D.endTurn(st);
  assert.equal(st.foe.board[8] && st.foe.board[8].hp, 10);
});
test("邮局公告提前一回合预告；整版觉醒", () => {
  const st = D.newDuel(D.deckFrom(mine, 8), D.deckFrom(mine, 9), 8);
  assert.ok(st.events[3]);
  while (st.turn < 2 && !st.over) D.endTurn(st);
  if (!st.over) assert.equal(st.intent.nextEvent, st.events[3]);
  const row = Array.from({ length: 12 }, (_, i) => card(300 + i, "y", "R", 1));
  const s2 = blank(D.newDuel(D.deckFrom(row, 1), D.deckFrom(theirs, 1), 1));
  s2.me.postage = 9; s2.me.hand = D.deckFrom(row, 3).slice(0, 3);
  [6, 7, 8].forEach(x => D.place(s2, "me", 0, x));
  assert.ok(s2.log.some(l => l.kind === "wake" && l.combo === "整版"));
});
test("连打几把：一串结束才出一句总的；对局里不叫邮资叫胶水", () => {
  const sr = D.newSeries();
  for (let s = 1; s <= 3; s++) { const st = D.newDuel(D.deckFrom(mine, s), D.deckFrom(mine, s + 50), s); while (!st.over) D.endTurn(st); D.addGame(sr, st); }
  assert.equal(sr.games.length, 3);
  assert.match(D.memoryLine(sr, "B", "她"), /连打了 3 局对局，她 \d+ 胜 \d+ 负/);
  assert.ok(D.MARKS.受潮 && !D.MARKS.欠资);
});
test("放错了能撤回：胶水、手牌、信封都回去；寄出后就不能撤；撤回过对面照样照亮出来的那步走", () => {
  const st = D.newDuel(D.deckFrom(mine, 21), D.foeDeckFrom(mine.concat(theirs), "b", ["a"], 21), 21);
  st.me.terrain = st.me.terrain.map(() => "");
  const pg = st.me.postage, n = st.me.hand.length;
  assert.ok(D.place(st, "me", 0, 4).ok);
  assert.ok(D.canUndo(st));
  assert.ok(D.undo(st).ok);
  assert.equal(st.me.postage, pg); assert.equal(st.me.hand.length, n); assert.equal(st.me.board[4], null);
  assert.equal(D.undo(st).ok, false);
  assert.equal(D.place(st, "me", 0, 4).ok, true); D.undo(st);
  const plan = st.intent.place.map(p => p.slot);
  D.endTurn(st);
  assert.equal(D.canUndo(st), false);
  for (const s of plan) assert.ok(st.foe.board[s] || st.log.some(l => l.kind === "fall" && l.who === "foe"));
});
