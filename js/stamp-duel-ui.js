// 邮票对局的界面（她 2026-11-07「开工」→ 同日「邮戳能不能放卡面还有写是谁的卡、放错了能取消、UI 弄好看点」）。
//   规则全在 js/stamp-duel.js；这里只摆出来、接她的手指。从邮票册右上「对局」进来。
//   票上放这张卡的卡面（缩略图走邮票册那一份 useStampThumb，由 stamps.js 递进来），底下写卡名和是谁的卡。
//   打完一把选「再来一把」还是「结束」；结束时才问要不要让 TA 记得（几把合成一句）。
(function () {
  "use strict";
  const { useState, useRef, useMemo } = React;
  const h = React.createElement;
  const D = () => window.StampDuel;
  const INK = "#2f2a22", SUB = "rgba(47,42,34,.6)", RED = "#b23a2e", GREEN = "#4f7a66", PAPER = "#fbf6ea";
  const RC = { R: "#5a5248", SR: "#3f6fb0", SSR: "#c8962e" };
  const ROLE_COLOR = { 投递: "#b23a2e", 火漆: "#8a3a4a", 补票: "#4f7a66", 集邮: "#3f6fb0", 邮戳: "#6a4f8a" };
  const ROLE_TIP = { 投递: "打同一列对面最前面那张，空着就打信封", 火漆: "厚，每回合给自己封一层", 补票: "给最残的那张回血、擦掉雨渍和退回", 集邮: "攒胶水、多抽牌", 邮戳: "给对面同一列盖戳" };
  const fz = n => "calc(" + n + "px * var(--app-fs, 1))";
  const F = typeof F_BODY !== "undefined" ? F_BODY : "inherit";
  const FD = typeof F_DISPLAY !== "undefined" ? F_DISPLAY : F;
  // 邮票的齿孔边：跟邮票册那枚同一个画法
  const perf = bg => "radial-gradient(circle at 4px 4px, transparent 2.6px, " + bg + " 2.8px) -4px -4px / 7px 7px";
  // 信封边上的航空条纹
  const AIRMAIL = "repeating-linear-gradient(135deg, #b23a2e 0 10px, " + PAPER + " 10px 16px, #3f6fb0 16px 26px, " + PAPER + " 26px 32px)";
  const noThumb = () => [null, { current: null }];
  // 特效（她 2026-11-07「做一些特效」）：寄出以后按这一回合的记录一步步放——挨打的票闪红、掉血数字飘起来、
  //   回血飘绿、觉醒和盖章整张发金光、中间弹一句台词、信封挨打时整个抖一下。只是放给她看，结算早就算完了
  const FX_CSS = "@keyframes duelHit{0%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}100%{transform:translateX(0)}}"
    + "@keyframes duelFloat{0%{opacity:0;transform:translate(-50%,0) scale(.8)}20%{opacity:1;transform:translate(-50%,-6px) scale(1.15)}100%{opacity:0;transform:translate(-50%,-26px) scale(1)}}"
    + "@keyframes duelGlow{0%{box-shadow:0 0 0 0 rgba(255,207,107,.0)}40%{box-shadow:0 0 14px 5px rgba(255,207,107,.95)}100%{box-shadow:0 0 0 0 rgba(255,207,107,0)}}"
    + "@keyframes duelPop{0%{transform:scale(.4) rotate(-8deg);opacity:0}60%{transform:scale(1.08) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0)}}"
    + "@keyframes duelBanner{0%{opacity:0;transform:translate(-50%,-40%) scale(.9)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-56%)}}"
    + "@keyframes duelInk{0%{transform:scale(2.2) rotate(-20deg);opacity:0}50%{transform:scale(.9) rotate(-8deg);opacity:1}100%{transform:scale(1) rotate(-8deg);opacity:1}}";
  const FX_COLOR = { hit: RED, heal: GREEN, gain: "#3f6fb0", wake: "#c8962e", stamp: "#c8962e", ink: "#6a4f8a", place: INK, fall: RED, skip: SUB };
  // 一条记录落在哪一边：挨打、掉了落在挨的那一边，别的落在动手那一边
  const fxSide = l => (l.kind === "hit" ? (l.who === "me" ? "foe" : "me") : l.who);

  // 一枚贴在信封上的票（或手里的一张）：卡面、稀有度、作用、名字、是谁的卡、攻击／血、章
  function Ticket({ u, card, owner, useThumb, sel, onTap, small, foe, terrain, wk, fx }) {
    const [url, el] = (useThumb || noThumb)(card ? (card.cover || card.face) : null);
    const col = RC[u.rarity] || RC.R, marks = Object.keys(u.marks || {});
    const ready = u.charge != null && u.charge >= u.need;
    return h("button", { ref: el, "data-wk": wk || "duelcell", "data-rarity": u.rarity, "data-foe": foe ? "1" : "0", "data-sel": sel ? "1" : "0", onClick: onTap, className: "active:scale-95",
      style: { position: "relative", width: "100%", aspectRatio: small ? "3 / 4" : "1 / 1", padding: 4, border: "none", background: perf(PAPER), transition: "transform .15s",
        transform: sel ? "translateY(-4px)" : "none", animation: fx ? (fx.kind === "hit" || fx.kind === "skip" ? "duelHit .45s" : fx.kind === "place" ? "duelPop .4s" : "none") : "none", filter: "drop-shadow(0 " + (sel ? 5 : 2) + "px " + (sel ? 6 : 3) + "px rgba(47,42,34," + (sel ? .35 : .22) + "))" } },
      h("div", { style: { position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: 2, outline: sel ? "2px solid " + RED : "1px solid " + col + "88",
        background: url ? "#2a2520 center/cover no-repeat url(" + url + ")" : "linear-gradient(160deg, #efe6d2, #e2d6bd)" } },
        !url ? h("div", { style: { position: "absolute", inset: "18% 6% 30%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: FD, fontSize: fz(small ? 10 : 10.5), color: "#6a5f4e", lineHeight: 1.25, overflow: "hidden" } }, u.name) : null,
        // 左上稀有度、右上作用
        h("span", { style: { position: "absolute", left: 3, top: 3, padding: "0 4px", borderRadius: 3, background: col, color: "#fff", fontFamily: F, fontSize: fz(8.5), fontWeight: 700 } }, u.rarity),
        h("span", { "data-wk": "duelrole", style: { position: "absolute", right: 3, top: 3, padding: "0 4px", borderRadius: 3, background: ROLE_COLOR[u.role], color: "#fff", fontFamily: F, fontSize: fz(8.5) } }, u.role),
        // 手里的票：右上角下面印面值，像真邮票的面额
        small ? h("span", { style: { position: "absolute", right: 4, top: 19, fontFamily: FD, fontSize: fz(15), fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.6)" } }, u.face) : null,
        marks.length ? h("div", { style: { position: "absolute", left: 3, top: 20, display: "flex", flexDirection: "column", gap: 2 } }, marks.map(m => h("span", { key: m, style: { padding: "0 3px", borderRadius: 999, border: "1px solid " + RED, color: RED, background: "rgba(251,246,234,.92)", fontSize: fz(8) } }, m))) : null,
        // 底下：名字、谁的卡、攻击和血
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 4px 3px", background: "linear-gradient(transparent, rgba(20,16,12,.78))", color: "#fff", fontFamily: F } },
          h("div", { style: { fontSize: fz(small ? 9.5 : 9), lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, url ? u.name : ""),
          h("div", { style: { fontSize: fz(8), opacity: .82, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, owner || "通用票"),
          h("div", { className: "flex items-center", style: { gap: 5, fontSize: fz(9), marginTop: 1 } },
            h("span", null, "⚔" + u.pow),
            h("span", null, "♥" + Math.max(0, u.hp != null ? u.hp : u.maxHp) + (u.shield ? "·🛡" + u.shield : "")),
            u.charge != null ? h("span", { className: "flex", style: { marginLeft: "auto", gap: 2 } }, Array.from({ length: u.need }, (_, k) => h("i", { key: k, style: { width: 5, height: 5, borderRadius: 999, background: k < u.charge ? (ready ? "#ffcf6b" : "#fff") : "rgba(255,255,255,.3)" } }))) : null)),
        ready ? h("div", { style: { position: "absolute", inset: 0, boxShadow: "inset 0 0 0 2px #ffcf6b", pointerEvents: "none" } }) : null,
        fx && fx.kind === "hit" ? h("div", { style: { position: "absolute", inset: 0, background: "rgba(178,58,46,.38)", pointerEvents: "none" } }) : null,
        fx && fx.kind === "ink" ? h("div", { style: { position: "absolute", left: "22%", top: "22%", width: "56%", height: "56%", borderRadius: 999, border: "3px double " + FX_COLOR.ink, color: FX_COLOR.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(11), background: "rgba(251,246,234,.7)", animation: "duelInk .5s forwards", pointerEvents: "none" } }, fx.ink || "戳") : null),
      fx && (fx.kind === "wake" || fx.kind === "stamp") ? h("div", { style: { position: "absolute", inset: 2, borderRadius: 3, animation: "duelGlow .9s", pointerEvents: "none" } }) : null,
      fx && fx.txt ? h("span", { "data-wk": "duelfloat", style: { position: "absolute", left: "50%", top: "30%", fontFamily: FD, fontWeight: 700, fontSize: fz(16), color: FX_COLOR[fx.kind] || INK, textShadow: "0 1px 0 #fff, 0 0 4px #fff", animation: "duelFloat .8s forwards", pointerEvents: "none", zIndex: 2 } }, fx.txt) : null,
      terrain ? h("span", { style: { position: "absolute", left: "50%", bottom: -8, transform: "translateX(-50%)", padding: "0 4px", borderRadius: 3, background: PAPER, color: GREEN, fontFamily: F, fontSize: fz(8) } }, terrain) : null);
  }
  function EmptySlot({ terrain, onTap, armed }) {
    const broken = terrain === "破损";
    return h("button", { "data-wk": "duelcell", "data-empty": "1", onClick: onTap, className: "active:opacity-70",
      style: { position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 3, border: "1.5px dashed " + (armed && !broken ? RED : "rgba(47,42,34,.25)"),
        background: broken ? "repeating-linear-gradient(45deg, rgba(178,58,46,.10) 0 5px, transparent 5px 10px)" : armed ? "rgba(178,58,46,.05)" : "rgba(255,255,255,.28)",
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F, fontSize: fz(9.5), color: broken ? RED : terrain ? GREEN : "rgba(47,42,34,.32)" } },
      terrain || (armed ? "贴这里" : ""));
  }
  // 一个信封：外圈航空条纹、里面 3×3；对面的倒过来摆，两边前排面对面
  function Envelope({ sd, foe, sel, onTap, armed, cardOf, ownerOf, useThumb, fx }) {
    const fxOf = i => fx && fx.side === (foe ? "foe" : "me") && (fx.slot === i || (fx.slots || []).includes(i)) ? fx : null;
    const order = foe ? [6, 7, 8, 3, 4, 5, 0, 1, 2] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    return h("div", { "data-wk": "duelboard", "data-foe": foe ? "1" : "0", style: { padding: 5, borderRadius: 6, background: AIRMAIL, maxWidth: 300, margin: "0 auto", boxShadow: "0 2px 6px rgba(47,42,34,.18)", position: "relative",
      animation: fx && fx.kind === "hitEnv" && fx.side === (foe ? "foe" : "me") ? "duelHit .5s" : "none" } },
      fx && fx.kind === "hitEnv" && fx.side === (foe ? "foe" : "me") ? h("span", { style: { position: "absolute", left: "50%", top: "40%", zIndex: 3, fontFamily: FD, fontWeight: 700, fontSize: fz(24), color: RED, textShadow: "0 1px 0 #fff, 0 0 6px #fff", animation: "duelFloat .9s forwards", pointerEvents: "none" } }, "-" + fx.n) : null,
      h("div", { style: { position: "relative", padding: "10px 9px", borderRadius: 3, background: PAPER } },
        h("div", { style: { position: "absolute", left: 3, [foe ? "bottom" : "top"]: 2, fontFamily: F, fontSize: fz(8), color: SUB } }, "前排"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9 } },
          order.map(i => { const u = sd.board[i];
            const f = fxOf(i);
            if (!u && f && f.kind === "fall") return h("div", { key: i, style: { position: "relative" } }, h(EmptySlot, { terrain: sd.terrain[i], onTap: () => onTap(i) }), h("span", { style: { position: "absolute", left: "50%", top: "30%", fontFamily: FD, fontSize: fz(12), color: RED, animation: "duelFloat .9s forwards", whiteSpace: "nowrap" } }, "掉了"));
            return h("div", { key: i }, u ? h(Ticket, { u, card: cardOf(u.cardId), owner: ownerOf(u.charId), useThumb, sel: sel === i, onTap: () => onTap(i), fx: f, foe, terrain: sd.terrain[i] })
              : h(EmptySlot, { terrain: sd.terrain[i], onTap: () => onTap(i), armed: armed && !foe })); }))));
  }
  const Seal = (label, hp, max, color, sub) => h("div", { "data-wk": "duelhp", className: "flex items-center", style: { gap: 8, fontFamily: F, color: INK, margin: "4px 2px" } },
    h("div", { style: { width: 26, height: 26, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, " + color + "dd, " + color + ")", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FD, fontSize: fz(11), boxShadow: "0 1px 3px rgba(0,0,0,.25)" } }, label.slice(0, 1)),
    h("div", { className: "flex-1 min-w-0" },
      h("div", { className: "flex", style: { fontSize: fz(11.5), justifyContent: "space-between" } }, h("span", null, label, sub ? h("span", { style: { color: SUB, marginLeft: 6, fontSize: fz(10.5) } }, sub) : null), h("span", { style: { fontFamily: FD } }, Math.max(0, hp) + " / " + max)),
      h("div", { style: { height: 5, borderRadius: 3, marginTop: 3, background: "rgba(47,42,34,.12)", overflow: "hidden" } }, h("div", { style: { width: Math.max(0, 100 * hp / max) + "%", height: "100%", background: color, transition: "width .4s" } }))));
  const btn = (bg, fg, line) => ({ padding: "7px 14px", borderRadius: 4, background: bg, color: fg, border: line ? "1px solid " + line : "none", fontFamily: F, fontSize: fz(12.5) });

  function StampDuelPage({ characters, cards, onBack, onRemember, closeOf, meName, toast, useThumb }) {
    const [foeId, setFoeId] = useState(() => { const has = (characters || []).find(c => (cards || []).some(x => x.charId === c.id)); return (has || (characters || [])[0] || {}).id; });
    const [blind, setBlind] = useState(false);
    const [st, setSt] = useState(null);
    const [, bump] = useState(0);
    const [handSel, setHandSel] = useState(-1), [boardSel, setBoardSel] = useState(-1);
    const [series, setSeries] = useState(null), [asking, setAsking] = useState(false);
    const [fx, setFx] = useState(null), [banner, setBanner] = useState(null), playing = useRef(0);
    const seedRef = useRef(Date.now() >>> 0);
    const byId = useMemo(() => { const m = {}; (cards || []).forEach(c => { if (c && c.id) m[c.id] = c; }); return m; }, [cards]);
    const nameOf = id => { const c = (characters || []).find(x => x.id === id); return c ? (c.remark || c.name) : ""; };
    const cardOf = id => byId[id] || null, ownerOf = id => id ? nameOf(id) + "的卡" : "";
    const foeName = nameOf(foeId) || "TA";
    // 没打完退出去也留着（她 2026-11-07「没打完暂退能不能存档跟小游戏一样」）：每动一步就存一份，打完、放弃才清
    const SAVE_KEY = "x_stampDuelSave";
    const [saved, setSaved] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON(SAVE_KEY, null) : null; return v && v.st && !v.st.over ? v : null; } catch (e) { return null; } });
    const persist = (x, sr) => { try { if (typeof saveJSON !== "function") return; if (x && !x.over) saveJSON(SAVE_KEY, { st: x, series: sr || null, foeId, at: Date.now() }); else saveJSON(SAVE_KEY, null); } catch (e) {} };
    const redraw = () => { persist(st, series); bump(x => x + 1); };
    const resume = () => { if (!saved) return; setFoeId(saved.foeId); setSt(saved.st); setSeries(saved.series || D().newSeries()); setSaved(null); setHandSel(-1); setBoardSel(-1); };
    const drop = () => { persist(null); setSaved(null); };
    const start = () => {
      const s = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0);
      const me = D().deckFrom(cards, s), them = D().foeDeckFrom(cards, foeId, closeOf ? closeOf(foeId) : [], s);
      const nd = D().newDuel(me, them, s, { blind }); setSt(nd); setHandSel(-1); setBoardSel(-1); setSaved(null);
      setTimeout(() => persist(nd, series), 0);
      setSeries(sr => sr || D().newSeries());
    };
    const fail = r => { if (r && !r.ok && r.why) toast && toast(r.why); return r && r.ok; };
    const shell = (kids) => h("div", { "data-wk": "duelpage", className: "h-full flex flex-col", style: { position: "relative", background: "repeating-linear-gradient(0deg, transparent 0 27px, rgba(47,42,34,.05) 27px 28px), linear-gradient(#f3ebdb, #e8dcc4)" } }, [h("style", { key: "fxcss" }, FX_CSS)].concat(kids));

    // ── 开局前：挑对手、明牌还是盲打 ──
    if (!st) return shell([
      h(Head, { key: "hd", zh: "对局", bg: "transparent", ink: INK, onBack }),
      h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK, paddingBottom: 24 } },
        h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.7, margin: "2px 0 14px" } }, "每局从你的收藏里随机抽 12 张。对面用 TA 自己的卡，加上跟 TA 有关系的人的卡；不够的用普通邮票补。不花调用。"),
        saved ? h("div", { "data-wk": "duelresume", style: { marginBottom: 16, padding: "10px 12px", borderRadius: 4, border: "1px dashed " + RED, background: "rgba(178,58,46,.05)" } },
          h("div", { style: { fontSize: fz(13), marginBottom: 8 } }, "上次那一把还没打完：对 " + (nameOf(saved.foeId) || "TA") + "，第 " + saved.st.turn + " 回合，信封 " + Math.max(0, saved.st.me.hp) + " : " + Math.max(0, saved.st.foe.hp)),
          h("div", { className: "flex", style: { gap: 8 } },
            h("button", { onClick: resume, className: "flex-1", style: btn(RED, "#fff") }, "接着打"),
            h("button", { onClick: () => { if (typeof requestAppConfirm === "function") requestAppConfirm("放弃这一把？", "放弃了就接不回来了。", drop, "放弃"); else drop(); }, className: "flex-1", style: btn("transparent", INK, INK) }, "放弃"))) : null,
        h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "跟谁打"),
        h("div", { className: "flex flex-wrap", style: { gap: 8, marginBottom: 18 } }, (characters || []).map(c => {
          const n = (cards || []).filter(x => x.charId === c.id).length, on = foeId === c.id;
          return h("button", { key: c.id, "data-wk": "duelfoe", "data-on": on ? "1" : "0", onClick: () => setFoeId(c.id), className: "active:opacity-70",
            style: { padding: "6px 12px 6px 6px", borderRadius: 999, display: "flex", alignItems: "center", gap: 6, border: "1px solid " + (on ? RED : "rgba(47,42,34,.25)"), background: on ? "rgba(178,58,46,.07)" : "rgba(255,255,255,.4)", color: on ? RED : INK, fontSize: fz(12.5) } },
            h("span", { style: { width: 22, height: 22, borderRadius: 999, background: c.avatarImage || c.avatar ? "#ccc center/cover url(" + (typeof resolveImg === "function" ? resolveImg(c.avatarImage || c.avatar) : (c.avatarImage || c.avatar)) + ")" : "#d8ccb4" } }),
            (c.remark || c.name) + (n ? " · " + n : ""));
        })),
        h("div", { style: { fontFamily: FD, fontSize: fz(14), marginBottom: 8 } }, "看不看得见 TA 的下一步"),
        h("div", { className: "flex", style: { gap: 8, marginBottom: 6 } }, [[false, "明牌"], [true, "盲打"]].map(([v, zh]) => h("button", { key: zh, "data-wk": "duelblind", "data-on": blind === v ? "1" : "0", onClick: () => setBlind(v),
          style: Object.assign(btn(blind === v ? INK : "transparent", blind === v ? PAPER : INK, INK), { flex: 1 }) }, zh))),
        h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 20 } }, blind ? "TA 照样提前想好下一步，只是不给你看。" : "每回合开头就亮出 TA 要贴哪几张、贴在哪、要盖什么章。"),
        h("button", { "data-wk": "duelstart", onClick: start, disabled: !foeId, className: "w-full active:opacity-80 disabled:opacity-40", style: Object.assign(btn(RED, "#fff"), { padding: "12px 0", fontFamily: FD, fontSize: fz(15), letterSpacing: ".2em" }) }, "开局"),
        h("div", { "data-wk": "duelrules", style: { marginTop: 20, padding: "10px 12px", borderRadius: 4, background: "rgba(255,255,255,.45)", fontSize: fz(11.5), color: SUB, lineHeight: 1.8 } },
          "每回合 3 点胶水、抽 4 张。点手里一张、再点自己信封的空格贴上去，花面值那么多胶水。贴上的票每回合自己动；票底下的小点攒满变金色，点它再点「盖章」放技能（1 胶水）。放错了点「撤回」，胶水退回来。",
          h("br"), "第一排是前排，挨打；前面有人挡着，后排就挨不到。同一个人两张挨着会加力，三张一整行／列、或四张凑成 2×2 会觉醒一次。",
          h("br"), Object.keys(ROLE_TIP).map(k => k + "：" + ROLE_TIP[k]).join("；") + "。"))]);

    const me = st.me, them = st.foe, it = st.intent || {}, over = st.over;
    const meSlot = i => {
      if (over) return;
      if (handSel >= 0) { if (fail(D().place(st, "me", handSel, i))) { setHandSel(-1); redraw(); } return; }
      if (boardSel >= 0 && boardSel !== i && !me.board[i]) { if (fail(D().move(st, "me", boardSel, i))) { setBoardSel(-1); redraw(); } return; }
      setBoardSel(me.board[i] ? (boardSel === i ? -1 : i) : -1);
    };
    const selU = boardSel >= 0 ? me.board[boardSel] : null;
    // 寄出：先结算完，再把这一回合的记录一条条放出来
    const send = () => {
      if (playing.current) return;
      const n0 = st.log.length; D().endTurn(st); setHandSel(-1); setBoardSel(-1); redraw();
      const evs = st.log.slice(n0).filter(l => ["hit", "hitEnv", "fall", "heal", "gain", "ink", "wake", "stamp", "place", "skip", "event"].includes(l.kind));
      const run = ++playing.current; let k = 0;
      const step = () => {
        if (playing.current !== run) return;
        if (k >= evs.length) { setFx(null); setBanner(null); playing.current = 0; redraw(); return; }
        const l = evs[k++], side = l.kind === "hitEnv" ? (l.who === "me" ? "foe" : "me") : fxSide(l);
        const txt = l.kind === "hit" ? "-" + l.n : l.kind === "heal" ? "+" : l.kind === "gain" ? "+胶" : l.kind === "skip" ? "退回" : "";
        setFx({ kind: l.kind, side, slot: l.slot, slots: l.slots, n: l.n, ink: l.ink, txt });
        if (l.kind === "wake" || (l.kind === "stamp" && l.line) || l.kind === "event") setBanner({ text: l.text, line: l.line || "", who: l.who });
        else setBanner(null);
        setTimeout(step, l.kind === "wake" || l.kind === "event" || (l.kind === "stamp" && l.line) ? 1300 : l.kind === "place" ? 380 : 520);
      };
      step();
    };
    const back1 = () => { if (fail(D().undo(st))) { setHandSel(-1); setBoardSel(-1); redraw(); } };
    const finish = remember => {
      const sr = series && st.over ? D().addGame(series, st) : series;
      if (remember && onRemember && sr && sr.games.length) onRemember(foeId, D().memoryLine(sr, foeName, meName));
      setAsking(false); setSeries(null); setSt(null); persist(null);
    };
    const again = () => { D().addGame(series, st); start(); };
    const log = st.log.slice(-4);
    const ev = st.events[st.turn];
    const intentText = [].concat((it.stamp || []).map(x => "给「" + x.name + "」盖章"), (it.place || []).map(x => "贴「" + x.name + "」" + x.role)).join("、") || "这回合不贴票";

    return shell([
      h(Head, { key: "hd", zh: "第 " + st.turn + " 回合", sub: "对 " + foeName + (st.blind ? " · 盲打" : ""), bg: "transparent", ink: INK,
        onBack: () => { if (!over) { persist(st, series); setSaved({ st, series, foeId, at: Date.now() }); } else persist(null); setSt(null); setSeries(null); } }),
      h("div", { key: "bd", className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 14 } },
        Seal(foeName, them.hp, D().ENVELOPE_HP, RED, series && series.games.length ? "第 " + (series.games.length + 1) + " 把" : ""),
        // 对面的下一步：像一张电报条（盲打时不给看）
        h("div", { "data-wk": "duelintent", style: { position: "relative", margin: "6px 0 10px", padding: "7px 10px 7px 46px", borderRadius: 3, border: "1px dashed rgba(47,42,34,.35)", background: "rgba(255,255,255,.5)", fontSize: fz(11.5), lineHeight: 1.6 } },
          h("span", { style: { position: "absolute", left: 7, top: 7, padding: "1px 4px", border: "1.5px solid " + RED, color: RED, borderRadius: 3, fontFamily: FD, fontSize: fz(10), transform: "rotate(-6deg)" } }, "下一步"),
          st.blind ? "盲打：TA 的下一步看不见。" : intentText + (it.toEnvelope ? "；空着的列会打你信封约 " + it.toEnvelope : "") + ((it.inks || []).length ? "；会盖：" + it.inks.join("、") : ""),
          it.nextEvent ? h("div", { style: { color: GREEN } }, "下回合公告：" + it.nextEvent + "——" + D().EVENTS[it.nextEvent]) : null,
          // 明牌：TA 手里那几张也摊开给她看，要贴的那几张标上「要贴」
          !st.blind && them.hand.length ? h("div", { "data-wk": "duelfoehand", className: "flex", style: { gap: 6, marginTop: 6, overflowX: "auto", paddingTop: 6 } }, them.hand.map((s2, k) => {
            const go = (it.place || []).some(p => p.cardId === s2.cardId);
            return h("div", { key: s2.cardId + "_" + k, style: { flex: "0 0 52px", position: "relative", opacity: go ? 1 : 0.6 } },
              h(Ticket, { u: s2, card: cardOf(s2.cardId), owner: ownerOf(s2.charId), useThumb, small: true, foe: true, wk: "duelfoecard", onTap: () => toast && toast(s2.name + " · " + (ownerOf(s2.charId) || "通用票") + " · " + s2.role + "：" + ROLE_TIP[s2.role]) }),
              go ? h("span", { style: { position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", padding: "0 4px", borderRadius: 3, background: RED, color: "#fff", fontSize: fz(8), whiteSpace: "nowrap" } }, "要贴") : null); })) : null),
        h(Envelope, { sd: them, foe: true, sel: -1, onTap: () => {}, cardOf, ownerOf, useThumb, fx }),
        h("div", { className: "flex items-center", style: { gap: 8, margin: "10px 0", color: SUB, fontSize: fz(10.5) } }, h("div", { className: "flex-1", style: { borderTop: "1px dashed rgba(47,42,34,.3)" } }), ev ? h("span", { style: { color: GREEN } }, "公告 · " + ev + "：" + D().EVENTS[ev]) : "前排对前排", h("div", { className: "flex-1", style: { borderTop: "1px dashed rgba(47,42,34,.3)" } })),
        h(Envelope, { sd: me, foe: false, sel: boardSel, onTap: meSlot, armed: handSel >= 0, cardOf, ownerOf, useThumb, fx }),
        Seal(meName || "我", me.hp, D().ENVELOPE_HP, GREEN),
        // 选中场上一张：盖章 / 撕下；点旁边空格＝挪过去
        selU ? h("div", { "data-wk": "duelactions", style: { marginTop: 8, padding: "8px 10px", borderRadius: 4, background: "rgba(255,255,255,.55)", fontSize: fz(12) } },
          h("div", { style: { marginBottom: 6 } }, h("b", null, selU.name), h("span", { style: { color: SUB } }, " · " + (ownerOf(selU.charId) || "通用票") + " · " + selU.role + "：" + ROLE_TIP[selU.role])),
          h("div", { className: "flex items-center flex-wrap", style: { gap: 6 } },
            h("button", { onClick: () => { if (fail(D().stamp(st, "me", boardSel))) { setBoardSel(-1); redraw(); } }, disabled: selU.charge < selU.need, className: "disabled:opacity-40", style: btn(RED, "#fff") }, "盖章（1 胶水）"),
            h("button", { onClick: () => { if (fail(D().tear(st, "me", boardSel))) { setBoardSel(-1); redraw(); } }, style: btn("transparent", INK, INK) }, "撕下"),
            h("span", { style: { color: SUB, fontSize: fz(11) } }, "点旁边空格＝挪过去（1 胶水）"))) : null,
        h("div", { "data-wk": "duellog", style: { marginTop: 10, fontSize: fz(11), color: SUB, lineHeight: 1.65 } }, log.map((l, k) => h("div", { key: k }, (l.who === "foe" ? foeName + "：" : l.who === "me" ? "我：" : "") + l.text + (l.line ? "「" + l.line + "」" : ""))))),
      banner ? h("div", { key: "bn", "data-wk": "duelbanner", style: { position: "absolute", left: "50%", top: "46%", zIndex: 20, width: "82%", maxWidth: 320, padding: "12px 14px", borderRadius: 4, textAlign: "center",
        background: "rgba(251,246,234,.96)", border: "1.5px solid #c8962e", boxShadow: "0 8px 24px rgba(47,42,34,.3)", fontFamily: FD, color: INK, animation: "duelBanner 1.3s forwards", pointerEvents: "none" } },
        h("div", { style: { fontSize: fz(15), color: banner.who === "foe" ? RED : banner.who === "me" ? GREEN : "#c8962e" } }, banner.text),
        banner.line ? h("div", { style: { fontFamily: F, fontSize: fz(12), color: SUB, marginTop: 6, lineHeight: 1.6 } }, "「" + banner.line + "」") : null) : null,
      over ? h("div", { key: "ft", "data-wk": "duelover", className: "shrink-0 px-4", style: { paddingTop: 12, paddingBottom: "calc(12px + env(safe-area-inset-bottom) * 0.4)", fontFamily: F, color: INK, borderTop: "1px solid rgba(47,42,34,.18)", background: "rgba(251,246,234,.92)" } },
          h("div", { style: { fontFamily: FD, fontSize: fz(18), textAlign: "center", marginBottom: 2, color: over.winner === "me" ? GREEN : over.winner === "foe" ? RED : INK } }, over.winner === "me" ? "你赢了" : over.winner === "foe" ? foeName + " 赢了" : "打平了"),
          h("div", { style: { fontSize: fz(11), textAlign: "center", color: SUB, marginBottom: 10 } }, over.turn + " 回合 · 信封剩 " + over.me + " : " + over.foe + (over.byCap ? " · 打满回合比剩下的" : "")),
          asking ? h("div", null,
            h("div", { style: { fontSize: fz(12.5), textAlign: "center", marginBottom: 8 } }, "要让 " + foeName + " 记得这 " + ((series ? series.games.length : 0) + 1) + " 把吗？"),
            h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelremember", onClick: () => finish(true), className: "flex-1", style: btn(INK, PAPER) }, "记得"),
              h("button", { onClick: () => finish(false), className: "flex-1", style: btn("transparent", INK, INK) }, "不用记")))
            : h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelagain", onClick: again, className: "flex-1", style: btn(INK, PAPER) }, "再来一把"),
              h("button", { onClick: () => setAsking(true), className: "flex-1", style: btn("transparent", INK, INK) }, "结束")))
        : h("div", { key: "ft", "data-wk": "duelhand", className: "shrink-0", style: { paddingTop: 8, paddingBottom: "calc(8px + env(safe-area-inset-bottom) * 0.4)", borderTop: "1px solid rgba(47,42,34,.18)", background: "rgba(251,246,234,.92)", fontFamily: F, color: INK } },
          h("div", { className: "flex items-center px-3", style: { gap: 8, marginBottom: 6, fontSize: fz(12) } },
            h("span", { "data-wk": "duelglue", className: "flex items-center", style: { gap: 3 } }, "胶水", Array.from({ length: Math.max(me.postage, 0) }, (_, k) => h("i", { key: k, style: { width: 8, height: 10, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: "#d9a441" } })), me.postage ? null : h("span", { style: { color: SUB } }, " 0")),
            h("span", { className: "flex-1" }),
            handSel >= 0 ? h("button", { onClick: () => { fail(D().keep(st, "me", handSel)); redraw(); }, style: btn("transparent", INK, "rgba(47,42,34,.5)") }, me.kept.includes(handSel) ? "不留了" : "留到下回合") : null,
            h("button", { "data-wk": "duelundo", onClick: back1, disabled: !D().canUndo(st), className: "disabled:opacity-30", style: btn("transparent", INK, INK) }, "撤回"),
            h("button", { "data-wk": "duelsend", onClick: send, disabled: !!fx, className: "disabled:opacity-50", style: Object.assign(btn(RED, "#fff"), { fontFamily: FD, letterSpacing: ".15em" }) }, "寄出")),
          h("div", { className: "flex overflow-x-auto px-3", style: { gap: 8, paddingTop: 6, paddingBottom: 2 } }, me.hand.map((s, k) => h("div", { key: s.cardId + "_" + k, style: { flex: "0 0 74px", opacity: me.postage < s.face ? 0.55 : 1, position: "relative" } },
            h(Ticket, { u: s, card: cardOf(s.cardId), owner: ownerOf(s.charId), useThumb, small: true, sel: handSel === k, wk: "duelcard", onTap: () => { setBoardSel(-1); setHandSel(handSel === k ? -1 : k); } }),
            me.kept.includes(k) ? h("span", { style: { position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", padding: "0 5px", borderRadius: 3, background: GREEN, color: "#fff", fontSize: fz(8.5) } }, "留") : null))))]);
  }
  window.StampDuelPage = StampDuelPage;
})();
