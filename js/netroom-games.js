// 联机房间第三期：一起玩小游戏（设计单第七节，她 2026-11-22 拍板）
//
// 分工：
//   · 房主那台是「庄」：管规则、判输赢、主持（用房主的线路）、替 NPC 出手；整局的状态只在庄那台。
//   · 每台手机只收公开的那一份（view）＋只发给自己的那一份（priv，走 {t:"game", to: peerId}，不广播）。
//   · 轮到谁：真人座位等那台手机上的人点；角色座位由【带 TA 来的那台】用自己的线路替 TA 出手，结果交给庄；
//     NPC 座位庄自己跑。掉线的座位：轮到 TA 时等 20 秒，还没回来就由庄转成 NPC 托管，人回来了自动交还。
//   · 规则本身不在这儿：五子棋、海龟汤用的是小游戏里那一份（window.GameShared，js/games.js 导出的纯函数和棋盘）。
//
// 下一个游戏接进来：在 ADAPTERS 里登记一份，写齐这几样（下面两个是现成的样子）——
//   seatRange(cfg)                 → { min, max }   这桌几个座位
//   init(inv, ctx)                 → 状态（可以是 Promise；ctx.hostApi 是庄的线路，ctx.prep 是房主开局前填的）
//   view(st)                       → 发给所有人的那一份（不许带底牌）
//   priv(st, seatIdx)              → 只给这个座位主人看的那一份，没有就 null（藏身份的游戏用）
//   turn(st)                       → 轮到第几个座位，不该有人动就 -1
//   apply(st, seatIdx, move, ctx)  → { st } 或 { err }（可以是 Promise；庄这一台跑）
//   npcMove(st, seatIdx, inv, ctx) → 一手（庄替 NPC 和托管座位出手）
//   charMove(view, seatIdx, inv, ctx) → 一手（角色主人那台跑：ctx.api 是那个角色自己的线路，ctx.char 是本机的角色）
//   result(st, inv)                → null（没完）或 { winners:[seatIdx], text, replay }
//   cleanReplay(r)                 → 战绩卡里回看那一份的白名单
//   Table / Replay                 → 牌桌、回看的界面（复用小游戏原来的部件）
(function (root) {
  "use strict";

  const cut = (v, n) => String(v == null ? "" : v).slice(0, n);
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const GS = () => root.GameShared || null;
  const SEAT_KINDS = ["open", "user", "char", "npc"];
  const STATUS = ["open", "playing", "done", "cancel"];
  const MODES = ["normal", "easy", "spectate"];
  const AWAY_MS = 20000;
  const NPC_NAMES = ["路人甲", "路人乙", "路人丙", "路人丁", "路人戊", "路人己", "路人庚", "路人辛"];

  // ───────────── 邀请卡：玩什么、几个座位、谁坐了 ─────────────
  function cleanSeat(s) {
    const kind = SEAT_KINDS.indexOf(s && s.kind) >= 0 ? s.kind : "open";
    const o = { kind };
    if (kind === "open") return o;
    o.name = cut(s.name, 40);
    if (kind !== "npc") o.peer = cut(s.peer, 40);
    if (kind === "char") o.charId = cut(s.charId, 40);
    if (s.away) o.away = true;
    return o;
  }
  function cleanInvite(x) {
    if (!x || typeof x !== "object") return null;
    const min = int(x.min, 1, 12, 2), max = int(x.max, min, 12, min);
    return { gid: cut(x.gid, 40), key: cut(x.key, 20), zh: cut(x.zh, 20), min, max, host: cut(x.host, 40),
      status: STATUS.indexOf(x.status) >= 0 ? x.status : "open", mode: MODES.indexOf(x.mode) >= 0 ? x.mode : "normal", npcFill: x.npcFill !== false,
      seats: (Array.isArray(x.seats) ? x.seats : []).slice(0, max).map(cleanSeat) };
  }
  // 战绩卡：谁坐哪儿、谁赢了、一句话、回看那一份（回看只认登记过的游戏，别的丢掉）
  function cleanRecord(x) {
    if (!x || typeof x !== "object") return null;
    const key = cut(x.key, 20), A = ADAPTERS[key];
    const o = { gid: cut(x.gid, 40), key, zh: cut(x.zh, 20), text: cut(x.text, 300),
      seats: (Array.isArray(x.seats) ? x.seats : []).slice(0, 12).map(s => ({ name: cut(s && s.name, 40), kind: SEAT_KINDS.indexOf(s && s.kind) >= 0 ? s.kind : "npc" })),
      winners: [] };
    o.winners = (Array.isArray(x.winners) ? x.winners : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < o.seats.length).slice(0, 12);
    if (A && A.cleanReplay && x.replay && typeof x.replay === "object") { const r = A.cleanReplay(x.replay); if (r) o.replay = r; }
    return o;
  }
  const seatLabel = s => s.kind === "open" ? "空位" : s.name + (s.kind === "char" ? "（角色）" : s.kind === "npc" ? "（NPC）" : "");
  function inviteLine(x) {
    const seats = x.seats || [], open = seats.filter(s => s.kind === "open").length;
    const st = x.status === "playing" ? "，已经开局" : x.status === "done" ? "，这一局打完了" : x.status === "cancel" ? "，取消了" : "";
    return "[小游戏邀请] " + (x.zh || "") + " · " + seats.length + " 个座位" + (x.status === "open" ? "，空 " + open + " 个" : "") + st
      + "：" + (seats.filter(s => s.kind !== "open").map(seatLabel).join("、") || "还没人坐");
  }
  function recordLine(x) { return "[小游戏战绩] " + (x.zh || "") + "：" + (x.text || ""); }

  // 开一张邀请卡：座位数照开局配置的人数（夹在这个游戏的上下限里），房主自己那边先坐上
  function newInvite(o) {
    const g = o.game || {}, cfg = o.cfg || {};
    const A = ADAPTERS[g.key];
    const r = A ? A.seatRange(cfg) : { min: g.min || 2, max: g.max || 2 };
    const n = int(cfg.total, r.min, r.max, r.min);
    const inv = cleanInvite({ gid: o.gid, key: g.key, zh: g.zh, min: r.min, max: r.max, host: o.host, status: "open",
      mode: cfg.mode, npcFill: cfg.npcFill !== false, seats: Array.from({ length: n }, () => ({ kind: "open" })) });
    return joinSeats(inv, o.host, o.nick, o.picks || []).inv;
  }
  // 报名：先把这个人原来坐的位子都腾出来，再按 TA 这次选的一个个坐进空位；坐不下的退回去
  //   picks：[{ kind:"user" } | { kind:"char", charId, name }]；同一个角色只坐一个位子
  //   空位不够、这个游戏还能再多坐人：先把座位加到够（最多加到上限），别让人点了「加入」却什么都没发生
  function joinSeats(inv, peer, nick, picks) {
    const seats = (inv.seats || []).map(s => s.peer === peer && s.kind !== "npc" ? { kind: "open" } : Object.assign({}, s));
    const want = new Set((picks || []).filter(p => p && (p.kind === "user" || p.kind === "char")).map(p => p.kind === "char" ? "c:" + p.charId : "u")).size;
    const max = inv.max || seats.length;
    while (seats.filter(s => s.kind === "open").length < want && seats.length < max) seats.push({ kind: "open" });
    const dropped = [], seen = new Set();
    (picks || []).forEach(p => {
      const key = p && p.kind === "char" ? "c:" + p.charId : "u";
      if (!p || seen.has(key) || (p.kind !== "user" && p.kind !== "char")) return;
      seen.add(key);
      const i = seats.findIndex(s => s.kind === "open");
      if (i < 0) { dropped.push(p); return; }
      seats[i] = cleanSeat(p.kind === "user" ? { kind: "user", peer, name: nick } : { kind: "char", peer, charId: p.charId, name: p.name });
    });
    return { inv: Object.assign({}, inv, { seats }), dropped };
  }
  const leaveSeats = (inv, peer) => joinSeats(inv, peer, "", []).inv;
  const addSeat = inv => (inv.seats || []).length >= inv.max ? inv : Object.assign({}, inv, { seats: inv.seats.concat([{ kind: "open" }]) });
  const takenCount = inv => (inv.seats || []).filter(s => s.kind !== "open").length;
  // 开局：空位照开局配置补 NPC（「NPC 凑数」关着就把空位收掉）；补完够不够这个游戏的最低人数
  function fillNpc(inv) {
    let k = 0;
    const used = new Set((inv.seats || []).filter(s => s.kind === "npc").map(s => s.name));
    const A = ADAPTERS[inv.key];
    const names = (A && A.npcNames) || NPC_NAMES;
    const nextName = () => { while (k < names.length && used.has(names[k])) k++; const n = names[k] || ("NPC" + (k + 1)); k++; used.add(n); return n; };
    const seats = inv.npcFill ? inv.seats.map(s => s.kind === "open" ? { kind: "npc", name: nextName() } : s) : inv.seats.filter(s => s.kind !== "open");
    return Object.assign({}, inv, { seats });
  }
  function canStart(inv) {
    if (!inv || inv.status !== "open" || takenCount(inv) < 1) return false;
    return (inv.npcFill ? inv.seats.length : takenCount(inv)) >= inv.min;
  }
  // 这个座位这一手归谁出：我自己点 / 我这台替我带来的角色出 / 庄替 NPC（和托管的座位）出 / 别人那台
  function actorOf(seat, me, host) {
    if (!seat || seat.kind === "open") return "none";
    if (seat.kind === "npc" || seat.away) return me === host ? "host-npc" : "remote";
    if (seat.peer !== me) return "remote";
    return seat.kind === "user" ? "mine-user" : "mine-char";
  }
  // 只发给某一个人的那条怎么走：直连着就只发给 TA；直连不上就交给一个跟 TA 通着的人转（只交一个人），谁都不通就不发
  function privateRoute(openIds, to, linkMap, cameFrom) {
    const ids = (openIds || []).filter(x => x !== cameFrom);
    if (ids.indexOf(to) >= 0) return [to];
    const lm = linkMap || {};
    const via = ids.find(x => (lm[x] || []).indexOf(to) >= 0);
    return via ? [via] : [];
  }
  // 掉线：轮到的座位主人不在房里（离开了／连不上）超过 20 秒，就转托管；回来了就交还
  function awayPlan(inv, turnIdx, presence, sinceGone, now) {
    const s = (inv.seats || [])[turnIdx];
    if (!s || s.kind === "npc" || s.kind === "open" || s.peer === inv.host) return null;
    const st = (presence || {})[s.peer];
    const gone = st !== "on" && st !== "relay";
    if (!gone) return s.away ? "back" : null;
    if (s.away) return null;
    return now - (sinceGone || now) >= AWAY_MS ? "away" : "wait";
  }
  function setAway(inv, peer, on) {
    return Object.assign({}, inv, { seats: inv.seats.map(s => s.peer === peer && s.kind !== "npc" ? cleanSeat(Object.assign({}, s, { away: !!on })) : s) });
  }

  // ───────────── 各个游戏 ─────────────
  const ADAPTERS = {};
  const sideZh = s => s === 1 ? "黑" : "白";
  ADAPTERS.gomoku = {
    zh: "五子棋",
    npcNames: ["电脑"],
    seatRange: () => ({ min: 2, max: 2 }),
    // 第一个座位执黑先手，第二个执白
    init: () => ({ moves: [], turn: 1, winner: 0 }),
    view: st => ({ moves: st.moves.slice(), turn: st.turn, winner: st.winner }),
    priv: () => null,
    turn: st => st.winner ? -1 : st.turn - 1,
    apply(st, seatIdx, move) {
      const G = GS().gomoku;
      if (st.winner) return { err: "这一局已经分出胜负了" };
      if (seatIdx !== st.turn - 1) return { err: "还没轮到这一边" };
      const x = int(move && move.x, -1, 99, -1), y = int(move && move.y, -1, 99, -1);
      const r = G.place(G.replay(st.moves), st.moves, x, y, st.turn, st.winner);
      if (!r) return { err: "这一格落不下" };
      return { st: { moves: r.moves, turn: r.winner ? st.turn : r.turn, winner: r.winner } };
    },
    // 落子都走小游戏里那位本地棋手：放水局里角色和 NPC 让着下（跟单机放水局同一档）
    level: (inv, seat) => inv.mode === "easy" && seat && seat.kind !== "user" ? 2 : 0,
    npcMove(st, seatIdx, inv) { const G = GS().gomoku; const m = G.bestMove(G.replay(st.moves), seatIdx + 1, this.level(inv, inv.seats[seatIdx])); return m ? { x: m.x, y: m.y } : null; },
    charMove(view, seatIdx, inv) { const G = GS().gomoku; const m = G.bestMove(G.replay(view.moves), seatIdx + 1, this.level(inv, inv.seats[seatIdx])); return m ? { x: m.x, y: m.y } : null; },
    result(st, inv) {
      if (!st.winner) return null;
      const nm = i => (inv.seats[i] || {}).name || "TA";
      const res = st.winner === 3 ? "和棋" : nm(st.winner - 1) + "（" + sideZh(st.winner) + "）赢了";
      return { winners: st.winner === 3 ? [] : [st.winner - 1], text: nm(0) + "（黑）对 " + nm(1) + "（白），" + st.moves.length + " 手，" + res + "。",
        replay: { moves: st.moves.map(m => [m.x, m.y, m.who]) } };
    },
    cleanReplay(r) {
      const N = 15;
      const moves = (Array.isArray(r.moves) ? r.moves : []).slice(0, N * N).map(m => Array.isArray(m) ? [int(m[0], 0, N - 1, 0), int(m[1], 0, N - 1, 0), int(m[2], 1, 2, 1)] : null).filter(Boolean);
      return { moves };
    }
  };
  const VERDICT_SET = ["是", "不是", "不重要", "接近了", "不对", "跳过"];
  ADAPTERS.haigui = {
    zh: "海龟汤",
    slow: true,
    seatRange: () => ({ min: 2, max: 8 }),
    // 汤：房主开局前自己写的那一道；没写就让庄的线路出一道（跟单机出下一题同一段）
    async init(inv, ctx) {
      const p = ctx && ctx.prep || {};
      let surface = cut(p.surface, 600).trim(), truth = cut(p.truth, 1200).trim();
      if (!surface || !truth) {
        if (!ctx || !ctx.hostApi) throw new Error("没写汤面汤底，又没有能出题的线路：先去 设置·API 配一条，或者自己写一道");
        const r = await GS().guess.newPuzzle(ctx.hostApi, "haigui", []);
        surface = cut(r.surface, 600).trim(); truth = cut(r.truth, 1200).trim();
        if (!surface || !truth) throw new Error("出题没出成，再点一次开始");
      }
      return { surface, truth, log: [], turn: 0, done: false, solvedBy: -1, reveal: "", busy: false };
    },
    view: st => ({ surface: st.surface, log: st.log.slice(-60), turn: st.turn, done: st.done, solvedBy: st.solvedBy, busy: st.busy, reveal: st.done ? (st.reveal || st.truth) : "", truth: st.done ? st.truth : "" }),
    priv: () => null,
    turn: st => st.done || st.busy ? -1 : st.turn,
    hist: log => (log || []).filter(l => l.q).map(l => l.name + "：" + l.q + " → " + l.verdict + (l.note ? "（" + l.note + "）" : "")),
    async apply(st, seatIdx, move, ctx) {
      const inv = ctx.inv, name = seatIdx >= 0 ? ((inv.seats[seatIdx] || {}).name || "TA") : "";
      const next = s => Object.assign({}, s, { turn: (seatIdx + 1) % inv.seats.length, busy: false });
      if (st.done) return { err: "这一锅汤已经揭晓了" };
      if (move && move.reveal) return { st: Object.assign({}, st, { done: true, busy: false, reveal: st.truth }) };
      if (seatIdx !== st.turn) return { err: "还没轮到这一位" };
      const q = cut(move && (move.ask || move.guess), 300).trim();
      if (move && move.pass || !q) return { st: next(Object.assign({}, st, { log: st.log.concat([{ seat: seatIdx, name, q: "", verdict: "跳过", note: "" }]) })) };
      if (!ctx.hostApi) return { err: "庄（房主）这台没配线路，判不了。房主去 设置·API 配一条" };
      const G = GS().guess;
      if (move.guess) {
        const j = await G.judge(ctx.hostApi, "haigui", { surface: st.surface, truth: st.truth }, q);
        const row = { seat: seatIdx, name, q, guess: true, verdict: j.correct ? "是" : "不对", note: cut(j.note, 60) };
        if (j.correct) return { st: Object.assign({}, st, { log: st.log.concat([row]), done: true, solvedBy: seatIdx, reveal: st.truth, busy: false }) };
        return { st: next(Object.assign({}, st, { log: st.log.concat([row]) })) };
      }
      const a = await G.answerOne(ctx.hostApi, "haigui", { surface: st.surface, truth: st.truth }, q, this.hist(st.log), name, inv.mode);
      const row = { seat: seatIdx, name, q, verdict: a.verdict, note: a.note };
      if (a.solved) return { st: Object.assign({}, st, { log: st.log.concat([row]), done: true, solvedBy: seatIdx, reveal: a.reveal || st.truth, busy: false }) };
      return { st: next(Object.assign({}, st, { log: st.log.concat([row]) })) };
    },
    async npcMove(st, seatIdx, inv, ctx) {
      if (!ctx.hostApi) return { pass: true };
      const s = inv.seats[seatIdx] || {};
      const q = await GS().guess.askOne(ctx.hostApi, "haigui", { surface: st.surface }, this.hist(st.log), { name: s.name, persona: "来凑桌的路人，普通玩家。" }).catch(() => "");
      return q ? { ask: q } : { pass: true };
    },
    async charMove(view, seatIdx, inv, ctx) {
      if (!ctx.api || !ctx.char) return { pass: true };
      const c = ctx.char;
      const q = await GS().guess.askOne(ctx.api, "haigui", { surface: view.surface }, this.hist(view.log), { name: c.remark || c.name, persona: c.persona }).catch(() => "");
      return q ? { ask: q } : { pass: true };
    },
    result(st, inv) {
      if (!st.done) return null;
      const nm = i => (inv.seats[i] || {}).name || "TA";
      const asked = st.log.filter(l => l.q).length;
      return { winners: st.solvedBy >= 0 ? [st.solvedBy] : [],
        text: "汤面「" + cut(st.surface, 30) + (st.surface.length > 30 ? "…" : "") + "」，" + (st.solvedBy >= 0 ? nm(st.solvedBy) + " 破了题" : "没人破题，汤底揭晓了") + "，一共问了 " + asked + " 个问题。",
        replay: { surface: st.surface, truth: st.truth, log: st.log.map(l => ({ name: l.name, q: l.q, verdict: l.verdict, note: l.note, guess: !!l.guess })) } };
    },
    cleanReplay(r) {
      return { surface: cut(r.surface, 600), truth: cut(r.truth, 1200),
        log: (Array.isArray(r.log) ? r.log : []).slice(-80).map(l => ({ name: cut(l && l.name, 40), q: cut(l && l.q, 300), verdict: VERDICT_SET.indexOf(l && l.verdict) >= 0 ? l.verdict : "不重要", note: cut(l && l.note, 60), guess: !!(l && l.guess) })) };
    },
    cleanView(v) {
      return { surface: cut(v.surface, 600), turn: int(v.turn, 0, 11, 0), done: !!v.done, busy: !!v.busy, solvedBy: int(v.solvedBy, -1, 11, -1), reveal: cut(v.reveal, 1200), truth: cut(v.truth, 1200),
        log: (Array.isArray(v.log) ? v.log : []).slice(-60).map(l => ({ seat: int(l && l.seat, -1, 11, -1), name: cut(l && l.name, 40), q: cut(l && l.q, 300), verdict: VERDICT_SET.indexOf(l && l.verdict) >= 0 ? l.verdict : "不重要", note: cut(l && l.note, 60), guess: !!(l && l.guess) })) };
    }
  };
  ADAPTERS.gomoku.cleanView = v => ({ moves: (Array.isArray(v.moves) ? v.moves : []).slice(0, 225).map(m => ({ x: int(m && m.x, 0, 14, 0), y: int(m && m.y, 0, 14, 0), who: int(m && m.who, 1, 2, 1) })), turn: int(v.turn, 1, 2, 1), winner: int(v.winner, 0, 3, 0) });
  const supported = () => Object.keys(ADAPTERS);

  const Core = { SEAT_KINDS, STATUS, AWAY_MS, ADAPTERS, supported, cleanSeat, cleanInvite, cleanRecord, inviteLine, recordLine, newInvite, joinSeats, leaveSeats, addSeat,
    takenCount, fillNpc, canStart, actorOf, privateRoute, awayPlan, setAway };
  root.NetGameCore = Core;

  // ───────────── 一局怎么转起来（庄那一半＋每台手机自己那一半） ─────────────
  // o：me() 我的 peerId；nick()；send(obj, to?) 发给房里（给了 to 只发给 TA）；post(type, x) 往房里发一条卡；
  //    patchCard(gid, x, host) 改那张邀请卡；hostApi() 庄的线路；apiFor(charId)；charOf(charId) 本机的角色；
  //    presence() 房里每个人此刻在不在；onChange() 界面重画；toast(s)
  function Session(o) {
    const host = {};     // 我开的那几局：gid → { inv, st, prep, seq, busy, gone:{peer:ts} }
    const seen = {};     // 每一局我这台看到的：gid → { inv, view, seq, priv }
    const acting = new Set();
    const changed = () => { try { o.onChange && o.onChange(); } catch (e) {} };
    const wait = ms => new Promise(ok => setTimeout(ok, o.fast ? 0 : ms));   // 停一拍再下，像在想（测试里 fast 不停）
    const A = key => ADAPTERS[key];
    const ctxOf = g => ({ hostApi: o.hostApi ? o.hostApi() : null, inv: g.inv, prep: g.prep });
    const shareCard = g => { o.patchCard(g.inv.gid, g.inv, true); o.send({ t: "game", op: "card", gid: g.inv.gid, x: g.inv }); };
    const shareState = g => {
      const ad = A(g.inv.key), view = ad.view(g.st);
      g.seq++;
      local(g.inv, view, g.seq);
      o.send({ t: "game", op: "state", gid: g.inv.gid, inv: g.inv, view, seq: g.seq });
      // 只给座位主人看的那一份：一份一份单独发，不进广播
      g.inv.seats.forEach((s, i) => { const p = ad.priv(g.st, i); if (p != null && s.peer) { if (s.peer === o.me()) (seen[g.inv.gid] || {}).priv = p; else o.send({ t: "game", op: "priv", gid: g.inv.gid, seat: i, data: p }, s.peer); } });
    };
    function local(inv, view, seq) {
      const cur = seen[inv.gid];
      if (cur && cur.seq >= seq) return;
      seen[inv.gid] = Object.assign({}, cur || {}, { inv, view, seq });
      changed();
      actOwn(inv.gid);
    }
    // 轮到我这台带来的角色：用 TA 自己的线路想一手，交给庄
    async function actOwn(gid) {
      const s = seen[gid]; if (!s || !s.view) return;
      const ad = A(s.inv.key); if (!ad) return;
      const ti = ad.turn(ad.cleanView ? ad.cleanView(s.view) : s.view);
      const seat = s.inv.seats[ti];
      if (actorOf(seat, o.me(), s.inv.host) !== "mine-char") return;
      const k = gid + ":" + s.seq + ":" + ti;
      if (acting.has(k)) return; acting.add(k);
      const char = o.charOf(seat.charId);
      await wait(600);
      let mv = null;
      try { mv = await ad.charMove(s.view, ti, s.inv, { api: char ? o.apiFor(char.id) : null, char }); } catch (e) { mv = null; }
      if (!mv) mv = { pass: true };
      move(gid, ti, mv);
    }
    // 庄：轮到 NPC 或托管的座位就自己下；一局完了就发战绩卡
    async function drive(gid) {
      const g = host[gid]; if (!g || g.inv.status !== "playing" || g.busy) return;
      const ad = A(g.inv.key);
      const res = ad.result(g.st, g.inv);
      if (res) return finish(g, res);
      const ti = ad.turn(g.st); if (ti < 0) return;
      const seat = g.inv.seats[ti];
      if (actorOf(seat, o.me(), o.me()) !== "host-npc") return;
      const k = "npc:" + gid + ":" + g.seq;
      if (acting.has(k)) return; acting.add(k);
      await wait(700);
      let mv = null;
      try { mv = await ad.npcMove(g.st, ti, g.inv, ctxOf(g)); } catch (e) { mv = null; }
      hostApply(gid, ti, mv || { pass: true }, null);
    }
    function finish(g, res) {
      if (g.inv.status === "done") return;
      g.inv = Object.assign({}, g.inv, { status: "done" });
      shareCard(g); shareState(g);
      o.post("gamerec", { gid: g.inv.gid, key: g.inv.key, zh: g.inv.zh, text: res.text, winners: res.winners,
        seats: g.inv.seats.map(s => ({ name: s.name, kind: s.kind })), replay: res.replay });
    }
    async function hostApply(gid, seatIdx, mv, from) {
      const g = host[gid]; if (!g || g.inv.status !== "playing") return;
      // 只认这个座位真正的主人（托管、NPC 的那一手只认庄自己）
      if (from != null) {
        if (seatIdx >= 0) { const s = g.inv.seats[seatIdx]; if (!s || s.away || s.kind === "npc" || s.peer !== from) return; }
        else if (from !== o.me()) return;
      }
      if (g.busy) return;
      const ad = A(g.inv.key);
      g.busy = true;
      // 要等庄的线路判的那几种（海龟汤）：先让大家看到「庄在判…」
      if (ad.slow && mv && !mv.pass && !mv.reveal) { g.st = Object.assign({}, g.st, { busy: true }); shareState(g); }
      let r;
      try { r = await ad.apply(g.st, seatIdx, mv, ctxOf(g)); } catch (e) { r = { err: "庄那边没判出来：" + ((e && e.message) || e) }; }
      g.busy = false;
      if (r.err) {
        if (g.st.busy) g.st = Object.assign({}, g.st, { busy: false });
        if (from && from !== o.me()) o.send({ t: "game", op: "oops", gid, text: r.err }, from); else o.toast && o.toast(r.err);
        shareState(g); return;
      }
      g.st = r.st; shareState(g); drive(gid);
    }
    function move(gid, seatIdx, mv) {
      const s = seen[gid];
      if (host[gid]) return hostApply(gid, seatIdx, mv, o.me());
      if (s) o.send({ t: "game", op: "move", gid, seat: seatIdx, move: mv }, s.inv.host);
    }
    return {
      seen: gid => seen[gid] || null,
      isHost: gid => !!host[gid],
      hosting: () => Object.keys(host),
      // 房主：开一张邀请卡（picks 是房主自己这边上谁，开局配置里勾的那几个）
      invite(game, cfg, picks, prep) {
        const gid = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const inv = newInvite({ gid, game, cfg, host: o.me(), nick: o.nick(), picks });
        host[gid] = { inv, st: null, prep: prep || null, seq: 0, busy: false, gone: {}, cfg };
        o.post("game", inv);
        return gid;
      },
      // 报名／换人／不玩了（picks 空着）：房主自己改卡；别人只发给房主那一台，房主改了卡再发给大家
      join(gid, picks, hostPeer) {
        const g = host[gid];
        if (g) { const r = joinSeats(g.inv, o.me(), o.nick(), picks); g.inv = r.inv; shareCard(g); return r.dropped; }
        const s = seen[gid], to = hostPeer || (s && s.inv.host);
        if (to) o.send({ t: "game", op: (picks || []).length ? "join" : "leave", gid, picks }, to);
        return [];
      },
      addSeat(gid) { const g = host[gid]; if (g && g.inv.status === "open") { g.inv = addSeat(g.inv); shareCard(g); } },
      cancel(gid) { const g = host[gid]; if (g && g.inv.status === "open") { g.inv = Object.assign({}, g.inv, { status: "cancel" }); shareCard(g); } },
      async start(gid) {
        const g = host[gid]; if (!g || !canStart(g.inv)) return false;
        const inv = Object.assign(fillNpc(g.inv), { status: "playing" });
        try { g.st = await A(inv.key).init(inv, { hostApi: o.hostApi ? o.hostApi() : null, prep: g.prep }); }
        catch (e) { o.toast && o.toast(String((e && e.message) || e)); return false; }
        g.inv = inv; g.seq = 0;
        shareCard(g); shareState(g); drive(gid);
        return true;
      },
      // 再来一局：同样几个人原样坐好，开一张新卡，房主再点开始
      again(gid) {
        const g = host[gid]; if (!g) return null;
        const ngid = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const seats = g.inv.seats.map(s => s.kind === "npc" ? { kind: "open" } : cleanSeat(Object.assign({}, s, { away: false })));
        const inv = cleanInvite(Object.assign({}, g.inv, { gid: ngid, status: "open", seats }));
        host[ngid] = { inv, st: null, prep: null, seq: 0, busy: false, gone: {}, cfg: g.cfg };
        o.post("game", inv);
        return ngid;
      },
      move,
      reveal(gid) { if (host[gid]) hostApply(gid, -1, { reveal: true }, o.me()); },
      // 收到房里别人发来的 {t:"game"}：认不得的 op 不理（以后的新版本发来的）
      onMessage(e, origin) {
        const gid = cut(e.gid, 40); if (!gid) return;
        const g = host[gid];
        if (e.op === "join" && !g) { o.send({ t: "game", op: "oops", gid, text: "开这一局的那台手机已经不记得这张邀请卡了（重新进过房间），请房主再发一张" }, origin); }
        else if (e.op === "join" && g.inv.status !== "open") { o.send({ t: "game", op: "oops", gid, text: "这一局已经开始或者结束了，坐不进去了" }, origin); }
        else if (e.op === "join") {
          const nick = o.nickOf(origin);
          const picks = (Array.isArray(e.picks) ? e.picks : []).slice(0, 12).map(p => p && p.kind === "char" ? { kind: "char", charId: cut(p.charId, 40), name: cut(p.name, 40) } : { kind: "user" });
          const r = joinSeats(g.inv, origin, nick, picks);
          g.inv = r.inv; shareCard(g);
          // 坐不下的那几个告诉 TA，不让 TA 以为点了没反应
          if (r.dropped.length) o.send({ t: "game", op: "oops", gid, text: "座位满了，" + r.dropped.map(p => p.kind === "char" ? p.name : "你自己").join("、") + " 没坐上" }, origin);
        } else if (e.op === "leave" && g && g.inv.status === "open") { g.inv = leaveSeats(g.inv, origin); shareCard(g); }
        else if (e.op === "move" && g) hostApply(gid, int(e.seat, -1, 11, -2), e.move && typeof e.move === "object" ? e.move : null, origin);
        else if (e.op === "card") { const x = cleanInvite(e.x); if (x && x.host === origin) { o.patchCard(gid, x, false, origin); const s = seen[gid]; if (s) s.inv = x; changed(); } }
        else if (e.op === "state") {
          const inv = cleanInvite(e.inv); if (!inv || inv.host !== origin) return;
          const ad = A(inv.key); if (!ad) return;
          const view = ad.cleanView ? ad.cleanView(e.view || {}) : e.view;
          const was = seen[gid];
          local(inv, view, int(e.seq, 0, 1e9, 0));
          if (!was && o.onOpenGame && inv.seats.some(s => s.peer === o.me())) o.onOpenGame(gid);
        } else if (e.op === "priv") { const s = seen[gid]; if (s && s.inv.host === origin) { s.priv = e.data; changed(); } }
        else if (e.op === "oops") { o.toast && o.toast(cut(e.text, 120)); }
      },
      // 有人（重新）进了房：把还在打的那几局再发一遍，TA 那边接得上
      resend() { Object.keys(host).forEach(gid => { const g = host[gid]; if (g.st && g.inv.status !== "open") { o.send({ t: "game", op: "card", gid, x: g.inv }); shareState(g); } else shareCard(g); }); },
      // 每隔几秒看一眼：轮到的人掉线了没有
      tick(now) {
        const pres = o.presence ? o.presence() : {};
        Object.keys(host).forEach(gid => {
          const g = host[gid]; if (g.inv.status !== "playing" || !g.st) return;
          const ad = A(g.inv.key), ti = ad.turn(g.st);
          g.inv.seats.forEach(s => { if (s.peer && s.peer !== o.me()) { const on = pres[s.peer] === "on" || pres[s.peer] === "relay"; if (on) delete g.gone[s.peer]; else if (!g.gone[s.peer]) g.gone[s.peer] = now; } });
          // 回来的人：座位交还
          const back = g.inv.seats.filter(s => s.away && (pres[s.peer] === "on" || pres[s.peer] === "relay"));
          back.forEach(s => { g.inv = setAway(g.inv, s.peer, false); });
          let plan = ti >= 0 ? awayPlan(g.inv, ti, pres, g.gone[(g.inv.seats[ti] || {}).peer], now) : null;
          if (plan === "away") g.inv = setAway(g.inv, g.inv.seats[ti].peer, true);
          if (back.length || plan === "away") { shareCard(g); shareState(g); drive(gid); }
        });
      }
    };
  }
  root.NetGameSession = Session;

  // ───────────── 界面 ─────────────
  if (typeof React === "undefined") return;
  const h = React.createElement;
  const { useState, useEffect } = React;
  const fs = px => "calc(" + px + "px * var(--app-fs, 1))";
  const pill = (t, on) => ({ minHeight: 40, padding: "0 16px", borderRadius: 999, border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : t.bg2, color: on ? t.bg : t.ink, fontFamily: F_BODY, fontSize: fs(13) });

  // 房里那张邀请卡
  function InviteCard({ x, me, onJoin, onLeave, onStart, onAdd, onCancel, onOpen, busy, lost }) {
    const t = useTheme();
    const seats = x.seats || [], isHost = x.host === me, mine = seats.some(s => s.peer === me && s.kind !== "npc");
    const open = seats.filter(s => s.kind === "open").length;
    const stZh = { open: "等人报名", playing: "正在打", done: "打完了", cancel: "取消了" }[x.status];
    return h("div", { "data-wk": "nrgamecard", "data-state": x.status, style: { width: 248, border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 12, display: "flex", flexDirection: "column", gap: 8 } },
      h("div", { className: "flex items-center", style: { gap: 8 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: fs(16), color: t.ink, flex: 1 } }, x.zh),
        h("span", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog } }, stZh)),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, seats.length + " 个座位" + (x.status === "open" ? " · 空 " + open + " 个" : "") + (x.mode === "easy" ? " · 放水局" : "")),
      h("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, seats.map((s, i) => h("div", { key: i, "data-wk": "nrgameseat", "data-kind": s.kind, style: { fontFamily: F_BODY, fontSize: fs(13), color: s.kind === "open" ? t.fog : t.ink } },
        (i + 1) + ". " + seatLabel(s) + (s.away ? " · 掉线了，NPC 先替着" : "")))),
      // 我开的卡，可这台手机重进过房间、已经不记得这一局了：按钮按了也没用，直说
      lost ? h("div", { "data-wk": "nrgamelost", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, lineHeight: 1.5 } }, "这张卡是你重新进房间之前发的，这台手机已经接不上这一局了。要玩就从「＋ → 小游戏」再发一张。") : null,
      !lost && x.status === "open" && h("div", { className: "flex flex-wrap", style: { gap: 6 } },
        (mine || open > 0 || seats.length < x.max) && h("button", { "data-wk": "nrgamejoin", onClick: onJoin, disabled: busy, style: pill(t, !mine) }, mine ? "换人" : "加入"),
        mine && !isHost && h("button", { "data-wk": "nrgameleave", onClick: onLeave, style: pill(t, false) }, "不玩了"),
        isHost && seats.length < x.max && h("button", { "data-wk": "nrgameadd", onClick: onAdd, style: pill(t, false) }, "加一个座位"),
        isHost && h("button", { "data-wk": "nrgamestart", onClick: onStart, disabled: busy || !canStart(x), style: Object.assign(pill(t, true), { opacity: busy || !canStart(x) ? .45 : 1 }) }, busy ? "在开局…" : "开始"),
        isHost && h("button", { "data-wk": "nrgamecancel", onClick: onCancel, style: pill(t, false) }, "取消")),
      !lost && x.status === "open" && h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, lineHeight: 1.5 } },
        isHost ? (x.npcFill ? "点「开始」时空着的座位用 NPC 补上。" : "开局配置里没开 NPC 凑数：空着的座位开局时收掉，人够 " + x.min + " 个才能开。") : "点「加入」选你这边上谁：你自己，或者你带来的角色，每人占一个座位。"),
      !lost && x.status === "playing" && h("button", { "data-wk": "nrgameopen", onClick: onOpen, style: pill(t, true) }, mine ? "回到牌桌" : "去看看"));
  }
  function RecordCard({ x, onOpen }) {
    const t = useTheme();
    const win = (x.winners || []).map(i => (x.seats[i] || {}).name).filter(Boolean);
    return h("button", { "data-wk": "nrgamerec", onClick: onOpen, className: "active:opacity-70", style: { width: 248, textAlign: "left", border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 12, display: "flex", flexDirection: "column", gap: 6 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog } }, "战绩"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(16), color: t.ink } }, x.zh + (win.length ? " · " + win.join("、") + " 赢了" : "")),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink, lineHeight: 1.6 } }, x.text),
      x.replay && h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog } }, "点开回看这一局"));
  }

  // 五子棋那张桌：对阵条、棋盘、谁在想，都是小游戏里那几块
  function GomokuTable({ inv, view, me, onMove, onReveal, isHost }) {
    const t = useTheme(), G = GS();
    const [pend, setPend] = useState(null);
    useEffect(() => { setPend(null); }, [view.moves.length]);
    if (!G) return null;
    const ti = view.winner ? -1 : view.turn - 1, seat = inv.seats[ti];
    const myTurn = actorOf(seat, me, inv.host) === "mine-user";
    const tap = (x, y) => {
      if (!myTurn || view.moves.some(m => m.x === x && m.y === y)) return;
      if (pend && pend.x === x && pend.y === y) { setPend(null); onMove(ti, { x, y }); } else setPend({ x, y });
    };
    const nm = i => (inv.seats[i] || {}).name || "TA";
    const status = view.winner === 3 ? "和棋" : view.winner ? nm(view.winner - 1) + "（" + sideZh(view.winner) + "）赢了"
      : myTurn ? (pend ? "再点一下同一格落子" : "轮到你（" + sideZh(view.turn) + "）") : (seat && seat.away ? nm(ti) + " 掉线了，NPC 先替着下…" : nm(ti) + "在想…");
    return h("div", { "data-wk": "nrgametable", "data-game": "gomoku", style: { padding: "4px 16px 10px" } },
      h(G.GameVsBar, { t, mid: view.moves.length ? view.moves.length + " 手" : "", seats: [0, 1].map(i => { const s = inv.seats[i] || {};
        return { key: "s" + i, name: s.name || "空位", char: { name: s.name || "?" }, isUser: s.kind === "user", on: !view.winner && view.turn - 1 === i,
          mark: h(G.GmkStone, { side: i + 1, size: 15 }), sub: view.winner ? (view.winner === i + 1 ? "赢了" : view.winner === 3 ? "和棋" : "") : (sideZh(i + 1) + "子" + (s.kind === "char" ? " · 角色" : s.kind === "npc" ? " · NPC" : "")), hot: view.winner === i + 1 }; }) }),
      h(G.GomokuBoard, { moves: view.moves, pend, pendSide: view.turn, onTap: myTurn ? tap : null }),
      h("div", { "data-wk": "nrgamestatus", style: { textAlign: "center", marginTop: 10, fontFamily: F_DISPLAY, fontSize: fs(14.5), color: t.ink } }, status));
  }
  function GomokuReplay({ rec }) {
    const t = useTheme(), G = GS();
    const moves = ((rec.replay && rec.replay.moves) || []).map(m => ({ x: m[0], y: m[1], who: m[2] }));
    const [k, setK] = useState(moves.length);
    if (!G) return null;
    return h("div", { style: { padding: "8px 16px" } },
      h(G.GomokuBoard, { moves: moves.slice(0, k) }),
      h("div", { className: "flex items-center justify-center", style: { gap: 10, marginTop: 10 } },
        h("button", { "data-wk": "nrreplayprev", onClick: () => setK(v => Math.max(0, v - 1)), style: pill(t, false) }, "上一手"),
        h("span", { style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, minWidth: 70, textAlign: "center" } }, k + " / " + moves.length),
        h("button", { "data-wk": "nrreplaynext", onClick: () => setK(v => Math.min(moves.length, v + 1)), style: pill(t, false) }, "下一手")));
  }
  function SoupLog({ log, t, colors }) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, (log || []).map((l, i) => h("div", { key: i, "data-wk": "nrsouprow", style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.55 } },
      h("span", { style: { color: t.fog } }, l.name + (l.guess ? " 猜汤底：" : "：")), l.q || "（这一轮跳过）",
      l.q ? h("span", { style: { marginLeft: 6, padding: "1px 8px", borderRadius: 999, color: "#fff", background: (colors || {})[l.verdict] || (l.verdict === "不对" ? "#c0553f" : "#8a8172"), fontSize: fs(11.5) } }, l.verdict) : null,
      l.note ? h("span", { style: { color: t.fog, marginLeft: 6, fontSize: fs(11.5) } }, l.note) : null)));
  }
  function SoupTable({ inv, view, me, onMove, onReveal, isHost }) {
    const t = useTheme(), G = GS();
    const [q, setQ] = useState("");
    const seat = inv.seats[view.turn];
    const myTurn = !view.done && !view.busy && actorOf(seat, me, inv.host) === "mine-user";
    const go = kind => { const v = q.trim(); if (!v && kind !== "pass") return; setQ(""); onMove(view.turn, kind === "pass" ? { pass: true } : kind === "guess" ? { guess: v } : { ask: v }); };
    const who = seat ? seat.name : "";
    const colors = G && G.guess.VERDICT_COLOR;
    return h("div", { "data-wk": "nrgametable", "data-game": "haigui", style: { padding: "8px 16px 10px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 12 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, marginBottom: 4 } }, "汤面"),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink, lineHeight: 1.7 } }, view.surface)),
      h(SoupLog, { log: view.log, t, colors }),
      view.done ? h("div", { "data-wk": "nrsoupreveal", style: { border: "1px solid " + t.ink, borderRadius: 14, padding: 12, fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink, lineHeight: 1.7 } },
        h("div", { style: { fontSize: fs(11), color: t.fog, marginBottom: 4 } }, view.solvedBy >= 0 ? (inv.seats[view.solvedBy] || {}).name + " 破了题 · 汤底" : "汤底"), view.truth || view.reveal)
        : h("div", { style: { fontFamily: F_BODY, fontSize: fs(12.5), color: t.fog } }, view.busy ? "庄在判…" : myTurn ? "轮到你问" : (seat && seat.away ? who + " 掉线了，NPC 先替着问…" : "轮到 " + who + " 问…")),
      myTurn && h("textarea", { "data-wk": "nrsoupinput", value: q, rows: 2, onChange: e => setQ(e.target.value.slice(0, 300)), placeholder: "问一个是非题，或者把你想到的汤底整个说出来",
        style: { width: "100%", resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14) } }),
      myTurn && h("div", { className: "flex flex-wrap", style: { gap: 6 } },
        h("button", { "data-wk": "nrsoupask", onClick: () => go("ask"), disabled: !q.trim(), style: pill(t, true) }, "问"),
        h("button", { "data-wk": "nrsoupguess", onClick: () => go("guess"), disabled: !q.trim(), style: pill(t, false) }, "猜汤底"),
        h("button", { "data-wk": "nrsouppass", onClick: () => go("pass"), style: pill(t, false) }, "这轮不问")),
      isHost && !view.done && h("button", { "data-wk": "nrsoupgiveup", onClick: onReveal, style: Object.assign(pill(t, false), { alignSelf: "flex-start" }) }, "揭晓汤底（结束这一锅）"));
  }
  function SoupReplay({ rec }) {
    const t = useTheme(), G = GS(), r = rec.replay || {};
    return h("div", { style: { padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink, lineHeight: 1.7 } }, h("span", { style: { color: t.fog } }, "汤面："), r.surface),
      h(SoupLog, { log: r.log, t, colors: G && G.guess.VERDICT_COLOR }),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink, lineHeight: 1.7, borderTop: "1px solid " + t.line, paddingTop: 10 } }, h("span", { style: { color: t.fog } }, "汤底："), r.truth));
  }
  ADAPTERS.gomoku.Table = GomokuTable; ADAPTERS.gomoku.Replay = GomokuReplay;
  ADAPTERS.haigui.Table = SoupTable; ADAPTERS.haigui.Replay = SoupReplay;
  root.NetGameUI = { InviteCard, RecordCard };
})(typeof window !== "undefined" ? window : globalThis);
