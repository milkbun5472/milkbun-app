// 联机房间第三期·第二档：手里的牌／词／骰子只给自己看（设计单第七节）
//
// 接在 netroom-games.js 那张 ADAPTERS 表上，接口一样（文件头那一段）。这一档多出来的只有两条：
//   · 私密的那份一律走 priv：庄（开局的人那台）只把每个座位的手牌／词／骰子发到坐这个座位的那台；
//     公开的 view 里只有张数、桌上打出来的牌和日志——cleanView 一样一样挑字段，别的一概不收。
//   · 角色座位由带 TA 来的那台出手：手牌类用本地牌手（单机那一位，照主人在报名单上调的牌手水平），
//     它手里只有这个座位自己那份 priv，别人的手牌是同样张数的空牌；卧底、心有灵犀用 TA 自己的线路和人设。
// 规则、发牌、本地牌手都是小游戏里那一份（window.GameShared.cards / .spy、UnoCore、MahjongCore、LingxiCore）。
// 一局打完一手（摊牌、开骰、一盘结束）庄就直接发下一手，刚结束那一手亮出来的东西放在 lastShow 里给大家看。
// 已知漏洞（设计单写过）：庄那台手机上有全部信息；帮人转发的那台技术上看得到经过它的 priv。熟人之间玩，防不了改代码的人。
(function (root) {
  "use strict";
  const NC = root.NetGameCore; if (!NC) return;
  const ADAPTERS = NC.ADAPTERS, nmOf = NC.nmOf, charWho = NC.charWho, NPC_WHO = NC.NPC_WHO;
  const GS = () => root.GameShared || null;
  const CD = () => (GS() && GS().cards) || {};
  const cut = (v, n) => String(v == null ? "" : v).slice(0, n);
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
  const playersOf = inv => inv.seats.map((s, i) => ({ key: "s" + i, name: s.name || ("座位" + (i + 1)), isUser: false, isNpc: s.kind === "npc" }));
  const seatOfKey = k => { const m = /^s(\d+)$/.exec(String(k || "")); return m ? +m[1] : -1; };
  const logOf = (st, n) => arr(st.log, 400).slice(-(n || 40)).map(x => ({ text: cut(x && x.text, 300) }));
  const cleanLog = v => arr(v, 400).slice(-40).map(x => ({ text: cut(x && x.text, 300) }));
  // 牌手水平：主人在报名单上给角色调的那一档；NPC 照开局的人开局页的那一档；放水局 NPC 再松一点
  const slipFor = (skill, easy) => { const B = CD().BOT_SKILL || {}; const s = (B[skill] || B.normal || { slip: .12 }).slip; return easy ? Math.max(s, .4) : s; };
  const npcSlip = (st, inv) => slipFor(st.botSkill, inv.mode === "easy");
  const charSlip = (ctx, inv) => slipFor(ctx && ctx.opts && ctx.opts.botSkill, false);

  // ── 几种牌的白名单 ──
  const SUITS = ["♠", "♥", "♦", "♣", ""];
  const cleanCard = c => c && typeof c === "object" ? Object.assign({ r: cut(c.r, 4), s: SUITS.indexOf(c.s) >= 0 ? c.s : "", v: int(c.v, 0, 99, 0) }, c.joker ? { joker: true } : {}, c.uid ? { uid: cut(c.uid, 8) } : {}) : null;
  const cleanCards = (a, n) => arr(a, n || 60).map(cleanCard).filter(Boolean);
  const UNO_C = ["R", "Y", "G", "B", "W"], UNO_V = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "S", "V", "D2", "W", "W4"];
  const cleanUno = c => c && UNO_C.indexOf(c.color) >= 0 && UNO_V.indexOf(c.value) >= 0 ? { uid: cut(c.uid, 12), color: c.color, value: c.value, code: c.color === "W" ? c.value : c.color + c.value } : null;
  const cleanTile = k => typeof k === "string" && /^[a-zA-Z][0-9a-zA-Z]?$/.test(k) ? k : null;
  const cleanTiles = (a, n) => arr(a, n || 30).map(cleanTile).filter(Boolean);
  const placeholders = n => Array.from({ length: int(n, 0, 120, 0) }, (_, j) => ({ r: "?", s: "", v: 0, uid: "x" + j }));

  // ── 一副通用的外壳：庄拿全局，公开那份只留 hide 挑出来的，priv 只给这个座位 ──
  //   spec：{ zh, seatRange, mustFill, init(inv,ctx)→st, hide(st)→view, privOf(st,i), turn(st|view), act(st,i,mv) 改 st 或抛错,
  //          after(st) 一手打完自动接下一手, npc(st,i,inv)→mv, local(view,i,priv)→给本地牌手看的那份 st, result, text, replay, cleanView, cleanReplay }
  // 这一手打完了的那句：日志最后一行
  const lastLine = st => { const L = (st && st.log) || []; const x = L[L.length - 1]; return x ? cut(x.text, 200) : ""; };
  function handAdapter(key, spec) {
    const A = {
      // 本地牌手出牌不调模型：桌边台词由框架隔几手问一句（localTalk）；手里有牌，NPC 那一手不并进别人的调用
      zh: spec.zh, needPriv: true, mustFill: !!spec.mustFill, localTalk: true, mergeNpc: null,
      seatRange: spec.seatRange,
      init(inv, ctx) { const st = spec.init(inv, ctx || {}); st.botSkill = ((ctx && ctx.cfg) || {}).botSkill || "normal"; return st; },
      view: st => spec.hide(st),
      priv: (st, i) => spec.privOf(st, i),
      turn: v => v.status === "finished" ? -1 : spec.turn(v),
      apply(st, i, mv, ctx) {
        if (st.status === "finished") return { err: "这一局已经打完了" };
        if (i !== spec.turn(st)) return { err: "还没轮到这一位" };
        const n = clone(st);
        // 角色那台没想出来（交了个空手）：庄照本地牌手替这一手
        const m = !mv || mv.pass ? spec.npc(n, i, ctx.inv) : mv;
        try { spec.act(n, i, m || {}, ctx.inv); } catch (e) { return { err: String((e && e.message) || e) }; }
        if (spec.after) spec.after(n, ctx.inv);
        return { st: n };
      },
      npcMove: (st, i, inv) => spec.npc(clone(st), i, inv),
      // 角色：本地牌手只拿这个座位自己那份（别人的牌是空的）
      charMove(view, i, inv, ctx) {
        if (!ctx.priv) return { pass: true };
        const st = spec.local(clone(view), i, ctx.priv);
        st.botSkill = (ctx.opts && ctx.opts.botSkill) || "normal";
        return spec.npc(st, i, inv, charSlip(ctx, inv));
      },
      result(st, inv) {
        if (st.status !== "finished") return null;
        const r = spec.result(st, inv);
        return { winners: r.winners, text: r.text, replay: { rows: r.rows || [], log: logOf(st, 40).map(x => x.text) } };
      },
      cleanReplay: r => ({ rows: arr(r.rows, 12).map(x => cut(x, 120)), log: arr(r.log, 40).map(x => cut(x, 300)) }),
      cleanView: v => spec.cleanView(v || {}),
      stateText: (v, i, inv, priv) => spec.text(v, i, inv, priv),
      // 一手结算完（after 里留下了新的 lastShow）就算一轮完了，停下来让大家聊两句
      roundEnd: (p, n) => n.lastShow && JSON.stringify(n.lastShow) !== JSON.stringify(p.lastShow) ? (lastLine(n) || "这一手打完了") : ""
    };
    ADAPTERS[key] = A;
    NC.CHAR_OPTS[key] = ["botSkill"];
    return A;
  }
  const rankLine = (ps, f) => ps.slice().sort((a, b) => f(b) - f(a)).map(p => p.name + " " + f(p)).join("，");
  const winnerIdx = (st) => { const i = seatOfKey(st.winner); return i >= 0 ? [i] : []; };

  // ───────────── UNO ─────────────
  handAdapter("uno", {
    zh: "UNO", seatRange: () => ({ min: 2, max: 6 }),
    init(inv, ctx) { const U = CD().uno.C; return U.newGame(playersOf(inv), Math.random, { stackD2: ((ctx.cfg || {}).unoRule) === "stack" }); },
    hide: st => ({ status: st.status, winner: st.winner, turn: st.turn, direction: st.direction, color: st.color, pendingDraw: st.pendingDraw, drawn: !!st.drawnUid,
      w4: st.w4 ? { by: st.w4.by } : null, rules: st.rules, deckN: (st.deck || []).length, top: st.discard[st.discard.length - 1] || null,
      players: st.players.map(p => ({ key: p.key, name: p.name, n: p.hand.length })), log: logOf(st) }),
    privOf: (st, i) => ({ hand: st.players[i].hand.slice(), drawnUid: st.turn === i ? st.drawnUid || null : null }),
    turn: v => v.turn,
    act(st, i, mv) { const a = { kind: cut(mv.kind, 10), uid: cut(mv.uid, 12), color: cut(mv.color, 1), say: cut(mv.say, 100) }; a.uno = st.players[i].hand.length === 2; CD().uno.C.act(st, a, Math.random); },
    npc: (st, i, inv, slip) => CD().uno.local(st, Math.random, slip == null ? npcSlip(st, inv) : slip),
    local(v, i, pv) {
      return { status: "playing", turn: v.turn, direction: v.direction, color: v.color, pendingDraw: v.pendingDraw, drawnUid: pv.drawnUid || null, w4: v.w4, rules: v.rules,
        discard: v.top ? [v.top] : [], deck: [], log: [], players: v.players.map((p, j) => ({ key: p.key, name: p.name, hand: j === i ? pv.hand : placeholders(p.n) })) };
    },
    result: (st, inv) => { const w = winnerIdx(st); return { winners: w, text: (w.length ? nmOf(inv, w[0]) + " 先出完了" : "没人出完") + "。剩牌：" + st.players.map(p => p.name + " " + p.hand.length + " 张").join("，") + "。" }; },
    cleanView: v => ({ status: v.status === "finished" ? "finished" : "playing", winner: cut(v.winner, 4), turn: int(v.turn, 0, 5, 0), direction: v.direction === -1 ? -1 : 1, color: UNO_C.indexOf(v.color) >= 0 ? v.color : "R",
      pendingDraw: int(v.pendingDraw, 0, 40, 0), drawn: !!v.drawn, w4: v.w4 ? { by: cut(v.w4.by, 4) } : null, rules: { stackD2: !!(v.rules && v.rules.stackD2) }, deckN: int(v.deckN, 0, 120, 0), top: cleanUno(v.top),
      players: arr(v.players, 6).map((p, i) => ({ key: "s" + i, name: cut(p && p.name, 40), n: int(p && p.n, 0, 120, 0) })), log: cleanLog(v.log) }),
    text(v, i, inv, pv) {
      const U = CD().uno.C;
      return "顶牌 " + (v.top ? U.describe(v.top) : "?") + "，当前颜色 " + (U.LABEL[v.color] || "") + (v.pendingDraw ? "，下一家要摸 " + v.pendingDraw + " 张" : "") + "。各家剩牌：" + v.players.map(p => p.name + " " + p.n + " 张").join("，") + "。"
        + (pv && pv.hand ? "\n你手里：" + pv.hand.map(U.describe).join(" ") : "") + "\n最近：" + v.log.slice(-5).map(x => x.text).join("；") + (v.status === "finished" ? "\n打完了。" : "\n轮到 " + nmOf(inv, v.turn) + "。");
    }
  });

  // ───────────── 骗子骰 ─────────────
  handAdapter("liar", {
    zh: "骗子骰", seatRange: () => ({ min: 2, max: 6 }),
    init: inv => CD().liar.newGame(playersOf(inv)),
    after(st) { if (st.reveal && st.status === "playing") { st.lastShow = st.reveal; const s0 = st.nextStarter || 0; delete st.nextStarter; CD().liar.newRound(st, s0); } else if (st.reveal) st.lastShow = st.reveal; },
    hide: st => ({ status: st.status, winner: st.winner, round: st.round, turn: st.turn, bid: st.bid, lastShow: st.lastShow || null,
      players: st.players.map(p => ({ key: p.key, name: p.name, lives: p.lives, n: (p.dice || []).length })), log: logOf(st) }),
    privOf: (st, i) => ({ dice: (st.players[i].dice || []).slice() }),
    turn: v => v.turn,
    act(st, i, mv) { CD().liar.act(st, mv.kind === "open" ? { kind: "open", say: cut(mv.say, 200) } : { kind: "bid", n: int(mv.n, 1, 60, 1), f: int(mv.f, 2, 6, 2), say: cut(mv.say, 200) }); },
    npc: (st, i, inv, slip) => CD().liar.npc(st, i, (slip == null ? npcSlip(st, inv) : slip) * 2),
    local: (v, i, pv) => ({ status: "playing", turn: v.turn, bid: v.bid, log: [], players: v.players.map((p, j) => ({ key: p.key, name: p.name, lives: p.lives, dice: j === i ? pv.dice : Array(p.n).fill(0) })) }),
    result: (st, inv) => { const w = winnerIdx(st); return { winners: w, text: (w.length ? nmOf(inv, w[0]) + " 撑到了最后" : "没人撑到最后") + "，打了 " + st.round + " 轮。" }; },
    cleanView(v) {
      const ls = v.lastShow;
      return { status: v.status === "finished" ? "finished" : "playing", winner: cut(v.winner, 4), round: int(v.round, 0, 999, 0), turn: int(v.turn, 0, 5, 0),
        bid: v.bid ? { n: int(v.bid.n, 1, 60, 1), f: int(v.bid.f, 2, 6, 2), by: cut(v.bid.by, 4) } : null,
        lastShow: ls ? { bid: ls.bid ? { n: int(ls.bid.n, 1, 60, 1), f: int(ls.bid.f, 2, 6, 2), by: cut(ls.bid.by, 4) } : null, got: int(ls.got, 0, 60, 0), loser: cut(ls.loser, 4),
          dice: arr(ls.dice, 6).map(d => ({ key: cut(d && d.key, 4), dice: arr(d && d.dice, 6).map(x => int(x, 1, 6, 1)) })) } : null,
        players: arr(v.players, 6).map((p, i) => ({ key: "s" + i, name: cut(p && p.name, 40), lives: int(p && p.lives, 0, 9, 0), n: int(p && p.n, 0, 6, 0) })), log: cleanLog(v.log) };
    },
    text: (v, i, inv, pv) => "第 " + v.round + " 轮。还在的：" + v.players.filter(p => p.lives > 0).map(p => p.name + "（" + p.lives + " 条命）").join("、") + "。"
      + (v.bid ? "当前叫价：" + v.bid.n + " 个 " + v.bid.f + "（" + nmOf(inv, seatOfKey(v.bid.by)) + " 叫的）。" : "还没人叫。") + (pv && pv.dice ? "\n你自己的骰子：" + pv.dice.join(" ") + "（1 点万能）" : "")
      + "\n最近：" + v.log.slice(-5).map(x => x.text).join("；") + (v.status === "finished" ? "" : "\n轮到 " + nmOf(inv, v.turn) + "。")
  });

  // ───────────── 德州扑克 ─────────────
  const pkPub = p => ({ key: p.key, name: p.name, chips: p.chips, bet: p.bet, put: p.put, folded: !!p.folded, allin: !!p.allin, inHand: !!p.inHand, acted: !!p.acted, n: (p.hole || []).length });
  handAdapter("poker", {
    zh: "德州扑克", seatRange: () => ({ min: 2, max: 6 }),
    init: inv => CD().poker.newGame(playersOf(inv)),
    after(st) { if (st.street === "done") { st.lastShow = { showdown: st.showdown || null, won: st.lastWon || {}, board: st.board.slice() }; let k = 0; while (st.status === "playing" && st.street === "done" && k++ < 20) CD().poker.newHand(st); } },
    hide: st => ({ status: st.status, winner: st.winner, hand: st.hand, dealer: st.dealer, street: st.street, board: st.board.slice(), turn: st.turn, curBet: st.curBet, minRaise: st.minRaise,
      lastShow: st.lastShow || null, players: st.players.map(pkPub), log: logOf(st) }),
    privOf: (st, i) => ({ hole: (st.players[i].hole || []).slice() }),
    turn: v => v.street === "done" ? -1 : v.turn,
    act(st, i, mv) { CD().poker.act(st, { kind: cut(mv.kind, 8), to: int(mv.to, 0, 1e6, 0), say: cut(mv.say, 160) }); },
    npc: (st, i, inv, slip) => CD().poker.npc(st, i, (slip == null ? npcSlip(st, inv) : slip) > .3 ? .15 : 0),
    local: (v, i, pv) => Object.assign({}, v, { status: "playing", log: [], players: v.players.map((p, j) => Object.assign({}, p, { hole: j === i ? pv.hole : [] })) }),
    result: (st) => ({ winners: winnerIdx(st), text: "打了 " + st.hand + " 手，筹码：" + rankLine(st.players, p => p.chips) + "。" }),
    cleanView(v) {
      const ls = v.lastShow;
      return { status: v.status === "finished" ? "finished" : "playing", winner: cut(v.winner, 4), hand: int(v.hand, 0, 99, 0), dealer: int(v.dealer, 0, 5, 0), street: ["preflop", "flop", "turn", "river", "done"].indexOf(v.street) >= 0 ? v.street : "preflop",
        board: cleanCards(v.board, 5), turn: int(v.turn, -1, 5, 0), curBet: int(v.curBet, 0, 1e6, 0), minRaise: int(v.minRaise, 0, 1e6, 0),
        lastShow: ls ? { board: cleanCards(ls.board, 5), showdown: ls.showdown ? arr(ls.showdown, 6).map(x => ({ key: cut(x && x.key, 4), hole: cleanCards(x && x.hole, 2), cat: cut(x && x.cat, 8) })) : null,
          won: Object.keys(ls.won || {}).slice(0, 6).reduce((o, k) => { if (seatOfKey(k) >= 0) o[k] = int(ls.won[k], 0, 1e6, 0); return o; }, {}) } : null,
        players: arr(v.players, 6).map((p, i) => ({ key: "s" + i, name: cut(p && p.name, 40), chips: int(p && p.chips, 0, 1e6, 0), bet: int(p && p.bet, 0, 1e6, 0), put: int(p && p.put, 0, 1e6, 0),
          folded: !!(p && p.folded), allin: !!(p && p.allin), inHand: !!(p && p.inHand), acted: !!(p && p.acted), n: int(p && p.n, 0, 2, 0) })), log: cleanLog(v.log) };
    },
    text: (v, i, inv, pv) => { const N = CD().name; return "第 " + v.hand + " 手，公共牌：" + (v.board.map(N).join(" ") || "还没发") + "。桌上：" + v.players.map(p => p.name + "（" + (p.folded ? "已弃" : p.allin ? "全押" : "剩 " + p.chips) + "，这圈下了 " + p.bet + "）").join("、")
      + (pv && pv.hole ? "\n你的底牌：" + pv.hole.map(N).join(" ") : "") + "\n最近：" + v.log.slice(-5).map(x => x.text).join("；") + (v.turn >= 0 && v.status !== "finished" ? "\n轮到 " + nmOf(inv, v.turn) + "。" : ""); }
  });

  // ───────────── 抽鬼牌 ─────────────
  handAdapter("oldmaid", {
    zh: "抽鬼牌", seatRange: () => ({ min: 2, max: 4 }),
    init: inv => CD().oldmaid.newGame(playersOf(inv)),
    hide: st => ({ status: st.status, loser: st.loser, turn: st.turn, target: st.status === "playing" ? CD().oldmaid.target(st) : -1,
      last: st.last ? { by: st.last.by, from: st.last.from, pos: st.last.pos, paired: !!st.last.paired } : null,
      players: st.players.map(p => ({ key: p.key, name: p.name, n: p.hand.length, out: !!p.out })), log: logOf(st) }),
    privOf: (st, i) => ({ hand: st.players[i].hand.slice() }),
    turn: v => v.turn,
    act(st, i, mv) { CD().oldmaid.act(st, int(mv.pick, 0, 60, 0), cut(mv.say, 160)); },
    npc: (st) => { const t = CD().oldmaid.target(st), n = st.players[t] ? (st.players[t].n != null ? st.players[t].n : st.players[t].hand.length) : 1; return { pick: Math.floor(Math.random() * Math.max(1, n)) }; },
    local: (v, i, pv) => ({ status: "playing", turn: v.turn, log: [], players: v.players.map((p, j) => ({ key: p.key, name: p.name, out: p.out, n: p.n, hand: j === i ? pv.hand : placeholders(p.n) })) }),
    result: (st, inv) => { const l = seatOfKey(st.loser); return { winners: st.players.map((p, i) => i).filter(i => i !== l), text: (l >= 0 ? nmOf(inv, l) + " 最后捏着鬼牌，输了" : "没人捏着鬼牌") + "。" }; },
    cleanView: v => ({ status: v.status === "finished" ? "finished" : "playing", loser: cut(v.loser, 4), turn: int(v.turn, 0, 3, 0), target: int(v.target, -1, 3, -1),
      last: v.last ? { by: cut(v.last.by, 4), from: cut(v.last.from, 4), pos: int(v.last.pos, 0, 60, 0), paired: !!v.last.paired } : null,
      players: arr(v.players, 4).map((p, i) => ({ key: "s" + i, name: cut(p && p.name, 40), n: int(p && p.n, 0, 60, 0), out: !!(p && p.out) })), log: cleanLog(v.log) }),
    text: (v, i, inv, pv) => "各家剩牌：" + v.players.map(p => p.name + (p.out ? " 已上岸" : " " + p.n + " 张")).join("，") + "。" + (pv && pv.hand ? "\n你手里：" + pv.hand.map(CD().name).join(" ") : "")
      + "\n最近：" + v.log.slice(-4).map(x => x.text).join("；") + (v.status === "finished" ? "" : "\n轮到 " + nmOf(inv, v.turn) + " 从 " + nmOf(inv, v.target) + " 手里抽。")
  });

  // ───────────── 21 点 ─────────────
  //   庄家是手机。每人的牌只发给自己；要牌那一行日志只写「要牌／停牌／加倍／爆了」，不写拿到哪张、几点——一手结算才一起亮
  handAdapter("blackjack", {
    zh: "21 点", seatRange: () => ({ min: 2, max: 4 }),
    init: inv => CD().bj.newGame(playersOf(inv), Math.random, null),
    act(st, i, mv) {
      const from = st.log.length, k = ["hit", "stand", "double"].indexOf(mv.kind) >= 0 ? mv.kind : "stand";
      const p = st.players[i], twoCards = p.cards.length === 2, canD = twoCards && p.chips >= p.bet;
      CD().bj.act(st, { kind: k, say: cut(mv.say, 160) });
      const e = st.log[from]; if (e && e.kind === "move") {
        const say = (String(e.text).match(/　“[^”]*”$/) || [""])[0], bust = CD().bj.value(p.cards) > 21;
        e.text = p.name + "：" + (k === "stand" ? "停牌" : k === "double" && canD ? "加倍" : "要牌") + (bust ? "，爆了" : "") + say;
      }
    },
    after(st) { if (st.phase === "done") { st.lastShow = { dealer: st.dealer.slice(), hands: st.players.map(p => ({ key: p.key, cards: p.cards.slice(), result: p.result })) }; let k = 0; while (st.status === "playing" && st.phase === "done" && k++ < 20) CD().bj.newHand(st); } },
    hide: st => ({ status: st.status, winner: st.winner, hand: st.hand, phase: st.phase, turn: st.turn, dealerUp: st.dealer[0] || null, dealerN: st.dealer.length, lastShow: st.lastShow || null,
      players: st.players.map(p => ({ key: p.key, name: p.name, chips: p.chips, bet: p.bet, done: !!p.done, result: p.result || "", n: p.cards.length, bust: CD().bj.value(p.cards) > 21 })), log: logOf(st) }),
    privOf: (st, i) => ({ cards: st.players[i].cards.slice() }),
    turn: v => v.phase === "play" ? v.turn : -1,
    npc: (st, i, inv, slip) => CD().bj.npc(st, i, (slip == null ? npcSlip(st, inv) : slip) > .3),
    local: (v, i, pv) => ({ status: "playing", phase: "play", turn: v.turn, dealer: [v.dealerUp], log: [], players: v.players.map((p, j) => Object.assign({}, p, { cards: j === i ? pv.cards : [] })) }),
    result: st => ({ winners: winnerIdx(st), text: "打了 " + st.hand + " 手，筹码：" + rankLine(st.players, p => p.chips) + "。" }),
    cleanView(v) {
      const ls = v.lastShow;
      return { status: v.status === "finished" ? "finished" : "playing", winner: cut(v.winner, 4), hand: int(v.hand, 0, 99, 0), phase: v.phase === "play" ? "play" : "done", turn: int(v.turn, -1, 3, -1),
        dealerUp: cleanCard(v.dealerUp), dealerN: int(v.dealerN, 0, 12, 0),
        lastShow: ls ? { dealer: cleanCards(ls.dealer, 12), hands: arr(ls.hands, 4).map(x => ({ key: cut(x && x.key, 4), cards: cleanCards(x && x.cards, 12), result: cut(x && x.result, 6) })) } : null,
        players: arr(v.players, 4).map((p, i) => ({ key: "s" + i, name: cut(p && p.name, 40), chips: int(p && p.chips, 0, 1e5, 0), bet: int(p && p.bet, 0, 1e5, 0), done: !!(p && p.done), result: cut(p && p.result, 6), n: int(p && p.n, 0, 12, 0), bust: !!(p && p.bust) })), log: cleanLog(v.log) };
    },
    text: (v, i, inv, pv) => "第 " + v.hand + " 手，庄家亮着 " + (v.dealerUp ? CD().name(v.dealerUp) : "?") + "。各家：" + v.players.map(p => p.name + "（" + p.chips + " 筹码，" + p.n + " 张" + (p.bust ? "，爆了" : p.done ? "，停了" : "") + "）").join("、")
      + (pv && pv.cards ? "\n你手里：" + pv.cards.map(CD().name).join(" ") + "，" + CD().bj.value(pv.cards) + " 点" : "") + (v.turn >= 0 && v.status !== "finished" ? "\n轮到 " + nmOf(inv, v.turn) + "。" : "")
  });

  // ───────────── 斗地主（正好 3 人）─────────────
  handAdapter("doudizhu", {
    zh: "斗地主", mustFill: true, seatRange: () => ({ min: 3, max: 3 }),
    init: inv => CD().ddz.newGame(playersOf(inv)),
    act(st, i, mv) { if (st.phase === "bid") CD().ddz.bid(st, int(mv.n, 0, 3, 0), cut(mv.say, 160)); else CD().ddz.play(st, arr(mv.uids, 20).map(u => cut(u, 8)), cut(mv.say, 160)); },
    after(st) { if (st.phase === "done") { st.lastShow = { result: st.result, hands: st.players.map(p => ({ key: p.key, hand: p.hand.slice() })) }; if (st.status === "playing") CD().ddz.newRound(st); } },
    hide: st => ({ status: st.status, winner: st.winner, round: st.round, phase: st.phase, bid: st.bid, bidTurn: st.bidTurn, turn: st.turn, last: st.last || null, mult: st.mult, out: (st.out || []).slice(),
      bottom: st.phase === "bid" ? [] : (st.bottom || []).slice(), lastShow: st.lastShow || null,
      players: st.players.map(p => ({ key: p.key, name: p.name, pts: p.pts, role: p.role, n: p.hand.length, played: p.played })), log: logOf(st) }),
    privOf: (st, i) => ({ hand: st.players[i].hand.slice() }),
    turn: v => v.phase === "bid" ? v.bidTurn : v.phase === "play" ? v.turn : -1,
    npc(st, i, inv, slip) { const soft = Math.random() < (slip == null ? npcSlip(st, inv) : slip); return st.phase === "bid" ? { n: CD().ddz.npcBid(st, i, soft) } : { uids: CD().ddz.npcPlay(st, i, soft) }; },
    local: (v, i, pv) => Object.assign({}, v, { status: "playing", log: [], players: v.players.map((p, j) => Object.assign({}, p, { hand: j === i ? pv.hand : placeholders(p.n) })) }),
    result: st => ({ winners: winnerIdx(st), text: "打了 " + st.round + " 局，" + rankLine(st.players, p => p.pts) + " 分。" }),
    cleanView(v) {
      const L = v.last, ls = v.lastShow, combo = c => c ? { type: cut(c.type, 10), main: int(c.main, 0, 20, 0), len: int(c.len, 0, 20, 0) } : null;
      return { status: v.status === "finished" ? "finished" : "playing", winner: cut(v.winner, 4), round: int(v.round, 0, 99, 0), phase: ["bid", "play", "done"].indexOf(v.phase) >= 0 ? v.phase : "bid",
        bid: { n: int(v.bid && v.bid.n, 0, 3, 0), by: int(v.bid && v.bid.by, -1, 2, -1) }, bidTurn: int(v.bidTurn, 0, 2, 0), turn: int(v.turn, -1, 2, -1), mult: int(v.mult, 1, 4096, 1),
        last: L ? { by: int(L.by, 0, 2, 0), cards: cleanCards(L.cards, 20), combo: combo(L.combo), cleared: !!L.cleared } : null, out: cleanCards(v.out, 54), bottom: cleanCards(v.bottom, 3),
        lastShow: ls ? { result: ls.result ? { lordWin: !!ls.result.lordWin, score: int(ls.result.score, 0, 1e5, 0), spring: !!ls.result.spring } : null, hands: arr(ls.hands, 3).map(x => ({ key: cut(x && x.key, 4), hand: cleanCards(x && x.hand, 20) })) } : null,
        players: arr(v.players, 3).map((p, i) => ({ key: "s" + i, name: cut(p && p.name, 40), pts: int(p && p.pts, -1e5, 1e5, 0), role: p && (p.role === "lord" || p.role === "farmer") ? p.role : "", n: int(p && p.n, 0, 20, 0), played: int(p && p.played, 0, 99, 0) })), log: cleanLog(v.log) };
    },
    text: (v, i, inv, pv) => { const N = CD().name, T = CD().ddz.TYPE_ZH || {}; return "第 " + v.round + " 局，" + (v.phase === "bid" ? "叫分中，最高 " + v.bid.n + " 分" : "地主是 " + ((v.players.find(p => p.role === "lord") || {}).name || "?")) + "。各家：" + v.players.map(p => p.name + " " + p.n + " 张、" + p.pts + " 分").join("，") + "。"
      + (v.last && !v.last.cleared ? "桌上最后一手：" + nmOf(inv, v.last.by) + " 的" + (T[v.last.combo && v.last.combo.type] || "") + " " + v.last.cards.map(N).join(" ") + "。" : "")
      + (pv && pv.hand ? "\n你手里：" + pv.hand.map(N).join(" ") : "") + (v.status === "finished" ? "" : "\n轮到 " + nmOf(inv, v.phase === "bid" ? v.bidTurn : v.turn) + "。"); }
  });

  // ───────────── 麻将（正好 4 人）─────────────
  //   别家要不要（吃碰杠糊）一家一家问：按下家顺序轮到谁有得选谁表态；能选什么只在 TA 自己那份 priv 里
  const MJ = () => root.MahjongCore;
  // 角色那台的本地牌手看到的那份：桌上亮着的＋自己的牌；别人的手牌是空的，能干什么照庄发来的那张单
  function mjLocal(v, i, pv) {
    const st = Object.assign({}, v, { players: v.players.map((p, j) => Object.assign({}, p, { hand: j === i ? pv.hand.slice() : [], aka: [] })), wall: Array(v.wallN).fill("x"), flags: {}, drawn: pv.drawn, drawnBy: pv.drawn ? i : null });
    if (v.phase === "claim" && v.claim) st.claim = { k: v.claim.k, from: v.claim.from, pending: { [i]: pv.claim || [] }, decided: {} };
    return st;
  }
  const mjClaimTurn = st => { const cl = st.claim; if (!cl) return -1; for (let d = 1; d <= 3; d++) { const j = (cl.from + d) % 4; if (cl.pending && cl.pending[j] && !(cl.decided || {})[j]) return j; } return -1; };
  handAdapter("mahjong", {
    zh: "麻将", mustFill: true, seatRange: () => ({ min: 4, max: 4 }),
    init(inv, ctx) { const c = ctx.cfg || {}; return MJ().newGame(playersOf(inv), { variant: c.mjVariant, minFan: c.mjMinFan, hands: c.mjHands, handDraw: false, swap: false }); },
    act(st, i, mv) {
      const M = MJ(), k = cleanTile(mv.k);
      if (st.phase === "claim") return M.decide(st, i, mv.kind === "chow" ? { kind: "chow", use: cleanTiles(mv.use, 2) } : { kind: ["ron", "pong", "kong", "pass"].indexOf(mv.kind) >= 0 ? mv.kind : "pass" });
      if (mv.kind === "discard") return M.discard(st, i, k);
      return M.selfAct(st, i, { kind: cut(mv.kind, 8), k });
    },
    after(st) { if (st.phase === "done") { st.lastShow = { result: st.result, hands: st.players.map(p => ({ key: p.key, hand: p.hand.slice() })) }; if (st.status === "playing") MJ().nextHand(st); } },
    hide: st => ({ status: st.status, winner: st.winner, variant: st.variant, hands: st.hands, handNo: st.handNo, dealer: st.dealer, roundWind: st.roundWind, pot: st.pot || 0, phase: st.phase,
      turn: st.phase === "claim" ? mjClaimTurn(st) : st.turn, claim: st.claim ? { k: st.claim.k, from: st.claim.from } : null, last: st.last || null, wallN: (st.wall || []).length, doraInd: (st.doraInd || []).slice(),
      lastShow: st.lastShow ? { winners: ((st.lastShow.result || {}).wins || []).map(w => ({ winner: w.winner, zimo: !!w.zimo, from: w.from, k: w.k, label: (w.fan && (w.fan.label || w.fan.fan + " 番")) || "", items: ((w.fan && w.fan.items) || []).map(x => x[0]) })), hands: st.lastShow.hands } : null,
      players: st.players.map(p => ({ key: p.key, name: p.name, pts: p.pts, melds: p.melds.map(m => ({ type: m.type, tiles: m.type === "ckong" ? [] : m.tiles.slice() })), flowers: p.flowers.slice(), river: p.river.slice(), out: !!p.out, que: p.que || null, riichi: !!p.riichi, n: p.hand.length })), log: logOf(st) }),
    // 自己那份：手牌、刚摸的那张、这会儿能干什么（自摸／杠／立直，或者别家打的那张吃碰杠糊）
    privOf(st, i) {
      const M = MJ(), p = st.players[i], o = { hand: p.hand.slice(), drawn: st.drawnBy === i ? st.drawn || null : null, ckong: p.melds.filter(m => m.type === "ckong").map(m => m.tiles[0]) };
      if (st.phase === "discard" && st.turn === i) o.self = M.selfOptions(st, i).map(x => ({ kind: x.kind, k: x.k || null, ks: x.ks || null }));
      if (st.phase === "claim" && st.claim && st.claim.pending[i] && !st.claim.decided[i]) o.claim = st.claim.pending[i].map(x => ({ kind: x.kind, use: x.use || null }));
      return o;
    },
    // 庄那台拿的是整份（claim 里有 pending）：照下家顺序问；公开那份已经把轮到谁算好放在 turn 里
    turn: v => v.phase === "claim" ? (v.claim && v.claim.pending ? mjClaimTurn(v) : v.turn) : v.phase === "discard" ? v.turn : -1,
    npc(st, i, inv, slip) {
      const M = MJ(), s = slip == null ? npcSlip(st, inv) : slip, soft = inv.mode === "easy" && slip == null;
      if (st.phase === "claim") return st.claim.pending ? M.botClaim(st, i, soft, false, s) : { kind: "pass" };
      return M.botSelf(st, i, soft, s);
    },
    local: (v, i, pv) => mjLocal(v, i, pv),
    result: st => ({ winners: winnerIdx(st), text: (MJ().variantOf(st).zh || "麻将") + "，打了 " + st.handNo + " 盘：" + rankLine(st.players, p => p.pts) + "。" }),
    cleanView(v) {
      const P = p => ({ key: "", name: cut(p && p.name, 40), pts: Math.round(num(p && p.pts, 0)), melds: arr(p && p.melds, 5).map(m => ({ type: ["chow", "pong", "kong", "ckong"].indexOf(m && m.type) >= 0 ? m.type : "pong", tiles: cleanTiles(m && m.tiles, 4) })),
        flowers: cleanTiles(p && p.flowers, 8), river: cleanTiles(p && p.river, 40), out: !!(p && p.out), que: p && ["m", "p", "s"].indexOf(p.que) >= 0 ? p.que : null, riichi: !!(p && p.riichi), n: int(p && p.n, 0, 18, 0) });
      const ls = v.lastShow;
      return { status: v.status === "finished" ? "finished" : "playing", winner: cut(v.winner, 4), variant: cut(v.variant, 12), hands: int(v.hands, 1, 16, 4), handNo: int(v.handNo, 0, 16, 0), dealer: int(v.dealer, 0, 3, 0), roundWind: ["E", "S", "W", "N"].indexOf(v.roundWind) >= 0 ? v.roundWind : "E",
        pot: Math.round(num(v.pot, 0)), phase: ["discard", "claim", "done", "draw", "swap", "que"].indexOf(v.phase) >= 0 ? v.phase : "discard", turn: int(v.turn, -1, 3, -1),
        claim: v.claim ? { k: cleanTile(v.claim.k), from: int(v.claim.from, 0, 3, 0) } : null, last: v.last ? { by: int(v.last.by, 0, 3, 0), k: cleanTile(v.last.k) } : null, wallN: int(v.wallN, 0, 200, 0), doraInd: cleanTiles(v.doraInd, 6),
        lastShow: ls ? { winners: arr(ls.winners, 4).map(w => ({ winner: int(w && w.winner, 0, 3, 0), zimo: !!(w && w.zimo), from: w && w.from != null ? int(w.from, 0, 3, 0) : null, k: cleanTile(w && w.k), label: cut(w && w.label, 30), items: arr(w && w.items, 12).map(x => cut(x, 12)) })),
          hands: arr(ls.hands, 4).map(x => ({ key: cut(x && x.key, 4), hand: cleanTiles(x && x.hand, 18) })) } : null,
        players: arr(v.players, 4).map((p, i) => Object.assign(P(p), { key: "s" + i })), log: cleanLog(v.log) };
    },
    text(v, i, inv, pv) {
      const M = MJ(), N = M.name;
      return (M.VARIANTS[v.variant] || {}).zh + " 第 " + v.handNo + " / " + v.hands + " 盘，牌墙还剩 " + v.wallN + " 张。\n" + v.players.map(p => p.name + "：" + (p.out ? "糊了离桌；" : "") + (p.melds.length ? "亮着 " + p.melds.map(m => m.tiles.map(N).join("")).join(" ") + "；" : "门前清；") + "打过 " + (p.river.slice(-6).map(N).join(" ") || "还没打") + "；" + p.pts + " 分").join("\n")
        + (pv && pv.hand ? "\n你手里：" + pv.hand.map(N).join(" ") : "") + (v.status === "finished" ? "" : v.phase === "claim" ? "\n" + nmOf(inv, v.claim.from) + " 刚打了 " + N(v.claim.k) + "。" : "\n轮到 " + nmOf(inv, v.turn) + "。");
    }
  });
  // 角色那台的本地牌手：能自摸就摸；别的照单机那位牌手出（只看自己的牌，别人的手牌是空的）
  ADAPTERS.mahjong.charMove = function (view, i, inv, ctx) {
    const pv = ctx.priv; if (!pv) return { pass: true };
    const M = MJ(), slip = charSlip(ctx, inv);
    if (view.phase === "claim") {
      const o = pv.claim || []; if (!o.length) return { kind: "pass" };
      if (o.some(x => x.kind === "ron")) return { kind: "ron" };
      const st = mjLocal(view, i, pv);
      try { return M.botClaim(st, i, false, false, slip); } catch (e) { return { kind: "pass" }; }
    }
    const self = pv.self || [];
    if (self.some(x => x.kind === "zimo")) return { kind: "zimo" };
    const st = mjLocal(view, i, pv);
    if (st.players[i].riichi && pv.drawn) return { kind: "discard", k: pv.drawn };
    const kg = self.find(x => x.kind === "ckong" || x.kind === "akong"); if (kg && slip < .3) return { kind: kg.kind, k: kg.k };
    try { return { kind: "discard", k: M.botDiscard(st, i, false, slip) }; } catch (e) { return { kind: "discard", k: pv.hand[pv.hand.length - 1] }; }
  };
  // ───────────── 谁是卧底 ─────────────
  //   词只在庄那台；每人的词发到自己那台。描述、投票按座位一个一个来；票在大家都投完之前只公开「谁投了」，不公开投给谁
  const SPY_MAX_ROUNDS = 8;
  const spyAlive = st => st.alive.map((a, i) => a ? i : -1).filter(i => i >= 0);
  const spyClues = (st, inv) => st.clues.map(c => ({ name: nmOf(inv, c.seat), text: c.text }));
  function spyNextPhase(st, inv) {
    const alive = spyAlive(st), spies = alive.filter(i => st.roles[i] === "spy").length, civ = alive.length - spies;
    if (!spies) return Object.assign(st, { phase: "done", win: "civ" });
    if (spies >= civ || st.round >= SPY_MAX_ROUNDS) return Object.assign(st, { phase: "done", win: "spy" });
    st.round += 1; st.phase = "clue"; st.queue = alive; st.qi = 0; st.votes = {};
    st.log.push({ text: "—— 第 " + st.round + " 轮描述 ——" });
    return st;
  }
  // 给描述和投票的两句出口（只这一桌用；单机那份提示词本身不动）
  const SPY_CLUE_HINT = "\n\n每人一句只给一个侧面，挑前面（包括前几轮）还没人说过的那一面；觉得自己的词跟大家不太一路，就贴着大家的说法说。";
  const SPY_VOTE_EARLY = "\n\n这才第一轮，每人只说了一句，信息很少：真看出谁不对劲就投，拿不准就弃票（target 填「弃票」），大部分人这时候该是拿不准的。";
  ADAPTERS.spy = {
    // 描述本身就是桌上说的话；每人手里一个词，NPC 的描述不并进别人的调用
    zh: "谁是卧底", needPriv: true, mergeNpc: null,
    // 投完一轮（有人出局、或者出局的卧底猜完词）回到描述：停一下
    roundEnd: (p, n) => (p.phase === "vote" || p.phase === "guess") && n.phase === "clue" ? (lastLine(n) || "这一轮投完了") : "",
    seatRange: () => ({ min: 3, max: 12 }),
    async init(inv, ctx) {
      const S = GS().spy;
      if (!ctx.hostApi) throw new Error("出词用的是开局的人那台的线路：先去 设置·API 配一条");
      const out = await S.setup(ctx.hostApi, [], 0);
      const pair = out && out.pair;
      if (!pair || !pair.civ || !pair.spy) throw new Error("出词没出成，再点一次开始");
      const n = inv.seats.length, k = n >= 7 ? 2 : 1, idx = inv.seats.map((s, i) => i).sort(() => Math.random() - .5).slice(0, k);
      const roles = inv.seats.map((s, i) => idx.indexOf(i) >= 0 ? "spy" : "civ");
      const st = { phase: "clue", round: 0, civ: cut(pair.civ, 20), spyW: cut(pair.spy, 20), roles, words: roles.map(r => r === "spy" ? cut(pair.spy, 20) : cut(pair.civ, 20)), alive: roles.map(() => true),
        clues: [], votes: {}, queue: [], qi: 0, out: -1, win: "", spyN: k, log: [{ text: "发好词了：" + n + " 个人，" + k + " 个卧底。每人只看得到自己的词。" }] };
      return spyNextPhase(st, inv);
    },
    view(st) {
      const done = st.phase === "done";
      return { phase: st.phase, round: st.round, alive: st.alive.slice(), clues: st.clues.slice(-60), voted: Object.keys(st.votes).map(Number), queue: st.queue.slice(), qi: st.qi, out: st.out, spyN: st.spyN, win: st.win,
        reveal: done ? { civ: st.civ, spy: st.spyW, roles: st.roles.slice() } : null, outRoles: st.alive.map((a, i) => a ? "" : st.roles[i]), log: st.log.slice(-40) };
    },
    priv: (st, i) => ({ word: st.words[i] }),
    turn: v => v.phase === "clue" || v.phase === "vote" ? (v.queue[v.qi] != null ? v.queue[v.qi] : -1) : v.phase === "guess" ? v.out : -1,
    apply(st, i, mv, ctx) {
      const inv = ctx.inv;
      if (st.phase === "done") return { err: "这一局已经结束了" };
      if (mv && (mv.end || mv.reveal)) return { st: Object.assign(clone(st), { phase: "done", win: st.win || "none" }) };
      if (i !== this.turn(st)) return { err: "还没轮到这一位" };
      const n = clone(st), nm = nmOf(inv, i);
      if (n.phase === "clue") {
        const text = cut(mv && mv.text, 60).trim() || "（没说）";
        n.clues.push({ seat: i, round: n.round, text }); n.log.push({ text: nm + "：" + text });
        n.qi++;
        if (n.qi >= n.queue.length) { n.phase = "vote"; n.qi = 0; n.queue = spyAlive(n); n.log.push({ text: "—— 投票（大家都投完才亮票）——" }); }
        return { st: n };
      }
      if (n.phase === "vote") {
        const tg = int(mv && mv.target, -1, 11, -1);
        n.votes[i] = tg >= 0 && tg !== i && n.alive[tg] ? tg : -1;
        n.qi++;
        if (n.qi < n.queue.length) return { st: n };
        const cnt = {}; Object.keys(n.votes).forEach(k => { const v = n.votes[k]; if (v >= 0) cnt[v] = (cnt[v] || 0) + 1; });
        n.log.push({ text: "亮票：" + Object.keys(n.votes).map(k => nmOf(inv, +k) + "→" + (n.votes[k] >= 0 ? nmOf(inv, n.votes[k]) : "弃票")).join("，") });
        const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]), best = top[0] != null ? cnt[top[0]] : 0;
        if (!best || (top[1] != null && cnt[top[1]] === best)) { n.log.push({ text: "平票，这一轮没人出局。" }); return { st: spyNextPhase(n, inv) }; }
        const o = +top[0]; n.alive[o] = false; n.out = o;
        n.log.push({ text: nmOf(inv, o) + " 出局，亮出身份：" + (n.roles[o] === "spy" ? "卧底" : "平民") + "。" });
        if (n.roles[o] === "spy") { n.phase = "guess"; n.log.push({ text: nmOf(inv, o) + " 可以猜一次平民的词，猜中卧底翻盘。" }); return { st: n }; }
        return { st: spyNextPhase(n, inv) };
      }
      // 出局的卧底猜词
      const g = cut(mv && mv.guess, 30).trim();
      if (g && GS().spy.hits(g, n.civ)) { n.log.push({ text: nm + " 猜「" + g + "」——猜中了，卧底翻盘！" }); return { st: Object.assign(n, { phase: "done", win: "spy" }) }; }
      n.log.push({ text: g ? nm + " 猜「" + g + "」，没猜中。" : nm + " 没猜。" });
      return { st: spyNextPhase(n, inv) };
    },
    // 一个人这一手：描述／投票／猜词，都是单机那几枪，只喂这一个人
    async think(v, i, inv, api, who, word, role) {
      const S = GS().spy, clues = (v.clues || []).map(c => ({ name: nmOf(inv, c.seat), text: c.text }));
      if (!api) return v.phase === "clue" ? { text: "" } : v.phase === "vote" ? { target: -1 } : { guess: "" };
      const me = { name: who.name, word, role, skill: "普通", persona: who.persona };
      // 前几轮说过的也摆上（标着第几轮）：换一个侧面说，别把别人已经说过的点再说一遍
      if (v.phase === "clue") { const rows = await S.clues(api, [me], (v.clues || []).map(c => ({ name: (c.round === v.round ? "" : "（第 " + c.round + " 轮）") + nmOf(inv, c.seat), text: c.text })), v.round, inv.mode, SPY_CLUE_HINT); return { text: cut(((rows || [])[0] || {}).text, 60) }; }
      if (v.phase === "vote") {
        const names = v.alive.map((a, j) => a && j !== i ? nmOf(inv, j) : null).filter(Boolean);
        const rows = await S.votes(api, [me], clues, names, inv.mode, "", v.round <= 1 ? SPY_VOTE_EARLY : ""), t = String(((rows || [])[0] || {}).target || "").trim();
        return { target: v.alive.findIndex((a, j) => a && j !== i && nmOf(inv, j) === t) };
      }
      const r = await S.guess(api, me, clues, inv.mode); return { guess: cut(r && r.guess, 30) };
    },
    // NPC 跟角色一样只拿自己那个词、不知道自己是不是卧底（庄那台手里有全部的词，一个字都不往这次调用里放）
    npcMove(st, i, inv, ctx) { return this.think(this.view(st), i, inv, ctx.hostApi, NPC_WHO(nmOf(inv, i)), st.words[i], "unknown").catch(() => ({ pass: true })); },
    // 角色只拿得到自己的词：不知道自己是不是卧底
    charMove(view, i, inv, ctx) { if (!ctx.priv || !ctx.api) return { pass: true }; return this.think(view, i, inv, ctx.api, charWho(ctx.char, ctx.opts), ctx.priv.word, "unknown").catch(() => ({ pass: true })); },
    result(st, inv) {
      if (st.phase !== "done") return null;
      const spies = st.roles.map((r, i) => r === "spy" ? i : -1).filter(i => i >= 0), civs = st.roles.map((r, i) => r === "civ" ? i : -1).filter(i => i >= 0);
      const text = "卧底是 " + spies.map(i => nmOf(inv, i)).join("、") + "（词「" + st.spyW + "」），平民词「" + st.civ + "」，" + (st.win === "spy" ? "卧底赢了" : st.win === "civ" ? "平民赢了" : "提前结束") + "，打了 " + st.round + " 轮。";
      return { winners: st.win === "spy" ? spies : st.win === "civ" ? civs : [], text, replay: { rows: st.roles.map((r, i) => nmOf(inv, i) + "：" + (r === "spy" ? "卧底" : "平民") + "「" + st.words[i] + "」"), log: st.log.map(x => x.text) } };
    },
    cleanReplay: r => ({ rows: arr(r.rows, 12).map(x => cut(x, 120)), log: arr(r.log, 80).map(x => cut(x, 300)) }),
    cleanView(v) {
      const rv = v.reveal;
      return { phase: ["clue", "vote", "guess", "done"].indexOf(v.phase) >= 0 ? v.phase : "clue", round: int(v.round, 0, 20, 0), alive: arr(v.alive, 12).map(Boolean),
        clues: arr(v.clues, 80).map(c => ({ seat: int(c && c.seat, 0, 11, 0), round: int(c && c.round, 0, 20, 0), text: cut(c && c.text, 60) })), voted: arr(v.voted, 12).map(x => int(x, 0, 11, 0)),
        queue: arr(v.queue, 12).map(x => int(x, 0, 11, 0)), qi: int(v.qi, 0, 12, 0), out: int(v.out, -1, 11, -1), spyN: int(v.spyN, 1, 3, 1), win: ["spy", "civ", "none", ""].indexOf(v.win) >= 0 ? v.win : "",
        reveal: rv && v.phase === "done" ? { civ: cut(rv.civ, 20), spy: cut(rv.spy, 20), roles: arr(rv.roles, 12).map(r => r === "spy" ? "spy" : "civ") } : null,
        outRoles: arr(v.outRoles, 12).map(r => r === "spy" || r === "civ" ? r : ""), log: cleanLog(v.log) };
    },
    stateText(v, i, inv, pv) {
      const now = v.phase === "done" ? "这一局结束了：" + (v.win === "spy" ? "卧底赢" : v.win === "civ" ? "平民赢" : "提前结束") + (v.reveal ? "，平民词「" + v.reveal.civ + "」、卧底词「" + v.reveal.spy + "」" : "") + "。"
        : v.phase === "clue" ? "第 " + v.round + " 轮描述，轮到 " + nmOf(inv, v.queue[v.qi]) + "。" : v.phase === "vote" ? "投票中，已经投了 " + v.voted.length + " 个人。" : nmOf(inv, v.out) + " 被投出局，正在猜平民的词。";
      return "还在场的：" + v.alive.map((a, j) => a ? nmOf(inv, j) : null).filter(Boolean).join("、") + "。\n描述：\n" + v.clues.slice(-12).map(c => "· " + nmOf(inv, c.seat) + "：" + c.text).join("\n") + "\n" + now
        + (pv && pv.word && v.phase !== "done" ? "\n你拿到的词是「" + pv.word + "」（别说出来，也别说你是不是卧底——你自己也不知道）" : "");
    }
  };
  NC.CHAR_OPTS.spy = ["recent"];

  // ───────────── 心有灵犀（两人）─────────────
  //   两个人各写各的，庄那台攒着，两边都交了才一起亮；没亮之前公开那份只说「谁交了」
  const LX_MAX = 30;
  ADAPTERS.lingxi = {
    zh: "心有灵犀", needPriv: true, mergeNpc: null,
    roundEnd: (p, n) => (n.rounds || []).length > (p.rounds || []).length ? (lastLine(n) || "这一轮亮词了") : "",
    seatRange: () => ({ min: 2, max: 2 }),
    init: () => ({ phase: "start", words: [null, null], start: null, pair: null, rounds: [], log: [{ text: "两个人先各自悄悄写一个起始词。" }] }),
    view: st => ({ phase: st.phase, sent: st.words.map(w => w != null), start: st.start, pair: st.pair, rounds: st.rounds.slice(-40), log: st.log.slice(-30) }),
    priv: (st, i) => ({ mine: st.words[i] }),
    // 大家同时写：两边都能随时交（角色在主人那台、NPC 在庄那台同时想），都交了才一起亮
    //   turn 只给「第一个没交的」兜底；turns／waiting 才是此刻能动的那几座；roundOf 让同一轮同一座只想一次
    turn: v => v.phase === "done" ? -1 : v.sent ? v.sent.findIndex(x => !x) : v.words.findIndex(w => w == null),
    turns: v => v.phase === "done" ? [] : [0, 1].filter(i => !(v.sent ? v.sent[i] : v.words[i] != null)),
    waiting(v) { return this.turns(v); },
    roundOf: v => v.phase + ":" + (v.rounds || []).length,
    apply(st, i, mv, ctx) {
      const L = root.LingxiCore;
      if (st.phase === "done") return { err: "这一局已经结束了" };
      if (mv && (mv.end || mv.reveal)) return { st: Object.assign(clone(st), { phase: "done" }) };
      if (i < 0 || i > 1) return { err: "这一位不在桌上" };
      if (st.words[i] != null) return { err: "这一轮你已经交了" };
      const w = L.cleanWord(mv && mv.word);
      if (!w) return { err: "写一个词" };
      const n = clone(st); n.words[i] = w;
      if (n.words.some(x => x == null)) return { st: n };
      const inv = ctx.inv;
      if (n.phase === "start") { n.start = n.words.slice(); n.pair = n.words.slice(); n.phase = "round"; n.log.push({ text: "起始词：" + nmOf(inv, 0) + "「" + n.start[0] + "」，" + nmOf(inv, 1) + "「" + n.start[1] + "」" }); }
      else {
        const hit = L.same(n.words[0], n.words[1]);
        n.rounds.push({ n: n.rounds.length + 1, pair: n.pair.slice(), w: n.words.slice(), hit });
        n.log.push({ text: "第 " + n.rounds.length + " 轮：「" + n.pair[0] + "」+「" + n.pair[1] + "」→ " + nmOf(inv, 0) + "「" + n.words[0] + "」，" + nmOf(inv, 1) + "「" + n.words[1] + "」" + (hit ? "，对上了！" : "") });
        n.pair = n.words.slice();
        if (n.rounds.length >= LX_MAX) n.phase = "done";
      }
      n.words = [null, null];
      return { st: n };
    },
    // 从这个座位看过去：桌上「对面的词」在前、「我的」在后——单机那两段提示词就是这么摆的
    //   who.withSay：同一次顺带要亮词前嘴上那句（提示词里写着不许透露自己的词）
    async think(v, i, inv, api, who) {
      const L = root.LingxiCore, o = 1 - i, oName = nmOf(inv, o), sayFree = who.withSay ? GS().sayFree || "" : "";
      if (!api) return { pass: true };
      const st = { rounds: (v.rounds || []).map(r => ({ n: r.n, pair: [r.pair[o], r.pair[i]], mine: r.w[o], yours: r.w[i], hit: r.hit, manual: false })), pair: v.pair ? [v.pair[o], v.pair[i]] : null, talk: [] };
      const whoTxt = "\n\n【你是】" + who.name + (who.persona ? "\n" + cut(who.persona, 1800) : "");
      const sys = GS().voiceRules() + (v.phase === "start" ? L.openPrompt({ uName: oName, who: whoTxt, sayFree }) : L.roundPrompt({ uName: oName, who: whoTxt, state: st, easy: inv.mode === "easy", sayFree }));
      const raw = await GS().call(api, sys, [{ role: "user", content: "轮到你。" }], { maxTokens: 12000 });
      const p = (root.extractJSON ? root.extractJSON(String(raw || "")) : null) || {};
      const w = L.cleanWord(p.word), say = who.withSay && GS().sayList ? GS().sayList(p.say).join(" ") : "";
      return w ? Object.assign({ word: w }, say ? { say } : {}) : { pass: true };
    },
    // NPC 也顺带一句亮词前的话（同一次调用，不另花）
    npcMove(st, i, inv, ctx) { return this.think(this.view(st), i, inv, ctx.hostApi, Object.assign(NPC_WHO(nmOf(inv, i)), { withSay: true })).catch(() => ({ pass: true })).then(m => m.pass ? { word: "随便" } : m); },
    charMove(view, i, inv, ctx) { return this.think(view, i, inv, ctx.api, Object.assign(charWho(ctx.char, ctx.opts), ctx.opts && ctx.opts.talk === false ? {} : { withSay: true })).catch(() => ({ pass: true })); },
    result(st, inv) {
      if (st.phase !== "done") return null;
      const s = st.rounds.filter(r => r.hit).length;
      return { winners: [], text: nmOf(inv, 0) + " 和 " + nmOf(inv, 1) + " 连了 " + st.rounds.length + " 轮，对上 " + s + " 次" + (st.start ? "（起始词「" + st.start[0] + "」「" + st.start[1] + "」）" : "") + "。",
        replay: { rows: st.rounds.map(r => "第 " + r.n + " 轮「" + r.pair[0] + "」+「" + r.pair[1] + "」→「" + r.w[0] + "」「" + r.w[1] + "」" + (r.hit ? " ✓" : "")), log: st.log.map(x => x.text) } };
    },
    cleanReplay: r => ({ rows: arr(r.rows, 40).map(x => cut(x, 120)), log: arr(r.log, 60).map(x => cut(x, 300)) }),
    cleanView(v) {
      const two = a => Array.isArray(a) && a.length === 2 ? [cut(a[0], 20), cut(a[1], 20)] : null;
      return { phase: ["start", "round", "done"].indexOf(v.phase) >= 0 ? v.phase : "start", sent: [!!(v.sent && v.sent[0]), !!(v.sent && v.sent[1])], start: two(v.start), pair: two(v.pair),
        rounds: arr(v.rounds, 40).map(r => ({ n: int(r && r.n, 1, 99, 1), pair: two(r && r.pair) || ["", ""], w: two(r && r.w) || ["", ""], hit: !!(r && r.hit) })), log: cleanLog(v.log) };
    },
    stateText: (v, i, inv, pv) => (v.phase === "start" ? "两个人在写起始词。" : "桌上的两个词：「" + (v.pair || [])[0] + "」（" + nmOf(inv, 0) + "）和「" + (v.pair || [])[1] + "」（" + nmOf(inv, 1) + "）。")
      + "\n往期：" + (v.rounds.slice(-6).map(r => "「" + r.w[0] + "」/「" + r.w[1] + "」" + (r.hit ? "对上" : "没对上")).join("；") || "还没有") + "。对上 " + v.rounds.filter(r => r.hit).length + " 次。"
      + (pv && pv.mine ? "\n你这一轮已经写了「" + pv.mine + "」（还没亮）" : "")
  };
  NC.CHAR_OPTS.lingxi = ["recent"];
  // 横幅上「第几轮／第几手」（框架 roundText 来问）：有轮次的才给
  const nth = (n, unit) => "第 " + Math.max(1, n | 0) + " " + unit;
  ADAPTERS.liar.roundLabel = v => nth(v.round, "轮");
  ADAPTERS.poker.roundLabel = v => nth(v.hand, "手");
  ADAPTERS.blackjack.roundLabel = v => nth(v.hand, "手");
  ADAPTERS.doudizhu.roundLabel = v => nth(v.round, "手");
  ADAPTERS.mahjong.roundLabel = v => nth(v.handNo, "盘");
  ADAPTERS.spy.roundLabel = v => nth(v.round, "轮");
  ADAPTERS.lingxi.roundLabel = v => nth(((v.rounds || []).length) + (v.phase === "done" ? 0 : 1), "轮");

  // ───────────── 界面 ─────────────
  if (typeof React === "undefined" || !root.NetGameUI) return;
  const h = React.createElement, { useState, useEffect } = React;
  const K = root.NetGameUI.kit, pill = K.pill, note = K.note, box = K.box, fs = K.fs;
  const actorOf = NC.actorOf;
  const small = (t, on) => Object.assign(pill(t, on), { minHeight: 34, padding: "0 12px", fontSize: fs(12.5) });
  const sub = (t, s) => h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, lineHeight: 1.55, textAlign: "center" } }, s);
  // 一排座位：名字＋公开的那一行（几张、几条命、几个筹码），轮到谁谁描深
  // 围着桌子一圈头像、轮到谁亮圈：单机牌桌那一份 CardSeats；手里几张用牌背扇开（cardsOf 给张数）
  function Seats({ t, inv, view, ti, subOf, outOf, cardsOf }) {
    const list = view.players || inv.seats;
    return h("div", { "data-wk": "nrcardseats" }, h(CD().Seats, { t, log: [], seats: list.map((p, i) => { const s = inv.seats[i] || {}, nm = s.name || p.name || "?";
      return { key: "s" + i, name: nm, char: K.faceChar ? K.faceChar(Object.assign({ kind: "user" }, s, { name: nm })) : { name: nm }, isUser: s.kind === "user", on: i === ti, out: outOf ? !!outOf(p, i) : false, cards: cardsOf ? cardsOf(p, i) : null, sub: subOf(p, i) }; }) }));
  }
  // 牌桌记录：单机那一块 CardLog（最新一行贴底）
  const Log = ({ t, log, n, part }) => h("div", { "data-wk": "nrcardlog" }, h(CD().Log, { t, part: part || "net", log: (log || []).slice(-(n || 12)).map(x => ({ kind: "act", text: x.text })), seats: [] }));
  const Row = ({ children, wk }) => h("div", { "data-wk": wk || "nrcardhand", className: "flex flex-wrap justify-center", style: { gap: 4 } }, children);
  function useMine(inv, view, me, turnOf) {
    const ti = view.status === "finished" ? -1 : turnOf(view), seat = inv.seats[ti];
    return { ti, myTurn: ti >= 0 && actorOf(seat, me, inv.host) === "mine-user", mySeat: inv.seats.findIndex(s => s.kind === "user" && s.peer === me), seat };
  }
  const waitLine = (inv, ti, seat, verb) => ti < 0 ? "" : seat && seat.away ? nmOf(inv, ti) + " 掉线了，NPC 先替着…" : nmOf(inv, ti) + " " + (verb || "在想…");
  const Card = (c, w, extra) => h(CD().PlayCard, Object.assign({ c, w: w || 34 }, extra || {}));
  const Back = (w, k) => h(CD().PlayCard, { key: k, c: null, back: true, w: w || 24 });
  const wrap = (game, kids) => h("div", { "data-wk": "nrgametable", "data-game": game, style: { padding: "6px 14px 12px", display: "flex", flexDirection: "column", gap: 10 } }, kids);

  const UNO_BG = { R: "#d64541", Y: "#e0b13a", G: "#3f9a5a", B: "#3a6fc4", W: "#2f2a24" };
  // UNO 牌面：单机那一张 UnoCard（手里那张小一点，出不了的灰掉）
  const UnoChip = ({ c, on, onClick, dim, hand }) => h("span", { "data-wk": "nrunocard" }, h(CD().UnoCard, { c, hand: hand !== false, ok: !dim, picked: on, onClick }));
  function UnoTable({ inv, view, priv, me, onMove }) {
    const t = useTheme(), U = CD().uno.C, m = useMine(inv, view, me, v => v.turn);
    const [pick, setPick] = useState(null); useEffect(() => setPick(null), [view.log.length]);
    const hand = (priv && priv.hand) || [], st = { discard: view.top ? [view.top] : [], color: view.color, pendingDraw: view.pendingDraw, rules: view.rules };
    const ok = c => m.myTurn && U.playable(c, st, hand) && (!priv.drawnUid || c.uid === priv.drawnUid);
    const play = (c, color) => onMove(m.ti, { kind: "play", uid: c.uid, color });
    return wrap("uno", [
      h(Seats, { key: "s", t, inv, view, ti: m.ti, subOf: p => p.n + " 张", cardsOf: p => p.n }),
      h("div", { key: "c", className: "flex items-center justify-center", style: { gap: 10 } }, view.top ? h(UnoChip, { c: view.top, hand: false }) : null,
        sub(t, "当前 " + (U.LABEL[view.color] || "") + "色 · " + (view.direction > 0 ? "顺时针" : "逆时针") + " · 牌堆 " + view.deckN + (view.pendingDraw ? " · 罚 " + view.pendingDraw + " 张" : ""))),
      view.status === "finished" ? note(t, nmOf(inv, seatOf(view.winner)) + " 先出完了") : note(t, m.myTurn ? (view.pendingDraw ? "要摸 " + view.pendingDraw + " 张" + (view.rules.stackD2 ? "，或者叠一张 +2" : "") : priv && priv.drawnUid ? "刚摸的那张能出：出，或者不出" : "轮到你：出一张，或者摸一张") : waitLine(inv, m.ti, m.seat)),
      m.mySeat >= 0 ? h("div", { key: "h", "data-wk": "nrcardhand", style: { display: "flex", overflowX: "auto", gap: 5, paddingBottom: 6 } }, hand.map(c => h(UnoChip, { key: c.uid, c, on: pick === c.uid, dim: m.myTurn && !ok(c), onClick: ok(c) ? () => c.color === "W" ? setPick(c.uid) : play(c) : null }))) : null,
      pick ? h("div", { key: "w", className: "flex justify-center", style: { gap: 6 } }, ["R", "Y", "G", "B"].map(col => h("button", { key: col, "data-wk": "nrunocolor", onClick: () => play(hand.find(c => c.uid === pick), col), style: Object.assign(small(t, false), { background: UNO_BG[col], color: "#fff", border: 0 }) }, U.LABEL[col]))) : null,
      m.myTurn ? h("div", { key: "a", "data-wk": "nrcardact", className: "flex flex-wrap justify-center", style: { gap: 6 } },
        view.pendingDraw ? h("button", { onClick: () => onMove(m.ti, { kind: "draw" }), style: small(t, true) }, "摸 " + view.pendingDraw + " 张") : priv && priv.drawnUid ? h("button", { onClick: () => onMove(m.ti, { kind: "pass" }), style: small(t, false) }, "不出") : h("button", { onClick: () => onMove(m.ti, { kind: "draw" }), style: small(t, false) }, "摸一张"),
        view.pendingDraw && view.w4 ? h("button", { onClick: () => onMove(m.ti, { kind: "challenge" }), style: small(t, false) }, "质疑 +4") : null) : null,
      h(Log, { key: "l", t, log: view.log })]);
  }
  const seatOf = k => { const m = /^s(\d+)$/.exec(String(k || "")); return m ? +m[1] : -1; };

  function LiarTable({ inv, view, priv, me, onMove }) {
    const t = useTheme(), m = useMine(inv, view, me, v => v.turn), D = CD().Die, total = view.players.filter(p => p.lives > 0).length * (CD().liar.DICE || 5);
    const b = view.bid, [n, setN] = useState(1), [f, setF] = useState(2);
    useEffect(() => { if (b) { setN(b.f === 6 ? b.n + 1 : b.n); setF(b.f === 6 ? 2 : b.f + 1); } else { setN(1); setF(2); } }, [view.log.length]);
    const legal = CD().liar.legal(b, { n, f }, total), ls = view.lastShow;
    return wrap("liar", [
      h(Seats, { key: "s", t, inv, view, ti: m.ti, subOf: p => p.lives > 0 ? p.lives + " 条命" : "出局" }),
      note(t, view.status === "finished" ? nmOf(inv, seatOf(view.winner)) + " 撑到了最后" : b ? "叫到：" + b.n + " 个 " + b.f + "（" + nmOf(inv, seatOf(b.by)) + "）" : "第 " + view.round + " 轮，还没人叫"),
      ls ? h("div", { key: "ls", "data-wk": "nrliarshow", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, textAlign: "center" } }, "上一轮亮骰：" + ls.dice.map(d => nmOf(inv, seatOf(d.key)) + " " + d.dice.join("")).join(" · ") + "，一共 " + ls.got + " 个" + (ls.bid ? ls.bid.f : "")) : null,
      m.mySeat >= 0 && priv ? h(Row, { key: "h" }, (priv.dice || []).map((d, j) => h(D, { key: j, v: d, size: 34, hot: b && (d === b.f || d === 1) }))) : null,
      m.myTurn ? h("div", { key: "a", "data-wk": "nrcardact", style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "center" } },
        h("div", { className: "flex items-center", style: { gap: 6, fontFamily: F_BODY, fontSize: fs(13), color: t.ink } },
          h("button", { onClick: () => setN(Math.max(1, n - 1)), style: small(t, false) }, "−"), n + " 个", h("button", { onClick: () => setN(Math.min(total, n + 1)), style: small(t, false) }, "＋"),
          [2, 3, 4, 5, 6].map(x => h("button", { key: x, onClick: () => setF(x), style: small(t, f === x) }, x))),
        h("div", { className: "flex", style: { gap: 6 } }, h("button", { disabled: !legal, onClick: () => onMove(m.ti, { kind: "bid", n, f }), style: Object.assign(small(t, true), { opacity: legal ? 1 : .45 }) }, "叫 " + n + " 个 " + f),
          b ? h("button", { onClick: () => onMove(m.ti, { kind: "open" }), style: small(t, false) }, "开！") : null)) : view.status !== "finished" ? sub(t, waitLine(inv, m.ti, m.seat)) : null,
      h(Log, { key: "l", t, log: view.log })]);
  }

  function PokerTable({ inv, view, priv, me, onMove }) {
    const t = useTheme(), m = useMine(inv, view, me, v => v.street === "done" ? -1 : v.turn), ls = view.lastShow;
    const p = view.players[m.ti] || {}, toCall = Math.max(0, view.curBet - (p.bet || 0)), minTo = view.curBet + view.minRaise, [to, setTo] = useState(0);
    useEffect(() => setTo(minTo), [view.log.length]);
    return wrap("poker", [
      h(Seats, { key: "s", t, inv, view, ti: m.ti, subOf: q => q.folded ? "弃了" : q.allin ? "全押" : q.chips + (q.bet ? " · 下 " + q.bet : "") }),
      h(Row, { key: "b", wk: "nrpokerboard" }, view.board.length ? view.board.map((c, j) => h("div", { key: j }, Card(c, 32))) : sub(t, "公共牌还没发")),
      sub(t, "第 " + view.hand + " 手 · 底池 " + view.players.reduce((s, q) => s + q.put, 0)),
      ls && ls.showdown ? h("div", { key: "ls", "data-wk": "nrpokershow", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, textAlign: "center" } }, "上一手摊牌：" + ls.showdown.map(x => nmOf(inv, seatOf(x.key)) + " " + x.hole.map(CD().name).join("") + "（" + x.cat + "）").join(" · ")) : null,
      m.mySeat >= 0 && priv ? h(Row, { key: "h" }, (priv.hole || []).map((c, j) => h("div", { key: j }, Card(c, 44)))) : null,
      view.status === "finished" ? note(t, "收桌：" + nmOf(inv, seatOf(view.winner)) + " 筹码最多") : m.myTurn ? h("div", { key: "a", "data-wk": "nrcardact", style: { display: "flex", flexDirection: "column", gap: 6, alignItems: "center" } },
        h("div", { className: "flex flex-wrap justify-center", style: { gap: 6 } },
          h("button", { onClick: () => onMove(m.ti, { kind: "fold" }), style: small(t, false) }, "弃牌"),
          h("button", { onClick: () => onMove(m.ti, { kind: toCall ? "call" : "check" }), style: small(t, true) }, toCall ? "跟 " + Math.min(toCall, p.chips) : "过牌"),
          h("button", { onClick: () => onMove(m.ti, { kind: "allin" }), style: small(t, false) }, "全押")),
        p.chips > toCall ? h("div", { className: "flex items-center", style: { gap: 6, fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink } },
          h("button", { onClick: () => setTo(Math.max(minTo, to - 20)), style: small(t, false) }, "−"), "加到 " + to, h("button", { onClick: () => setTo(Math.min(p.bet + p.chips, to + 20)), style: small(t, false) }, "＋"),
          h("button", { onClick: () => onMove(m.ti, { kind: "raise", to }), style: small(t, true) }, "加注")) : null) : sub(t, waitLine(inv, m.ti, m.seat, "在看牌…")),
      h(Log, { key: "l", t, log: view.log })]);
  }

  function OldMaidTable({ inv, view, priv, me, onMove }) {
    const t = useTheme(), m = useMine(inv, view, me, v => v.turn), tg = view.players[view.target] || { n: 0 };
    const [hov, setHov] = useState(-1); useEffect(() => setHov(-1), [view.log.length]);
    return wrap("oldmaid", [
      h(Seats, { key: "s", t, inv, view, ti: m.ti, subOf: p => p.out ? "上岸了" : p.n + " 张" }),
      view.status === "finished" ? note(t, nmOf(inv, seatOf(view.loser)) + " 捏着鬼牌，输了") : note(t, m.myTurn ? (hov >= 0 ? "再点一下第 " + (hov + 1) + " 张抽走" : "从 " + nmOf(inv, view.target) + " 手里抽一张") : waitLine(inv, m.ti, m.seat, "的手悬在牌上…")),
      m.myTurn ? h(Row, { key: "t", wk: "nrcardact" }, Array.from({ length: tg.n }, (_, j) => h("div", { key: j, onClick: () => hov === j ? onMove(m.ti, { pick: j }) : setHov(j), style: { marginTop: hov === j ? -8 : 0, cursor: "pointer" } }, Back(30)))) : null,
      m.mySeat >= 0 && priv ? h(Row, { key: "h" }, (priv.hand || []).map((c, j) => h("div", { key: j }, Card(c, 34)))) : null,
      h(Log, { key: "l", t, log: view.log })]);
  }

  function BjTable({ inv, view, priv, me, onMove }) {
    const t = useTheme(), m = useMine(inv, view, me, v => v.phase === "play" ? v.turn : -1), ls = view.lastShow, V = CD().bj.value, cards = (priv && priv.cards) || [], p = view.players[m.mySeat] || {};
    return wrap("blackjack", [
      h(Seats, { key: "s", t, inv, view, ti: m.ti, subOf: q => q.chips + " 筹码" + (q.bust ? " · 爆" : q.done ? " · 停" : "") }),
      h(Row, { key: "d", wk: "nrbjdealer" }, view.dealerUp ? [h("div", { key: "u" }, Card(view.dealerUp, 32))].concat(Array.from({ length: Math.max(0, view.dealerN - 1) }, (_, j) => h("div", { key: j }, Back(32)))) : null),
      sub(t, "第 " + view.hand + " 手 · 庄家亮一张"),
      ls ? h("div", { key: "ls", "data-wk": "nrbjshow", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, textAlign: "center" } }, "上一手：庄 " + ls.dealer.map(CD().name).join("") + "（" + V(ls.dealer) + "）· " + ls.hands.filter(x => x.cards.length).map(x => nmOf(inv, seatOf(x.key)) + " " + V(x.cards) + " " + x.result).join(" · ")) : null,
      m.mySeat >= 0 && cards.length ? h(Row, { key: "h" }, cards.map((c, j) => h("div", { key: j }, Card(c, 40)))) : null,
      m.mySeat >= 0 && cards.length ? sub(t, "你 " + V(cards) + " 点") : null,
      view.status === "finished" ? note(t, "散场：" + nmOf(inv, seatOf(view.winner)) + " 筹码最多") : m.myTurn ? h("div", { key: "a", "data-wk": "nrcardact", className: "flex justify-center", style: { gap: 6 } },
        h("button", { onClick: () => onMove(m.ti, { kind: "hit" }), style: small(t, true) }, "要牌"), h("button", { onClick: () => onMove(m.ti, { kind: "stand" }), style: small(t, false) }, "停牌"),
        cards.length === 2 && p.chips >= p.bet ? h("button", { onClick: () => onMove(m.ti, { kind: "double" }), style: small(t, false) }, "加倍") : null) : sub(t, waitLine(inv, m.ti, m.seat, "在想要不要再来一张…")),
      h(Log, { key: "l", t, log: view.log })]);
  }

  function DdzTable({ inv, view, priv, me, onMove }) {
    const t = useTheme(), m = useMine(inv, view, me, v => v.phase === "bid" ? v.bidTurn : v.phase === "play" ? v.turn : -1), T = CD().ddz.TYPE_ZH || {};
    const hand = (priv && priv.hand) || [], [pick, setPick] = useState([]); useEffect(() => setPick([]), [view.log.length]);
    const combo = pick.length ? CD().ddz.analyze(hand.filter(c => pick.indexOf(c.uid) >= 0)) : null, L = view.last, lead = !L || L.by === m.ti || L.cleared;
    return wrap("doudizhu", [
      h(Seats, { key: "s", t, inv, view, ti: m.ti, subOf: p => (p.role === "lord" ? "地主 · " : p.role ? "农民 · " : "") + p.n + " 张 · " + p.pts + " 分" }),
      // 出牌区：单机斗地主那块绒布（底牌一排＋桌上刚出的那手），GameShared.cards.ddz.Mid
      h("div", { key: "b", "data-wk": "nrddzbottom" }, h("div", { "data-wk": "nrddzlast" }, CD().felt([h(CD().ddz.Mid, { key: "m", bottom: view.phase === "bid" ? [null, null, null] : view.bottom, hideBottom: view.phase === "bid", bidN: view.bid && view.bid.n, mult: view.mult, phase: view.phase, round: view.round, logN: view.log.length,
        last: L && !L.cleared && view.phase === "play" ? { name: nmOf(inv, L.by), type: T[L.combo && L.combo.type] || "", cards: L.cards } : null, leader: m.ti >= 0 ? nmOf(inv, m.ti) : "" })], "doudizhu"))),
      view.status === "finished" ? note(t, "打完了：" + nmOf(inv, seatOf(view.winner)) + " 分最多") : note(t, view.phase === "bid" ? (m.myTurn ? "叫分：现在最高 " + view.bid.n + " 分" : waitLine(inv, m.ti, m.seat, "在想叫不叫…")) : m.myTurn ? (lead ? "你领出" : "压，还是不出") : waitLine(inv, m.ti, m.seat, "在理牌…")),
      m.mySeat >= 0 ? h(Row, { key: "h" }, hand.map((c, j) => h("div", { key: c.uid, style: { marginLeft: j ? -14 : 0, marginTop: pick.indexOf(c.uid) >= 0 ? -10 : 0 } }, Card(c, 36, { onClick: m.myTurn && view.phase === "play" ? () => setPick(p => p.indexOf(c.uid) >= 0 ? p.filter(x => x !== c.uid) : p.concat([c.uid])) : null })))) : null,
      m.myTurn && view.phase === "bid" ? h("div", { key: "a", "data-wk": "nrcardact", className: "flex justify-center", style: { gap: 6 } }, [0, 1, 2, 3].map(x => h("button", { key: x, disabled: x > 0 && x <= view.bid.n, onClick: () => onMove(m.ti, { n: x }), style: Object.assign(small(t, x > 0), { opacity: x > 0 && x <= view.bid.n ? .4 : 1 }) }, x ? x + " 分" : "不叫"))) : null,
      m.myTurn && view.phase === "play" ? h("div", { key: "p", "data-wk": "nrcardact", className: "flex justify-center", style: { gap: 6 } },
        h("button", { onClick: () => { const st = Object.assign({}, view, { players: view.players.map((p, j) => Object.assign({}, p, { hand: j === m.ti ? hand : [] })) }); setPick(CD().ddz.hint(st, m.ti)); }, style: small(t, false) }, "提示"),
        !lead ? h("button", { onClick: () => onMove(m.ti, { uids: [] }), style: small(t, false) }, "不出") : null,
        h("button", { disabled: !combo, onClick: () => onMove(m.ti, { uids: pick }), style: Object.assign(small(t, true), { opacity: combo ? 1 : .45 }) }, combo ? "出 " + (T[combo.type] || "") : "出牌")) : null,
      h(Log, { key: "l", t, log: view.log })]);
  }

  function MjTable({ inv, view, priv, me, onMove }) {
    const t = useTheme(), M = MJ(), m = useMine(inv, view, me, v => v.phase === "discard" || v.phase === "claim" ? v.turn : -1), Tile = CD().MjTile;
    const [pick, setPick] = useState(null); useEffect(() => setPick(null), [view.log.length]);
    const hand = (priv && priv.hand) || [], self = (priv && priv.self) || [], claim = (priv && priv.claim) || [];
    const ZH = { zimo: "自摸", ckong: "暗杠", akong: "加杠", riichi: "立直", ron: "糊", pong: "碰", kong: "杠", chow: "吃", pass: "过" };
    const tiles = (ks, w) => ks.map((k, j) => h("div", { key: j + k }, h(Tile, { k, w: w || 20 })));
    return wrap("mahjong", [
      h(Seats, { key: "s", t, inv, view, ti: m.ti, subOf: p => (p.out ? "糊了 · " : "") + p.n + " 张 · " + p.pts }),
      // 牌河：单机那张方桌（GameShared.cards.MjTable）——四边各家打过的牌、亮出的碰杠、立着的牌背、中间牌墙；我坐的那边朝下
      //   只喂公开那份：别家的手牌按张数画牌背，自己的手牌照旧在桌子下面那一排
      h("div", { key: "r", "data-wk": "nrmjriver" }, h(CD().MjTable, { size: Math.min(400, Math.max(280, (typeof window !== "undefined" ? window.innerWidth : 390) - 32)), meI: m.mySeat >= 0 ? m.mySeat : 0, spectate: false, canDraw: false,
        state: { status: view.status, phase: view.phase, turn: view.turn, claim: view.claim, last: view.last, dealer: view.dealer, variant: view.variant, doraInd: view.doraInd, pot: view.pot, log: view.log, wall: Array(view.wallN).fill(null),
          players: view.players.map((p, i) => Object.assign({}, p, { isUser: i === m.mySeat, hand: Array(p.n).fill(null) })) } })),
      sub(t, (M.VARIANTS[view.variant] || {}).zh + " 第 " + view.handNo + " / " + view.hands + " 盘 · 牌墙 " + view.wallN + (view.claim ? " · " + nmOf(inv, view.claim.from) + " 打了 " + M.name(view.claim.k) : "")),
      view.lastShow && view.lastShow.winners.length ? sub(t, "上一盘：" + view.lastShow.winners.map(w => nmOf(inv, w.winner) + (w.zimo ? " 自摸 " : " 糊 ") + (w.k ? M.name(w.k) : "") + " · " + w.label).join("；")) : null,
      view.status === "finished" ? note(t, "打完了：" + nmOf(inv, seatOf(view.winner)) + " 分最多") : note(t, m.myTurn ? (view.phase === "claim" ? "要不要这张 " + M.name(view.claim.k) : pick ? "再点一下打出 " + M.name(pick) : "轮到你：点一张打出去") : waitLine(inv, m.ti, m.seat)),
      m.mySeat >= 0 ? h(Row, { key: "h" }, hand.map((k, j) => h("div", { key: j + k, onClick: m.myTurn && view.phase === "discard" ? () => pick === k ? onMove(m.ti, { kind: "discard", k }) : setPick(k) : null, style: { marginTop: pick === k ? -8 : 0, cursor: "pointer", outline: priv && priv.drawn === k && j === hand.lastIndexOf(k) ? "1px dashed " + t.fog : "none" } }, h(Tile, { k, w: 26 })))) : null,
      m.myTurn && (self.length || claim.length) ? h("div", { key: "a", "data-wk": "nrcardact", className: "flex flex-wrap justify-center", style: { gap: 6 } },
        (view.phase === "claim" ? claim.concat([{ kind: "pass" }]) : self).map((o, j) => h("button", { key: j, onClick: () => onMove(m.ti, o.kind === "riichi" ? { kind: "riichi", k: pick && (o.ks || []).indexOf(pick) >= 0 ? pick : (o.ks || [])[0] } : o), style: small(t, o.kind !== "pass") },
          ZH[o.kind] + (o.use ? " " + o.use.map(M.name).join("") : o.k ? " " + M.name(o.k) : "")))) : null,
      h(Log, { key: "l", t, log: view.log, n: 4 })]);
  }

  // 谁是卧底那张桌：描述是单机那一溜头像＋气泡（GameShared.spy.Clue），投票是单机那排头像圆钮＋弃票（GameShared.spy.VotePick），选好了点「投票」
  function SpyTable({ inv, view, priv, me, onMove, onReveal, isHost }) {
    const t = useTheme(), SP = GS().spy, A = ADAPTERS.spy, ti = A.turn(view), seat = inv.seats[ti], myTurn = ti >= 0 && actorOf(seat, me, inv.host) === "mine-user";
    const [d, setD] = useState(""), [vote, setVote] = useState(null); useEffect(() => { setD(""); setVote(null); }, [view.log.length]);
    const mySeat = inv.seats.findIndex(s => s.kind === "user" && s.peer === me);
    const av = (i, size) => GS().avatarFor(t)({ name: nmOf(inv, i), char: K.faceChar ? K.faceChar(inv.seats[i] || {}) : null, isUser: (inv.seats[i] || {}).kind === "user" }, size);
    let lastRound = 0;
    const clues = (view.clues || []).slice(-24).map((c, k) => { const head = c.round && c.round !== lastRound ? (lastRound = c.round, h("div", { key: "r" + k, "data-wk": "gamelogline", "data-kind": "round", style: { textAlign: "center", fontFamily: F_BODY, fontSize: fs(11), color: t.fog, margin: "10px 0 4px", letterSpacing: 1 } }, "· 第 " + c.round + " 轮描述 ·")) : null;
      return [head, h(SP.Clue, { key: "c" + k, t, mine: c.seat === mySeat, youTag: "", name: nmOf(inv, c.seat), av: av(c.seat, 30), text: c.text })]; });
    return wrap("spy", [
      mySeat >= 0 && priv ? h("div", { key: "w", "data-wk": "nrspyword", style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: fs(18), color: t.ink } }, "你的词：", priv.word) : sub(t, "你在旁边看，看不到任何人的词"),
      h(Seats, { key: "s", t, inv, view: {}, ti, outOf: (p, i) => !view.alive[i], subOf: (p, i) => view.outRoles[i] ? "出局 · " + (view.outRoles[i] === "spy" ? "卧底" : "平民") : view.phase === "vote" && view.voted.indexOf(i) >= 0 ? "投了 ✓" : "" }),
      clues.length ? h("div", { key: "cl", "data-wk": "nrspyclues", style: { display: "flex", flexDirection: "column" } }, clues) : null,
      view.phase === "done" ? note(t, (view.win === "spy" ? "卧底赢了" : view.win === "civ" ? "平民赢了" : "提前结束") + (view.reveal ? "：平民词「" + view.reveal.civ + "」，卧底词「" + view.reveal.spy + "」" : ""))
        : note(t, myTurn ? (view.phase === "clue" ? "轮到你描述（别说出词本身）" : view.phase === "vote" ? "投谁是卧底？" : "你被投出来了，是卧底：猜一次平民的词") : waitLine(inv, ti, seat, view.phase === "clue" ? "在想怎么说…" : view.phase === "vote" ? "在投票…" : "在猜词…")),
      myTurn && view.phase !== "vote" ? h("div", { key: "i", className: "flex", style: { gap: 8 } },
        h("input", { "data-wk": "nrspyinput", value: d, onChange: e => setD(e.target.value.slice(0, view.phase === "clue" ? 60 : 30)), onKeyDown: e => { if (e.key === "Enter" && (d.trim() || view.phase !== "clue")) onMove(ti, view.phase === "clue" ? { text: d.trim() } : { guess: d.trim() }); }, placeholder: view.phase === "clue" ? "用一句话描述你的词" : "猜平民的词（空着就是不猜）", style: Object.assign(box(t), { flex: 1, minWidth: 0 }) }),
        h("button", { "data-wk": "nrspysend", onClick: () => onMove(ti, view.phase === "clue" ? { text: d.trim() } : { guess: d.trim() }), disabled: view.phase === "clue" && !d.trim(), style: pill(t, true) }, view.phase === "clue" ? "说" : "猜")) : null,
      myTurn && view.phase === "vote" ? h("div", { key: "v", "data-wk": "nrspyvote" },
        h(SP.VotePick, { t, value: vote, onPick: setVote, targets: inv.seats.map((s, i) => view.alive[i] && i !== ti ? { id: i, key: "s" + i, name: s.name, av: av(i, 22) } : null).filter(Boolean) }),
        h("button", { "data-wk": "nrspyvotego", disabled: vote == null, onClick: () => onMove(ti, { target: vote }), style: Object.assign(pill(t, true), { width: "100%", opacity: vote == null ? .45 : 1 }) }, "投票")) : null,
      h(Log, { key: "l", t, log: view.log, n: 12 }),
      isHost && view.phase !== "done" ? h("button", { key: "e", onClick: onReveal, style: Object.assign(small(t, false), { alignSelf: "flex-start" }) }, "到这儿结束（亮词）") : null]);
  }

  // 心有灵犀那张桌：对阵条、这一轮要连的两个词、刚亮出来那张亮词卡、往期——几块都是单机那一份（GameShared.lingxi）
  //   两边同时写：我这边的框一直开着，交了就等对面；两边都交了才一起亮
  function LingxiTable({ inv, view, priv, me, onMove, onReveal, isHost }) {
    const t = useTheme(), G = GS(), LX = G.lingxi, mySeat = inv.seats.findIndex(s => s.kind === "user" && s.peer === me), [d, setD] = useState("");
    useEffect(() => setD(""), [view.rounds.length, view.phase]);
    const done = view.phase === "done", mine = mySeat >= 0 && !done && !view.sent[mySeat] && !(inv.seats[mySeat] || {}).held;
    // 从我这边看：我（或第一座）写的在左、描我的颜色
    const me0 = mySeat === 1 ? 1 : 0, o0 = 1 - me0, last = view.rounds[view.rounds.length - 1];
    const sc = view.rounds.filter(r => r.hit).length;
    const label = s0 => h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, marginBottom: 6 } }, s0);
    const vs = inv.seats.map((s, i) => ({ key: "s" + i, name: s.name || "空位", char: K.faceChar ? K.faceChar(s) : { name: s.name }, isUser: s.kind === "user", on: !done && !view.sent[i], sub: done ? "对上 " + sc : view.sent[i] ? "交了" : "在想…" }));
    return wrap("lingxi", [
      h(G.GameVsBar, { key: "vs", t, seats: [vs[me0], vs[o0]].filter(Boolean) }),
      view.pair && !done ? h("div", { key: "p", "data-wk": "nrlxpair" }, h("div", { "data-wk": "lingxipair" }, label("这一轮要连的两个词"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, h(LX.Chip, { t, w: view.pair[me0], mine: true }), h("span", { style: { color: t.fog, fontFamily: F_BODY } }, "＋"), h(LX.Chip, { t, w: view.pair[o0], mine: false })))) : null,
      last || view.start ? h(LX.RevCard, { key: "rv", t, r: last ? { n: last.n, pair: [last.pair[me0], last.pair[o0]], hit: last.hit } : null, a: last ? last.w[me0] : view.start[me0], b: last ? last.w[o0] : view.start[o0], counted: !!(last && last.hit) }) : view.phase === "start" ? note(t, "两个人先各自悄悄写一个起始词") : null,
      mySeat >= 0 && priv && priv.mine && !done ? sub(t, "你这一轮写的：「" + priv.mine + "」（两边都交了才一起亮）") : null,
      mine ? h("div", { key: "in", className: "flex", style: { gap: 8, alignItems: "center" } },
        h("input", { "data-wk": "nrlxinput", value: d, onChange: e => setD(e.target.value.slice(0, 20)), onKeyDown: e => { if (e.key === "Enter" && d.trim()) onMove(mySeat, { word: d.trim() }); }, placeholder: view.pair ? "连上这两个词的新词（对面看不到）" : "你的起始词（对面看不到）", style: Object.assign(box(t), { flex: 1, minWidth: 0 }) }),
        h("button", { "data-wk": "nrlxsend", disabled: !d.trim(), onClick: () => onMove(mySeat, { word: d.trim() }), style: pill(t, true) }, "亮词")) : null,
      view.rounds.length > 1 ? h("div", { key: "r", "data-wk": "nrlxrounds" }, h("div", { "data-wk": "lingxihist" }, label("往期"), view.rounds.slice(0, -1).reverse().map(r => h("div", { key: r.n, style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontFamily: F_BODY, fontSize: fs(12), color: t.sub, padding: "4px 0", borderBottom: "1px solid " + t.line } },
        h("span", { style: { color: t.fog, width: 34, flexShrink: 0 } }, "第" + r.n), h("span", { style: { flex: 1, minWidth: 0 } }, r.pair[me0] + " + " + r.pair[o0] + " → 「" + r.w[me0] + "」/「" + r.w[o0] + "」"),
        h("span", { style: { color: r.hit ? t.tint : t.fog, flexShrink: 0 } }, r.hit ? "+1" : "—"))))) : null,
      done ? h("div", { key: "d", style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: fs(20), color: t.tint } }, "连了 " + view.rounds.length + " 轮，对上 " + sc + " 次")
        : isHost ? h("button", { key: "e", "data-wk": "lingxiend", onClick: onReveal, style: Object.assign(small(t, false), { alignSelf: "flex-start" }) }, "到这儿结束") : null]);
  }

  function CardReplay({ rec }) {
    const t = useTheme(), r = rec.replay || {};
    return h("div", { "data-wk": "nrcardreplay", style: { padding: "8px 16px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.7 } },
      (r.rows || []).map((x, i) => h("div", { key: "r" + i }, x)),
      h("div", { style: { borderTop: "1px solid " + t.line, marginTop: 8, paddingTop: 8, color: t.sub, fontSize: fs(12) } }, (r.log || []).map((x, i) => h("div", { key: i }, x))));
  }
  const TABLES = { uno: UnoTable, liar: LiarTable, poker: PokerTable, oldmaid: OldMaidTable, blackjack: BjTable, doudizhu: DdzTable, mahjong: MjTable, spy: SpyTable, lingxi: LingxiTable };
  Object.keys(TABLES).forEach(k => { ADAPTERS[k].Table = TABLES[k]; ADAPTERS[k].Replay = CardReplay; });
})(typeof window !== "undefined" ? window : globalThis);
