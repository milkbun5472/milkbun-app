// 她 2026-10-16：「打牌类放进小游戏」→「都做了」——德州扑克 / 抽鬼牌 / 21 点
const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("../js/games.js");
const P = n => Array.from({ length: n }, (_, i) => ({ key: i ? "c" + i : "user", name: i ? "角色" + i : "我", isUser: !i }));
const C = s => s.split(" ").map(x => { const r = x.slice(0, -1), su = x.slice(-1); return { r, s: su, v: "23456789".includes(r) ? +r : { "10": 10, J: 11, Q: 12, K: 13, A: 14 }[r] }; });

test("德州：牌型大小", () => {
  const b = cs => g.pkBest(C(cs));
  assert.equal(b("A♠ K♠ Q♠ J♠ 10♠ 2♥ 3♦")[0], 8);
  assert.equal(b("A♠ 2♥ 3♦ 4♣ 5♠ 9♥ K♦").slice(0, 2).join(), "4,5", "A 当 1 的小顺");
  assert.equal(b("K♠ K♥ K♦ 2♣ 2♠ 9♥ 7♦")[0], 6);
  assert.ok(g.pkCmp(b("A♠ A♥ 9♦ 7♣ 3♠ 2♥ 4♦"), b("K♠ K♥ Q♦ J♣ 9♠ 2♥ 4♦")) > 0);
});

test("德州：打满一局，筹码守恒，有人加注全押也分得清", () => {
  for (let k = 0; k < 30; k++) {
    const s = g.pkNewGame(P(4));
    let guard = 0;
    while (s.status === "playing" && guard++ < 3000) {
      if (s.street === "done") { g.pkNewHand(s); continue; }
      const m = g.pkNpcMove(s, s.turn, k % 3 ? 0.3 : 0);
      if (k % 5 === 0 && Math.random() < .1) m.kind = "allin";
      g.pkAct(s, m);
      if (s.street === "done") assert.equal(s.players.reduce((a, p) => a + p.chips, 0), 4000);
    }
    assert.equal(s.status, "finished");
    assert.equal(s.players.reduce((a, p) => a + p.chips, 0), 4000);
  }
});

test("抽鬼牌：开局手里没有对子，打到底只剩一个拿鬼牌的", () => {
  const s = g.omNewGame(P(4));
  s.players.forEach(p => { const rs = p.hand.filter(c => !c.joker).map(c => c.r); assert.equal(new Set(rs).size, rs.length); });
  let n = 0; while (s.status === "playing" && n++ < 1000) g.omAct(s, 0, "");
  assert.equal(s.status, "finished");
  const loser = s.players.find(p => p.key === s.loser);
  assert.ok(loser && loser.hand.length === 1 && loser.hand[0].joker);
});

test("21 点：A 软硬算，打完一手庄家结算", () => {
  assert.equal(g.bjValue(C("A♠ K♥")), 21);
  assert.equal(g.bjValue(C("A♠ A♥ 9♦")), 21);
  assert.equal(g.bjValue(C("K♠ Q♥ 5♦")), 25);
  const s = g.bjNewGame(P(3));
  let n = 0; while (s.phase === "play" && n++ < 50) g.bjAct(s, { kind: "stand" });
  assert.equal(s.phase, "done");
  s.players.forEach(p => assert.ok(["输", "赢", "平", "黑杰克", "爆"].includes(p.result)));
});

// 她 2026-10-16 选「开局页做个开关」：手机出牌、一圈说一次 / 每人自己想
test("谁来出牌：默认手机出牌，抽鬼牌一律手机；只有选了「每人自己想」才逐手问", () => {
  assert.equal(g.cardLocal({}), true);
  assert.equal(g.cardLocal({ cardBrain: "self" }), false);
  assert.equal(g.cardLocal({ cardBrain: "self" }, "oldmaid"), true);
});

test("一圈说一次：只数别人出的手，她自己的和桌上话不算", () => {
  const log = [{ kind: "move", player: "user", text: "我：过牌" }, { kind: "move", player: "c1", text: "角色1：跟 20" }, { kind: "chat", player: "c1", text: "角色1：“来啊”" }, { kind: "sys", text: "翻牌" }, { kind: "play", player: "c2", text: "角色2 出 红5" }];
  assert.equal(g.cardMovesSince(log, 0), 2);
  assert.equal(g.cardMovesSince(log, 2), 1);
  assert.equal(g.cardSayOf({ text: "角色1：跟 20　“你诈我？”" }), "你诈我？");
  assert.equal(g.cardSayOf({ text: "角色1：跟 20" }), "");
});

