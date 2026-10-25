// 邮票册（2026-10-26 方案）——界面。抽、存在 js/stamps-core.js；写卡、画卡面由 app.js 递进来（onWrite / onDraw）。
//   第一批：两种池（大混池＝日常卡、角色池＝IF 卡）、万圣夜限时池、抽卡动画、图鉴、卡面、剧情（只开 1 级那一节）。
//   升级、发给他、当真、时刻、生日池在第二、三批。
(function () {
  "use strict";
  const { useState, useEffect, useRef } = React;
  const C = () => window.StampsCore;
  const RC = { R: "#3d3a36", SR: "#3f6fb0", SSR: "#c8962e" };          // 邮戳颜色：黑、蓝、金
  const RZH = { R: "R", SR: "SR", SSR: "SSR" };
  const POOL_ZH = { mix: "大混池", char: "角色池", limited: "限时" };
  const uid = () => "st_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  const leftText = ms => { const d = Math.floor(ms / 86400000), hh = Math.floor(ms % 86400000 / 3600000); return d > 0 ? d + " 天 " + hh + " 小时" : hh + " 小时 " + Math.floor(ms % 3600000 / 60000) + " 分"; };

  // 一枚邮票的外形：齿孔边＋里面一块
  function Stamp({ t, card, face, onClick, back, size }) {
    const w = size || 96, hgt = Math.round(w * 1.32), col = RC[card ? card.rarity : "R"];
    const perf = "radial-gradient(circle at 4px 4px, transparent 3.2px, " + "#fbf6ea" + " 3.4px) -4px -4px / 8px 8px";
    return h("button", { "data-wk": "stampitem", "data-rarity": card ? card.rarity : "", "data-back": back ? "1" : "0", onClick, className: "active:opacity-80",
      style: { width: w, height: hgt, padding: 5, background: perf, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.18))", flexShrink: 0, border: "none" } },
      h("div", { style: { width: "100%", height: "100%", position: "relative", overflow: "hidden", borderRadius: 2,
        background: back ? "repeating-linear-gradient(45deg," + col + "22," + col + "22 5px,transparent 5px,transparent 10px), #f3ead6" : (face ? "#222 center/cover no-repeat url(" + face + ")" : "#efe6d2"),
        border: "1px solid " + col + "66" } },
        back ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", color: col } }, card && card.rarity !== "R" ? "★" : "")
          : h(React.Fragment, null,
            !face ? h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 6, textAlign: "center",
              fontFamily: F_DISPLAY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#6a5f4e", lineHeight: 1.4 } }, card && card.text ? card.text.name : card && card.writing ? "他还在写…" : "还没写好") : null,
            h("span", { style: { position: "absolute", left: 4, top: 3, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", fontWeight: 700, color: "#fff", background: col, borderRadius: 3, padding: "0 4px" } }, RZH[card.rarity]),
            face && card.text ? h("span", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 5px 4px", background: "linear-gradient(transparent, rgba(0,0,0,.6))", color: "#fff",
              fontFamily: F_DISPLAY, fontSize: "calc(10.5px * var(--app-fs, 1))", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, card.text.name) : null)));
  }
  function StampFace({ t, card, onClick, size, back }) { const url = useIdbImgUrl(card && card.face); return h(Stamp, { t, card, face: url, onClick, size, back }); }

  // 抽卡动画：信封落下 → 邮戳颜色预告 → 撕开一版
  function PullShow({ t, cards, onDone, onOpen, charOf }) {
    const nameOf = c => { const ch = charOf && charOf(c.charId); return ch ? (ch.name || "") : ""; };
    const senders = []; cards.forEach(c => { const n = nameOf(c); if (n && senders.indexOf(n) < 0) senders.push(n); });
    const fromLine = senders.length ? "来自 " + senders.slice(0, 2).join("、") + (senders.length > 2 ? " 等 " + senders.length + " 人" : "") : "";
    const best = cards.some(c => c.rarity === "SSR") ? "SSR" : cards.some(c => c.rarity === "SR") ? "SR" : "R";
    const [stage, setStage] = useState("drop");   // drop → mail → sheet
    const [torn, setTorn] = useState({});
    useEffect(() => { const a = setTimeout(() => setStage("mail"), 900); return () => clearTimeout(a); }, []);
    const all = () => { const n = {}; cards.forEach(c => { n[c.id] = 1; }); setTorn(n); };
    return h("div", { "data-wk": "stamppull", "data-best": best, className: "fixed inset-0 flex flex-col items-center justify-center", style: { zIndex: 260, background: "rgba(20,16,12,.86)", padding: "calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) * 0.4 + 16px)" } },
      h("style", null, "@keyframes stDrop{0%{transform:translateY(-120vh) rotate(-8deg)}70%{transform:translateY(10px) rotate(2deg)}100%{transform:translateY(0) rotate(0)}}"
        + "@keyframes stShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}"
        + "@keyframes stGlow{0%,100%{box-shadow:0 0 18px " + RC[best] + "66}50%{box-shadow:0 0 42px " + RC[best] + "}}"
        + "@keyframes stFlip{0%{transform:rotateY(90deg)}100%{transform:rotateY(0)}}"),
      h("button", { onClick: onDone, className: "absolute active:opacity-60", style: { right: 16, top: "calc(env(safe-area-inset-top) + 12px)", color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", opacity: .8 } }, "跳过"),
      stage !== "sheet" ? h("button", { "data-wk": "stampenvelope", onClick: () => stage === "mail" && setStage("sheet"),
        style: { width: 230, height: 150, borderRadius: 6, background: "#f4ecda", position: "relative", border: "none",
          animation: stage === "drop" ? "stDrop .9s ease-out" : best === "SSR" ? "stShake .5s 2, stGlow 1.6s infinite" : best === "SR" ? "stGlow 1.6s infinite" : "none" } },
        h("div", { style: { position: "absolute", left: 0, right: 0, top: 0, height: 0, borderLeft: "115px solid transparent", borderRight: "115px solid transparent", borderTop: "70px solid #e6d9bd" } }),
        h("div", { style: { position: "absolute", right: 16, top: 14, width: 52, height: 52, borderRadius: 999, border: "3px double " + RC[best], color: RC[best],
          display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: "calc(11px * var(--app-fs, 1))", transform: "rotate(-14deg)" } }, best === "SSR" ? "急件" : best === "SR" ? "挂号" : "平信"),
        best === "SSR" ? h("div", { style: { position: "absolute", left: "50%", top: 60, width: 34, height: 34, marginLeft: -17, borderRadius: 999, background: "radial-gradient(circle at 40% 35%, #e9b35a, #9c6a1c)" } }) : null,
        fromLine ? h("div", { "data-wk": "stampenvfrom", style: { position: "absolute", left: 18, top: 82, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(13px * var(--app-fs, 1))", color: "#5a4a32" } }, fromLine) : null,
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#7a6a52" } }, stage === "mail" ? "点开信封" : "")) : null,
      stage === "sheet" ? h(React.Fragment, null,
        h("div", { className: "flex flex-wrap justify-center", style: { gap: 8, maxWidth: 420 } },
          cards.map(c => torn[c.id]
            ? h("div", { key: c.id, style: { animation: "stFlip .35s ease-out" } }, h(StampFace, { t, card: c, size: cards.length > 1 ? 64 : 150, onClick: () => onOpen(c) }))
            : h("div", { key: c.id, className: "flex flex-col items-center", style: { gap: 3 } },
                h(Stamp, { t, card: c, back: true, size: cards.length > 1 ? 64 : 150, onClick: () => setTorn(p => ({ ...p, [c.id]: 1 })) }),
                nameOf(c) ? h("div", { "data-wk": "stampsender", style: { maxWidth: cards.length > 1 ? 70 : 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "rgba(244,236,218,.75)" } }, nameOf(c) + " 来信") : null))),
        h("div", { className: "flex", style: { gap: 10, marginTop: 18 } },
          cards.length > 1 && Object.keys(torn).length < cards.length ? h("button", { onClick: all, className: "active:opacity-70", style: { padding: "10px 18px", borderRadius: 999, background: "#f4ecda", color: "#5a4a32", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "整版撕开") : null,
          h("button", { onClick: onDone, className: "active:opacity-70", style: { padding: "10px 18px", borderRadius: 999, border: "1px solid #f4ecda", color: "#f4ecda", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "收进邮票册"))) : null);
  }

  // 剧情：乙游对话框。背景是卡面，一句一句点着走；锁着的那节写着要盖到第几枚
  function StoryReader({ t, card, char, meName, lv, onClose }) {
    const secs = (card.text && card.text.sections) || [];
    const url = useIdbImgUrl(card.face);
    const [sid, setSid] = useState(secs[0] && secs[0].id);
    const [i, setI] = useState(0);
    const sec = secs.find(s => s.id === sid) || secs[0];
    if (!sec) return null;
    const beat = sec.beats[Math.min(i, sec.beats.length - 1)] || {};
    const atEnd = i >= sec.beats.length - 1;
    const locked = s => (Number(s.lv) || 1) > lv;
    const who = beat.who === "he" ? char.name : beat.who === "me" ? meName : "";
    return h("div", { "data-wk": "stampstory", className: "fixed inset-0 flex flex-col", style: { zIndex: 255, background: url ? "#111 center/cover no-repeat url(" + url + ")" : "linear-gradient(#2b2436,#14111b)" } },
      h("div", { className: "flex items-center", style: { padding: "calc(env(safe-area-inset-top) + 10px) 14px 8px", background: "linear-gradient(rgba(0,0,0,.55), transparent)" } },
        h("button", { onClick: onClose, className: "active:opacity-60", style: { color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "‹ 收起"),
        h("div", { className: "flex-1 text-center", style: { color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } }, sec.title || card.text.name)),
      h("div", { className: "flex-1", onClick: () => !atEnd && setI(i + 1) }),
      h("div", { "data-wk": "stampstorybox", onClick: () => !atEnd && setI(i + 1),
        style: { margin: "0 12px calc(env(safe-area-inset-bottom) * 0.4 + 14px)", borderRadius: 14, background: "rgba(16,14,22,.82)", border: "1px solid rgba(255,255,255,.18)", padding: "14px 16px 16px", minHeight: 150, color: "#f4efe6" } },
        who ? h("div", { "data-wk": "stampstorywho", style: { display: "inline-block", marginBottom: 6, padding: "2px 10px", borderRadius: 999, background: beat.who === "he" ? RC.SSR : "#6b6480", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))" } }, who) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.75, fontStyle: who ? "normal" : "italic", opacity: who ? 1 : .85, whiteSpace: "pre-wrap" } }, beat.text || ""),
        atEnd && (sec.choices || []).length ? h("div", { className: "flex flex-col", style: { gap: 8, marginTop: 12 } },
          sec.choices.map((c, k) => { const to = secs.find(s => s.id === c.go); const lk = to && locked(to);
            return h("button", { key: k, "data-wk": "stampstorychoice", "data-locked": lk ? "1" : "0", onClick: e => { e.stopPropagation(); if (!to || lk) return; setSid(to.id); setI(0); },
              style: { textAlign: "left", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.3)", background: lk ? "transparent" : "rgba(255,255,255,.1)", color: lk ? "rgba(255,255,255,.45)" : "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } },
              c.text, lk ? h("span", { style: { marginLeft: 6, fontSize: "calc(11px * var(--app-fs, 1))" } }, "· 升到 " + to.lv + " 级才看得到") : null); })) : null,
        atEnd && !(sec.choices || []).length ? h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", opacity: .7 } }, sec.end ? "—— 这条路走到头了 ——" : "") : null,
        !atEnd ? h("div", { style: { textAlign: "right", fontSize: "calc(11px * var(--app-fs, 1))", opacity: .5, marginTop: 6 } }, "点一下继续") : null));
  }

  // 一张卡打开：卡面、名字、内容
  // 卡页＝养成页：上面是卡（光晕、稀有度章、星、邮戳编号），中间养成面板，底下「时刻回廊」一格一格往外还原那个瞬间
  function CardPage({ t, card, char, meName, onBack, onDraw, onRewrite, onSend, onCanon, toast }) {
    const url = useIdbImgUrl(card.face);
    const [story, setStory] = useState(false);
    const [node, setNode] = useState(null);
    const [pop, setPop] = useState(0);
    const tx = card.text, lv = card.lv || 1;
    const P = "#f4ecda", P7 = "rgba(244,236,218,.72)", P5 = "rgba(244,236,218,.5)", GOLD = "#e3b65c", LINE = "rgba(227,182,92,.35)";
    const rcL = card.rarity === "R" ? P : RC[card.rarity];
    const stale = card.writing && Date.now() - Number(card.writingTs || 0) > 180000;
    const S = C().load(), U = C().UNLOCK, ink = S.ink, cap = C().CAP[card.rarity] || 30;
    const starsAll = Math.round(cap / 10), stars = Math.min(starsAll, Math.floor(lv / 10));
    const tierFrom = Math.floor(lv / 10) * 10 || 1, nextGate = Math.min(cap, (Math.floor(lv / 10) + 1) * 10);
    const pct = lv >= cap ? 100 : Math.round((lv - tierFrom) / Math.max(1, nextGate - tierFrom) * 100);
    let toGate = 0; for (let l = lv; l < nextGate; l++) toGate += C().levelCost(card.rarity, l);
    const cost1 = C().levelCost(card.rarity, lv);
    const blockNow = C().gateBlocked(card, lv);
    const up = steps => { const r = C().levelUp(card.id, steps); if (r.n) { setPop(Date.now()); toast("盖好了，到 " + r.lv + " 级"); } else if (r.msg) toast(r.msg); };
    const no = (S.cards || []).findIndex(c => c.id === card.id) + 1;
    const got = new Date(card.ts || Date.now());
    const fs = n => "calc(" + n + "px * var(--app-fs, 1))";
    const para = s => h("div", { style: { fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.85, color: P, whiteSpace: "pre-wrap" } }, s);
    const quote = s => h("div", { style: { marginTop: 8, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: fs(14.5), color: P7 } }, "「" + s + "」");
    // 回廊的格子：按时间排，从前一刻到他心里那句
    const nodes = !tx ? [] : card.rarity === "R" ? [
        { k: "before", zh: "前一刻", lv: U.R.before, body: tx.before && h("div", null, para(tx.before.narration || ""), tx.before.thought ? quote(tx.before.thought) : null), peek: tx.before && tx.before.narration },
        { k: "now", zh: "那一刻", lv: 1, body: h("div", null, para(tx.narration || ""), tx.thought ? quote(tx.thought) : null), peek: tx.narration },
        { k: "after", zh: "后一刻", lv: U.R.after, body: tx.after && h("div", null, para(tx.after.narration || ""), tx.after.thought ? quote(tx.after.thought) : null), peek: tx.after && tx.after.narration },
        { k: "real", zh: "他真正想说的", lv: U.R.real, body: tx.real && quote(tx.real), peek: tx.real }]
      : card.rarity === "SR" ? [
        { k: "open", zh: "开头", lv: 1, body: para(tx.open || ""), peek: tx.open },
        { k: "rest", zh: "接着", lv: U.SR.rest, body: tx.rest && para(tx.rest), peek: tx.rest },
        { k: "sequel", zh: "后来", lv: U.SR.sequel, body: tx.sequel && para(tx.sequel), peek: tx.sequel },
        { k: "hidden", zh: "没说出口的", lv: U.SR.hidden, body: tx.hidden && quote(tx.hidden), peek: tx.hidden }]
      : ((tx.sections || []).map((s, i) => ({ k: s.id || "s" + i, zh: s.title || "第 " + (i + 1) + " 节", lv: Number(s.lv) || 1, ssr: true,
          peek: ((s.beats || [])[0] || {}).text || "" })));
    const openNode = nodes.find(n => n.k === node) || nodes.find(n => n.lv <= lv && n.k === "now") || nodes.find(n => n.lv <= lv);
    const ring = stars >= 3 ? "0 0 0 2px " + GOLD + ", 0 0 0 6px rgba(227,182,92,.25), 0 0 34px rgba(227,182,92,.45)" : stars === 2 ? "0 0 0 2px " + GOLD + ", 0 0 0 5px rgba(227,182,92,.2)" : stars === 1 ? "0 0 0 1.5px " + GOLD : "none";
    return h("div", { "data-wk": "stampcard", "data-page": "1", className: "h-full flex flex-col", style: { background: "radial-gradient(120% 70% at 50% 0%, #2b2440, #15121f 70%)" } },
      h("style", null, "@keyframes stHalo{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.9;transform:scale(1.06)}}@keyframes stFloat{0%{transform:translateY(0)}35%{transform:translateY(-10px)}100%{transform:translateY(0)}}@keyframes stShine{0%{background-position:-200% 0}100%{background-position:200% 0}}"),
      h(Head, { zh: tx ? tx.name : "一枚邮票", sub: card.rarity + " · " + (char ? char.name : "") + (card.kind === "if" ? " · IF「" + (card.theme || "") + "」" : " · 日常"), bg: "transparent", ink: P, onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        // 卡
        h("div", { "data-wk": "stampshow", className: "flex flex-col items-center", style: { position: "relative", paddingTop: 14 } },
          h("div", { style: { position: "absolute", top: 0, left: "50%", width: 320, height: 380, marginLeft: -160, borderRadius: 999, background: "radial-gradient(closest-side, " + (card.rarity === "R" ? "rgba(244,236,218,.16)" : RC[card.rarity] + "44") + ", transparent)", animation: "stHalo 4s ease-in-out infinite", pointerEvents: "none" } }),
          h("div", { key: pop, style: { position: "relative", boxShadow: ring, animation: pop ? "stFloat .9s ease-out" : "none" } },
            h(Stamp, { t, card, face: url, size: 236 }),
            pop ? h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(110deg, transparent 35%, rgba(255,240,200,.55) 50%, transparent 65%) 0 0 / 200% 100%", animation: "stShine .9s ease-out 1 forwards" } }) : null,
            h("div", { "data-wk": "stampbadge", style: { position: "absolute", left: "50%", top: -13, transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "3px 12px", borderRadius: 999, background: card.rarity === "SSR" ? "linear-gradient(135deg,#f3d58a,#b8862e)" : card.rarity === "SR" ? "linear-gradient(135deg,#9db8ef,#4a68b8)" : "linear-gradient(135deg,#f4ecda,#bfb196)", color: card.rarity === "R" ? "#3a3020" : "#fff", fontFamily: F_DISPLAY, fontSize: fs(12), letterSpacing: ".08em", boxShadow: "0 2px 8px rgba(0,0,0,.4)" } }, card.rarity + " · " + (card.rarity === "SSR" ? "急件" : card.rarity === "SR" ? "挂号" : "平信")),
            h("div", { "data-wk": "stamppostmark", style: { position: "absolute", right: -26, bottom: -14, width: 64, height: 64, borderRadius: 999, border: "1.5px solid " + GOLD, color: GOLD, transform: "rotate(-14deg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: fs(9.5), lineHeight: 1.3, background: "rgba(21,18,31,.55)" } },
              h("div", null, got.getFullYear() + "." + (got.getMonth() + 1) + "." + got.getDate()), h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(11) } }, "第 " + String(no).padStart(3, "0") + " 枚"))),
          h("div", { "data-wk": "stampstars", style: { marginTop: 14, letterSpacing: ".35em", fontSize: fs(16), color: GOLD } }, Array.from({ length: starsAll }, (_, i) => i < stars ? "★" : "☆").join("")),
          !card.face ? h("button", { "data-wk": "stampdraw", disabled: !tx || card.drawing, onClick: () => onDraw(card.id), className: "active:opacity-70 disabled:opacity-40",
            style: { marginTop: 8, padding: "6px 14px", borderRadius: 999, border: "1px solid " + LINE, color: P7, fontFamily: F_BODY, fontSize: fs(12) } }, card.drawing ? "画着…" : "画卡面 · 花一次生图") : null),
        // 养成
        tx ? h("div", { "data-wk": "stampgrow", style: { marginTop: 16, padding: "14px 16px", borderRadius: 16, border: "1px solid " + LINE, background: "rgba(244,236,218,.05)" } },
          h("div", { className: "flex items-center justify-between" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14), color: GOLD } }, "✦ 盖印"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: P } }, lv >= cap ? "Lv." + cap + " 满了" : "Lv." + lv + "  →  Lv." + (lv + 1))),
          h("div", { className: "flex justify-between", style: { marginTop: 10, fontFamily: F_BODY, fontSize: fs(10.5), color: P5 } }, h("span", null, "Lv." + tierFrom), h("span", null, lv >= cap ? "满级" : "Lv." + nextGate + (nextGate % 10 === 0 ? " 过坎" : ""))),
          h("div", { style: { marginTop: 4, height: 6, borderRadius: 999, background: "rgba(244,236,218,.1)", overflow: "hidden" } },
            h("div", { style: { width: pct + "%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#b8862e," + GOLD + ")", transition: "width .5s" } })),
          lv < cap ? h(React.Fragment, null,
            h("div", { className: "flex justify-between", style: { marginTop: 10, fontFamily: F_BODY, fontSize: fs(12), color: P7 } }, h("span", null, "这一枚 印泥 " + cost1), h("span", null, "手上 " + ink)),
            blockNow ? h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: fs(12), color: "#9db8ef" } }, blockNow) : null,
            h("div", { "data-wk": "stamplevel", className: "flex", style: { gap: 8, marginTop: 12 } },
              h("button", { onClick: () => up(1), disabled: !!blockNow, className: "flex-1 active:opacity-70 disabled:opacity-40", style: { minHeight: 42, borderRadius: 999, background: "linear-gradient(135deg,#f3d58a,#c79a42)", color: "#2a2010", fontFamily: F_DISPLAY, fontSize: fs(14) } }, "盖一枚印"),
              nextGate - lv > 1 ? h("button", { onClick: () => up(nextGate - lv), disabled: !!blockNow, className: "active:opacity-70 disabled:opacity-40", style: { minHeight: 42, padding: "0 14px", borderRadius: 999, border: "1px solid " + GOLD, color: GOLD, fontFamily: F_BODY, fontSize: fs(12.5) } }, "盖到 " + nextGate + " 级 · " + toGate) : null)) : null,
          h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
            h("button", { "data-wk": "stampsend", onClick: () => onSend(card), className: "flex-1 active:opacity-70", style: { minHeight: 38, borderRadius: 999, border: "1px solid " + LINE, color: P, fontFamily: F_BODY, fontSize: fs(12.5) } }, card.sentTs ? "再发给他看" : "发给他看"),
            card.rarity === "SSR" && card.kind === "if" && card.sentTs && !card.canon && lv >= cap ? h("button", { "data-wk": "stampcanon", onClick: () => onCanon(card), className: "flex-1 active:opacity-70", style: { minHeight: 38, borderRadius: 999, background: RC.SSR, color: "#fff", fontFamily: F_BODY, fontSize: fs(12.5) } }, "当真") : null,
            card.canon ? h("span", { style: { alignSelf: "center", fontFamily: F_BODY, fontSize: fs(11.5), color: GOLD } }, "已当真") : null)) : null,
        // 还没写好
        !tx ? h("div", { "data-wk": "stampbox", style: { marginTop: 16, padding: "12px 14px", borderRadius: 12, border: "1px solid " + LINE } },
            h("div", { style: { fontFamily: F_BODY, fontSize: fs(12.5), color: P5 } }, card.writing && !stale ? "他还在写，等一会儿。" : (card.err || "这一张没写出来。")),
            (!card.writing || stale) ? h("button", { onClick: () => onRewrite(card), className: "active:opacity-70", style: { marginTop: 8, padding: "7px 16px", borderRadius: 999, border: "1px solid " + P, color: P, fontFamily: F_BODY, fontSize: fs(12.5) } }, "重写这一张") : null) : null,
        // 时刻回廊
        tx ? h(React.Fragment, null,
          h("div", { className: "flex items-center", style: { marginTop: 22, gap: 10 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14), color: GOLD } }, "✦ 时刻回廊"),
            h("div", { style: { flex: 1, height: 1, background: LINE } })),
          tx.line ? h("div", { style: { marginTop: 10, textAlign: "center", fontFamily: F_DISPLAY, fontSize: fs(15), color: P } }, "「" + tx.line + "」") : null,
          h("div", { "data-wk": "stampcorridor", className: "flex overflow-x-auto", style: { gap: 10, marginTop: 12, paddingBottom: 4, marginRight: -20, paddingRight: 20 } },
            nodes.map((n, i) => { const lock = n.lv > lv, on = openNode && openNode.k === n.k;
              return h("button", { key: n.k, "data-wk": "stampnode", "data-locked": lock ? "1" : "0", "data-on": on ? "1" : "0", onClick: () => lock ? toast("升到 " + n.lv + " 级才看得到") : n.ssr ? setStory(true) : setNode(n.k), className: "shrink-0 text-left active:opacity-80",
                style: { width: 128, minHeight: 116, padding: "10px 11px", borderRadius: 12, border: "1px solid " + (on ? GOLD : LINE), background: on ? "rgba(227,182,92,.1)" : lock ? "rgba(244,236,218,.03)" : "rgba(244,236,218,.06)", display: "flex", flexDirection: "column", gap: 4 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(11), color: lock ? P5 : GOLD } }, String(i + 1).padStart(2, "0") + (lock ? "  🔒" : "")),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13.5), color: lock ? P5 : P } }, n.zh),
                h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), lineHeight: 1.5, color: P5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" } }, lock ? "Lv." + n.lv + " 解锁" + (n.lv > 30 && !card.sentTs ? "，过 30 级要先发给他看" : "") : (n.peek || ""))); })),
          card.rarity === "SSR" ? h("button", { "data-wk": "stampstoryopen", onClick: () => setStory(true), className: "w-full active:opacity-70", style: { marginTop: 14, minHeight: 44, borderRadius: 12, background: RC.SSR, color: "#fff", fontFamily: F_BODY, fontSize: fs(14) } }, "进入剧情")
            : openNode && openNode.body ? h("div", { "data-wk": "stampbox", style: { marginTop: 12, padding: "14px 16px", borderRadius: 14, border: "1px solid " + LINE, background: "rgba(244,236,218,.05)" } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13), color: GOLD, marginBottom: 8 } }, openNode.zh), openNode.body) : null) : null),
      story && tx ? h(StoryReader, { t, card, char, meName, lv, onClose: () => setStory(false) }) : null);
  }

  function StampBookApp(props) {
    const t = useTheme();
    const { characters, onBack, onWrite, onDraw, toast, meName } = props;
    const [st, setSt] = useState(() => C().load());
    const [tab, setTab] = useState("pull");
    const [pool, setPool] = useState("mix");
    const [pick, setPick] = useState(() => (C().load().opt.mixPick) || null);   // 大混池勾的人
    const [charId, setCharId] = useState((characters[0] || {}).id);
    const [show, setShow] = useState(null);
    const [open, setOpen] = useState(null);
    const [albumChar, setAlbumChar] = useState("all");
    const [gotNote, setGotNote] = useState([]);
    const [cfg, setCfg] = useState(false);
    const [giftOpen, setGiftOpen] = useState(false);
    const testTap = useRef({ n: 0, t: 0 });
    useEffect(() => { const f = () => setSt(C().load()); window.addEventListener("stamps-change", f); return () => window.removeEventListener("stamps-change", f); }, []);
    useEffect(() => { const got = C().grantOnOpen(Date.now(), []); if (got.length) { setGotNote(got); setSt(C().load()); } }, []);
    const lims = C().activeLimited(Date.now());
    const lim = pool.indexOf("lim:") === 0 ? lims.find(L => "lim:" + L.id === pool) : null;
    const opt = st.opt || {};
    const setOpt = p => { const s = C().load(); s.opt = Object.assign({}, s.opt, p); C().save(s); };
    const mixIds = (pick && pick.length ? pick : characters.map(c => c.id)).filter(id => characters.some(c => c.id === id));
    // 主题两格打字时只改本地，离开输入框再存（施工规则/typing-hot-path.md：每个字不同步写大仓库）
    const [thDraft, setThDraft] = useState(null), [thLineDraft, setThLineDraft] = useState(null);
    useEffect(() => { setThDraft(null); setThLineDraft(null); }, [charId]);
    const charTheme = thDraft != null ? thDraft : ((opt.charTheme || {})[charId] || "");
    const charThemeLine = thLineDraft != null ? thLineDraft : ((opt.charThemeLine || {})[charId] || "");
    const ifMode = opt.ifMode || "random";
    // 限时池：跟角色池一样能单挑一个人抽；不挑就是勾了的人（不勾＝所有人）里随机
    const limIds = (opt.limPick && opt.limPick.length ? opt.limPick : characters.map(c => c.id)).filter(id => characters.some(c => c.id === id));
    const limOne = lim && (opt.limOne || {})[lim.id] && limIds.includes(opt.limOne[lim.id]) ? opt.limOne[lim.id] : "";

    const doPull = async (n, ticket) => {
      const s = C().load();
      if (pool === "char" && !charTheme.trim()) { toast("先给 TA 写一个主题"); return; }
      if (pool === "char" && (thDraft != null || thLineDraft != null)) s.opt = Object.assign({}, s.opt, { charTheme: Object.assign({}, s.opt.charTheme, { [charId]: charTheme }), charThemeLine: Object.assign({}, s.opt.charThemeLine, { [charId]: charThemeLine }) });
      const pool0 = pool === "mix" ? mixIds : pool === "char" ? [charId] : (lim ? (limOne ? [limOne] : limIds) : []);
      if (!pool0.length) { toast("先挑几个角色"); return; }
      const how = opt.testInf ? "test" : C().pay(s, n, ticket);   // 测试券：她自己试味道用，藏在设置里连点七下「规则」
      if (!how) { toast("邮资不够：单抽 " + C().PRICE_ONE + "，十连 " + C().PRICE_TEN + "。多聊聊天就攒起来了"); return; }
      const now = Date.now(), cards = [];
      for (let i = 0; i < n; i++) {
        const rar = C().rollRarity(s);
        const cid = pool0[Math.floor(Math.random() * pool0.length)];
        const card = { id: uid(), ts: now + i, rarity: rar, charId: cid, lv: 1, pool: pool === "char" ? "char" : lim ? "limited" : "mix",
          kind: pool === "mix" ? "daily" : "if", writing: true, writingTs: now };
        if (pool === "char") Object.assign(card, { theme: charTheme.trim().slice(0, 40), themeLine: charThemeLine.slice(0, 200), ifMode });
        if (lim) Object.assign(card, { theme: lim.name, themeLine: lim.line, limited: lim.id, ifMode });
        cards.push(card);
      }
      s.cards = s.cards.concat(cards);
      C().save(s); setSt(s);
      setShow(cards);
      // 动画放着的时候就开始写；挑了「抽到就画」的，写完接着画
      Promise.resolve(onWrite(cards)).then(() => {
        if (!opt.autoDraw) return;
        cards.reduce((p, c) => p.then(() => onDraw(c.id)), Promise.resolve());
      });
    };
    const ssrLeft = C().HARD_AT - (st.sinceSSR || 0);
    const chip = (on, label, onClick, key) => h("button", { key, onClick, "data-on": on ? "1" : "0", className: "active:opacity-70 shrink-0",
      style: { padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? "#e3b65c" : "rgba(244,236,218,.22)"), background: on ? "#e3b65c" : "rgba(244,236,218,.06)", color: on ? "#15121f" : "rgba(244,236,218,.8)", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, label);
    const charOf = id => characters.find(c => c.id === id);
    if (open) { const card = (st.cards || []).find(c => c.id === open) || null; if (card) return h(CardPage, { t, card, char: charOf(card.charId), meName, onBack: () => setOpen(null), onDraw, onRewrite: c => onWrite([c]), toast,
      onSend: c => { props.onSend && props.onSend(c); }, onCanon: c => { props.onCanon && props.onCanon(c); } }); }

    const album = (st.cards || []).filter(c => albumChar === "all" || c.charId === albumChar).slice().reverse();
    // ── 卡池页像乙游那样：一整张大海报（一枚放大的邮票），左边一列小邮票换池，底下两颗大键；其余设置收进「⋯」 ──
    const NIGHT = "#15121f", PAPER = "#f4ecda", GOLD = "#e3b65c";
    const pools = [{ key: "mix", zh: "大混池", tag: "常驻 · 日常卡" }, { key: "char", zh: "角色池", tag: "常驻 · IF 卡" }]
      .concat(lims.map(L => ({ key: "lim:" + L.id, zh: L.name, tag: "限时 · IF 卡", lim: L })));
    const cur = pools.find(p => p.key === pool) || pools[0];
    const charNow = charOf(charId);
    const faces = pool === "mix" ? mixIds.map(charOf).filter(Boolean) : pool === "char" ? (charNow ? [charNow] : []) : (limOne ? [charOf(limOne)] : limIds.map(charOf)).filter(Boolean);
    const tone = pool === "mix" ? ["#2f4a46", "#7fa79a"] : pool === "char" ? [((charNow && charNow.color) || "#4a3d6b"), "#b9a7e0"] : ["#3a1f3d", "#e08a3a"];
    const testInf = !!opt.testInf;
    const perf = c => "radial-gradient(circle at 6px 6px, transparent 4.6px, " + c + " 5px) -6px -6px / 12px 12px";
    // 限时池的节日装饰：只加在边角，不动整张模板（现在只有万圣夜：蝙蝠、南瓜、星星、蛛网）
    const deco = cur.lim && cur.lim.deco === "halloween";
    const bat = (x, y, sc, k) => h("svg", { key: k, viewBox: "0 0 24 12", style: { position: "absolute", left: x, top: y, width: 26 * sc, opacity: .55 } }, h("path", { d: "M12 4c1-2 2-3 3-3-.5 1.5 0 2.5 1 3 1.5-1.5 4-2 8-1-2 1-3 3-3 5-1.5-1-3-1-4 1-1-1-2-1.5-3-1.5S10 7 9 8C8 6 6.5 6 5 7c0-2-1-4-3-5 4-1 6.5-.5 8 1 1-.5 1.5-1.5 1-3 1 0 2 1 1 4z", fill: "#e08a3a" }));
    const pumpkin = (x, y, sz, k) => h("svg", { key: k, viewBox: "0 0 24 24", style: { position: "absolute", left: x, top: y, width: sz, height: sz } },
      h("ellipse", { cx: 12, cy: 14, rx: 10, ry: 8, fill: "#e8892f" }), h("path", { d: "M12 6c0-2 1-3 2-3", stroke: "#4b6b2a", strokeWidth: 2, fill: "none" }),
      h("path", { d: "M7 12l2 2 2-2M13 12l2 2 2-2M8 17q4 3 8 0", stroke: "#3a1f12", strokeWidth: 1.4, fill: "none" }));
    const web = h("svg", { key: "web", viewBox: "0 0 40 40", style: { position: "absolute", right: 0, top: 0, width: 70, height: 70, opacity: .22 } },
      h("path", { d: "M40 0L0 40M40 0L14 40M40 0L0 14M40 0L28 40M40 0L0 28M30 0q2 8 10 10M20 0q3 17 20 20M10 0q4 26 30 30", stroke: "#f4ecda", strokeWidth: .6, fill: "none" }));
    const stars = [[18, 62], [70, 40], [52, 120], [230, 88], [205, 150], [32, 210]].map((q, i) => h("span", { key: "s" + i, style: { position: "absolute", left: q[0], top: q[1], width: 3, height: 3, borderRadius: 9, background: "#f6e3b5", opacity: .55, boxShadow: "0 0 6px #f6e3b5" } }));
    // 海报上那一句：说的是「抽了会得到什么」，不是玩法说明
    const hook = pool === "mix" ? "今天的他，在做一件你还没见过的事。" : pool === "char" ? (charThemeLine.trim() || (charNow ? "如果 " + (charNow.remark || charNow.name) + " 活在「" + (charTheme.trim() || "另一个世界") + "」里——" : "")) : (cur.lim.hook || cur.lim.line.split("。")[0] + "。");
    // 人：一个就放大；几个错落排，中间那个大一点、高一点（不排成整齐一行）
    const faceRow = faces.length === 1
      ? h("div", { style: { borderRadius: 26, padding: 4, background: deco ? "linear-gradient(135deg,#e08a3a,#6b2f6e)" : "rgba(255,255,255,.18)", boxShadow: "0 0 40px " + tone[1] + "88" } }, h(Avatar, { character: faces[0], size: 156, radius: 22 }))
      : (() => { const show = faces.slice(0, 5), mid = Math.floor(show.length / 2);
          return show.map((c, i) => { const d = Math.abs(i - mid), big = d === 0, sz = big ? 96 : d === 1 ? 70 : 54;
            return h("div", { key: c.id, style: { marginLeft: i ? -16 : 0, zIndex: 10 - d, borderRadius: 999, padding: big ? 4 : 3, background: deco ? "linear-gradient(135deg,#e08a3a,#6b2f6e)" : PAPER,
              transform: "translateY(" + (d * 22) + "px)", boxShadow: big ? "0 6px 24px rgba(0,0,0,.45)" : "0 3px 10px rgba(0,0,0,.35)" } }, h(Avatar, { character: c, size: sz, radius: 999 })); }); })();
    const banner = h("div", { "data-wk": "stampbanner", "data-pool": pool, "data-deco": deco ? "halloween" : "", style: { padding: 9, background: perf(PAPER), filter: "drop-shadow(0 10px 24px rgba(0,0,0,.45))", position: "relative" } },
      deco ? [bat(-6, 30, 1, "b1"), bat("78%", -8, .8, "b2"), pumpkin(-10, "86%", 28, "p1"), pumpkin("90%", "40%", 22, "p2")] : null,
      h("div", { style: { position: "relative", height: "min(62vh, 470px)", borderRadius: 3, overflow: "hidden", background: "linear-gradient(160deg, " + tone[0] + ", " + NIGHT + " 78%)", border: "1px solid rgba(255,255,255,.12)" } },
        // 底纹：一圈圈的邮戳线，淡到像防伪纹，不抢人
        h("div", { style: { position: "absolute", inset: 0, opacity: .05, background: "repeating-radial-gradient(circle at 85% 18%, transparent 0 14px, " + tone[1] + " 14px 15px)" } }),
        deco ? [web].concat(stars) : null,
        h("div", { style: { position: "absolute", left: 16, top: 14, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".2em", color: tone[1] } }, cur.tag),
        h("div", { "data-wk": "stampbannertitle", style: { position: "absolute", left: 16, right: 16, top: 32, fontFamily: F_DISPLAY, fontSize: "calc(32px * var(--app-fs, 1))", lineHeight: 1.15, color: PAPER, textShadow: "0 2px 12px rgba(0,0,0,.5)" } },
          pool === "char" ? (charTheme.trim() ? "「" + charTheme.trim() + "」" : "还没写主题") : cur.zh),
        h("div", { "data-wk": "stampbannerhook", style: { position: "absolute", left: 16, right: 16, top: 80, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.5, color: "rgba(244,236,218,.88)" } }, hook),
        h("div", { style: { position: "absolute", left: 0, right: 0, top: faces.length === 1 ? "30%" : "28%", display: "flex", justifyContent: "center", alignItems: "flex-start" } }, faceRow),
        // 邮戳：常驻写「常驻」；限时写截止日和还剩多久，万圣夜那枚是南瓜色的限定戳
        h("div", { "data-wk": "stampcountdown", style: { position: "absolute", right: 12, bottom: 12, width: 84, height: 84, borderRadius: 999, border: (deco ? "2px dashed #e08a3a" : "2px solid " + GOLD), outline: deco ? "1px solid #e08a3a66" : "none", outlineOffset: 3, color: deco ? "#f0a24f" : GOLD, transform: "rotate(-12deg)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, textAlign: "center", lineHeight: 1.25 } },
          cur.lim ? h(React.Fragment, null, h("div", { style: { fontSize: "calc(9.5px * var(--app-fs, 1))" } }, deco ? "万圣夜限定" : "限定"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, new Date(Date.parse(cur.lim.to) - 1).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " 止"), h("div", { style: { fontSize: "calc(9px * var(--app-fs, 1))" } }, "还剩 " + leftText(Date.parse(cur.lim.to) - Date.now())))
            : h(React.Fragment, null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" } }, "常驻"), h("div", { style: { fontSize: "calc(9.5px * var(--app-fs, 1))" } }, "邮票册"))),
        h("div", { style: { position: "absolute", left: 16, bottom: 18, right: 116, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.6, color: "rgba(244,236,218,.6)" } },
          pool === "mix" ? "日常卡 · 他自己的世界、你们现在的关系" : pool === "char" ? "IF 卡 · 衣服照主题来" : "IF 卡 · 下架后抽到的照样留着"),
        pool === "char" ? h("button", { onClick: () => setCfg(true), className: "active:opacity-70", style: { position: "absolute", right: 14, top: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid " + tone[1], color: tone[1], fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, "改主题") : null));
    // 左边一列小邮票：换池。选中的那枚像从邮册里抽出来一截：放大、往右探出去
    const rail = h("div", { "data-wk": "stamprail", className: "flex flex-col shrink-0", style: { gap: 12, width: 70, paddingTop: 6 } },
      pools.map(p => { const on = p.key === pool, hal = p.lim && p.lim.deco === "halloween";
        return h("button", { key: p.key, "data-wk": "stamprailitem", "data-on": on ? "1" : "0", onClick: () => setPool(p.key), className: "active:opacity-80",
          style: { width: 70, height: 86, padding: 4, background: perf(on ? GOLD : "rgba(244,236,218,.8)"), transform: on ? "translateX(10px) scale(1.08) rotate(-2deg)" : "none", transition: "transform .25s", zIndex: on ? 2 : 1,
            filter: on ? "drop-shadow(0 6px 12px rgba(0,0,0,.5))" : "none" } },
          h("div", { style: { width: "100%", height: "100%", borderRadius: 2, background: on ? (hal ? "#3a1f3d" : NIGHT) : "#3a3448", color: on ? GOLD : PAPER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
            fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.25, padding: 3, gap: 3 } },
            p.zh, h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", opacity: .7 } }, p.lim ? "限时" : "常驻"))); }));
    const capsule = (k, v) => h("span", { key: k, "data-wk": "stampwallet", style: { padding: "3px 9px", borderRadius: 999, background: "rgba(244,236,218,.12)", color: PAPER, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, k + " " + v);
    // ⋯ 设置页（整页，不做半窗）：谁会出、角色池主题、IF 写法、抽到就画、规则；连点七下「规则」开测试用的无限券
    if (cfg) return h("div", { "data-wk": "stampcfg", "data-page": "1", className: "h-full flex flex-col", style: { background: "radial-gradient(120% 70% at 50% 0%, #2b2440, #15121f 70%)" } },
      h(Head, { zh: "卡池设置", bg: "transparent", ink: PAPER, onBack: () => setCfg(false) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h(Eyebrow, { style: { color: "rgba(244,236,218,.55)", marginTop: 14 } }, "大混池出哪些人"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 6 } }, characters.map(c => { const on = mixIds.includes(c.id);
          return chip(on, c.remark || c.name, () => { const nx = on ? mixIds.filter(x => x !== c.id) : mixIds.concat(c.id); setPick(nx); setOpt({ mixPick: nx }); }, c.id); })),
        lims.length ? h(React.Fragment, null, h(Eyebrow, { style: { color: "rgba(244,236,218,.55)", marginTop: 18 } }, "限时池出哪些人（不勾就是所有人）"),
          h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 6 } }, characters.map(c => { const cu = opt.limPick || []; const on = cu.includes(c.id);
            return chip(on, c.remark || c.name, () => setOpt({ limPick: on ? cu.filter(x => x !== c.id) : cu.concat(c.id) }), c.id); }))) : null,
        h(Eyebrow, { style: { color: "rgba(244,236,218,.55)", marginTop: 18 } }, "角色池 · 给每个人写一个主题"),
        h("div", { className: "flex overflow-x-auto", style: { gap: 8, margin: "8px 0" } }, characters.map(c => h("button", { key: c.id, onClick: () => setCharId(c.id), className: "shrink-0", style: { borderRadius: 10, padding: 2, border: "2px solid " + (charId === c.id ? PAPER : "transparent") } }, h(Avatar, { character: c, size: 40, radius: 8 })))),
        h("input", { "data-wk": "input", value: charTheme, maxLength: 40, placeholder: "主题名（校园、古风、末日、偶像……）", onChange: e => setThDraft(e.target.value), onBlur: () => { if (thDraft != null) setOpt({ charTheme: Object.assign({}, opt.charTheme, { [charId]: thDraft }) }); },
          style: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid " + "rgba(244,236,218,.22)", background: "rgba(244,236,218,.07)", color: PAPER, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }),
        h("textarea", { "data-wk": "input", value: charThemeLine, maxLength: 200, rows: 2, placeholder: "一句说明（可空）：这个世界里他是什么样", onChange: e => setThLineDraft(e.target.value), onBlur: () => { if (thLineDraft != null) setOpt({ charThemeLine: Object.assign({}, opt.charThemeLine, { [charId]: thLineDraft }) }); },
          style: { width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 10, border: "1px solid " + "rgba(244,236,218,.22)", background: "rgba(244,236,218,.07)", color: PAPER, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", resize: "none" } }),
        h(Eyebrow, { style: { color: "rgba(244,236,218,.55)", marginTop: 18 } }, "IF 卡里，他是别的世界、别的年代的人时"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 6 } }, [["adapt", "照他的世界改写"], ["into", "把他丢进主题里"], ["random", "两种随机"]].map(x => chip(ifMode === x[0], x[1], () => setOpt({ ifMode: x[0] }), x[0]))),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 18 } },
          h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: PAPER } }, "抽到就画卡面"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(244,236,218,.5)" } }, opt.autoDraw ? "开着：每张都画，十连就是十次生图" : "关着：点开哪张、想看再画哪张，省钱")),
          h(Toggle, { on: !!opt.autoDraw, onChange: () => setOpt({ autoDraw: !opt.autoDraw }) })),
        h("button", { onClick: () => { const r = testTap.current, now = Date.now(); r.n = now - r.t < 900 ? r.n + 1 : 1; r.t = now; if (r.n >= 7) { r.n = 0; setOpt({ testInf: !testInf }); toast(testInf ? "测试券关了" : "测试券开了：抽卡不花邮资和券"); } },
          style: { display: "block", marginTop: 22, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: PAPER, background: "transparent", border: "none", padding: 0 } }, "规则"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "rgba(244,236,218,.72)", lineHeight: 1.8, marginTop: 6 } },
          "概率：R 70%、SR 25%、SSR 5%。保底所有池通用：60 抽一定出 SSR（50 抽起概率往上加），每十抽至少一张 SR。", h("br"),
          "单抽 " + C().PRICE_ONE + " 邮资，十连 " + C().PRICE_TEN + "，有十连券先用券。", h("br"),
          "邮资和印泥从互动里来、没有上限：聊天、群聊、通话一轮 5；线下一拍、论坛片刻广场朋友圈、两个人的小事 10；一起听一起看一起读、查手机、看他玩手机 20；别的玩法邮资 5 印泥 10。重 roll、他主动发来的不算。", h("br"),
          "R 是你不在时他一个人的一刻，SR 是你俩的一小段，SSR 是带选项的分节剧情。"),
        testInf ? h("div", { style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: RC.SSR } }, "测试券开着：抽卡不花邮资和券（连点七下「规则」关掉）") : null));
    if (tab === "album") return h("div", { "data-wk": "stampalbumpage", "data-page": "1", className: "h-full flex flex-col", style: { background: "radial-gradient(120% 70% at 50% 0%, #2b2440, #15121f 70%)" } },
      h(Head, { zh: "邮票册", sub: (st.cards || []).length + " 枚", bg: "transparent", ink: PAPER, onBack: () => setTab("pull") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h("div", { className: "flex overflow-x-auto", style: { gap: 8, paddingTop: 10 } },
          chip(albumChar === "all", "全部 " + (st.cards || []).length, () => setAlbumChar("all"), "all"),
          characters.filter(c => (st.cards || []).some(x => x.charId === c.id)).map(c => chip(albumChar === c.id, (c.remark || c.name) + " " + st.cards.filter(x => x.charId === c.id).length, () => setAlbumChar(c.id), c.id))),
        album.length ? h("div", { "data-wk": "stampalbum", className: "grid", style: { gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14, justifyItems: "center" } },
          album.map(c => h(StampFace, { key: c.id, t, card: c, size: 96, onClick: () => setOpen(c.id) })))
          : h("div", { style: { padding: "48px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "rgba(244,236,218,.5)" } }, "还没有邮票，去寄一封")),
      show ? h(PullShow, { t, cards: show.map(c => (st.cards || []).find(x => x.id === c.id) || c), onDone: () => setShow(null), onOpen: c => { setShow(null); setOpen(c.id); }, charOf }) : null);

    return h("div", { "data-wk": "stamppage", className: "h-full flex flex-col", style: { background: "radial-gradient(120% 70% at 50% 0%, #2b2440, " + NIGHT + " 70%)" } },
      h(Head, { zh: "邮票册", bg: "transparent", ink: PAPER, onBack,
        right: h("div", { className: "flex items-center", style: { gap: 4 } },
          h("button", { "data-wk": "stampgoalbum", onClick: () => setTab("album"), className: "active:opacity-60", style: { padding: "6px 8px", color: PAPER, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "册子"),
          h("button", { "data-wk": "stampgocfg", onClick: () => setCfg(true), className: "active:opacity-60", style: { padding: "6px 8px", color: PAPER, fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))" } }, "⋯")) }),
      h("div", { className: "flex justify-end flex-wrap px-4 shrink-0", style: { gap: 6 } },
        capsule("邮资", st.postage), capsule("印泥", st.ink), capsule("十连券", testInf ? "∞" : st.tickets)),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-3", style: { paddingTop: 10 } },
        // 收到礼：一条薄薄的信笺，点开看是什么，✕ 收起
        gotNote.length ? h("div", { "data-wk": "stampgift", className: "flex items-start", style: { margin: "0 4px 10px", padding: "6px 10px", borderRadius: 8, borderLeft: "3px solid " + GOLD, background: "rgba(244,236,218,.08)", color: PAPER, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.6, gap: 8 } },
          h("button", { onClick: () => setGiftOpen(v => !v), className: "flex-1 text-left", style: { color: PAPER } }, "✉ 有 " + gotNote.length + " 封来信" + (giftOpen ? "：" : " ▸"), giftOpen ? gotNote.map((x, i) => h("div", { key: i, style: { opacity: .85 } }, "· " + x)) : null),
          h("button", { onClick: () => setGotNote([]), style: { color: PAPER, opacity: .6 } }, "✕")) : null,
        h("div", { className: "flex", style: { gap: 10 } }, rail, h("div", { className: "flex-1 min-w-0" }, banner)),
        // 角色池：在这儿就能换人，不用进设置
        pool === "char" ? h("div", { "data-wk": "stampcharpick", className: "flex overflow-x-auto", style: { gap: 8, padding: "12px 4px 0 72px" } },
          characters.map(c => h("button", { key: c.id, onClick: () => setCharId(c.id), className: "shrink-0 active:opacity-70", style: { borderRadius: 999, padding: 2, border: "2px solid " + (charId === c.id ? GOLD : "transparent") } }, h(Avatar, { character: c, size: 38, radius: 999 })))) : null,
        lim ? h("div", { "data-wk": "stampcharpick", "data-part": "limited", className: "flex overflow-x-auto items-center", style: { gap: 8, padding: "12px 4px 0 72px" } },
          h("button", { key: "rnd", onClick: () => setOpt({ limOne: Object.assign({}, opt.limOne, { [lim.id]: "" }) }), className: "shrink-0 active:opacity-70",
            style: { width: 42, height: 42, borderRadius: 999, border: "2px solid " + (!limOne ? GOLD : "rgba(244,236,218,.3)"), color: !limOne ? GOLD : PAPER, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, "随机"),
          limIds.map(charOf).filter(Boolean).map(c => h("button", { key: c.id, onClick: () => setOpt({ limOne: Object.assign({}, opt.limOne, { [lim.id]: c.id }) }), className: "shrink-0 active:opacity-70", style: { borderRadius: 999, padding: 2, border: "2px solid " + (limOne === c.id ? GOLD : "transparent") } }, h(Avatar, { character: c, size: 38, radius: 999 })))) : null,
        h("div", { style: { margin: "12px 0 6px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(244,236,218,.6)" } },
          "再抽 " + Math.max(1, ssrLeft) + " 次一定出 SSR · 每十抽至少一张 SR")),
      // 底下两颗大键
      h("div", { "data-wk": "stamppullbar", className: "flex shrink-0 px-4", style: { gap: 10, padding: "10px 16px calc(env(safe-area-inset-bottom) * 0.4 + 12px)" } },
        h("button", { "data-wk": "stamppullbtn", "data-part": "one", onClick: () => doPull(1), className: "flex-1 active:opacity-80",
          style: { minHeight: 56, borderRadius: 16, border: "1.5px solid " + PAPER, color: PAPER, background: "transparent", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" } },
          "寄一封", h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .75 } }, testInf ? "测试券" : C().PRICE_ONE + " 邮资")),
        h("button", { "data-wk": "stamppullbtn", "data-part": "ten", onClick: () => doPull(10, st.tickets > 0), className: "flex-1 active:opacity-80",
          style: { minHeight: 56, borderRadius: 16, background: "linear-gradient(160deg, " + GOLD + ", #b8862f)", color: NIGHT, fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", boxShadow: "0 4px 18px rgba(227,182,92,.35)" } },
          "寄一版", h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .8 } }, testInf ? "测试券" : st.tickets > 0 ? "十连券 ×1（还有 " + st.tickets + "）" : C().PRICE_TEN + " 邮资"))),
      show ? h(PullShow, { t, cards: show.map(c => (st.cards || []).find(x => x.id === c.id) || c), onDone: () => setShow(null), onOpen: c => { setShow(null); setOpen(c.id); }, charOf }) : null);
  }
  window.StampBookApp = StampBookApp;
})();
