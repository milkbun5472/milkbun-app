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
    const [cfg, setCfg] = useState(false);
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

    const doPull = async (n, ticket) => {
      const s = C().load();
      if (pool === "char" && !charTheme.trim()) { toast("先给 TA 写一个主题"); return; }
      if (pool === "char" && (thDraft != null || thLineDraft != null)) s.opt = Object.assign({}, s.opt, { charTheme: Object.assign({}, s.opt.charTheme, { [charId]: charTheme }), charThemeLine: Object.assign({}, s.opt.charThemeLine, { [charId]: charThemeLine }) });
      const pool0 = pool === "mix" ? mixIds : pool === "char" ? [charId] : (lim ? (opt.limPick && opt.limPick.length ? opt.limPick : characters.map(c => c.id)) : []);
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
      style: { padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : "transparent", color: on ? t.bg2 : t.sub, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, label);
    const charOf = id => characters.find(c => c.id === id);
    if (open) { const card = (st.cards || []).find(c => c.id === open) || null; if (card) return h(CardPage, { t, card, char: charOf(card.charId), meName, onBack: () => setOpen(null), onDraw, onRewrite: c => onWrite([c]) }); }

    const album = (st.cards || []).filter(c => albumChar === "all" || c.charId === albumChar).slice().reverse();
    // ── 卡池页像乙游那样：一整张大海报（一枚放大的邮票），左边一列小邮票换池，底下两颗大键；其余设置收进「⋯」 ──
    const NIGHT = "#15121f", PAPER = "#f4ecda", GOLD = "#e3b65c";
    const pools = [{ key: "mix", zh: "大混池", tag: "常驻 · 日常卡" }, { key: "char", zh: "角色池", tag: "常驻 · IF 卡" }]
      .concat(lims.map(L => ({ key: "lim:" + L.id, zh: L.name, tag: "限时 · IF 卡", lim: L })));
    const cur = pools.find(p => p.key === pool) || pools[0];
    const charNow = charOf(charId);
    const faces = pool === "mix" ? mixIds.map(charOf).filter(Boolean) : pool === "char" ? (charNow ? [charNow] : []) : ((opt.limPick && opt.limPick.length ? opt.limPick : characters.map(c => c.id)).map(charOf).filter(Boolean));
    const tone = pool === "mix" ? ["#2f4a46", "#7fa79a"] : pool === "char" ? [((charNow && charNow.color) || "#4a3d6b"), "#b9a7e0"] : ["#3a1f3d", "#e08a3a"];
    const testInf = !!opt.testInf;
    const perf = c => "radial-gradient(circle at 6px 6px, transparent 4.6px, " + c + " 5px) -6px -6px / 12px 12px";
    const banner = h("div", { "data-wk": "stampbanner", "data-pool": pool, style: { padding: 9, background: perf(PAPER), filter: "drop-shadow(0 10px 24px rgba(0,0,0,.45))" } },
      h("div", { style: { position: "relative", height: "min(62vh, 470px)", borderRadius: 3, overflow: "hidden", background: "linear-gradient(160deg, " + tone[0] + ", " + NIGHT + " 78%)", border: "1px solid rgba(255,255,255,.12)" } },
        // 底纹：一圈圈的邮戳波浪线
        h("div", { style: { position: "absolute", inset: 0, opacity: .14, background: "repeating-radial-gradient(circle at 85% 18%, transparent 0 14px, " + tone[1] + " 14px 15px)" } }),
        h("div", { style: { position: "absolute", left: 16, top: 14, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".2em", color: tone[1] } }, cur.tag),
        h("div", { "data-wk": "stampbannertitle", style: { position: "absolute", left: 16, right: 16, top: 34, fontFamily: F_DISPLAY, fontSize: "calc(34px * var(--app-fs, 1))", lineHeight: 1.15, color: PAPER, textShadow: "0 2px 12px rgba(0,0,0,.5)" } },
          pool === "char" ? (charTheme.trim() ? "「" + charTheme.trim() + "」" : "还没写主题") : cur.zh,
          pool === "char" && charNow ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: tone[1], marginTop: 4 } }, "如果的 " + (charNow.remark || charNow.name)) : null),
        // 人：一个人就放大，几个人叠成一排
        h("div", { style: { position: "absolute", left: 0, right: 0, top: "34%", display: "flex", justifyContent: "center", alignItems: "flex-end" } },
          faces.length === 1 ? h("div", { style: { borderRadius: 24, padding: 4, background: "rgba(255,255,255,.18)", boxShadow: "0 0 40px " + tone[1] + "88" } }, h(Avatar, { character: faces[0], size: 150, radius: 20 }))
            : faces.slice(0, 6).map((c, i) => h("div", { key: c.id, style: { marginLeft: i ? -18 : 0, borderRadius: 999, padding: 3, background: PAPER, transform: "translateY(" + (i % 2 ? 0 : -14) + "px)" } }, h(Avatar, { character: c, size: 72, radius: 999 })))),
        // 邮戳：常驻写「常驻」，限时写截止日和还剩多久
        h("div", { "data-wk": "stampcountdown", style: { position: "absolute", right: 12, bottom: 12, width: 80, height: 80, borderRadius: 999, border: "2px solid " + GOLD, color: GOLD, transform: "rotate(-12deg)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, textAlign: "center", lineHeight: 1.25 } },
          cur.lim ? h(React.Fragment, null, h("div", { style: { fontSize: "calc(10px * var(--app-fs, 1))" } }, "截止"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, new Date(Date.parse(cur.lim.to) - 1).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })), h("div", { style: { fontSize: "calc(9.5px * var(--app-fs, 1))" } }, "还剩 " + leftText(Date.parse(cur.lim.to) - Date.now())))
            : h(React.Fragment, null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" } }, "常驻"), h("div", { style: { fontSize: "calc(9.5px * var(--app-fs, 1))" } }, "邮票册"))),
        h("div", { style: { position: "absolute", left: 16, bottom: 16, right: 116, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.6, color: "rgba(244,236,218,.82)" } },
          pool === "mix" ? "他在自己的世界里、跟你现在这层关系下可能会有的一刻新鲜事。" : pool === "char" ? (charThemeLine.trim() || "你给他写的那个「如果」里的他，衣服照主题来。") : cur.lim.line.split("。")[0] + "。"),
        pool === "char" ? h("button", { onClick: () => setCfg(true), className: "active:opacity-70", style: { position: "absolute", right: 14, top: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid " + tone[1], color: tone[1], fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, "改主题") : null));
    // 左边一列小邮票：换池
    const rail = h("div", { "data-wk": "stamprail", className: "flex flex-col shrink-0", style: { gap: 10, width: 62, paddingTop: 4 } },
      pools.map(p => { const on = p.key === pool;
        return h("button", { key: p.key, "data-wk": "stamprailitem", "data-on": on ? "1" : "0", onClick: () => setPool(p.key), className: "active:opacity-80",
          style: { width: 62, height: 76, padding: 4, background: perf(on ? GOLD : "rgba(244,236,218,.55)"), transform: on ? "translateX(4px)" : "none", transition: "transform .2s" } },
          h("div", { style: { width: "100%", height: "100%", borderRadius: 2, background: on ? NIGHT : "#2a2536", color: on ? GOLD : "rgba(244,236,218,.7)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
            fontFamily: F_DISPLAY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.25, padding: 3 } }, p.zh)); }));
    const capsule = (k, v) => h("span", { key: k, "data-wk": "stampwallet", style: { padding: "3px 9px", borderRadius: 999, background: "rgba(244,236,218,.12)", color: PAPER, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, k + " " + v);
    // ⋯ 设置页（整页，不做半窗）：谁会出、角色池主题、IF 写法、抽到就画、规则；连点七下「规则」开测试用的无限券
    if (cfg) return h("div", { "data-wk": "stampcfg", "data-page": "1", className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "卡池设置", bg: "transparent", onBack: () => setCfg(false) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h(Eyebrow, { style: { marginTop: 14 } }, "大混池出哪些人"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 6 } }, characters.map(c => { const on = mixIds.includes(c.id);
          return chip(on, c.remark || c.name, () => { const nx = on ? mixIds.filter(x => x !== c.id) : mixIds.concat(c.id); setPick(nx); setOpt({ mixPick: nx }); }, c.id); })),
        lims.length ? h(React.Fragment, null, h(Eyebrow, { style: { marginTop: 18 } }, "限时池出哪些人（不勾就是所有人）"),
          h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 6 } }, characters.map(c => { const cu = opt.limPick || []; const on = cu.includes(c.id);
            return chip(on, c.remark || c.name, () => setOpt({ limPick: on ? cu.filter(x => x !== c.id) : cu.concat(c.id) }), c.id); }))) : null,
        h(Eyebrow, { style: { marginTop: 18 } }, "角色池 · 给每个人写一个主题"),
        h("div", { className: "flex overflow-x-auto", style: { gap: 8, margin: "8px 0" } }, characters.map(c => h("button", { key: c.id, onClick: () => setCharId(c.id), style: { borderRadius: 10, padding: 2, border: "2px solid " + (charId === c.id ? t.ink : "transparent") } }, h(Avatar, { character: c, size: 40, radius: 8 })))),
        h("input", { "data-wk": "input", value: charTheme, maxLength: 40, placeholder: "主题名（校园、古风、末日、偶像……）", onChange: e => setThDraft(e.target.value), onBlur: () => { if (thDraft != null) setOpt({ charTheme: Object.assign({}, opt.charTheme, { [charId]: thDraft }) }); },
          style: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }),
        h("textarea", { "data-wk": "input", value: charThemeLine, maxLength: 200, rows: 2, placeholder: "一句说明（可空）：这个世界里他是什么样", onChange: e => setThLineDraft(e.target.value), onBlur: () => { if (thLineDraft != null) setOpt({ charThemeLine: Object.assign({}, opt.charThemeLine, { [charId]: thLineDraft }) }); },
          style: { width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", resize: "none" } }),
        h(Eyebrow, { style: { marginTop: 18 } }, "IF 卡里，他是别的世界、别的年代的人时"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 6 } }, [["adapt", "照他的世界改写"], ["into", "把他丢进主题里"], ["random", "两种随机"]].map(x => chip(ifMode === x[0], x[1], () => setOpt({ ifMode: x[0] }), x[0]))),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 18 } },
          h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink } }, "抽到就画卡面"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, opt.autoDraw ? "开着：每张都画，十连就是十次生图" : "关着：点开哪张、想看再画哪张，省钱")),
          h(Toggle, { on: !!opt.autoDraw, onChange: () => setOpt({ autoDraw: !opt.autoDraw }) })),
        h("button", { onClick: () => { const r = testTap.current, now = Date.now(); r.n = now - r.t < 900 ? r.n + 1 : 1; r.t = now; if (r.n >= 7) { r.n = 0; setOpt({ testInf: !testInf }); toast(testInf ? "测试券关了" : "测试券开了：抽卡不花邮资和券"); } },
          style: { display: "block", marginTop: 22, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, background: "transparent", border: "none", padding: 0 } }, "规则"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.8, marginTop: 6 } },
          "概率：R 70%、SR 25%、SSR 5%。保底所有池通用：60 抽一定出 SSR（50 抽起概率往上加），每十抽至少一张 SR。", h("br"),
          "单抽 " + C().PRICE_ONE + " 邮资，十连 " + C().PRICE_TEN + "，有十连券先用券。", h("br"),
          "邮资和印泥从互动里来、没有上限：聊天、群聊、通话一轮 5；线下一拍、论坛片刻广场朋友圈、两个人的小事 10；一起听一起看一起读、查手机、看他玩手机 20；别的玩法邮资 5 印泥 10。重 roll、他主动发来的不算。", h("br"),
          "R 是你不在时他一个人的一刻，SR 是你俩的一小段，SSR 是带选项的分节剧情。"),
        testInf ? h("div", { style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: RC.SSR } }, "测试券开着：抽卡不花邮资和券（连点七下「规则」关掉）") : null));
    if (tab === "album") return h("div", { "data-wk": "stampalbumpage", "data-page": "1", className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "邮票册", sub: (st.cards || []).length + " 枚", bg: "transparent", onBack: () => setTab("pull") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h("div", { className: "flex overflow-x-auto", style: { gap: 8, paddingTop: 10 } },
          chip(albumChar === "all", "全部 " + (st.cards || []).length, () => setAlbumChar("all"), "all"),
          characters.filter(c => (st.cards || []).some(x => x.charId === c.id)).map(c => chip(albumChar === c.id, (c.remark || c.name) + " " + st.cards.filter(x => x.charId === c.id).length, () => setAlbumChar(c.id), c.id))),
        album.length ? h("div", { "data-wk": "stampalbum", className: "grid", style: { gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14, justifyItems: "center" } },
          album.map(c => h(StampFace, { key: c.id, t, card: c, size: 96, onClick: () => setOpen(c.id) })))
          : h("div", { style: { padding: "48px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, "还没有邮票，去寄一封")),
      show ? h(PullShow, { t, cards: show.map(c => (st.cards || []).find(x => x.id === c.id) || c), onDone: () => setShow(null), onOpen: c => { setShow(null); setOpen(c.id); } }) : null);

    return h("div", { "data-wk": "stamppage", className: "h-full flex flex-col", style: { background: "radial-gradient(120% 70% at 50% 0%, #2b2440, " + NIGHT + " 70%)" } },
      h(Head, { zh: "邮票册", bg: "transparent", ink: PAPER, onBack,
        right: h("div", { className: "flex items-center", style: { gap: 4 } },
          h("button", { "data-wk": "stampgoalbum", onClick: () => setTab("album"), className: "active:opacity-60", style: { padding: "6px 8px", color: PAPER, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "册子"),
          h("button", { "data-wk": "stampgocfg", onClick: () => setCfg(true), className: "active:opacity-60", style: { padding: "6px 8px", color: PAPER, fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))" } }, "⋯")) }),
      h("div", { className: "flex justify-end flex-wrap px-4 shrink-0", style: { gap: 6 } },
        capsule("邮资", st.postage), capsule("印泥", st.ink), capsule("十连券", testInf ? "∞" : st.tickets)),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-3", style: { paddingTop: 10 } },
        gotNote.length ? h("div", { "data-wk": "stampgift", style: { margin: "0 4px 12px", padding: "10px 14px", borderRadius: 12, background: PAPER, color: "#6a4d1e", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7 } },
          "收到了：", gotNote.map((x, i) => h("div", { key: i }, "· " + x))) : null,
        h("div", { className: "flex", style: { gap: 10 } }, rail, h("div", { className: "flex-1 min-w-0" }, banner)),
        // 角色池：在这儿就能换人，不用进设置
        pool === "char" ? h("div", { "data-wk": "stampcharpick", className: "flex overflow-x-auto", style: { gap: 8, padding: "12px 4px 0 72px" } },
          characters.map(c => h("button", { key: c.id, onClick: () => setCharId(c.id), className: "shrink-0 active:opacity-70", style: { borderRadius: 999, padding: 2, border: "2px solid " + (charId === c.id ? GOLD : "transparent") } }, h(Avatar, { character: c, size: 38, radius: 999 })))) : null,
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
      show ? h(PullShow, { t, cards: show.map(c => (st.cards || []).find(x => x.id === c.id) || c), onDone: () => setShow(null), onOpen: c => { setShow(null); setOpen(c.id); } }) : null);
  }
  window.StampBookApp = StampBookApp;
})();
