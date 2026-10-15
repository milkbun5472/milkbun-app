// 她 2026-10-15：俄罗斯方块——你玩 TA 看 / 对战（TA 那块本地棋手下，模型只管说话）
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../js/tetris-core.js");
const g = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "games.js"), "utf8");
test("落块、消行、计分", () => {
  const s = T.newGame(1);
  for (let x = 0; x < T.W; x++) if (x < 6) s.board[T.H - 1][x] = "G";
  s.cur = { k: "I", r: 0, x: 6, y: -1 };
  // I 横着只有 4 格，放进最右边四格正好补满最后一行
  const r = T.hardDrop(s);
  assert.equal(r.cleared, 1); assert.equal(s.lines, 1); assert.ok(s.score >= 100);
});
test("垃圾行：消两行塞一、四行塞四；落一块之后才顶上来", () => {
  assert.deepEqual([1, 2, 3, 4].map(T.garbageFor), [0, 1, 2, 4]);
  const s = T.newGame(2); s.pendingGarbage = 2; T.hardDrop(s);
  assert.equal(s.board[T.H - 1].filter(Boolean).length, T.W - 1, "最底下一行是带一个缺口的垃圾行");
});
test("本地棋手：高手比新手活得久、消得多", () => {
  const run = sk => { let tot = 0; for (let k = 1; k <= 3; k++) { const s = T.newGame(k); let n = 0; const r = (() => { let v = k * 99; return () => ((v = (v * 9301 + 49297) % 233280) / 233280); })();
    while (!s.over && n < 300) { const p = T.bestPlacement(s, sk, r); while (T.stepToward(s, p) !== "drop") {} T.hardDrop(s); n++; } tot += s.lines; } return tot; };
  assert.ok(run(0.97) > run(0.55));
});
test("游戏接上了：开局页两种玩法、路由、TA 只在关键时刻说话", () => {
  assert.match(g, /\{ key: "watch", zh: "你玩 TA 看" \}, \{ key: "versus", zh: "对战" \}/);
  assert.match(g, /session\.game\.key === "tetris" && window\.TetrisCore\) return h\(TetrisGame/);
  assert.match(g, /now - lastTalk\.current < 12000/);
  assert.match(g, /T\.garbageFor\(res\.cleared\)/);
});
