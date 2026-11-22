// 联机小游戏：辩论擂台（设计单第七节末尾「两边各派角色上台、大家在观众席弹幕」）
//
// 挂法：在 netroom-games.js 之后加载，往 NetGameCore.ADAPTERS 里登记 debate 这一盒（接口照那份文件顶上那张表）。
//   · 报名：每人可以自己上台、派自己带来的角色上台，或者谁都不派只坐观众席。报名单上能挑正方／反方／随人设。
//   · 站队：挑了边的照挑的；角色选「随人设」的，开讲前由带 TA 来的那台用 TA 的线路按人设挑（单机擂台那条「按人设站队」）；
//     真人没挑、NPC 由庄补到人少的那一边。两边都得有人。
//   · 发言：按正反交替的顺序一人一段；真人在自己那台打字，角色由主人那台用 TA 的线路＋人设写（DebateShared.genTurn）。
//   · 观众席弹幕：走桌边那一路（Session.side），直接广播，不经庄；自己带来的没上台的角色由主人那台偶尔冒一句。
//   · 判定：说完最后一轮（或房主点「收台判胜负」），庄用自己的线路跑单机那一份 genResult；
//     赛后感言由每位角色辩手的主人那台各自写（genAfterword），也走桌边那一路。
//   · 提示词全在 js/debate.js 的 DebateShared 里，单机擂台用的同一份；这里只管座位、轮次和桌面。
(function (root) {
  "use strict";
  const C = root.NetGameCore;
  if (!C) return;
  const cut = (v, n) => String(v == null ? "" : v).slice(0, n);
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const DS = () => root.DebateShared || null;
  const ensure = () => DS() || !root.LazyMods ? Promise.resolve() : root.LazyMods.load("debate").catch(() => {});
  const SIDES = ["pro", "con"];
  const SIDE_ZH = { pro: "正方", con: "反方" };
  const nm = (inv, i) => C.seatName((inv.seats || [])[i], i);
  const whoOf = (c, opts, stance) => ({ name: (c && (c.remark || c.name)) || "TA", persona: (c && c.persona) || "", stance: stance || "", injection: opts && opts.recent ? cut(opts.recentText, 600) : "" });
  const NPC_PERSONA = "来凑场的路人，普通人，说话直接。";

  // 实录：给下一位开口、给判定、给房里开口的角色看，都是这一份
  const transcript = (v, n) => (v.turns || []).slice(-(n || 40)).map(x => "〔第" + (x.round + 1) + "轮〕" + x.name + "（" + SIDE_ZH[x.side] + "）：" + x.text).join("\n");
  // 两边补齐：没挑的往人少的那边放；有一边一个人都没有，就把最后一个没自己挑的人挪过去
  function settle(st) {
    const sides = st.sides.slice(), cnt = s => sides.filter(x => x === s).length;
    sides.forEach((x, i) => { if (!x) sides[i] = cnt("pro") <= cnt("con") ? "pro" : "con"; });
    SIDES.forEach(s => {
      if (cnt(s) || sides.length < 2) return;
      let k = -1; sides.forEach((x, i) => { if (!st.picked[i]) k = i; });
      if (k < 0) k = sides.length - 1;
      sides[k] = s;
    });
    const pro = [], con = [];
    sides.forEach((x, i) => (x === "pro" ? pro : con).push(i));
    const order = []; for (let i = 0; i < Math.max(pro.length, con.length); i++) { if (pro[i] != null) order.push(pro[i]); if (con[i] != null) order.push(con[i]); }
    return Object.assign({}, st, { sides, order, phase: "talk", pos: 0 });
  }
  const firstBlank = st => st.sides.findIndex((x, i) => !x && st.pickBy[i]);

  async function judge(st, inv, ctx) {
    const base = Object.assign({}, st, { phase: "done", busy: false });
    if (!ctx.hostApi) return Object.assign(base, { verdict: { winner: "", reason: "庄（房主）这台没配线路，这一场不判胜负。", crux: "" } });
    await ensure();
    const D = DS(); if (!D) return Object.assign(base, { verdict: { winner: "", reason: "擂台没装上，这一场不判胜负。", crux: "" } });
    const humans = inv.seats.filter(s => s.kind === "user").map(s => s.name);
    // 单机那一份要的形状：台上的人＋每一轮说了什么；真人当「玩家」，不给 TA 们写感言（感言各自主人那台写）
    const session = { topic: st.topic, mode: st.mode, spectate: !humans.length,
      parts: inv.seats.map((s, i) => ({ name: s.name, kind: s.kind === "user" ? "me" : "char", stance: SIDE_ZH[st.sides[i]] + (st.stances[i] ? "：" + st.stances[i] : ""), persona: s.kind === "npc" ? NPC_PERSONA : "" })),
      rounds: Array.from({ length: (st.rounds || st.round + 1) }, (_, r) => ({ turns: st.turns.filter(x => x.round === r).map(x => ({ name: x.name, stance: SIDE_ZH[x.side], text: x.text })) })).filter(r => r.turns.length) };
    let v = null;
    try { v = await D.genResult(ctx.hostApi, session, humans.join("、") || "观众席", null); } catch (e) { v = null; }
    return Object.assign(base, { verdict: v ? { winner: cut(v.winner, 40), reason: cut(v.reason, 800), crux: cut(v.crux, 300) } : { winner: "", reason: "庄那边没判出来，这一场不判胜负。", crux: "" } });
  }

  const A = {
    zh: "辩论擂台", slow: true,
    // 观众席：角色冒弹幕的那次调用顺带写一声路人观众（genSideLine 的 passerby），不另花调用；台上的 NPC 辩手照旧由庄出手
    mergeNpc: "prev",
    charOpts: ["side", "recent"],
    seatRange: () => ({ min: 2, max: 6 }),
    npcNames: ["路人甲", "路人乙", "路人丙", "路人丁", "路人戊", "路人己"],
    async init(inv, ctx) {
      const pz = ctx.prep || {};
      let topic = cut(pz.topic, 120).trim();
      if (!topic && ctx.hostApi) { await ensure(); try { topic = ((await DS().drawTopics(ctx.hostApi, [], "大家")) || [])[0] || ""; } catch (e) { topic = ""; } }
      if (!topic) throw new Error("还没有辩题：房主写一道，或者配好线路让模型出");
      const sides = inv.seats.map(s => SIDES.indexOf(s.side) >= 0 ? s.side : "");
      const st = { topic: cut(topic, 120), mode: pz.mode === "free" ? "free" : "serious", rounds: int(pz.rounds, 0, 30, 3), round: 0, pos: 0, order: [],
        sides, picked: sides.map(Boolean), pickBy: inv.seats.map((s, i) => !sides[i] && s.kind === "char"), stances: inv.seats.map(() => ""), turns: [], verdict: null, busy: false, phase: "side" };
      return firstBlank(st) >= 0 ? st : settle(st);
    },
    view: st => ({ topic: st.topic, mode: st.mode, rounds: st.rounds, round: st.round, pos: st.pos, order: st.order.slice(), sides: st.sides.slice(), pickBy: st.pickBy.slice(), stances: st.stances.slice(), turns: st.turns.slice(-60), verdict: st.verdict, busy: !!st.busy, phase: st.phase }),
    priv: () => null,
    // 庄在判（busy）时谁都不动；apply 自己按不带 busy 的那一份认人
    turn: st => st.busy ? -1 : st.phase === "side" ? firstBlank(st) : st.phase === "talk" ? st.order[st.pos] : -1,
    async apply(st, seatIdx, mv, ctx) {
      const inv = ctx.inv;
      if (st.phase === "done") return { err: "这一场已经判完了" };
      if (mv && mv.reveal) return { st: await judge(st, inv, ctx) };    // 房主点「收台判胜负」
      if (seatIdx !== this.turn(Object.assign({}, st, { busy: false }))) return { err: "还没轮到这一位" };
      if (st.phase === "side") {
        const n = Object.assign({}, st, { sides: st.sides.slice(), stances: st.stances.slice(), pickBy: st.pickBy.slice(), busy: false });
        n.pickBy[seatIdx] = false;
        if (mv && SIDES.indexOf(mv.side) >= 0) { n.sides[seatIdx] = mv.side; n.picked = st.picked.slice(); n.picked[seatIdx] = true; }
        n.stances[seatIdx] = cut(mv && mv.stance, 120);
        return { st: firstBlank(n) >= 0 ? n : settle(n) };
      }
      const text = cut(mv && mv.say, 800).trim() || "（这一轮没开口）";
      const turns = st.turns.concat([{ seat: seatIdx, name: nm(inv, seatIdx), side: st.sides[seatIdx], round: st.round, text }]);
      let n = Object.assign({}, st, { turns, pos: st.pos + 1, busy: false });
      if (n.pos >= n.order.length) { n.pos = 0; n.round = st.round + 1; }
      if (n.rounds && n.round >= n.rounds) n = await judge(n, inv, ctx);   // rounds＝0：不限轮数，房主点「收台判胜负」才停
      return { st: n };
    },
    // 角色挑边、发言：带 TA 来的那台，TA 自己的线路和人设
    async charMove(view, i, inv, ctx) {
      if (!ctx.api || !ctx.char) return { pass: true };
      await ensure(); const D = DS(); if (!D) return { pass: true };
      if (view.phase === "side") { const r = await D.pickSide(ctx.api, view.topic, whoOf(ctx.char, ctx.opts), view.mode === "free").catch(() => null); return r ? { side: r.side, stance: r.stance } : { pass: true }; }
      return this.speak(ctx.api, view, i, inv, whoOf(ctx.char, ctx.opts, view.stances[i]));
    },
    async npcMove(st, i, inv, ctx) {
      if (st.phase === "side" || !ctx.hostApi) return { pass: true };
      await ensure(); if (!DS()) return { pass: true };
      return this.speak(ctx.hostApi, this.view(st), i, inv, { name: nm(inv, i), persona: NPC_PERSONA, stance: SIDE_ZH[st.sides[i]] });
    },
    async speak(api, view, i, inv, who) {
      who.stance = SIDE_ZH[view.sides[i]] + "（" + view.topic + "）" + (who.stance ? "：" + who.stance : "");
      const others = inv.seats.map((s, k) => k === i ? null : { name: s.name, human: s.kind === "user", stance: SIDE_ZH[view.sides[k]] + (view.stances[k] ? "：" + view.stances[k] : "") }).filter(Boolean);
      const r = await DS().genTurn(api, { topic: view.topic, mode: view.mode, who, others, transcript: transcript(view), uName: "对面" }).catch(() => null);
      return r && r.say ? { say: r.say } : { pass: true };
    },
    // 观众席：我这台带来的、没上台的角色，台上每说完一段有约三分之一的机会冒一句（一个人至少隔三段）；
    //   判完以后，我这台派上台的角色各写一句赛后感言。都用 TA 自己的线路，结果走桌边那一路广播。
    async watch(view, inv, ctx) {
      const D = DS(); if (!D && !root.LazyMods) return [];
      const outs = [], me = ctx.me;
      if (view.phase === "done" && view.verdict) {
        const mine = inv.seats.filter(s => s.kind === "char" && s.peer === me && !s.away && ctx.charOpts(s.charId).talk !== false);
        for (const s of mine) {
          const k = me + ":" + inv.gid + ":aw:" + s.charId; if (said.has(k) || ctx.side.some(x => x.kind === "aw" && x.name === s.name)) continue; said.add(k);
          const c = ctx.charOf(s.charId), api = c && ctx.apiFor(c.id); if (!api) continue;
          await ensure(); if (!DS()) break;
          const i = inv.seats.indexOf(s);
          const text = await DS().genAfterword(api, { topic: view.topic, who: whoOf(c, ctx.charOpts(c.id), SIDE_ZH[view.sides[i]]), verdict: view.verdict, transcript: transcript(view) }).catch(() => "");
          if (text) outs.push({ kind: "aw", name: s.name, text, char: true });
        }
        return outs;
      }
      if (view.phase !== "talk" || !view.turns.length) return [];
      const k = me + ":" + inv.gid + ":t" + view.turns.length; if (said.has(k)) return []; said.add(k);
      const seated = new Set(inv.seats.filter(s => s.kind === "char" && s.peer === me).map(s => s.charId));
      const free = (ctx.myChars || []).filter(id => !seated.has(id)).filter(id => (lastAt[inv.gid + ":" + id] || -9) <= view.turns.length - 3);
      if (!free.length || Math.random() > 0.34) return [];
      const id = free[Math.floor(Math.random() * free.length)], c = ctx.charOf(id), api = c && ctx.apiFor(id);
      if (!api) return [];
      lastAt[inv.gid + ":" + id] = view.turns.length;
      await ensure(); if (!DS()) return [];
      const last = view.turns[view.turns.length - 1];
      const crowd = ctx.side.filter(x => x.kind === "dm").slice(-6).map(x => x.name + "：" + x.text).join("\n");
      const r = await DS().genSideLine(api, { topic: view.topic, mode: view.mode, who: whoOf(c, ctx.charOpts(id)), last: { name: last.name, text: last.text }, transcript: transcript(view, 12), crowd, passerby: true }).catch(() => null);
      return (r && r.text ? [{ kind: "dm", name: (c.remark || c.name), text: r.text, at: r.at, char: true }] : []).concat(r && r.passerby ? [{ kind: "dm", name: "路人观众", text: r.passerby, npc: true }] : []);
    },
    cleanSide(x) {
      if (!x || typeof x !== "object") return null;
      const text = cut(x.text, x.kind === "aw" ? 300 : 120).trim(); if (!text) return null;
      return { kind: x.kind === "aw" ? "aw" : "dm", name: cut(x.name, 40) || "观众", text, at: cut(x.at, 40), char: !!x.char, npc: !!x.npc, peer: cut(x.peer, 40) };
    },
    result(st, inv) {
      if (st.phase !== "done") return null;
      const v = st.verdict || {}, wi = inv.seats.findIndex(s => s.name === v.winner);
      const side = wi >= 0 ? st.sides[wi] : "";
      return { winners: side ? st.sides.map((x, i) => x === side ? i : -1).filter(i => i >= 0) : [],
        text: "「" + cut(st.topic, 30) + "」" + st.turns.length + " 段发言，" + (v.winner ? v.winner + "（" + SIDE_ZH[side] + "）胜" : "没判胜负") + (v.reason ? "：" + cut(v.reason, 80) : "。"),
        replay: { topic: st.topic, mode: st.mode, turns: st.turns.map(x => ({ name: x.name, side: x.side, round: x.round, text: x.text })), verdict: v } };
    },
    cleanTurns: a => (Array.isArray(a) ? a : []).slice(-240).map(x => ({ seat: int(x && x.seat, -1, 11, -1), name: cut(x && x.name, 40), side: x && x.side === "con" ? "con" : "pro", round: int(x && x.round, 0, 4, 0), text: cut(x && x.text, 800) })),
    cleanVerdict: v => v && typeof v === "object" ? { winner: cut(v.winner, 40), reason: cut(v.reason, 800), crux: cut(v.crux, 300) } : null,
    cleanReplay(r) { return { topic: cut(r.topic, 120), mode: r.mode === "free" ? "free" : "serious", turns: this.cleanTurns(r.turns), verdict: this.cleanVerdict(r.verdict) }; },
    cleanView(v) {
      const arr = (a, f) => (Array.isArray(a) ? a : []).slice(0, 12).map(f);
      return { topic: cut(v.topic, 120), mode: v.mode === "free" ? "free" : "serious", rounds: int(v.rounds, 0, 30, 3), round: int(v.round, 0, 999, 0), pos: int(v.pos, 0, 11, 0),
        order: arr(v.order, x => int(x, 0, 11, 0)), sides: arr(v.sides, x => SIDES.indexOf(x) >= 0 ? x : ""), pickBy: arr(v.pickBy, x => !!x), stances: arr(v.stances, x => cut(x, 120)),
        turns: this.cleanTurns(v.turns), verdict: this.cleanVerdict(v.verdict), busy: !!v.busy, phase: ["side", "talk", "done"].indexOf(v.phase) >= 0 ? v.phase : "side" };
    },
    stateText(v, i, inv) {
      const team = s => inv.seats.map((x, k) => v.sides[k] === s ? x.name : "").filter(Boolean).join("、") || "还没人";
      const head = "辩题：「" + v.topic + "」（" + (v.mode === "free" ? "随便吵" : "讲道理") + "）。正方：" + team("pro") + "；反方：" + team("con") + "。"
        + (i >= 0 && v.sides[i] ? "你在" + SIDE_ZH[v.sides[i]] + "。" : "");
      const said = (v.turns || []).slice(-6).map(x => x.name + "（" + SIDE_ZH[x.side] + "）：" + cut(x.text, 80)).join("\n");
      const tail = v.phase === "done" ? (v.verdict && v.verdict.winner ? "判完了：" + v.verdict.winner + " 那边赢。" : "这一场没判胜负。")
        : v.phase === "side" ? "还在站队。" : "第 " + (v.round + 1) + (v.rounds ? " / " + v.rounds : "") + " 轮，轮到 " + nm(inv, v.order[v.pos]) + " 说。";
      return head + (said ? "\n最近几段：\n" + said : "") + "\n" + tail;
    }
  };
  const said = new Set(), lastAt = {};
  C.ADAPTERS.debate = A;
  // 小游戏大厅那排盒子里多摆这一盒（它不在单机小游戏的目录里，单机擂台是自己那个 App）
  A.shelf = { key: "debate", zh: "辩论擂台", en: "Debate", min: 2, max: 6, rule: "2~6 人上台 · 其余在观众席" };

  // ───────────── 界面 ─────────────
  if (typeof React === "undefined") return;
  const h = React.createElement;
  const { useState } = React;
  const fs = px => "calc(" + px + "px * var(--app-fs, 1))";
  const SIDE_COLOR = { pro: "#c25a4a", con: "#3f6d8c" };
  const pill = (t, on) => ({ minHeight: 40, padding: "0 16px", borderRadius: 999, border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : t.bg2, color: on ? t.bg : t.ink, fontFamily: F_BODY, fontSize: fs(13) });
  const box = t => ({ width: "100%", resize: "none", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "9px 12px", fontFamily: F_BODY, fontSize: fs(14) });
  const fit = e => { if (typeof fitTextarea === "function") fitTextarea(e.target, 160); };
  const noteEl = (t, s) => h("div", { "data-wk": "nrgamestatus", style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: fs(14.5), color: t.ink } }, s);

  function Speeches({ t, turns }) {
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, (turns || []).map((x, i) => h("div", { key: i, "data-wk": "nrdebateturn", "data-side": x.side,
      style: { borderLeft: "3px solid " + SIDE_COLOR[x.side], padding: "2px 0 2px 10px", fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink, lineHeight: 1.65 } },
      h("div", { style: { fontSize: fs(11.5), color: t.fog } }, x.name + " · " + SIDE_ZH[x.side] + " · 第 " + (x.round + 1) + " 轮"), x.text)));
  }
  function Verdict({ t, v }) {
    if (!v) return null;
    return h("div", { "data-wk": "nrdebateverdict", style: { border: "1px solid " + t.line, borderRadius: 14, background: t.bg2, padding: 12, fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink, lineHeight: 1.65 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15) } }, v.winner ? "胜者：" + v.winner : "没判胜负"),
      v.crux ? h("div", { style: { color: t.fog, fontSize: fs(12.5), marginTop: 4 } }, "其实在吵的是：" + v.crux) : null,
      v.reason ? h("div", { style: { marginTop: 4 } }, v.reason) : null);
  }
  function DebateTable({ inv, view, me, isHost, onMove, onReveal, side, onSide, nick }) {
    const t = useTheme();
    const [d, setD] = useState(""), [dm, setDm] = useState("");
    const ti = A.turn(view), seat = inv.seats[ti];
    const mineTurn = ti >= 0 && !view.busy && C.actorOf(seat, me, inv.host) === "mine-user";
    const team = s => inv.seats.map((x, k) => view.sides[k] === s ? x.name + (x.kind === "char" ? "（角色）" : x.kind === "npc" ? "（NPC）" : "") : "").filter(Boolean);
    const dms = (side || []).filter(x => x.kind === "dm").slice(-8), aws = (side || []).filter(x => x.kind === "aw");
    const status = view.phase === "done" ? "判完了" : view.busy ? "庄在判…" : view.phase === "side" ? (mineTurn ? "挑你这一边" : (seat ? seat.name + " 在按人设挑边…" : "在站队…"))
      : mineTurn ? "轮到你（第 " + (view.round + 1) + (view.rounds ? " / " + view.rounds : "") + " 轮）" : (seat && seat.away ? seat.name + " 掉线了，NPC 先替着说…" : C.seatName(seat, view.order[view.pos]) + " 在想…（第 " + (view.round + 1) + " / " + view.rounds + " 轮）");
    return h("div", { "data-wk": "nrgametable", "data-game": "debate", style: { padding: "8px 16px 10px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { "data-wk": "nrdebatetopic", style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink, lineHeight: 1.5 } }, "「" + view.topic + "」", h("span", { style: { marginLeft: 6, fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, view.mode === "free" ? "随便吵" : "讲道理")),
      view.phase !== "side" && h("div", { className: "flex", style: { gap: 8 } }, SIDES.map(s => h("div", { key: s, "data-wk": "nrdebateteam", "data-side": s, style: { flex: 1, minWidth: 0, borderRadius: 12, border: "1px solid " + SIDE_COLOR[s], padding: "6px 10px", fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink } },
        h("div", { style: { color: SIDE_COLOR[s], fontSize: fs(11.5) } }, SIDE_ZH[s]), team(s).join("、") || "—"))),
      h(Speeches, { t, turns: view.turns }),
      view.phase === "done" && h(Verdict, { t, v: view.verdict }),
      aws.length ? h("div", { "data-wk": "nrdebateafter", style: { fontFamily: F_BODY, fontSize: fs(13), color: t.ink, lineHeight: 1.6 } }, aws.map((x, i) => h("div", { key: i }, h("span", { style: { color: t.fog } }, x.name + " 赛后："), x.text))) : null,
      noteEl(t, status),
      mineTurn && view.phase === "side" && h("div", { className: "flex", style: { gap: 8, justifyContent: "center" } }, SIDES.map(s => h("button", { key: s, "data-wk": "nrdebateside", onClick: () => onMove(ti, { side: s }), style: pill(t, false) }, SIDE_ZH[s]))),
      mineTurn && view.phase === "talk" && h("textarea", { "data-wk": "nrdebateinput", value: d, rows: 3, onChange: e => { setD(e.target.value.slice(0, 800)); fit(e); }, placeholder: "你这一段（" + SIDE_ZH[view.sides[ti]] + "）", style: box(t) }),
      mineTurn && view.phase === "talk" && h("div", { className: "flex", style: { gap: 8 } },
        h("button", { "data-wk": "nrdebatesend", disabled: !d.trim(), onClick: () => { const v = d.trim(); setD(""); onMove(ti, { say: v }); }, style: pill(t, true) }, "说完"),
        h("button", { "data-wk": "nrdebatepass", onClick: () => onMove(ti, { pass: true }), style: pill(t, false) }, "这轮不说")),
      isHost && view.phase === "talk" && !view.busy && h("button", { "data-wk": "nrdebateend", onClick: onReveal, style: Object.assign(pill(t, false), { alignSelf: "flex-start" }) }, "收台判胜负"),
      // 观众席：房里每个人都能发，没上台的也行；自己带来的没上台的角色偶尔也会冒一句（由你这台、用 TA 的线路）
      h("div", { "data-wk": "nrdebatecrowd", style: { borderTop: "1px solid " + t.line, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog } }, "观众席 · 弹幕只在这张桌边，不进房间聊天"),
        dms.map((x, i) => h("div", { key: i, "data-wk": "nrdebatedm", style: { fontFamily: F_BODY, fontSize: fs(12.5), color: t.ink } }, h("span", { style: { color: t.fog } }, x.name + (x.char ? "（角色）" : "") + "："), x.text)),
        onSide && h("div", { className: "flex", style: { gap: 6 } },
          h("input", { "data-wk": "nrdebatedminput", value: dm, onChange: e => setDm(e.target.value.slice(0, 120)), placeholder: "起个哄……", style: Object.assign(box(t), { flex: 1, minWidth: 0, padding: "7px 12px" }),
            onKeyDown: e => { if (e.key === "Enter" && dm.trim()) { onSide({ kind: "dm", name: nick, text: dm.trim() }); setDm(""); } } }),
          h("button", { "data-wk": "nrdebatedmsend", disabled: !dm.trim(), onClick: () => { onSide({ kind: "dm", name: nick, text: dm.trim() }); setDm(""); }, style: Object.assign(pill(t, false), { minHeight: 36 }) }, "发"))));
  }
  function DebateReplay({ rec }) {
    const t = useTheme(), r = rec.replay || {};
    return h("div", { style: { padding: "8px 16px", display: "flex", flexDirection: "column", gap: 10 } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: t.ink } }, "「" + (r.topic || "") + "」"), h(Speeches, { t, turns: r.turns }), h(Verdict, { t, v: r.verdict }));
  }
  // 房主开局：辩题（自己写或让模型出）、几轮、讲道理／随便吵、自己上不上台、派谁上台
  //   单机擂台里接不住多台手机的那几样（裁判人选、纸条、临时规矩、台下投票、路人、注入最近聊天给全场）这里没有，页顶说明
  function DebatePrep({ myChars, myApi, nick, onSend }) {
    const t = useTheme();
    const [p, setP] = useState({ topic: "", rounds: 3, mode: "serious", me: "pro", chars: {} });
    const [busy, setBusy] = useState(false), [opts, setOpts] = useState([]);
    const set = o => setP(x => Object.assign({}, x, o));
    const seg = (val, list, on, wk) => h("div", { "data-wk": wk, className: "flex flex-wrap", style: { gap: 6 } }, list.map(o => h("button", { key: o.k, onClick: () => on(o.k), style: Object.assign(pill(t, val === o.k), { minHeight: 34, padding: "0 12px" }) }, o.zh)));
    const label = s => h("div", { style: { fontFamily: F_BODY, fontSize: fs(12), color: t.fog, margin: "4px 0 2px" } }, s);
    const ME = [{ k: "pro", zh: "我上台 · 正方" }, { k: "con", zh: "我上台 · 反方" }, { k: "any", zh: "我上台 · 都行" }, { k: "off", zh: "我坐观众席" }];
    const CH = [{ k: "", zh: "不上" }, { k: "auto", zh: "随人设" }, { k: "pro", zh: "正方" }, { k: "con", zh: "反方" }];
    const draw = async () => {
      if (!myApi) return; setBusy(true);
      try { await ensure(); setOpts((await DS().drawTopics(myApi, (myChars || []).filter(c => p.chars[c.id]), nick || "大家")) || []); } catch (e) { setOpts([]); } finally { setBusy(false); }
    };
    const picks = (p.me === "off" ? [] : [{ kind: "user", side: p.me === "any" ? "" : p.me }])
      .concat((myChars || []).filter(c => p.chars[c.id]).map(c => ({ kind: "char", charId: c.id, name: c.remark || c.name, side: p.chars[c.id] === "auto" ? "" : p.chars[c.id], tag: SIDE_ZH[p.chars[c.id]] || "" })));
    return h("div", { "data-wk": "nrdebateprep", style: { display: "flex", flexDirection: "column", gap: 8 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: fs(12), color: t.fog, lineHeight: 1.7 } }, "几台手机一起开一场。没有单机擂台里的裁判人选、递纸条、临时规矩和台下投票——胜负由你这台（庄）用你的线路判；观众席谁都能发弹幕。别人在邀请卡上报名：自己上台、派带来的角色上台，或者只坐观众席。"),
      label("辩题"),
      h("textarea", { "data-wk": "nrdebatetopicin", value: p.topic, rows: 2, onChange: e => { set({ topic: e.target.value.slice(0, 120) }); fit(e); }, placeholder: "写一句两边都站得住的话；空着就开局时用你的线路现出一道", style: box(t) }),
      myApi && h("button", { "data-wk": "nrdebatedraw", disabled: busy, onClick: draw, style: Object.assign(pill(t, false), { alignSelf: "flex-start", minHeight: 34 }) }, busy ? "在想…" : "让模型出三道挑一道（花一次调用）"),
      opts.length ? seg(p.topic, opts.map(x => ({ k: x, zh: x })), k => set({ topic: k }), "nrdebatetopicopt") : null,
      label("几轮（每轮台上每人说一段）"), seg(p.rounds, [3, 5, 8, 12].map(n => ({ k: n, zh: n + " 轮" })).concat([{ k: 0, zh: "不限" }]), k => set({ rounds: k }), "nrdebaterounds"),
      // 不限：一直轮着说，房主点「收台判胜负」才停（单机擂台也是这样，没有轮数上限）
      label("怎么吵"), seg(p.mode, [{ k: "serious", zh: "讲道理" }, { k: "free", zh: "随便吵" }], k => set({ mode: k }), "nrdebatemode"),
      label("你自己"), seg(p.me, ME, k => set({ me: k }), "nrdebateme"),
      (myChars || []).length ? label("你带来的角色（随人设＝开讲前由你这台按 TA 的人设挑边）") : null,
      (myChars || []).map(c => h("div", { key: c.id, className: "flex items-center", style: { gap: 8, flexWrap: "wrap" } },
        h("span", { style: { fontFamily: F_BODY, fontSize: fs(13.5), color: t.ink, minWidth: 64 } }, c.remark || c.name),
        seg(p.chars[c.id] || "", CH, k => set({ chars: Object.assign({}, p.chars, { [c.id]: k }) }), "nrdebatechar"))),
      h("button", { "data-wk": "nrdebatego", onClick: () => onSend({ total: Math.max(2, picks.length), mode: p.me === "off" ? "spectate" : "normal", npcFill: true, picks }, { topic: p.topic.trim(), rounds: p.rounds, mode: p.mode }), style: Object.assign(pill(t, true), { marginTop: 8 }) }, "发邀请卡"));
  }
  A.Table = DebateTable; A.Replay = DebateReplay; A.Prep = DebatePrep;
})(typeof window !== "undefined" ? window : globalThis);
