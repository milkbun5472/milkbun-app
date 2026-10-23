// ============================================================
// 围棋 · 纯逻辑（她 2026-10-23：「围棋是不是也可以做了」）
//   跟国际象棋、中国象棋一样：落子全由这里算，模型只负责让 TA 说话（games.js 的 GoGame）。
//   中国规则数子，黑贴 7.5。电脑用随机模拟对局（蒙特卡洛）挑子：九路像样，十九路偏弱。
//   这一份没有 React、没有 DOM，测试直接跑。
// ============================================================
(function () {
  "use strict";
  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const opp = function (c) { return 3 - c; };
  const COLS = "abcdefghjklmnopqrst".toUpperCase();   // 围棋的列号，按惯例不用 I
  // 每种路数一份邻居表，算得快
  const NB = {};
  function nbOf(n) {
    if (NB[n]) return NB[n];
    const t = [];
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = (i / n) | 0, a = [];
      if (x > 0) a.push(i - 1); if (x < n - 1) a.push(i + 1); if (y > 0) a.push(i - n); if (y < n - 1) a.push(i + n);
      t.push(a);
    }
    return (NB[n] = t);
  }

  function newGame(size, komi) {
    const n = [9, 13, 19].indexOf(size) >= 0 ? size : 9;
    return { size: n, komi: komi == null ? 7.5 : komi, board: new Array(n * n).fill(0), turn: BLACK, ko: -1, passes: 0, caps: { 1: 0, 2: 0 }, history: [] };
  }
  // 一块棋和它的气。随机模拟一秒要跑上万次，所以用一套复用的数组打标记，不每次新建 Set
  let MARK = new Uint32Array(361), LMARK = new Uint32Array(361), STACK = new Int32Array(361), STAMP = 1;
  function scan(b, n, p) {   // 返回 { stones: [...], libs: 气数, lib: 最后一口气 }
    if (MARK.length < n * n) { MARK = new Uint32Array(n * n); LMARK = new Uint32Array(n * n); STACK = new Int32Array(n * n); }
    if (++STAMP > 4e9) { STAMP = 1; MARK.fill(0); LMARK.fill(0); }
    const c = b[p], nb = nbOf(n), stones = [];
    let sp = 0, libs = 0, lib = -1;
    STACK[sp++] = p; MARK[p] = STAMP;
    while (sp) {
      const q = STACK[--sp]; stones.push(q);
      const a = nb[q];
      for (let k = 0; k < a.length; k++) {
        const r = a[k], v = b[r];
        if (v === EMPTY) { if (LMARK[r] !== STAMP) { LMARK[r] = STAMP; libs++; lib = r; } }
        else if (v === c && MARK[r] !== STAMP) { MARK[r] = STAMP; STACK[sp++] = r; }
      }
    }
    return { stones: stones, libs: libs, lib: lib };
  }
  function group(b, n, p) {
    const g = scan(b, n, p), set = new Set();
    // 对外还按老样子给一个气的集合（教学、估死子要用）
    const nb = nbOf(n);
    g.stones.forEach(function (q) { nb[q].forEach(function (r) { if (b[r] === EMPTY) set.add(r); }); });
    return { stones: g.stones, libs: set };
  }
  // 在 b 上落一子（就地改），返回提掉的子；不合法返回 null（自杀）
  function play(b, n, p, c) {
    const nb = nbOf(n)[p];
    b[p] = c;
    const dead = [], o = opp(c);
    for (let k = 0; k < nb.length; k++) {
      const r = nb[k];
      if (b[r] === o) {
        const g = scan(b, n, r);
        if (!g.libs) for (let i = 0; i < g.stones.length; i++) { const q = g.stones[i]; if (b[q]) { b[q] = EMPTY; dead.push(q); } }
      }
    }
    if (!dead.length) {
      // 旁边有空点就一定有气，不用整块去数
      let free = false; for (let k = 0; k < nb.length; k++) if (b[nb[k]] === EMPTY) { free = true; break; }
      if (!free && !scan(b, n, p).libs) { b[p] = EMPTY; return null; }
    }
    return dead;
  }
  function isLegal(s, p) {
    if (p < 0 || p >= s.board.length || s.board[p] !== EMPTY || p === s.ko) return false;
    const b = s.board.slice();
    return play(b, s.size, p, s.turn) !== null;
  }
  function legalMoves(s) {
    const out = [];
    for (let p = 0; p < s.board.length; p++) if (isLegal(s, p)) out.push(p);
    return out;
  }
  // mv：{ p } 落子，或 { pass: true }
  function move(s, mv) {
    const n = s.size, b = s.board.slice();
    const caps = { 1: s.caps[1], 2: s.caps[2] };
    if (!mv || mv.pass) return { size: n, komi: s.komi, board: b, turn: opp(s.turn), ko: -1, passes: s.passes + 1, caps: caps, history: s.history.concat([{ mv: { pass: true }, side: s.turn, took: 0 }]) };
    if (!isLegal(s, mv.p)) return s;
    const dead = play(b, n, mv.p, s.turn);
    caps[s.turn] += dead.length;
    // 打劫：只提了一子、自己这子也就一口气一颗子 → 对面下一手不许马上提回
    let ko = -1;
    if (dead.length === 1) { const g = group(b, n, mv.p); if (g.stones.length === 1 && g.libs.size === 1) ko = dead[0]; }
    return { size: n, komi: s.komi, board: b, turn: opp(s.turn), ko: ko, passes: 0, caps: caps, history: s.history.concat([{ mv: { p: mv.p }, side: s.turn, took: dead.length }]) };
  }
  // 是不是 c 自己的眼（四周全是自己的子，斜角不多于一个对方的）：模拟时不往自己眼里填
  function isEye(b, n, p, c) {
    if (b[p] !== EMPTY) return false;
    const nb = nbOf(n)[p];
    for (const r of nb) if (b[r] !== c) return false;
    const x = p % n, y = (p / n) | 0; let bad = 0, edge = 0;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
      const xx = x + d[0], yy = y + d[1];
      if (xx < 0 || yy < 0 || xx >= n || yy >= n) { edge = 1; return; }
      if (b[yy * n + xx] === opp(c)) bad++;
    });
    return edge ? bad === 0 : bad <= 1;
  }
  // 数子（中国规则）：盘上活子 + 只被一方围住的空 + 贴目。dead 里的子先当提掉
  function score(s, dead) {
    const n = s.size, b = s.board.slice(), nb = nbOf(n);
    (dead || []).forEach(function (p) { b[p] = EMPTY; });
    let bl = 0, wh = 0;
    const seen = new Uint8Array(n * n);
    const owner = new Array(n * n).fill(0);
    for (let p = 0; p < n * n; p++) {
      if (b[p] === BLACK) { bl++; owner[p] = 1; }
      else if (b[p] === WHITE) { wh++; owner[p] = 2; }
      else if (!seen[p]) {
        const area = [], stack = [p]; let touch = 0; seen[p] = 1;
        while (stack.length) {
          const q = stack.pop(); area.push(q);
          for (const r of nb[q]) {
            if (b[r] === EMPTY && !seen[r]) { seen[r] = 1; stack.push(r); }
            else if (b[r] !== EMPTY) touch |= b[r];
          }
        }
        if (touch === 1) { bl += area.length; area.forEach(function (q) { owner[q] = 1; }); }
        else if (touch === 2) { wh += area.length; area.forEach(function (q) { owner[q] = 2; }); }
      }
    }
    const w = wh + s.komi, margin = Math.abs(bl - w);
    return { black: bl, white: w, winner: bl > w ? BLACK : WHITE, margin: margin, owner: owner };
  }
  // 随机下到底（不填自己的眼、合法就下），返回终局盘面。
  //   手里攥着一张空点表，每步只在空点里随机挑；挑到不能下的先挪到表尾跳过，这一步结束再放回来
  function playout(s0, rnd, cap) {
    const n = s0.size, b = Int8Array.from(s0.board), N = n * n, nbs = nbOf(n);
    let c = s0.turn, passes = 0, ko = s0.ko, moves = 0, last = -1;
    const empty = new Int16Array(N), pos = new Int16Array(N).fill(-1); let ne = 0;
    for (let p = 0; p < N; p++) if (b[p] === EMPTY) { pos[p] = ne; empty[ne++] = p; }
    const take = function (p) { const i = pos[p], q = empty[--ne]; empty[i] = q; pos[q] = i; pos[p] = -1; };
    const give = function (p) { if (pos[p] < 0) { pos[p] = ne; empty[ne++] = p; } };
    while (passes < 2 && moves < cap) {
      let played = -1, dead = null;
      // 先看对方刚下那一子旁边：有一口气的子就提（不然随机下永远看不见吃子）
      if (last >= 0 && rnd() < 0.9) {
        const a = nbs[last];
        for (let k = 0; k <= a.length && played < 0; k++) {
          const r = k < a.length ? a[k] : last;
          if (b[r] !== opp(c)) continue;
          const g = scan(b, n, r);
          if (g.libs === 1 && g.lib !== ko) { const d = play(b, n, g.lib, c); if (d !== null) { played = g.lib; dead = d; } }
        }
      }
      let lim = ne;
      while (played < 0 && lim > 0) {
        const j = Math.floor(rnd() * lim), p = empty[j];
        if (p !== ko && !isEye(b, n, p, c)) { const d = play(b, n, p, c); if (d !== null) { played = p; dead = d; break; } }
        // 这一点这步下不了：跟可挑范围的最后一个换位置，缩小范围
        lim--; const q = empty[lim]; empty[j] = q; pos[q] = j; empty[lim] = p; pos[p] = lim;
      }
      if (played >= 0) { take(played); for (let i = 0; i < dead.length; i++) give(dead[i]); ko = dead.length === 1 ? dead[0] : -1; }
      passes = played < 0 ? passes + 1 : 0;
      last = played; c = opp(c); moves++;
    }
    return b;
  }
  // 终局盘面上谁占了每一格（子或者只挨着一方的空）
  function ownerOf(b, n) {
    const nb = nbOf(n), o = new Int8Array(n * n);
    for (let p = 0; p < n * n; p++) {
      if (b[p]) o[p] = b[p];
      else { let t = 0; for (const r of nb[p]) t |= b[r]; o[p] = t === 1 ? 1 : t === 2 ? 2 : 0; }
    }
    return o;
  }
  function rng(seed) { let s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

  // 估死子：随机下很多盘，一块子在大多数盘里都被对方占了，就算死
  function estimateDead(s, ms) {
    const n = s.size, N = n * n, rnd = rng(Date.now()), t0 = Date.now(), own = new Float32Array(N);
    let k = 0;
    while (Date.now() - t0 < (ms || 400) || k < 30) {
      const o = ownerOf(playout(s, rnd, N * 3), n);
      for (let p = 0; p < N; p++) if (s.board[p] && o[p] && o[p] !== s.board[p]) own[p]++;
      k++;
      if (k > 2000) break;
    }
    const dead = [], seen = new Set();
    for (let p = 0; p < N; p++) {
      if (!s.board[p] || seen.has(p)) continue;
      const g = group(s.board, n, p); g.stones.forEach(function (q) { seen.add(q); });
      const avg = g.stones.reduce(function (a, q) { return a + own[q]; }, 0) / g.stones.length / k;
      if (avg > 0.6) g.stones.forEach(function (q) { dead.push(q); });
    }
    return dead;
  }

  // 下棋风格：在差不多好的几手里往自己的路子偏（attack 好斗 / solid 扎实围地 / wild 随性；trade 在围棋里当好斗）
  function styleBonus(s, p, style) {
    if (!style) return 0;
    const n = s.size, nb = nbOf(n)[p], c = s.turn, x = p % n, y = (p / n) | 0;
    const line = Math.min(x, y, n - 1 - x, n - 1 - y) + 1;
    let own = 0, foe = 0, atari = 0;
    for (const r of nb) {
      if (s.board[r] === c) own++;
      else if (s.board[r] === opp(c)) { foe++; if (group(s.board, n, r).libs.size <= 2) atari++; }
    }
    if (style === "attack" || style === "trade") return foe * 0.03 + atari * 0.04 - (line <= 2 ? 0.02 : 0);
    if (style === "solid") return own * 0.025 + (line === 3 || line === 4 ? 0.02 : 0) - foe * 0.01;
    if (style === "wild") return (Math.random() - 0.5) * 0.08;
    return 0;
  }

  // 挑一手：每个候选点随机下若干盘，看赢面（平坦蒙特卡洛 + UCB 分配）。
  //   level 决定想多久；easy 还会常随手下。对面刚停一手、自己数子领先就也停一手。
  const THINK = { easy: 120, normal: 500, hard: 1300 };
  function bestMove(s, level, style) {
    const n = s.size, N = n * n, me = s.turn, rnd = rng(Date.now() ^ (N * 7919));
    let cands = legalMoves(s).filter(function (p) { return !isEye(s.board, n, p, me); });
    if (!cands.length) return { pass: true };
    if (s.passes >= 1 && s.history.length > N / 3) {
      const sc = score(s, estimateDead(s, 200));
      if (sc.winner === me) return { pass: true };
    }
    if (level === "easy" && Math.random() < 0.3) return { p: cands[Math.floor(Math.random() * cands.length)] };
    // 候选太多（十九路）先粗筛：挨着子的、三四线的优先，其余随机抽一些
    if (cands.length > 90) {
      const near = cands.filter(function (p) { return nbOf(n)[p].some(function (r) { return s.board[r]; }); });
      const rest = cands.filter(function (p) { return near.indexOf(p) < 0; }).sort(function () { return Math.random() - 0.5; }).slice(0, 40);
      cands = near.concat(rest);
      if (s.history.length < 8) cands = cands.concat(cands.filter(function (p) { const x = p % n, y = (p / n) | 0; return (x === 3 || x === n - 4) && (y === 3 || y === n - 4); }));
    }
    // 吃子、救自己被打吃的子先加一点分：随机模拟里这两样看得不够清
    const prior = function (p) {
      const s1 = move(s, { p: p }), took = s1.caps[me] - s.caps[me];
      let save = 0;
      nbOf(n)[p].forEach(function (r) { if (s.board[r] === me && group(s.board, n, r).libs.size === 1 && group(s1.board, n, r).libs.size > 1) save += group(s.board, n, r).stones.length; });
      // 盘面还空的时候别往一二线下（随机模拟看不出这一点）
      const x = p % n, y = (p / n) | 0, line = Math.min(x, y, n - 1 - x, n - 1 - y) + 1;
      const stones = s.board.reduce(function (a, v) { return a + (v ? 1 : 0); }, 0), early = stones < N / 4;
      const edge = early && !took && !save ? (line === 1 ? -0.15 : line === 2 && n > 9 ? -0.05 : 0) : 0;
      return Math.min(0.5, took * 0.3 + save * 0.2) + edge;
    };
    const M = cands.length, wins = new Float64Array(M), tries = new Float64Array(M);
    const pri = new Float64Array(M); if (level !== "easy") for (let i = 0; i < M; i++) pri[i] = prior(cands[i]);
    const t0 = Date.now(), budget = THINK[level] || THINK.normal;
    let total = 0;
    while (Date.now() - t0 < budget || total < M) {
      // UCB：赢面高的多试，没怎么试过的也给机会
      let bi = 0, bv = -1;
      for (let i = 0; i < M; i++) {
        const v = tries[i] ? wins[i] / tries[i] + pri[i] + Math.sqrt(2 * Math.log(total + 1) / tries[i]) : 9;
        if (v > bv) { bv = v; bi = i; }
      }
      const s1 = move(s, { p: cands[bi] });
      const end = playout(s1, rnd, N * 3);
      const o = ownerOf(end, n);
      let bl = 0, wh = s.komi;
      for (let p = 0; p < N; p++) { if (o[p] === 1) bl++; else if (o[p] === 2) wh++; }
      const won = (bl > wh ? BLACK : WHITE) === me;
      wins[bi] += won ? 1 : 0; tries[bi]++; total++;
      if (total > 60000) break;
    }
    // 只信试得够多的那些手：试两盘赢两盘不算 100%（往 50% 拉一拉）
    let most = 0; for (let i = 0; i < M; i++) if (tries[i] > most) most = tries[i];
    const floor = Math.max(3, most * 0.15);
    let best = 0, bestV = -1;
    for (let i = 0; i < M; i++) {
      if (tries[i] < floor) continue;
      const v = (wins[i] + 2) / (tries[i] + 4) + pri[i] + styleBonus(s, cands[i], style) + (level === "easy" ? (Math.random() - 0.5) * 0.25 : 0);
      if (v > bestV) { bestV = v; best = i; }
    }
    // 怎么下都输得很惨，又已经下了大半盘：停一手，别在死棋里瞎填
    if (bestV < 0.03 && s.history.length > N / 2) return { pass: true };
    return { p: cands[best], rate: tries[best] ? wins[best] / tries[best] : 0 };
  }
  // 这一手在当前局面下的赢面（给教学用：她走的那一手跟电脑挑的差多少）
  function winRate(s, p, ms) {
    const n = s.size, N = n * n, me = s.turn, rnd = rng(Date.now() ^ p);
    if (!isLegal(s, p)) return 0;
    const s1 = move(s, { p: p }); let w = 0, k = 0; const t0 = Date.now();
    while (Date.now() - t0 < (ms || 200) || k < 20) {
      const o = ownerOf(playout(s1, rnd, N * 3), n);
      let bl = 0, wh = s.komi; for (let q = 0; q < N; q++) { if (o[q] === 1) bl++; else if (o[q] === 2) wh++; }
      if ((bl > wh ? BLACK : WHITE) === me) w++; k++;
      if (k > 4000) break;
    }
    return w / k;
  }
  function coord(n, p) { return COLS[p % n] + (n - ((p / n) | 0)); }
  function parse(n, str) { const m = String(str || "").toUpperCase().match(/([A-HJ-T])\s*(\d{1,2})/); if (!m) return -1; const x = COLS.indexOf(m[1]), y = n - Number(m[2]); return x < 0 || x >= n || y < 0 || y >= n ? -1 : y * n + x; }
  // 给模型看的一句：谁下在哪，提了几子
  function zh(s, mv) {
    const who = s.turn === BLACK ? "黑" : "白";
    if (!mv || mv.pass) return who + "停一手";
    const s1 = move(s, mv), took = s1.caps[s.turn] - s.caps[s.turn];
    let atari = 0; nbOf(s.size)[mv.p].forEach(function (r) { if (s1.board[r] === opp(s.turn) && group(s1.board, s.size, r).libs.size === 1) atari++; });
    return who + "下在 " + coord(s.size, mv.p) + (took ? "，提了 " + took + " 子" : "") + (atari ? "，打吃" : "");
  }
  // 一块子还剩几口气（教学用：哪块快被吃了）
  function weakGroups(s, side) {
    const n = s.size, seen = new Set(), out = [];
    for (let p = 0; p < n * n; p++) {
      if (s.board[p] !== side || seen.has(p)) continue;
      const g = group(s.board, n, p); g.stones.forEach(function (q) { seen.add(q); });
      if (g.libs.size <= 2) out.push({ at: coord(n, g.stones[0]), stones: g.stones.length, libs: g.libs.size });
    }
    return out;
  }

  const api = { EMPTY: EMPTY, BLACK: BLACK, WHITE: WHITE, STYLES: ["attack", "solid", "trade", "wild"], COLS: COLS,
    newGame: newGame, isLegal: isLegal, legalMoves: legalMoves, move: move, score: score, estimateDead: estimateDead,
    bestMove: bestMove, winRate: winRate, coord: coord, parse: parse, zh: zh, weakGroups: weakGroups, group: function (s, p) { return group(s.board, s.size, p); } };
  if (typeof window !== "undefined") window.GoCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
