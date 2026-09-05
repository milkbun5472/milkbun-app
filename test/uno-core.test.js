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

// v63.33 判词重写：原来引擎直接禁止有同色时打 +4——那等于把「质疑 +4」半条规则删了。
// 官方规则允许诈打：牌随时能出，但出牌那刻的合法性记进 state.w4，被质疑抓到罚 4。
test("同色同值与万能牌可出；+4 可以诈打，但违规会被记档", () => {
  const s = U.newGame(players(), () => .4); s.color = "R"; s.discard = [{ color: "R", value: "5" }];
  const hand = [{ color: "R", value: "2" }, { color: "G", value: "5" }, { color: "W", value: "W" }, { color: "W", value: "W4" }];
  assert.equal(U.playable(hand[0], s, hand), true); assert.equal(U.playable(hand[1], s, hand), true);
  assert.equal(U.playable(hand[2], s, hand), true); assert.equal(U.playable(hand[3], s, hand), true);
  // 诈打（手里还有红）→ 记为违规；老实打（没有当前颜色）→ 记为合规
  const s2 = U.newGame(players(), () => .4); s2.turn = 0; s2.color = "R"; s2.discard = [{ color: "R", value: "5" }];
  s2.players[0].hand = [{ uid: "a", color: "R", value: "2", code: "R2" }, { uid: "b", color: "W", value: "W4", code: "W4" }];
  U.act(s2, { kind: "play", uid: "b", color: "G", uno: true }, () => .2);
  assert.equal(s2.w4.illegal, true); assert.equal(s2.w4.color, "R"); assert.equal(s2.pendingDraw, 4);
  const s3 = U.newGame(players(), () => .4); s3.turn = 0; s3.color = "R"; s3.discard = [{ color: "R", value: "5" }];
  s3.players[0].hand = [{ uid: "a", color: "G", value: "2", code: "G2" }, { uid: "b", color: "W", value: "W4", code: "W4" }];
  U.act(s3, { kind: "play", uid: "b", color: "G", uno: true }, () => .2);
  assert.equal(s3.w4.illegal, false);
});

test("质疑 +4：抓到违规改由出牌人罚 4、质疑者原地出牌；质疑合规自罚 6", () => {
  const mk = function (culpritHand) {
    const s = U.newGame(players(), () => .4); s.turn = 0; s.color = "R"; s.discard = [{ color: "R", value: "5" }];
    s.players[0].hand = culpritHand.concat([{ uid: "w", color: "W", value: "W4", code: "W4" }]);
    U.act(s, { kind: "play", uid: "w", color: "G", uno: false }, () => .2);
    return s;
  };
  // 违规局：质疑成功
  const s1 = mk([{ uid: "r", color: "R", value: "2", code: "R2" }, { uid: "r2", color: "R", value: "3", code: "R3" }]);
  const victim = s1.turn, victimHand = s1.players[victim].hand.length, culpritHand = s1.players[0].hand.length;
  U.act(s1, { kind: "challenge" }, () => .2);
  assert.equal(s1.players[0].hand.length, culpritHand + 4, "违规的出牌人没被罚 4");
  assert.equal(s1.players[victim].hand.length, victimHand, "质疑成功还罚了质疑者");
  assert.equal(s1.pendingDraw, 0); assert.equal(s1.w4, null);
  assert.equal(s1.turn, victim, "质疑成功后该原地轮到质疑者出牌");
  // 合规局：质疑失败罚 6
  const s2 = mk([{ uid: "g", color: "G", value: "2", code: "G2" }, { uid: "g2", color: "G", value: "3", code: "G3" }]);
  const v2 = s2.turn, v2Hand = s2.players[v2].hand.length;
  U.act(s2, { kind: "challenge" }, () => .2);
  assert.equal(s2.players[v2].hand.length, v2Hand + 6, "质疑失败该罚 4+2=6");
  assert.notEqual(s2.turn, v2, "质疑失败还占着轮次");
  // 没有 +4 摆着时不许质疑
  const s3 = U.newGame(players(), () => .4);
  assert.throws(function () { U.act(s3, { kind: "challenge" }, () => .2); });
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

test("出牌、摸牌和不出都保留桌上话", () => {
  const s = U.newGame(players().slice(0, 2), () => .6); s.turn = 0; s.color = "R"; s.discard = [{ color: "R", value: "3" }];
  s.players[0].hand = [{ uid: "talk", color: "R", value: "5", code: "R5" }, { uid: "left", color: "B", value: "8", code: "B8" }];
  U.act(s, { kind: "play", uid: "talk", uno: true, say: "这张接好。" });
  assert.match(s.log.at(-1).text, /这张接好/);
  s.pendingDraw = 2; U.act(s, { kind: "draw", say: "我记住了。" });
  assert.match(s.log.at(-1).text, /我记住了/);
  s.drawnUid = s.players[0].hand[0].uid; s.turn = 0; U.act(s, { kind: "pass", say: "先让你们一手。" });
  assert.match(s.log.at(-1).text, /先让你们一手/);
});

test("任意颜色 +2 可以连续叠加，罚牌累计转给下一家", () => {
  const s = U.newGame(players(), () => .4, { stackD2: true }); s.turn = 0; s.color = "R"; s.discard = [{ color: "R", value: "D2", code: "RD2" }]; s.pendingDraw = 2;
  s.players[0].hand = [{ uid: "blue2", color: "B", value: "D2", code: "BD2" }, { uid: "rest", color: "Y", value: "6", code: "Y6" }];
  assert.deepEqual(U.legalCodes(s), ["BD2"]);
  U.act(s, { kind: "play", uid: "blue2", uno: true, say: "还给你。" });
  assert.equal(s.pendingDraw, 4); assert.equal(s.turn, 1); assert.equal(s.color, "B"); assert.match(s.log.at(-1).text, /累计 \+4.*还给你/);
  const before = s.players[1].hand.length; U.act(s, { kind: "draw" }, () => .3);
  assert.equal(s.players[1].hand.length, before + 4); assert.equal(s.pendingDraw, 0); assert.equal(s.turn, 2);
});

test("官方规则下 +2 不能叠加，只能摸牌并跳过", () => {
  const s = U.newGame(players(), () => .4, { stackD2: false }); s.turn = 0; s.color = "R"; s.discard = [{ color: "R", value: "D2", code: "RD2" }]; s.pendingDraw = 2;
  s.players[0].hand = [{ uid: "blue2", color: "B", value: "D2", code: "BD2" }];
  assert.deepEqual(U.legalCodes(s), []);
  assert.throws(() => U.act(s, { kind: "play", uid: "blue2", uno: true }), /官方规则不能叠加/);
  const before = s.players[0].hand.length; U.act(s, { kind: "draw" }, () => .3);
  assert.equal(s.players[0].hand.length, before + 2); assert.equal(s.turn, 1);
});
