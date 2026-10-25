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
  function PullShow({ t, cards, onDone, onOpen }) {
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
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "#7a6a52" } }, stage === "mail" ? "点开信封" : "")) : null,
      stage === "sheet" ? h(React.Fragment, null,
        h("div", { className: "flex flex-wrap justify-center", style: { gap: 8, maxWidth: 420 } },
          cards.map(c => torn[c.id]
            ? h("div", { key: c.id, style: { animation: "stFlip .35s ease-out" } }, h(StampFace, { t, card: c, size: cards.length > 1 ? 64 : 150, onClick: () => onOpen(c) }))
            : h(Stamp, { key: c.id, t, card: c, back: true, size: cards.length > 1 ? 64 : 150, onClick: () => setTorn(p => ({ ...p, [c.id]: 1 })) }))),
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
  function CardPage({ t, card, char, meName, onBack, onDraw, onRewrite }) {
    const url = useIdbImgUrl(card.face);
    const [story, setStory] = useState(false);
    const tx = card.text, lv = card.lv || 1;
    const stale = card.writing && Date.now() - Number(card.writingTs || 0) > 180000;
    const box = (title, body, locked) => h("div", { "data-wk": "stampbox", style: { marginTop: 12, padding: "12px 14px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.sub, marginBottom: 6 } }, title),
      locked ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog } }, locked) : body);
    const para = s => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.8, color: t.ink, whiteSpace: "pre-wrap" } }, s);
    return h("div", { "data-wk": "stampcard", "data-page": "1", className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: tx ? tx.name : "一枚邮票", sub: (char ? char.name : "") + " · " + card.rarity + (card.kind === "if" ? " · IF「" + (card.theme || "") + "」" : " · 日常"), bg: "transparent", onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h("div", { className: "flex flex-col items-center", style: { paddingTop: 8 } },
          h(Stamp, { t, card, face: url, size: 210 }),
          !card.face ? h("button", { "data-wk": "stampdraw", disabled: !tx || card.drawing, onClick: () => onDraw(card.id), className: "active:opacity-70 disabled:opacity-40",
            style: { marginTop: 12, padding: "9px 18px", borderRadius: 999, border: "1px solid " + RC[card.rarity], color: RC[card.rarity], fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } },
            card.drawing ? "画着…" : "画卡面 · 花一次生图") : null,
          h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, "Lv." + lv + " / " + (C().CAP[card.rarity] || 30))),
        !tx ? box("这一张还没写好", h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog } }, card.writing && !stale ? "他还在写，等一会儿。" : (card.err || "这一张没写出来。")),
            (!card.writing || stale) ? h("button", { onClick: () => onRewrite(card), className: "active:opacity-70", style: { marginTop: 8, padding: "7px 16px", borderRadius: 999, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "重写这一张") : null))
        : card.rarity === "R" ? h(React.Fragment, null,
            box("那一刻", h("div", null, para(tx.narration || ""), tx.thought ? h("div", { style: { marginTop: 8, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(14px * var(--app-fs, 1))", color: t.sub } }, "「" + tx.thought + "」") : null)),
            box("前一刻", null, "升到 10 级解锁"), box("后一刻", null, "升到 20 级解锁"))
        : card.rarity === "SR" ? h(React.Fragment, null,
            tx.line ? h("div", { style: { marginTop: 14, textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, "「" + tx.line + "」") : null,
            box("剧情", h("div", null, para(tx.open || ""), h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "后面的升到 10 级解锁"))))
        : h(React.Fragment, null,
            tx.line ? h("div", { style: { marginTop: 14, textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, "「" + tx.line + "」") : null,
            box("剧情", h("div", null,
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7 } }, "分几节，中间要你做选择。现在能看第一节，后面的跟着等级一节一节开。"),
              h("button", { "data-wk": "stampstoryopen", onClick: () => setStory(true), className: "w-full active:opacity-70", style: { marginTop: 10, minHeight: 44, borderRadius: 12, background: RC.SSR, color: "#fff", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "进入剧情"))))),
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

    const doPull = async (n, ticket) => {
      const s = C().load();
      if (pool === "char" && !charTheme.trim()) { toast("先给 TA 写一个主题"); return; }
      if (pool === "char" && (thDraft != null || thLineDraft != null)) s.opt = Object.assign({}, s.opt, { charTheme: Object.assign({}, s.opt.charTheme, { [charId]: charTheme }), charThemeLine: Object.assign({}, s.opt.charThemeLine, { [charId]: charThemeLine }) });
      const pool0 = pool === "mix" ? mixIds : pool === "char" ? [charId] : (lim ? (opt.limPick && opt.limPick.length ? opt.limPick : characters.map(c => c.id)) : []);
      if (!pool0.length) { toast("先挑几个角色"); return; }
      const how = C().pay(s, n, ticket);
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
      style: { padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : "transparent", color: on ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, label);
    const charOf = id => characters.find(c => c.id === id);
    if (open) { const card = (st.cards || []).find(c => c.id === open) || null; if (card) return h(CardPage, { t, card, char: charOf(card.charId), meName, onBack: () => setOpen(null), onDraw, onRewrite: c => onWrite([c]) }); }

    const album = (st.cards || []).filter(c => albumChar === "all" || c.charId === albumChar).slice().reverse();
    return h("div", { "data-wk": "stamppage", className: "h-full flex flex-col", style: { background: "repeating-linear-gradient(0deg, transparent 0 27px, " + t.line + "55 27px 28px), " + t.bg } },
      h(Head, { zh: "邮票册", sub: "邮资 " + st.postage + " · 印泥 " + st.ink + (st.tickets ? " · 十连券 " + st.tickets : ""), bg: "transparent", onBack }),
      // 两页：抽卡 / 邮票册。活页夹的分隔页标签，不是一排药丸（施工规则/tabs-not-plain-pills.md）
      h("div", { className: "flex px-5 shrink-0", style: { gap: 4, borderBottom: "1px solid " + t.ink } },
        [["pull", "寄一封"], ["album", "邮票册"]].map(x => { const on = tab === x[0];
          return h("button", { key: x[0], "data-wk": "stamptab", "data-on": on ? "1" : "0", onClick: () => setTab(x[0]),
            style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: on ? t.ink : t.fog, background: on ? t.bg2 : "transparent", border: "1px solid " + (on ? t.ink : t.line), borderBottom: "none", borderRadius: "7px 7px 0 0", padding: on ? "7px 16px" : "4px 14px", marginBottom: on ? -1 : 0 } }, x[1]); })),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        gotNote.length ? h("div", { "data-wk": "stampgift", style: { marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "#f6ead0", color: "#6a4d1e", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.7 } },
          "收到了：", gotNote.map((x, i) => h("div", { key: i }, "· " + x))) : null,
        tab === "pull" ? h(React.Fragment, null,
          h("div", { className: "flex overflow-x-auto", style: { gap: 8, paddingTop: 14 } },
            chip(pool === "mix", "大混池", () => setPool("mix"), "mix"),
            chip(pool === "char", "角色池", () => setPool("char"), "char"),
            lims.map(L => chip(pool === "lim:" + L.id, L.name + " · 限时", () => setPool("lim:" + L.id), L.id))),
          h("div", { "data-wk": "stamppool", style: { marginTop: 12, padding: "14px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
            pool === "mix" ? h(React.Fragment, null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, "大混池 · 日常卡"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, margin: "4px 0 10px", lineHeight: 1.6 } }, "他在自己的世界里、跟你现在这层关系下可能会有的一刻新鲜事。勾上想出的人："),
              h("div", { className: "flex flex-wrap", style: { gap: 6 } }, characters.map(c => { const on = mixIds.includes(c.id);
                return chip(on, c.remark || c.name, () => { const cur = mixIds; const nx = on ? cur.filter(x => x !== c.id) : cur.concat(c.id); setPick(nx); setOpt({ mixPick: nx }); }, c.id); })))
            : pool === "char" ? h(React.Fragment, null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, "角色池 · IF 卡"),
              h("div", { className: "flex overflow-x-auto", style: { gap: 8, margin: "10px 0" } }, characters.map(c => h("button", { key: c.id, onClick: () => setCharId(c.id), style: { borderRadius: 10, padding: 2, border: "2px solid " + (charId === c.id ? t.ink : "transparent") } }, h(Avatar, { character: c, size: 40, radius: 8 })))),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } }, "给 " + ((charOf(charId) || {}).name || "TA") + " 写一个主题（校园、古风、末日、偶像……），抽出来的都是这个「如果」里的他："),
              h("input", { "data-wk": "input", value: charTheme, maxLength: 40, placeholder: "主题名", onChange: e => setThDraft(e.target.value), onBlur: () => { if (thDraft != null) setOpt({ charTheme: Object.assign({}, opt.charTheme, { [charId]: thDraft }) }); },
                style: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }),
              h("textarea", { "data-wk": "input", value: charThemeLine, maxLength: 200, rows: 2, placeholder: "一句说明（可空）：这个世界里他是什么样",
                onChange: e => setThLineDraft(e.target.value), onBlur: () => { if (thLineDraft != null) setOpt({ charThemeLine: Object.assign({}, opt.charThemeLine, { [charId]: thLineDraft }) }); },
                style: { width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", resize: "none" } }))
            : lim ? h(React.Fragment, null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, lim.name + " · 限时 IF 卡"),
              h("div", { "data-wk": "stampcountdown", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: RC.SSR, margin: "4px 0" } }, "还剩 " + leftText(Date.parse(lim.to) - Date.now())),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 8, lineHeight: 1.6 } }, "下架以后抽到的卡照样留在邮票册里。勾上想出的人（不勾就是所有人）："),
              h("div", { className: "flex flex-wrap", style: { gap: 6 } }, characters.map(c => { const cur = opt.limPick || []; const on = cur.includes(c.id);
                return chip(on, c.remark || c.name, () => setOpt({ limPick: on ? cur.filter(x => x !== c.id) : cur.concat(c.id) }), c.id); }))) : null,
            pool !== "mix" ? h("div", { className: "flex flex-wrap items-center", style: { gap: 6, marginTop: 12 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, "他是别的世界、别的年代的人时："),
              [["adapt", "照他的世界改写"], ["into", "把他丢进主题里"], ["random", "两种随机"]].map(x => chip(ifMode === x[0], x[1], () => setOpt({ ifMode: x[0] }), x[0]))) : null),
          h("div", { style: { marginTop: 14, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, textAlign: "center" } },
            "再抽 " + Math.max(1, ssrLeft) + " 次一定出 SSR · 每十抽至少一张 SR · 保底所有池通用"),
          h("div", { className: "flex", style: { gap: 10, marginTop: 10 } },
            h("button", { "data-wk": "stamppullbtn", "data-part": "one", onClick: () => doPull(1), className: "flex-1 active:opacity-70", style: { minHeight: 52, borderRadius: 14, border: "1.5px solid " + t.ink, color: t.ink, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "寄一封", h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, C().PRICE_ONE + " 邮资")),
            h("button", { "data-wk": "stamppullbtn", "data-part": "ten", onClick: () => doPull(10, st.tickets > 0), className: "flex-1 active:opacity-70", style: { minHeight: 52, borderRadius: 14, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))" } }, "寄一版", h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", opacity: .7 } }, st.tickets > 0 ? "用一张十连券（还有 " + st.tickets + "）" : C().PRICE_TEN + " 邮资"))),
          h("div", { className: "flex items-center justify-between", style: { marginTop: 16, padding: "10px 0", borderTop: "1px dashed " + t.line } },
            h("div", null, h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.sub } }, "抽到就画卡面"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, opt.autoDraw ? "开着：每张都画，十连就是十次生图" : "关着：点开哪张、想看再画哪张，省钱")),
            h(Toggle, { on: !!opt.autoDraw, onChange: () => setOpt({ autoDraw: !opt.autoDraw }) })),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, marginTop: 6 } },
            "邮资和印泥从互动里来：聊天一轮 5，线下一拍、论坛片刻广场朋友圈、两个人的小事 10，一起听一起看 20，没有上限。R 是你不在时他一个人的一刻，SR 是你俩的一小段，SSR 是带选项的分节剧情。"))
        : h(React.Fragment, null,
          h("div", { className: "flex overflow-x-auto", style: { gap: 8, paddingTop: 14 } },
            chip(albumChar === "all", "全部 " + (st.cards || []).length, () => setAlbumChar("all"), "all"),
            characters.filter(c => (st.cards || []).some(x => x.charId === c.id)).map(c => chip(albumChar === c.id, (c.remark || c.name) + " " + st.cards.filter(x => x.charId === c.id).length, () => setAlbumChar(c.id), c.id))),
          album.length ? h("div", { "data-wk": "stampalbum", className: "grid", style: { gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14, justifyItems: "center" } },
            album.map(c => h(StampFace, { key: c.id, t, card: c, size: 96, onClick: () => setOpen(c.id) })))
          : h("div", { style: { padding: "48px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, "还没有邮票，去寄一封"))),
      show ? h(PullShow, { t, cards: show.map(c => (st.cards || []).find(x => x.id === c.id) || c), onDone: () => setShow(null), onOpen: c => { setShow(null); setOpen(c.id); } }) : null);
  }
  window.StampBookApp = StampBookApp;
})();
