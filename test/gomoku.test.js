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
  const g = src.slice(j, src.indexOf("  const DRAW_POOL_KEY"));
  assert.equal((g.match(/callRetry\(/g) || []).length, 1, "只有说话那一处调模型");
  assert.match(g, /const m = gmkBestMove\(board, turn,/, "落子没走本地棋手");
  assert.match(g, /saveGameSnap\("gomoku"/, "没存档");
});

// 她 2026-10-11：「观战不能两个角色吗」「要分认真随手」
test("观战：两个角色对下，各自认真/随手，一回调用写两个人", () => {
  const g = src.slice(j, src.indexOf("  const DRAW_POOL_KEY"));
  assert.match(g, /const char2 = spectate \? findC\(\(cfg\.charIds \|\| \[\]\)\[1\]\) : null;/);
  assert.match(g, /return \(c && cfg\.gmkCasual && cfg\.gmkCasual\[c\.id\]\) \? 1 : 0;/, "认真/随手没接到落子");
  assert.match(g, /const m = gmkBestMove\(board, turn, level\(turn\)\);/);
  assert.match(g, /\{\\"talks\\":\[\{\\"name\\"/, "两个人说话不是一回调用");
  assert.match(src, /gmkCasual: game\.key === "gomoku" \? gmkCasual : undefined/, "开局没把认真/随手交出去");
  assert.match(src, /"data-wk": "gomokustrength"/);
});

// 她 2026-10-11：「电脑会不会根据聊天改变策略」——TA 开口时报的下法，从下一手起生效
test("下法跟着聊天变：TA 报 play 就换；让着也照挡对面的五连", () => {
  const g = src.slice(j, src.indexOf("  const DRAW_POOL_KEY"));
  assert.match(g, /const PLAY_ZH = \["认真", "随手", "让着"\];/);
  assert.match(g, /if \(c && playOv\[c\.id\] != null\) return playOv\[c\.id\];/, "TA 报的下法没压过开局设置");
  assert.match(g, /playOv: playOv,/, "换过的下法没进存档");
  const block = put(put(E.gmkEmpty(), [[3, 7], [4, 7], [5, 7], [6, 7]], 1), [[2, 7]], 2);
  for (let k = 0; k < 20; k++) {
    const d = E.gmkBestMove(block, 2, 2);
    assert.ok(d.x === 7 && d.y === 7, "让着的时候把五连直接送出去了");
  }
});

// 她 2026-10-11：「为什么我不能聊天，不是应该我来决定他什么时候说话吗」「为什么这么凶而且一直车轱辘」
test("TA 什么时候开口由她定；说过的话递回去，别车轱辘", () => {
  const g = src.slice(j, src.indexOf("  const DRAW_POOL_KEY"));
  assert.equal((g.match(/\bsay\(/g) || []).length, 1, "落子、悔棋、开局又在自动替 TA 开口了（只许她那一行触发）");
  assert.match(g, /"data-wk": "gomokuchat"/, "没有跟 TA 说话的那一行");
  assert.match(g, /【你们刚才已经说过的】/, "说过的话没递回去");
  assert.ok(g.indexOf("得意、嘴硬、耍赖") < 0, "又把一串语气当成默认递过去了");
});
