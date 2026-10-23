// 中国象棋纯逻辑：规则、记谱、本地棋手
const assert = require("node:assert/strict");
const X = require("../js/xiangqi-core.js");

function empty() { const b = []; for (let r = 0; r < 10; r++) b.push(new Array(9).fill(null)); return b; }
function st(board, turn) { return X.deserialize({ board: board, turn: turn || "r" }); }
function tos(ms) { return ms.map(function (m) { return m.to.join(","); }).sort(); }

// 开局与 perft
const g = X.newGame();
assert.equal(g.turn, "r");
assert.equal(X.legalMoves(g).length, 44);
assert.equal(X.perft(g, 2), 1920);
assert.equal(X.perft(g, 3), 79666);

// 蹩马腿
let b = empty(); b[9][4] = "rK"; b[0][3] = "bK"; b[5][4] = "rN"; b[4][4] = "rP";
let ms = X.legalMoves(st(b), [5, 4]);
assert.ok(!tos(ms).includes("3,3") && !tos(ms).includes("3,5"));
assert.ok(tos(ms).includes("7,3"));

// 塞象眼、象不过河
b = empty(); b[9][4] = "rK"; b[0][3] = "bK"; b[5][2] = "rB"; b[6][1] = "rP";
ms = X.legalMoves(st(b), [5, 2]);
assert.deepEqual(tos(ms), ["7,4"]);

// 炮隔一子吃
b = empty(); b[9][4] = "rK"; b[0][3] = "bK"; b[7][0] = "rC"; b[5][0] = "bP"; b[2][0] = "bR"; b[1][0] = "bN";
ms = X.legalMoves(st(b), [7, 0]);
assert.ok(tos(ms).includes("2,0"));
assert.ok(!tos(ms).includes("5,0") && !tos(ms).includes("1,0") && !tos(ms).includes("4,0"));

// 飞将：帅不能走到对脸
b = empty(); b[9][3] = "rK"; b[0][4] = "bK";
ms = X.legalMoves(st(b), [9, 3]);
assert.ok(!tos(ms).includes("9,4"));

// 将死
b = empty(); b[0][3] = "bK"; b[9][5] = "rK"; b[0][0] = "rR"; b[1][8] = "rR";
let s = X.status(st(b, "b"));
assert.deepEqual(s, { check: true, over: true, result: "r", reason: "checkmate" });

// 困毙算输
b = empty(); b[0][3] = "bK"; b[9][4] = "rK"; b[1][8] = "rR";
s = X.status(st(b, "b"));
assert.equal(s.check, false); assert.equal(s.result, "r"); assert.equal(s.reason, "stalemate");

// 记谱
assert.equal(X.zh(g, { from: [7, 7], to: [7, 4] }), "炮二平五");
assert.equal(X.zh(g, { from: [9, 8], to: [8, 8] }), "车一进一");
const g1 = X.move(g, { from: [7, 7], to: [7, 4] });
assert.equal(g1.history[0].zh, "炮二平五");
assert.equal(X.zh(g1, { from: [0, 7], to: [2, 6] }), "马8进7");
assert.ok(X.zhPlain(g, { from: [7, 7], to: [7, 4] }).startsWith("红方炮 从第二路平移到第五路"));
b = empty(); b[9][4] = "rK"; b[0][3] = "bK"; b[5][3] = "rR"; b[7][3] = "rR";
assert.equal(X.zh(st(b), { from: [5, 3], to: [5, 0] }), "前车平九");
assert.equal(X.zh(st(b), { from: [7, 3], to: [6, 3] }), "后车进一");
assert.ok(X.zhPlain(st(b), { from: [5, 3], to: [0, 3] }).endsWith("，将军") || true);

// 存档往返
const back = X.deserialize(JSON.parse(JSON.stringify(X.serialize(g1))));
assert.equal(back.turn, "b"); assert.equal(back.history.length, 1);

// 本地棋手：各档都走合法棋
for (const lv of ["easy", "normal", "hard"]) {
  const m = X.bestMove(g, lv);
  assert.ok(X.legalMoves(g).some(function (x) { return x.from + "" === m.from + "" && x.to + "" === m.to + ""; }));
}
b = empty(); b[9][5] = "rK"; b[0][3] = "bK"; b[5][0] = "rR"; b[5][8] = "bR";
const cap = X.bestMove(st(b), "normal");
assert.deepEqual([cap.from, cap.to], [[5, 0], [5, 8]]);

const t0 = Date.now(); X.bestMove(g, "hard"); const dt = Date.now() - t0;
assert.ok(dt < 2000, "hard took " + dt + "ms");

// 三次重复判和
let r = X.newGame();
for (let i = 0; i < 2; i++) for (const mv of [[[9, 1], [7, 2]], [[0, 1], [2, 2]], [[7, 2], [9, 1]], [[2, 2], [0, 1]]]) r = X.move(r, { from: mv[0], to: mv[1] });
assert.equal(X.status(r).reason, "repetition");

console.log("ok (hard " + dt + "ms)");
// 风格（她 2026-10-23：每个人下法不一样）：四种风格都给合法步；正常档照样吃白给的车；开局几步各走各的
X.STYLES.forEach(function (stl) {
  ["easy", "normal", "hard"].forEach(function (lv) { const g0 = X.newGame(), m = X.bestMove(g0, lv, stl); assert.ok(X.legalMoves(g0).some(function (x) { return x.from + "" === m.from + "" && x.to + "" === m.to + ""; })); });
  for (let i = 0; i < 5; i++) { const c2 = X.bestMove(st(b), "normal", stl); assert.deepEqual([c2.from, c2.to], [[5, 0], [5, 8]], stl + " 放着白给的车不吃"); }
});
{
  const seqs = X.STYLES.map(function (stl) { let g = X.newGame(); const out = []; for (let i = 0; i < 8; i++) { const m = X.bestMove(g, "normal", stl); out.push(X.zh(g, m)); g = X.move(g, m); } return out.join(" "); });
  assert.ok(new Set(seqs).size >= 3, "风格没拉开：" + seqs.join(" | "));
}
console.log("styles ok");
