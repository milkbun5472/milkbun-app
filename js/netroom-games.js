// 联机房间第三期：一起玩小游戏（设计单第七节，她 2026-11-22 拍板）
//
// 分工：
//   · 房主那台是「庄」：管规则、判输赢、主持（用房主的线路）、替 NPC 出手；整局的状态只在庄那台。
//   · 每台手机只收公开的那一份（view）＋只发给自己的那一份（priv，走 {t:"game", to: peerId}，不广播）。
//   · 轮到谁：真人座位等那台手机上的人点；角色座位由【带 TA 来的那台】用自己的线路替 TA 出手，结果交给庄；
//     NPC 座位庄自己跑。掉线的座位：轮到 TA 时等 20 秒，还没回来就由庄转成 NPC 托管，人回来了自动交还。
//   · 规则本身不在这儿：每一盒用的都是小游戏里那一份（window.GameShared，js/games.js 导出的纯函数和棋盘），单机、联机同一个函数。
//
// 下一个游戏接进来：在 ADAPTERS 里登记一份，写齐这几样（下面两个是现成的样子）——
//   seatRange(cfg)                 → { min, max }   这桌几个座位
//   init(inv, ctx)                 → 状态（可以是 Promise；ctx.hostApi 是庄的线路，ctx.prep 是房主开局前填的）
//   view(st)                       → 发给所有人的那一份（不许带底牌）
//   priv(st, seatIdx)              → 只给这个座位主人看的那一份，没有就 null（手牌、骰子、词、出题人的底牌）；
//                                   每个座位单独一份、单独发到坐这个座位的那台（同一台带了自己和角色，就各收各的）
//   turn(st)                       → 轮到第几个座位，不该有人动就 -1
//   apply(st, seatIdx, move, ctx)  → { st } 或 { err }（可以是 Promise；庄这一台跑）
//   npcMove(st, seatIdx, inv, ctx) → 一手（庄替 NPC 和托管座位出手）
//   charMove(view, seatIdx, inv, ctx) → 一手（角色主人那台跑：ctx.api 是那个角色自己的线路，ctx.char 是本机的角色，
//                                   ctx.priv 是这个座位自己那份 priv——只有这一份，别人的手牌它拿不到）
//   needPriv: true                 → 角色出手要先等到这一手的 priv（手牌类都要）
//   mustFill: true                 → 人数是死的（斗地主 3、麻将 4）：开局时空位一律用 NPC 补，不看「NPC 凑数」开没开
//   result(st, inv)                → null（没完）或 { winners:[seatIdx], text, replay }
//   cleanReplay(r)                 → 战绩卡里回看那一份的白名单
//   stateText(view, seatIdx, inv, priv) → 当前局面写成一段人话，给房里开口的角色当背景（单人开口、一起说都带）；
//                                   只用公开那一份 view，priv 只在 seatIdx 正是这个角色自己的座位时才给
//   （可选）charOpts               → 报名单上每个上台的人能调哪几项，盖过下面 CHAR_OPTS 那张表（"side"＝挑正方／反方）
//   （可选）cleanSide(x) / watch(view, inv, ctx) → 桌边那一路（观众席弹幕、赛后感言）：谁都能发、直接广播、不经庄；
//                                   watch 在每台手机看到新局面时问一句「我这台带来的角色要不要开口」，返回要广播的几条
//   （可选）waiting(view)          → 大家同时交的那几盒：还没交的那几座（亮「轮到你」用）；turn 仍给一座，让角色、托管一位一位跟上
//   （可选）slow(st, seat, mv) / hostRoute → 哪一手要等庄的线路（亮「庄在判」）；庄用哪条线路（"offline"＝线下/跑团那条）
//   （可选）shelf / Prep           → 不在单机小游戏目录里的那几盒：大厅架子上多摆一个盒子，点了进它自己的开局页
//   （可选）localTalk: true        → 出手不调模型的那几盒（棋、牌、大富翁）：桌边台词由框架隔几手／关键时刻另问一次（见下面「牌桌上说话」）
//   （可选）talkMoment(view, seatIdx, inv) → 这一刻对这个座位算不算关键时刻（被将军、刚吃了大牌…），是就回一句「这会儿怎么了」
//   （可选）sayInMove: true        → 这一盒自己把出手里的 say 收进局面（故事接龙），框架不另外拿去当桌边台词
//   mergeNpc: "host" | "prev" | null → NPC 那一手能不能并进别人的那次调用（省一次）：
//        "host"＝问一句庄判一句的（海龟汤、25 问）：庄答真人／角色那一问的同一次，顺带替后面连着的 NPC 各问一个并作答；
//        "prev"＝中间没有庄判定、NPC 也没有要瞒着出手人的东西（故事接龙、真心话 NPC 回应、辩论观众席）：前一位角色的主人那台
//                在 TA 那次调用里顺带写 NPC 那一手，连同 TA 那一手交给庄（move.npc），庄照样校验了才收，费用记在那个角色的线路上；
//        null ＝其余（有私密信息的牌类、卧底、心有灵犀；不调模型的棋）：照旧由庄自己出手。
//
// 牌桌上说话（所有游戏通用）：角色出手的那次调用里可以多带一个 say（不另花调用）；localTalk 的那几盒由主人那台隔几手、
//   或者关键时刻（被将军、一局打完）用 TA 的线路问一句（GameShared.seatTalk）。台词走桌边那一路（kind:"talk"，cleanTalk 白名单），
//   摆在牌桌底下、留进战绩卡回看，不进房间聊天；房里开口的角色从 stateText 里看得到最近几句。给模型的只有公开的 view 和
//   这个座位自己那份 priv。报名单上每个角色能关掉「牌桌上说话」（charOpts.talk === false）。NPC 偶尔也说：由庄跑。
//   Table / Replay                 → 牌桌、回看的界面（复用小游戏原来的部件）。Table 拿到 { inv, view, priv, myApi, me, isHost, onMove, onReveal }
//
// 牌桌不占整页：开着时是浮在房间聊天上的半窗（components.js 的 HalfWinFrame，单聊半窗同一份外壳），能拖、能收起成小条。
//   展开时房里来了新话，顶条提醒「有 N 条新消息」（winOpen / winSet / winUnread）；收起时轮到我这台的真人，小条亮起「轮到你」（myTurn）。
//   这一套所有游戏共用，新接的游戏不用另写。
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
    if (kind === "char") { o.charId = cut(s.charId, 40); if (s.tag) o.tag = cut(s.tag, 8); }
    if (s.away) o.away = true;
    if (s.side === "pro" || s.side === "con") o.side = s.side;   // 报名时自己挑的那一边（辩论用；别的游戏不看）
    return o;
  }
  function cleanInvite(x) {
    if (!x || typeof x !== "object") return null;
    const min = int(x.min, 1, 12, 2), max = int(x.max, min, 12, min);
    const o = { gid: cut(x.gid, 40), key: cut(x.key, 20), zh: cut(x.zh, 20), min, max, host: cut(x.host, 40),
      status: STATUS.indexOf(x.status) >= 0 ? x.status : "open", mode: MODES.indexOf(x.mode) >= 0 ? x.mode : "normal", npcFill: x.npcFill !== false,
      seats: (Array.isArray(x.seats) ? x.seats : []).slice(0, max).map(cleanSeat) };
    const st = cleanSetter(x.setter); if (st) o.setter = st;
    return o;
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
    // 牌桌上说过的话：回看里留着（不进房间聊天）
    const talk = (Array.isArray(x.talk) ? x.talk : []).slice(-40).map(t => cleanTalk(t)).filter(Boolean).map(t => ({ name: t.name, text: t.text, npc: t.npc }));
    if (talk.length) o.talk = talk;
    return o;
  }
  const seatLabel = s => s.kind === "open" ? "空位" : s.name + (s.kind === "char" ? "（角色" + (s.tag ? " · " + s.tag : "") + "）" : s.kind === "npc" ? "（NPC）" : "");
  function inviteLine(x) {
    const seats = x.seats || [], open = seats.filter(s => s.kind === "open").length;
    const st = x.status === "playing" ? "，已经开局" : x.status === "done" ? "，这一局打完了" : x.status === "cancel" ? "，取消了" : "";
    return "[小游戏邀请] " + (x.zh || "") + (x.setter ? "（" + setterLine(x) + "题）" : "") + " · " + seats.length + " 个座位" + (x.status === "open" ? "，空 " + open + " 个" : "") + st
      + "：" + (seats.filter(s => s.kind !== "open").map(seatLabel).join("、") || "还没人坐");
  }
  function recordLine(x) { return "[小游戏战绩] " + (x.zh || "") + "：" + (x.text || ""); }

  // 开一张邀请卡：座位数照开局配置的人数（夹在这个游戏的上下限里），房主自己那边先坐上
  function newInvite(o) {
    const g = o.game || {}, cfg = o.cfg || {};
    const A = ADAPTERS[g.key];
    const r = A ? A.seatRange(cfg) : { min: g.min || 2, max: g.max || 2 };
    const n = int(cfg.total, r.min, r.max, r.min);
    const inv = cleanInvite({ gid: o.gid, key: g.key, zh: g.zh, min: r.min, max: r.max, host: o.host, status: "open", setter: o.setter,
      mode: cfg.mode, npcFill: cfg.npcFill !== false, seats: Array.from({ length: n }, () => ({ kind: "open" })) });
    let out = joinSeats(inv, o.host, o.nick, o.picks || []).inv;
    // 指定座位／轮流出题还没说是谁：先定成第一个坐下的人（房主在卡上能换）
    if (out.setter && (out.setter.mode === "seat" || out.setter.mode === "turns") && !out.setter.peer) { const nx = nextSetter(out, -1); if (nx) out = Object.assign({}, out, { setter: Object.assign({ mode: out.setter.mode }, nx) }); }
    return out;
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
      seats[i] = cleanSeat(p.kind === "user" ? { kind: "user", peer, name: nick, side: p.side } : { kind: "char", peer, charId: p.charId, name: p.name, tag: p.tag, side: p.side });
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
    const seats = inv.npcFill || (A && A.mustFill) ? inv.seats.map(s => s.kind === "open" ? { kind: "npc", name: nextName() } : s) : inv.seats.filter(s => s.kind !== "open");
    return Object.assign({}, inv, { seats });
  }
  function canStart(inv) {
    if (!inv || inv.status !== "open" || takenCount(inv) < 1) return false;
    const A = ADAPTERS[inv.key];
    return (inv.npcFill || (A && A.mustFill) ? inv.seats.length : takenCount(inv)) >= inv.min;
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
    zh: "五子棋", localTalk: true, mergeNpc: null,
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
    // 主人在报名单上把 TA 调成「随手」：跟放水局同一档
    charMove(view, seatIdx, inv, ctx) { const G = GS().gomoku; const lv = ctx && ctx.opts && ctx.opts.casual ? 2 : this.level(inv, inv.seats[seatIdx]); const m = G.bestMove(G.replay(view.moves), seatIdx + 1, lv); return m ? { x: m.x, y: m.y } : null; },
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
  const VERDICT_SET = ["是", "不是", "不重要", "接近了", "不好说", "不对", "跳过"];
  const nmOf = (inv, i) => ((inv.seats || [])[i] || {}).name || "TA";
  // 角色上桌时的那一份：人设；主人勾了「带上 TA 最近单聊」就把那一段接在后面
  const charWho = (c, opts) => ({ name: (c && (c.remark || c.name)) || "TA", persona: ((c && c.persona) || "") + (opts && opts.recent && opts.recentText ? "\n【和带你来的人最近在单聊里聊的】" + cut(opts.recentText, 600) : "") });
  // 报名那张单上，每个勾上的角色可以调哪几项（跟单机开局页按角色调的是同一批）
  // 别的文件接进来的游戏（netroom-cards.js）往这张表里添自己那一行
  const CHAR_OPTS = { chess: ["skill"], xiangqi: ["skill"], jungle: ["skill"], go: ["skill"], gomoku: ["casual"], haigui: ["recent"], q25: ["recent"], story: ["recent"], tod: ["recent"], monopoly: [] };
  // 每一盒都多一项「牌桌上说话」（talk），排在这一盒自己那几项后面
  const charOptKinds = key => ((ADAPTERS[key] && ADAPTERS[key].charOpts) || CHAR_OPTS[key] || []).filter(k => k !== "talk").concat(["talk"]);
  // 桌边台词那一条的白名单：谁说的、说了什么、是不是 NPC、坐哪个座位
  function cleanTalk(x) {
    if (!x || typeof x !== "object") return null;
    const text = cut(x.text, 160).trim(); if (!text) return null;
    return { kind: "talk", name: cut(x.name, 40) || "TA", text, npc: !!x.npc, seat: int(x.seat, -1, 11, -1), peer: cut(x.peer, 40) };
  }
  // 隔几手说一句：桌上每过 every 手（至少 6 手、人多就更久）才轮到同一个人再开口；关键时刻（moment）不用等，但一手里只说一次
  const talkEvery = inv => Math.max(6, ((inv && inv.seats) || []).length * 3);
  function talkDue(memo, key, seq, every, moment) {
    const last = memo[key];
    if (last != null && last >= seq) return false;
    if (moment) return true;
    return seq - (last == null ? 0 : last) >= every;
  }
  const NPC_WHO = n => ({ name: n, persona: "来凑桌的路人，普通玩家。", isNpc: true });

  // ── 谁出题（海龟汤、25 问）：房主 / 系统现出 / 指定某个座位 / 轮流（每局「再来一局」换下一个座位）──
  //   setter：{ mode, peer, charId }。出题的那个座位不参与问答。
  const SETTER_MODES = ["host", "system", "seat", "turns"];
  function cleanSetter(x) {
    if (!x || typeof x !== "object") return null;
    const mode = SETTER_MODES.indexOf(x.mode) >= 0 ? x.mode : "host";
    const o = { mode };
    if (mode === "seat" || mode === "turns") { o.peer = cut(x.peer, 40); if (x.charId) o.charId = cut(x.charId, 40); }
    return o;
  }
  // 出题人坐在第几个座位；没人坐那儿（或者是系统／房主没坐）就 -1
  function setterSeat(inv) {
    const s = inv.setter; if (!s) return -1;
    const seats = inv.seats || [];
    if (s.mode === "host") return seats.findIndex(x => x.kind === "user" && x.peer === inv.host);
    if (s.mode !== "seat" && s.mode !== "turns") return -1;
    return seats.findIndex(x => x.peer === s.peer && (s.charId ? x.kind === "char" && x.charId === s.charId : x.kind === "user"));
  }
  // 能出题的座位（真人、角色）里，排在 after 后面的下一个；after 不在就从头
  function nextSetter(inv, after) {
    const seats = inv.seats || [], ok = seats.map((s, i) => s.kind === "user" || s.kind === "char" ? i : -1).filter(i => i >= 0);
    if (!ok.length) return null;
    const k = ok.find(i => i > after); const i = k == null ? ok[0] : k;
    const s = seats[i];
    return s.kind === "char" ? { peer: s.peer, charId: s.charId } : { peer: s.peer };
  }
  const setterLine = (inv) => {
    const s = inv.setter; if (!s) return "";
    if (s.mode === "system") return "系统现出";
    if (s.mode === "host") return "房主出";
    const i = setterSeat(inv);
    return (i >= 0 ? nmOf(inv, i) : "还没定") + " 出" + (s.mode === "turns" ? "（轮流）" : "");
  };

  // 海龟汤、25 问：庄（房主那台）手里握着汤底／答案，判每个问题；出题人坐着的话轮不到 TA 问
  function guessAdapter(kind, zh) {
    const isSoup = kind === "haigui";
    const hasPuzzle = st => isSoup ? !!(st.surface && st.truth) : !!st.secret;
    const pub = st => isSoup ? { surface: st.surface } : { category: st.category };
    const secretOf = st => isSoup ? { surface: st.surface, truth: st.truth } : { secret: st.secret, category: st.category };
    // 下一个问的人：跳过出题人
    const nextAsker = (st, inv, from) => { const n = inv.seats.length; for (let k = 1; k <= n; k++) { const i = (from + k + n) % n; if (i !== st.setter) return i; } return from; };
    const take = (st, p) => {
      const o = Object.assign({}, st);
      if (isSoup) { o.surface = cut(p && p.surface, 600).trim(); o.truth = cut(p && p.truth, 1200).trim(); }
      else { o.secret = cut(p && p.secret, 40).trim(); o.category = cut(p && p.category, 20).trim() || "东西"; }
      return o;
    };
    // 托管的座位庄也当 NPC 替着问
    const isNpcSeat = s => !!s && (s.kind === "npc" || !!s.away);
    // 从 from 往后数、紧跟着的那一串 NPC 座位（跳过出题人，碰到真人／角色就停，不绕回 stop）
    const npcRun = (st, inv, from, stop) => { const out = []; let i = from; for (let k = 0; k < inv.seats.length; k++) { i = nextAsker(st, inv, i); if (i === stop || out.indexOf(i) >= 0 || !isNpcSeat(inv.seats[i])) break; out.push(i); } return out; };
    const npcSkill = inv => inv.mode === "easy" ? "新手，问得发散、常问偏" : "普通路人，问得没那么准";
    const A = {
      zh, slow: true, kind,
      // 庄答一问的那次，顺带替后面连着的 NPC 各问一个并作答（单机一轮连答那一份 runGuessRound）
      mergeNpc: "host",
      seatRange: () => ({ min: 2, max: 8 }),
      // 房主出／系统现出：开局时就有题；指定座位／轮流：先停在「出题」这一步，等出题人那台交上来
      async init(inv, ctx) {
        const p = ctx && ctx.prep || {}, mode = (inv.setter && inv.setter.mode) || "host", si = setterSeat(inv);
        let st = { phase: "play", setter: si, log: [], turn: 0, done: false, solvedBy: -1, reveal: "", busy: false };
        if (mode === "seat" || mode === "turns") {
          if (si < 0) throw new Error("出题人没坐在桌上：在卡上换一个出题人，或者改成房主出／系统出");
          return Object.assign(st, { phase: "set", turn: si });
        }
        st = take(st, p);
        if (!hasPuzzle(st)) {
          if (!ctx || !ctx.hostApi) throw new Error("没写题，又没有能出题的线路：先去 设置·API 配一条，或者自己写一道");
          st = take(st, await GS().guess.newPuzzle(ctx.hostApi, kind, []));
          if (!hasPuzzle(st)) throw new Error("出题没出成，再点一次开始");
        }
        st.turn = nextAsker(st, inv, -1);
        return st;
      },
      view: st => Object.assign({ phase: st.phase, setter: st.setter, log: st.log.slice(-60), turn: st.turn, done: st.done, solvedBy: st.solvedBy, busy: st.busy,
        reveal: st.done ? (st.reveal || (isSoup ? st.truth : st.secret)) : "" }, isSoup ? { surface: st.surface || "", truth: st.done ? st.truth : "" } : { category: st.category || "", secret: st.done ? st.secret : "" }),
      // 出题人自己那台：手里那份底牌
      priv: (st, i) => i === st.setter && st.phase === "play" ? (isSoup ? { truth: st.truth } : { secret: st.secret }) : null,
      turn: st => st.done || st.busy ? -1 : st.turn,
      hist: log => (log || []).filter(l => l.q).map(l => l.name + "：" + l.q + " → " + l.verdict + (l.note ? "（" + l.note + "）" : "")),
      async apply(st, seatIdx, move, ctx) {
        const inv = ctx.inv, name = seatIdx >= 0 ? nmOf(inv, seatIdx) : "";
        if (st.done) return { err: "这一局已经揭晓了" };
        if (move && (move.reveal || move.end)) return { st: Object.assign({}, st, { done: true, busy: false, reveal: isSoup ? st.truth : st.secret }) };
        if (seatIdx !== st.turn) return { err: "还没轮到这一位" };
        if (st.phase === "set") {
          let n = take(st, move && move.puzzle);
          if (!hasPuzzle(n)) {
            if (!ctx.hostApi) return { err: "出题人那边没交上题" };
            n = take(st, await GS().guess.newPuzzle(ctx.hostApi, kind, []));
            if (!hasPuzzle(n)) return { err: "出题没出成" };
          }
          return { st: Object.assign(n, { phase: "play", busy: false, turn: nextAsker(n, inv, st.setter) }) };
        }
        const next = s => Object.assign({}, s, { turn: nextAsker(s, inv, seatIdx), busy: false });
        // NPC 那一手（只认庄自己替 NPC 出的）：这一位＋后面连着的 NPC，一次调用问完
        if (move && move.npcRound) {
          if (!isNpcSeat(inv.seats[seatIdx]) || !ctx.hostApi) return { st: next(Object.assign({}, st, { log: st.log.concat([{ seat: seatIdx, name, q: "", verdict: "跳过", note: "" }]) })) };
          return { st: await this.roundApply(st, inv, ctx, -1, "", [seatIdx].concat(npcRun(st, inv, seatIdx, seatIdx))) };
        }
        const q = cut(move && (move.ask || move.guess), 300).trim();
        const tooMany = s => !isSoup && s.log.filter(l => l.q).length >= 25 ? Object.assign({}, s, { done: true, reveal: s.secret }) : s;
        if (move && move.pass || !q) return { st: next(Object.assign({}, st, { log: st.log.concat([{ seat: seatIdx, name, q: "", verdict: "跳过", note: "" }]) })) };
        if (!isSoup && GS().guess.hit(st.secret, q)) {
          return { st: Object.assign({}, st, { log: st.log.concat([{ seat: seatIdx, name, q, guess: !!move.guess, verdict: "是", note: "猜中了" }]), done: true, solvedBy: seatIdx, reveal: st.secret, busy: false }) };
        }
        if (!ctx.hostApi) return { err: "庄（房主）这台没配线路，判不了。房主去 设置·API 配一条" };
        const G = GS().guess;
        if (move.guess) {
          const j = await G.judge(ctx.hostApi, kind, secretOf(st), q);
          const row = { seat: seatIdx, name, q, guess: true, verdict: j.correct ? "是" : "不对", note: cut(j.note, 60) };
          if (j.correct) return { st: Object.assign({}, st, { log: st.log.concat([row]), done: true, solvedBy: seatIdx, reveal: isSoup ? st.truth : st.secret, busy: false }) };
          return { st: tooMany(next(Object.assign({}, st, { log: st.log.concat([row]) }))) };
        }
        // 后面紧跟着的 NPC：并进这一次（庄答这一问、再替 TA 们各问一个并作答），不再一个个单独调用
        const run = npcRun(st, inv, seatIdx, seatIdx);
        if (run.length && G.round) return { st: await this.roundApply(st, inv, ctx, seatIdx, q, run) };
        const a = await G.answerOne(ctx.hostApi, kind, secretOf(st), q, this.hist(st.log), name, inv.mode);
        const row = { seat: seatIdx, name, q, verdict: a.verdict, note: a.note };
        if (a.solved && (isSoup || G.hit(st.secret, a.reveal || q))) return { st: Object.assign({}, st, { log: st.log.concat([row]), done: true, solvedBy: seatIdx, reveal: a.reveal || (isSoup ? st.truth : st.secret), busy: false }) };
        return { st: tooMany(next(Object.assign({}, st, { log: st.log.concat([row]) }))) };
      },
      // 一次调用：asker 那一问（q 为空＝轮到的就是 NPC，没人先问）＋ run 里每个 NPC 各一问，庄逐条作答；回下一份局面
      async roundApply(st, inv, ctx, asker, q, run) {
        const G = GS().guess, verdicts = (G.KINDS[kind].verdicts || "").split(" / ");
        const speakers = run.map(i => ({ name: nmOf(inv, i), skill: npcSkill(inv), persona: "来凑桌的路人，普通玩家。", isNpc: true }));
        const humanName = asker >= 0 && q ? nmOf(inv, asker) : "";
        const out = await G.round(ctx.hostApi, kind, secretOf(st), q || null, speakers, this.hist(st.log), inv.mode, humanName) || {};
        const vOk = v => { const x = String(v || "").trim(); return verdicts.indexOf(x) >= 0 ? x : (isSoup ? "不重要" : "不好说"); };
        const rows = [];
        if (q) { const ua = out.userAnswer || {}; rows.push({ seat: asker, name: humanName, q, verdict: vOk(ua.verdict), note: cut(ua.note, 60) }); }
        const ai = Array.isArray(out.ai) ? out.ai : [];
        run.forEach(i => {
          const r = ai.find(x => x && x.name === nmOf(inv, i)), nq = cut(r && r.question, 300).trim();
          rows.push(nq ? { seat: i, name: nmOf(inv, i), q: nq, verdict: vOk(r.verdict), note: cut(r.note, 60) } : { seat: i, name: nmOf(inv, i), q: "", verdict: "跳过", note: "" });
        });
        let solved = -1;
        const by = String(out.solvedBy || "").trim();
        if (by) { const row = rows.find(r => r.name === by && r.q); if (row && (isSoup || G.hit(st.secret, out.reveal || row.q))) solved = row.seat; }
        if (!isSoup && solved < 0) { const row = rows.find(r => r.q && G.hit(st.secret, r.q)); if (row) { solved = row.seat; row.verdict = "是"; row.note = "猜中了"; } }
        const log = st.log.concat(rows);
        if (solved >= 0) return Object.assign({}, st, { log, done: true, solvedBy: solved, reveal: cut(out.reveal, 400) || (isSoup ? st.truth : st.secret), busy: false });
        const n = Object.assign({}, st, { log, busy: false, turn: nextAsker(st, inv, run[run.length - 1]) });
        return !isSoup && n.log.filter(l => l.q).length >= 25 ? Object.assign(n, { done: true, reveal: n.secret }) : n;
      },
      async npcMove(st, seatIdx, inv, ctx) {
        if (st.phase === "set") return { pass: true };            // 托管的出题人：庄自己现出一道
        if (!ctx.hostApi) return { pass: true };
        // 轮到的就是 NPC：这一位连同后面连着的 NPC 一次问完（apply 里 npcRound 那一支）
        if (GS().guess.round) return { npcRound: true };
        const q = await GS().guess.askOne(ctx.hostApi, kind, pub(st), this.hist(st.log), NPC_WHO(nmOf(inv, seatIdx))).catch(() => "");
        return q ? { ask: q } : { pass: true };
      },
      // 角色出题／提问：用带 TA 来的那台、TA 自己的线路和人设；出的题只交给庄
      async charMove(view, seatIdx, inv, ctx) {
        if (!ctx.api || !ctx.char) return { pass: true };
        if (view.phase === "set") {
          const p = await GS().guess.newPuzzle(ctx.api, kind, [], charWho(ctx.char, ctx.opts)).catch(() => null);
          return p ? { puzzle: p } : { pass: true };
        }
        // 主人没关「牌桌上说话」：同一次顺带要一句台词（say），框架拿去走桌边那一路
        const talk = !(ctx.opts && ctx.opts.talk === false);
        const r = await GS().guess.askOne(ctx.api, kind, pub(view), this.hist(view.log), Object.assign(charWho(ctx.char, ctx.opts), talk ? { withSay: true } : {})).catch(() => "");
        const q = typeof r === "string" ? r : (r && r.question) || "";
        return q ? Object.assign({ ask: q }, r && r.say ? { say: r.say } : {}) : { pass: true };
      },
      result(st, inv) {
        if (!st.done) return null;
        const asked = st.log.filter(l => l.q).length;
        const who = st.setter >= 0 ? "，" + nmOf(inv, st.setter) + " 出的题" : "";
        const text = isSoup
          ? "汤面「" + cut(st.surface, 30) + (st.surface.length > 30 ? "…" : "") + "」" + who + "，" + (st.solvedBy >= 0 ? nmOf(inv, st.solvedBy) + " 破了题" : "没人破题，汤底揭晓了") + "，一共问了 " + asked + " 个问题。"
          : "答案是「" + st.secret + "」" + who + "，" + (st.solvedBy >= 0 ? nmOf(inv, st.solvedBy) + " 猜中了" : "没人猜中") + "，一共问了 " + asked + " 个问题。";
        return { winners: st.solvedBy >= 0 ? [st.solvedBy] : [], text,
          replay: Object.assign({ log: st.log.map(l => ({ name: l.name, q: l.q, verdict: l.verdict, note: l.note, guess: !!l.guess })) }, isSoup ? { surface: st.surface, truth: st.truth } : { secret: st.secret, category: st.category }) };
      },
      cleanReplay(r) {
        const log = (Array.isArray(r.log) ? r.log : []).slice(-80).map(l => ({ name: cut(l && l.name, 40), q: cut(l && l.q, 300), verdict: VERDICT_SET.indexOf(l && l.verdict) >= 0 ? l.verdict : "不重要", note: cut(l && l.note, 60), guess: !!(l && l.guess) }));
        return Object.assign({ log }, isSoup ? { surface: cut(r.surface, 600), truth: cut(r.truth, 1200) } : { secret: cut(r.secret, 40), category: cut(r.category, 20) });
      },
      cleanView(v) {
        return Object.assign({ phase: v.phase === "set" ? "set" : "play", setter: int(v.setter, -1, 11, -1), turn: int(v.turn, 0, 11, 0), done: !!v.done, busy: !!v.busy, solvedBy: int(v.solvedBy, -1, 11, -1), reveal: cut(v.reveal, 1200),
          log: (Array.isArray(v.log) ? v.log : []).slice(-60).map(l => ({ seat: int(l && l.seat, -1, 11, -1), name: cut(l && l.name, 40), q: cut(l && l.q, 300), verdict: VERDICT_SET.indexOf(l && l.verdict) >= 0 ? l.verdict : "不重要", note: cut(l && l.note, 60), guess: !!(l && l.guess) })) },
          isSoup ? { surface: cut(v.surface, 600), truth: cut(v.truth, 1200) } : { category: cut(v.category, 20), secret: cut(v.secret, 40) });
      }
    };
    return A;
  }
  ADAPTERS.haigui = guessAdapter("haigui", "海龟汤");
  ADAPTERS.q25 = guessAdapter("q25", "25 问");

  // ── 两人对弈：国际象棋、中国象棋、斗兽棋（规则、终局、电脑棋手都是小游戏里那一份）──
  const pt = a => Array.isArray(a) && a.length === 2 ? [int(a[0], 0, 9, 0), int(a[1], 0, 8, 0)] : null;
  const PROMO = ["q", "r", "b", "n"];
  function engineAdapter(key, zh) {
    const B = () => GS().board[key];
    let ck = null, cs = null;
    const rep = mvs => { const k = JSON.stringify(mvs); if (k !== ck) { ck = k; cs = GS().boardReplay(B().C, mvs); } return cs; };
    const outcome = st => GS().boardOutcome(B().C, rep(st.mvs), st.resigned, B().sides);
    const rec = m => B().record ? B().record(m) : { from: m.from, to: m.to };
    const think = (mvs, inv, seat, char) => {
      let lv = "normal", style;
      if (inv.mode === "easy" && seat && seat.kind !== "user") lv = "easy";
      else if (char) { const c = GS().boardSkillCached(key, char); if (c) { lv = GS().BOARD_TIER_LV[c.tier] || "normal"; style = c.style || undefined; } }
      const m = B().C.bestMove(rep(mvs), lv, style);
      return m ? Object.assign({ from: m.from, to: m.to }, m.promo ? { promo: m.promo } : {}) : { resign: true };
    };
    return {
      zh, board: true, npcNames: ["电脑"], localTalk: true, mergeNpc: null,
      // 关键时刻：轮到这一边、正被将军
      talkMoment(v, i) { const s = rep(v.mvs); return !outcome(v).over && B().sides.indexOf(s.turn) === i && GS().boardOutcome(B().C, s, "", B().sides).st.check ? "你正被将军。" : ""; },
      seatRange: () => ({ min: 2, max: 2 }),
      // 第一个座位执先手（白／红），第二个执后手
      init: () => ({ mvs: [], resigned: "" }),
      view: st => ({ mvs: st.mvs.slice(), resigned: st.resigned }),
      priv: () => null,
      replay: rep, outcome,
      turn: st => outcome(st).over ? -1 : B().sides.indexOf(rep(st.mvs).turn),
      apply(st, seatIdx, mv) {
        const b = B();
        if (outcome(st).over) return { err: "这一局已经下完了" };
        if (mv && mv.resign) return seatIdx === 0 || seatIdx === 1 ? { st: { mvs: st.mvs, resigned: b.sides[seatIdx] } } : { err: "认输的不是桌上的人" };
        const s = rep(st.mvs);
        if (b.sides.indexOf(s.turn) !== seatIdx) return { err: "还没轮到这一边" };
        const from = pt(mv && mv.from), to = pt(mv && mv.to);
        if (!from || !to) return { err: "这一步没看懂" };
        const go = b.C.legalMoves(s, from).filter(m => m.to[0] === to[0] && m.to[1] === to[1] && (!mv.promo || m.promo === mv.promo));
        if (!go.length) return { err: "这一步走不了" };
        return { st: { mvs: st.mvs.concat([rec(b.pick ? b.pick(go) : go[0])]), resigned: "" } };
      },
      npcMove(st, i, inv) { return think(st.mvs, inv, inv.seats[i], null); },
      charMove(view, i, inv, ctx) { return think(view.mvs, inv, inv.seats[i], ctx.char); },
      result(st, inv) {
        const oc = outcome(st); if (!oc.over) return null;
        const b = B(), sz = b.sideZh, n = Math.ceil(st.mvs.length / 2);
        const wi = b.sides.indexOf(oc.winner);
        const res = oc.winner === "draw" || wi < 0 ? "和棋" : nmOf(inv, wi) + "（" + sz(oc.winner) + "）赢了" + (st.resigned ? "（对面认输）" : "");
        return { winners: wi >= 0 ? [wi] : [], text: nmOf(inv, 0) + "（" + sz(b.sides[0]) + "）对 " + nmOf(inv, 1) + "（" + sz(b.sides[1]) + "），" + n + " 回合，" + res + "。",
          replay: { mvs: st.mvs.map(m => Object.assign({ from: m.from, to: m.to }, m.promo ? { promo: m.promo } : {})), resigned: st.resigned } };
      },
      cleanReplay(r) { return this.cleanView(r); },
      cleanView(v) {
        const sides = (GS() && GS().board[key] ? GS().board[key].sides : ["r", "b"]);
        const mvs = (Array.isArray(v.mvs) ? v.mvs : []).slice(0, 600).map(m => { const f = pt(m && m.from), t = pt(m && m.to); if (!f || !t) return null; const o = { from: f, to: t }; if (PROMO.indexOf(m.promo) >= 0) o.promo = m.promo; return o; }).filter(Boolean);
        return { mvs, resigned: sides.indexOf(v.resigned) >= 0 ? v.resigned : "" };
      }
    };
  }
  ADAPTERS.chess = engineAdapter("chess", "国际象棋");
  ADAPTERS.xiangqi = engineAdapter("xiangqi", "中国象棋");
  ADAPTERS.jungle = engineAdapter("jungle", "斗兽棋");

  // ── 围棋：双方连着停一手就由庄那台估死子、照中国规则数子（黑贴 7.5），跟单机按「数子」同一个算法 ──
  const GO_SIZES = [9, 13, 17, 19];
  ADAPTERS.go = {
    zh: "围棋", board: true, npcNames: ["电脑"], localTalk: true, mergeNpc: null,
    seatRange: () => ({ min: 2, max: 2 }),
    init: (inv, ctx) => ({ size: GO_SIZES.indexOf(Number(ctx && ctx.cfg && ctx.cfg.goSize)) >= 0 ? Number(ctx.cfg.goSize) : 9, mvs: [], resigned: 0, result: null }),
    view: st => ({ size: st.size, mvs: st.mvs.slice(), resigned: st.resigned, result: st.result }),
    priv: () => null,
    replay: st => GS().go.replay(GS().go.C, st.size, st.mvs),
    over: st => !!st.resigned || !!st.result,
    turn(st) { return this.over(st) ? -1 : this.replay(st).turn - 1; },
    apply(st, seatIdx, mv) {
      const G = GS().go.C;
      if (this.over(st)) return { err: "这一局已经下完了" };
      if (mv && mv.resign) return seatIdx === 0 || seatIdx === 1 ? { st: Object.assign({}, st, { resigned: seatIdx + 1 }) } : { err: "认输的不是桌上的人" };
      const s = this.replay(st);
      if (s.turn - 1 !== seatIdx) return { err: "还没轮到这一边" };
      let mvs;
      if (mv && mv.pass) mvs = st.mvs.concat([{ pass: true }]);
      else { const p = int(mv && mv.p, -1, st.size * st.size - 1, -1); if (p < 0 || !G.isLegal(s, p)) return { err: "这一点下不了" }; mvs = st.mvs.concat([{ p }]); }
      const n = Object.assign({}, st, { mvs });
      const after = this.replay(n);
      if (after.passes >= 2) n.result = GS().go.result(G, after, G.estimateDead(after, 600));
      return { st: n };
    },
    think(st, inv, i, char) {
      let lv = "normal", style; const seat = inv.seats[i];
      if (inv.mode === "easy" && seat && seat.kind !== "user") lv = "easy";
      else if (char) { const c = GS().boardSkillCached("go", char); if (c) { lv = GS().BOARD_TIER_LV[c.tier] || "normal"; style = c.style || undefined; } }
      const m = GS().go.C.bestMove(this.replay(st), lv, style);
      return m && !m.pass ? { p: m.p } : { pass: true };
    },
    npcMove(st, i, inv) { return this.think(st, inv, i, null); },
    charMove(view, i, inv, ctx) { return this.think(view, inv, i, ctx.char); },
    result(st, inv) {
      if (!this.over(st)) return null;
      const w = st.resigned ? 3 - st.resigned : st.result.winner;
      const res = nmOf(inv, w - 1) + "（" + (w === 1 ? "黑" : "白") + "）" + (st.resigned ? "赢了（对面认输）" : "赢了 " + st.result.margin + " 目（黑 " + st.result.black + " · 白 " + st.result.white + "）");
      return { winners: [w - 1], text: nmOf(inv, 0) + "（黑）对 " + nmOf(inv, 1) + "（白），" + st.size + " 路，" + st.mvs.length + " 手，" + res + "。",
        replay: { size: st.size, mvs: st.mvs, resigned: st.resigned, result: st.result } };
    },
    cleanReplay(r) { return this.cleanView(r); },
    cleanView(v) {
      const size = GO_SIZES.indexOf(Number(v.size)) >= 0 ? Number(v.size) : 9;
      const r = v.result && typeof v.result === "object" ? { winner: int(v.result.winner, 1, 2, 1), black: Number(v.result.black) || 0, white: Number(v.result.white) || 0, margin: Number(v.result.margin) || 0 } : null;
      return { size, mvs: (Array.isArray(v.mvs) ? v.mvs : []).slice(0, 800).map(m => m && m.pass ? { pass: true } : { p: int(m && m.p, 0, size * size - 1, 0) }), resigned: int(v.resigned, 0, 2, 0), result: r };
    }
  };

  // ── 故事接龙：三圈，每人每次抽一个必须用上的词；接句子的提示词是小游戏里那一份 ──
  //   下一位要用的词提前一手抽好放在公开那份里（nextWord）：前一位角色顺带替后面的 NPC 接一句时，知道 TA 该用哪个词
  const storyPairWord = () => GS().story.newGame([], 1).word;
  ADAPTERS.story = {
    zh: "故事接龙", slow: true, sayInMove: true,
    // 角色接完一句、下一位是 NPC：同一次调用顺带替 NPC 接一句（move.npc），庄照样校验了才收
    mergeNpc: "prev",
    seatRange: () => ({ min: 2, max: 8 }),
    init: inv => Object.assign(GS().story.newGame(inv.seats.map((s, i) => ({ key: "s" + i, name: s.name })), 3), { say: [], nextWord: storyPairWord() }),
    view: st => ({ players: st.players, laps: st.laps, turn: st.turn, opener: st.opener, word: st.word, nextWord: st.nextWord || "", status: st.status, lines: st.lines.slice(), say: (st.say || []).slice(-10) }),
    priv: () => null,
    turn: st => st.status === "finished" ? -1 : st.turn,
    apply(st, seatIdx, mv, ctx) {
      if (st.status === "finished") return { err: "故事已经写完了" };
      if (seatIdx !== st.turn) return { err: "还没轮到这一位" };
      const n = JSON.parse(JSON.stringify(st));
      const one = (k, line, say) => {
        const pre = n.nextWord;
        GS().story.act(n, "s" + k, cut(line, 160).trim() || "……");
        // act 刚抽的那个词往后挪一手：这一手用的是提前亮出来的那个
        if (n.status !== "finished" && pre) { const drawn = n.word; n.word = pre; n.nextWord = drawn; }
        const sy = cut(say, 120).trim();
        if (sy) n.say = (n.say || []).concat([{ name: nmOf({ seats: st.players }, k), text: sy }]).slice(-20);
      };
      try { one(seatIdx, mv && mv.line, mv && mv.say); } catch (e) { return { err: String(e.message || e) }; }
      // 并进来的 NPC 那一句：只收紧跟着的那个、确实是 NPC 的座位，句子照样过一遍 act
      const nx = mv && mv.npc, inv = ctx && ctx.inv;
      if (nx && inv && n.status === "playing" && int(nx.seat, -1, 11, -1) === n.turn && (inv.seats[n.turn] || {}).kind === "npc" && cut(nx.line, 160).trim()) {
        try { one(n.turn, nx.line, nx.say); } catch (e) {}
      }
      return { st: n };
    },
    async npcMove(st, i, inv, ctx) {
      if (!ctx.hostApi) return { line: "" };
      const r = await GS().story.writeLine(ctx.hostApi, st, NPC_WHO(nmOf(inv, i))).catch(() => null);
      return r && r.line ? r : { line: "" };
    },
    async charMove(view, i, inv, ctx) {
      if (!ctx.api || !ctx.char) return { line: "" };
      const nx = (i + 1) % inv.seats.length, total = view.players.length * view.laps;
      const st = Object.assign({}, view, { log: [] });
      // 下一位是 NPC、而且这一句不是最后一句：一次写两句（NPC 那句的费用记在这个角色的线路上）
      if (GS().story.writeLineNext && (inv.seats[nx] || {}).kind === "npc" && view.nextWord && view.lines.length + 1 < total) {
        const r = await GS().story.writeLineNext(ctx.api, st, charWho(ctx.char, ctx.opts), NPC_WHO(nmOf(inv, nx)), view.nextWord).catch(() => null);
        if (r && r.line) return Object.assign({ line: r.line, say: r.say }, r.next && r.next.line ? { npc: { seat: nx, line: r.next.line, say: r.next.say } } : {});
      }
      const r = await GS().story.writeLine(ctx.api, st, charWho(ctx.char, ctx.opts)).catch(() => null);
      return r && r.line ? r : { line: "" };
    },
    result(st) {
      if (st.status !== "finished") return null;
      const full = GS().story.text(st);
      return { winners: [], text: "一起写了 " + st.lines.length + " 句：" + cut(full, 60) + (full.length > 60 ? "……" : ""), replay: { opener: st.opener, lines: st.lines.map(l => ({ name: l.name, text: l.text, word: l.word, used: !!l.used })) } };
    },
    cleanReplay(r) { return { opener: cut(r.opener, 200), lines: (Array.isArray(r.lines) ? r.lines : []).slice(0, 64).map(l => ({ name: cut(l && l.name, 40), text: cut(l && l.text, 160), word: cut(l && l.word, 10), used: !!(l && l.used) })) }; },
    cleanView(v) {
      const players = (Array.isArray(v.players) ? v.players : []).slice(0, 8).map(p => ({ key: cut(p && p.key, 4), name: cut(p && p.name, 40) }));
      return { players, laps: int(v.laps, 1, 5, 3), turn: int(v.turn, 0, 7, 0), opener: cut(v.opener, 200), word: cut(v.word, 10), nextWord: cut(v.nextWord, 10), status: v.status === "finished" ? "finished" : "playing",
        lines: this.cleanReplay(v).lines.map((l, i) => Object.assign(l, { key: cut(((v.lines || [])[i] || {}).key, 4) })), say: (Array.isArray(v.say) ? v.say : []).slice(-10).map(x => ({ name: cut(x && x.name, 40), text: cut(x && x.text, 120) })) };
    }
  };

  // ── 真心话大冒险：瓶子指到谁（指得最少的人优先）→ TA 选真心话／大冒险 → 下一位出题 → TA 回应；出题、回应的提示词是小游戏里那一份 ──
  const TD_CHOICES = ["真心话", "大冒险"];
  const tdPlayers = inv => inv.seats.map((s, i) => ({ name: s.name, i }));
  const tdMem = log => (log || []).filter(x => x.type === "td").slice(-6).map(x => "· " + x.name + " 选了" + x.choice + "，" + x.asker + "出题「" + cut(x.prompt, 60) + "」，" + x.name + "：「" + cut(x.response, 80) + "」").join("\n");
  ADAPTERS.tod = {
    zh: "真心话大冒险", slow: true,
    // 角色出题、被点到的是 NPC：中间没有庄判定，同一次调用顺带写 NPC 的回应（move.npc）
    mergeNpc: "prev",
    seatRange: () => ({ min: 2, max: 10 }),
    spin(inv, log, last) { const p = GS().tod.pickTarget(tdPlayers(inv), log, last, "normal"); return p ? p.i : 0; },
    init(inv) {
      const target = this.spin(inv, [], "");
      return { rounds: Math.min(20, inv.seats.length * 2), round: 0, phase: "choose", target, asker: -1, choice: "", prompt: "", lastAsker: "", log: [{ type: "spin", name: nmOf(inv, target) }], done: false };
    },
    view: st => Object.assign({}, st, { log: st.log.slice(-40) }),
    priv: () => null,
    turn: st => st.done ? -1 : st.phase === "ask" ? st.asker : st.target,
    apply(st, seatIdx, mv, ctx) {
      const inv = ctx.inv;
      if (st.done) return { err: "这一局已经结束了" };
      if (mv && mv.end) return { st: Object.assign({}, st, { done: true }) };
      if (seatIdx !== this.turn(st)) return { err: "还没轮到这一位" };
      const tn = nmOf(inv, st.target);
      if (st.phase === "choose") {
        const choice = TD_CHOICES.indexOf(mv && mv.choice) >= 0 ? mv.choice : TD_CHOICES[Math.random() < .5 ? 0 : 1];
        const a = GS().tod.pickAsker(tdPlayers(inv), tn, st.lastAsker);
        return { st: Object.assign({}, st, { phase: "ask", choice, asker: a ? a.i : (st.target + 1) % inv.seats.length }) };
      }
      if (st.phase === "ask") {
        const prompt = cut(mv && mv.prompt, 300).trim() || (st.choice === "真心话" ? "你现在最想对在场谁说一句平时不会说的话？为什么？" : "用十秒钟模仿在场任意一个人的说话方式，让大家猜是谁。");
        const n = Object.assign({}, st, { phase: "answer", prompt });
        // 并进来的 NPC 回应：只收被点到的那个、确实是 NPC 的座位，回应照样走回应那一步
        const nx = mv && mv.npc;
        if (nx && int(nx.seat, -1, 11, -1) === st.target && (inv.seats[st.target] || {}).kind === "npc" && cut(nx.response, 600).trim()) return this.apply(n, st.target, { response: nx.response }, ctx);
        return { st: n };
      }
      const response = cut(mv && mv.response, 600).trim() || "（没接这一题）";
      const an = nmOf(inv, st.asker);
      const log = st.log.concat([{ type: "td", name: tn, asker: an, choice: st.choice, prompt: st.prompt, response }]);
      const round = st.round + 1;
      if (round >= st.rounds) return { st: Object.assign({}, st, { log, round, done: true }) };
      const target = this.spin(inv, log, tn);
      return { st: Object.assign({}, st, { log: log.concat([{ type: "spin", name: nmOf(inv, target) }]), round, phase: "choose", target, asker: -1, choice: "", prompt: "", lastAsker: an }) };
    },
    //   merge：出题的是角色、被点到的是 NPC 时，同一次连 NPC 的回应一起写
    async think(st, i, inv, api, who, merge) {
      if (st.phase === "choose") return { choice: GS().tod.plan(st.log, who.name).choice };
      if (!api) return {};
      const plan = GS().tod.plan(st.log, nmOf(inv, st.target), st.choice);
      const sayOf = o => o && o.say ? { say: o.say } : {};
      if (st.phase === "ask") {
        const npcT = merge && (inv.seats[st.target] || {}).kind === "npc";
        const tg = npcT ? Object.assign(NPC_WHO(nmOf(inv, st.target)), { answerToo: true }) : { name: nmOf(inv, st.target) };
        const o = await GS().tod.ask(api, st.choice, who, false, inv.mode, tdMem(st.log), plan, tg).catch(() => null);
        return Object.assign({ prompt: o && o.prompt || "" }, sayOf(o), npcT && o && String(o.response || "").trim() ? { npc: { seat: st.target, response: String(o.response).trim() } } : {});
      }
      const r = await GS().tod.answer(api, who, st.choice, st.prompt, false, tdMem(st.log), nmOf(inv, st.asker)).catch(() => "");
      return typeof r === "string" ? { response: r || "" } : Object.assign({ response: (r && r.response) || "" }, sayOf(r));
    },
    npcMove(st, i, inv, ctx) { return this.think(st, i, inv, ctx.hostApi, NPC_WHO(nmOf(inv, i))); },
    charMove(view, i, inv, ctx) { const talk = !(ctx.opts && ctx.opts.talk === false); return this.think(view, i, inv, ctx.api, Object.assign({ char: ctx.char }, charWho(ctx.char, ctx.opts), talk ? { withSay: true } : {}), true); },
    result(st) {
      if (!st.done) return null;
      const rs = st.log.filter(x => x.type === "td");
      return { winners: [], text: "转了 " + rs.length + " 轮：" + rs.slice(0, 4).map(x => x.name + "选" + x.choice).join("，") + (rs.length > 4 ? "……" : "。"), replay: { log: rs } };
    },
    cleanReplay(r) { return { log: (Array.isArray(r.log) ? r.log : []).slice(-40).filter(x => x && x.type === "td").map(x => ({ type: "td", name: cut(x.name, 40), asker: cut(x.asker, 40), choice: TD_CHOICES.indexOf(x.choice) >= 0 ? x.choice : "真心话", prompt: cut(x.prompt, 300), response: cut(x.response, 600) })) }; },
    cleanView(v) {
      const log = (Array.isArray(v.log) ? v.log : []).slice(-40).map(x => x && x.type === "spin" ? { type: "spin", name: cut(x.name, 40) } : this.cleanReplay({ log: [x] }).log[0]).filter(Boolean);
      return { rounds: int(v.rounds, 1, 20, 4), round: int(v.round, 0, 20, 0), phase: ["choose", "ask", "answer"].indexOf(v.phase) >= 0 ? v.phase : "choose", target: int(v.target, 0, 11, 0), asker: int(v.asker, -1, 11, -1),
        choice: TD_CHOICES.indexOf(v.choice) >= 0 ? v.choice : "", prompt: cut(v.prompt, 300), lastAsker: cut(v.lastAsker, 40), log, done: !!v.done };
    }
  };

  // ── 大富翁：掷骰、落地结算、买地、升级、拍卖、破产、终局排名全走小游戏里那几条；钱只在庄那台动 ──
  //   拍卖：放弃买的那块地照各家现金和路数自动竞价走完（桌上不一格一格举牌）
  ADAPTERS.monopoly = {
    zh: "大富翁", slow: false, localTalk: true, mergeNpc: null,
    seatRange: () => ({ min: 2, max: 6 }),
    init(inv) {
      const players = inv.seats.map((s, i) => ({ key: "s" + i, name: s.name, cash: inv.mode === "easy" && s.kind === "user" ? 2450 : 2200, pos: 0, bankrupt: false, jailed: 0 }));
      return { players, owners: {}, levels: {}, moves: 0, turn: 0, pending: null, extra: false, log: [{ t: "sys", say: "经典 40 格城市棋盘开局：每人 $2200，绕过起点领 $200；每人约 22 手后按总资产结算。" }], done: false, rank: null };
    },
    view: st => Object.assign({}, st, { log: st.log.slice(-30) }),
    priv: () => null,
    turn: st => st.done ? -1 : st.turn,
    apply(st, seatIdx, mv) {
      const M = GS().mono;
      if (st.done) return { err: "这一局已经结算了" };
      if (seatIdx !== st.turn) return { err: "还没轮到这一位" };
      const ps = st.players.map(p => Object.assign({}, p)), os = Object.assign({}, st.owners), lv = Object.assign({}, st.levels), p = ps[seatIdx];
      const ls = [], ev = [];
      let extra = st.extra;
      const finish = () => {
        const moves = st.moves + 1, rank = M.ranking(ps, os, lv, moves);
        const n = { players: ps, owners: os, levels: lv, moves, pending: null, extra: false, log: st.log.concat(ls.map(x => ({ t: x.type, say: x.say }))).slice(-80), done: !!rank, rank: rank ? rank.map(x => ps.indexOf(ps.find(y => y.key === x.key))) : null };
        n.turn = rank ? -1 : (extra && !p.bankrupt ? seatIdx : M.advance(ps, seatIdx));
        return { st: n };
      };
      if (st.pending) {
        const tile = M.BOARD[st.pending.tile];
        if (st.pending.kind === "buy") {
          if (mv && mv.yes && p.cash >= tile.price) M.buy(p, os, ls, ev);
          else {
            ls.push({ type: "sys", say: p.name + " 没买 " + tile.name + "，银行随即开拍。" });
            const bid = ps.map(x => Object.assign({}, x, { isUser: false }));
            const plan = M.auctionPlan(bid, os, st.pending.tile, p.key);
            if (plan.bidders.length) { M.settleAuction(plan, os, st.pending.tile, ls, ev); const w = ps.find(x => x.key === plan.winner.key); if (w) w.cash = plan.winner.cash; }
            else ls.push({ type: "sys", say: tile.name + " 流拍，暂时留在银行。" });
          }
        } else if (mv && mv.yes && p.cash >= Math.floor(tile.price / 2)) M.upgrade(p, lv, ls, ev);
        else ls.push({ type: "sys", say: "这里是 " + p.name + " 自己的地，巡视一圈。" });
        return finish();
      }
      if (p.jailed) { p.jailed = 0; ls.push({ type: "bad", say: "🔒 " + p.name + " 在看守所待了一手，今天不能掷骰子。" }); extra = false; return finish(); }
      const rl = M.roll(p); extra = rl.extra;
      ls.push({ type: "move", say: rl.say });
      const need = M.land(ps, os, lv, seatIdx, ls, ev);
      if (need && !p.bankrupt) return { st: Object.assign({}, st, { players: ps, owners: os, levels: lv, pending: { kind: need, tile: p.pos }, extra, log: st.log.concat(ls.map(x => ({ t: x.type, say: x.say }))).slice(-80) }) };
      if (extra && !p.bankrupt) ls.push({ type: "sys", say: p.name + " 掷出双骰，下一手还是 " + p.name + " 行动。" });
      return finish();
    },
    decide(st, i, persona) {
      const M = GS().mono, p = Object.assign({}, st.players[i], { persona: persona || "" });
      if (!st.pending) return { roll: true };
      return { yes: !!M.decide(p, M.BOARD[st.pending.tile], st.pending.tile, st.players, st.owners, st.levels, st.moves, st.pending.kind).yes };
    },
    npcMove(st, i) { return this.decide(st, i, ""); },
    charMove(view, i, inv, ctx) { return this.decide(view, i, ctx.char && ctx.char.persona); },
    result(st, inv) {
      if (!st.done || !st.rank) return null;
      const M = GS().mono, w = M.netWorth;
      const rows = st.rank.map(i => st.players[i]).map(p => p.name + " $" + w(p, st.owners, st.levels) + (p.bankrupt ? "（破产）" : ""));
      return { winners: [st.rank[0]], text: st.moves + " 手，" + st.players[st.rank[0]].name + " 赢下这座城。排名：" + rows.join("，") + "。", replay: { rows, log: st.log.slice(-40) } };
    },
    cleanReplay(r) { return { rows: (Array.isArray(r.rows) ? r.rows : []).slice(0, 6).map(x => cut(x, 80)), log: (Array.isArray(r.log) ? r.log : []).slice(-40).map(x => ({ t: cut(x && x.t, 8), say: cut(x && x.say, 200) })) }; },
    cleanView(v) {
      const players = (Array.isArray(v.players) ? v.players : []).slice(0, 6).map((p, i) => ({ key: "s" + i, name: cut(p && p.name, 40), cash: Math.round(Number(p && p.cash) || 0), pos: int(p && p.pos, 0, 39, 0), bankrupt: !!(p && p.bankrupt), jailed: int(p && p.jailed, 0, 3, 0) }));
      const keys = players.map(p => p.key), owners = {}, levels = {};
      Object.keys(v.owners || {}).forEach(k => { const i = int(k, 0, 39, -1); if (i >= 0 && keys.indexOf(v.owners[k]) >= 0) owners[i] = v.owners[k]; });
      Object.keys(v.levels || {}).forEach(k => { const i = int(k, 0, 39, -1); if (i >= 0) levels[i] = int(v.levels[k], 0, 3, 0); });
      const pd = v.pending && typeof v.pending === "object" ? { kind: v.pending.kind === "upgrade" ? "upgrade" : "buy", tile: int(v.pending.tile, 0, 39, 0) } : null;
      return { players, owners, levels, moves: int(v.moves, 0, 999, 0), turn: int(v.turn, -1, 5, 0), pending: pd, extra: !!v.extra, done: !!v.done,
        rank: Array.isArray(v.rank) ? v.rank.map(Number).filter(n => n >= 0 && n < players.length) : null, log: (Array.isArray(v.log) ? v.log : []).slice(-30).map(x => ({ t: cut(x && x.t, 8), say: cut(x && x.say, 200) })) };
    }
  };
  ADAPTERS.gomoku.cleanView = v => ({ moves: (Array.isArray(v.moves) ? v.moves : []).slice(0, 225).map(m => ({ x: int(m && m.x, 0, 14, 0), y: int(m && m.y, 0, 14, 0), who: int(m && m.who, 1, 2, 1) })), turn: int(v.turn, 1, 2, 1), winner: int(v.winner, 0, 3, 0) });
  // ── 每盒的 stateText(view, seatIdx, inv, priv)：当前局面写成人话（只用公开的；priv 是这个座位自己那份）──
  const sideOf = (inv, i, zh) => nmOf(inv, i) + "（" + zh + "）";
  ADAPTERS.gomoku.stateText = (v, i, inv) => {
    const G = GS() && GS().gomoku, last = v.moves.slice(-6).map(m => (m.who === 1 ? "黑" : "白") + (G && G.coord ? G.coord(m.x, m.y) : m.x + "," + m.y)).join(" ");
    return sideOf(inv, 0, "黑") + " 对 " + sideOf(inv, 1, "白") + "，下到第 " + v.moves.length + " 手。" + (last ? "最近几手：" + last + "。" : "") + (v.winner ? (v.winner === 3 ? "和棋了。" : nmOf(inv, v.winner - 1) + "赢了。") : "轮到" + nmOf(inv, v.turn - 1) + "。");
  };
  ["haigui", "q25"].forEach(k => {
    ADAPTERS[k].stateText = (v, i, inv, priv) => {
      const soup = k === "haigui", lines = (v.log || []).filter(l => l.q).slice(-10).map(l => "· " + l.name + "：" + l.q + " → " + l.verdict + (l.note ? "（" + l.note + "）" : ""));
      const mine = i === v.setter && priv ? "\n这一题是你出的，" + (soup ? "汤底" : "答案") + "：" + (priv.truth || priv.secret || "") + "（别说漏嘴）" : "";
      if (v.phase === "set") return nmOf(inv, v.setter) + " 正在出题。";
      return (soup ? "汤面：" + v.surface : "类别：" + v.category) + (v.setter >= 0 ? "（" + nmOf(inv, v.setter) + " 出的题）" : "") + "\n" + (lines.length ? "问过的：\n" + lines.join("\n") : "还没人问。")
        + (v.done ? "\n已揭晓：" + v.reveal + (v.solvedBy >= 0 ? "，" + nmOf(inv, v.solvedBy) + (soup ? " 破了题" : " 猜中了") : "") : "\n还没揭晓，轮到 " + nmOf(inv, v.turn) + " 问。") + mine;
    };
  });
  ["chess", "xiangqi", "jungle"].forEach(k => {
    ADAPTERS[k].stateText = (v, i, inv) => {
      const A = ADAPTERS[k], B = GS().board[k], s = A.replay(v.mvs), oc = A.outcome(v), recent = (s.history || []).slice(-6).map(x => x.san || x.zh || "").filter(Boolean).join(" ");
      const wi = B.sides.indexOf(oc.winner);
      return sideOf(inv, 0, B.sideZh(B.sides[0])) + " 对 " + sideOf(inv, 1, B.sideZh(B.sides[1])) + "，第 " + Math.ceil(v.mvs.length / 2) + " 回合。" + (recent ? "最近几步：" + recent + "。" : "")
        + (oc.over ? (wi < 0 ? "和棋了。" : nmOf(inv, wi) + "赢了" + (v.resigned ? "（对面认输）" : "") + "。") : "轮到" + nmOf(inv, B.sides.indexOf(s.turn)) + (oc.st.check ? "，正被将军" : "") + "。");
    };
  });
  ADAPTERS.go.stateText = (v, i, inv) => {
    const s = ADAPTERS.go.replay(v), over = ADAPTERS.go.over(v), w = v.resigned ? 3 - v.resigned : v.result ? v.result.winner : 0;
    return sideOf(inv, 0, "黑") + " 对 " + sideOf(inv, 1, "白") + "，" + v.size + " 路，第 " + v.mvs.length + " 手，提子 黑 " + s.caps[1] + " 白 " + s.caps[2] + "。"
      + (over ? nmOf(inv, w - 1) + "赢了" + (v.result ? " " + v.result.margin + " 目" : "（对面认输）") + "。" : "轮到" + nmOf(inv, s.turn - 1) + "。");
  };
  ADAPTERS.story.stateText = v => "故事到现在：" + cut([v.opener].concat(v.lines.map(l => l.text)).join(""), 900) + (v.status === "finished" ? "\n写完了。" : "\n轮到 " + (v.players[v.turn] || {}).name + " 接，要用上「" + v.word + "」。");
  ADAPTERS.tod.stateText = (v, i, inv) => {
    const rs = (v.log || []).filter(x => x.type === "td").slice(-4).map(x => "· " + x.name + " 选" + x.choice + "，" + x.asker + "问「" + cut(x.prompt, 60) + "」，答：" + cut(x.response, 80));
    const now = v.done ? "这一局结束了。" : v.phase === "choose" ? "瓶子指到了 " + nmOf(inv, v.target) + "，在选真心话还是大冒险。" : v.phase === "ask" ? nmOf(inv, v.target) + " 选了" + v.choice + "，" + nmOf(inv, v.asker) + " 在出题。" : nmOf(inv, v.asker) + " 给 " + nmOf(inv, v.target) + " 出了" + v.choice + "「" + v.prompt + "」，等 " + nmOf(inv, v.target) + " 回应。";
    return (rs.length ? "前几轮：\n" + rs.join("\n") + "\n" : "") + now;
  };
  ADAPTERS.monopoly.stateText = v => {
    const M = GS().mono;
    return "大富翁第 " + (v.moves + 1) + " 手。各家：" + v.players.map(p => p.name + " $" + p.cash + "（地 " + Object.keys(v.owners).filter(k => v.owners[k] === p.key).length + " 块" + (p.bankrupt ? "，破产" : "") + "）").join("；") + "。"
      + "\n最近：" + v.log.slice(-4).map(x => x.say).join(" ") + (v.done ? "\n结算了。" : "\n轮到 " + (v.players[v.turn] || {}).name + (v.pending ? "，在想要不要" + (v.pending.kind === "buy" ? "买" : "升级") + "【" + M.BOARD[v.pending.tile].name + "】" : "") + "。");
  };

  // ── 牌桌那扇半窗：展开、收起、展开时房里新来了几条 ──
  //   w：{ gid, min, box, pill, seen }；seen＝展开那一刻房里有几条话（不算灰字）。收起时聊天就在底下看得见，不计数
  const winOpen = (w, gid, count) => Object.assign({}, w && w.gid === gid ? w : {}, { gid, min: false, seen: count });
  function winSet(w, next, count) {
    if (!next) return null;
    if (next.min) return Object.assign({}, next, { seen: count });
    if (w && w.min && !next.min) return Object.assign({}, next, { seen: count });
    return next;
  }
  const winUnread = (w, count) => !w || w.min ? 0 : Math.max(0, count - (w.seen || 0));
  // 轮到我这台的真人了没有（收起时小条要亮）
  function myTurn(inv, view, me) {
    const A = ADAPTERS[inv && inv.key]; if (!A || !view || inv.status !== "playing") return false;
    // 大家同时交的那几盒（跑团）：waiting(view) 给出还没交的那几座，其中有我这台的真人就算轮到我
    let w = []; try { w = A.waiting ? A.waiting(view) || [] : [A.turn(view)]; } catch (e) { return false; }
    return w.some(i => i >= 0 && actorOf(inv.seats[i], me, inv.host) === "mine-user");
  }
  // 当前对局写成一段人话，给房里开口的角色当背景：只用公开那一份 view；priv 只给这个座位自己那份
  //   side：这一局桌边那一路（给了就带上最近几句桌边台词）
  function stateText(inv, view, seatIdx, priv, side) {
    const A = ADAPTERS[inv && inv.key]; if (!A || !A.stateText || !view) return "";
    let s = ""; try { s = A.stateText(view, seatIdx, inv, priv || null) || ""; } catch (e) { s = ""; }
    if (!s) return "";
    const seat = (inv.seats || [])[seatIdx];
    const talk = (side || []).filter(x => x && x.kind === "talk").slice(-6).map(x => "· " + x.name + "：" + x.text);
    return "【房里正在玩：" + inv.zh + "】" + (inv.status === "done" ? "（这一局刚打完）" : "") + (seat ? "你坐在第 " + (seatIdx + 1) + " 个座位。" : "你没上桌，在旁边看。") + "\n" + cut(s, 1500)
      + (talk.length ? "\n牌桌上刚才说的：\n" + talk.join("\n") : "");
  }
  const supported = () => Object.keys(ADAPTERS);

  const Core = { cleanTalk, talkEvery, talkDue, CHAR_OPTS, charWho, NPC_WHO, nmOf, charOptKinds, winOpen, winSet, winUnread, myTurn, stateText, SETTER_MODES, cleanSetter, setterSeat, nextSetter, setterLine, SEAT_KINDS, STATUS, AWAY_MS, ADAPTERS, supported, cleanSeat, cleanInvite, cleanRecord, inviteLine, recordLine, newInvite, joinSeats, leaveSeats, addSeat,
    takenCount, fillNpc, canStart, actorOf, privateRoute, awayPlan, setAway };
  root.NetGameCore = Core;

  // ───────────── 一局怎么转起来（庄那一半＋每台手机自己那一半） ─────────────
  // o：me() 我的 peerId；nick()；send(obj, to?) 发给房里（给了 to 只发给 TA）；post(type, x) 往房里发一条卡；
  //    patchCard(gid, x, host) 改那张邀请卡；hostApi() 庄的线路；apiFor(charId)；charOf(charId) 本机的角色；
  //    presence() 房里每个人此刻在不在；onChange() 界面重画；toast(s)
  function Session(o) {
    const host = {};     // 我开的那几局：gid → { inv, st, prep, seq, busy, gone:{peer:ts} }
    const seen = {};     // 每一局我这台看到的：gid → { inv, view, seq, priv, privs:{座位:{seq,data}} }（priv＝我自己那个真人座位的那份）
    const acting = new Set();
    const changed = () => { try { o.onChange && o.onChange(); } catch (e) {} };
    const wait = ms => new Promise(ok => setTimeout(ok, o.fast ? 0 : ms));   // 停一拍再下，像在想（测试里 fast 不停）
    const A = key => ADAPTERS[key];
    // hostRoute：这一盒的庄用哪条线路（不写＝小游戏那条；"offline"＝线下/跑团那条，跟单机跑团同一条）
    const apiOfHost = key => o.hostApi ? o.hostApi((A(key) || {}).hostRoute || "") : null;
    const ctxOf = g => ({ hostApi: apiOfHost(g.inv.key), inv: g.inv, prep: g.prep });
    const shareCard = g => { o.patchCard(g.inv.gid, g.inv, true); o.send({ t: "game", op: "card", gid: g.inv.gid, x: g.inv }); };
    const shareState = g => {
      const ad = A(g.inv.key), view = ad.view(g.st);
      g.seq++;
      local(g.inv, view, g.seq);
      o.send({ t: "game", op: "state", gid: g.inv.gid, inv: g.inv, view, seq: g.seq });
      // 只给座位主人看的那一份：一份一份单独发，不进广播
      g.inv.seats.forEach((s, i) => { const p = ad.priv(g.st, i); if (p != null && s.peer) { if (s.peer === o.me()) gotPriv(g.inv.gid, i, g.seq, p); else o.send({ t: "game", op: "priv", gid: g.inv.gid, seat: i, seq: g.seq, data: p }, s.peer); } });
    };
    // 收到只给我这台的那一份：按座位存（我自己一份、我带来的角色各一份）；角色那一手可能正等着它
    function gotPriv(gid, seat, seq, data) {
      const s = seen[gid]; if (!s) return;
      const sv = (s.inv.seats || [])[seat]; if (!sv || sv.peer !== o.me()) return;
      const privs = Object.assign({}, s.privs || {}), cur = privs[seat];
      if (cur && cur.seq > seq) return;
      privs[seat] = { seq, data };
      s.privs = privs;
      if (sv.kind === "user") s.priv = data;
      changed();
      actOwn(gid);
      talkOwn(gid);
    }
    function local(inv, view, seq) {
      const cur = seen[inv.gid];
      if (cur && cur.seq >= seq) return;
      seen[inv.gid] = Object.assign({}, cur || {}, { inv, view, seq });
      changed();
      actOwn(inv.gid);
      watchOwn(inv.gid);
      talkOwn(inv.gid);
    }
    // 桌边那一路（辩论的观众席弹幕、赛后感言）：谁都能发，直接广播给房里每个人，不经庄、不进对局状态
    //   牌桌上说话（kind:"talk"）每一盒都收，走 cleanTalk；别的几种只有登记了 cleanSide 的那一盒收
    const cleanSideOf = (ad, x) => x && x.kind === "talk" ? cleanTalk(x) : ad.cleanSide ? ad.cleanSide(x) : null;
    function sideAdd(gid, x) {
      const s = seen[gid], ad = s && A(s.inv.key); if (!ad) return;
      const c = cleanSideOf(ad, x); if (!c) return;
      s.side = (s.side || []).concat([c]).slice(-80); changed();
    }
    function side(gid, x) {
      const s = seen[gid], ad = s && A(s.inv.key); if (!ad) return;
      const c = cleanSideOf(ad, Object.assign({}, x, { peer: o.me() })); if (!c) return;
      sideAdd(gid, c); o.send({ t: "game", op: "side", gid, x: c });
    }
    const optsOf = (gid, cid) => (o.charOpts && o.charOpts(gid, cid)) || {};
    const talkMemo = {};
    // 不调模型出手的那几盒：我这台带来的、坐在桌上的角色隔几手（或者关键时刻）说一句；庄另外替 NPC 偶尔说一句
    //   给 TA 看的只有公开的 view 和 TA 自己那个座位的 priv（stateText 只拿这两样）
    async function talkOwn(gid) {
      const s = seen[gid], ad = s && A(s.inv.key), GSx = GS();
      if (!ad || !ad.localTalk || !GSx || !GSx.seatTalk || !s.view) return;
      const inv = s.inv, seq = s.seq, every = talkEvery(inv), over = inv.status === "done";
      if (inv.status !== "playing" && !over) return;
      const view = ad.cleanView ? ad.cleanView(s.view) : s.view;
      const jobs = [];
      inv.seats.forEach((seat, i) => {
        if (seat.kind !== "char" || seat.peer !== o.me() || seat.away || optsOf(gid, seat.charId).talk === false) return;
        // 手牌类：这一手的那份 priv 还没到就先不说（到了 gotPriv 会再叫一次）
        const pv0 = (s.privs || {})[i]; if (ad.needPriv && !over && !(pv0 && pv0.seq >= seq)) return;
        let why = ""; try { why = ad.talkMoment ? ad.talkMoment(view, i, inv) || "" : ""; } catch (e) { why = ""; }
        if (over) why = "这一局刚打完。";
        const key = gid + ":c" + i + (over ? ":end" : "");
        if (!talkDue(talkMemo, key, over ? 1 : seq, every, why)) return;
        talkMemo[key] = over ? 1 : seq;
        const c = o.charOf && o.charOf(seat.charId), api = c && o.apiFor ? o.apiFor(c.id) : null; if (!api) return;
        const pv = (s.privs || {})[i];
        jobs.push({ api, seat: i, who: [{ name: seat.name, persona: (c && c.persona) || "" }], scene: stateText(inv, view, i, pv ? pv.data : null, s.side), why: why || "接着玩，你随口说一句。" });
      });
      // NPC：庄这台跑，隔得更久；只看公开的那一份
      const npcs = inv.seats.map((x, i) => x.kind === "npc" ? i : -1).filter(i => i >= 0);
      if (host[gid] && npcs.length && o.hostApi) {
        const key = gid + ":npc" + (over ? ":end" : "");
        if (talkDue(talkMemo, key, over ? 1 : seq, every * 2, over)) {
          talkMemo[key] = over ? 1 : seq;
          const api = o.hostApi();
          if (api) jobs.push({ api, npc: true, who: npcs.map(i => ({ name: inv.seats[i].name, persona: "来凑桌的路人，普通玩家。", isNpc: true, seat: i })), scene: stateText(inv, view, -1, null, s.side), why: over ? "这一局刚打完。" : "接着玩，想说就随口说一句。" });
        }
      }
      for (const j of jobs) {
        let rows = [];
        try { rows = await GSx.seatTalk(j.api, j.who, j.scene, j.why, (s.side || []).filter(x => x.kind === "talk")) || []; } catch (e) { rows = []; }
        rows.forEach(r => { const w = j.who.find(x => x.name === r.name) || j.who[0]; side(gid, { kind: "talk", name: w.name, text: r.text, npc: !!j.npc, seat: j.npc ? w.seat : j.seat }); });
      }
    }
    // 我这台带来的、没上台的角色（还有台上那几位的感言）：这一局有新动静时，问一下这个游戏要不要替 TA 们开口
    async function watchOwn(gid) {
      const s = seen[gid], ad = s && A(s.inv.key); if (!ad || !ad.watch || !o.myChars) return;
      const k = "w:" + gid + ":" + s.seq; if (acting.has(k)) return; acting.add(k);
      let outs = [];
      // 关了「牌桌上说话」的角色不算进来
      const chars = (o.myChars() || []).filter(cid => optsOf(gid, cid).talk !== false);
      try { outs = await ad.watch(s.view, s.inv, { me: o.me(), seq: s.seq, side: s.side || [], myChars: chars, charOf: o.charOf, apiFor: o.apiFor, charOpts: cid => optsOf(gid, cid), hostApi: o.hostApi ? o.hostApi() : null }) || []; } catch (e) { outs = []; }
      outs.forEach(x => side(gid, x));
    }
    // 轮到我这台带来的角色：用 TA 自己的线路想一手，交给庄
    async function actOwn(gid) {
      const s = seen[gid]; if (!s || !s.view) return;
      const ad = A(s.inv.key); if (!ad) return;
      const ti = ad.turn(ad.cleanView ? ad.cleanView(s.view) : s.view);
      const seat = s.inv.seats[ti];
      if (actorOf(seat, o.me(), s.inv.host) !== "mine-char") return;
      // 手牌类：这一手的那份 priv 还没到，先不动（到了会再叫一次）
      const pv = (s.privs || {})[ti];
      if (ad.needPriv && !(pv && pv.seq >= s.seq)) return;
      const k = gid + ":" + s.seq + ":" + ti;
      if (acting.has(k)) return; acting.add(k);
      const char = o.charOf(seat.charId);
      await wait(600);
      let mv = null;
      // opts：主人在报名那张单上给 TA 调的（怎么下、带不带最近单聊），只存在这台
      const opts = (o.charOpts && o.charOpts(gid, seat.charId)) || {};
      try { mv = await ad.charMove(s.view, ti, s.inv, { api: char ? o.apiFor(char.id) : null, char, opts, priv: pv ? pv.data : null }); } catch (e) { mv = null; }
      if (!mv) mv = { pass: true };
      // 同一次调用顺带的那句台词：走桌边那一路（关了「牌桌上说话」就丢掉）；故事接龙自己收进局面
      if (mv.say != null && !ad.sayInMove) {
        const say = cut(mv.say, 160).trim(); mv = Object.assign({}, mv); delete mv.say;
        if (say && opts.talk !== false) side(gid, { kind: "talk", name: seat.name, text: say, seat: ti });
      } else if (ad.sayInMove && opts.talk === false && mv.say) { mv = Object.assign({}, mv, { say: "" }); }
      // 并进这一手的 NPC 那一手（mergeNpc:"prev"）：只有这一盒声明了才往庄那边带
      if (mv.npc && ad.mergeNpc !== "prev") { mv = Object.assign({}, mv); delete mv.npc; }
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
      const sv = seen[g.inv.gid];
      o.post("gamerec", { gid: g.inv.gid, key: g.inv.key, zh: g.inv.zh, text: res.text, winners: res.winners,
        seats: g.inv.seats.map(s => ({ name: s.name, kind: s.kind })), replay: res.replay,
        talk: ((sv && sv.side) || []).filter(x => x.kind === "talk").slice(-40).map(x => ({ name: x.name, text: x.text, npc: x.npc })) });
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
      // 并进来的 NPC 那一手只认声明了 mergeNpc:"prev" 的那几盒；收下之前 apply 还要再校验一遍
      if (mv && mv.npc && ad.mergeNpc !== "prev") { mv = Object.assign({}, mv); delete mv.npc; }
      g.busy = true;
      // 要等庄的线路判的那几种（海龟汤）：先让大家看到「庄在判…」
      //   slow 也可以是函数：只有这一手真要等庄的线路时才亮（跑团：最后一个人交完那一下）
      if (typeof ad.slow === "function" ? ad.slow(g.st, seatIdx, mv) : ad.slow && mv && !mv.pass && !mv.reveal) { g.st = Object.assign({}, g.st, { busy: true }); shareState(g); }
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
      // 我这台手里某个座位的那份（只有坐这个座位的是我、或者是我带来的角色才有）
      privOf: (gid, seat) => { const s = seen[gid], p = s && s.privs && s.privs[seat]; return p ? p.data : null; },
      isHost: gid => !!host[gid],
      hosting: () => Object.keys(host),
      // 房主：开一张邀请卡（picks 是房主自己这边上谁，开局配置里勾的那几个）
      invite(game, cfg, picks, prep, setter) {
        const gid = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const inv = newInvite({ gid, game, cfg, host: o.me(), nick: o.nick(), picks, setter });
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
      // 房主在卡上换出题人：mode 和（指定座位时）是哪个座位
      setSetter(gid, setter) { const g = host[gid]; if (g && g.inv.status === "open") { g.inv = cleanInvite(Object.assign({}, g.inv, { setter })); shareCard(g); } },
      addSeat(gid) { const g = host[gid]; if (g && g.inv.status === "open") { g.inv = addSeat(g.inv); shareCard(g); } },
      cancel(gid) { const g = host[gid]; if (g && g.inv.status === "open") { g.inv = Object.assign({}, g.inv, { status: "cancel" }); shareCard(g); } },
      async start(gid) {
        const g = host[gid]; if (!g || !canStart(g.inv)) return false;
        const inv = Object.assign(fillNpc(g.inv), { status: "playing" });
        try { g.st = await A(inv.key).init(inv, { hostApi: apiOfHost(inv.key), prep: g.prep, cfg: g.cfg || {} }); }
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
        let inv = cleanInvite(Object.assign({}, g.inv, { gid: ngid, status: "open", seats }));
        // 轮流出题：换到下一个座位
        if (inv.setter && inv.setter.mode === "turns") { const nx = nextSetter(inv, setterSeat(g.inv)); if (nx) inv = Object.assign({}, inv, { setter: Object.assign({ mode: "turns" }, nx) }); }
        host[ngid] = { inv, st: null, prep: null, seq: 0, busy: false, gone: {}, cfg: g.cfg };
        o.post("game", inv);
        return ngid;
      },
      move, side,
      reveal(gid) { if (host[gid]) hostApply(gid, -1, { reveal: true }, o.me()); },
      // 收到房里别人发来的 {t:"game"}：认不得的 op 不理（以后的新版本发来的）
      onMessage(e, origin) {
        const gid = cut(e.gid, 40); if (!gid) return;
        const g = host[gid];
        if (e.op === "join" && !g) { o.send({ t: "game", op: "oops", gid, text: "开这一局的那台手机已经不记得这张邀请卡了（重新进过房间），请房主再发一张" }, origin); }
        else if (e.op === "join" && g.inv.status !== "open") { o.send({ t: "game", op: "oops", gid, text: "这一局已经开始或者结束了，坐不进去了" }, origin); }
        else if (e.op === "join") {
          const nick = o.nickOf(origin);
          // 报名只收这几样：角色怎么下、带不带最近单聊那些设置留在主人那台，不发过来（tag 只是座位旁那两个字）
          const picks = (Array.isArray(e.picks) ? e.picks : []).slice(0, 12).map(p => p && p.kind === "char" ? { kind: "char", charId: cut(p.charId, 40), name: cut(p.name, 40), tag: cut(p.tag, 8), side: p.side } : { kind: "user", side: p && p.side });
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
        } else if (e.op === "priv") { const s = seen[gid]; if (s && s.inv.host === origin) gotPriv(gid, int(e.seat, 0, 11, -1), int(e.seq, 0, 1e9, 0), e.data); }
        else if (e.op === "side") { const x = e.x && typeof e.x === "object" ? Object.assign({}, e.x, { peer: origin }) : null; if (x) sideAdd(gid, x); }
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
  function InviteCard({ x, me, onJoin, onLeave, onStart, onAdd, onCancel, onOpen, onSetter, busy, lost }) {
    const t = useTheme();
    const seats = x.seats || [], isHost = x.host === me, mine = seats.some(s => s.peer === me && s.kind !== "npc");
    const open = seats.filter(s => s.kind === "open").length;
    const stZh = { open: "等人报名", playing: "正在打", done: "打完了", cancel: "取消了" }[x.status];
    return h("div", { "data-wk": "nrgamecard", "data-state": x.status, style: { width: 248, border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 12, display: "flex", flexDirection: "column", gap: 8 } },
      h("div", { className: "flex items-center", style: { gap: 8 } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: fs(16), color: t.ink, flex: 1 } }, x.zh),
        h("span", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog } }, stZh)),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, seats.length + " 个座位" + (x.status === "open" ? " · 空 " + open + " 个" : "") + (x.mode === "easy" ? " · 放水局" : "")),
      x.setter ? h("div", { "data-wk": "nrgamesetter", className: "flex items-center", style: { gap: 8, fontFamily: F_BODY, fontSize: fs(12), color: t.ink } }, "出题：" + setterLine(x),
        isHost && x.status === "open" && (x.setter.mode === "seat" || x.setter.mode === "turns") && onSetter ? h("button", { "data-wk": "nrgamesetterpick", onClick: onSetter, style: Object.assign(pill(t, false), { minHeight: 30, padding: "0 10px", fontSize: fs(12) }) }, "换一个") : null) : null,
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
  ADAPTERS.gomoku.Table = GomokuTable; ADAPTERS.gomoku.Replay = GomokuReplay;
  const note = (t, s) => h("div", { "data-wk": "nrgamestatus", style: { textAlign: "center", marginTop: 10, fontFamily: F_DISPLAY, fontSize: fs(14.5), color: t.ink } }, s);
  const box = t => ({ width: "100%", resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14) });
  const vsSeats = (inv, view, on, markOf, subOf) => inv.seats.map((s, i) => ({ key: "s" + i, name: s.name || "空位", char: { name: s.name || "?" }, isUser: s.kind === "user", on: on === i, mark: markOf ? markOf(i) : null, sub: subOf(i, s), hot: false }));
  const kindTag = s => s.kind === "char" ? " · 角色" : s.kind === "npc" ? " · NPC" : "";

  // 海龟汤、25 问那张桌：出题那一步（出题人自己那台写，或者用自己的线路现出）→ 轮流问 → 揭晓
  function GuessTable({ inv, view, me, onMove, onReveal, isHost, priv, myApi }) {
    const t = useTheme(), G = GS(), soup = inv.key === "haigui";
    const [q, setQ] = useState(""), [a, setA] = useState(""), [b, setB] = useState(""), [busy, setBusy] = useState(false);
    const seat = inv.seats[view.turn];
    const mine = !view.done && !view.busy && actorOf(seat, me, inv.host) === "mine-user";
    const colors = G && G.guess.VERDICT_COLOR;
    if (view.phase === "set") {
      const send = p => onMove(view.turn, { puzzle: p });
      const gen = async () => { if (!myApi) return; setBusy(true); try { send(await G.guess.newPuzzle(myApi, inv.key, [])); } catch (e) {} finally { setBusy(false); } };
      return h("div", { "data-wk": "nrgametable", "data-game": inv.key, "data-phase": "set", style: { padding: "8px 16px 10px", display: "flex", flexDirection: "column", gap: 10 } },
        !mine ? note(t, (seat ? seat.name : "出题人") + (seat && seat.kind === "char" ? " 在想一道题…" : " 在出题…")) : [
          h("div", { key: "n", style: { fontFamily: F_BODY, fontSize: fs(12.5), color: t.fog, lineHeight: 1.6 } }, "轮到你出题：" + (soup ? "汤底" : "答案") + "只交给房主那台判题，别人看不到；这一局你不参与问。"),
          h("textarea", { key: "a", "data-wk": "nrsetter1", value: a, rows: soup ? 3 : 1, onChange: e => setA(e.target.value.slice(0, soup ? 600 : 40)), placeholder: soup ? "汤面：大家看得到的那段怪事" : "答案：一个东西（比如：雨伞）", style: box(t) }),
          h("textarea", { key: "b", "data-wk": "nrsetter2", value: b, rows: soup ? 4 : 1, onChange: e => setB(e.target.value.slice(0, soup ? 1200 : 20)), placeholder: soup ? "汤底：真相" : "类别（大家看得到）：比如 物品", style: box(t) }),
          h("div", { key: "go", className: "flex flex-wrap", style: { gap: 6 } },
            h("button", { "data-wk": "nrsettersend", disabled: !a.trim() || (soup && !b.trim()), onClick: () => send(soup ? { surface: a, truth: b } : { secret: a, category: b }), style: pill(t, true) }, "出这一道"),
            h("button", { "data-wk": "nrsettergen", disabled: busy || !myApi, onClick: gen, style: pill(t, false) }, busy ? "在想…" : myApi ? "用我的线路现出一道" : "没配线路，只能自己写"))]);
    }
    const go = kind => { const v = q.trim(); if (!v && kind !== "pass") return; setQ(""); onMove(view.turn, kind === "pass" ? { pass: true } : kind === "guess" ? { guess: v } : { ask: v }); };
    const answer = soup ? view.truth || view.reveal : view.secret || view.reveal;
    const iSet = view.setter >= 0 && actorOf(inv.seats[view.setter], me, inv.host) === "mine-user";
    return h("div", { "data-wk": "nrgametable", "data-game": inv.key, style: { padding: "8px 16px 10px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 12 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, marginBottom: 4 } }, (soup ? "汤面" : "类别") + (view.setter >= 0 ? " · " + (inv.seats[view.setter] || {}).name + " 出的题" : "")),
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink, lineHeight: 1.7 } }, soup ? view.surface : view.category + (soup ? "" : " · 问了 " + view.log.filter(l => l.q).length + " / 25"))),
      iSet && priv && !view.done ? h(Note0, { t, text: "你出的题，" + (soup ? "汤底" : "答案") + "：" + (priv.truth || priv.secret || "") }) : null,
      h(SoupLog, { log: view.log, t, colors }),
      view.done ? h("div", { "data-wk": "nrsoupreveal", style: { border: "1px solid " + t.ink, borderRadius: 14, padding: 12, fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink, lineHeight: 1.7 } },
        h("div", { style: { fontSize: fs(11), color: t.fog, marginBottom: 4 } }, (view.solvedBy >= 0 ? (inv.seats[view.solvedBy] || {}).name + (soup ? " 破了题 · " : " 猜中了 · ") : "") + (soup ? "汤底" : "答案")), answer)
        : h("div", { style: { fontFamily: F_BODY, fontSize: fs(12.5), color: t.fog } }, view.busy ? "庄在判…" : mine ? "轮到你问" : (seat && seat.away ? seat.name + " 掉线了，NPC 先替着问…" : "轮到 " + (seat ? seat.name : "") + " 问…")),
      mine && h("textarea", { "data-wk": "nrsoupinput", value: q, rows: 2, onChange: e => setQ(e.target.value.slice(0, 300)), placeholder: soup ? "问一个是非题，或者把你想到的汤底整个说出来" : "问一个是非题，或者直接猜它是什么", style: box(t) }),
      mine && h("div", { className: "flex flex-wrap", style: { gap: 6 } },
        h("button", { "data-wk": "nrsoupask", onClick: () => go("ask"), disabled: !q.trim(), style: pill(t, true) }, "问"),
        h("button", { "data-wk": "nrsoupguess", onClick: () => go("guess"), disabled: !q.trim(), style: pill(t, false) }, soup ? "猜汤底" : "猜答案"),
        h("button", { "data-wk": "nrsouppass", onClick: () => go("pass"), style: pill(t, false) }, "这轮不问")),
      isHost && !view.done && h("button", { "data-wk": "nrsoupgiveup", onClick: onReveal, style: Object.assign(pill(t, false), { alignSelf: "flex-start" }) }, soup ? "揭晓汤底（结束这一锅）" : "揭晓答案（结束这一局）"));
  }
  function Note0({ t, text }) { return h("div", { "data-wk": "nrsetterpriv", style: { fontFamily: F_BODY, fontSize: fs(12), color: t.fog, lineHeight: 1.6 } }, text); }
  function GuessReplay({ rec }) {
    const t = useTheme(), G = GS(), r = rec.replay || {}, soup = rec.key === "haigui";
    return h("div", { style: { padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(14), color: t.ink, lineHeight: 1.7 } }, h("span", { style: { color: t.fog } }, soup ? "汤面：" : "类别："), soup ? r.surface : r.category),
      h(SoupLog, { log: r.log, t, colors: G && G.guess.VERDICT_COLOR }),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink, lineHeight: 1.7, borderTop: "1px solid " + t.line, paddingTop: 10 } }, h("span", { style: { color: t.fog } }, soup ? "汤底：" : "答案："), soup ? r.truth : r.secret));
  }

  // 象棋、国际象棋、斗兽棋那张桌：棋盘就是单机那一块；点自己的子、再点亮着的格子走过去
  function EngineTable({ inv, view, me, onMove }) {
    const t = useTheme(), A = ADAPTERS[inv.key], B = GS().board[inv.key];
    const [sel, setSel] = useState(null);
    useEffect(() => { setSel(null); }, [view.mvs.length]);
    const state = A.replay(view.mvs), oc = A.outcome(view), ti = oc.over ? -1 : B.sides.indexOf(state.turn), seat = inv.seats[ti];
    const myTurn = actorOf(seat, me, inv.host) === "mine-user", side = B.sides[ti];
    const mySeat = inv.seats.findIndex(s => actorOf(s, me, inv.host) === "mine-user");
    const targets = myTurn && sel ? B.C.legalMoves(state, sel) : [];
    const tap = (r, c) => {
      if (!myTurn) return;
      const go = targets.filter(m => m.to[0] === r && m.to[1] === c);
      if (go.length) { const m = B.pick ? B.pick(go) : go[0]; setSel(null); onMove(ti, Object.assign({ from: m.from, to: m.to }, m.promo ? { promo: m.promo } : {})); return; }
      const p = state.board[r][c];
      setSel(p && p[0] === side && !(sel && sel[0] === r && sel[1] === c) ? [r, c] : null);
    };
    const wi = B.sides.indexOf(oc.winner);
    const status = oc.over ? (wi < 0 ? "和棋" : nmOf(inv, wi) + "（" + B.sideZh(oc.winner) + "）赢了" + (view.resigned ? "（认输）" : ""))
      : myTurn ? (oc.st.check ? "被将军了，轮到你" : sel ? "点亮着的位置走过去" : "轮到你（" + B.sideZh(side) + "）") : (seat && seat.away ? nmOf(inv, ti) + " 掉线了，NPC 先替着下…" : nmOf(inv, ti) + "在想…");
    return h("div", { "data-wk": "nrgametable", "data-game": inv.key, style: { padding: "4px 16px 10px" } },
      h(GS().GameVsBar, { t, mid: view.mvs.length ? Math.ceil(view.mvs.length / 2) + " 回合" : "", seats: vsSeats(inv, view, ti, null, (i, s) => oc.over ? (wi === i ? "赢了" : "") : B.sideZh(B.sides[i]) + kindTag(s)) }),
      h(B.View, { state, st: oc.st, sel, hint: null, targets, onTap: tap }),
      note(t, status),
      !oc.over && mySeat >= 0 && h("div", { style: { textAlign: "center", marginTop: 8 } },
        h("button", { "data-wk": "nrgameresign", onClick: () => requestAppConfirm("认输？", "这一局算对面赢。", () => onMove(mySeat, { resign: true }), "认输"), style: pill(t, false) }, "认输")));
  }
  function EngineReplay({ rec }) {
    const t = useTheme(), A = ADAPTERS[rec.key], B = GS().board[rec.key], mvs = (rec.replay && rec.replay.mvs) || [];
    const [k, setK] = useState(mvs.length);
    const state = A.replay(mvs.slice(0, k));
    return h("div", { style: { padding: "8px 16px" } }, h(B.View, { state, st: B.C.status(state), targets: [] }), stepper(t, k, mvs.length, setK));
  }
  const stepper = (t, k, n, setK) => h("div", { className: "flex items-center justify-center", style: { gap: 10, marginTop: 10 } },
    h("button", { "data-wk": "nrreplayprev", onClick: () => setK(v => Math.max(0, v - 1)), style: pill(t, false) }, "上一手"),
    h("span", { style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, minWidth: 70, textAlign: "center" } }, k + " / " + n),
    h("button", { "data-wk": "nrreplaynext", onClick: () => setK(v => Math.min(n, v + 1)), style: pill(t, false) }, "下一手"));

  // 围棋那张桌：点一下标出来、同一点再点一下落；停一手、认输；双方都停就由庄数子
  function GoTable({ inv, view, me, onMove }) {
    const t = useTheme(), A = ADAPTERS.go, G = GS().go;
    const [pend, setPend] = useState(-1);
    useEffect(() => { setPend(-1); }, [view.mvs.length]);
    const state = A.replay(view), over = A.over(view), ti = over ? -1 : state.turn - 1, seat = inv.seats[ti];
    const myTurn = actorOf(seat, me, inv.host) === "mine-user";
    const mySeat = inv.seats.findIndex(s => actorOf(s, me, inv.host) === "mine-user");
    const tap = p => { if (!myTurn || !G.C.isLegal(state, p)) return; if (pend === p) { setPend(-1); onMove(ti, { p }); } else setPend(p); };
    const w = view.resigned ? 3 - view.resigned : view.result ? view.result.winner : 0;
    const last = state.history.length ? state.history[state.history.length - 1].mv : null;
    const status = over ? nmOf(inv, w - 1) + "赢了" + (view.resigned ? "（认输）" : " " + view.result.margin + " 目（黑 " + view.result.black + " · 白 " + view.result.white + "）")
      : myTurn ? (pend >= 0 ? "再点一下同一个点落子" : (last && last.pass ? "对面停了一手，轮到你" : "轮到你（" + (ti === 0 ? "黑" : "白") + "）")) : (seat && seat.away ? nmOf(inv, ti) + " 掉线了，NPC 先替着下…" : nmOf(inv, ti) + "在想…");
    return h("div", { "data-wk": "nrgametable", "data-game": "go", style: { padding: "4px 16px 10px" } },
      h(GS().GameVsBar, { t, mid: view.mvs.length ? view.mvs.length + " 手" : view.size + " 路", seats: vsSeats(inv, view, ti, i => h(GS().GmkStone, { side: i + 1, size: 15 }), (i, s) => over ? (w === i + 1 ? "赢了" : "") : (i === 0 ? "黑" : "白") + " · 提 " + state.caps[i + 1] + kindTag(s)) }),
      h(G.View, { state, pend, pendSide: ti + 1, onTap: tap }),
      note(t, status),
      !over && mySeat >= 0 && h("div", { className: "flex justify-center", style: { gap: 8, marginTop: 8 } },
        h("button", { "data-wk": "nrgopass", disabled: !myTurn, onClick: () => onMove(ti, { pass: true }), style: Object.assign(pill(t, false), { opacity: myTurn ? 1 : .45 }) }, "停一手"),
        h("button", { "data-wk": "nrgameresign", onClick: () => requestAppConfirm("认输？", "这一局算对面赢。", () => onMove(mySeat, { resign: true }), "认输"), style: pill(t, false) }, "认输")),
      !over && h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, textAlign: "center", marginTop: 8 } }, "双方连着停一手，房主那台就估死子、照中国规则数子（黑贴 7.5）。"));
  }
  function GoReplay({ rec }) {
    const t = useTheme(), r = rec.replay || {}, mvs = r.mvs || [];
    const [k, setK] = useState(mvs.length);
    const state = ADAPTERS.go.replay({ size: r.size || 9, mvs: mvs.slice(0, k) });
    return h("div", { style: { padding: "8px 16px" } }, h(GS().go.View, { state }), stepper(t, k, mvs.length, setK));
  }

  // 故事接龙那张桌：一页纸、轮到你就写一句（要用上抽到的那个词）
  function StoryTable({ inv, view, me, onMove }) {
    const t = useTheme();
    const [d, setD] = useState("");
    const done = view.status === "finished", seat = inv.seats[view.turn];
    const myTurn = !done && actorOf(seat, me, inv.host) === "mine-user";
    const total = view.players.length * view.laps;
    return h("div", { "data-wk": "nrgametable", "data-game": "story", style: { padding: "8px 16px 10px", display: "flex", flexDirection: "column", gap: 10 } },
      h(StoryPaper, { t, opener: view.opener, lines: view.lines }),
      (view.say || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: fs(12), color: t.fog, lineHeight: 1.6 } }, view.say.slice(-3).map((x, i) => h("div", { key: i }, x.name + "：“" + x.text + "”"))) : null,
      done ? note(t, "写完了，一共 " + view.lines.length + " 句")
        : note(t, myTurn ? "轮到你接（第 " + (view.lines.length + 1) + " / " + total + " 句），要用上「" + view.word + "」" : (seat && seat.away ? seat.name + " 掉线了，NPC 先替着写…" : seat.name + " 在想怎么接…（要用上「" + view.word + "」）")),
      myTurn && h("textarea", { "data-wk": "nrstoryinput", value: d, rows: 2, onChange: e => setD(e.target.value.slice(0, 160)), placeholder: "接着往下写一句……", style: box(t) }),
      myTurn && h("button", { "data-wk": "nrstorysend", disabled: !d.trim(), onClick: () => { const v = d.trim(); setD(""); onMove(view.turn, { line: v }); }, style: Object.assign(pill(t, true), { alignSelf: "flex-start" }) }, "接上"));
  }
  function StoryPaper({ t, opener, lines }) {
    return h("div", { "data-wk": "nrstorypaper", style: { border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 12, fontFamily: F_BODY, fontSize: fs(14), color: t.ink, lineHeight: 1.8 } },
      h("span", { style: { color: t.fog } }, opener),
      (lines || []).map((l, i) => h("span", { key: i, title: l.name }, l.text, h("sup", { style: { fontSize: fs(9.5), color: t.fog, margin: "0 3px 0 1px" } }, (i + 1) + l.name))));
  }
  function StoryReplay({ rec }) { const t = useTheme(), r = rec.replay || {}; return h("div", { style: { padding: "8px 16px" } }, h(StoryPaper, { t, opener: r.opener, lines: r.lines })); }

  // 真心话大冒险那张桌：瓶子指到谁 → 选 → 出题 → 回应，下面一轮一轮记着
  function TodRounds({ t, log }) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, (log || []).filter(x => x.type === "td").map((x, i) => h("div", { key: i, "data-wk": "nrtodrow", style: { border: "1px solid " + t.line, borderRadius: 12, padding: 10, fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.6 } },
      h("div", { style: { color: t.fog, fontSize: fs(11.5) } }, x.name + " · " + x.choice + " · " + x.asker + " 出题"), h("div", null, "「" + x.prompt + "」"), h("div", { style: { marginTop: 4 } }, x.response))));
  }
  function TodTable({ inv, view, me, onMove, onReveal, isHost }) {
    const t = useTheme();
    const [d, setD] = useState("");
    const ti = view.done ? -1 : view.phase === "ask" ? view.asker : view.target, seat = inv.seats[ti];
    const myTurn = ti >= 0 && actorOf(seat, me, inv.host) === "mine-user";
    const tn = nmOf(inv, view.target), an = nmOf(inv, view.asker);
    const head = view.done ? "这一局结束了" : view.phase === "choose" ? "瓶子指到了 " + tn + "：真心话还是大冒险？" : view.phase === "ask" ? tn + " 选了" + view.choice + "，" + an + " 来出题" : an + " 给 " + tn + " 出的" + view.choice + "：「" + view.prompt + "」";
    return h("div", { "data-wk": "nrgametable", "data-game": "tod", style: { padding: "8px 16px 10px", display: "flex", flexDirection: "column", gap: 10 } },
      note(t, head),
      !view.done && h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, textAlign: "center" } }, "第 " + (view.round + 1) + " / " + view.rounds + " 轮" + (myTurn ? "" : " · 等 " + (seat ? seat.name : "") + (seat && seat.away ? "（掉线了，NPC 先替着）" : ""))),
      myTurn && view.phase === "choose" && h("div", { className: "flex justify-center", style: { gap: 8 } },
        ["真心话", "大冒险"].map(c => h("button", { key: c, "data-wk": "nrtodchoose", onClick: () => onMove(ti, { choice: c }), style: pill(t, c === "真心话") }, c))),
      myTurn && view.phase !== "choose" && h("textarea", { "data-wk": "nrtodinput", value: d, rows: 3, onChange: e => setD(e.target.value.slice(0, view.phase === "ask" ? 300 : 600)), placeholder: view.phase === "ask" ? "出一道" + view.choice + "给 " + tn : "照实回答，或者说说你怎么完成的", style: box(t) }),
      myTurn && view.phase !== "choose" && h("button", { "data-wk": "nrtodsend", disabled: !d.trim(), onClick: () => { const v = d.trim(); setD(""); onMove(ti, view.phase === "ask" ? { prompt: v } : { response: v }); }, style: Object.assign(pill(t, true), { alignSelf: "flex-start" }) }, view.phase === "ask" ? "出题" : "回应"),
      h(TodRounds, { t, log: view.log }),
      isHost && !view.done && h("button", { "data-wk": "nrtodend", onClick: onReveal, style: Object.assign(pill(t, false), { alignSelf: "flex-start" }) }, "到这儿结束"));
  }
  function TodReplay({ rec }) { const t = useTheme(); return h("div", { style: { padding: "8px 16px" } }, h(TodRounds, { t, log: (rec.replay || {}).log })); }

  // 大富翁那张桌：棋盘格子是单机那一套；轮到你就掷骰子、在空地／自己的地上拿主意
  function MonoTable({ inv, view, me, onMove }) {
    const t = useTheme(), M = GS().mono;
    const ti = view.done ? -1 : view.turn, seat = inv.seats[ti], cur = view.players[ti];
    const myTurn = ti >= 0 && actorOf(seat, me, inv.host) === "mine-user";
    const pend = view.pending, tile = pend ? M.BOARD[pend.tile] : null;
    const grid = h("div", { "data-wk": "nrmonoboard", style: { display: "grid", gridTemplateColumns: "repeat(11,minmax(0,1fr))", gridTemplateRows: "repeat(11,26px)", gap: 2 } },
      h("div", { style: { gridColumn: "2 / 11", gridRow: "2 / 11", borderRadius: 13, background: t.bg2, border: "1px solid " + t.line, display: "flex", flexDirection: "column", justifyContent: "center", padding: 8, gap: 2, overflow: "hidden" } },
        view.players.map((p, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 6, fontFamily: F_BODY, fontSize: fs(11.5), color: t.ink, opacity: p.bankrupt ? .45 : 1, fontWeight: i === ti ? 700 : 400 } },
          h("span", { style: { width: 8, height: 8, borderRadius: "50%", background: M.tokenColor(p, view.players) } }), p.name + " · " + (p.bankrupt ? "破产" : "$" + p.cash) + (p.jailed ? " · 关押" : "")))),
      M.BOARD.map((x, i) => { const own = view.owners[i], o = view.players.find(p => p.key === own), here = view.players.filter(p => !p.bankrupt && p.pos === i);
        return h("div", { key: i, title: x.name, style: Object.assign({}, M.gridPos(i), { borderRadius: 5, background: x.type === "property" ? x.color + "35" : t.bg2, border: "1px solid " + (cur && cur.pos === i ? t.ink : t.line), overflow: "hidden", textAlign: "center", minWidth: 0 }) },
          h("div", { style: { fontFamily: F_BODY, fontSize: 7, lineHeight: 1.1, color: t.sub, height: 15, overflow: "hidden" } }, (x.icon || "") + x.name),
          h("div", { style: { height: 8, display: "flex", justifyContent: "center", gap: 1 } }, o ? h("span", { style: { width: 6, height: 3, marginTop: 2, background: M.tokenColor(o, view.players) } }) : null,
            here.map(p => h("span", { key: p.key, style: { width: 6, height: 6, borderRadius: "50%", background: M.tokenColor(p, view.players), border: "1px solid #fff" } })))); }));
    const act = view.done ? null : !myTurn ? note(t, seat && seat.away ? cur.name + " 掉线了，NPC 先替着走…" : (cur ? cur.name : "") + (pend ? " 在想要不要" + (pend.kind === "buy" ? "买" : "升级") + "…" : " 在掷骰子…"))
      : pend ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginTop: 8 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink } }, pend.kind === "buy" ? "买下【" + tile.name + "】？$" + tile.price + "（现金 $" + cur.cash + "）" : "升级【" + tile.name + "】？花 $" + Math.floor(tile.price / 2)),
          h("div", { className: "flex", style: { gap: 8 } },
            h("button", { "data-wk": "nrmonoyes", disabled: cur.cash < (pend.kind === "buy" ? tile.price : Math.floor(tile.price / 2)), onClick: () => onMove(ti, { yes: true }), style: pill(t, true) }, pend.kind === "buy" ? "买" : "升级"),
            h("button", { "data-wk": "nrmonono", onClick: () => onMove(ti, { yes: false }), style: pill(t, false) }, pend.kind === "buy" ? "不买（银行拍卖）" : "不升")))
      : h("div", { style: { textAlign: "center", marginTop: 8 } }, h("button", { "data-wk": "nrmonoroll", onClick: () => onMove(ti, { roll: true }), style: pill(t, true) }, cur.jailed ? "在看守所，过这一手" : "掷骰子"));
    return h("div", { "data-wk": "nrgametable", "data-game": "monopoly", style: { padding: "6px 10px 10px" } },
      grid,
      view.done ? note(t, "第 " + view.moves + " 手结算：" + (view.rank || []).map(i => view.players[i].name).join(" > ")) : note(t, "第 " + (view.moves + 1) + " / " + M.maxMoves(view.players.length) + " 手"),
      act,
      h("div", { "data-wk": "nrmonolog", style: { marginTop: 10, fontFamily: F_BODY, fontSize: fs(12), color: t.sub, lineHeight: 1.6 } }, view.log.slice(-6).map((x, i) => h("div", { key: i }, x.say))),
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, marginTop: 6 } }, "不买的地由银行拍卖，照各家现金和路数自动竞价走完；想跟谁讨价还价就在下面房间里说。"));
  }
  function MonoReplay({ rec }) {
    const t = useTheme(), r = rec.replay || {};
    return h("div", { style: { padding: "8px 16px", fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.7 } },
      (r.rows || []).map((x, i) => h("div", { key: "r" + i }, (i + 1) + ". " + x)),
      h("div", { style: { borderTop: "1px solid " + t.line, marginTop: 8, paddingTop: 8, color: t.sub, fontSize: fs(12) } }, (r.log || []).map((x, i) => h("div", { key: i }, x.say))));
  }
  ADAPTERS.haigui.Table = ADAPTERS.q25.Table = GuessTable; ADAPTERS.haigui.Replay = ADAPTERS.q25.Replay = GuessReplay;
  ["chess", "xiangqi", "jungle"].forEach(k => { ADAPTERS[k].Table = EngineTable; ADAPTERS[k].Replay = EngineReplay; });
  ADAPTERS.go.Table = GoTable; ADAPTERS.go.Replay = GoReplay;
  ADAPTERS.story.Table = StoryTable; ADAPTERS.story.Replay = StoryReplay;
  ADAPTERS.tod.Table = TodTable; ADAPTERS.tod.Replay = TodReplay;
  ADAPTERS.monopoly.Table = MonoTable; ADAPTERS.monopoly.Replay = MonoReplay;
  // 牌桌底下那一溜桌边台词（角色、NPC 边玩边说的）：气泡是小游戏里那一份 GameTalkLog；牌桌和回看都用这一个
  //   lines：[{ name, text, seat, npc }]；charOf(line) → 本机认得的角色（画头像、念台词），认不得就只写名字
  function TalkStrip({ lines, charOf, maxHeight }) {
    const t = useTheme(), G = GS();
    if (!G || !G.GameTalkLog || !(lines || []).length) return null;
    return h("div", { "data-wk": "nrgametalk", style: { padding: "4px 16px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), color: t.fog, margin: "0 0 4px 2px" } }, "牌桌上说的"),
      h(G.GameTalkLog, { t, lines: lines.map((l, i) => ({ name: l.name + (l.npc ? "（NPC）" : ""), text: l.text, at: i })), names: true, k: "nrt", maxHeight: maxHeight || 200,
        charOf: l => (charOf && charOf(lines[l.at])) || null }));
  }
  root.NetGameUI = { InviteCard, RecordCard, TalkStrip, kit: { pill, note, box, fs } };
})(typeof window !== "undefined" ? window : globalThis);
