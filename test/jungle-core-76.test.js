const test = require("node:test"), assert = require("node:assert");
const J = require("../js/jungle-core.js");
const empty = () => { const s = J.newGame(); s.board = s.board.map(r => r.map(() => null)); s.keys = []; return s; };
const tos = (s, f) => J.legalMoves(s, f).map(m => m.to.join(",")).sort();
test("开局：红先，各八子，红方 24 种走法以内", () => {
  const s = J.newGame();
  assert.equal(s.turn, "r");
  assert.equal(s.board.flat().filter(Boolean).length, 16);
  assert.ok(J.legalMoves(s).length > 0);
});
test("只有鼠能下水；狮虎跳河，河里有鼠就跳不过", () => {
  const s = empty();
  s.board[6][1] = "r7"; s.board[6][3] = "r1";
  assert.deepEqual(tos(s, [6, 1]), ["2,1", "6,0", "6,2", "7,1"]);
  s.board[4][1] = "b1";
  assert.deepEqual(tos(s, [6, 1]), ["6,0", "6,2", "7,1"]);
  assert.match(J.whyNot(s, [6, 1], [2, 1]), /鼠挡着/);
  const s2 = empty(); s2.board[3][0] = "r6";
  assert.deepEqual(tos(s2, [3, 0]), ["2,0", "3,3", "4,0"]);
  const s3 = empty(); s3.board[6][5] = "r5";
  assert.ok(!tos(s3, [6, 5]).includes("5,5"));
});
test("大吃小，鼠吃象，象吃不了鼠；陷阱里谁都能吃；水陆互吃不着", () => {
  const s = empty();
  s.board[6][0] = "r1"; s.board[5][0] = "b8";
  assert.ok(tos(s, [6, 0]).includes("5,0"));
  const s2 = empty(); s2.board[6][0] = "r8"; s2.board[5][0] = "b1";
  assert.ok(!tos(s2, [6, 0]).includes("5,0"));
  const s3 = empty(); s3.board[7][2] = "r1"; s3.board[7][3] = "b8";   // 蓝象踩进红家陷阱
  assert.ok(tos(s3, [7, 2]).includes("7,3"));
  const s4 = empty(); s4.board[4][1] = "r1"; s4.board[4][0] = "b2";
  assert.ok(!tos(s4, [4, 1]).includes("4,0"));
});
test("不能进自己的兽穴；进对面兽穴就赢", () => {
  const s = empty(); s.board[7][3] = "r2"; s.board[1][3] = "r3"; s.board[2][2] = "b1";
  assert.ok(!tos(s, [7, 3]).includes("8,3"));
  const s2 = J.move(s, { from: [1, 3], to: [0, 3] });
  assert.deepEqual(J.status(s2), { over: true, result: "r", reason: "den" });
});
test("电脑会一步进穴，困难档几秒内出手", () => {
  const s = empty(); s.board[1][3] = "r3"; s.board[5][0] = "b1";
  const m = J.bestMove(s, "normal");
  assert.deepEqual(m.to, [0, 3]);
  const t0 = Date.now(); const g = J.newGame(); assert.ok(J.bestMove(g, "hard")); assert.ok(Date.now() - t0 < 4000, "hard 太慢：" + (Date.now() - t0));
});
