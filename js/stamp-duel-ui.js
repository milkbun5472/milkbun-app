// 邮票对局的界面（她 2026-11-07「开工」：先做一个能玩的简单界面试手感，好看的皮后面再做）。
//   规则全在 js/stamp-duel.js；这里只摆出来、接她的手指。从邮票册右上「对局」进来。
//   打完一把选「再来一把」还是「结束」；结束时才问要不要让 TA 记得（几把合成一句）。
(function () {
  "use strict";
  const { useState, useRef } = React;
  const h = React.createElement;
  const D = () => window.StampDuel;
  const INK = "#2f2a22", SUB = "rgba(47,42,34,.62)", RED = "#b23a2e", GREEN = "#577767";
  const RC = { R: "#3d3a36", SR: "#3f6fb0", SSR: "#c8962e" };
  const ROLE_TIP = { 投递: "打同一列对面最前面那张，空着就打信封", 火漆: "厚，每回合给自己封一层", 补票: "给最残的那张回血、擦掉雨渍和退回", 集邮: "攒胶水、多抽牌", 邮戳: "给对面同一列盖戳" };
  const fz = n => "calc(" + n + "px * var(--app-fs, 1))";
  const F = typeof F_BODY !== "undefined" ? F_BODY : "inherit";

  function Cell({ u, terrain, idx, sel, onTap, foe }) {
    const tLabel = terrain ? h("div", { style: { position: "absolute", left: 3, bottom: 2, fontSize: fz(8.5), color: terrain === "破损" ? RED : GREEN } }, terrain) : null;
    if (!u) return h("button", { "data-wk": "duelcell", "data-empty": "1", onClick: () => onTap(idx), className: "active:opacity-70",
      style: { position: "relative", aspectRatio: "1 / 1", borderRadius: 6, border: "1px dashed " + (sel ? RED : "rgba(47,42,34,.28)"), background: terrain === "破损" ? "repeating-linear-gradient(45deg, rgba(178,58,46,.08) 0 6px, transparent 6px 12px)" : "rgba(255,255,255,.35)" } }, tLabel);
    const marks = Object.keys(u.marks || {});
    return h("button", { "data-wk": "duelcell", "data-rarity": u.rarity, "data-foe": foe ? "1" : "0", onClick: () => onTap(idx), className: "active:opacity-80 text-left",
      style: { position: "relative", aspectRatio: "1 / 1", borderRadius: 6, padding: "4px 5px", overflow: "hidden", background: "#fffaf0",
        border: "2px solid " + (sel ? RED : RC[u.rarity]), boxShadow: "0 1px 3px rgba(47,42,34,.18)", fontFamily: F, color: INK } },
      h("div", { style: { fontSize: fz(9), color: RC[u.rarity], fontWeight: 700 } }, u.role + (u.charge >= u.need ? " · 可盖章" : "")),
      h("div", { style: { fontSize: fz(10.5), lineHeight: 1.2, maxHeight: "2.4em", overflow: "hidden" } }, u.name),
      h("div", { style: { position: "absolute", left: 5, right: 5, bottom: 13, fontSize: fz(9.5), display: "flex", justifyContent: "space-between" } },
        h("span", null, "⚔" + u.pow), h("span", null, "♥" + Math.max(0, u.hp) + (u.shield ? "+" + u.shield : ""))),
      h("div", { style: { position: "absolute", left: 5, right: 5, bottom: 8, height: 3, borderRadius: 2, background: "rgba(47,42,34,.12)" } },
        h("div", { style: { width: Math.min(100, 100 * u.charge / u.need) + "%", height: "100%", borderRadius: 2, background: u.charge >= u.need ? RED : GREEN } })),
      marks.length ? h("div", { style: { position: "absolute", right: 3, top: 3, fontSize: fz(8.5), color: RED } }, marks.join(" ")) : null,
      tLabel);
  }
  // 对面的信封倒过来摆：他们的前排挨着中线，跟她的前排面对面
  function Board({ sd, foe, sel, onTap }) {
    const order = foe ? [6, 7, 8, 3, 4, 5, 0, 1, 2] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
    return h("div", { "data-wk": "duelboard", "data-foe": foe ? "1" : "0", style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, maxWidth: 270, margin: "0 auto" } },
      order.map(i => h(Cell, { key: i, idx: i, u: sd.board[i], terrain: sd.terrain[i], sel: sel === i, onTap, foe })));
  }
  const bar = (label, hp, max, color) => h("div", { className: "flex items-center", style: { gap: 6, fontFamily: F, fontSize: fz(11.5), color: INK } },
    h("span", { style: { minWidth: 34 } }, label),
    h("div", { className: "flex-1", style: { height: 6, borderRadius: 3, background: "rgba(47,42,34,.12)" } }, h("div", { style: { width: Math.max(0, 100 * hp / max) + "%", height: "100%", borderRadius: 3, background: color } })),
    h("span", null, Math.max(0, hp) + "/" + max));

  function StampDuelPage({ characters, cards, onBack, onRemember, closeOf, meName, toast }) {
    const [foeId, setFoeId] = useState(() => { const has = (characters || []).find(c => (cards || []).some(x => x.charId === c.id)); return (has || (characters || [])[0] || {}).id; });
    const [blind, setBlind] = useState(false);
    const [st, setSt] = useState(null);
    const [, bump] = useState(0);
    const [handSel, setHandSel] = useState(-1), [boardSel, setBoardSel] = useState(-1);
    const [series, setSeries] = useState(null), [asking, setAsking] = useState(false);
    const seedRef = useRef(Date.now() >>> 0);
    const foe = (characters || []).find(c => c.id === foeId);
    const foeName = foe ? (foe.remark || foe.name) : "TA";
    const redraw = () => bump(x => x + 1);
    const start = () => {
      const s = (seedRef.current = (seedRef.current * 1103515245 + 12345) >>> 0);
      const me = D().deckFrom(cards, s), them = D().foeDeckFrom(cards, foeId, closeOf ? closeOf(foeId) : [], s);
      setSt(D().newDuel(me, them, s, { blind })); setHandSel(-1); setBoardSel(-1);
      setSeries(sr => sr || D().newSeries());
    };
    const fail = r => { if (r && !r.ok && r.why) toast && toast(r.why); return r && r.ok; };

    // ── 开局前：挑对手、明牌还是盲打 ──
    if (!st) return h("div", { "data-wk": "duelpage", className: "h-full flex flex-col", style: { background: "linear-gradient(#f1e9d8, #e9dfca)" } },
      h(Head, { zh: "对局", bg: "transparent", ink: INK, onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { fontFamily: F, color: INK } },
        h("div", { style: { fontSize: fz(12), color: SUB, lineHeight: 1.7, margin: "4px 0 12px" } }, "每局从你的收藏里随机抽 12 张。对面用 TA 自己的卡，加上跟 TA 走得近的人的卡；不够的用普通邮票补。不花调用。"),
        h("div", { style: { fontSize: fz(13), marginBottom: 6 } }, "跟谁打"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginBottom: 14 } }, (characters || []).map(c => {
          const n = (cards || []).filter(x => x.charId === c.id).length;
          return h("button", { key: c.id, "data-wk": "duelfoe", onClick: () => setFoeId(c.id), className: "active:opacity-70",
            style: { padding: "5px 10px", borderRadius: 4, border: "1px solid " + (foeId === c.id ? RED : "rgba(47,42,34,.3)"), color: foeId === c.id ? RED : INK, background: foeId === c.id ? "rgba(178,58,46,.06)" : "transparent", fontSize: fz(12.5) } }, (c.remark || c.name) + (n ? " · " + n + " 张" : ""));
        })),
        h("div", { style: { fontSize: fz(13), marginBottom: 6 } }, "看不看得见 TA 的下一步"),
        h("div", { className: "flex", style: { gap: 6, marginBottom: 6 } }, [[false, "明牌"], [true, "盲打"]].map(([v, zh]) => h("button", { key: zh, "data-wk": "duelblind", onClick: () => setBlind(v),
          style: { padding: "5px 12px", borderRadius: 4, border: "1px solid " + (blind === v ? RED : "rgba(47,42,34,.3)"), color: blind === v ? RED : INK, fontSize: fz(12.5) } }, zh))),
        h("div", { style: { fontSize: fz(11.5), color: SUB, marginBottom: 18 } }, blind ? "TA 照样提前想好下一步，只是不给你看。" : "每回合开头就亮出 TA 要贴哪几张、贴在哪、要盖什么章。"),
        h("button", { "data-wk": "duelstart", onClick: start, disabled: !foeId, className: "w-full active:opacity-80 disabled:opacity-40", style: { padding: "11px 0", borderRadius: 6, background: INK, color: "#f1e9d8", fontSize: fz(14) } }, "开局"),
        h("div", { style: { fontSize: fz(11.5), color: SUB, lineHeight: 1.8, marginTop: 18 } },
          "怎么玩：每回合 3 点胶水、抽 4 张。点手里一张，再点自己信封的空格贴上去（花面值的胶水）。贴上的票每回合自己行动；底下那条攒满了点它再点「盖章」放技能（1 胶水）。",
          h("br"), "第一排是前排，挨打；前面有人挡着，后排就挨不到。同一个人两张挨着会加力，三张一整行／列、或四张凑成 2×2 会觉醒一次。",
          h("br"), "五种票：", Object.keys(ROLE_TIP).map(k => k + "（" + ROLE_TIP[k] + "）").join("；") + "。")));

    const me = st.me, them = st.foe, it = st.intent || {}, over = st.over;
    const meSlot = i => {
      if (over) return;
      if (handSel >= 0) { if (fail(D().place(st, "me", handSel, i))) { setHandSel(-1); redraw(); } return; }
      if (boardSel >= 0 && boardSel !== i && !me.board[i]) { if (fail(D().move(st, "me", boardSel, i))) { setBoardSel(-1); redraw(); } return; }
      setBoardSel(me.board[i] ? (boardSel === i ? -1 : i) : -1);
    };
    const selU = boardSel >= 0 ? me.board[boardSel] : null;
    const send = () => { D().endTurn(st); setHandSel(-1); setBoardSel(-1); redraw(); };
    const finish = remember => {
      const sr = series && st.over ? D().addGame(series, st) : series;
      if (remember && onRemember && sr && sr.games.length) onRemember(foeId, D().memoryLine(sr, foeName, meName));
      setAsking(false); setSeries(null); setSt(null);
    };
    const again = () => { D().addGame(series, st); start(); };
    const log = st.log.slice(-4);

    return h("div", { "data-wk": "duelpage", className: "h-full flex flex-col", style: { background: "linear-gradient(#f1e9d8, #e9dfca)" } },
      h(Head, { zh: "对局 · 第 " + st.turn + " 回合", sub: "对 " + foeName + (st.blind ? " · 盲打" : ""), bg: "transparent", ink: INK, onBack: () => { const quit = () => { setSt(null); setSeries(null); }; if (over) quit(); else if (typeof requestAppConfirm === "function") requestAppConfirm("退出这一把？", "还没打完，退出就不算了。", quit, "退出"); else quit(); } }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4", style: { fontFamily: F, color: INK, paddingBottom: 12 } },
        bar(foeName, them.hp, D().ENVELOPE_HP, RED),
        // 对面的下一步（盲打时不给看）
        h("div", { "data-wk": "duelintent", style: { margin: "6px 0", padding: "6px 9px", borderRadius: 6, background: "rgba(47,42,34,.06)", fontSize: fz(11.5), lineHeight: 1.6 } },
          st.blind ? "盲打：TA 的下一步看不见。" : "TA 下一步：" + ([].concat((it.stamp || []).map(x => "给「" + x.name + "」盖章"), (it.place || []).map(x => "贴「" + x.name + "」（" + x.role + "）"))).join("、") + ((it.place || []).length || (it.stamp || []).length ? "" : "什么都不贴") + (it.toEnvelope ? "；空着的列会打你信封约 " + it.toEnvelope : "") + ((it.inks || []).length ? "；会盖：" + it.inks.join("、") : ""),
          it.nextEvent ? h("div", { style: { color: GREEN } }, "下回合邮局公告：" + it.nextEvent + "——" + D().EVENTS[it.nextEvent]) : null),
        h(Board, { sd: them, foe: true, sel: -1, onTap: () => {} }),
        h("div", { style: { height: 1, background: "rgba(47,42,34,.25)", margin: "8px 0" } }),
        h(Board, { sd: me, foe: false, sel: boardSel, onTap: meSlot }),
        h("div", { style: { marginTop: 6 } }, bar("我", me.hp, D().ENVELOPE_HP, GREEN)),
        // 选中场上一张：盖章 / 撕下；点旁边空格＝挪过去
        selU ? h("div", { "data-wk": "duelactions", className: "flex items-center flex-wrap", style: { gap: 6, marginTop: 8, fontSize: fz(12) } },
          h("span", { style: { color: SUB } }, selU.name + "：" + ROLE_TIP[selU.role]),
          h("button", { onClick: () => { if (fail(D().stamp(st, "me", boardSel))) { setBoardSel(-1); redraw(); } }, disabled: selU.charge < selU.need, className: "disabled:opacity-40", style: { padding: "3px 10px", borderRadius: 4, border: "1px solid " + RED, color: RED } }, "盖章"),
          h("button", { onClick: () => { if (fail(D().tear(st, "me", boardSel))) { setBoardSel(-1); redraw(); } }, style: { padding: "3px 10px", borderRadius: 4, border: "1px dashed " + INK } }, "撕下"),
          h("span", { style: { color: SUB, fontSize: fz(11) } }, "点旁边的空格＝挪过去（1 胶水）")) : null,
        h("div", { "data-wk": "duellog", style: { marginTop: 8, fontSize: fz(11), color: SUB, lineHeight: 1.6 } }, log.map((l, k) => h("div", { key: k }, (l.who === "foe" ? foeName + "：" : l.who === "me" ? "我：" : "") + l.text + (l.line ? "「" + l.line + "」" : ""))))),
      // 手牌和寄出
      over ? h("div", { "data-wk": "duelover", className: "shrink-0 px-4", style: { paddingTop: 10, paddingBottom: "calc(10px + env(safe-area-inset-bottom) * 0.4)", fontFamily: F, color: INK, borderTop: "1px solid rgba(47,42,34,.18)" } },
          h("div", { style: { fontSize: fz(15), textAlign: "center", marginBottom: 8 } }, over.winner === "me" ? "你赢了" : over.winner === "foe" ? foeName + " 赢了" : "打平了", over.byCap ? "（打满 " + D().TURN_CAP + " 回合，比剩下的信封）" : ""),
          asking ? h("div", null,
            h("div", { style: { fontSize: fz(12.5), textAlign: "center", marginBottom: 8 } }, "要让 " + foeName + " 记得这" + ((series ? series.games.length : 0) + 1) + "把吗？"),
            h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelremember", onClick: () => finish(true), className: "flex-1", style: { padding: "9px 0", borderRadius: 6, background: INK, color: "#f1e9d8" } }, "记得"),
              h("button", { onClick: () => finish(false), className: "flex-1", style: { padding: "9px 0", borderRadius: 6, border: "1px solid " + INK } }, "不用记")))
            : h("div", { className: "flex", style: { gap: 8 } },
              h("button", { "data-wk": "duelagain", onClick: again, className: "flex-1", style: { padding: "9px 0", borderRadius: 6, background: INK, color: "#f1e9d8" } }, "再来一把"),
              h("button", { onClick: () => setAsking(true), className: "flex-1", style: { padding: "9px 0", borderRadius: 6, border: "1px solid " + INK } }, "结束")))
        : h("div", { "data-wk": "duelhand", className: "shrink-0 px-3", style: { paddingTop: 8, paddingBottom: "calc(8px + env(safe-area-inset-bottom) * 0.4)", borderTop: "1px solid rgba(47,42,34,.18)", fontFamily: F, color: INK } },
          h("div", { className: "flex items-center", style: { gap: 8, marginBottom: 6, fontSize: fz(12) } },
            h("span", null, "胶水 " + me.postage),
            st.events[st.turn] ? h("span", { style: { color: GREEN } }, "公告：" + st.events[st.turn]) : null,
            h("span", { className: "flex-1" }),
            handSel >= 0 ? h("button", { onClick: () => { fail(D().keep(st, "me", handSel)); redraw(); }, style: { padding: "3px 8px", borderRadius: 4, border: "1px dashed " + INK } }, me.kept.includes(handSel) ? "不留了" : "留到下回合") : null,
            h("button", { "data-wk": "duelsend", onClick: send, style: { padding: "5px 14px", borderRadius: 4, background: RED, color: "#fff" } }, "寄出")),
          h("div", { className: "flex overflow-x-auto", style: { gap: 6 } }, me.hand.map((s, k) => h("button", { key: k, "data-wk": "duelcard", onClick: () => { setBoardSel(-1); setHandSel(handSel === k ? -1 : k); },
            style: { flex: "0 0 88px", padding: "5px 6px", borderRadius: 6, textAlign: "left", background: "#fffaf0", border: "2px solid " + (handSel === k ? RED : RC[s.rarity]), opacity: me.postage < s.face ? 0.5 : 1 } },
            h("div", { style: { fontSize: fz(9), color: RC[s.rarity], fontWeight: 700 } }, s.rarity + " · " + s.role + " · 面值 " + s.face + (me.kept.includes(k) ? " · 留" : "")),
            h("div", { style: { fontSize: fz(11), lineHeight: 1.25, height: "2.5em", overflow: "hidden" } }, s.name),
            h("div", { style: { fontSize: fz(9.5) } }, "⚔" + s.pow + " ♥" + s.maxHp))))));
  }
  window.StampDuelPage = StampDuelPage;
})();
