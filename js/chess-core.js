// ============================================================
// 国际象棋 · 纯逻辑（游戏模块用）
//   走法、合法性、胜负全在这里本地算；模型只负责让 TA 说话。
//   没有 React、没有 DOM，测试直接跑。board[r][c]，r=0 是第 8 横排（黑方底线）。
// ============================================================
(function () {
  "use strict";
  const FILES = "abcdefgh";
  const PIECE_ZH = { K: "王", Q: "后", R: "车", B: "象", N: "马", P: "兵" };
  const PIECE_GLYPH = { wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙", bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟" };
  const SIDE_ZH = { w: "白方", b: "黑方" };
  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const sq = function (r, c) { return FILES[c] + (8 - r); };
  const inB = function (r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; };
  const opp = function (s) { return s === "w" ? "b" : "w"; };

  // ---------- FEN ----------
  function fromFEN(fen) {
    const p = String(fen).trim().split(/\s+/);
    const board = [];
    p[0].split("/").forEach(function (row) {
      const line = [];
      for (const ch of row) {
        if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) line.push(null);
        else line.push((ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase());
      }
      board.push(line);
    });
    let ep = null;
    if (p[3] && p[3] !== "-") ep = [8 - +p[3][1], FILES.indexOf(p[3][0])];
    return { board, turn: p[1] || "w", castling: p[2] && p[2] !== "-" ? p[2] : "", ep, half: +(p[4] || 0), full: +(p[5] || 1), history: [] };
  }
  function boardFEN(s) {
    return s.board.map(function (row) {
      let out = "", n = 0;
      row.forEach(function (x) {
        if (!x) { n++; return; }
        if (n) { out += n; n = 0; }
        out += x[0] === "w" ? x[1] : x[1].toLowerCase();
      });
      return out + (n || "");
    }).join("/");
  }
  function key(s) { return boardFEN(s) + " " + s.turn + " " + (s.castling || "-") + " " + (s.ep ? sq(s.ep[0], s.ep[1]) : "-"); }
  function toFEN(s) { return key(s) + " " + s.half + " " + s.full; }
  function newGame() { return fromFEN(START); }

  // ---------- 攻击与走法 ----------
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // (r,c) 是否被 by 方攻击
  function attacked(b, r, c, by) {
    const pr = by === "w" ? r + 1 : r - 1;
    for (const dc of [-1, 1]) if (inB(pr, c + dc) && b[pr][c + dc] === by + "P") return true;
    for (const d of KN) { const y = r + d[0], x = c + d[1]; if (inB(y, x) && b[y][x] === by + "N") return true; }
    for (const d of KG) { const y = r + d[0], x = c + d[1]; if (inB(y, x) && b[y][x] === by + "K") return true; }
    for (const [dirs, a, q] of [[DIAG, by + "B", by + "Q"], [ORTH, by + "R", by + "Q"]]) {
      for (const d of dirs) {
        let y = r + d[0], x = c + d[1];
        while (inB(y, x)) { const t = b[y][x]; if (t) { if (t === a || t === q) return true; break; } y += d[0]; x += d[1]; }
      }
    }
    return false;
  }
  function findKing(b, side) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === side + "K") return [r, c];
    return null;
  }
  function inCheck(s, side) { side = side || s.turn; const k = findKing(s.board, side); return !!k && attacked(s.board, k[0], k[1], opp(side)); }

  function pseudo(s, r, c, out) {
    const b = s.board, p = b[r][c], me = p[0], t = p[1], en = opp(me);
    const add = function (y, x, extra) {
      const m = { from: [r, c], to: [y, x], piece: p, capture: b[y][x] || null };
      if (extra) Object.assign(m, extra);
      out.push(m);
    };
    if (t === "P") {
      const dir = me === "w" ? -1 : 1, start = me === "w" ? 6 : 1, last = me === "w" ? 0 : 7;
      const push = function (y, x) {
        if (y === last) for (const q of ["q", "r", "b", "n"]) add(y, x, { promo: q }); else add(y, x);
      };
      if (inB(r + dir, c) && !b[r + dir][c]) {
        push(r + dir, c);
        if (r === start && !b[r + 2 * dir][c]) add(r + 2 * dir, c);
      }
      for (const dc of [-1, 1]) {
        const y = r + dir, x = c + dc;
        if (!inB(y, x)) continue;
        if (b[y][x] && b[y][x][0] === en) push(y, x);
        else if (s.ep && s.ep[0] === y && s.ep[1] === x) out.push({ from: [r, c], to: [y, x], piece: p, capture: en + "P", ep: true });
      }
      return;
    }
    const step = function (dirs, slide) {
      for (const d of dirs) {
        let y = r + d[0], x = c + d[1];
        while (inB(y, x)) {
          if (b[y][x]) { if (b[y][x][0] === en) add(y, x); break; }
          add(y, x);
          if (!slide) break;
          y += d[0]; x += d[1];
        }
      }
    };
    if (t === "N") step(KN, false);
    else if (t === "B") step(DIAG, true);
    else if (t === "R") step(ORTH, true);
    else if (t === "Q") step(DIAG.concat(ORTH), true);
    else if (t === "K") {
      step(KG, false);
      const home = me === "w" ? 7 : 0, cs = s.castling || "";
      if (r === home && c === 4 && !attacked(b, r, 4, en)) {
        const kf = me === "w" ? "K" : "k", qf = me === "w" ? "Q" : "q";
        if (cs.includes(kf) && b[r][7] === me + "R" && !b[r][5] && !b[r][6] && !attacked(b, r, 5, en) && !attacked(b, r, 6, en))
          add(r, 6, { castle: "K" });
        if (cs.includes(qf) && b[r][0] === me + "R" && !b[r][1] && !b[r][2] && !b[r][3] && !attacked(b, r, 3, en) && !attacked(b, r, 2, en))
          add(r, 2, { castle: "Q" });
      }
    }
  }

  // 只换棋盘与状态位，不算记谱（搜索用，轻）
  function applyRaw(s, mv) {
    const b = s.board.map(function (row) { return row.slice(); });
    const [fr, fc] = mv.from, [tr, tc] = mv.to, p = b[fr][fc], me = p[0];
    b[fr][fc] = null;
    if (mv.ep) b[fr][tc] = null;
    let placed = p;
    if (p[1] === "P" && (tr === 0 || tr === 7)) placed = me + (mv.promo || "q").toUpperCase();
    b[tr][tc] = placed;
    if (mv.castle === "K") { b[tr][5] = b[tr][7]; b[tr][7] = null; }
    if (mv.castle === "Q") { b[tr][3] = b[tr][0]; b[tr][0] = null; }
    let cs = s.castling || "";
    const strip = function (r, c) {
      if (r === 7 && c === 4) cs = cs.replace(/[KQ]/g, "");
      if (r === 0 && c === 4) cs = cs.replace(/[kq]/g, "");
      if (r === 7 && c === 7) cs = cs.replace("K", "");
      if (r === 7 && c === 0) cs = cs.replace("Q", "");
      if (r === 0 && c === 7) cs = cs.replace("k", "");
      if (r === 0 && c === 0) cs = cs.replace("q", "");
    };
    strip(fr, fc); strip(tr, tc);
    const ep = p[1] === "P" && Math.abs(tr - fr) === 2 ? [(fr + tr) / 2, fc] : null;
    const reset = p[1] === "P" || !!mv.capture;
    return { board: b, turn: opp(me), castling: cs, ep, half: reset ? 0 : s.half + 1, full: s.full + (me === "b" ? 1 : 0), history: s.history };
  }

  function legalMoves(s, from) {
    const out = [], res = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = s.board[r][c];
      if (!p || p[0] !== s.turn) continue;
      if (from && (from[0] !== r || from[1] !== c)) continue;
      pseudo(s, r, c, out);
    }
    for (const m of out) { const n = applyRaw(s, m); if (!inCheck(n, s.turn)) res.push(m); }
    return res;
  }

  // ---------- 胜负 ----------
  function insufficient(b) {
    const minor = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p[1] === "K") continue;
      if (p[1] === "B" || p[1] === "N") minor.push([p, (r + c) % 2]); else return false;
    }
    if (minor.length <= 1) return true;
    // 只剩同色格的象
    return minor.every(function (m) { return m[0][1] === "B" && m[1] === minor[0][1]; });
  }
  function status(s) {
    const check = inCheck(s), any = legalMoves(s).length > 0;
    const done = function (result, reason) { return { check, over: true, result, reason }; };
    if (!any) return check ? done(opp(s.turn), "checkmate") : done("draw", "stalemate");
    if (insufficient(s.board)) return done("draw", "insufficient");
    if (s.half >= 100) return done("draw", "fifty");
    const k = key(s);
    let n = 0;
    for (const h of s.history || []) if (h.key === k) n++;
    if (n >= 3) return done("draw", "repetition");
    return { check, over: false, result: null, reason: null };
  }

  // ---------- 记谱 ----------
  function suffix(s, mv) {
    const n = applyRaw(s, mv);
    if (!inCheck(n)) return "";
    return legalMoves(n).length ? "+" : "#";
  }
  function san(s, mv) {
    if (mv.castle) return (mv.castle === "K" ? "O-O" : "O-O-O") + suffix(s, mv);
    const t = mv.piece[1], to = sq(mv.to[0], mv.to[1]);
    let str;
    if (t === "P") {
      str = (mv.capture ? FILES[mv.from[1]] + "x" : "") + to;
      if (mv.to[0] === 0 || mv.to[0] === 7) str += "=" + (mv.promo || "q").toUpperCase();
    } else {
      const twins = legalMoves(s).filter(function (m) {
        return m.piece === mv.piece && m.to[0] === mv.to[0] && m.to[1] === mv.to[1] && (m.from[0] !== mv.from[0] || m.from[1] !== mv.from[1]);
      });
      let dis = "";
      if (twins.length) {
        const sameFile = twins.some(function (m) { return m.from[1] === mv.from[1]; });
        const sameRank = twins.some(function (m) { return m.from[0] === mv.from[0]; });
        if (!sameFile) dis = FILES[mv.from[1]];
        else if (!sameRank) dis = String(8 - mv.from[0]);
        else dis = sq(mv.from[0], mv.from[1]);
      }
      str = t + dis + (mv.capture ? "x" : "") + to;
    }
    return str + suffix(s, mv);
  }
  function zh(s, mv) {
    const side = SIDE_ZH[mv.piece[0]];
    let str;
    if (mv.castle) str = side + (mv.castle === "K" ? "短易位" : "长易位");
    else {
      str = side + PIECE_ZH[mv.piece[1]] + " " + sq(mv.from[0], mv.from[1]) + "→" + sq(mv.to[0], mv.to[1]);
      if (mv.capture) str += " 吃掉" + SIDE_ZH[mv.capture[0]] + PIECE_ZH[mv.capture[1]] + (mv.ep ? "（吃过路兵）" : "");
      if (mv.piece[1] === "P" && (mv.to[0] === 0 || mv.to[0] === 7)) str += "，升变为" + PIECE_ZH[(mv.promo || "q").toUpperCase()];
    }
    const sf = suffix(s, mv);
    return str + (sf === "#" ? "，将死" : sf === "+" ? "，将军" : "");
  }

  function move(s, mv) {
    const legal = legalMoves(s, mv.from).find(function (m) {
      return m.to[0] === mv.to[0] && m.to[1] === mv.to[1] && (!m.promo || m.promo === (mv.promo || "q"));
    });
    if (!legal) throw new Error("illegal move");
    const n = applyRaw(s, legal);
    n.history = (s.history || []).concat([{ mv: legal, san: san(s, legal), key: key(n) }]);
    return n;
  }

  // ---------- 棋手 ----------
  // 兵/马/象/车/后/王 位置分（白方视角，r=0 为第 8 排）
  const PST = {
    P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
  };
  // 白方减黑方
  function evaluate(b) {
    let v = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const t = p[1];
      if (p[0] === "w") v += VAL[t] + PST[t][r * 8 + c];
      else v -= VAL[t] + PST[t][(7 - r) * 8 + c];
    }
    return v;
  }
  const MATE = 100000;
  function order(ms) {
    return ms.sort(function (a, b) {
      const sa = (a.capture ? 10 * VAL[a.capture[1]] - VAL[a.piece[1]] / 10 + 1000 : 0) + (a.promo === "q" ? 800 : 0);
      const sb = (b.capture ? 10 * VAL[b.capture[1]] - VAL[b.piece[1]] / 10 + 1000 : 0) + (b.promo === "q" ? 800 : 0);
      return sb - sa;
    });
  }
  // 负极大值：返回走棋方视角分
  function search(s, depth, alpha, beta, ply, ordered) {
    const ms = legalMoves(s);
    if (!ms.length) return inCheck(s) ? -MATE + ply : 0;
    if (depth === 0) return (s.turn === "w" ? 1 : -1) * evaluate(s.board);
    if (ordered) order(ms);
    for (const m of ms) {
      const v = -search(applyRaw(s, m), depth - 1, -beta, -alpha, ply + 1, ordered);
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return alpha;
  }
  function scored(s, depth, ordered) {
    const ms = legalMoves(s);
    if (ordered) order(ms);
    return ms.map(function (m) { return { m, v: -search(applyRaw(s, m), depth - 1, -Infinity, Infinity, 1, ordered) }; });
  }
  function bestMove(s, level) {
    const ms = legalMoves(s);
    if (!ms.length) return null;
    if (level === "easy") {
      // 一层看：大多挑好的，常随手走，偶尔送子
      if (Math.random() < 0.25) return ms[Math.floor(Math.random() * ms.length)];
      const list = scored(s, 1, false).map(function (x) { return { m: x.m, v: x.v + Math.random() * 120 }; });
      list.sort(function (a, b) { return b.v - a.v; });
      return list[Math.floor(Math.random() * Math.min(3, list.length))].m;
    }
    const depth = level === "hard" ? 3 : 2;
    const list = scored(s, depth, level === "hard");
    let best = -Infinity, pick = [];
    for (const x of list) {
      if (x.v > best) { best = x.v; pick = [x.m]; } else if (x.v === best) pick.push(x.m);
    }
    return pick[Math.floor(Math.random() * pick.length)];
  }

  const api = { PIECE_ZH, PIECE_GLYPH, newGame, legalMoves, move, status, bestMove, san, zh, fromFEN, toFEN, inCheck, evaluate };
  if (typeof window !== "undefined") window.ChessCore = api;
  if (typeof module !== "undefined") module.exports = api;
})();
