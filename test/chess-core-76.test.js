// 国际象棋纯逻辑：perft、胜负、特殊走法、棋手
const assert = require("node:assert/strict");
const C = require("../js/chess-core.js");

function perft(s, d) {
  if (d === 0) return 1;
  const ms = C.legalMoves(s);
  if (d === 1) return ms.length;
  let n = 0;
  for (const m of ms) n += perft(C.move(s, m), d - 1);
  return n;
}
const sq = (a) => [8 - +a[1], "abcdefgh".indexOf(a[0])];
const play = (s, f, t, promo) => C.move(s, { from: sq(f), to: sq(t), promo });
const has = (s, f, t) => C.legalMoves(s).some((m) => m.from + "" === sq(f) + "" && m.to + "" === sq(t) + "");

const start = C.newGame();
assert.equal(perft(start, 1), 20);
assert.equal(perft(start, 2), 400);
assert.equal(perft(start, 3), 8902);
const kiwi = C.fromFEN("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
assert.equal(perft(kiwi, 1), 48);
assert.equal(perft(kiwi, 2), 2039);
assert.equal(C.toFEN(kiwi), "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");

// 愚人杀
let g = start;
g = play(g, "f2", "f3"); g = play(g, "e7", "e5"); g = play(g, "g2", "g4");
assert.equal(C.san(g, C.legalMoves(g).find((m) => m.to + "" === sq("h4") + "" && m.piece === "bQ")), "Qh4#");
g = play(g, "d8", "h4");
assert.deepEqual(C.status(g), { check: true, over: true, result: "b", reason: "checkmate" });
assert.equal(g.history[3].san, "Qh4#");

// 逼和
const st = C.status(C.fromFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"));
assert.equal(st.over, true); assert.equal(st.reason, "stalemate"); assert.equal(st.result, "draw");

// 吃过路兵
let e = C.fromFEN("4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1");
e = play(e, "d7", "d5");
assert.ok(has(e, "e5", "d6"));
const epm = C.legalMoves(e).find((m) => m.ep);
assert.equal(C.san(e, epm), "exd6");
assert.match(C.zh(e, epm), /白方兵 e5→d6 吃掉黑方兵/);
e = C.move(e, epm);
assert.equal(e.board[3][3], null);

// 升变
const pr = C.fromFEN("4k3/1P6/8/8/8/8/8/4K3 w - - 0 1");
assert.equal(C.legalMoves(pr).filter((m) => m.promo).length, 4);
const pm = C.legalMoves(pr).find((m) => m.promo === "q");
assert.equal(C.san(pr, pm), "b8=Q+");
assert.equal(C.move(pr, { from: sq("b7"), to: sq("b8") }).board[0][1], "wQ");
assert.equal(C.move(pr, { from: sq("b7"), to: sq("b8"), promo: "n" }).board[0][1], "wN");

// 易位：路过被攻击的格不行
const cs = C.fromFEN("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1");
assert.ok(!C.legalMoves(cs).some((m) => m.castle === "K"));
const cs2 = C.fromFEN("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
const ck = C.legalMoves(cs2).find((m) => m.castle === "K");
assert.equal(C.san(cs2, ck), "O-O");
assert.equal(C.zh(cs2, ck), "白方短易位");
assert.equal(C.zh(start, { from: sq("g1"), to: sq("f3"), piece: "wN", capture: null }), "白方马 g1→f3");

// 三次重复
let rp = start;
for (let i = 0; i < 2; i++) { rp = play(rp, "g1", "f3"); rp = play(rp, "g8", "f6"); rp = play(rp, "f3", "g1"); rp = play(rp, "f6", "g8"); }
rp = play(rp, "g1", "f3"); rp = play(rp, "g8", "f6"); rp = play(rp, "f3", "g1"); rp = play(rp, "f6", "g8");
assert.equal(C.status(rp).reason, "repetition");

// 不变性
const before = C.toFEN(start); C.move(start, C.legalMoves(start)[0]); assert.equal(C.toFEN(start), before);

// 棋手
for (const lv of ["easy", "normal", "hard"]) {
  const m = C.bestMove(start, lv);
  assert.ok(C.legalMoves(start).some((x) => x.from + "" === m.from + "" && x.to + "" === m.to + ""), lv);
}
const hang = C.fromFEN("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1");
const hm = C.bestMove(hang, "normal");
assert.deepEqual(hm.to, sq("d5"));
const t0 = Date.now(); C.bestMove(start, "hard"); const dt = Date.now() - t0;
assert.ok(dt < 2000, "hard took " + dt + "ms");
const mid = C.fromFEN("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4");
const t1 = Date.now(); C.bestMove(mid, "hard"); console.log("hard start " + dt + "ms, midgame " + (Date.now() - t1) + "ms");
console.log("ok");
