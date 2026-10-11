const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const i = src.indexOf("  const GMK_N = 15;"), j = src.indexOf("  function GomokuGame(props) {");
const E = new Function(src.slice(i, j) + "\nreturn { gmkEmpty, gmkWins, gmkBestMove, gmkThreat, GMK_N };")();

// 她 2026-10-11：「先做五子棋吧」——落子归代码里的棋手，TA 只说话
const put = (b, list, who) => { list.forEach(([x, y]) => { b[y * E.GMK_N + x] = who; }); return b; };

test("连五才算赢，四颗不算", () => {
  const b = put(E.gmkEmpty(), [[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]], 1);
  assert.ok(E.gmkWins(b, 7, 7, 1));
  const b2 = put(E.gmkEmpty(), [[3, 7], [4, 7], [5, 7], [6, 7]], 1);
  assert.ok(!E.gmkWins(b2, 6, 7, 1));
  const b3 = put(E.gmkEmpty(), [[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]], 2);
  assert.ok(E.gmkWins(b3, 4, 4, 2), "斜线也算");
});

test("棋手：能赢先赢，对面要成五一定挡——放水局也挡", () => {
  const win = put(put(E.gmkEmpty(), [[3, 7], [4, 7], [5, 7], [6, 7]], 2), [[3, 8], [4, 8], [5, 8]], 1);
  const m = E.gmkBestMove(win, 2, false);
  assert.ok((m.x === 7 || m.x === 2) && m.y === 7, "没抓住自己的五连");
  const block = put(put(E.gmkEmpty(), [[3, 7], [4, 7], [5, 7], [6, 7]], 1), [[2, 7]], 2);
  for (let k = 0; k < 20; k++) {
    const d = E.gmkBestMove(block, 2, true);
    assert.ok(d.x === 7 && d.y === 7, "放水局放跑了对面的五连");
  }
});

test("空棋盘第一手下天元", () => {
  const m = E.gmkBestMove(E.gmkEmpty(), 1, false);
  assert.deepEqual([m.x, m.y], [7, 7]);
});

test("接进游戏架；TA 开口走模型，落子不走", () => {
  assert.match(src, /\{ key: "gomoku", emoji: "⚫", zh: "五子棋"/);
  assert.match(src, /if \(session\.game\.key === "gomoku"\) return h\(GomokuGame, engineProps\);/);
  const g = src.slice(j, src.indexOf("  function UnoGame(props) {"));
  assert.equal((g.match(/callRetry\(/g) || []).length, 1, "只有说话那一处调模型");
  assert.match(g, /const m = gmkBestMove\(board, turn,/, "落子没走本地棋手");
  assert.match(g, /saveGameSnap\("gomoku"/, "没存档");
});
