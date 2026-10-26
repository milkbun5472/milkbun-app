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
              fontFamily: F_DISPLAY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#6a5f4e", lineHeight: 1.4 } }, card && card.text ? card.text.name : card && card.writing && Date.now() - Number(card.writingTs || 0) < (card.queued ? 1800000 : 180000) ? "他还在写…" : "没写好 · 点开重写") : null,
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
            ? h("div", { key: c.id, className: "flex flex-col items-center", style: { gap: 3, animation: "stFlip .35s ease-out" } }, h(StampFace, { t, card: c, size: cards.length > 1 ? 64 : 150, onClick: () => onOpen(c.dupe ? Object.assign({}, c, { id: c.dupeOf }) : c) }),
                nameOf(c) ? h("div", { "data-wk": "stampwho", style: { maxWidth: cards.length > 1 ? 70 : 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "rgba(244,236,218,.85)" } }, nameOf(c)) : null,
                c.dupe ? h("div", { "data-wk": "stampdupe", style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "#e3b65c", whiteSpace: "nowrap" } }, "重复 · 印泥 +" + C().DUPE_INK) : null)
            : h("div", { key: c.id, className: "flex flex-col items-center", style: { gap: 3 } },
                h(Stamp, { t, card: c, back: true, size: cards.length > 1 ? 64 : 150, onClick: () => setTorn(p => ({ ...p, [c.id]: 1 })) }),
                nameOf(c) ? h("div", { "data-wk": "stampsender", style: { maxWidth: cards.length > 1 ? 70 : 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: "rgba(244,236,218,.75)" } }, nameOf(c) + " 来信") : null))),
        h("div", { className: "flex", style: { gap: 10, marginTop: 18 } },
          cards.length > 1 && Object.keys(torn).length < cards.length ? h("button", { onClick: all, className: "active:opacity-70", style: { padding: "10px 18px", borderRadius: 999, background: "#f4ecda", color: "#5a4a32", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "整版撕开") : null,
          h("button", { onClick: onDone, className: "active:opacity-70", style: { padding: "10px 18px", borderRadius: 999, border: "1px solid #f4ecda", color: "#f4ecda", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "收进邮票册"))) : null);
  }

  // 剧情：乙游对话框。背景是卡面，一句一句点着走；锁着的那节写着要盖到第几枚
  // 外语那句：写成「原文 | 中文」的，原文大字、中文一行小字；没带中文的外语，旁边一颗「译」，点了用免费翻译当场翻（不花模型）
  function BiText({ text, small, color, sub }) {
    const [zh, setZh] = useState(""), [busy, setBusy] = useState(false);
    const sp = typeof splitBilingual === "function" ? splitBilingual(String(text || "")) : null;
    const orig = sp ? sp.text : String(text || ""), cn = sp ? sp.zh : zh;
    const can = !sp && !zh && typeof translatableLang === "function" && translatableLang(orig);
    const go = async e => { e && e.stopPropagation(); if (busy) return; setBusy(true); try { const r = await translateToZh(orig, can); if (r && r.zh) setZh(r.zh); } catch (er) {} setBusy(false); };
    return h(React.Fragment, null, orig,
      can ? h("button", { "data-wk": "stamptrans", onClick: go, style: { marginLeft: 6, padding: "0 6px", borderRadius: 6, border: "1px solid currentColor", fontSize: "0.72em", opacity: .7, fontStyle: "normal", verticalAlign: "middle" } }, busy ? "…" : "译") : null,
      cn ? h("div", { "data-wk": "stampzh", style: { marginTop: 3, fontSize: "0.8em", fontStyle: "normal", opacity: .72, color: sub || color } }, cn) : null);
  }
  function StoryReader({ t, card, char, meName, lv, start, onClose, onSeen, inner }) {
    const secs = (card.text && card.text.sections) || [];
    // 剧情背景能挑：第一面、满级他一个人、满级你们俩，画了哪几张就能换哪几张；挑了记在卡上
    const fx = Object.assign({ main: card.face }, card.faceAlt ? { [card.faceAltMode || "solo"]: card.faceAlt } : {}, card.faces || {});
    const uMain = useIdbImgUrl(fx.main || null), uSolo = useIdbImgUrl(fx.solo || null), uDuo = useIdbImgUrl(fx.duo || null);
    const opts = [["main", "第一面", uMain], ["solo", "他一个人", uSolo], ["duo", "你们俩", uDuo]].filter(x => x[2]);
    const [bg, setBg] = useState(card.storyBg || "main");
    const curBg = opts.find(x => x[0] === bg) || opts[0];
    const url = curBg ? curBg[2] : null;
    const nextBg = () => { if (opts.length < 2) return; const i = opts.findIndex(x => x === curBg), nx = opts[(i + 1) % opts.length][0]; setBg(nx);
      const st0 = C().load(); st0.cards = st0.cards.map(c => c.id === card.id ? Object.assign({}, c, { storyBg: nx }) : c); C().save(st0); };
    const [sid, setSid] = useState((start && secs.some(x => x.id === start) ? start : null) || (secs[0] && secs[0].id));   // 从回廊点哪一幕就从哪一幕开始
    const [i, setI] = useState(0);
    const [picks, setPicks] = useState({});   // 一节中间的小选项：选了哪个（同一节里换个回应，走完又回到主线）
    useEffect(() => { setPicks({}); if (onSeen && sid) onSeen(sid); }, [sid]);
    const sec = secs.find(s => s.id === sid) || secs[0];
    if (!sec) return null;
    // 把这一节摊开：中间的 pick 没选时停在那儿；选了就换成「她说的那句＋他那几句」
    const flat = [];
    for (let k = 0; k < sec.beats.length; k++) {
      const b = sec.beats[k] || {};
      if (b.who === "pick" && Array.isArray(b.options) && b.options.length) {
        const c = picks[k];
        if (c == null) { flat.push(Object.assign({}, b, { _pick: k })); break; }
        const o = b.options[c] || {};
        flat.push({ who: "me", text: o.text || "" });
        (o.beats || []).forEach(x => x && x.who !== "pick" && flat.push(x));
      } else flat.push(b);
      // 他的视角重读：在这一句后面插他心里的话
      if (inner && b.who !== "pick") (inner[sid] || []).filter(x => Number(x.at) === k && x.text).forEach(x => flat.push({ who: "inner", text: x.text }));
    }
    const beat = flat[Math.min(i, flat.length - 1)] || {};
    const atEnd = i >= flat.length - 1 && beat._pick == null;
    const locked = s => (Number(s.lv) || 1) > lv;
    // 下一幕：模型有时没写选项、或者选项的 go 对不上 id——那就按等级往下找下一节（不走隐藏的路），不让她卡在这儿
    const isFinal = () => atEnd && !(sec.choices || []).length && (sec.end || !nextOf(sec));
    const tap = () => { if (beat._pick != null) return; if (!atEnd) setI(i + 1); else if (isFinal()) onClose(); };   // 走到头了，点哪儿都是退出
    const nextOf = cur => { const L = Number(cur.lv) || 1; return secs.filter(x => !x.hidden && (Number(x.lv) || 1) > L).sort((a, b) => (Number(a.lv) || 1) - (Number(b.lv) || 1))[0] || null; };
    const who = beat.who === "he" ? char.name : beat.who === "me" ? meName : beat.who === "inner" ? char.name + " 心里" : "";
    return h("div", { "data-wk": "stampstory", className: "fixed inset-0 flex flex-col", style: { zIndex: 255, background: url ? "#111 center/cover no-repeat url(" + url + ")" : "linear-gradient(#2b2436,#14111b)" } },
      h("div", { className: "flex items-center", style: { padding: "calc(env(safe-area-inset-top) + 10px) 14px 8px", background: "linear-gradient(rgba(0,0,0,.55), transparent)" } },
        h("button", { onClick: onClose, className: "active:opacity-60", style: { color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "‹ 收起"),
        h("div", { className: "flex-1 text-center", style: { color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } }, sec.title || card.text.name),
        opts.length > 1 ? h("button", { "data-wk": "stampstorybg", onClick: nextBg, className: "active:opacity-60", style: { color: "#fff", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.5)" } }, "背景：" + curBg[1]) : h("span", { style: { width: 44 } })),
      h("div", { className: "flex-1", onClick: tap }),
      h("div", { "data-wk": "stampstorybox", onClick: tap,
        style: { margin: "0 12px calc(env(safe-area-inset-bottom) * 0.4 + 14px)", borderRadius: 14, background: "rgba(16,14,22,.82)", border: "1px solid rgba(255,255,255,.18)", padding: "14px 16px 30px", minHeight: 150, position: "relative", color: "#f4efe6" } },
        who ? h("div", { "data-wk": "stampstorywho", style: { display: "inline-block", marginBottom: 6, padding: "2px 10px", borderRadius: 999, background: beat.who === "he" ? RC.SSR : beat.who === "inner" ? "#577767" : "#6b6480", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))" } }, who) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.75, fontStyle: who && beat.who !== "inner" ? "normal" : "italic", opacity: who ? 1 : .85, whiteSpace: "pre-wrap" } }, h(BiText, { text: beat.text || "" })),
        beat._pick != null ? h("div", { className: "flex flex-col", style: { gap: 8, marginTop: 4 } },
          (beat.options || []).map((o, k) => h("button", { key: k, "data-wk": "stampstorychoice", "data-inline": "1", onClick: e => { e.stopPropagation(); setPicks(p => Object.assign({}, p, { [beat._pick]: k })); },
            style: { textAlign: "left", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.1)", color: "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, o.text))) : null,
        atEnd && (sec.choices || []).length ? h("div", { className: "flex flex-col", style: { gap: 8, marginTop: 12 } },
          sec.choices.map((c, k) => { const to = secs.find(s => s.id === c.go) || nextOf(sec); const lk = to && locked(to);
            return h("button", { key: k, "data-wk": "stampstorychoice", "data-locked": lk ? "1" : "0", onClick: e => { e.stopPropagation(); if (!to || lk) return; setSid(to.id); setI(0); },
              style: { textAlign: "left", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.3)", background: lk ? "transparent" : "rgba(255,255,255,.1)", color: lk ? "rgba(255,255,255,.45)" : "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } },
              to && to.hidden ? h("span", { "data-wk": "stampstorysecret", style: { marginRight: 6, color: "#e3b65c" } }, "✦") : null,
              c.text, lk ? h("span", { style: { marginLeft: 6, fontSize: "calc(11px * var(--app-fs, 1))" } }, "· 升到 " + to.lv + " 级才看得到") : null); })) : null,
        atEnd && !(sec.choices || []).length ? (() => { const nx = !sec.end && nextOf(sec);
          return nx ? h("button", { "data-wk": "stampstorychoice", "data-locked": locked(nx) ? "1" : "0", onClick: e => { e.stopPropagation(); if (locked(nx)) return; setSid(nx.id); setI(0); },
              style: { marginTop: 12, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.3)", background: locked(nx) ? "transparent" : "rgba(255,255,255,.1)", color: locked(nx) ? "rgba(255,255,255,.45)" : "#fff", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } },
              "下一幕：" + (nx.title || ""), locked(nx) ? h("span", { style: { marginLeft: 6, fontSize: "calc(11px * var(--app-fs, 1))" } }, "· 升到 " + nx.lv + " 级才看得到") : null)
            : h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", opacity: .7 } }, "—— 这条路走到头了 · 点一下退出 ——"); })() : null,
        !atEnd && beat._pick == null ? h("div", { "data-wk": "stampstorynext", style: { position: "absolute", right: 14, bottom: 10, fontSize: "calc(11px * var(--app-fs, 1))", opacity: .5 } }, "点一下继续 ▾") : null));
  }

  // 一张卡打开：卡面、名字、内容
  // 卡页＝养成页：上面是卡（光晕、稀有度章、星、邮戳编号），中间养成面板，底下「时刻回廊」一格一格往外还原那个瞬间
  function CardPage({ t, card, char, meName, onBack, onDraw, onRewrite, onSend, onCanon, onPoke, onInner, toast }) {
    // 满级两面都能画：他一个人（solo）、你们俩（duo）。旧卡只有 faceAlt＋faceAltMode，照它认
    const faces2 = Object.assign({}, card.faceAlt ? { [card.faceAltMode || "solo"]: card.faceAlt } : {}, card.faces || {});
    const url1 = useIdbImgUrl(card.face), urlSolo = useIdbImgUrl(faces2.solo || null), urlDuo = useIdbImgUrl(faces2.duo || null);
    const [side, setSide] = useState("main");         // main 第一面 / solo / duo
    const url = side === "solo" && urlSolo ? urlSolo : side === "duo" && urlDuo ? urlDuo : url1;
    const [full, setFull] = useState(false);
    const [reArm, setReArm] = useState(false);   // 重写整张卡要点两下：第一下变成「再点一次」，三秒内不点就回去           // 卡面全屏看，满级的在这里戳
    const [say, setSay] = useState(null), [poking, setPoking] = useState(false);
    const sayT = useRef(0);
    const [story, setStory] = useState(false);
    const [node, setNode] = useState(null);
    const [pop, setPop] = useState(0);
    const tx = C().cleanText ? C().cleanText(card.text, card.rarity) : card.text, lv = card.lv || 1;
    // 升级页：一本打开的集邮册。奶油纸底、象牙白的卡、鼠尾草绿的盖印面板、旧铜金的邮戳；稀有度只让邮票本身变特别，整页不跟着变
    const P = "#39382F", P7 = "rgba(57,56,47,.78)", P5 = "#827C6F", GOLD = "#285C4B", LINE = "rgba(87,119,103,.38)", COPPER = "#B58C55", FRAME = "#577767";
    const rcL = card.rarity === "R" ? P : RC[card.rarity];
    const stale = card.writing && Date.now() - Number(card.writingTs || 0) > (card.queued ? 1800000 : 180000);
    const S = C().load(), U = C().UNLOCK, ink = S.ink, cap = C().CAP[card.rarity] || 30;
    const starsAll = Math.round(cap / 10), stars = Math.min(starsAll, Math.floor(lv / 10));
    const tierFrom = Math.floor(lv / 10) * 10 || 1, nextGate = Math.min(cap, (Math.floor(lv / 10) + 1) * 10);
    const pct = lv >= cap ? 100 : Math.round((lv - tierFrom) / Math.max(1, nextGate - tierFrom) * 100);
    let toGate = 0; for (let l = lv; l < nextGate; l++) toGate += C().levelCost(card.rarity, l);
    const cost1 = C().levelCost(card.rarity, lv);
    const blockNow = C().gateBlocked(card, lv);
    const canPoke = card.rarity === "SSR" && lv >= cap && !!tx && !!url;
    const poke = async e => {
      const redo = e === "redo";
      const r = redo ? null : e.currentTarget.getBoundingClientRect(), y = redo ? 0.5 : (e.clientY - r.top) / r.height;
      const part = y < 0.34 ? "head" : y < 0.67 ? "heart" : "hand";
      // 每一面各有一套话：第一面、他一个人那面、你们俩那面（你们俩那面画里有她，他说的话也不一样）
      const pkKey = side === "duo" ? "pokesDuo" : side === "solo" ? "pokesSolo" : "pokes";
      let pk = card[pkKey];
      if (!pk || e === "redo") { if (poking) return; setPoking(true); try { pk = await onPoke(card, side); } catch (er) { pk = null; } setPoking(false); if (!pk) { toast("他没回上来，再戳一下试试"); return; } }
      if (redo) { setSay(null); toast("换好了，再戳戳看"); return; }
      const list = pk[part] && pk[part].length ? pk[part] : [].concat(pk.head || [], pk.heart || [], pk.hand || []);
      if (!list.length) return;
      // 同一处连着戳不重复上一句
      const pool = list.length > 1 && say ? list.filter(x => x !== say.text) : list;
      clearTimeout(sayT.current); setSay({ text: pool[Math.floor(Math.random() * pool.length)], part });
      sayT.current = setTimeout(() => setSay(null), 3200);
    };
    const up = steps => { const r = C().levelUp(card.id, steps); if (r.n) { setPop(Date.now()); toast("盖好了，到 " + r.lv + " 级"); } else if (r.msg) toast(r.msg); };
    const no = (S.cards || []).filter(c => c.charId === card.charId && !c.dupe).findIndex(c => c.id === card.id) + 1;   // 编号按人数：这是他的第几枚
    const got = new Date(card.ts || Date.now());
    const fs = n => "calc(" + n + "px * var(--app-fs, 1))";
    // 收进时刻：SR、SSR 才收（R 是他一个人的一刻，不是你们的）。只收已经解锁的那几段；IF 卡标明是哪个「如果」
    const keep = () => {
      if (!tx || card.shikeId) return;
      const parts = card.rarity === "SR" ? [tx.line ? "「" + tx.line + "」" : "", tx.open, lv >= U.SR.rest ? tx.rest : "", lv >= U.SR.sequel ? tx.sequel : ""]
        : [tx.line ? "「" + tx.line + "」" : "", ...((tx.sections || []).filter(x => (Number(x.lv) || 1) <= lv).map(x => (x.title ? x.title + "：" : "") + (x.beats || []).map(b => b.text || "").join("").slice(0, 300)))];
      const lines = parts.filter(Boolean).map(t => ({ role: "manual", text: String(t).slice(0, 600) }));
      const id = "pin_stamp_" + card.id;
      const all = loadJSON("x_shikePins", {}) || {};
      const row = { id, ts: card.ts || Date.now(), manual: true, stamp: card.id,
        title: (card.kind === "if" ? "IF「" + (card.theme || "") + "」· " : "") + (tx.name || "一枚邮票"),
        text: (lines[0] || {}).text || "", lines,
        summary: card.canon ? "这张当真了：那段算你们真的一起经历过。" : "",
        ...(card.face ? { imgKey: card.face } : {}) };
      all[card.charId] = [row].concat((all[card.charId] || []).filter(x => x.id !== id)).slice(0, 300);
      saveJSON("x_shikePins", all);
      const st = C().load(); st.cards = st.cards.map(c => c.id === card.id ? { ...c, shikeId: id } : c); C().save(st);
      toast("收进时刻了");
    };
    const para = s => h("div", { style: { fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.85, color: P, whiteSpace: "pre-wrap" } }, h(BiText, { text: s }));
    const quote = s => h("div", { style: { marginTop: 8, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: fs(14.5), color: P7 } }, "「", h(BiText, { text: s }), "」");
    // 回廊的格子：按时间排，从前一刻到他心里那句
    // SSR：走过哪几节、哪几个结局（路线图和结局章用）
    const markSeen = sid => { const st0 = C().load(); st0.cards = st0.cards.map(c => c.id === card.id ? { ...c, seen: Object.assign({}, c.seen, { [sid]: 1 }) } : c); C().save(st0); };
    const [innerBusy, setInnerBusy] = useState(false);
    const readHis = async () => {
      if (tx.inner) { setStory("his"); return; }
      setInnerBusy(true);
      try { const r = await onInner(card); if (r) setStory("his"); else toast("没回想出来，再点一次试试"); } catch (e) { toast("没回想出来：" + String(e && e.message || e).slice(0, 40)); }
      setInnerBusy(false);
    };
    const routeMap = () => {
      const secs = tx.sections || [], seen = card.seen || {};
      const ends = secs.filter(x => x.end || x.hidden), endSeen = ends.filter(x => seen[x.id]).length;
      const lvs = Array.from(new Set(secs.map(x => Number(x.lv) || 1))).sort((a, b) => a - b);
      return h("div", { "data-wk": "stamproute", style: { marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "#FFF8E9", border: "1px solid " + LINE } },
        h("div", { className: "flex items-center justify-between" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13), color: GOLD } }, "✦ 路线"),
          h("div", { "data-wk": "stampends", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: P7 } }, "结局 " + endSeen + " / " + ends.length + "  ", ends.map((x, k) => h("span", { key: k, style: { marginLeft: 3, color: seen[x.id] ? "#b23a2e" : "rgba(130,124,111,.4)" } }, seen[x.id] ? "◉" : "○")))),
        lvs.map(L => h("div", { key: L, className: "flex items-center", style: { gap: 6, marginTop: 8 } },
          h("span", { style: { width: 34, flexShrink: 0, fontFamily: F_BODY, fontSize: fs(10), color: P5 } }, "Lv." + L),
          h("div", { className: "flex flex-wrap", style: { gap: 6 } }, secs.filter(x => (Number(x.lv) || 1) === L).map(x => { const s1 = !!seen[x.id], lk = L > lv;
            return h("button", { key: x.id, "data-wk": "stamproutenode", "data-seen": s1 ? "1" : "0", onClick: () => lk ? toast("升到 " + L + " 级才看得到") : setStory(x.id), className: "active:opacity-70",
              style: { padding: "3px 9px", borderRadius: 999, fontFamily: F_BODY, fontSize: fs(11), border: "1px " + (s1 ? "solid " + GOLD : "dashed rgba(130,124,111,.5)"), background: s1 ? GOLD : "transparent", color: s1 ? "#FFF8E9" : P5 } },
              x.hidden && !s1 ? "？" : (x.title || x.id) + (x.end && !x.hidden ? " ◇" : "")); })))),
        ends.length && endSeen >= ends.length && tx.allEndsLine ? h("div", { style: { marginTop: 10, paddingTop: 8, borderTop: "1px dashed " + LINE } }, quote(tx.allEndsLine)) : null);
    };
    const nodes = !tx ? [] : card.rarity === "R" ? [
        { k: "before", zh: "前一刻", lv: U.R.before, body: tx.before && h("div", null, para(tx.before.narration || ""), tx.before.thought ? quote(tx.before.thought) : null), peek: tx.before && tx.before.narration },
        { k: "now", zh: "那一刻", lv: 1, body: h("div", null, para(tx.narration || ""), tx.thought ? quote(tx.thought) : null), peek: tx.narration },
        { k: "after", zh: "后一刻", lv: U.R.after, body: tx.after && h("div", null, para(tx.after.narration || ""), tx.after.thought ? quote(tx.after.thought) : null), peek: tx.after && tx.after.narration },
        { k: "real", zh: "他真正想说的", lv: U.R.real, body: tx.real && quote(tx.real), peek: tx.real },
        { k: "sound", zh: "那时的声音", lv: U.R.sound, opt: 1, body: tx.sound && para(tx.sound), peek: tx.sound },
        { k: "back", zh: "邮票背面", lv: 1, opt: 1, body: tx.back && quote(tx.back), peek: tx.back }]
      : card.rarity === "SR" ? [
        { k: "open", zh: "开头", lv: 1, body: para(tx.open || ""), peek: tx.open },
        { k: "rest", zh: "接着", lv: U.SR.rest, body: tx.rest && para(tx.rest), peek: tx.rest },
        { k: "sequel", zh: "后来", lv: U.SR.sequel, body: tx.sequel && para(tx.sequel), peek: tx.sequel },
        { k: "hidden", zh: "没说出口的", lv: U.SR.hidden, body: tx.hidden && quote(tx.hidden), peek: tx.hidden },
        { k: "his", zh: "他记得的", lv: U.SR.his, opt: 1, body: tx.his && para(tx.his), peek: tx.his },
        { k: "keep", zh: "留下的东西", lv: 1, opt: 1, body: tx.keepsake && tx.keepsake.name && h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(15), color: P } }, "「" + tx.keepsake.name + "」"), para(tx.keepsake.desc || "")), peek: tx.keepsake && tx.keepsake.name }]
      : ((tx.sections || []).map((s, i) => ({ k: s.id || "s" + i, zh: s.title || "第 " + (i + 1) + " 节", lv: Number(s.lv) || 1, ssr: true,
          peek: ((s.beats || [])[0] || {}).text || "" })));
    const nodesShown = nodes.filter(n => !n.opt || n.peek);   // 早先写的卡没有这几样，就不摆空格子
    const openNode = nodesShown.find(n => n.k === node) || nodesShown.find(n => n.lv <= lv && n.k === "now") || nodesShown.find(n => n.lv <= lv);
    const frame = card.rarity === "SSR" ? "0 0 0 2px " + COPPER + ", 0 0 0 5px #FFF8E9, 0 0 0 6.5px " + COPPER : card.rarity === "SR" ? "0 0 0 1.5px " + COPPER : "0 0 0 1px " + FRAME;
    const ring = frame + ", 0 10px 26px rgba(57,56,47," + (0.16 + stars * 0.05) + ")" + (stars >= starsAll && stars ? ", 0 0 30px rgba(181,140,85,.45)" : "");
    return h("div", { "data-wk": "stampcard", "data-page": "1", className: "h-full flex flex-col overflow-hidden", style: { background: "radial-gradient(rgba(130,124,111,.07) 1px, transparent 1.2px) 0 0 / 5px 5px, radial-gradient(120% 60% at 50% 0%, #F6F0E2, #F1EAD9 60%, #EAE1CD)" } },
      h("style", null, "@keyframes stHalo{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.9;transform:scale(1.06)}}@keyframes stFloat{0%{transform:translateY(0)}35%{transform:translateY(-10px)}100%{transform:translateY(0)}}@keyframes stStampDown{0%{transform:rotate(-14deg) scale(1.9);opacity:0}100%{transform:rotate(-14deg) scale(1);opacity:1}}@keyframes stShine{0%{background-position:-200% 0}100%{background-position:200% 0}}"),
      h(Head, { zh: tx ? tx.name : "一枚邮票", sub: card.rarity + " · " + (char ? char.name : "") + (card.kind === "if" ? " · IF「" + (card.theme || "") + "」" : card.kind === "bday" ? " · 生日限定" : card.kind === "mybday" ? " · 你的生日" : " · 日常"), bg: "transparent", ink: P, onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        // 卡
        h("div", { "data-wk": "stampshow", className: "flex flex-col items-center", style: { position: "relative", paddingTop: 14 } },
          h("div", { style: { position: "absolute", top: 0, left: "50%", width: 320, height: 380, marginLeft: -160, borderRadius: 999, background: "radial-gradient(closest-side, " + (card.rarity === "R" ? "rgba(47,42,34,.16)" : RC[card.rarity] + "44") + ", transparent)", animation: "stHalo 4s ease-in-out infinite", pointerEvents: "none" } }),
          h("div", { key: pop, style: { position: "relative", boxShadow: ring, animation: pop ? "stFloat .9s ease-out" : "none" } },
            h(Stamp, { t, card, face: url, size: 236 }),
            // 满级 SSR 能戳：上面三分之一是头，中间是胸口，下面是手
            url ? h("div", { onClick: () => setFull(true), style: { position: "absolute", inset: 0, cursor: "zoom-in" } }) : null,
            pop ? h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(110deg, transparent 35%, rgba(255,240,200,.55) 50%, transparent 65%) 0 0 / 200% 100%", animation: "stShine .9s ease-out 1 forwards" } }) : null,
            h("div", { "data-wk": "stampbadge", style: { position: "absolute", left: "50%", top: -13, transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "3px 12px", borderRadius: 999, background: card.rarity === "SSR" ? "linear-gradient(135deg,#d9b57c,#B58C55)" : card.rarity === "SR" ? "#B58C55" : FRAME, color: "#FFF8E9", fontFamily: F_DISPLAY, fontSize: fs(12), letterSpacing: ".08em", boxShadow: "0 2px 6px rgba(57,56,47,.25)" } }, card.rarity + " · " + (card.rarity === "SSR" ? "急件" : card.rarity === "SR" ? "挂号" : "平信")),
            !url ? h("div", { "data-wk": "stampblank", style: { position: "absolute", inset: 6, borderRadius: 2, overflow: "hidden", pointerEvents: "none",
                background: "repeating-linear-gradient(135deg, rgba(122,106,82,.05) 0 2px, transparent 2px 9px), radial-gradient(circle at 50% 42%, #fbf5e6, #ece1c8 75%)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#5a4a32" } },
              h("div", { style: { position: "absolute", inset: 10, border: "1px solid rgba(122,106,82,.22)", borderRadius: 2 } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: fs(10), letterSpacing: ".4em", opacity: .55 } }, card.kind === "if" ? "如 果" : card.kind === "bday" || card.kind === "mybday" ? "生 日" : "日 常"),
              h("div", { style: { marginTop: 10, fontFamily: F_DISPLAY, fontSize: fs(26), letterSpacing: ".12em" } }, tx ? tx.name : "……"),
              h("div", { style: { width: 36, height: 1, margin: "12px 0", background: "rgba(122,106,82,.4)" } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), opacity: .7 } }, char ? (char.remark || char.name) : ""),
              h("div", { style: { marginTop: 18, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: fs(12), opacity: .45 } }, card.drawing ? "正在显影……" : "这一刻还没显影"),
              h("div", { style: { position: "absolute", left: 16, bottom: 14, fontFamily: F_BODY, fontSize: fs(9.5), opacity: .55 } }, "第 " + String(no).padStart(3, "0") + " 枚")) : null,
            h("div", { key: "pm" + pop, "data-wk": "stamppostmark", style: { position: "absolute", right: 14, bottom: 14, width: 54, height: 54, borderRadius: 999, border: "1.5px solid " + (url ? "rgba(255,248,233,.9)" : COPPER), color: url ? "rgba(255,248,233,.95)" : COPPER, transform: "rotate(-14deg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: fs(8.5), lineHeight: 1.25, pointerEvents: "none", animation: pop ? "stStampDown .45s cubic-bezier(.3,1.6,.5,1)" : "none" } },
              card.bdDay ? h(React.Fragment, null, h("div", null, "生日纪念"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(10) } }, (d => d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate())(new Date(card.bdDay))))
                : h(React.Fragment, null, h("div", null, got.getFullYear() + "." + (got.getMonth() + 1) + "." + got.getDate()), h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(11) } }, "Lv." + lv)))),
          h("div", { className: "flex items-center", style: { marginTop: 16, gap: 10, width: "100%" } },
            h("div", { style: { flex: 1, height: 1, background: "linear-gradient(90deg, transparent, " + LINE + ")" } }),
            h("div", { "data-wk": "stampstars", style: { letterSpacing: ".35em", fontSize: fs(16), color: GOLD, textShadow: stars ? "0 0 8px rgba(47,93,74,.6)" : "none" } }, Array.from({ length: starsAll }, (_, i) => i < stars ? "★" : "☆").join("")),
            h("div", { style: { flex: 1, height: 1, background: "linear-gradient(270deg, transparent, " + LINE + ")" } })),
          tx ? h("div", { className: "flex flex-wrap justify-center", style: { gap: 8, marginTop: 10 } },
            h("button", { "data-wk": "stampsend", onClick: () => onSend(card), className: "active:opacity-70", style: { padding: "6px 14px", borderRadius: 999, border: "1px solid " + LINE, color: P, fontFamily: F_BODY, fontSize: fs(12) } }, card.sentTs ? "✉ 再发给他看" : "✉ 发给他看"),
            card.rarity === "SSR" && card.kind === "if" && card.sentTs && !card.canon && lv >= cap ? h("button", { "data-wk": "stampcanon", onClick: () => onCanon(card), className: "active:opacity-70", style: { padding: "6px 14px", borderRadius: 999, background: RC.SSR, color: "#fff", fontFamily: F_BODY, fontSize: fs(12) } }, "当真") : null,
            card.rarity === "R" && tx ? (() => { const S0 = C().load(), d = dayOf(card.ts), cur = weekDays(S0, card.charId).find(x => x.day === d);
              if (!cur || cur.n < 2) return null;
              const on = cur.card.id === card.id;
              return h("button", { "data-wk": "stampdaypick", disabled: on, onClick: () => { const s2 = C().load(); const wp = Object.assign({}, (s2.opt || {}).weekPick); wp[card.charId] = Object.assign({}, wp[card.charId], { [d]: card.id }); s2.opt = Object.assign({}, s2.opt, { weekPick: wp }); C().save(s2); toast("换好了：这张就是那天的一刻"); },
                className: "active:opacity-70", style: { padding: "6px 14px", borderRadius: 999, border: "1px solid " + LINE, color: on ? P5 : P, fontFamily: F_BODY, fontSize: fs(12) } }, on ? "这天的一刻就是它" : "就它当那天的一刻"); })() : null,
            card.rarity !== "R" ? h("button", { "data-wk": "stampkeep", disabled: !!card.shikeId, onClick: keep, className: "active:opacity-70", style: { padding: "6px 14px", borderRadius: 999, border: "1px solid " + LINE, color: card.shikeId ? P5 : P, fontFamily: F_BODY, fontSize: fs(12) } }, card.shikeId ? "已收进时刻" : "☆ 收进时刻") : null,
            card.canon ? h("span", { style: { alignSelf: "center", fontFamily: F_BODY, fontSize: fs(11.5), color: GOLD } }, "已当真") : null) : null,
          !card.face ? h("button", { "data-wk": "stampdraw", disabled: !tx || card.drawing, onClick: () => onDraw(card.id), className: "active:opacity-70 disabled:opacity-40",
            style: { marginTop: 8, padding: "6px 14px", borderRadius: 999, border: "1px solid " + LINE, color: P7, fontFamily: F_BODY, fontSize: fs(12) } }, card.drawing ? "画着…" : "画卡面 · 花一次生图")
            : h("button", { "data-wk": "stampredraw", disabled: card.drawing, onClick: () => onDraw(card.id, side !== "main", side !== "main" ? side : undefined), className: "active:opacity-70 disabled:opacity-40",
              style: { marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "1px solid " + LINE, color: P7, fontFamily: F_BODY, fontSize: fs(12) } }, card.drawing ? "重画着…" : "↻ 照原来的描述重画这一面 · 花一次生图"),
          card.drawErr && !card.drawing ? h("div", { "data-wk": "stampdrawerr", style: { marginTop: 6, maxWidth: 300, textAlign: "center", fontFamily: F_BODY, fontSize: fs(11), lineHeight: 1.5, color: "#b23a2e" } }, "上次没画成：" + card.drawErr) : null,
          // SSR 满级：第二张卡面（一个人，或者你们俩），画好以后能翻面
          card.rarity === "SSR" && lv >= cap && tx ? h("div", { "data-wk": "stampalt", className: "flex flex-wrap justify-center", style: { gap: 8, marginTop: 8 } },
            side !== "main" ? h("button", { onClick: () => setSide("main"), className: "active:opacity-70", style: { padding: "6px 12px", borderRadius: 8, border: "1px solid " + COPPER, color: COPPER, fontFamily: F_BODY, fontSize: fs(12) } }, "看第一面") : null,
            [["solo", "他一个人"], ["duo", "你们俩"]].map(x => faces2[x[0]]
              ? (side === x[0] ? null : h("button", { key: x[0], onClick: () => setSide(x[0]), className: "active:opacity-70", style: { padding: "6px 12px", borderRadius: 8, background: COPPER, color: "#FFF8E9", fontFamily: F_BODY, fontSize: fs(12) } }, "看满级 · " + x[1]))
              : h("button", { key: x[0], disabled: card.drawing, onClick: () => { setSide(x[0]); onDraw(card.id, true, x[0]); }, className: "active:opacity-70 disabled:opacity-40",
                style: { padding: "6px 12px", borderRadius: 8, border: "1px dashed " + COPPER, color: COPPER, fontFamily: F_BODY, fontSize: fs(12) } }, "画满级卡面 · " + x[1]))) : null,
          tx && !card.writing ? h("button", { "data-wk": "stamprewrite", onClick: () => {
              if (!reArm) { setReArm(true); setTimeout(() => setReArm(false), 3000); return; }
              setReArm(false);
              const st0 = C().load(); st0.cards = st0.cards.map(c => c.id === card.id ? Object.assign({}, c, { seen: {}, pokes: null, pokesSolo: null, pokesDuo: null }) : c); C().save(st0);
              onRewrite(card); toast("在重写这张：文字、分镜都换新的，写好以后点「重画」让卡面也跟上");
            }, className: "active:opacity-70", style: { marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "1px " + (reArm ? "solid #b23a2e" : "dashed " + LINE), color: reArm ? "#b23a2e" : P5, fontFamily: F_BODY, fontSize: fs(12) } },
            reArm ? "再点一次：原来的文字会被换掉" : "✎ 重写这张卡（文字和分镜）· 花一次调用") : null,
          url ? h("div", { style: { marginTop: 6, fontFamily: F_BODY, fontSize: fs(11), color: P5 } }, canPoke ? "点卡面全屏看，满级了能戳他（头、胸口、手）" : "点卡面全屏看") : null),
        // 养成
        tx ? h("div", { "data-wk": "stampgrow", style: { marginTop: 16, padding: "14px 16px", borderRadius: 16, border: "1px solid rgba(87,119,103,.22)", background: "#E2E7DA", boxShadow: "0 2px 10px rgba(57,56,47,.06)" } },
          h("div", { className: "flex items-center justify-between" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14), color: GOLD } }, "✦ 盖印"),
            h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: P7 } }, "手上印泥 " + ink)),
          h("div", { style: { marginTop: 8, textAlign: "center", fontFamily: F_DISPLAY, fontSize: fs(22), color: P, letterSpacing: ".04em" } }, lv >= cap ? "Lv." + cap + " · 满了" : h(React.Fragment, null, "Lv." + lv, h("span", { style: { color: GOLD, margin: "0 12px", fontSize: fs(16) } }, "→"), h("span", { style: { color: GOLD } }, "Lv." + (lv + 1)))),
          h("div", { className: "flex justify-between", style: { marginTop: 10, fontFamily: F_BODY, fontSize: fs(10.5), color: P5 } }, h("span", null, "Lv." + tierFrom), h("span", null, lv >= cap ? "满级" : "Lv." + nextGate + (nextGate % 10 === 0 ? " 过坎" : ""))),
          h("div", { style: { position: "relative", marginTop: 4, height: 14, borderRadius: 999, background: "rgba(57,131,107,.14)", overflow: "hidden", border: "1px solid rgba(57,131,107,.25)" } },
            h("div", { style: { width: Math.max(4, pct) + "%", height: "100%", borderRadius: 999, background: "#39836B", boxShadow: "none", transition: "width .5s" } }),
            h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: fs(9.5), color: P, textShadow: "none" } }, lv + " / " + nextGate)),
          lv < cap ? h(React.Fragment, null,
            blockNow ? h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: fs(12), color: "#9db8ef" } }, blockNow) : null,
            h("div", { "data-wk": "stamplevel", className: "flex", style: { gap: 8, marginTop: 12 } },
              h("button", { onClick: () => up(1), disabled: !!blockNow, className: "flex-1 flex flex-col items-center justify-center active:opacity-70 disabled:opacity-40", style: { minHeight: 50, borderRadius: 16, background: "#285C4B", color: "#f6efe0", boxShadow: "0 4px 16px rgba(47,93,74,.35)" } },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: fs(15) } }, "盖一枚印"), h("span", { style: { fontFamily: F_BODY, fontSize: fs(10.5), opacity: .7 } }, "消耗印泥 " + cost1)),
              nextGate - lv > 1 ? h("button", { onClick: () => up(nextGate - lv), disabled: !!blockNow, className: "flex-1 flex flex-col items-center justify-center active:opacity-70 disabled:opacity-40", style: { minHeight: 50, borderRadius: 16, border: "1px solid " + GOLD, color: GOLD } },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: fs(14) } }, "一键盖到 " + nextGate + " 级"), h("span", { style: { fontFamily: F_BODY, fontSize: fs(10.5), opacity: .75 } }, "共消耗 " + toGate)) : null)) : null) : null,
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
            nodesShown.map((n, i) => { const lock = n.lv > lv, on = openNode && openNode.k === n.k;
              const left = lock ? (() => { let c = 0; for (let l = lv; l < n.lv; l++) c += C().levelCost(card.rarity, l); return c; })() : 0;
              return h("button", { key: n.k, "data-wk": "stampnode", "data-locked": lock ? "1" : "0", "data-on": on ? "1" : "0", onClick: () => lock ? toast("升到 " + n.lv + " 级才看得到") : n.ssr ? setStory(n.k) : setNode(n.k), className: "shrink-0 text-left active:opacity-80",
                style: { position: "relative", width: 136, minHeight: 150, padding: "11px 12px", borderRadius: 12, overflow: "hidden",
                  border: on ? "1.5px solid " + COPPER : lock ? "1px dashed rgba(130,124,111,.55)" : "1px solid " + FRAME,
                  background: on ? "#E8D8B8" : lock ? "#E7E0CF" : "#FFF8E9",
                  boxShadow: on ? "0 4px 14px rgba(181,140,85,.25)" : "none", display: "flex", flexDirection: "column", gap: 5 } },
                h("div", { className: "flex items-center justify-between" },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: fs(18), color: lock ? P5 : GOLD, opacity: lock ? .6 : 1 } }, String(i + 1).padStart(2, "0")),
                  h("span", { style: { fontFamily: F_BODY, fontSize: fs(9.5), padding: "1px 7px", borderRadius: 999, background: on ? GOLD : "transparent", border: on ? "none" : "1px solid " + LINE, color: on ? "#FFF8E9" : P5 } }, on ? "正在看" : lock ? "🔒 未解锁" : "已解锁")),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14), color: on ? GOLD : lock ? P5 : P } }, n.zh),
                h("div", { style: { fontFamily: F_BODY, fontSize: fs(11), lineHeight: 1.55, color: lock ? "rgba(47,42,34,.38)" : P7, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" } },
                  lock ? "Lv." + n.lv + " 解锁「" + n.zh + "」" : (n.peek || "")),
                lock ? h("div", { style: { marginTop: "auto", fontFamily: F_BODY, fontSize: fs(10), color: GOLD, opacity: .8 } }, n.lv > 30 && !card.sentTs ? "过 30 级要先发给他看" : "再盖 " + (n.lv - lv) + " 枚 · 印泥 " + left) : null); })),

          card.rarity === "SSR" ? routeMap() : null,
          card.rarity === "SSR" && lv >= cap ? h("button", { "data-wk": "stamphisview", disabled: innerBusy, onClick: () => readHis(), className: "w-full active:opacity-70 disabled:opacity-50", style: { marginTop: 10, minHeight: 40, borderRadius: 12, border: "1px solid " + FRAME, color: FRAME, fontFamily: F_BODY, fontSize: fs(13) } },
            innerBusy ? "他在回想那时候在想什么…" : tx.inner ? "换他的视角重读" : "换他的视角重读 · 花一次调用") : null,
          card.rarity === "SSR" ? h("button", { "data-wk": "stampstoryopen", onClick: () => setStory(true), className: "w-full active:opacity-70", style: { marginTop: 14, minHeight: 44, borderRadius: 12, background: RC.SSR, color: "#fff", fontFamily: F_BODY, fontSize: fs(14) } }, "进入剧情")
            : openNode && openNode.body ? h("div", { "data-wk": "stampbox", style: { marginTop: 12, padding: "14px 16px", borderRadius: 14, border: "1px solid " + FRAME, background: "#FFF8E9" } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13), color: GOLD, marginBottom: 8 } }, openNode.zh), openNode.body) : null) : null),
      // 全屏看卡面：点空白处收起；满级 SSR 在这里戳——他的话固定在底下那个框里，不跟着手指跳
      full && url ? h("div", { "data-wk": "stampfull", className: "fixed inset-0 flex flex-col", onClick: () => setFull(false), style: { zIndex: 256, background: "rgba(20,18,14,.92)" } },
        h("div", { className: "flex-1 min-h-0 flex items-center justify-center", style: { padding: "calc(env(safe-area-inset-top) + 16px) 16px 8px" } },
          h("div", { style: { position: "relative", display: "inline-block", lineHeight: 0 } },
            h("img", { src: url, alt: "", style: { display: "block", maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100dvh - 190px)", width: "auto", height: "auto", borderRadius: 4, boxShadow: "0 0 0 3px #FFF8E9, 0 0 0 5px " + COPPER } }),
            canPoke ? h("div", { "data-wk": "stamppoke", onClick: e => { e.stopPropagation(); poke(e); }, style: { position: "absolute", inset: 0, cursor: "pointer" } }) : null)),
        h("div", { "data-wk": "stamppokesay", onClick: e => e.stopPropagation(), style: { margin: "0 16px calc(env(safe-area-inset-bottom) * 0.4 + 16px)", minHeight: 72, padding: "12px 16px", borderRadius: 14, background: "#FFF8E9", border: "1px solid " + COPPER, color: P, fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.7 } },
          canPoke ? (poking ? h("span", { style: { color: P5 } }, "他在想怎么回你…") : say ? h(React.Fragment, null, h("div", { style: { fontSize: fs(10.5), color: COPPER, marginBottom: 2 } }, (char ? char.name : "") + (say.part === "head" ? " · 被戳了头" : say.part === "heart" ? " · 被戳了胸口" : " · 被戳了手")), say.text)
            : h("span", { style: { color: P5 } }, "戳戳他：上面是头，中间是胸口，下面是手。点外面收起。"))
            : h("span", { style: { color: P5 } }, card.rarity === "SSR" ? "这张升满 " + cap + " 级以后，点卡面能戳他（头、胸口、手）。点外面收起。" : "点外面收起。"),

          // 最底下一排：左边保存原图，右边（满级戳过的）换一批话
          h("div", { className: "flex items-center justify-between", style: { marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(181,140,85,.35)" } },
            h("button", { "data-wk": "stampsaveimg", onClick: e => { e.stopPropagation(); const key = side === "solo" ? faces2.solo : side === "duo" ? faces2.duo : card.face;
                (window.saveImgOriginal ? window.saveImgOriginal(key, (tx && tx.name) || "邮票卡面") : Promise.resolve(false)).then(ok => { if (!ok) toast("这张取不到原图"); }); },
              className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: GOLD, border: "1px solid " + GOLD, borderRadius: 999, padding: "3px 10px" } }, "⬇ 保存原图"),
            canPoke && card[side === "duo" ? "pokesDuo" : side === "solo" ? "pokesSolo" : "pokes"] && !poking ? h("button", { "data-wk": "stamppokeredo", onClick: e => { e.stopPropagation(); poke("redo"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: COPPER, border: "1px solid " + COPPER, borderRadius: 999, padding: "3px 10px" } }, "↻ 这一面换一批话 · 花一次调用") : null))) : null,
      story && tx ? h(StoryReader, { t, card, char, meName, lv, start: typeof story === "string" && story !== "his" ? story : null, inner: story === "his" ? tx.inner : null, onSeen: markSeen, onClose: () => setStory(false) }) : null);
  }

  // 他的一周：按天算。每天抽到的 R 只取一张当「那天的一刻」——默认那天第一张写好的，她可以换；攒够七个不同的日子算一周
  const dayOf = ts => { const d = new Date(ts || 0); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  function weekDays(st, charId) {
    const pick = ((st.opt || {}).weekPick || {})[charId] || {}, by = {};
    (st.cards || []).filter(c => c.charId === charId && c.rarity === "R" && c.text && !c.dupe).sort((x, y) => (x.ts || 0) - (y.ts || 0))
      .forEach(c => { const k = dayOf(c.ts); (by[k] = by[k] || []).push(c); });
    return Object.keys(by).map(k => ({ day: k, ts: by[k][0].ts, card: by[k].find(c => c.id === pick[k]) || by[k][0], n: by[k].length, all: by[k] })).sort((a, b) => a.ts - b.ts);
  }
  // 「他的一周」里那枚小邮票：画了卡面就是卡面缩略图；没画就印卡名第一个字，底下一层淡淡的斜纹
  function WeekThumb({ card, size }) {
    const url = useIdbImgUrl(card && card.face);
    const w = size || 44, hh = Math.round(w * 1.3), col = card.kind === "bday" ? "#8a3a4a" : card.kind === "if" ? "#B58C55" : "#577767";
    return h("div", { style: { flexShrink: 0, width: w, height: hh, padding: 3, background: "radial-gradient(circle at 3px 3px, transparent 2.2px, #fbf6ea 2.6px) -3px -3px / 6px 6px", filter: "drop-shadow(0 1px 2px rgba(57,56,47,.2))" } },
      h("div", { style: { width: "100%", height: "100%", border: "1px solid " + col, background: url ? "#222 center/cover no-repeat url(" + url + ")" : "repeating-linear-gradient(135deg, " + col + "14 0 2px, transparent 2px 7px), #F6EEDC",
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: Math.round(w * 0.42), color: col } }, url ? null : String((card.text && card.text.name) || "·").slice(0, 1)));
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
    const [albumRar, setAlbumRar] = useState("all");
    const [week, setWeek] = useState(false);
    const [wkOpen, setWkOpen] = useState("");   // 「他的一周」里展开了哪一天的其他几张   // 他的一周：同一个人写好的 R 每攒够七张，按时间排成一页（第几周）   // 全部 / SSR / SR / R / bad（没写好）
    const [gotNote, setGotNote] = useState([]);
    const [cfg, setCfg] = useState(false);
    const [giftOpen, setGiftOpen] = useState(false);
    const testTap = useRef({ n: 0, t: 0 });
    const [begging, setBegging] = useState(false), [begLine, setBegLine] = useState("");
    const [paintDraft, setPaintDraft] = useState(null);
    useEffect(() => { const f = () => setSt(C().load()); window.addEventListener("stamps-change", f); return () => window.removeEventListener("stamps-change", f); }, []);
    // 早先写的卡里带着「(R)」「(SR)」的，打开邮票册时洗一遍存回去（只动带标记或错栏的那几张）
    useEffect(() => { try { const st0 = C().load(); let n = 0;
      st0.cards = st0.cards.map(c => { if (!c.text || c.rarity === "SSR" && !/[（(]\s*S?S?R\s*[）)]/.test(JSON.stringify(c.text))) return c; const t2 = C().cleanText(c.text, c.rarity); if (JSON.stringify(t2) === JSON.stringify(c.text)) return c; n++; return Object.assign({}, c, { text: t2 }); });
      if (n) C().save(st0); } catch (e) {} }, []);
    useEffect(() => { const got = C().grantOnOpen(Date.now(), characters.map(c => { const w = c.birthday ? C().bdayWindow(c.birthday, Date.now()) : null; return w ? { id: c.id, name: c.remark || c.name, year: w.year } : null; }).filter(Boolean)
      .concat((props.myBdays || []).map(m => { const w = m.birthday ? C().bdayWindow(m.birthday, Date.now()) : null; return w ? { id: "me_" + m.id, name: "你（" + (m.name || "你") + "）", year: w.year } : null; }).filter(Boolean))); if (got.length) { setGotNote(got); setSt(C().load()); } }, []);
    const lims = C().activeLimited(Date.now());
    // 生日池：他生日前 14 天出现，生日后留 7 天；保底和求情按「这个人这一年」单独记
    const bds = characters.map(c => { const w = c.birthday ? C().bdayWindow(c.birthday, Date.now()) : null; return w ? { char: c, win: w, key: c.id + "_" + w.year } : null; }).filter(Boolean)
      // 她自己的生日池：每张面具一个，抽的是认这张面具的那几个人；卡都是你们俩的
      .concat((props.myBdays || []).map(m => { const w = m.birthday ? C().bdayWindow(m.birthday, Date.now()) : null; const ids = (m.charIds || []).filter(id => characters.some(c => c.id === id));
        return w && ids.length ? { char: { id: "me_" + m.id, name: m.name || "你", remark: m.name || "你", avatar: m.avatar }, win: w, key: "me_" + m.id + "_" + w.year, mine: true, maskId: m.id, charIds: ids } : null; }).filter(Boolean));
    const bd = pool.indexOf("bd:") === 0 ? bds.find(b => "bd:" + b.char.id === pool) : null;
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
    const mbOne = bd && bd.mine && bd.charIds.includes((opt.limOne || {})["me:" + bd.maskId]) ? opt.limOne["me:" + bd.maskId] : "";   // 她的生日池：可以只抽一个人
    const limOne = lim && (opt.limOne || {})[lim.id] && limIds.includes(opt.limOne[lim.id]) ? opt.limOne[lim.id] : "";

    // 求情：他回一句话（花一次调用），回到了就记下，下一张一定出
    const doBeg = async () => {
      if (!bd || begging) return; setBegging(true);
      try { const line = props.onBeg ? await props.onBeg(bd.char) : ""; if (line) { C().markBeg(bd.key); setBegLine((bd.char.remark || bd.char.name) + "：" + line); } else toast("他没回上来，再试一次"); }
      catch (e) { toast("他没回上来：" + String(e && e.message || e).slice(0, 40)); }
      setBegging(false);
    };
    const doPull = async (n, ticket) => {
      const s = C().load();
      if (pool === "char" && !charTheme.trim()) { toast("先给 TA 写一个主题"); return; }
      if (pool === "char" && (thDraft != null || thLineDraft != null)) s.opt = Object.assign({}, s.opt, { charTheme: Object.assign({}, s.opt.charTheme, { [charId]: charTheme }), charThemeLine: Object.assign({}, s.opt.charThemeLine, { [charId]: charThemeLine }) });
      const pool0 = bd ? (bd.mine ? (mbOne ? [mbOne] : bd.charIds) : [bd.char.id]) : pool === "mix" ? mixIds : pool === "char" ? [charId] : (lim ? (limOne ? [limOne] : limIds) : []);
      if (!pool0.length) { toast("先挑几个角色"); return; }
      const how = opt.testInf ? "test" : C().pay(s, n, ticket);   // 测试券：她自己试味道用，藏在设置里连点七下「规则」
      if (!how) { toast("邮资不够：单抽 " + C().PRICE_ONE + "，十连 " + C().PRICE_TEN + "。多聊聊天就攒起来了"); return; }
      const now = Date.now(), cards = [];
      for (let i = 0; i < n; i++) {
        const rar = bd ? C().rollRarity(s, { bday: bd.key, isDay: bd.win.isDay }) : C().rollRarity(s);
        // 出了 SSR、池里又不止一个人：八成落到这池里 SSR 最少的人身上（限定池一期一人一张，免得老抽到重复；大混池先补齐、再补张数少的）
        let cid = pool0[Math.floor(Math.random() * pool0.length)];
        if (rar === "SSR" && pool0.length > 1) {
          const have = id => s.cards.concat(cards).filter(x => x.rarity === "SSR" && !x.dupe && x.charId === id && (lim ? x.limited === lim.id : bd ? (x.pool === (bd.mine ? "mybday" : "bday") && x.bdDay === bd.win.day) : pool === "mix" ? x.pool === "mix" : true));
          // 谁在这池里的 SSR 最少就先补谁（都有了以后也一样：先补张数少的）
          const cnt = {}; pool0.forEach(id => { cnt[id] = have(id).length; });
          const least = Math.min.apply(null, pool0.map(id => cnt[id])), fresh = pool0.filter(id => cnt[id] === least);
          if (fresh.length && Math.random() < 0.8) cid = fresh[Math.floor(Math.random() * fresh.length)];
        }
        const card = { id: uid(), ts: now + i, rarity: rar, charId: cid, lv: 1, pool: bd ? (bd.mine ? "mybday" : "bday") : pool === "char" ? "char" : lim ? "limited" : "mix",
          kind: bd ? (bd.mine ? "mybday" : "bday") : pool === "mix" ? "daily" : "if", writing: true, writingTs: now };
        if (pool === "char") Object.assign(card, { theme: charTheme.trim().slice(0, 40), themeLine: charThemeLine.slice(0, 200), ifMode });
        if (bd) Object.assign(card, { bdDay: bd.win.day }, bd.mine ? { maskId: bd.maskId } : {});
        if (lim) Object.assign(card, { theme: lim.name, themeLine: lim.line, limited: lim.id, ifMode });
        // 限定（限时池一期、生日池一年）每人只有一张 SSR：再抽到就是重复，不写新卡，折成印泥
        const same = rar === "SSR" && (lim || bd) ? s.cards.concat(cards).find(x => x.rarity === "SSR" && !x.dupe && x.charId === cid && (lim ? x.limited === lim.id : x.pool === (bd.mine ? "mybday" : "bday") && x.bdDay === bd.win.day && (!bd.mine || x.maskId === bd.maskId))) : null;
        if (same) { s.ink += C().DUPE_INK; cards.push(Object.assign({}, same, { id: uid(), ts: now + i, dupe: true, dupeOf: same.id })); continue; }
        cards.push(card);
      }
      const fresh = cards.filter(c => !c.dupe);
      s.cards = s.cards.concat(fresh);
      C().save(s); setSt(s);
      setShow(cards);
      if (cards.length > fresh.length) toast("有 " + (cards.length - fresh.length) + " 枚重复的限定 SSR，折成了 " + (cards.length - fresh.length) * C().DUPE_INK + " 印泥");
      // 动画放着的时候就开始写；挑了「抽到就画」的，写完接着画
      if (fresh.length) Promise.resolve(onWrite(fresh)).then(() => {
        if (!opt.autoDraw) return;
        fresh.reduce((p, c) => p.then(() => onDraw(c.id)), Promise.resolve());
      });
    };
    const ssrLeft = C().HARD_AT - (st.sinceSSR || 0);
    const chip = (on, label, onClick, key) => h("button", { key, onClick, "data-on": on ? "1" : "0", className: "active:opacity-70 shrink-0",
      style: { padding: "7px 12px", borderRadius: 6, border: "1px solid " + (on ? "#2f5d4a" : "rgba(47,42,34,.22)"), background: on ? "#2f5d4a" : "rgba(47,42,34,.06)", color: on ? "#15121f" : "rgba(47,42,34,.8)", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, label);
    const charOf = id => characters.find(c => c.id === id);
    // 挑人：头像一格一格，勾上的金框加一个小勾；一个都不勾＝所有人
    const peoplePick = (sel, onToggle) => h("div", { "data-wk": "stamppeople", className: "grid", style: { gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))", gap: "12px 8px", marginTop: 10 } },
      characters.map(c => { const on = sel.includes(c.id);
        return h("button", { key: c.id, "data-on": on ? "1" : "0", onClick: () => onToggle(c.id, on), className: "flex flex-col items-center active:opacity-70", style: { gap: 5, minWidth: 0 } },
          h("div", { style: { position: "relative", borderRadius: 14, padding: 2, border: "2px solid " + (on ? "#2f5d4a" : "transparent"), opacity: on || !sel.length ? 1 : .45 } },
            h(Avatar, { character: c, size: 46, radius: 10 }),
            on ? h("span", { style: { position: "absolute", right: -5, bottom: -5, width: 18, height: 18, borderRadius: 999, background: "#2f5d4a", color: "#15121f", fontSize: 11, lineHeight: "18px", textAlign: "center", fontWeight: 700 } }, "✓") : null),
          h("div", { style: { maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: on ? "#2f5d4a" : "rgba(47,42,34,.75)" } }, c.remark || c.name)); }));
    if (open) { const card = (st.cards || []).find(c => c.id === open) || null; if (card) return h(CardPage, { t, card, char: charOf(card.charId), meName, onBack: () => setOpen(null), onDraw, onRewrite: c => onWrite([c]), toast, onPoke: (c, sd) => props.onPoke ? props.onPoke(c, sd) : null, onInner: c => props.onInner ? props.onInner(c) : null,
      onSend: c => { props.onSend && props.onSend(c); }, onCanon: c => { props.onCanon && props.onCanon(c); } }); }

    const isBad = c => !c.text && (!c.writing || Date.now() - Number(c.writingTs || 0) > (c.queued ? 1800000 : 180000));
    const byChar = (st.cards || []).filter(c => albumChar === "all" || c.charId === albumChar);
    const album = byChar.filter(c => albumRar === "all" || (albumRar === "bad" ? isBad(c) : c.rarity === albumRar)).slice().reverse();
    // ── 卡池页像乙游那样：一整张大海报（一枚放大的邮票），左边一列小邮票换池，底下两颗大键；其余设置收进「⋯」 ──
    const NIGHT = "#15121f", PAPER = "#f4ecda", GOLD = "#e3b65c";
    const pools = [{ key: "mix", zh: "大混池", tag: "常驻 · 日常卡" }, { key: "char", zh: "角色池", tag: "常驻 · IF 卡" }]
      .concat(bds.map(b => ({ key: "bd:" + b.char.id, zh: (b.char.remark || b.char.name) + "的生日", tag: "生日 · 日常卡", bd: b })))
      .concat(lims.map(L => ({ key: "lim:" + L.id, zh: L.name, tag: "限时 · IF 卡", lim: L })));
    const cur = pools.find(p => p.key === pool) || pools[0];
    const charNow = charOf(charId);
    const faces = bd ? (bd.mine ? (mbOne ? [mbOne] : bd.charIds).map(charOf).filter(Boolean) : [bd.char]) : pool === "mix" ? mixIds.map(charOf).filter(Boolean) : pool === "char" ? (charNow ? [charNow] : []) : (limOne ? [charOf(limOne)] : limIds.map(charOf)).filter(Boolean);
    // 生日池每人一点自己的颜色：有人设色用人设色，没有就按 id 算一个色相；只动海报里的辅助色，齿孔和版式不变
    const hx = (hh, ss, ll) => { ll /= 100; const a2 = ss * Math.min(ll, 1 - ll) / 100, f = n => { const k = (n + hh / 30) % 12; return Math.round(255 * (ll - a2 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); }; return "#" + f(0) + f(8) + f(4); };
    const hueOf = c => { const m = /^#([0-9a-f]{6})$/i.exec(c.color || ""); if (m) { const r = parseInt(m[1].slice(0, 2), 16) / 255, g2 = parseInt(m[1].slice(2, 4), 16) / 255, b2 = parseInt(m[1].slice(4), 16) / 255, mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2); if (mx === mn) return 330; const d = mx - mn; const hh = mx === r ? ((g2 - b2) / d) % 6 : mx === g2 ? (b2 - r) / d + 2 : (r - g2) / d + 4; return Math.round(hh * 60 + 360) % 360; } let x = 0; for (const ch of String(c.id)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x % 360; };
    const bdHue = bd ? hueOf(bd.char) : 0;
    const acc = bd ? hx(bdHue, 48, 80) : "#e6b8a2";
    const tone = bd ? [hx((bd ? hueOf(bd.char) : 0), 28, 22), hx((bd ? hueOf(bd.char) : 0), 50, 80)] : pool === "mix" ? ["#2f4a46", "#7fa79a"] : pool === "char" ? [((charNow && charNow.color) || "#4a3d6b"), "#b9a7e0"] : (cur.lim && cur.lim.deco === "autumn" ? ["#4a2e1c", "#d9a25a"] : ["#3a1f3d", "#e08a3a"]);
    const testInf = !!opt.testInf;
    const perf = c => "radial-gradient(circle at 6px 6px, transparent 4.6px, " + c + " 5px) -6px -6px / 12px 12px";
    // 限时池的节日装饰：只加在边角，不动整张模板（现在只有万圣夜：蝙蝠、南瓜、星星、蛛网）
    const deco = cur.lim && cur.lim.deco === "halloween";
    const fall = cur.lim && cur.lim.deco === "autumn";   // 深秋：几片银杏和枫叶从海报上沿飘下来
    const leaf = (x, y, sz, rot, col, k, maple) => h("svg", { key: k, viewBox: "0 0 24 24", style: { position: "absolute", left: x, top: y, width: sz, height: sz, transform: "rotate(" + rot + "deg)", opacity: .75, pointerEvents: "none" } },
      maple ? h("path", { d: "M12 2l1.6 4 3-1.6-.8 3.6 3.6-.4-2 3 3 1.6-3.6 1 1 3.2-3.4-1.4L12 22l-1.4-7-3.4 1.4 1-3.2-3.6-1 3-1.6-2-3 3.6.4-.8-3.6 3 1.6z", fill: col })
        : h("path", { d: "M12 21V13M12 13C7 13 3 9 4 4c3 3 5 2 8 0 3 2 5 3 8 0 1 5-3 9-8 9z", fill: col, stroke: col, strokeWidth: .6 }));
    const bat = (x, y, sc, k) => h("svg", { key: k, viewBox: "0 0 24 12", style: { position: "absolute", left: x, top: y, width: 26 * sc, opacity: .55 } }, h("path", { d: "M12 4c1-2 2-3 3-3-.5 1.5 0 2.5 1 3 1.5-1.5 4-2 8-1-2 1-3 3-3 5-1.5-1-3-1-4 1-1-1-2-1.5-3-1.5S10 7 9 8C8 6 6.5 6 5 7c0-2-1-4-3-5 4-1 6.5-.5 8 1 1-.5 1.5-1.5 1-3 1 0 2 1 1 4z", fill: "#e08a3a" }));
    const pumpkin = (x, y, sz, k) => h("svg", { key: k, viewBox: "0 0 24 24", style: { position: "absolute", left: x, top: y, width: sz, height: sz } },
      h("ellipse", { cx: 12, cy: 14, rx: 10, ry: 8, fill: "#e8892f" }), h("path", { d: "M12 6c0-2 1-3 2-3", stroke: "#4b6b2a", strokeWidth: 2, fill: "none" }),
      h("path", { d: "M7 12l2 2 2-2M13 12l2 2 2-2M8 17q4 3 8 0", stroke: "#3a1f12", strokeWidth: 1.4, fill: "none" }));
    const web = h("svg", { key: "web", viewBox: "0 0 40 40", style: { position: "absolute", right: 0, top: 0, width: 70, height: 70, opacity: .22 } },
      h("path", { d: "M40 0L0 40M40 0L14 40M40 0L0 14M40 0L28 40M40 0L0 28M30 0q2 8 10 10M20 0q3 17 20 20M10 0q4 26 30 30", stroke: "#f4ecda", strokeWidth: .6, fill: "none" }));
    const stars = [[18, 62], [70, 40], [52, 120], [230, 88], [205, 150], [32, 210]].map((q, i) => h("span", { key: "s" + i, style: { position: "absolute", left: q[0], top: q[1], width: 3, height: 3, borderRadius: 9, background: "#f6e3b5", opacity: .55, boxShadow: "0 0 6px #f6e3b5" } }));
    // 海报上那一句：说的是「抽了会得到什么」，不是玩法说明
    const regular = !cur.bd && !cur.lim;
    const titleLen = bd ? (bd.char.remark || bd.char.name).length + 2 : pool === "char" ? charTheme.trim().length + 2 : cur.zh.length;
    const hook = bd && bd.mine ? (bd.win.isDay ? "生日快乐。今天这一池，每一张都是他们陪你过的。" : "你的生日快到了。这一池里的每一张，都是他们陪你过的那几天。") : bd ? (bd.win.isDay ? "就是今天。一年只有这一天，今年的他会留下什么样的瞬间？" : "一年只有一次的日子快到了。今年的他，又会留下什么不一样的瞬间？") : pool === "mix" ? "不同的人，不同的故事。下一封会是谁寄来的？" : pool === "char" ? (charThemeLine.trim() || (charNow ? "如果 " + (charNow.remark || charNow.name) + " 活在「" + (charTheme.trim() || "另一个世界") + "」里——" : "")) : (cur.lim.hook || cur.lim.line.split("。")[0] + "。");
    // 人：一个就放大；几个错落排，中间那个大一点、高一点（不排成整齐一行）
    const faceRow = faces.length === 1
      ? h("div", { style: { borderRadius: 12, padding: bd ? 1.5 : 3, background: deco ? "linear-gradient(135deg,#e08a3a,#6b2f6e)" : bd ? acc + "aa" : "rgba(255,255,255,.18)", boxShadow: "0 0 40px " + tone[1] + "88" } }, h(Avatar, { character: faces[0], size: 168, radius: 10 }))
      : (() => {
          // 好几个人：错落但不分主次。每天换一个顺序，谁站中间轮着来；超过五个，最后一格写「还有几位」
          const seed = Math.floor(Date.now() / 86400000), order = faces.slice().sort((x, y) => ((hueOf(x) * 7 + seed * 13) % 97) - ((hueOf(y) * 7 + seed * 13) % 97));
          const show = order.slice(0, 5), more = order.length - show.length, n = show.length, mid = Math.floor(n / 2);
          const SZ = [42, 50, 58, 50, 42], DY = [12, -16, 6, -10, 18];
          const pos = i => n === 5 ? i : n === 4 ? i + (i >= 2 ? 1 : 0) : n === 3 ? i + 1 : n === 2 ? [1, 3][i] : 2;
          return h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center" } }, show.map((c, i) => { const k = pos(i), sz = SZ[k];
            return h("div", { key: c.id, style: { position: "relative", flexShrink: 0, marginLeft: i ? -10 : 0, zIndex: 10 - Math.abs(i - mid), borderRadius: 999, padding: 2.5, background: deco ? "linear-gradient(135deg,#e08a3a,#6b2f6e)" : PAPER,
              transform: "translateY(" + DY[k] + "px)", boxShadow: "0 4px 14px rgba(0,0,0,.4)" } }, h(Avatar, { character: c, size: sz, radius: 999 }),
              more > 0 && i === n - 1 ? h("div", { style: { position: "absolute", right: -6, bottom: -6, minWidth: 26, height: 22, padding: "0 6px", borderRadius: 999, background: NIGHT, border: "1px solid " + PAPER, color: PAPER, fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", lineHeight: "20px", textAlign: "center" } }, "+" + more) : null); })); })();
    const banner = h("div", { "data-wk": "stampbanner", "data-pool": pool, "data-deco": deco ? "halloween" : "", style: { padding: 9, background: bd ? perf("#f1d9c6") : perf(PAPER), filter: "drop-shadow(0 10px 24px rgba(0,0,0,.45))", position: "relative" } },
      deco ? [bat(-6, 30, 1, "b1"), bat("78%", -8, .8, "b2"), pumpkin(-10, "86%", 28, "p1"), pumpkin("90%", "40%", 22, "p2")] : null,
      h("div", { style: { position: "relative", height: "min(56vh, 440px)", borderRadius: 3, overflow: "hidden", background: "linear-gradient(160deg, " + tone[0] + ", " + NIGHT + " 78%)", border: "1px solid rgba(255,255,255,.12)" } },
        // 底纹：一圈圈的邮戳线，淡到像防伪纹，不抢人
        h("div", { style: { position: "absolute", inset: 0, opacity: .05, background: "repeating-radial-gradient(circle at 85% 18%, transparent 0 14px, " + tone[1] + " 14px 15px)" } }),
        deco ? [web].concat(stars) : null,
        fall ? [leaf("72%", 10, 26, -20, "#d9a25a", "l1"), leaf("86%", 52, 18, 30, "#c06a3a", "l2", 1), leaf("60%", 86, 14, 60, "#e3c06a", "l3"), leaf(8, "70%", 22, -40, "#c06a3a", "l4", 1), leaf("80%", "78%", 20, 15, "#d9a25a", "l5")] : null,
        // 生日：边上一层淡金光，底下藏两道很淡的丝带
        bd ? h("svg", { key: "rib", viewBox: "0 0 100 160", preserveAspectRatio: "none", style: { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .16, pointerEvents: "none" } },
          h("path", { d: "M-5 120 C 25 95, 45 140, 70 112 S 105 90, 110 100", stroke: acc, strokeWidth: 1.2, fill: "none" }),
          h("path", { d: "M-5 132 C 30 110, 50 152, 75 124 S 105 104, 110 114", stroke: acc, strokeWidth: .7, fill: "none" })) : null,
        bd ? h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 0 1px rgba(230,184,162,.35), inset 0 0 40px rgba(230,184,162,.18)" } }) : null,
        h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "14px 16px 12px" } },
        h("div", { style: { paddingRight: pool === "char" ? 64 : 0, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".2em", color: tone[1] } }, bd ? "特别投递 · " + bd.win.year : cur.tag),
          h("div", { "data-wk": "stampbannertitle", style: { marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: F_DISPLAY, fontSize: "calc(" + (titleLen > 6 ? 18 : titleLen > 4 ? 21 : 24) + "px * var(--app-fs, 1))", lineHeight: 1.15, color: PAPER, textShadow: "0 2px 12px rgba(0,0,0,.5)" } },
            bd ? h(React.Fragment, null, bd.char.remark || bd.char.name, h("span", { style: { fontSize: "0.62em", marginLeft: 4, opacity: .85 } }, "的生日")) : pool === "char" ? (charTheme.trim() ? "「" + charTheme.trim() + "」" : "还没写主题") : cur.zh,
            bd ? h("span", { style: { marginLeft: 6, fontSize: "calc(16px * var(--app-fs, 1))", color: acc, verticalAlign: "super", textShadow: "0 0 10px " + acc + "" } }, "✦") : null),
          bd ? h("div", { style: { marginTop: 3, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".3em", color: acc, opacity: .6 } }, "生日限定 · 一年一次") : null,
          h("div", { "data-wk": "stampbannerhook", style: { marginTop: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.5, color: "rgba(244,236,218,.88)" } }, hook),
          h("div", { style: { flex: 1, minHeight: 0, display: "flex", justifyContent: "center", alignItems: "center", paddingBottom: 0 } }, faceRow),
          h("div", { className: "flex items-end justify-between", style: { gap: 8 } },
          // 邮戳：常驻写「常驻」；限时写截止日和还剩多久，万圣夜那枚是南瓜色的限定戳
          h("div", { "data-wk": "stampcountdown", style: { order: 2, flexShrink: 0, marginLeft: "auto", width: bd ? 62 : regular ? 88 : 72, height: bd ? 62 : regular ? 48 : 72, marginBottom: bd ? 18 : 0, borderRadius: regular ? 4 : 999,
            backgroundImage: regular ? "repeating-linear-gradient(0deg, transparent 0 5px, rgba(227,182,92,.13) 5px 6px)" : "none", border: (deco ? "2px dashed #e08a3a" : fall ? "2px dashed #d9a25a" : regular ? "1.5px double " + GOLD : bd ? "2px double " + acc + "" : "2px solid " + GOLD), outline: deco ? "1px solid #e08a3a66" : bd ? "1px dashed " + acc + "88" : "none", outlineOffset: 3, color: deco ? "#f0a24f" : bd ? acc : GOLD, transform: regular ? "rotate(-5deg)" : "rotate(-12deg)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, textAlign: "center", lineHeight: 1.25 } },
            cur.bd ? h(React.Fragment, null, h("div", { style: { fontSize: "calc(9.5px * var(--app-fs, 1))" } }, "生日邮戳"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, (d => (d.getMonth() + 1) + "." + d.getDate())(new Date(cur.bd.win.day))), h("div", { style: { fontSize: "calc(9px * var(--app-fs, 1))" } }, String(cur.bd.win.year)))
            : cur.lim ? h(React.Fragment, null, h("div", { style: { fontSize: "calc(9.5px * var(--app-fs, 1))" } }, deco ? "万圣夜限定" : fall ? "深秋限定" : "限定"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, new Date(Date.parse(cur.lim.to) - 1).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " 止"), h("div", { style: { fontSize: "calc(9px * var(--app-fs, 1))" } }, "还剩 " + leftText(Date.parse(cur.lim.to) - Date.now())))
              : h(React.Fragment, null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", letterSpacing: ".15em" } }, "常驻发行"), h("div", { style: { fontSize: "calc(9px * var(--app-fs, 1))", opacity: .85 } }, "已收录 " + (st.cards || []).length + " 枚"))),
          h("div", { style: { order: 1, minWidth: 0, paddingBottom: 4, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.6, color: "rgba(244,236,218,.6)" } },
            bd ? h("span", { style: { whiteSpace: "nowrap", color: acc } }, "生日限定 · 距结束 " + leftText(bd.win.close - Date.now())) : pool === "mix" ? "" : pool === "char" ? "IF 卡 · 衣服照主题来" : "IF 卡 · 每人只有一张限定 SSR"))),
        pool === "char" ? h("button", { onClick: () => setCfg(true), className: "active:opacity-70", style: { position: "absolute", right: 14, top: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid " + tone[1], color: tone[1], fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, "改主题") : null));
    // 左边一列小邮票：换池。选中的那枚像从邮册里抽出来一截：放大、往右探出去
    const rail = h("div", { "data-wk": "stamprail", className: "flex flex-col shrink-0 overflow-y-auto", style: { gap: 8, width: 72, padding: "6px 12px 10px 0", maxHeight: "calc(min(56vh, 440px) + 18px)", scrollbarWidth: "none" } },
      pools.map(p => { const on = p.key === pool, hal = p.lim && p.lim.deco === "halloween";
        return h("button", { key: p.key, "data-wk": "stamprailitem", "data-on": on ? "1" : "0", onClick: () => setPool(p.key), className: "active:opacity-80",
          style: { width: 60, height: 72, flexShrink: 0, padding: 4, background: perf(on ? (p.bd ? "#e6b8a2" : hal ? "#e08a3a" : GOLD) : p.bd ? "rgba(230,184,162,.75)" : hal ? "rgba(224,138,58,.7)" : "rgba(244,236,218,.8)"), transform: on ? "translateX(10px) scale(1.08) rotate(-2deg)" : "none", transition: "transform .25s", zIndex: on ? 2 : 1,
            filter: on ? "drop-shadow(0 6px 12px rgba(0,0,0,.5))" : "none" } },
          h("div", { style: { width: "100%", height: "100%", borderRadius: 2, background: p.bd ? (on ? "#4a2a3a" : "#3d2c38") : hal ? (on ? "#3a1f3d" : "#3a2830") : on ? NIGHT : "#3a3448", color: on ? (p.bd ? "#e6b8a2" : hal ? "#f0a24f" : GOLD) : PAPER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
            fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.25, padding: 3, gap: 3 } },
            p.bd ? (p.bd.char.remark || p.bd.char.name).slice(0, 4) : p.zh, h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", opacity: .7 } }, p.lim ? "限时" : p.bd ? "生日" : "常驻"))); }));
    const capsule = (k, v) => h("span", { key: k, "data-wk": "stampwallet", style: { padding: "3px 9px", borderRadius: 999, background: "rgba(47,42,34,.12)", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, k + " " + v);
    // ⋯ 设置页（整页，不做半窗）：谁会出、角色池主题、IF 写法、抽到就画、规则；连点七下「规则」开测试用的无限券
    if (cfg) return h("div", { "data-wk": "stampcfg", "data-page": "1", className: "h-full flex flex-col", style: { background: "repeating-linear-gradient(180deg, transparent 0 116px, rgba(47,42,34,.07) 116px 117px, transparent 117px 120px), linear-gradient(#f1e9d8, #e9dfca)" } },
      h(Head, { zh: "卡池设置", bg: "transparent", ink: "#2f2a22", onBack: () => setCfg(false) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h(Eyebrow, { style: { color: "rgba(47,42,34,.55)", marginTop: 14 } }, "大混池出哪些人（不勾就是所有人）"),
        peoplePick((pick || []).filter(id => characters.some(c => c.id === id)), (id, on) => { const cu = pick || []; const nx = on ? cu.filter(x => x !== id) : cu.concat(id); setPick(nx); setOpt({ mixPick: nx }); }),
        lims.length ? h(React.Fragment, null, h(Eyebrow, { style: { color: "rgba(47,42,34,.55)", marginTop: 18 } }, "限时池出哪些人（不勾就是所有人）"),
          peoplePick((opt.limPick || []).filter(id => characters.some(c => c.id === id)), (id, on) => { const cu = opt.limPick || []; setOpt({ limPick: on ? cu.filter(x => x !== id) : cu.concat(id) }); })) : null,
        h(Eyebrow, { style: { color: "rgba(47,42,34,.55)", marginTop: 18 } }, "角色池 · 给每个人写一个主题"),
        h("div", { className: "flex overflow-x-auto", style: { gap: 8, margin: "8px 0" } }, characters.map(c => h("button", { key: c.id, onClick: () => setCharId(c.id), className: "shrink-0", style: { borderRadius: 10, padding: 2, border: "2px solid " + (charId === c.id ? PAPER : "transparent") } }, h(Avatar, { character: c, size: 40, radius: 8 })))),
        h("input", { "data-wk": "input", value: charTheme, maxLength: 40, placeholder: "主题名（校园、古风、末日、偶像……）", onChange: e => setThDraft(e.target.value), onBlur: () => { if (thDraft != null) setOpt({ charTheme: Object.assign({}, opt.charTheme, { [charId]: thDraft }) }); },
          style: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid " + "rgba(47,42,34,.22)", background: "rgba(47,42,34,.07)", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }),
        h("textarea", { "data-wk": "input", value: charThemeLine, maxLength: 200, rows: 2, placeholder: "一句说明（可空）：这个世界里他是什么样", onChange: e => setThLineDraft(e.target.value), onBlur: () => { if (thLineDraft != null) setOpt({ charThemeLine: Object.assign({}, opt.charThemeLine, { [charId]: thLineDraft }) }); },
          style: { width: "100%", marginTop: 6, padding: "9px 12px", borderRadius: 10, border: "1px solid " + "rgba(47,42,34,.22)", background: "rgba(47,42,34,.07)", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", resize: "none" } }),
        h(Eyebrow, { style: { color: "rgba(47,42,34,.55)", marginTop: 18 } }, "IF 卡里，他是别的世界、别的年代的人时"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 6 } }, [["adapt", "照他的世界改写"], ["into", "把他丢进主题里"], ["random", "两种随机"]].map(x => chip(ifMode === x[0], x[1], () => setOpt({ ifMode: x[0] }), x[0]))),
        h(Eyebrow, { style: { color: "rgba(47,42,34,.55)", marginTop: 18 } }, "卡面画风"),
        h("div", { className: "flex flex-wrap", style: { gap: 6, marginTop: 6 } }, [["", "跟着他的设定"], ["real", "写实照片"], ["乙游卡面厚涂", "乙游厚涂"], ["精致二次元赛璐璐", "二次元"], ["水彩插画", "水彩"], ["韩漫风", "韩漫"]]
          .map(x => chip((opt.paint || "") === x[0], x[1], () => { setPaintDraft(null); setOpt({ paint: x[0] }); }, x[0] || "auto"))),
        h("input", { "data-wk": "input", value: paintDraft != null ? paintDraft : (["", "real", "乙游卡面厚涂", "精致二次元赛璐璐", "水彩插画", "韩漫风"].includes(opt.paint || "") ? "" : opt.paint), maxLength: 40, placeholder: "或者自己写一个画风（比如：赛博朋克插画）",
          onChange: e => setPaintDraft(e.target.value), onBlur: () => { if (paintDraft != null) { const v = paintDraft.trim(); setOpt({ paint: v }); setPaintDraft(null); } },
          style: { width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(47,42,34,.22)", background: "rgba(47,42,34,.07)", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }),
        h("div", { style: { marginTop: 6, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, "只管以后画的和重画的卡面，画好的不会变。"),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 18 } },
          h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#2f2a22" } }, "今天的信带他一句话"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, opt.letterLine ? "开着：每天寄信的那个人顺手写一两句附言，一天多一次调用" : "关着：只寄券，不花调用")),
          h(Toggle, { on: !!opt.letterLine, onChange: () => setOpt({ letterLine: !opt.letterLine }) })),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 18 } },
          h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#2f2a22" } }, "抽到就画卡面"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, opt.autoDraw ? "开着：每张都画，十连就是十次生图" : "关着：点开哪张、想看再画哪张，省钱")),
          h(Toggle, { on: !!opt.autoDraw, onChange: () => setOpt({ autoDraw: !opt.autoDraw }) })),
        h("button", { onClick: () => { const r = testTap.current, now = Date.now(); r.n = now - r.t < 900 ? r.n + 1 : 1; r.t = now; if (r.n >= 7) { r.n = 0; setOpt({ testInf: !testInf }); toast(testInf ? "测试券关了" : "测试券开了：抽卡不花邮资和券，盖印不花印泥"); } },
          style: { display: "block", marginTop: 22, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#2f2a22", background: "transparent", border: "none", padding: 0 } }, "规则"),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: "rgba(47,42,34,.72)", lineHeight: 1.8, marginTop: 6 } },
          "概率：R 70%、SR 25%、SSR 5%。保底所有池通用：60 抽一定出 SSR（50 抽起概率往上加），每十抽至少一张 SR。", h("br"),
          "单抽 " + C().PRICE_ONE + " 邮资，十连 " + C().PRICE_TEN + "，有十连券先用券。", h("br"),
          "邮资和印泥从互动里来、没有上限：聊天、群聊、通话一轮邮资 20、印泥 20；线下一拍、论坛片刻广场朋友圈、两个人的小事各 40；一起听一起看一起读、查手机、看他玩手机各 80；别的玩法邮资 20、印泥 40；他主动发来一条邮资 10。重 roll 不算。每天第一次打开邮票册送一张单抽券。升满一张 R 要 150 印泥、SR 500、SSR 1000。", h("br"),
          "R 是你不在时他一个人的一刻，SR 是你俩的一小段，SSR 是带选项的分节剧情。"),
        testInf ? h("div", { style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: RC.SSR } }, "测试券开着：抽卡不花邮资和券、盖印不花印泥（连点七下「规则」关掉）") : null));
    if (tab === "album") return h("div", { "data-wk": "stampalbumpage", "data-page": "1", className: "h-full flex flex-col overflow-hidden", style: { background: "repeating-linear-gradient(180deg, transparent 0 116px, rgba(47,42,34,.07) 116px 117px, transparent 117px 120px), linear-gradient(#f1e9d8, #e9dfca)" } },
      h(Head, { zh: "邮票册", sub: (st.cards || []).length + " 枚", bg: "transparent", ink: "#2f2a22", onBack: () => setTab("pull") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h("div", { className: "flex overflow-x-auto", style: { gap: 8, paddingTop: 10 } },
          chip(albumChar === "all", "全部 " + (st.cards || []).length, () => setAlbumChar("all"), "all"),
          characters.filter(c => (st.cards || []).some(x => x.charId === c.id)).map(c => chip(albumChar === c.id, (c.remark || c.name) + " " + st.cards.filter(x => x.charId === c.id).length, () => setAlbumChar(c.id), c.id))),
        (() => { const ds = albumChar === "all" ? [] : weekDays(st, albumChar), wks = Math.floor(ds.length / 7);
          return albumChar !== "all" && ds.length ? h("button", { "data-wk": "stampweekbtn", "data-full": wks ? "1" : "0", onClick: () => setWeek(Math.ceil(ds.length / 7)), className: "w-full active:opacity-70", style: { marginTop: 10, minHeight: 40, borderRadius: 10, background: "#FFF8E9", border: "1px solid #577767", color: "#285C4B", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "翻他的一周 · " + (wks ? "攒满 " + wks + " 周" : "") + (ds.length % 7 ? (wks ? "，" : "") + "这一周 " + (ds.length % 7) + " / 7 天" : "")) : null; })(),
        h("div", { "data-wk": "stamprarpick", className: "flex overflow-x-auto", style: { gap: 6, paddingTop: 8 } },
          [["all", "全部"], ["SSR", "SSR"], ["SR", "SR"], ["R", "R"], ["bad", "没写好"]].map(x => { const n = x[0] === "all" ? byChar.length : x[0] === "bad" ? byChar.filter(isBad).length : byChar.filter(c => c.rarity === x[0]).length;
            return x[0] === "bad" && !n ? null : chip(albumRar === x[0], x[1] + " " + n, () => setAlbumRar(x[0]), x[0]); })),
        // 写失败的（或者写了三分钟还没回来的）一起重写：同一个人的 R、SR 还是并成一次调用，SSR 各一次
        (() => { const bad = (st.cards || []).filter(c => !c.text && (!c.writing || Date.now() - Number(c.writingTs || 0) > (c.queued ? 1800000 : 180000)));
          return bad.length ? h("button", { "data-wk": "stamprewriteall", onClick: () => { onWrite(bad); toast("在重写 " + bad.length + " 张"); }, className: "w-full active:opacity-70",
            style: { marginTop: 12, minHeight: 40, borderRadius: 10, border: "1px dashed #b23a2e", color: "#b23a2e", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "有 " + bad.length + " 张没写好 · 一起重写") : null; })(),
        album.length ? h("div", { "data-wk": "stampalbum", className: "grid", style: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 14, justifyItems: "center" } },
          album.map(c => { const ch = albumChar === "all" ? charOf(c.charId) : null;   // 「全部」时每枚下面写是谁的
            return h("div", { key: c.id, className: "flex flex-col items-center", style: { gap: 3, minWidth: 0 } }, h(StampFace, { t, card: c, size: 88, onClick: () => setOpen(c.id) }),
              // 每枚下面：星（养到哪儿了）、谁的、什么主题（群里许愿 2026-10-26）
              (() => { const cp = C().CAP[c.rarity] || 30, all = Math.round(cp / 10), on = Math.min(all, Math.floor((c.lv || 1) / 10));
                return h("div", { "data-wk": "stampstarsmini", style: { fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".1em", color: "#285C4B", lineHeight: 1 } }, Array.from({ length: all }, (_, k) => k < on ? "★" : "☆").join("")); })(),
              h("div", { "data-wk": "stampwho", style: { maxWidth: 92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(47,42,34,.62)" } },
                [ch ? (ch.remark || ch.name) : "", c.kind === "if" ? (c.theme || "IF") : c.kind === "bday" ? "生日" : c.kind === "mybday" ? "你的生日" : "日常"].filter(Boolean).join(" · "))); }))
          : h("div", { style: { padding: "48px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, "还没有邮票，去寄一封")),
      week ? (() => { const ch = charOf(albumChar); const all = byChar.filter(c => c.rarity === "R" && c.text).sort((x, y) => (x.ts || 0) - (y.ts || 0));
        const ds = weekDays(st, albumChar), weeks = Math.ceil(ds.length / 7), wk = Math.min(weeks, Math.max(1, Number(week) || 1));
        const rs = ds.slice((wk - 1) * 7, wk * 7).map(d => Object.assign({}, d.card, { _day: d.day, _all: d.all })), full = rs.length === 7;
        const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"], md = ts => { const d = new Date(ts); return (d.getMonth() + 1) + "." + d.getDate(); };
        const fz = n => "calc(" + n + "px * var(--app-fs, 1))", INK = "#39382F", SUB = "#827C6F", CU = "#B58C55", GR = "#285C4B";
        const tag = c => c.kind === "bday" ? "生日" : c.kind === "mybday" ? "你的生日" : c.kind === "if" ? "IF「" + (c.theme || "") + "」" : "日常";
        const edge = c => c.kind === "bday" ? "#8a3a4a" : c.kind === "if" ? CU : GR;   // 有含义的颜色：日常墨绿、IF 铜金、生日酒红
        // 一页手账：顶上周数和日期范围；左边一条虚线串起日期邮戳，右边是那天那一刻；底下这一周的集邮页（没攒到的日子留空位）
        return h("div", { "data-wk": "stampweek", className: "fixed inset-0 flex flex-col", style: { zIndex: 250, background: "radial-gradient(rgba(130,124,111,.07) 1px, transparent 1.2px) 0 0 / 5px 5px, linear-gradient(#F6F0E2, #EFE7D5)" } },
          h(Head, { zh: (ch ? (ch.remark || ch.name) : "他") + "的一周", bg: "transparent", ink: INK, onBack: () => setWeek(false) }),
          h("div", { className: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
            h("div", { style: { textAlign: "center", padding: "6px 20px 4px" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: fz(10), letterSpacing: ".4em", color: CU } }, "第 " + wk + " 周" + (full ? "" : " · 还在攒")),
              h("div", { style: { marginTop: 4, fontFamily: F_DISPLAY, fontSize: fz(24), color: INK, letterSpacing: ".06em" } }, rs.length ? md(rs[0].ts) + " — " + (full ? md(rs[rs.length - 1].ts) : "？") : ""),
              full ? null : h("div", { style: { marginTop: 4, fontFamily: F_BODY, fontSize: fz(10.5), color: SUB } }, "这一周不按日历算：攒满七个抽到他的日子，这一周才定下来"),
              h("div", { style: { width: 40, height: 1, background: CU, margin: "10px auto 0", opacity: .6 } })),
            weeks > 1 ? h("div", { "data-wk": "stampweekpick", className: "flex justify-center flex-wrap", style: { gap: 6, padding: "10px 20px 0" } }, Array.from({ length: weeks }, (_, k) => chip(wk === k + 1, "第 " + (k + 1) + " 周", () => setWeek(k + 1), "w" + k))) : null,
            h("div", { style: { position: "relative", padding: "14px 16px 0 12px" } },
              h("div", { style: { position: "absolute", left: 32, top: 30, bottom: 30, borderLeft: "1px dashed rgba(181,140,85,.35)" } }),
              rs.map((c, k) => { const d = new Date(c.ts), col = edge(c);
                const others = (c._all || []).filter(x => x.id !== c.id), openD = wkOpen === c._day;
                const pickIt = x => { const s2 = C().load(); const wp = Object.assign({}, (s2.opt || {}).weekPick); wp[x.charId] = Object.assign({}, wp[x.charId], { [c._day]: x.id }); s2.opt = Object.assign({}, s2.opt, { weekPick: wp }); C().save(s2); toast("换好了：这张就是那天的一刻"); };
                return h(React.Fragment, { key: c.id }, h("button", { "data-wk": "stampweekday", "data-kind": c.kind || "", onClick: () => { setWeek(false); setOpen(c.id); }, className: "w-full text-left active:opacity-80", style: { position: "relative", display: "flex", alignItems: "flex-start", gap: 10, marginTop: k ? 10 : 0 } },
                  h("div", { style: { flexShrink: 0, width: 40, height: 40, marginTop: 12, borderRadius: 999, border: "1px solid rgba(181,140,85,.6)", background: "#FFF8E9", color: CU, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "rotate(" + (k % 2 ? 8 : -8) + "deg)", boxShadow: "0 0 0 3px #F3ECDD", zIndex: 1 } },
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: fz(11.5), lineHeight: 1.1 } }, md(c.ts)), h("div", { style: { fontFamily: F_BODY, fontSize: fz(8) } }, WD[d.getDay()])),
                  h("div", { style: { flex: 1, minWidth: 0, display: "flex", gap: 12, padding: "9px 12px 10px 10px", borderRadius: 4, background: "#FFF8E9", boxShadow: "0 1px 0 rgba(57,56,47,.06), 0 6px 16px rgba(57,56,47,.08)", borderTop: "2px solid " + col } },
                    h(WeekThumb, { card: c, size: 46 }),
                    h("div", { style: { minWidth: 0, flex: 1 } },
                      h("div", { style: { fontFamily: F_BODY, fontSize: fz(9.5), letterSpacing: ".15em", color: col } }, "R · " + tag(c)),
                      h("div", { style: { marginTop: 1, fontFamily: F_DISPLAY, fontSize: fz(16), fontWeight: 600, color: INK } }, c.text.name || ""),
                      h("div", { style: { marginTop: 2, fontFamily: F_BODY, fontSize: fz(12.5), lineHeight: 1.6, color: SUB, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, c.text.narration || ""),
                      c.text.thought ? h("div", { style: { marginTop: 5, padding: "1px 0 1px 10px", borderLeft: "2px solid rgba(40,92,75,.35)", fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: fz(13.5), lineHeight: 1.6, color: "#2f5d4a" } }, "「" + c.text.thought + "」") : null))),
                  others.length ? h("div", { style: { marginLeft: 50, marginTop: 4 } },
                    h("button", { "data-wk": "stampweekmore", onClick: () => setWkOpen(openD ? "" : c._day), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: fz(11), color: CU, padding: "2px 0" } }, (openD ? "收起" : "这天还有 " + others.length + " 张") + (openD ? " ▴" : " ▾")),
                    openD ? h("div", { className: "flex flex-col", style: { gap: 6, marginTop: 4 } }, others.map(x => h("div", { key: x.id, className: "flex items-center", style: { gap: 10, padding: "6px 10px", borderRadius: 4, background: "rgba(255,248,233,.7)", border: "1px dashed rgba(87,119,103,.35)" } },
                      h("button", { onClick: () => { setWeek(false); setOpen(x.id); }, className: "flex items-center flex-1 text-left active:opacity-70", style: { gap: 10, minWidth: 0 } }, h(WeekThumb, { card: x, size: 30 }),
                        h("div", { style: { minWidth: 0 } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: fz(13.5), color: INK } }, x.text.name || ""), h("div", { style: { fontFamily: F_BODY, fontSize: fz(11), color: SUB, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, x.text.narration || ""))),
                      h("button", { "data-wk": "stampweekswap", onClick: () => pickIt(x), className: "shrink-0 active:opacity-70", style: { padding: "3px 9px", borderRadius: 999, border: "1px solid " + GR, color: GR, fontFamily: F_BODY, fontSize: fz(10.5) } }, "换它当这天的一刻")))) : null) : null); })),
            // 这一周的集邮页：七个格子，攒到的贴上邮票，没攒到的留空位
            h("div", { "data-wk": "stampweeksheet", style: { position: "relative", margin: "26px 16px 0", padding: "16px 14px 14px", borderRadius: 6, background: "#FFF8E9", border: "1px solid rgba(87,119,103,.3)", boxShadow: "0 6px 18px rgba(57,56,47,.08)" } },
              h("div", { className: "flex items-baseline justify-between" },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: fz(14), color: GR } }, "✦ 这一周的集邮页"),
                full ? null : h("div", { style: { fontFamily: F_BODY, fontSize: fz(11.5), color: SUB } }, "已收集 " + rs.length + " / 7 个瞬间")),
              h("div", { className: "grid", style: { gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginTop: 12, justifyItems: "center" } },
                Array.from({ length: 7 }, (_, k) => rs[k] ? h("div", { key: k, style: { transform: "rotate(" + ((k % 3) - 1) * 2 + "deg)" } }, h(WeekThumb, { card: rs[k], size: 38 }))
                  : h("div", { key: k, style: { width: 38, height: 49, padding: 3, background: "radial-gradient(circle at 3px 3px, transparent 2.2px, rgba(130,124,111,.18) 2.6px) -3px -3px / 6px 6px" } },
                      h("div", { style: { width: "100%", height: "100%", border: "1px dashed rgba(130,124,111,.5)", background: "#F6F0E2", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: fz(10), color: "rgba(130,124,111,.7)" } }, k + 1)))),
              full ? h("div", { "data-wk": "stampweekmark", style: { position: "absolute", right: 10, top: -18, width: 64, height: 64, borderRadius: 999, border: "1.5px double #b23a2e", color: "#b23a2e", transform: "rotate(-14deg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(255,248,233,.9)", fontFamily: F_BODY, lineHeight: 1.2 } },
                h("div", { style: { fontSize: fz(9) } }, "第 " + wk + " 周"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: fz(13) } }, "贴满"), h("div", { style: { fontSize: fz(8.5) } }, md(rs[6].ts))) : null,
              h("div", { style: { marginTop: 12, textAlign: "center", fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: fz(12), color: SUB } }, full ? "这一周，就是这七个瞬间。" : "还差 " + (7 - rs.length) + " 天，这一页就贴满了。"))));
      })() : null,
      show ? h(PullShow, { t, cards: show.map(c => c.dupe ? c : (st.cards || []).find(x => x.id === c.id) || c), onDone: () => setShow(null), onOpen: c => { setShow(null); setOpen(c.id); }, charOf }) : null);

    return h("div", { "data-wk": "stamppage", className: "h-full flex flex-col", style: { background: "repeating-linear-gradient(180deg, transparent 0 116px, rgba(47,42,34,.07) 116px 117px, transparent 117px 120px), linear-gradient(#f1e9d8, #e9dfca)" } },
      h(Head, { zh: "邮票册", bg: "transparent", ink: "#2f2a22", onBack,
        right: h("div", { className: "flex items-center", style: { gap: 4 } },
          h("button", { "data-wk": "stampgoalbum", onClick: () => setTab("album"), className: "active:opacity-60", style: { padding: "6px 8px", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "册子"),
          h("button", { "data-wk": "stampgocfg", onClick: () => setCfg(true), className: "active:opacity-60", style: { padding: "6px 8px", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(16px * var(--app-fs, 1))" } }, "⋯")) }),
      h("div", { className: "flex justify-end flex-wrap px-4 shrink-0", style: { gap: 6 } },
        capsule("邮资", st.postage), capsule("印泥", st.ink), (st.singles || 0) > 0 ? capsule("单抽券", st.singles) : null, capsule("十连券", testInf ? "∞（手上 " + st.tickets + " 张）" : st.tickets)),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-3", style: { paddingTop: 10 } },
        // 收到礼：一条薄薄的信笺，点开看是什么，✕ 收起
        gotNote.length ? h("div", { "data-wk": "stampgift", className: "flex items-start", style: { margin: "0 4px 10px", padding: "6px 10px", borderRadius: 8, borderLeft: "3px solid #b23a2e", background: "rgba(47,42,34,.08)", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.6, gap: 8 } },
          h("button", { onClick: () => setGiftOpen(v => !v), className: "flex-1 text-left", style: { color: "#2f2a22" } }, "✉ 有 " + gotNote.length + " 封来信" + (giftOpen ? "：" : " ▸"), giftOpen ? gotNote.map((x, i) => h("div", { key: i, style: { opacity: .85 } }, "· " + x)) : null),
          h("button", { onClick: () => setGotNote([]), style: { color: "#2f2a22", opacity: .6 } }, "✕")) : null,
        h("div", { className: "flex", style: { gap: 10 } }, rail, h("div", { className: "flex-1 min-w-0" }, banner)),
        // 角色池：在这儿就能换人，不用进设置
        pool === "char" ? h("div", { "data-wk": "stampcharpick", className: "flex overflow-x-auto", style: { gap: 8, padding: "12px 4px 0 72px" } },
          characters.map(c => h("button", { key: c.id, onClick: () => setCharId(c.id), className: "shrink-0 active:opacity-70", style: { borderRadius: 999, padding: 2, border: "2px solid " + (charId === c.id ? "#2f5d4a" : "transparent") } }, h(Avatar, { character: c, size: 38, radius: 999 })))) : null,
        bd && bd.mine ? h("div", { "data-wk": "stampcharpick", "data-part": "mybday", className: "flex overflow-x-auto items-center", style: { gap: 8, padding: "12px 4px 0 72px" } },
          h("button", { key: "rnd", onClick: () => setOpt({ limOne: Object.assign({}, opt.limOne, { ["me:" + bd.maskId]: "" }) }), className: "shrink-0 active:opacity-70",
            style: { width: 42, height: 42, borderRadius: 999, border: "2px solid " + (!mbOne ? "#2f5d4a" : "rgba(47,42,34,.3)"), color: !mbOne ? "#2f5d4a" : "#2f2a22", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, "随机"),
          bd.charIds.map(charOf).filter(Boolean).map(c => h("button", { key: c.id, onClick: () => setOpt({ limOne: Object.assign({}, opt.limOne, { ["me:" + bd.maskId]: c.id }) }), className: "shrink-0 active:opacity-70", style: { borderRadius: 999, padding: 2, border: "2px solid " + (mbOne === c.id ? "#2f5d4a" : "transparent") } }, h(Avatar, { character: c, size: 38, radius: 999 })))) : null,
        lim ? h("div", { "data-wk": "stampcharpick", "data-part": "limited", className: "flex overflow-x-auto items-center", style: { gap: 8, padding: "12px 4px 0 72px" } },
          h("button", { key: "rnd", onClick: () => setOpt({ limOne: Object.assign({}, opt.limOne, { [lim.id]: "" }) }), className: "shrink-0 active:opacity-70",
            style: { width: 42, height: 42, borderRadius: 999, border: "2px solid " + (!limOne ? "#2f5d4a" : "rgba(47,42,34,.3)"), color: !limOne ? "#2f5d4a" : PAPER, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, "随机"),
          limIds.map(charOf).filter(Boolean).map(c => h("button", { key: c.id, onClick: () => setOpt({ limOne: Object.assign({}, opt.limOne, { [lim.id]: c.id }) }), className: "shrink-0 active:opacity-70", style: { borderRadius: 999, padding: 2, border: "2px solid " + (limOne === c.id ? "#2f5d4a" : "transparent") } }, h(Avatar, { character: c, size: 38, radius: 999 })))) : null,
        h("div", { style: { margin: "12px 0 6px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.6)" } },
          bd ? (() => { const b = st.bday[bd.key] || {}, n = b.since || 0, H = C().BDAY.hard;
              if (b.got) return bd.mine ? "今年你的生日 SSR 已经到手了" : "今年他的生日 SSR 已经到手了";
              return h("div", { "data-wk": "stamppity", style: { maxWidth: 300, margin: "0 auto" } },
                h("div", { className: "flex justify-between", style: { color: "#a0614a" } }, h("span", null, "生日 SSR 保底"), h("span", null, n + " / " + H)),
                h("div", { style: { marginTop: 4, height: 3, borderRadius: 9, background: "rgba(47,42,34,.12)" } }, h("div", { style: { width: Math.min(100, n / H * 100) + "%", height: "100%", borderRadius: 9, background: "linear-gradient(90deg,#c98f74,#f6dcc8)" } })),
                h("div", { style: { marginTop: 4 } }, b.force ? "求过情了，下一封就是他的生日 SSR" : "再寄出 " + Math.max(1, H - n) + " 封，必得" + (bd.mine ? "一张你的生日 SSR" : "他的生日 SSR"))); })()
            : "再抽 " + Math.max(1, ssrLeft) + " 次一定出 SSR · 每十抽至少一张 SR"),
        lim || bd ? h("div", { "data-wk": "stamplimitnote", style: { margin: "-2px 0 6px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } },
          (lim ? "这一期" : "这个生日") + "每个人只有一张限定 SSR，再抽到他的就折成 " + C().DUPE_INK + " 印泥") : null,
        bd && !bd.mine && C().canBeg(st, bd.key) ? h("div", { className: "flex justify-center" }, h("button", { "data-wk": "stampbeg", disabled: begging, onClick: () => doBeg(), className: "active:opacity-70 disabled:opacity-50",
          style: { marginTop: 2, padding: "6px 16px", borderRadius: 999, border: "1px solid #b0566e", color: "#b0566e", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, begging ? "他在想…" : "去跟他求个情")) : null,
        begLine ? h("div", { "data-wk": "stampbegline", onClick: () => setBegLine(""), style: { margin: "8px 20px 0", padding: "10px 14px", borderRadius: 12, background: "rgba(176,86,110,.12)", border: "1px solid rgba(176,86,110,.4)", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.7 } }, begLine) : null),
      // 底下两颗大键
      h("div", { "data-wk": "stamppullbar", className: "flex shrink-0 px-4", style: { gap: 10, padding: "10px 16px calc(env(safe-area-inset-bottom) * 0.4 + 12px)" } },
        h("button", { "data-wk": "stamppullbtn", "data-part": "one", onClick: () => doPull(1), className: "flex-1 active:opacity-80",
          style: { minHeight: 56, borderRadius: 16, border: "1.5px solid #2f2a22", color: "#2f2a22", background: "transparent", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" } },
          "寄一封", h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .75 } }, testInf ? "测试券" : (st.singles || 0) > 0 ? "用单抽券 · 持有 " + st.singles + " 张" : C().PRICE_ONE + " 邮资")),
        h("button", { "data-wk": "stamppullbtn", "data-part": "ten", onClick: () => doPull(10, st.tickets > 0), className: "flex-1 active:opacity-80",
          style: { minHeight: 56, borderRadius: 16, background: "linear-gradient(160deg, #3c7a60, #2a5242)", color: "#f6efe0", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", boxShadow: "0 4px 18px rgba(47,93,74,.3)" } },
          "寄一版", h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .8 } }, testInf ? "测试券" : st.tickets > 0 ? "用十连券 · 持有 " + st.tickets + " 张" : (st.singles || 0) > 0 ? (st.singles >= 9 ? "用 9 张单抽券" : "用 " + st.singles + " 张单抽券＋" + (9 - st.singles) * C().PRICE_ONE + " 邮资") : C().PRICE_TEN + " 邮资"))),
      show ? h(PullShow, { t, cards: show.map(c => c.dupe ? c : (st.cards || []).find(x => x.id === c.id) || c), onDone: () => setShow(null), onOpen: c => { setShow(null); setOpen(c.id); }, charOf }) : null);
  }
  window.StampBookApp = StampBookApp;
})();
