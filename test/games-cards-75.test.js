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
