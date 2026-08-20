"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../js/uno-core.js");
const players = () => [{ key: "a", name: "A" }, { key: "b", name: "B" }, { key: "c", name: "C" }];

test("UNO 标准牌堆 108 张且每人起手 7 张", () => {
  assert.equal(U.makeDeck(() => .5).length, 108);
  const s = U.newGame(players(), () => .5);
  assert.deepEqual(s.players.map(p => p.hand.length), [7, 7, 7]);
  assert.match(s.discard[0].value, /^[0-9]$/);
});

test("同色同值与万能牌可出，+4 有同色牌时不可偷出", () => {
  const s = U.newGame(players(), () => .4); s.color = "R"; s.discard = [{ color: "R", value: "5" }];
  const hand = [{ color: "R", value: "2" }, { color: "G", value: "5" }, { color: "W", value: "W" }, { color: "W", value: "W4" }];
  assert.equal(U.playable(hand[0], s, hand), true); assert.equal(U.playable(hand[1], s, hand), true);
  assert.equal(U.playable(hand[2], s, hand), true); assert.equal(U.playable(hand[3], s, hand), false);
});

test("忘喊 UNO 自动罚二，+2 让下家摸牌并跳过", () => {
  const s = U.newGame(players(), () => .3); s.turn = 0; s.color = "R"; s.discard = [{ color: "R", value: "1" }];
  s.players[0].hand = [{ uid: "x", color: "R", value: "D2", code: "RD2" }, { uid: "y", color: "B", value: "7", code: "B7" }];
  const before = s.players[0].hand.length; U.act(s, { kind: "play", uid: "x", uno: false }, () => .2);
  assert.equal(s.players[0].hand.length, before - 1 + 2); assert.equal(s.pendingDraw, 2); assert.equal(s.turn, 1);
  const b = s.players[1].hand.length; U.act(s, { kind: "draw" }, () => .2); assert.equal(s.players[1].hand.length, b + 2); assert.equal(s.turn, 2);
});

test("打光最后一张立即结束", () => {
  const s = U.newGame(players().slice(0, 2), () => .6); s.turn = 0; s.color = "G"; s.discard = [{ color: "G", value: "3" }];
  s.players[0].hand = [{ uid: "last", color: "G", value: "9", code: "G9" }];
  U.act(s, { kind: "play", uid: "last", uno: true }); assert.equal(s.status, "finished"); assert.equal(s.winner, "a");
});

test("摸到重复 code 时只允许打刚摸到的实体牌", () => {
  const s = U.newGame(players().slice(0, 2), () => .6); s.turn = 0; s.color = "R"; s.discard = [{ color: "R", value: "3" }];
  s.players[0].hand = [
    { uid: "old", color: "R", value: "5", code: "R5" },
    { uid: "drawn", color: "R", value: "5", code: "R5" }
  ];
  s.drawnUid = "drawn";
  U.act(s, { kind: "play", code: "R5", uno: true });
  assert.deepEqual(s.players[0].hand.map(c => c.uid), ["old"]);
});
