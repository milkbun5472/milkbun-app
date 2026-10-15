// ============================================================
// 俄罗斯方块 · 纯逻辑（她 2026-10-15：「小游戏俄罗斯方块能做吗」→ 先做「你玩 TA 看」和「对战」）
//   方块一直在掉，等模型想一手要好几秒，所以 TA 那块板子由这里的本地棋手下；
//   模型只负责让 TA 说话（games.js 的 TetrisGame）。这一份没有 React、没有 DOM，测试直接跑。
// ============================================================
(function () {
  "use strict";
  const W = 10, H = 20;
  // 七种方块，每种四个朝向（格子坐标，左上为原点，4×4 盒子里）
  const SHAPES = {
    I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
    O: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]],
    T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
    S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
    Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
    J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
    L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]]
  };
  const KINDS = Object.keys(SHAPES);
  const COLORS = { I: "#4fb3c8", O: "#e8b53c", T: "#9a6ab8", S: "#5ea86a", Z: "#d0533f", J: "#4a72c4", L: "#e08a3c", G: "#8d8a84" };

  // 小随机数：一局一个种子，同一局重放得出同样的方块序列
  function rng(seed) { let s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function bag(r) { const a = KINDS.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function emptyBoard() { const b = []; for (let y = 0; y < H; y++) b.push(new Array(W).fill(null)); return b; }
  function cells(p) { return SHAPES[p.k][p.r].map(function (c) { return [p.x + c[0], p.y + c[1]]; }); }
  function fits(board, p) {
    return cells(p).every(function (c) { const x = c[0], y = c[1]; return x >= 0 && x < W && y < H && (y < 0 || !board[y][x]); });
  }
  function newGame(seed) {
    const r = rng(seed || Date.now());
    const g = { board: emptyBoard(), queue: bag(r).concat(bag(r)), cur: null, score: 0, lines: 0, level: 1, over: false, pendingGarbage: 0, _r: r, combo: -1 };
    spawn(g);
    return g;
  }
  function spawn(g) {
    if (g.queue.length < 7) g.queue = g.queue.concat(bag(g._r));
    const k = g.queue.shift();
    g.n = (g.n || 0) + 1;   // 第几块（TA 那块认「换了一块新的」靠它）
    g.cur = { k: k, r: 0, x: 3, y: k === "I" ? -1 : 0 };
    if (!fits(g.board, g.cur)) g.over = true;
    return g.cur;
  }
  function next(g, n) { return g.queue.slice(0, n || 3); }
  function move(g, dx) { if (g.over) return false; const p = Object.assign({}, g.cur, { x: g.cur.x + dx }); if (fits(g.board, p)) { g.cur = p; return true; } return false; }
  // 转：撞墙就左右各踢一格、I 踢两格（够手机上玩，不追 SRS 全套）
  function rotate(g, dir) {
    if (g.over) return false;
    const r = (g.cur.r + (dir || 1) + 4) % 4;
    for (const dx of [0, -1, 1, -2, 2]) { const p = Object.assign({}, g.cur, { r: r, x: g.cur.x + dx }); if (fits(g.board, p)) { g.cur = p; return true; } }
    return false;
  }
  function ghostY(g) { let p = Object.assign({}, g.cur); while (fits(g.board, Object.assign({}, p, { y: p.y + 1 }))) p.y++; return p.y; }
  // 往下一格；落不下去就锁定。返回 { locked, cleared }
  function step(g) {
    if (g.over) return { locked: false, cleared: 0 };
    const p = Object.assign({}, g.cur, { y: g.cur.y + 1 });
    if (fits(g.board, p)) { g.cur = p; return { locked: false, cleared: 0 }; }
    return lock(g);
  }
  function hardDrop(g) { if (g.over) return { locked: false, cleared: 0 }; const d = ghostY(g) - g.cur.y; g.cur.y = ghostY(g); g.score += d * 2; return lock(g); }
  const LINE_SCORE = [0, 100, 300, 500, 800];
  function lock(g) {
    cells(g.cur).forEach(function (c) { if (c[1] >= 0) g.board[c[1]][c[0]] = g.cur.k; else g.over = true; });
    let cleared = 0;
    for (let y = H - 1; y >= 0; y--) {
      if (g.board[y].every(Boolean)) { g.board.splice(y, 1); g.board.unshift(new Array(W).fill(null)); cleared++; y++; }
    }
    if (cleared) { g.lines += cleared; g.score += LINE_SCORE[cleared] * g.level; g.level = 1 + Math.floor(g.lines / 10); g.combo++; } else g.combo = -1;
    // 对面塞过来的垃圾行：落一块之后才往上顶（跟真对战一样，给你这一块的时间）
    if (g.pendingGarbage) { addGarbage(g, g.pendingGarbage); g.pendingGarbage = 0; }
    if (!g.over) spawn(g);
    return { locked: true, cleared: cleared };
  }
  // 消几行给对面塞几行：两行塞一、三行塞二、四行塞四
  function garbageFor(cleared) { return [0, 0, 1, 2, 4][cleared] || 0; }
  function addGarbage(g, n) {
    const hole = Math.floor(g._r() * W);
    for (let i = 0; i < n; i++) {
      if (g.board[0].some(Boolean)) g.over = true;
      g.board.shift();
      const row = new Array(W).fill("G"); row[hole] = null; g.board.push(row);
    }
    if (g.cur && !fits(g.board, g.cur)) { g.cur.y = Math.max(-2, g.cur.y - n); if (!fits(g.board, g.cur)) g.over = true; }
  }
  function stackHeight(board) { for (let y = 0; y < H; y++) if (board[y].some(Boolean)) return H - y; return 0; }

  // ---------- 本地棋手：每种朝向 × 每一列都试一遍，挑分最高的落点 ----------
  //   打分照经典那四项：总高度、消行、空洞、凹凸；level 越低越常「看走眼」（随机挑一个不那么好的）
  function evalBoard(board, cleared) {
    const hs = []; let holes = 0;
    for (let x = 0; x < W; x++) {
      let top = H; for (let y = 0; y < H; y++) if (board[y][x]) { top = y; break; }
      hs.push(H - top);
      for (let y = top + 1; y < H; y++) if (!board[y][x]) holes++;
    }
    let agg = 0, bump = 0; hs.forEach(function (v, i) { agg += v; if (i) bump += Math.abs(v - hs[i - 1]); });
    return -0.51 * agg + 0.76 * cleared - 0.36 * holes - 0.18 * bump;
  }
  function placements(g) {
    const out = [];
    for (let r = 0; r < 4; r++) {
      for (let x = -2; x < W; x++) {
        let p = { k: g.cur.k, r: r, x: x, y: g.cur.k === "I" ? -1 : 0 };
        if (!fits(g.board, p)) { p.y = -2; if (!fits(g.board, p)) continue; }
        while (fits(g.board, Object.assign({}, p, { y: p.y + 1 }))) p.y++;
        const b = g.board.map(function (row) { return row.slice(); });
        let ok = true; cells(p).forEach(function (c) { if (c[1] < 0) ok = false; else b[c[1]][c[0]] = p.k; });
        if (!ok) continue;
        let cl = 0; for (let y = H - 1; y >= 0; y--) if (b[y].every(Boolean)) { b.splice(y, 1); b.unshift(new Array(W).fill(null)); cl++; y++; }
        out.push({ r: r, x: x, score: evalBoard(b, cl), cleared: cl });
      }
    }
    // 同一个落点不同写法（O 的四个朝向）去重
    const seen = {}; return out.filter(function (o) { const k = o.x + "," + o.r % (g.cur.k === "O" ? 1 : 4); if (seen[k]) return false; seen[k] = 1; return true; });
  }
  // skill 0~1：1 永远挑最好；越低越常从前几名里随手挑一个，偶尔干脆乱放
  function bestPlacement(g, skill, rnd) {
    rnd = rnd || Math.random;
    const all = placements(g).sort(function (a, b) { return b.score - a.score; });
    if (!all.length) return null;
    const s = Math.max(0, Math.min(1, skill == null ? 1 : skill));
    if (rnd() < (1 - s) * 0.18) return all[Math.floor(rnd() * all.length)];          // 手滑
    if (rnd() < (1 - s) * 0.7) return all[Math.min(all.length - 1, 1 + Math.floor(rnd() * 3))]; // 看走眼
    return all[0];
  }
  // 往目标落点走一步（转、左右、到了就落）；返回 "rot" | "move" | "drop"
  function stepToward(g, target) {
    if (!target || g.over) return "drop";
    if (g.cur.r !== target.r) { if (rotate(g, 1)) return "rot"; }
    if (g.cur.x < target.x && move(g, 1)) return "move";
    if (g.cur.x > target.x && move(g, -1)) return "move";
    return "drop";
  }
  function gravityMs(level) { return Math.max(90, 800 - (level - 1) * 70); }

  const api = { W, H, SHAPES, KINDS, COLORS, newGame, spawn, next, move, rotate, step, hardDrop, ghostY, cells, fits, garbageFor, addGarbage, stackHeight, placements, bestPlacement, stepToward, gravityMs, evalBoard };
  if (typeof window !== "undefined") window.TetrisCore = api;
  if (typeof module !== "undefined") module.exports = api;
})();
