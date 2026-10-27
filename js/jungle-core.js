// ============================================================
// 斗兽棋 · 纯逻辑（她 2026-10-27「小游戏能做个斗兽棋吗」）
//   走法、胜负、记谱都在这里本地算；模型只负责让 TA 说话（跟象棋 js/xiangqi-core.js 同一个形状）。
//   没有 React、没有 DOM，测试直接跑。
//   棋盘 9 行 × 7 列：board[r][c]，r=0 是蓝方底线，r=8 是红方底线；红先。
//   棋子写成「方 + 数字」：r1 红鼠 … r8 红象；数字越大越厉害，鼠能吃象。
// ============================================================
(function () {
  "use strict";
  const ROWS = 9, COLS = 7;
  const NAME = ["", "鼠", "猫", "狗", "狼", "豹", "虎", "狮", "象"];
  const SIDE_ZH = { r: "红方", b: "蓝方" };
  const DEN = { r: [8, 3], b: [0, 3] };                         // 各自的兽穴
  const TRAPS = { r: [[8, 2], [8, 4], [7, 3]], b: [[0, 2], [0, 4], [1, 3]] };   // 各自家门口的陷阱
  const PIECE_ZH = {};
  ["r", "b"].forEach(function (s) { for (let i = 1; i <= 8; i++) PIECE_ZH[s + i] = NAME[i]; });

  function other(s) { return s === "r" ? "b" : "r"; }
  function inBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function isWater(r, c) { return r >= 3 && r <= 5 && (c === 1 || c === 2 || c === 4 || c === 5); }
  function isDen(r, c) { return c === 3 && (r === 0 || r === 8); }
  function denOf(r, c) { return r === 8 && c === 3 ? "r" : r === 0 && c === 3 ? "b" : ""; }
  function trapOf(r, c) {   // 这格是谁家的陷阱（"" 不是陷阱）
    for (const s of ["r", "b"]) for (const t of TRAPS[s]) if (t[0] === r && t[1] === c) return s;
    return "";
  }
  function rank(p) { return Number(p[1]); }
  function cloneBoard(b) { return b.map(function (row) { return row.slice(); }); }

  function initialBoard() {
    const b = []; for (let r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(null));
    // 蓝方（上）
    b[0][0] = "b7"; b[0][6] = "b6"; b[1][1] = "b3"; b[1][5] = "b2";
    b[2][0] = "b1"; b[2][2] = "b5"; b[2][4] = "b4"; b[2][6] = "b8";
    // 红方（下），中心对称
    b[8][6] = "r7"; b[8][0] = "r6"; b[7][5] = "r3"; b[7][1] = "r2";
    b[6][6] = "r1"; b[6][4] = "r5"; b[6][2] = "r4"; b[6][0] = "r8";
    return b;
  }
  function keyOf(b, turn) { return turn + b.map(function (row) { return row.map(function (p) { return p || "."; }).join(""); }).join("/"); }
  function newGame() { const b = initialBoard(); return { board: b, turn: "r", history: [], keys: [keyOf(b, "r")], quiet: 0 }; }

  // a 能不能吃 d（a 从 from 过来，d 在 to）
  function canCapture(a, from, d, to) {
    if (a[0] === d[0]) return false;
    const ra = rank(a), rd = rank(d);
    const aW = isWater(from[0], from[1]), dW = isWater(to[0], to[1]);
    if (aW !== dW) return false;                      // 水里的鼠和岸上的子互相吃不着
    if (trapOf(to[0], to[1]) === a[0]) return true;   // 掉进我家陷阱的，谁都能吃
    if (ra === 1 && rd === 8) return true;            // 鼠吃象
    if (ra === 8 && rd === 1) return false;           // 象吃不了鼠
    return ra >= rd;
  }
  // 狮虎跳河：沿一条直线跳过整片水，中间水里有任何一只鼠就跳不过去
  function jumpTo(b, r, c, dr, dc) {
    let rr = r + dr, cc = c + dc;
    if (!inBoard(rr, cc) || !isWater(rr, cc)) return null;
    while (inBoard(rr, cc) && isWater(rr, cc)) { if (b[rr][cc]) return { blocked: true }; rr += dr; cc += dc; }
    return inBoard(rr, cc) ? { to: [rr, cc] } : null;
  }
  function pseudoMoves(b, side) {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = b[r][c]; if (!p || p[0] !== side) continue;
      const k = rank(p);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        let to = [r + d[0], c + d[1]], jump = false;
        if (!inBoard(to[0], to[1])) return;
        if (isWater(to[0], to[1])) {
          if (k === 6 || k === 7) { const j = jumpTo(b, r, c, d[0], d[1]); if (!j || j.blocked) return; to = j.to; jump = true; }
          else if (k !== 1) return;
        }
        if (denOf(to[0], to[1]) === side) return;    // 不能进自己的兽穴
        const q = b[to[0]][to[1]];
        if (q && !canCapture(p, [r, c], q, to)) return;
        out.push({ from: [r, c], to: to, piece: p, capture: q || null, jump: jump });
      });
    }
    return out;
  }
  function legalOn(b, side) { return pseudoMoves(b, side); }
  function legalMoves(state, from) {
    const all = legalOn(state.board, state.turn);
    return from ? all.filter(function (m) { return m.from[0] === from[0] && m.from[1] === from[1]; }) : all;
  }
  function doMove(b, m) { const cap = b[m.to[0]][m.to[1]]; b[m.to[0]][m.to[1]] = b[m.from[0]][m.from[1]]; b[m.from[0]][m.from[1]] = null; return cap; }
  function undoMove(b, m, cap) { b[m.from[0]][m.from[1]] = b[m.to[0]][m.to[1]]; b[m.to[0]][m.to[1]] = cap; }

  function move(state, mv) {
    const legal = legalMoves(state, mv.from).find(function (m) { return m.to[0] === mv.to[0] && m.to[1] === mv.to[1]; });
    if (!legal) return state;
    const note = zh(state, legal);
    const board = cloneBoard(state.board); doMove(board, legal);
    const turn = other(state.turn);
    return { board: board, turn: turn, history: state.history.concat([{ mv: legal, zh: note }]), keys: (state.keys || []).concat([keyOf(board, turn)]), quiet: legal.capture ? 0 : (state.quiet || 0) + 1 };
  }

  function denTaken(b) {   // 谁的兽穴被占了 → 占的那方赢
    const a = b[DEN.r[0]][DEN.r[1]], d = b[DEN.b[0]][DEN.b[1]];
    if (a && a[0] === "b") return "b";
    if (d && d[0] === "r") return "r";
    return "";
  }
  function status(state) {
    const w = denTaken(state.board);
    if (w) return { over: true, result: w, reason: "den" };
    let mine = 0; state.board.forEach(function (row) { row.forEach(function (p) { if (p && p[0] === state.turn) mine++; }); });
    if (!mine) return { over: true, result: other(state.turn), reason: "wiped" };
    if (!legalOn(state.board, state.turn).length) return { over: true, result: other(state.turn), reason: "stuck" };
    const keys = state.keys || [], k = keyOf(state.board, state.turn);
    let n = 0; for (const x of keys) if (x === k) n++;
    if (n >= 3) return { over: true, result: "draw", reason: "repetition" };
    if ((state.quiet || 0) >= 100) return { over: true, result: "draw", reason: "nocapture" };
    return { over: false, result: null, reason: null };
  }

  // ---------- 记谱 ----------
  function dirZh(side, m) {
    const fwd = side === "r" ? m.from[0] - m.to[0] : m.to[0] - m.from[0];
    const side2 = side === "r" ? m.to[1] - m.from[1] : m.from[1] - m.to[1];
    if (fwd > 0) return "往前";
    if (fwd < 0) return "往回";
    return side2 > 0 ? "往右" : "往左";
  }
  function zh(state, mv) {
    const p = state.board[mv.from[0]][mv.from[1]] || mv.piece, side = p[0];
    const cap = state.board[mv.to[0]][mv.to[1]];
    const den = denOf(mv.to[0], mv.to[1]);
    return (side === "r" ? "红" : "蓝") + NAME[rank(p)] + (mv.jump ? "跳河" : "") + dirZh(side, mv) + (cap ? "吃" + NAME[rank(cap)] : "") + (den ? "进兽穴" : "");
  }
  function zhPlain(state, mv) {
    const p = state.board[mv.from[0]][mv.from[1]] || mv.piece, side = p[0];
    const cap = state.board[mv.to[0]][mv.to[1]];
    let s = SIDE_ZH[side] + "的" + NAME[rank(p)] + (mv.jump ? "跳过河" : isWater(mv.to[0], mv.to[1]) && !isWater(mv.from[0], mv.from[1]) ? "下水" : !isWater(mv.to[0], mv.to[1]) && isWater(mv.from[0], mv.from[1]) ? "上岸" : "") + dirZh(side, mv) + "走一格";
    if (cap) s += "，吃掉" + SIDE_ZH[cap[0]] + "的" + NAME[rank(cap)];
    const tr = trapOf(mv.to[0], mv.to[1]);
    if (tr && tr !== side) s += "，踩进了对面的陷阱";
    if (denOf(mv.to[0], mv.to[1]) === other(side)) s += "，进了对面的兽穴";
    return s;
  }

  // ---------- 本地棋手 ----------
  const VAL = [0, 450, 200, 250, 300, 400, 800, 900, 1000];
  function dist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
  function evaluate(b, side) {
    let s = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = b[r][c]; if (!p) continue;
      const k = rank(p), me = p[0], foe = other(me), d = dist([r, c], DEN[foe]);
      let v = VAL[k] + (12 - d) * (k >= 6 ? 6 : 4);          // 往对面兽穴靠
      if (trapOf(r, c) === foe) v += 40;                     // 踩在对面家门口
      if (trapOf(r, c) === me) v -= 20;
      if (d === 1) v += 300;                                 // 贴着对面兽穴，下一步就赢
      // 自己家门口有对面的子：要命
      if (dist([r, c], DEN[me]) <= 2) v += 15;
      s += me === side ? v : -v;
    }
    return s;
  }
  function order(ms) {
    return ms.sort(function (a, b) {
      const sa = (a.capture ? VAL[rank(a.capture)] * 10 - VAL[rank(a.piece)] : -1e9) + (isDen(a.to[0], a.to[1]) ? 1e12 : 0);
      const sb = (b.capture ? VAL[rank(b.capture)] * 10 - VAL[rank(b.piece)] : -1e9) + (isDen(b.to[0], b.to[1]) ? 1e12 : 0);
      return sb - sa;
    });
  }
  const WIN = 100000;
  function search(b, side, depth, alpha, beta, ply) {
    const w = denTaken(b);
    if (w) return w === side ? WIN - ply : -WIN + ply;
    if (depth === 0) return evaluate(b, side);
    const ms = order(legalOn(b, side));
    if (!ms.length) return -WIN + ply;
    for (const m of ms) {
      const cap = doMove(b, m);
      const v = -search(b, other(side), depth - 1, -beta, -alpha, ply + 1);
      undoMove(b, m, cap);
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return alpha;
  }
  // 下棋风格：同一档水平里在差不多好的几步中往自己的路子偏（跟象棋同一套四种）
  function styleBonus(b, side, m, style) {
    if (!style) return 0;
    const k = rank(m.piece), foeDen = DEN[other(side)], closer = dist(m.from, foeDen) - dist(m.to, foeDen);
    let v = 0;
    if (style === "attack") { v += closer * 12; if (m.capture) v += 15; }
    else if (style === "solid") { v -= closer * 6; if (dist(m.to, DEN[side]) <= 2) v += 12; if (k >= 6 && closer > 0) v -= 10; }
    else if (style === "trade") { if (m.capture) v += Math.abs(VAL[rank(m.capture)] - VAL[k]) <= 100 ? 45 : 10; }
    else if (style === "wild") { v += (Math.random() - 0.5) * 80; if (m.jump) v += 15; }
    return v;
  }
  function bestMove(state, level, style) {
    const b = cloneBoard(state.board), side = state.turn;
    const ms = legalOn(b, side);
    if (!ms.length) return null;
    const win = ms.find(function (m) { return denOf(m.to[0], m.to[1]) === other(side); });
    if (win && level !== "easy") return win;
    if (level === "easy") {
      if (Math.random() < (style ? 0.45 : 0.6)) {
        const caps = ms.filter(function (m) { return m.capture; });
        if (caps.length && Math.random() < 0.7) return caps[Math.floor(Math.random() * caps.length)];
        return ms[Math.floor(Math.random() * ms.length)];
      }
      level = "shallow";
    }
    const depth = level === "hard" ? 4 : level === "shallow" ? 2 : 3;
    order(ms);
    let best = [], bestV = -Infinity, alpha = -Infinity;
    for (const m of ms) {
      const sb = styleBonus(b, side, m, style);
      const cap = doMove(b, m);
      const v = (style ? -search(b, other(side), depth - 1, -Infinity, Infinity, 1) : -search(b, other(side), depth - 1, -Infinity, -alpha + 1, 1)) + sb;
      undoMove(b, m, cap);
      if (v > bestV) { bestV = v; best = [m]; if (v > alpha) alpha = v; }
      else if (v === bestV) best.push(m);
    }
    return best[Math.floor(Math.random() * best.length)];
  }

  // 为什么这一步不能走：点了走不过去的格子时给一句人话
  function whyNot(state, from, to) {
    const b = state.board, p = b[from[0]][from[1]];
    if (!p || p[0] !== state.turn) return "";
    const k = rank(p), nm = NAME[k];
    const dr = to[0] - from[0], dc = to[1] - from[1];
    if (denOf(to[0], to[1]) === p[0]) return "不能进自己的兽穴";
    if (isWater(to[0], to[1]) && k !== 1) return "只有鼠能下水" + (k === 6 || k === 7 ? "，" + nm + "得隔着整片河跳过去" : "");
    if (Math.abs(dr) + Math.abs(dc) !== 1) {
      if ((k === 6 || k === 7) && (dr === 0 || dc === 0)) {
        const j = jumpTo(b, from[0], from[1], Math.sign(dr), Math.sign(dc));
        if (j && j.blocked) return "河里有鼠挡着，" + nm + "跳不过去";
      }
      return "一次只能横着或竖着走一格";
    }
    const q = b[to[0]][to[1]];
    if (q && q[0] !== p[0]) {
      const aW = isWater(from[0], from[1]), dW = isWater(to[0], to[1]);
      if (aW && !dW) return "鼠从水里出来不能直接吃岸上的子";
      if (!aW && dW) return "吃不着水里的鼠";
      if (k === 8 && rank(q) === 1) return "象吃不了鼠";
      if (rank(q) > k) return NAME[rank(q)] + "比" + nm + "大，吃不动" + (trapOf(to[0], to[1]) === p[0] ? "" : "（它要是掉进你家陷阱就能吃）");
    }
    return "";
  }
  // 整盘摆给模型看
  function boardText(state) {
    const rows = [];
    for (let r = 0; r < ROWS; r++) rows.push(state.board[r].map(function (p, c) {
      if (p) return (p[0] === "r" ? "红" : "蓝") + NAME[rank(p)];
      if (isDen(r, c)) return "穴";
      if (trapOf(r, c)) return "阱";
      if (isWater(r, c)) return "水";
      return "··";
    }).join(" "));
    return "上面是蓝方，下面是红方（穴＝兽穴，阱＝陷阱，水＝河）：\n" + rows.join("\n");
  }
  function serialize(state) { return JSON.parse(JSON.stringify({ board: state.board, turn: state.turn, history: state.history, keys: state.keys || [], quiet: state.quiet || 0 })); }
  function deserialize(obj) {
    const o = JSON.parse(JSON.stringify(obj || {}));
    if (!o.board) return newGame();
    return { board: o.board, turn: o.turn === "b" ? "b" : "r", history: o.history || [], keys: o.keys || [keyOf(o.board, o.turn)], quiet: o.quiet || 0 };
  }
  const api = { ROWS, COLS, NAME, PIECE_ZH, STYLES: ["attack", "solid", "trade", "wild"], isWater, isDen, denOf, trapOf, rank,
    newGame, legalMoves, move, status, bestMove, zh, zhPlain, whyNot, boardText, serialize, deserialize, evaluate };
  if (typeof window !== "undefined") window.JungleCore = api;
  if (typeof module !== "undefined") module.exports = api;
})();