test("UNO 手机出牌：整局打完不报错，一手都是合规的", () => {
  const U = require("../js/uno-core.js"); global.UnoCore = U;
  for (let k = 0; k < 10; k++) {
    const s = U.newGame(P(4), undefined, { stackD2: k % 2 === 0 });
    let n = 0; while (s.status === "playing" && n++ < 3000) U.act(s, g.unoLocalMove(s));
    assert.equal(s.status, "finished", "打了三千手还没完");
  }
});

// 她 2026-10-16「都做了宝宝」：斗地主、21 点让 TA 坐庄、德州输的人答真心话
test("斗地主：牌型认得对、压得对", () => {
  const D = s => s.split(" ").map((x, i) => { const v = { J: 11, Q: 12, K: 13, A: 14, "2": 15, SJ: 16, BJ: 17 }[x] || +x; return { v, uid: x + "_" + i, r: x, s: "♠", joker: v > 15 }; });
  const A = s => g.ddzAnalyze(D(s));
  assert.equal(A("3 4 5 6 7").type, "straight");
  assert.equal(A("10 J Q K A 2"), null, "2 不能进顺子");
  assert.equal(A("3 3 4 4 5 5").type, "pairs");
  assert.equal(A("3 3 3 4 4 4 7 9").type, "plane1");
  assert.equal(A("6 6 6 6").type, "bomb");
  assert.equal(A("SJ BJ").type, "rocket");
  assert.ok(g.ddzBeats(A("3 3 3 3"), A("2 2")), "炸弹压对子");
  assert.ok(!g.ddzBeats(A("4 5 6 7 8 9"), A("3 4 5 6 7")), "顺子长度不一样不能压");
  assert.ok(g.ddzBeats(A("SJ BJ"), A("2 2 2 2")));
});

test("斗地主：手机打满五局不出错，分数总和是零", () => {
  for (let k = 0; k < 40; k++) {
    const s = g.ddzNewGame(P(3));
    let n = 0;
    while (s.status === "playing" && n++ < 5000) {
      if (s.phase === "bid") g.ddzBid(s, g.ddzNpcBid(s, s.bidTurn));
      else if (s.phase === "play") g.ddzPlay(s, g.ddzNpcPlay(s, s.turn));
      else g.ddzNewRound(s);
    }
    assert.equal(s.status, "finished");
    assert.equal(s.players.reduce((a, p) => a + p.pts, 0), 0);
  }
});

test("21 点 TA 坐庄：不下注，输赢都走 TA 的筹码，总数不变", () => {
  const s = g.bjNewGame(P(3), undefined, "c1");
  const total = () => s.players.reduce((a, p) => a + p.chips + p.bet, 0);
  const t0 = total();
  assert.equal(s.players.find(p => p.key === "c1").bet, 0);
  let n = 0; while (s.status === "playing" && n++ < 200) { if (s.phase === "play") g.bjAct(s, { kind: "stand" }); else g.bjNewHand(s); }
  assert.equal(s.players.reduce((a, p) => a + p.chips, 0), t0);
});

test("德州真心话：开着的话，一手打完记下谁问谁答", () => {
  const s = g.pkNewGame(P(3)); s.truthOn = true;
  let n = 0; while (s.street !== "done" && n++ < 200) g.pkAct(s, s.players[s.turn].isUser ? { kind: "allin" } : { kind: "call" });
  if (s.truth) { assert.notEqual(s.truth.asker, s.truth.answerer); assert.equal(s.truth.stage, "ask"); }
});

// 她 2026-10-16 截图：一位农民整局 17 张原封不动——队友出牌他一律不接
test("斗地主：两位农民都真的出过牌（队友出小牌会顺掉）", () => {
  let silent = 0, rounds = 0;
  for (let k = 0; k < 40; k++) {
    const s = g.ddzNewGame(P(3));
    let n = 0;
    while (s.status === "playing" && n++ < 5000) {
      if (s.phase === "bid") g.ddzBid(s, g.ddzNpcBid(s, s.bidTurn));
      else if (s.phase === "play") g.ddzPlay(s, g.ddzNpcPlay(s, s.turn));
      else { rounds++; if (s.players.some(p => p.role === "farmer" && p.hand.length === 17)) silent++; g.ddzNewRound(s); }
    }
  }
  assert.ok(silent / rounds < 0.08, "一张没出的农民太多：" + silent + "/" + rounds);
});
