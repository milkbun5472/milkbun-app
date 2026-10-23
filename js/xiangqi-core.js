// ============================================================
// 中国象棋 · 纯逻辑
//   走法、胜负、记谱都在这里本地算；模型只负责让 TA 说话。
//   没有 React、没有 DOM，测试直接跑。
//   棋盘 10 行 × 9 列：board[r][c]，r=0 是黑方底线，r=9 是红方底线；红先。
// ============================================================
(function () {
  "use strict";
  const ROWS = 10, COLS = 9;
  const PIECE_ZH = {
    rK: "帅", rA: "仕", rB: "相", rN: "马", rR: "车", rC: "炮", rP: "兵",
    bK: "将", bA: "士", bB: "象", bN: "马", bR: "车", bC: "炮", bP: "卒"
  };
  const CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const SIDE_ZH = { r: "红方", b: "黑方" };

  function other(s) { return s === "r" ? "b" : "r"; }
  function inBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function inPalace(side, r, c) { return c >= 3 && c <= 5 && (side === "r" ? r >= 7 && r <= 9 : r >= 0 && r <= 2); }
  function ownHalf(side, r) { return side === "r" ? r >= 5 : r <= 4; }
  function cloneBoard(b) { return b.map(function (row) { return row.slice(); }); }

  function initialBoard() {
    const b = []; for (let r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(null));
    const back = ["R", "N", "B", "A", "K", "A", "B", "N", "R"];
    for (let c = 0; c < COLS; c++) { b[0][c] = "b" + back[c]; b[9][c] = "r" + back[c]; }
    b[2][1] = b[2][7] = "bC"; b[7][1] = b[7][7] = "rC";
    for (let c = 0; c < COLS; c += 2) { b[3][c] = "bP"; b[6][c] = "rP"; }
    return b;
  }
  function keyOf(board, turn) {
    let s = turn;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) s += board[r][c] ? board[r][c] : ".";
    return s;
  }
  function newGame() {
    const board = initialBoard();
    return { board: board, turn: "r", history: [], keys: [keyOf(board, "r")], quiet: 0 };
  }

  // ---------- 走法生成（伪合法：不管自己将帅安危） ----------
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const HORSE = [[-2, -1, -1, 0], [-2, 1, -1, 0], [2, -1, 1, 0], [2, 1, 1, 0], [-1, -2, 0, -1], [1, -2, 0, -1], [-1, 2, 0, 1], [1, 2, 0, 1]];

  function pieceMoves(b, r, c, out) {
    const p = b[r][c], side = p[0], t = p[1];
    function add(tr, tc) {
      const q = b[tr][tc];
      if (q && q[0] === side) return;
      out.push({ from: [r, c], to: [tr, tc], piece: p, capture: q || null });
    }
    if (t === "K") {
      ORTH.forEach(function (d) { const tr = r + d[0], tc = c + d[1]; if (inPalace(side, tr, tc)) add(tr, tc); });
    } else if (t === "A") {
      DIAG.forEach(function (d) { const tr = r + d[0], tc = c + d[1]; if (inPalace(side, tr, tc)) add(tr, tc); });
    } else if (t === "B") {
      DIAG.forEach(function (d) {
        const tr = r + 2 * d[0], tc = c + 2 * d[1];
        if (inBoard(tr, tc) && ownHalf(side, tr) && !b[r + d[0]][c + d[1]]) add(tr, tc); // 塞象眼
      });
    } else if (t === "N") {
      HORSE.forEach(function (h) {
        const tr = r + h[0], tc = c + h[1];
        if (inBoard(tr, tc) && !b[r + h[2]][c + h[3]]) add(tr, tc); // 蹩马腿
      });
    } else if (t === "R" || t === "C") {
      ORTH.forEach(function (d) {
        let tr = r + d[0], tc = c + d[1], jumped = false;
        while (inBoard(tr, tc)) {
          const q = b[tr][tc];
          if (!jumped) {
            if (!q) add(tr, tc);
            else if (t === "R") { add(tr, tc); break; }
            else jumped = true; // 炮架
          } else if (q) { add(tr, tc); break; }
          tr += d[0]; tc += d[1];
        }
      });
    } else if (t === "P") {
      const f = side === "r" ? -1 : 1;
      if (inBoard(r + f, c)) add(r + f, c);
      if (!ownHalf(side, r)) { if (c > 0) add(r, c - 1); if (c < 8) add(r, c + 1); }
    }
  }
  function pseudoMoves(b, side) {
    const out = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = b[r][c]; if (p && p[0] === side) pieceMoves(b, r, c, out); }
    return out;
  }
  function findKing(b, side) {
    const k = side + "K";
    for (let r = 0; r < ROWS; r++) for (let c = 3; c <= 5; c++) if (b[r][c] === k) return [r, c];
    return null;
  }
  // side 的将帅是否被攻击（含飞将对脸）
  function attacked(b, side) {
    const k = findKing(b, side); if (!k) return true;
    const kr = k[0], kc = k[1], o = other(side);
    // 车/炮/对面将 沿直线
    for (let i = 0; i < 4; i++) {
      const d = ORTH[i]; let tr = kr + d[0], tc = kc + d[1], screens = 0;
      while (inBoard(tr, tc)) {
        const q = b[tr][tc];
        if (q) {
          if (screens === 0) {
            if (q[0] === o && (q[1] === "R" || (q[1] === "K" && d[1] === 0))) return true;
            screens = 1;
          } else { if (q[0] === o && q[1] === "C") return true; break; }
        }
        tr += d[0]; tc += d[1];
      }
    }
    // 马：从马的位置看，马腿在马旁边
    for (let i = 0; i < 8; i++) {
      const h = HORSE[i], nr = kr - h[0], nc = kc - h[1];
      if (inBoard(nr, nc) && b[nr][nc] === o + "N" && !b[nr + h[2]][nc + h[3]]) return true;
    }
    // 兵卒
    const f = o === "r" ? 1 : -1; // 对方兵从 kr+f 处往前走到 kr
    if (inBoard(kr + f, kc) && b[kr + f][kc] === o + "P") return true;
    for (const dc of [-1, 1]) {
      const pc = kc + dc;
      if (inBoard(kr, pc) && b[kr][pc] === o + "P" && !ownHalf(o, kr)) return true;
    }
    return false;
  }
  function doMove(b, m) { const cap = b[m.to[0]][m.to[1]]; b[m.to[0]][m.to[1]] = b[m.from[0]][m.from[1]]; b[m.from[0]][m.from[1]] = null; return cap; }
  function undoMove(b, m, cap) { b[m.from[0]][m.from[1]] = b[m.to[0]][m.to[1]]; b[m.to[0]][m.to[1]] = cap; }
  function legalOn(b, side) {
    const ps = pseudoMoves(b, side), out = [];
    for (const m of ps) { const cap = doMove(b, m); if (!attacked(b, side)) out.push(m); undoMove(b, m, cap); }
    return out;
  }

  function legalMoves(state, from) {
    const b = cloneBoard(state.board);
    let ms = legalOn(b, state.turn);
    if (from) ms = ms.filter(function (m) { return m.from[0] === from[0] && m.from[1] === from[1]; });
    return ms;
  }
  function sameMove(a, m) { return a.from[0] === m.from[0] && a.from[1] === m.from[1] && a.to[0] === m.to[0] && a.to[1] === m.to[1]; }

  function move(state, mv) {
    const legal = legalMoves(state).find(function (m) { return sameMove(m, mv); });
    if (!legal) throw new Error("illegal move");
    const note = zh(state, legal);
    const board = cloneBoard(state.board); doMove(board, legal);
    const turn = other(state.turn);
    return {
      board: board, turn: turn,
      history: state.history.concat([{ mv: legal, zh: note }]),
      keys: (state.keys || []).concat([keyOf(board, turn)]),
      quiet: legal.capture ? 0 : (state.quiet || 0) + 1
    };
  }

  function status(state) {
    const check = attacked(state.board, state.turn);
    const any = legalOn(cloneBoard(state.board), state.turn).length > 0;
    if (!any) return { check: check, over: true, result: other(state.turn), reason: check ? "checkmate" : "stalemate" }; // 困毙也算输
    const keys = state.keys || [], k = keyOf(state.board, state.turn);
    let n = 0; for (const x of keys) if (x === k) n++;
    if (n >= 3) return { check: check, over: true, result: "draw", reason: "repetition" };
    if ((state.quiet || 0) >= 120) return { check: check, over: true, result: "draw", reason: "nocapture" };
    return { check: check, over: false, result: null, reason: null };
  }

  // ---------- 记谱 ----------
  function fileNo(side, c) { return side === "r" ? 9 - c : c + 1; }
  function num(side, n) { return side === "r" ? CN[n] : String(n); }
  function zh(state, mv) {
    const b = state.board, p = b[mv.from[0]][mv.from[1]] || mv.piece, side = p[0], t = p[1];
    const fr = mv.from[0], fc = mv.from[1], tr = mv.to[0], tc = mv.to[1];
    const name = PIECE_ZH[p];
    // 同一路上同种棋子：前/后（三个以上的兵用前/中/后，再多就退回普通写法）
    const same = [];
    for (let r = 0; r < ROWS; r++) if (b[r][fc] === p) same.push(r);
    let head = name + num(side, fileNo(side, fc));
    if (same.length >= 2 && same.length <= 3) {
      same.sort(function (x, y) { return side === "r" ? x - y : y - x; }); // 前者在前
      const i = same.indexOf(fr);
      const tags = same.length === 2 ? ["前", "后"] : ["前", "中", "后"];
      head = tags[i] + name;
    }
    const fwd = side === "r" ? fr - tr : tr - fr;
    let act, n;
    if (fwd === 0) { act = "平"; n = fileNo(side, tc); }
    else {
      act = fwd > 0 ? "进" : "退";
      n = (t === "N" || t === "B" || t === "A") ? fileNo(side, tc) : Math.abs(fwd);
    }
    return head + act + num(side, n);
  }
  function zhPlain(state, mv) {
    const b = state.board, p = b[mv.from[0]][mv.from[1]] || mv.piece, side = p[0];
    const f1 = fileNo(side, mv.from[1]), f2 = fileNo(side, mv.to[1]);
    const fwd = side === "r" ? mv.from[0] - mv.to[0] : mv.to[0] - mv.from[0];
    let s = SIDE_ZH[side] + PIECE_ZH[p] + " 从第" + CN[f1] + "路";
    if (fwd === 0) s += "平移到第" + CN[f2] + "路";
    else s += (fwd > 0 ? "前进" : "后退") + CN[Math.abs(fwd)] + "步" + (f1 !== f2 ? "到第" + CN[f2] + "路" : "");
    const cap = b[mv.to[0]][mv.to[1]];
    if (cap) s += "，吃掉" + SIDE_ZH[cap[0]] + PIECE_ZH[cap];
    const nb = cloneBoard(b); doMove(nb, mv);
    if (attacked(nb, other(side))) s += "，将军";
    return s;
  }

  // ---------- 本地棋手 ----------
  const VAL = { K: 10000, R: 900, N: 400, C: 450, B: 200, A: 200, P: 100 };
  function pieceScore(p, r, c) {
    const side = p[0], t = p[1];
    let v = VAL[t];
    if (t === "P") {
      if (!ownHalf(side, r)) { v += 100; v += (c >= 3 && c <= 5) ? 20 : 0; const adv = side === "r" ? 4 - r : r - 5; if (adv < 4) v += 10 * adv; }
    } else if (t === "N" || t === "C") {
      v += 12 - 3 * Math.abs(c - 4);
      if (t === "N") v += side === "r" ? (9 - r) * 3 : r * 3;
    } else if (t === "R") {
      v += side === "r" ? (9 - r) * 2 : r * 2;
    }
    return v;
  }
  function evaluate(b, side) {
    let s = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = b[r][c]; if (!p) continue;
      const v = pieceScore(p, r, c); s += p[0] === side ? v : -v;
    }
    return s;
  }
  function order(ms) {
    return ms.sort(function (a, b) {
      const va = a.capture ? VAL[a.capture[1]] * 10 - VAL[a.piece[1]] : -1e9;
      const vb = b.capture ? VAL[b.capture[1]] * 10 - VAL[b.piece[1]] : -1e9;
      return vb - va;
    });
  }
  const MATE = 100000;
  function search(b, side, depth, alpha, beta, ply) {
    if (depth === 0) return evaluate(b, side);
    const ms = order(legalOn(b, side));
    if (!ms.length) return -MATE + ply; // 将死或困毙都算输
    for (const m of ms) {
      const cap = doMove(b, m);
      const v = -search(b, other(side), depth - 1, -beta, -alpha, ply + 1);
      undoMove(b, m, cap);
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return alpha;
  }
  // 下棋风格（她 2026-10-23：「也不能每个人下的风格都一样」）：同一档水平里，在差不多好的几步中往自己的路子偏。
  //   只在根上加一点分（几十分），不会为了风格白送子。attack 爱进攻 / solid 求稳 / trade 爱兑子 / wild 随性
  function styleBonus(b, side, m, style) {
    if (!style) return 0;
    const p = m.piece[1], fwd = side === "r" ? -1 : 1, adv = (m.to[0] - m.from[0]) * fwd;
    const capV = m.capture ? VAL[b[m.to[0]][m.to[1]][1]] : 0;
    const ek = findKing(b, other(side)), dist = function (sq) { return ek ? Math.abs(sq[0] - ek[0]) + Math.abs(sq[1] - ek[1]) : 0; };
    const crossed = function (r) { return side === "r" ? r <= 4 : r >= 5; };
    let v = 0;
    if (style === "attack") {
      const cap = doMove(b, m); if (attacked(b, other(side))) v += 35; undoMove(b, m, cap);
      if (m.capture) v += 15;
      if (!crossed(m.from[0]) && crossed(m.to[0]) && p !== "P") v += 15;
      if (p === "R" || p === "N" || p === "C") v += (dist(m.from) - dist(m.to)) * 4;
      if (adv < 0) v -= 12;
    } else if (style === "solid") {
      if (p === "A" || p === "B") v += 12;
      if (p === "K") v -= 25;
      if (crossed(m.to[0]) && !crossed(m.from[0]) && p !== "P") v -= 12;
      if (m.capture && Math.abs(capV - VAL[p]) <= 60) v -= 15;
    } else if (style === "trade") {
      if (m.capture) v += Math.abs(capV - VAL[p]) <= 60 ? 45 : 10;
    } else if (style === "wild") {
      v += (Math.random() - 0.5) * 80;
      if (p === "K" || p === "A") v += 15;
      if (p === "P" && (m.from[1] === 0 || m.from[1] === 8)) v += 20;
    }
    return v;
  }
  function bestMove(state, level, style) {
    const b = cloneBoard(state.board), side = state.turn;
    const ms = legalOn(b, side);
    if (!ms.length) return null;
    if (level === "easy") {
      if (Math.random() < (style ? 0.45 : 0.6)) {
        const caps = ms.filter(function (m) { return m.capture; });
        if (caps.length && Math.random() < 0.7) return caps[Math.floor(Math.random() * caps.length)];
        return ms[Math.floor(Math.random() * ms.length)];
      }
      level = "shallow";
    }
    const depth = level === "hard" ? 3 : level === "shallow" ? 1 : 2;
    order(ms);
    let best = [], bestV = -Infinity, alpha = -Infinity;
    for (const m of ms) {
      const sb = styleBonus(b, side, m, style);
      const cap = doMove(b, m);
      // 与最优同分的也留着，随机挑一个，免得每局一模一样。有风格时每步要算准分（不能用剪过的上界），窗口放开
      const v = (style ? -search(b, other(side), depth - 1, -Infinity, Infinity, 1) : -search(b, other(side), depth - 1, -Infinity, -alpha + 1, 1)) + sb;
      undoMove(b, m, cap);
      if (v > bestV) { bestV = v; best = [m]; if (v > alpha) alpha = v; }
      else if (v === bestV) best.push(m);
    }
    return best[Math.floor(Math.random() * best.length)];
  }

  // ---------- 存档 ----------
  function serialize(state) {
    return JSON.parse(JSON.stringify({ board: state.board, turn: state.turn, history: state.history, keys: state.keys || [], quiet: state.quiet || 0 }));
  }
  function deserialize(obj) {
    const o = JSON.parse(JSON.stringify(obj || {}));
    if (!o.board) return newGame();
    return { board: o.board, turn: o.turn === "b" ? "b" : "r", history: o.history || [], keys: o.keys || [keyOf(o.board, o.turn)], quiet: o.quiet || 0 };
  }

  function perft(state, depth) {
    const b = cloneBoard(state.board);
    function go(side, d) {
      const ms = legalOn(b, side); if (d === 1) return ms.length;
      let n = 0; for (const m of ms) { const cap = doMove(b, m); n += go(other(side), d - 1); undoMove(b, m, cap); }
      return n;
    }
    return go(state.turn, depth);
  }

  // 为什么这一步不能走（她 2026-10-23「为啥我的帅吃不了你的炮」）：点了走不了的格子时给一句人话
  function whyNot(state, from, to) {
    const b = cloneBoard(state.board), side = state.turn, p = b[from[0]][from[1]];
    if (!p || p[0] !== side) return "";
    const ok = pseudoMoves(b, side).some(function (m) { return m.from[0] === from[0] && m.from[1] === from[1] && m.to[0] === to[0] && m.to[1] === to[1]; });
    if (!ok) return PIECE_ZH[p] + "不能这么走";
    const m = { from: from, to: to }, cap = doMove(b, m);
    const k = findKing(b, side), ek = findKing(b, other(side));
    let face = false;
    if (k && ek && k[1] === ek[1]) { face = true; for (let r = Math.min(k[0], ek[0]) + 1; r < Math.max(k[0], ek[0]); r++) if (b[r][k[1]]) { face = false; break; } }
    const chk = attacked(b, side);
    undoMove(b, m, cap);
    if (face) return "走过去两个将帅就在同一条线上对脸了，中间没子挡着，规则不许";
    if (chk) return "走了以后自己的" + PIECE_ZH[side + "K"] + "会被将军";
    return "";
  }
  // 整盘摆给模型看（她那句「为何」：TA 看不见棋盘，只好瞎编）
  function boardText(state) {
    const rows = ["   一 二 三 四 五 六 七 八 九（红方从右往左数路）"];
    for (let r = 0; r < ROWS; r++) rows.push((r === 5 ? "～～楚河汉界～～\n" : "") + state.board[r].map(function (p) { return p ? (p[0] === "r" ? "红" : "黑") + PIECE_ZH[p] : "··"; }).join(" "));
    return "上面是黑方，下面是红方：\n" + rows.slice(1).join("\n");
  }
  const api = { whyNot, boardText, STYLES: ["attack", "solid", "trade", "wild"], ROWS, COLS, PIECE_ZH, newGame, legalMoves, move, status, bestMove, zh, zhPlain, serialize, deserialize, perft, evaluate, inCheck: function (s) { return attacked(s.board, s.turn); } };
  if (typeof window !== "undefined") window.XiangqiCore = api;
  if (typeof module !== "undefined") module.exports = api;
})();
