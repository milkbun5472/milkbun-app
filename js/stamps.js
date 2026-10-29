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
  // cover：她在卡页里挑的册子封面（满级那面、番外插图都行），没挑就是第一面
  // 册子里那一格只要小图（群里 2026-10-28：邮票多了刷着刷着全部消失）：原图 1024×1536，一屏几十张全解码，手机网页内存顶不住就把图全丢了。
  //   这里每张只解一次原图、缩成 300 宽的小图存进 IDB（th_ 开头），以后都用小图；还没滑到附近的先不加载
  const THUMB_MEM = new Map();
  const makeThumb = async blob => {
    try { if (typeof createImageBitmap === "function") { const bm = await createImageBitmap(blob); const w = 300, hh = Math.round(bm.height * w / bm.width);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = hh; cv.getContext("2d").drawImage(bm, 0, 0, w, hh); bm.close && bm.close();
      return await new Promise(r => cv.toBlob(r, "image/jpeg", .82)); } } catch (e) {}
    return null;
  };
  function useStampThumb(ref) {
    const [url, setUrl] = useState(() => (ref && THUMB_MEM.get(ref)) || null), [near, setNear] = useState(false), el = useRef(null);
    useEffect(() => { const n = el.current; if (!n || typeof IntersectionObserver !== "function") { setNear(true); return; }
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "400px" }); io.observe(n); return () => io.disconnect(); }, []);
    useEffect(() => { if (!ref) { setUrl(null); return; } if (THUMB_MEM.has(ref)) { setUrl(THUMB_MEM.get(ref)); return; } if (!near) return; let alive = true;
      (async () => { const tk = "th_" + ref; let b = null;
        try { b = typeof idbImgGet === "function" ? await idbImgGet(tk) : null; } catch (e) {}
        if (!b || !b.size) { let src = null;
          try { src = String(ref).indexOf("iv_") === 0 ? (typeof imgVaultFetchBlob === "function" ? await imgVaultFetchBlob(ref) : null) : await idbImgGet(ref); } catch (e) {}
          if (!src) return; b = (await makeThumb(src)) || src; if (b !== src && typeof idbImgPut === "function") idbImgPut(tk, b).catch(() => {}); }
        if (!alive || !b) return; const u = URL.createObjectURL(b); THUMB_MEM.set(ref, u); setUrl(u); })();
      return () => { alive = false; }; }, [ref, near]);
    return [url, el];
  }
  function StampFace({ t, card, onClick, size, back }) { const [url, el] = useStampThumb(card && (card.cover || card.face)); return h("span", { ref: el, style: { display: "inline-block", lineHeight: 0 } }, h(Stamp, { t, card, face: url, onClick, size, back })); }

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
  // 翻过的句子记在这儿（按原文），翻回来还在；换了一句不再挂着上一句的译文（群里 2026-10-27：旁白点过一次翻译，后面每句底下都是那一句的）
  const BI_ZH = new Map();
  function BiText({ text, small, color, sub }) {
    const sp = typeof splitBilingual === "function" ? splitBilingual(String(text || "")) : null;
    const orig = sp ? sp.text : String(text || "");
    const [zhOf, setZhOf] = useState(null), [busy, setBusy] = useState(false);
    const zh = zhOf && zhOf.o === orig ? zhOf.zh : (BI_ZH.get(orig) || ""), cn = sp ? sp.zh : zh;
    const can = !sp && !zh && typeof translatableLang === "function" && translatableLang(orig);
    const go = async e => { e && e.stopPropagation(); if (busy) return; setBusy(true); try { const r = await translateToZh(orig, can); if (r && r.zh) { BI_ZH.set(orig, r.zh); setZhOf({ o: orig, zh: r.zh }); } } catch (er) {} setBusy(false); };
    return h(React.Fragment, null, orig,
      can ? h("button", { "data-wk": "stamptrans", onClick: go, style: { marginLeft: 6, padding: "0 6px", borderRadius: 6, border: "1px solid currentColor", fontSize: "0.72em", opacity: .7, fontStyle: "normal", verticalAlign: "middle" } }, busy ? "…" : "译") : null,
      cn ? h("div", { "data-wk": "stampzh", style: { marginTop: 3, fontSize: "0.8em", fontStyle: "normal", opacity: .72, color: sub || color } }, cn) : null);
  }
  // 番外那一行底下的一排小按钮：插图（画了显示一张小缩略图，点开看大图）、发给他看、设成封面、重写（点两下，不扣券）
  function ExtraActs({ x, onSend, onRewrite }) {   // 番外那一行底下：发给他看、重写（点两下，不扣券）。卡面在上面卡面那边画
    const [arm, setArm] = useState(false);
    const b = { padding: "2px 9px", borderRadius: 999, border: "1px solid rgba(87,119,103,.3)", color: "#827C6F", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", whiteSpace: "nowrap" };
    return h("div", { "data-wk": "stampextraacts", className: "flex flex-wrap items-center", style: { gap: 6, marginTop: 6 } },
      h("button", { "data-wk": "stampextrasend", onClick: onSend, className: "active:opacity-70", style: b }, x.sentTs ? "再发给他" : "发给他看"),
      h("button", { "data-wk": "stampextrarewrite", onClick: () => { if (!arm) { setArm(true); setTimeout(() => setArm(false), 3000); return; } setArm(false); onRewrite(); }, className: "active:opacity-70",
        style: Object.assign({}, b, arm ? { borderColor: "#b23a2e", color: "#b23a2e" } : { borderStyle: "dashed" }) }, arm ? "再点一次重写" : x.writing ? "重写中…" : "重写 · 不扣券"));
  }

  function StoryReader({ t, card, char, meName, lv, start, onClose, onSeen, inner, noResume }) {   // noResume：番外播放用，不记「看到哪儿」
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
    const [stOpt, setStOpt] = useState(() => C().load().opt || {});
    const audRef = useRef(null), autoT = useRef(0);
    const stopAudio = () => { try { if (audRef.current) { audRef.current.onended = null; audRef.current.pause(); } } catch (e) {} audRef.current = null; };
    // 横图当背景（番外插图）：铺满会被放大裁掉大半。横的就整张放在上半屏，后面垫一层同一张图的虚化，不裁人（她 2026-10-27）
    const [wide, setWide] = useState(false);
    useEffect(() => { setWide(false); if (!url) return; const im = new Image(); im.onload = () => setWide(im.naturalWidth > im.naturalHeight * 1.1); im.src = url; }, [url]);
    const [logOpen, setLogOpen] = useState(false);   // 回放记录（她 2026-10-27）：只记这一节走过的
    const logEnd = useRef(null);
    useEffect(() => { if (logOpen && logEnd.current) logEnd.current.scrollIntoView({ block: "end" }); }, [logOpen]);
    const [picks, setPicks] = useState({});   // 一节中间的小选项：选了哪个（同一节里换个回应，走完又回到主线）
    // 记住看到哪儿（她 2026-10-27）：收起时把这一节、第几句、选过什么存在卡上；再进来问一句接着看还是从头看。走到结局就清掉
    const at0 = !noResume && !start && card.storyAt && secs.some(x => x.id === card.storyAt.sid) && (card.storyAt.i > 0 || card.storyAt.sid !== (secs[0] && secs[0].id)) ? card.storyAt : null;
    const [ask, setAsk] = useState(!!at0);
    const resumeRef = useRef(null), posRef = useRef(null), doneRef = useRef(false);
    useEffect(() => { const r = resumeRef.current; resumeRef.current = null; if (r) { setPicks(r.picks || {}); setI(r.i || 0); } else setPicks({}); if (onSeen && sid) onSeen(sid); }, [sid]);
    const resume = () => { setAsk(false); if (!at0) return; if (at0.sid === sid) { setPicks(at0.picks || {}); setI(at0.i || 0); } else { resumeRef.current = at0; setSid(at0.sid); } };
    useEffect(() => { posRef.current = { sid, i, picks }; }, [sid, i, picks]);
    useEffect(() => () => { if (noResume) return; try { const st0 = C().load(), p0 = posRef.current; st0.cards = st0.cards.map(c => c.id === card.id ? Object.assign({}, c, { storyAt: doneRef.current || !p0 ? null : p0 }) : c); C().save(st0); } catch (e) {} }, []);
    // 长按藏起对话框和按钮，只看卡面；松手回来（长按松开那一下不算点）
    const [hideUi, setHideUi] = useState(false);
    const lpT = useRef(0), lpRef = useRef(false);
    const lpDown = () => { clearTimeout(lpT.current); lpT.current = setTimeout(() => { lpRef.current = true; setHideUi(true); }, 450); };
    const lpUp = () => { clearTimeout(lpT.current); if (lpRef.current) { setHideUi(false); setTimeout(() => { lpRef.current = false; }, 60); } };
    const eaten = () => { if (lpRef.current) { lpRef.current = false; return true; } return false; };
    // ⚠️这一句不许提前 return：下面还有两个 useEffect，先 return 就少跑两个 hook，
    //   React 下一次渲染对不上号就是 #310 白屏（施工规则：hook 全部排在 return 之前）。
    //   没有这一节时给一份空的壳子照常往下跑，真正的 return 挪到 hook 后面。
    const sec0 = secs.find(s => s.id === sid) || secs[0];
    const sec = sec0 || { id: "", title: "", beats: [], choices: [] };
    // 把这一节摊开：中间的 pick 没选时停在那儿；选了就换成「她说的那句＋他那几句」
    const flat = [];
    for (let k = 0; k < sec.beats.length; k++) {
      const b = sec.beats[k] || {};
      if (b.who === "pick" && Array.isArray(b.options) && b.options.length) {
        const c = picks[k];
        if (c == null) { flat.push(Object.assign({}, b, { _pick: k })); break; }
        const o = b.options[c] || {};
        flat.push({ who: "me", text: o.text || "", _picked: true });
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
    const tap = () => { if (eaten() || ask) return; if (beat._pick != null) return; if (!atEnd) setI(i + 1); else if (isFinal()) { doneRef.current = true; onClose(); } };   // 走到头了，点哪儿都是退出
    const nextOf = cur => { const L = Number(cur.lv) || 1; return secs.filter(x => !x.hidden && (Number(x.lv) || 1) > L).sort((a, b) => (Number(a.lv) || 1) - (Number(b.lv) || 1))[0] || null; };
    const who = beat.who === "he" ? char.name : beat.who === "me" ? meName : beat.who === "inner" ? char.name + " 心里" : "";
    // 选项那一下，框里接着显示上一句（选项本身挪到屏幕中间）
    const shown = beat._pick != null ? (flat[i - 1] || {}) : beat;
    const shownWho = shown.who === "he" ? char.name : shown.who === "me" ? meName : shown.who === "inner" ? char.name + " 心里" : "";
    const go = () => { if (beat._pick != null) return; if (!atEnd) setI(x => x + 1); };
    // 语音和自动播放（她 2026-10-26）：两个开关记在卡池设置里。开了语音，轮到他说话就念（念过的存着，再听不花钱）；
    //   开了自动播放：有语音就念完翻页，没语音就按字数停几秒翻页；到选项、到一节结尾就停
    const voiceOn = !!stOpt.storyVoice, autoOn = !!stOpt.storyAuto;
    const vid = char.voiceId || (typeof ttsDefaultVoice === "function" && typeof loadTtsApi === "function" ? ttsDefaultVoice(loadTtsApi()) : "");
    const canVoice = typeof ttsSpeak === "function" && typeof ttsReady === "function" && typeof loadTtsApi === "function" && ttsReady(loadTtsApi()) && !!vid;
    const say = (txt, done) => {
      stopAudio();
      const sp = typeof splitBilingual === "function" ? splitBilingual(String(txt || "")) : null, line = sp ? sp.text : String(txt || "");
      if (!line.trim() || !canVoice) { done && done(false); return; }
      ttsSpeak(line, vid).then(blob => { const u = URL.createObjectURL(blob), a = new Audio(u); audRef.current = a; a.onended = () => { URL.revokeObjectURL(u); done && done(true); }; return a.play(); })
        .catch(() => { done && done(false); });
    };
    useEffect(() => {
      clearTimeout(autoT.current);
      if (beat._pick != null || logOpen || hideUi || ask) { stopAudio(); return; }
      const next = () => { if (autoOn && !atEnd) autoT.current = setTimeout(go, 350); };
      const timer = () => { if (autoOn && !atEnd) autoT.current = setTimeout(go, Math.min(6500, 1000 + String(beat.text || "").length * 75)); };
      if (voiceOn && beat.who === "he" && canVoice) say(beat.text, ok => ok ? next() : timer());
      else { stopAudio(); timer(); }
      return () => clearTimeout(autoT.current);
    }, [sid, i, beat._pick, voiceOn, autoOn, logOpen, hideUi, ask]);
    useEffect(() => () => { clearTimeout(autoT.current); stopAudio(); }, []);
    if (!sec0) return null;   // hook 都跑完了，这儿再退出
    const toggle = k => { const st0 = C().load(); st0.opt = Object.assign({}, st0.opt, { [k]: !(st0.opt || {})[k] }); C().save(st0); setStOpt(st0.opt); };
    const choiceBtn = { textAlign: "center", width: "100%", maxWidth: 340, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.45)", background: "rgba(16,14,22,.78)", color: "#fff", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", boxShadow: "0 6px 18px rgba(0,0,0,.35)", backdropFilter: "blur(4px)" };
    const hid = { opacity: hideUi ? 0 : 1, pointerEvents: hideUi ? "none" : undefined, transition: "opacity .2s" };
    return h("div", { "data-wk": "stampstory", "data-hide": hideUi ? "1" : "0", onPointerDown: lpDown, onPointerUp: lpUp, onPointerCancel: lpUp, onPointerLeave: lpUp, onContextMenu: e => e.preventDefault(), className: "fixed inset-0 flex flex-col", style: { zIndex: 255, WebkitTouchCallout: "none", userSelect: "none", WebkitUserSelect: "none", background: url && !wide ? "#111 center/cover no-repeat url(" + url + ")" : url ? "#0e0c12" : "linear-gradient(#2b2436,#14111b)" } },
      url && wide ? h("div", { "data-wk": "stampstorywide", style: { position: "absolute", inset: 0, zIndex: -1, overflow: "hidden", pointerEvents: "none" } },
        h("div", { style: { position: "absolute", inset: -40, background: "center/cover no-repeat url(" + url + ")", filter: "blur(28px) brightness(.55)" } }),
        h("img", { src: url, alt: "", style: { position: "absolute", left: 0, right: 0, top: "calc(env(safe-area-inset-top) + 72px)", width: "100%", height: "auto", boxShadow: "0 10px 40px rgba(0,0,0,.5)" } })) : null,
      h("div", { className: "flex items-center", style: Object.assign({ padding: "calc(env(safe-area-inset-top) + 10px) 14px 8px", background: "linear-gradient(rgba(0,0,0,.55), transparent)" }, hid) },
        h("button", { onClick: onClose, className: "active:opacity-60", style: { flexShrink: 0, whiteSpace: "nowrap", color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "‹ 收起"),
        h("div", { className: "flex-1 text-center", style: { minWidth: 0, margin: "0 6px", color: "#fff" } },
          h("div", { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } }, sec.title || card.text.name),
          // 第几节：按等级那道锁数（1/10/20/30 级＝一到四节，40 级是结局，50 级是隐藏的路）
          h("div", { "data-wk": "stampstorysec", style: { whiteSpace: "nowrap", marginTop: 1, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".2em", opacity: .65 } },
            sec.extra ? "番外" : sec.hidden ? "隐藏的路" : sec.end ? "结局" : "第" + (["一", "二", "三", "四"][Math.min(3, Math.floor((Number(sec.lv) || 1) / 10))]) + "节")),
        h("button", { "data-wk": "stampstoryvoice", "data-on": voiceOn ? "1" : "0", onClick: () => { if (!canVoice && !voiceOn) { alert("要先在「设置」里配好语音（minimax 那些），他的音色在人格档案馆挑。"); return; } toggle("storyVoice"); }, className: "active:opacity-60",
          style: { flexShrink: 0, marginRight: 4, color: "#fff", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255," + (voiceOn ? ".9" : ".35") + ")", background: voiceOn ? "rgba(255,255,255,.18)" : "transparent" } }, "语音"),
        // 跳过（她 2026-10-26）：一下翻到这一节的下一个选项；没有选项了就到这一节结尾。结局那一节不给跳；选完要再跳就再点
        !atEnd && beat._pick == null && !sec.end ? h("button", { "data-wk": "stampstoryskip", onClick: () => { clearTimeout(autoT.current); stopAudio(); setI(flat.length - 1); }, className: "active:opacity-60",
          style: { flexShrink: 0, marginRight: 4, color: "#fff", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.35)" } }, "跳过") : null,
        h("button", { "data-wk": "stampstorylog", onClick: () => { clearTimeout(autoT.current); stopAudio(); setLogOpen(true); }, className: "active:opacity-60",
          style: { flexShrink: 0, marginRight: 4, color: "#fff", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.35)" } }, "记录"),
        h("button", { "data-wk": "stampstoryauto", "data-on": autoOn ? "1" : "0", onClick: () => toggle("storyAuto"), className: "active:opacity-60",
          style: { flexShrink: 0, marginRight: 4, color: "#fff", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255," + (autoOn ? ".9" : ".35") + ")", background: autoOn ? "rgba(255,255,255,.18)" : "transparent" } }, "自动"),
        opts.length > 1 ? h("button", { "data-wk": "stampstorybg", onClick: nextBg, className: "active:opacity-60", style: { flexShrink: 0, whiteSpace: "nowrap", color: "#fff", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.35)" } }, "背景") : null),   // 跟另外四个一样大，只写「背景」两个字，点一下换下一张（她 2026-10-27：「背景：他一个人」太挤）
      // 选项放在屏幕中间（她 2026-10-26），不挤在对话框里
      h("div", { "data-wk": "stampstorychoices", className: "flex-1 flex flex-col items-center justify-center", onClick: tap, style: Object.assign({ padding: "0 28px", gap: 10 }, hid) },
        beat._pick != null ? (beat.options || []).map((o, k) => h("button", { key: "p" + k, "data-wk": "stampstorychoice", "data-inline": "1", onClick: e => { e.stopPropagation(); if (eaten()) return; setPicks(p => Object.assign({}, p, { [beat._pick]: k })); }, className: "active:opacity-80", style: choiceBtn }, h(BiText, { text: o.text || "" }))) : null,
        atEnd && (sec.choices || []).length ? sec.choices.map((c, k) => { const to = secs.find(s => s.id === c.go) || nextOf(sec); const lk = to && locked(to);
            return h("button", { key: "c" + k, "data-wk": "stampstorychoice", "data-locked": lk ? "1" : "0", onClick: e => { e.stopPropagation(); if (eaten() || !to || lk) return; setSid(to.id); setI(0); }, className: "active:opacity-80",
              style: Object.assign({}, choiceBtn, lk ? { background: "rgba(16,14,22,.5)", color: "rgba(255,255,255,.5)" } : {}) },
              to && to.hidden ? h("span", { "data-wk": "stampstorysecret", style: { marginRight: 6, color: "#e3b65c" } }, "✦") : null,
              h(BiText, { text: c.text || "" }), lk ? h("div", { style: { marginTop: 2, fontSize: "calc(11px * var(--app-fs, 1))" } }, "升到 " + to.lv + " 级才看得到") : null); }) : null,
        atEnd && !(sec.choices || []).length && !sec.end && nextOf(sec) ? (() => { const nx = nextOf(sec);
          return h("button", { "data-wk": "stampstorychoice", "data-locked": locked(nx) ? "1" : "0", onClick: e => { e.stopPropagation(); if (eaten() || locked(nx)) return; setSid(nx.id); setI(0); }, className: "active:opacity-80",
            style: Object.assign({}, choiceBtn, locked(nx) ? { background: "rgba(16,14,22,.5)", color: "rgba(255,255,255,.5)" } : {}) }, "下一幕：" + (nx.title || ""), locked(nx) ? h("div", { style: { marginTop: 2, fontSize: "calc(11px * var(--app-fs, 1))" } }, "升到 " + nx.lv + " 级才看得到") : null); })() : null),
      h("div", { "data-wk": "stampstorybox", onClick: tap,
        style: { ...hid, margin: "0 12px calc(env(safe-area-inset-bottom) * 0.4 + 14px)", borderRadius: 14, background: "rgba(16,14,22,.82)", border: "1px solid rgba(255,255,255,.18)", padding: "14px 16px 30px", minHeight: 150, position: "relative", color: "#f4efe6" } },
        shownWho ? h("div", { "data-wk": "stampstorywho", style: { display: "inline-block", marginBottom: 6, padding: "2px 10px", borderRadius: 999, background: shown.who === "he" ? RC.SSR : shown.who === "inner" ? "#577767" : "#6b6480", fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))" } }, shownWho) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", lineHeight: 1.75, fontStyle: shownWho && shown.who !== "inner" ? "normal" : "italic", opacity: shownWho ? 1 : .85, whiteSpace: "pre-wrap" } }, h(BiText, { text: shown.text || "" }),
          shown.who === "he" && canVoice ? h("button", { "data-wk": "stampstorysay", onClick: e => { e.stopPropagation(); say(shown.text); }, style: { marginLeft: 6, fontSize: "0.85em", opacity: .75, verticalAlign: "middle" } }, "🔊") : null),
        isFinal() ? h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", opacity: .7 } }, "—— 这条路走到头了 · 点一下退出 ——") : null,
        !atEnd && beat._pick == null ? h("div", { "data-wk": "stampstorynext", style: { position: "absolute", right: 14, bottom: 10, fontSize: "calc(11px * var(--app-fs, 1))", opacity: .5 } }, "点一下继续 ▾") : null),
      ask ? h("div", { "data-wk": "stampresume", className: "fixed inset-0 flex flex-col items-center justify-center", onClick: e => e.stopPropagation(), style: { zIndex: 3, gap: 10, background: "rgba(10,9,14,.55)" } },
        h("div", { style: { marginBottom: 4, color: "#fff", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", opacity: .85 } }, "上次看到「" + ((secs.find(x => x.id === at0.sid) || {}).title || "") + "」"),
        h("button", { "data-wk": "stampresumego", onClick: resume, className: "active:opacity-80", style: choiceBtn }, "接着看"),
        h("button", { "data-wk": "stampresumetop", onClick: () => setAsk(false), className: "active:opacity-80", style: choiceBtn }, "从头看")) : null,
      // 回放记录：这一节走到现在的每一句（选过的那句标出来）；点空白处收起，从原来那句接着走
      logOpen ? h("div", { "data-wk": "stamplog", onClick: () => setLogOpen(false), className: "fixed inset-0 flex flex-col", style: { zIndex: 2, background: "rgba(10,9,14,.86)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", color: "#fff" } },
        h("div", { className: "flex items-center", style: { padding: "calc(env(safe-area-inset-top) + 10px) 14px 8px" } },
          h("button", { onClick: () => setLogOpen(false), className: "active:opacity-60", style: { flexShrink: 0, color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "‹ 收起"),
          h("div", { className: "flex-1 text-center", style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))", marginRight: 40 } }, "记录")),
        h("div", { className: "flex-1 overflow-y-auto", style: { padding: "6px 22px calc(env(safe-area-inset-bottom) + 24px)" } },
          flat.slice(0, Math.min(i, flat.length - 1) + (beat._pick != null ? 0 : 1)).map((b, k) => { const w = b.who === "he" ? char.name : b.who === "me" ? meName : b.who === "inner" ? char.name + " 心里" : "";
            return h("div", { key: k, "data-wk": "stamplogline", "data-who": b.who || "narr", style: { padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.08)" } },
              w ? h("div", { style: { marginBottom: 3, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: b.who === "he" ? "#e3c48a" : b.who === "inner" ? "#9fc2ae" : "#c9c0e0" } }, w, b._picked ? h("span", { "data-wk": "stamplogpick", style: { marginLeft: 6, padding: "0 6px", borderRadius: 3, border: "1px solid rgba(201,192,224,.6)", fontSize: "0.9em" } }, "你选的") : null) : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.7, fontStyle: w && b.who !== "inner" ? "normal" : "italic", opacity: b.who === "inner" ? .7 : w ? 1 : .8, whiteSpace: "pre-wrap" } }, h(BiText, { text: b.text || "" }),
                b.who === "he" && canVoice ? h("button", { "data-wk": "stamplogsay", onClick: e => { e.stopPropagation(); say(b.text); }, style: { marginLeft: 6, color: "#fff", fontSize: "calc(10.5px * var(--app-fs, 1))", padding: "0 6px", borderRadius: 999, border: "1px solid rgba(255,255,255,.35)", verticalAlign: "middle" } }, "听") : null)); }),
          h("div", { ref: logEnd }))) : null);
  }

  // 一张卡打开：卡面、名字、内容
  // 卡页＝养成页：上面是卡（光晕、稀有度章、星、邮戳编号），中间养成面板，底下「时刻回廊」一格一格往外还原那个瞬间
  function CardPage({ t, card, char, meName, onSwipe, onBack, onDraw, onRewrite, onSend, onCanon, onPoke, onInner, onExtra, onExtraDraw, onExtraSend, onTheater, onTheaterLine, toast }) {
    // 满级两面都能画：他一个人（solo）、你们俩（duo）。旧卡只有 faceAlt＋faceAltMode，照它认
    const faces2 = Object.assign({}, card.faceAlt ? { [card.faceAltMode || "solo"]: card.faceAlt } : {}, card.faces || {});
    const url1 = useIdbImgUrl(card.face), urlSolo = useIdbImgUrl(faces2.solo || null), urlDuo = useIdbImgUrl(faces2.duo || null);
    // 打开时停在她挑的封面那一面（她 2026-10-27：选了别的当封面，点进来还是第一面）
    const [side, setSide] = useState(() => { const cv = card.cover; if (!cv) return "main"; if (cv === faces2.solo) return "solo"; if (cv === faces2.duo) return "duo"; const ex = (card.extras || []).find(x => x.img === cv); return ex ? "ex:" + ex.id : "main"; });   // main 第一面 / solo / duo / ex:番外
    // 番外卡面（她 2026-10-27）：在卡面这边跟满级那几面一起挑、一起画；side 是 "ex:番外id"
    const exSel = side.indexOf("ex:") === 0 ? (card.extras || []).find(x => "ex:" + x.id === side) || null : null;
    const urlEx = useIdbImgUrl(exSel && exSel.img || null);
    const exDrawing = !!(exSel && exSel.drawing && exSel.drawingBoot && exSel.drawingBoot === window.__stampBoot && Date.now() - (exSel.drawingTs || 0) < 8 * 60000);
    const url = exSel ? (urlEx || url1) : side === "solo" && urlSolo ? urlSolo : side === "duo" && urlDuo ? urlDuo : url1;
    const sideKey = exSel ? exSel.img : side === "solo" ? faces2.solo : side === "duo" ? faces2.duo : card.face;
    const [full, setFull] = useState(false), [fullWide, setFullWide] = useState(false), [rot, setRot] = useState(false);
    useEffect(() => { if (!card.unread) return; const st0 = C().load(); st0.cards = st0.cards.map(c => c.id === card.id ? Object.assign({}, c, { unread: false }) : c); C().save(st0); }, [card.id]);   // 点开过就不算新
    // 「画着」超过八分钟还没回来＝那次没了（多半是画到一半关了 app）：按钮放开，能再画（她 2026-10-27：有人一直卡在重画中）
    const drawing = !!card.drawing && !!card.drawingBoot && card.drawingBoot === window.__stampBoot && Date.now() - (card.drawingTs || 0) < 8 * 60000;   // 关掉 app 再打开：上一回没画完的那次一定没了，直接放开
    const swipe = useRef(null), swiped = useRef(0);
    const setCover = key => { const st0 = C().load(); st0.cards = st0.cards.map(c => c.id === card.id ? Object.assign({}, c, { cover: key || null }) : c); C().save(st0); toast(key ? "换好了：册子里这张就用它当封面" : "换回第一面了"); };
    const [exOpen, setExOpen] = useState(null), [exWish, setExWish] = useState(null);
    const isExCard = card.rarity === "SSR" || card.rarity === "SR";   // SR、SSR 都能用番外券写番外（她 2026-10-27）；重复抽到自动送的还是只有限定 SSR
    const [buyOpen, setBuyOpen] = useState(false), [buyN, setBuyN] = useState(1);
    const exTk = C().load().extraTickets || 0;   // exWish：点了「用番外券」以后那一格「想看什么」，null＝没展开
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
    const canPoke = card.rarity === "SSR" && lv >= cap && !!tx && !!url && !exSel;
    const pokeAud = useRef(null);
    const speakPoke = txt => {
      if (!(typeof ttsSpeak === "function" && typeof ttsReady === "function" && typeof loadTtsApi === "function" && ttsReady(loadTtsApi()))) return false;
      const vid = (char && char.voiceId) || ttsDefaultVoice(loadTtsApi()); const sp = typeof splitBilingual === "function" ? splitBilingual(String(txt || "")) : null, line = sp ? sp.text : String(txt || "");
      try { if (pokeAud.current) pokeAud.current.pause(); } catch (er) {}
      ttsSpeak(line, vid).then(b => { const u = URL.createObjectURL(b), a2 = new Audio(u); pokeAud.current = a2; a2.onended = () => URL.revokeObjectURL(u); a2.play(); }).catch(() => {});
      return true;
    };
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
      const picked = pool[Math.floor(Math.random() * pool.length)];
      clearTimeout(sayT.current); setSay({ text: picked, part });
      // 剧情里开了「语音」，戳出来的话也念（念过的存着，再听不花钱）；念的时候字多留一会儿
      if ((C().load().opt || {}).storyVoice) speakPoke(picked);
      sayT.current = setTimeout(() => setSay(null), (C().load().opt || {}).storyVoice ? 6000 : 3200);
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
      h(Head, { right: isExCard ? h("button", { "data-wk": "stampextk", onClick: () => { setBuyN(1); setBuyOpen(true); }, className: "flex items-center active:opacity-70", style: { gap: 4, padding: "3px 8px 3px 6px", borderRadius: 6, border: "1px dashed " + COPPER, background: "#FFF8E9", color: "#8a6a3a", fontFamily: F_BODY, fontSize: fs(11.5) } },
          h("svg", { viewBox: "0 0 24 16", style: { width: 20, height: 14 } }, h("path", { d: "M2 2h20v4a2 2 0 0 0 0 4v4H2v-4a2 2 0 0 0 0-4z", fill: "#f6efe0", stroke: "#B58C55", strokeWidth: 1.4 }), h("path", { d: "M9 5l1.2 2.4 2.6.4-1.9 1.8.5 2.6L9 11l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z", fill: "#B58C55" })),
          exTk, h("span", { style: { marginLeft: 2, fontSize: fs(14), lineHeight: 1, color: COPPER } }, "+")) : null, zh: tx ? tx.name : "一枚邮票", sub: card.rarity + " · " + (char ? char.name : "") + (card.kind === "if" ? " · IF「" + (card.theme || "") + "」" + (card.limYear ? " · " + card.limYear : "") : card.kind === "bday" ? " · 生日限定" : card.kind === "mybday" ? " · 你的生日" : card.kind === "anniv" ? " · 纪念日「" + (card.annivName || "") + "」" : " · 日常"), bg: "transparent", ink: P, onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        // 卡
        // 在卡面这一块左右滑：换册子里的上一张、下一张（群里 2026-10-27）；底下回廊那排自己能横滑，不在这儿抢
        h("div", { "data-wk": "stampshow", className: "flex flex-col items-center", style: { position: "relative", paddingTop: 14, touchAction: "pan-y" },
          onPointerDown: e => { swipe.current = { x: e.clientX, y: e.clientY }; },
          onPointerUp: e => { const s0 = swipe.current; swipe.current = null; if (!s0 || !onSwipe) return; const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped.current = Date.now(); onSwipe(dx < 0 ? 1 : -1); } } },
          h("div", { style: { position: "absolute", top: 0, left: "50%", width: 320, height: 380, marginLeft: -160, borderRadius: 999, background: "radial-gradient(closest-side, " + (card.rarity === "R" ? "rgba(47,42,34,.16)" : RC[card.rarity] + "44") + ", transparent)", animation: "stHalo 4s ease-in-out infinite", pointerEvents: "none" } }),
          h("div", { key: pop, style: { position: "relative", boxShadow: ring, animation: pop ? "stFloat .9s ease-out" : "none" } },
            h(Stamp, { t, card, face: url, size: 236 }),
            // 满级 SSR 能戳：上面三分之一是头，中间是胸口，下面是手
            url ? h("div", { onClick: () => { if (Date.now() - swiped.current < 400) return; setFull(true); }, style: { position: "absolute", inset: 0, cursor: "zoom-in" } }) : null,
            pop ? h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(110deg, transparent 35%, rgba(255,240,200,.55) 50%, transparent 65%) 0 0 / 200% 100%", animation: "stShine .9s ease-out 1 forwards" } }) : null,
            h("div", { "data-wk": "stampbadge", style: { position: "absolute", left: "50%", top: -13, transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "3px 12px", borderRadius: 999, background: card.rarity === "SSR" ? "linear-gradient(135deg,#d9b57c,#B58C55)" : card.rarity === "SR" ? "#B58C55" : FRAME, color: "#FFF8E9", fontFamily: F_DISPLAY, fontSize: fs(12), letterSpacing: ".08em", boxShadow: "0 2px 6px rgba(57,56,47,.25)" } }, card.rarity + " · " + (card.rarity === "SSR" ? "急件" : card.rarity === "SR" ? "挂号" : "平信")),
            !url ? h("div", { "data-wk": "stampblank", style: { position: "absolute", inset: 6, borderRadius: 2, overflow: "hidden", pointerEvents: "none",
                background: "repeating-linear-gradient(135deg, rgba(122,106,82,.05) 0 2px, transparent 2px 9px), radial-gradient(circle at 50% 42%, #fbf5e6, #ece1c8 75%)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#5a4a32" } },
              h("div", { style: { position: "absolute", inset: 10, border: "1px solid rgba(122,106,82,.22)", borderRadius: 2 } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: fs(10), letterSpacing: ".4em", opacity: .55 } }, card.kind === "if" ? "如 果" : card.kind === "bday" || card.kind === "mybday" ? "生 日" : card.kind === "anniv" ? "纪 念" : "日 常"),
              h("div", { style: { marginTop: 10, fontFamily: F_DISPLAY, fontSize: fs(26), letterSpacing: ".12em" } }, tx ? tx.name : "……"),
              h("div", { style: { width: 36, height: 1, margin: "12px 0", background: "rgba(122,106,82,.4)" } }),
              h("div", { style: { fontFamily: F_BODY, fontSize: fs(11.5), opacity: .7 } }, char ? (char.remark || char.name) : ""),
              h("div", { style: { marginTop: 18, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: fs(12), opacity: .45 } }, drawing ? "正在显影……" : "这一刻还没显影"),
              h("div", { style: { position: "absolute", left: 16, bottom: 14, fontFamily: F_BODY, fontSize: fs(9.5), opacity: .55 } }, "第 " + String(no).padStart(3, "0") + " 枚")) : null,
            h("div", { key: "pm" + pop, "data-wk": "stamppostmark", style: { position: "absolute", right: 14, bottom: 14, width: 54, height: 54, borderRadius: 999, border: "1.5px solid " + (url ? "rgba(255,248,233,.9)" : COPPER), color: url ? "rgba(255,248,233,.95)" : COPPER, transform: "rotate(-14deg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: fs(8.5), lineHeight: 1.25, pointerEvents: "none", animation: pop ? "stStampDown .45s cubic-bezier(.3,1.6,.5,1)" : "none" } },
              card.bdDay ? h(React.Fragment, null, h("div", null, card.kind === "anniv" ? "「" + (card.annivName || "纪念日") + "」" : "生日纪念"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(10) } }, (d => d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate())(new Date(card.bdDay))))
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
          !card.face ? h("button", { "data-wk": "stampdraw", disabled: !tx || drawing, onClick: () => onDraw(card.id), className: "active:opacity-70 disabled:opacity-40",
            style: { marginTop: 8, padding: "6px 14px", borderRadius: 999, border: "1px solid " + LINE, color: P7, fontFamily: F_BODY, fontSize: fs(12) } }, drawing ? "画着…" : "画卡面 · 花一次生图")
            : exSel && !exSel.img ? null
            : h("button", { "data-wk": "stampredraw", disabled: exSel ? exDrawing : drawing, onClick: () => exSel ? onExtraDraw && onExtraDraw(card.id, exSel.id) : onDraw(card.id, side !== "main", side !== "main" ? side : undefined), className: "active:opacity-70 disabled:opacity-40",
              style: { marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "1px solid " + LINE, color: P7, fontFamily: F_BODY, fontSize: fs(12) } }, (exSel ? exDrawing : drawing) ? "重画着…" : "↻ 照原来的描述重画这一面 · 花一次生图"),
          exSel && exSel.drawErr && !exDrawing ? h("div", { style: { marginTop: 6, maxWidth: 300, textAlign: "center", fontFamily: F_BODY, fontSize: fs(11), lineHeight: 1.5, color: "#b23a2e" } }, "番外卡面上次没画成：" + exSel.drawErr) : null,
          card.drawErr && !drawing ? h("div", { "data-wk": "stampdrawerr", style: { marginTop: 6, maxWidth: 300, textAlign: "center", fontFamily: F_BODY, fontSize: fs(11), lineHeight: 1.5, color: "#b23a2e" } }, "上次没画成：" + card.drawErr) : null,
          // SSR 满级：第二张卡面（一个人，或者你们俩），画好以后能翻面
          card.rarity === "SSR" && lv >= cap && tx ? h("div", { "data-wk": "stampalt", className: "flex flex-wrap justify-center", style: { gap: 8, marginTop: 8 } },
            side !== "main" ? h("button", { onClick: () => setSide("main"), className: "active:opacity-70", style: { padding: "6px 12px", borderRadius: 8, border: "1px solid " + COPPER, color: COPPER, fontFamily: F_BODY, fontSize: fs(12) } }, "看第一面") : null,
            [["solo", "他一个人"], ["duo", "你们俩"]].filter(x => card.kind !== "anniv" || x[0] === "duo").map(x => faces2[x[0]]
              ? (side === x[0] ? null : h("button", { key: x[0], onClick: () => setSide(x[0]), className: "active:opacity-70", style: { padding: "6px 12px", borderRadius: 8, background: COPPER, color: "#FFF8E9", fontFamily: F_BODY, fontSize: fs(12) } }, "看满级 · " + x[1]))
              : h("button", { key: x[0], disabled: drawing, onClick: () => { setSide(x[0]); onDraw(card.id, true, x[0]); }, className: "active:opacity-70 disabled:opacity-40",
                style: { padding: "6px 12px", borderRadius: 8, border: "1px dashed " + COPPER, color: COPPER, fontFamily: F_BODY, fontSize: fs(12) } }, "画满级卡面 · " + x[1]))) : null,
          // 番外卡面：每段写好的番外一颗，画了就能翻过去看，没画点了就画（不用满级）
          (card.extras || []).some(x => x.text) ? h("div", { "data-wk": "stampexface", className: "flex flex-wrap justify-center", style: { gap: 8, marginTop: 8 } },
            exSel && !(card.rarity === "SSR" && lv >= cap) ? h("button", { onClick: () => setSide("main"), className: "active:opacity-70", style: { padding: "6px 12px", borderRadius: 8, border: "1px solid " + COPPER, color: COPPER, fontFamily: F_BODY, fontSize: fs(12) } }, "看第一面") : null,
            (card.extras || []).filter(x => x.text).map(x => { const on = side === "ex:" + x.id, dr = !!(x.drawing && x.drawingBoot && x.drawingBoot === window.__stampBoot && Date.now() - (x.drawingTs || 0) < 8 * 60000);
              return x.img ? (on ? null : h("button", { key: x.id, onClick: () => setSide("ex:" + x.id), className: "active:opacity-70", style: { padding: "6px 12px", borderRadius: 8, background: "#8a6a3a", color: "#FFF8E9", fontFamily: F_BODY, fontSize: fs(12) } }, "看番外 ·「" + (x.title || "") + "」"))
                : h("button", { key: x.id, disabled: dr, onClick: () => { setSide("ex:" + x.id); onExtraDraw && onExtraDraw(card.id, x.id); }, className: "active:opacity-70 disabled:opacity-40",
                  style: { padding: "6px 12px", borderRadius: 8, border: "1px dashed #8a6a3a", color: "#8a6a3a", fontFamily: F_BODY, fontSize: fs(12) } }, dr ? "画着番外卡面…" : "画番外卡面 ·「" + (x.title || "") + "」"); })) : null,
          tx && (!card.writing || stale) ? h("button", { "data-wk": "stamprewrite", onClick: () => {
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
          tx.line ? h("div", { style: { marginTop: 10, textAlign: "center", fontFamily: F_DISPLAY, fontSize: fs(15), color: P } }, "「", h(BiText, { text: tx.line }), "」",
            // 点喇叭听他念这句（念过的存着，再听不花钱）
            typeof ttsSpeak === "function" && typeof ttsReady === "function" && typeof loadTtsApi === "function" && ttsReady(loadTtsApi()) ? h("button", { "data-wk": "stamplinesay", onClick: () => {
              const vid = (char && char.voiceId) || ttsDefaultVoice(loadTtsApi()); const sp = splitBilingual(String(tx.line)), line = sp ? sp.text : String(tx.line);
              ttsSpeak(line, vid).then(b => { const u = URL.createObjectURL(b), a2 = new Audio(u); a2.onended = () => URL.revokeObjectURL(u); a2.play(); }).catch(() => toast("没念出来，看看设置里的语音配好没有")); },
              style: { marginLeft: 6, fontSize: fs(13), opacity: .7 } }, "🔊") : null) : null,
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
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13), color: GOLD, marginBottom: 8 } }, openNode.zh), openNode.body) : null) : null,
        // 番外放在剧情最后面（她 2026-10-27）
        // 小剧场：从这张卡接着演（SR、SSR）。演过的线一条一张横着排，封面是那条线的剧照；最后一张虚线框开新的
        tx && (card.rarity === "SSR" || card.rarity === "SR") ? (() => { const ls = (typeof loadJSON === "function" ? loadJSON("x_theater", []) : []).filter(l => l && l.fromCard === card.id);
          const img = r => r ? (typeof resolveImg === "function" ? resolveImg(r) : r) : null;
          return h(React.Fragment, null,
            h("div", { className: "flex items-center", style: { marginTop: 22, gap: 10 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14), color: GOLD } }, "✦ 小剧场"),
              h("div", { style: { flex: 1, height: 1, background: LINE } })),
            h("div", { "data-wk": "stamptheater", className: "flex overflow-x-auto", style: { gap: 10, marginTop: 12, paddingBottom: 4, marginRight: -20, paddingRight: 20 } },
              ls.map(l => { const cv = img((l.endCard && l.endCard.img) || l.cover || l.bg); const n = (l.rounds || []).reduce((a, r) => a + (r.msgs || []).length, 0);
                return h("button", { key: l.id, "data-wk": "stamptheaterline", onClick: () => onTheaterLine && onTheaterLine(l.id), className: "shrink-0 text-left active:opacity-80",
                  style: { position: "relative", width: 150, minHeight: 168, borderRadius: 12, overflow: "hidden", border: "1px solid " + FRAME, background: cv ? "#222 center/cover no-repeat url(" + cv + ")" : "#FFF8E9", display: "flex", flexDirection: "column", justifyContent: "flex-end" } },
                  h("div", { style: { padding: "26px 12px 10px", background: cv ? "linear-gradient(transparent, rgba(0,0,0,.65))" : "none", color: cv ? "#FFF8E9" : P } },
                    h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13.5) } }, l.title || "小剧场"),
                    // 谢幕卡：他留的那一句印在剧照上，像一张明信片
                    l.ended && l.endCard && l.endCard.quote ? h("div", { "data-wk": "stamptheaterquote", style: { marginTop: 4, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: fs(11), lineHeight: 1.5, opacity: .95 } }, "「" + l.endCard.quote + "」") : null,
                    h("div", { style: { marginTop: 2, fontFamily: F_BODY, fontSize: fs(10.5), opacity: .75 } }, (l.ended ? "谢幕了" : "演到第 " + (l.rounds || []).length + " 轮") + " · " + n + " 拍"))); }),
              h("button", { "data-wk": "stamptheaternew", onClick: () => onTheater && onTheater(card), className: "shrink-0 active:opacity-70",
                style: { width: 150, minHeight: 168, borderRadius: 12, border: "1.5px dashed " + GOLD, color: GOLD, background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F_BODY, fontSize: fs(12.5) } },
                h("span", { style: { fontSize: fs(22), lineHeight: 1 } }, "＋"), "接着演", h("span", { style: { fontSize: fs(10.5), color: P5 } }, "从这张卡开一条小剧场")))); })() : null,
        // 番外：跟时刻回廊一个样子（她 2026-10-27）：标题＋横线，一段一张横着往右滑，最后一张虚线框写新的
        isExCard && tx ? h(React.Fragment, null,
          h("div", { className: "flex items-center", style: { marginTop: 22, gap: 10 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14), color: GOLD } }, "✦ 番外"),
            h("div", { style: { flex: 1, height: 1, background: LINE } })),
          h("div", { "data-wk": "stampextras", className: "flex overflow-x-auto", style: { gap: 10, marginTop: 12, paddingBottom: 4, marginRight: -20, paddingRight: 20 } },
            (card.extras || []).map((x, i) => h("div", { key: x.id, "data-wk": "stampextra", className: "shrink-0", style: { position: "relative", width: 150, minHeight: 168, padding: "11px 12px", borderRadius: 12, border: "1px solid " + (x.text ? FRAME : "rgba(178,58,46,.4)"), background: "#FFF8E9", display: "flex", flexDirection: "column", gap: 5 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: fs(18), color: GOLD } }, String(i + 1).padStart(2, "0")),
              x.text ? h(React.Fragment, null,
                h("button", { "data-wk": "stampextrarow", onClick: () => setExOpen(x.id), className: "text-left active:opacity-70", style: { flex: 1 } },
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(13.5), color: P } }, x.title || "番外"),
                  h("div", { style: { marginTop: 4, fontFamily: F_BODY, fontSize: fs(11), lineHeight: 1.55, color: P7, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" } }, String(x.text).replace(/\s+/g, " ").slice(0, 80))),
                h(ExtraActs, { x, onSend: () => onExtraSend && onExtraSend(card, x), onRewrite: () => { onExtra && onExtra(card.id, x.id); toast("在重写这段番外，不扣券"); } }))
              : x.writing ? h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: fs(12), color: P5 } }, "他在写这段番外…")
              : h("button", { onClick: () => onExtra && onExtra(card.id, x.id), className: "text-left active:opacity-70", style: { flex: 1, fontFamily: F_BODY, fontSize: fs(12), color: "#b23a2e" } }, "这段没写出来" + (x.err && x.err !== "没写出来" ? "（" + x.err + "）" : "") + "，点一下重写，不扣券"))),
            h("button", { "data-wk": "stampextranew", onClick: () => (C().load().extraTickets || 0) > 0 ? setExWish("") : setBuyOpen(true), className: "shrink-0 active:opacity-70",
              style: { width: 150, minHeight: 168, borderRadius: 12, border: "1.5px dashed " + COPPER, color: COPPER, background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: F_BODY, fontSize: fs(12.5) } },
              h("span", { style: { fontSize: fs(22), lineHeight: 1 } }, "＋"), "写一段新番外", h("span", { style: { fontSize: fs(10.5), color: P5 } }, "用一张番外券")))) : null),
      // 全屏看卡面：点空白处收起；满级 SSR 在这里戳——他的话固定在底下那个框里，不跟着手指跳
      full && url ? h("div", { "data-wk": "stampfull", className: "fixed inset-0 flex flex-col", onClick: () => setFull(false), style: { zIndex: 256, background: "rgba(20,18,14,.92)" } },
        h("div", { className: "flex-1 min-h-0 flex items-center justify-center", style: { padding: "calc(env(safe-area-inset-top) + 16px) 16px 8px" } },
          h("div", { style: { position: "relative", display: "inline-block", lineHeight: 0 } },
            h("img", { src: url, alt: "", onLoad: e => setFullWide(e.currentTarget.naturalWidth > e.currentTarget.naturalHeight * 1.1), style: { display: "block", maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100dvh - 190px)", width: "auto", height: "auto", borderRadius: 4, boxShadow: "0 0 0 3px #FFF8E9, 0 0 0 5px " + COPPER } }),
            canPoke ? h("div", { "data-wk": "stamppoke", onClick: e => { e.stopPropagation(); poke(e); }, style: { position: "absolute", inset: 0, cursor: "pointer" } }) : null)),
        // 横的原画（番外 CG）：「横过来看」整张转 90 度占满屏幕，手机横着拿看；点一下回来
        fullWide ? h("button", { "data-wk": "stamprotate", onClick: e => { e.stopPropagation(); setRot(true); }, className: "active:opacity-60", style: { position: "absolute", right: 14, top: "calc(env(safe-area-inset-top) + 14px)", padding: "4px 12px", borderRadius: 999, border: "1px solid rgba(255,248,233,.6)", color: "#FFF8E9", fontFamily: F_BODY, fontSize: fs(12) } }, "⟲ 横过来看") : null,
        rot ? h("div", { "data-wk": "stamprotview", onClick: e => { e.stopPropagation(); setRot(false); }, className: "fixed inset-0", style: { zIndex: 2, background: "#000" } },
          h("img", { src: url, alt: "", style: { position: "absolute", left: "50%", top: "50%", width: "100dvh", height: "100vw", objectFit: "contain", transform: "translate(-50%, -50%) rotate(90deg)" } })) : null,
        // 画了好几面：全屏里左右箭头直接换（她 2026-10-27：不用退出全屏再换），底下小点标着是哪一面
        (() => { const sides = [["main", url1, "第一面"], ["solo", urlSolo, "他一个人"], ["duo", urlDuo, "你们俩"]].concat((card.extras || []).filter(x => x.img).map(x => ["ex:" + x.id, x.img, "番外「" + (x.title || "") + "」"])).filter(x => x[1]);   // 番外按 key 列进来：翻走了也翻得回来 if (sides.length < 2) return null;
          const k = Math.max(0, sides.findIndex(x => x[0] === side)), go = d => e => { e.stopPropagation(); setSay(null); setFullWide(false); setSide(sides[(k + d + sides.length) % sides.length][0]); };
          const arrow = (d, pos) => h("button", { "data-wk": "stampfullnav", onClick: go(d), className: "active:opacity-60", style: Object.assign({ position: "absolute", top: "42%", width: 36, height: 56, borderRadius: 8, background: "rgba(255,248,233,.16)", color: "#FFF8E9", fontSize: 26, lineHeight: "56px", textAlign: "center" }, pos) }, d < 0 ? "‹" : "›");
          return h(React.Fragment, null, arrow(-1, { left: 6 }), arrow(1, { right: 6 }),
            h("div", { "data-wk": "stampfullside", onClick: e => e.stopPropagation(), style: { textAlign: "center", marginBottom: 8, fontFamily: F_BODY, fontSize: fs(11), color: "rgba(255,248,233,.75)" } },
              sides.map((x, i) => h("span", { key: x[0], style: { display: "inline-block", width: 6, height: 6, margin: "0 3px", borderRadius: 9, background: i === k ? "#FFF8E9" : "rgba(255,248,233,.3)" } })), "  " + sides[k][2])); })(),
        h("div", { "data-wk": "stamppokesay", onClick: e => e.stopPropagation(), style: { margin: "0 16px calc(env(safe-area-inset-bottom) * 0.4 + 16px)", minHeight: 72, padding: "12px 16px", borderRadius: 14, background: "#FFF8E9", border: "1px solid " + COPPER, color: P, fontFamily: F_BODY, fontSize: fs(14), lineHeight: 1.7 } },
          canPoke ? (poking ? h("span", { style: { color: P5 } }, "他在想怎么回你…") : say ? h(React.Fragment, null, h("div", { style: { fontSize: fs(10.5), color: COPPER, marginBottom: 2 } }, (char ? char.name : "") + (say.part === "head" ? " · 被戳了头" : say.part === "heart" ? " · 被戳了胸口" : " · 被戳了手")), say.text,
              h("button", { "data-wk": "stamppokevoice", onClick: e => { e.stopPropagation(); if (!speakPoke(say.text)) toast("要先在「设置」里配好语音"); }, style: { marginLeft: 6, fontSize: "0.9em", opacity: .7 } }, "🔊"))
            : h("span", { style: { color: P5 } }, "戳戳他：上面是头，中间是胸口，下面是手。点外面收起。"))
            : exSel ? h("span", { style: { color: P5 } }, "番外「" + (exSel.title || "") + "」。点外面或者「收起」。")
            : h("span", { style: { color: P5 } }, card.rarity === "SSR" ? "这张升满 " + cap + " 级以后，点卡面能戳他（头、胸口、手）。点外面收起。" : "点外面收起。"),

          // 最底下一排：左边保存原图，右边（满级戳过的）换一批话
          h("div", { className: "flex items-center justify-between", style: { marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(181,140,85,.35)" } },
            h("button", { "data-wk": "stampsaveimg", onClick: e => { e.stopPropagation(); const key = sideKey;
                (window.saveImgOriginal ? window.saveImgOriginal(key, (tx && tx.name) || "邮票卡面") : Promise.resolve(false)).then(ok => { if (!ok) toast("这张取不到原图"); }); },
              className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: GOLD, border: "1px solid " + GOLD, borderRadius: 999, padding: "3px 10px" } }, "保存原图"),
            (() => { const key = sideKey, on = (card.cover || card.face) === key;
              return h("button", { "data-wk": "stampsetcover", disabled: on, onClick: e => { e.stopPropagation(); setCover(key === card.face ? null : key); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: on ? P5 : COPPER, border: "1px solid " + (on ? "rgba(130,124,111,.4)" : COPPER), borderRadius: 999, padding: "3px 10px" } }, on ? "封面" : "改封面"); })(),
            h("button", { "data-wk": "stampfullclose", onClick: e => { e.stopPropagation(); setFull(false); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: P5, border: "1px solid rgba(130,124,111,.4)", borderRadius: 999, padding: "3px 10px" } }, "收起"),
            canPoke && card[side === "duo" ? "pokesDuo" : side === "solo" ? "pokesSolo" : "pokes"] && !poking ? h("button", { "data-wk": "stamppokeredo", onClick: e => { e.stopPropagation(); poke("redo"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: fs(11.5), color: COPPER, border: "1px solid " + COPPER, borderRadius: 999, padding: "3px 10px" } }, "↻ 这一面换一批话") : null))) : null,
      // 换番外券：说清楚是干嘛的，一次挑换几张
      buyOpen ? (() => { const ink = C().load().ink, maxN = Math.max(0, Math.floor(ink / C().EXTRA_INK)), n = Math.min(Math.max(1, buyN), Math.max(1, maxN));
        return h("div", { "data-wk": "stampextrabuy", onClick: () => setBuyOpen(false), className: "fixed inset-0 flex items-center justify-center", style: { zIndex: 258, background: "rgba(20,18,14,.55)", padding: 24 } },
          h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 340, padding: "18px 18px 14px", borderRadius: 14, background: "#FFF8E9", border: "1px solid " + COPPER } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(16), color: P } }, "番外券"),
            h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: fs(12.5), lineHeight: 1.7, color: P7 } }, "一张写一段番外：限定 SSR 故事外面的一段——结局之后的某一天、故事里没写到的那一晚，或者他那边没让你看到的部分。写的时候能点题，不填就由他挑。重写、写失败重来都不再扣券。"),
            h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: fs(12), color: P5 } }, "手上 " + exTk + " 张 · 印泥 " + ink + " · 一张 " + C().EXTRA_INK + " 印泥"),
            maxN > 0 ? h("div", { className: "flex items-center justify-center", style: { gap: 14, marginTop: 14 } },
              h("button", { onClick: () => setBuyN(Math.max(1, n - 1)), style: { width: 34, height: 34, borderRadius: 999, border: "1px solid " + COPPER, color: COPPER, fontSize: fs(18) } }, "−"),
              h("div", { style: { minWidth: 70, textAlign: "center", fontFamily: F_DISPLAY, fontSize: fs(20), color: P } }, n + " 张"),
              h("button", { onClick: () => setBuyN(Math.min(maxN, n + 1)), style: { width: 34, height: 34, borderRadius: 999, border: "1px solid " + COPPER, color: COPPER, fontSize: fs(18) } }, "+")) : h("div", { style: { marginTop: 14, textAlign: "center", fontFamily: F_BODY, fontSize: fs(12.5), color: "#b23a2e" } }, "印泥还差 " + (C().EXTRA_INK - ink) + "，多聊聊就攒起来了"),
            h("div", { className: "flex justify-end", style: { gap: 10, marginTop: 16 } },
              h("button", { onClick: () => setBuyOpen(false), style: { padding: "6px 14px", fontFamily: F_BODY, fontSize: fs(12.5), color: P5 } }, "算了"),
              maxN > 0 ? h("button", { "data-wk": "stampextrabuygo", onClick: () => { let k = 0; for (let i = 0; i < n; i++) if (C().buyExtra()) k++; setBuyOpen(false); toast("换好了 " + k + " 张番外券"); }, style: { padding: "6px 16px", borderRadius: 999, background: COPPER, color: "#FFF8E9", fontFamily: F_BODY, fontSize: fs(12.5) } }, "用 " + n * C().EXTRA_INK + " 印泥换") : null))); })() : null,
      // 写新番外：先问想看什么（可以不填），再扣券
      exWish != null ? h("div", { "data-wk": "stampextrawish", onClick: () => setExWish(null), className: "fixed inset-0 flex items-center justify-center", style: { zIndex: 258, background: "rgba(20,18,14,.55)", padding: 24 } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 340, padding: "18px 18px 14px", borderRadius: 14, background: "#FFF8E9", border: "1px solid " + COPPER } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(16), color: P } }, "写一段新番外"),
          h("textarea", { value: exWish, onChange: e => setExWish(e.target.value.slice(0, 200)), rows: 3, placeholder: "想看什么？比如「结局之后的某一天」「那天他那边是什么样」。不填就由他挑",
            style: { marginTop: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(181,140,85,.45)", background: "#fffaf0", fontFamily: F_BODY, fontSize: fs(13), color: P, resize: "none" } }),
          h("div", { className: "flex justify-between items-center", style: { marginTop: 10 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: fs(11.5), color: P5 } }, "用一张番外券 · 还有 " + exTk + " 张"),
            h("div", { className: "flex", style: { gap: 8 } },
              h("button", { onClick: () => setExWish(null), style: { padding: "5px 12px", fontFamily: F_BODY, fontSize: fs(12), color: P5 } }, "算了"),
              h("button", { onClick: () => { const s0 = C().load(); if (!(s0.extraTickets > 0)) { setExWish(null); setBuyOpen(true); return; } s0.extraTickets--; C().save(s0); onExtra && onExtra(card.id, null, exWish.trim()); setExWish(null); toast("用了一张番外券，他在写"); }, className: "active:opacity-70",
                style: { padding: "5px 14px", borderRadius: 999, background: COPPER, color: "#FFF8E9", fontFamily: F_BODY, fontSize: fs(12) } }, "写这一段"))))) : null,
      // 番外像剧情一样一句一句播（她 2026-10-27）：背景用番外插图，没画就用卡面；老的整段番外按段落拆成旁白
      exOpen && (card.extras || []).find(x => x.id === exOpen && x.text) ? (() => { const x = card.extras.find(e => e.id === exOpen);
        const beats = Array.isArray(x.beats) && x.beats.length ? x.beats : String(x.text).split(/\n+/).map(t0 => t0.trim()).filter(Boolean).map(t0 => ({ who: "narr", text: t0 }));
        const pc = Object.assign({}, card, { face: x.img || card.face, faceAlt: null, faces: x.img ? { solo: card.face } : {}, storyBg: "main", storyAt: null, text: Object.assign({}, card.text, { name: x.title || "番外", sections: [{ id: "ex_" + x.id, lv: 1, title: x.title || "番外", beats, choices: [], end: true, extra: true }] }) });
        return h(StoryReader, { t, card: pc, char, meName, lv: 99, start: "ex_" + x.id, noResume: true, onSeen: () => {}, onClose: () => setExOpen(null) }); })() : null,
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
  // 每期限时主题一套颜色：[海报底色, 字和边的亮色]。新的一期加一行，海报、左边小邮票、邮戳圈都跟着变（她 2026-10-27：「为啥每次都要截图才去补」）
  const LIM_TONE = { autumn: ["#4a2e1c", "#d9a25a"], onsen: ["#1f3a44", "#9fd0d6"], xmas: ["#1d3a2c", "#e3b65c"], newyear: ["#1f2a44", "#d8c7f0"], spring: ["#7a1f1a", "#f3c766"] };
  function StampBookApp(props) {
    const t = useTheme();
    const { characters, onBack, onWrite, onDraw, toast, meName } = props;
    const [st, setSt] = useState(() => C().load());
    const [tab, setTab] = useState("pull");
    const [pool, setPool] = useState("mix");
    const [pick, setPick] = useState(() => (C().load().opt.mixPick) || null);   // 大混池勾的人
    const [charId, setCharId] = useState((characters[0] || {}).id);
    const [show, setShow] = useState(null);
    const [open, setOpen] = useState(() => { const o = window.__stampsOpen; window.__stampsOpen = null; return o || null; });   // 从小剧场退回来：直接打开那张卡
    const [albumChar, setAlbumChar] = useState("all");
    const [albumRar, setAlbumRar] = useState("all");
    const [albumTheme, setAlbumTheme] = useState("all");   // 主题：日常 / 生日 / 你的生日 / IF 各主题
    const [albumPick, setAlbumPick] = useState("");        // 正弹着哪一个下拉：who / rar / theme
    const [week, setWeek] = useState(false);
    const [wkOpen, setWkOpen] = useState("");   // 「他的一周」里展开了哪一天的其他几张   // 他的一周：同一个人写好的 R 每攒够七张，按时间排成一页（第几周）   // 全部 / SSR / SR / R / bad（没写好）
    const [gotNote, setGotNote] = useState([]);
    const [cfg, setCfg] = useState(false);
    const [giftOpen, setGiftOpen] = useState(false);
    const testTap = useRef({ n: 0, t: 0 });
    const [begging, setBegging] = useState(false), [begLine, setBegLine] = useState("");
    const [paintDraft, setPaintDraft] = useState(null);
    const albumY = useRef(0), albumIds = useRef([]);   // 册子当前那一排（筛过的、照显示顺序），卡页左右滑照它走   // 册子翻到哪儿：点开一张看完回来，停在原来那儿（群里 2026-10-27：每次都跳回最上面）
    useEffect(() => { const f = () => setSt(C().load()); window.addEventListener("stamps-change", f); return () => window.removeEventListener("stamps-change", f); }, []);
    // 早先写的卡里带着「(R)」「(SR)」的，打开邮票册时洗一遍存回去（只动带标记或错栏的那几张）
    useEffect(() => { try { const st0 = C().load(); let n = 0;
      // 早先抽的限时卡补上 series 和年份（往年同系列靠它找）
      st0.cards = st0.cards.map(c => { if (!c.limited || c.series) return c; const L = (C().LIMITED || []).find(x => x.id === c.limited); n++; return Object.assign({}, c, { series: (L && L.series) || c.limited, limYear: L ? new Date(Date.parse(L.from)).getFullYear() : undefined }); });
      // 早先写坏的：该是一段字的栏被写成了对象（SR「开头」「接着」全空），洗成字
      st0.cards = st0.cards.map(c => { if (!c.text || c.rarity === "SSR") return c; const bad = ["open", "rest", "sequel", "hidden", "his", "line", "narration", "thought", "real", "sound", "back"].some(k => c.text[k] && typeof c.text[k] === "object"); if (!bad) return c; n++; return Object.assign({}, c, { text: C().cleanText(c.text, c.rarity) }); });
      st0.cards = st0.cards.map(c => { if (!c.text || c.rarity === "SSR" && !/[（(]\s*S?S?R\s*[）)]/.test(JSON.stringify(c.text))) return c; const t2 = C().cleanText(c.text, c.rarity); if (JSON.stringify(t2) === JSON.stringify(c.text)) return c; n++; return Object.assign({}, c, { text: t2 }); });
      if (n) C().save(st0); } catch (e) {} }, []);
    useEffect(() => { const got = C().grantOnOpen(Date.now(), characters.map(c => { const w = c.birthday ? C().bdayWindow(c.birthday, Date.now(), c.id) : null; return w ? { id: c.id, name: c.remark || c.name, year: w.year } : null; }).filter(Boolean)
      .concat((props.myBdays || []).map(m => { const w = m.birthday ? C().bdayWindow(m.birthday, Date.now(), "me_" + m.id) : null; return w ? { id: "me_" + m.id, name: "你（" + (m.name || "你") + "）", year: w.year } : null; }).filter(Boolean)),
      (() => { const lp = ((C().load().opt || {}).limPick || []).filter(id => characters.some(c => c.id === id)); return lp.length || characters.length; })()); if (got.length) { setGotNote(got); setSt(C().load()); } }, []);
    const lims = C().activeLimited(Date.now());
    // 生日池：他生日前 14 天出现，生日后留 7 天；保底和求情按「这个人这一年」单独记
    const bds = characters.map(c => { const w = c.birthday ? C().bdayWindow(c.birthday, Date.now(), c.id) : null; return w ? { char: c, win: w, key: c.id + "_" + w.year } : null; }).filter(Boolean)
      // 她自己的生日池：每张面具一个，抽的是认这张面具的那几个人；卡都是你们俩的
      .concat((props.myBdays || []).map(m => { const w = m.birthday ? C().bdayWindow(m.birthday, Date.now(), "me_" + m.id) : null; const ids = (m.charIds || []).filter(id => characters.some(c => c.id === id));
        return w && ids.length ? { char: { id: "me_" + m.id, name: m.name || "你", remark: m.name || "你", avatar: m.avatar }, win: w, key: "me_" + m.id + "_" + w.year, mine: true, maskId: m.id, charIds: ids } : null; }).filter(Boolean))
      // 纪念日池（她 2026-10-26）：情侣空间里跟他的纪念日，前 14 天出现、后留 7 天；只抽他一个人，每一张都是你们俩
      .concat((props.annivs || []).map(a => { const c = characters.find(x => x.id === a.charId), w = c && a.md ? C().bdayWindow(a.md, Date.now(), "an_" + a.id) : null;
        return w ? { char: c, win: w, key: "an_" + a.id + "_" + w.year, pid: "an_" + a.id, anniv: { id: a.id, name: a.name || "纪念日", since: a.since || 0, n: a.since ? w.year - new Date(a.since).getFullYear() : 0 } } : null; }).filter(Boolean));
    const bd = pool.indexOf("bd:") === 0 ? bds.find(b => "bd:" + (b.pid || b.char.id) === pool) : null;
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
    // 手上两种券都有时，这个池子这次用哪种：她点过就记在 opt.tkPref[池子]；没点过＝先用生日券、纪念日券
    const bothTk = C().bdTicketCount(st) > 0 && st.tickets > 0 && !opt.testInf, useTen = bothTk && (opt.tkPref || {})[pool] === "ten";
    const bdPool = bd ? (bd.mine ? "mybday" : bd.anniv ? "anniv" : "bday") : "";
    const doPull = async (n, ticket) => {
      const s = C().load();
      if (pool === "char" && !charTheme.trim()) { toast("先给 TA 写一个主题"); return; }
      if (pool === "char" && (thDraft != null || thLineDraft != null)) s.opt = Object.assign({}, s.opt, { charTheme: Object.assign({}, s.opt.charTheme, { [charId]: charTheme }), charThemeLine: Object.assign({}, s.opt.charThemeLine, { [charId]: charThemeLine }) });
      const pool0 = bd ? (bd.mine ? (mbOne ? [mbOne] : bd.charIds) : [bd.char.id]) : pool === "mix" ? mixIds : pool === "char" ? [charId] : (lim ? (limOne ? [limOne] : limIds) : []);
      if (!pool0.length) { toast("先挑几个角色"); return; }
      const how = opt.testInf ? "test" : C().pay(s, n, ticket, bd && (bd.mine || bd.anniv) ? bd.key : null, useTen);   // 测试券：她自己试味道用，藏在设置里连点七下「规则」
      if (!how) { toast("邮资不够：单抽 " + C().PRICE_ONE + "，十连 " + C().PRICE_TEN + "。多聊聊天就攒起来了"); return; }
      const now = Date.now(), cards = [];
      for (let i = 0; i < n; i++) {
        const rar = bd ? C().rollRarity(s, { bday: bd.key, isDay: bd.win.isDay }) : C().rollRarity(s);
        // 出了 SSR、池里又不止一个人：八成落到这池里 SSR 最少的人身上（限定池一期一人一张，免得老抽到重复；大混池先补齐、再补张数少的）
        let cid = pool0[Math.floor(Math.random() * pool0.length)];
        if (rar === "SSR" && pool0.length > 1) {
          const have = id => s.cards.concat(cards).filter(x => x.rarity === "SSR" && !x.dupe && x.charId === id && (lim ? x.limited === lim.id : bd ? (x.pool === bdPool && x.bdDay === bd.win.day) : pool === "mix" ? x.pool === "mix" : true));
          // 谁在这池里的 SSR 最少就先补谁（都有了以后也一样：先补张数少的）
          const cnt = {}; pool0.forEach(id => { cnt[id] = have(id).length; });
          const least = Math.min.apply(null, pool0.map(id => cnt[id])), fresh = pool0.filter(id => cnt[id] === least);
          if (fresh.length && Math.random() < 0.8) cid = fresh[Math.floor(Math.random() * fresh.length)];
        }
        const card = { id: uid(), ts: now + i, rarity: rar, charId: cid, lv: 1, pool: bd ? bdPool : pool === "char" ? "char" : lim ? "limited" : "mix",
          kind: bd ? bdPool : pool === "mix" ? "daily" : "if", writing: true, writingTs: now, unread: true };
        if (pool === "char") Object.assign(card, { theme: charTheme.trim().slice(0, 40), themeLine: charThemeLine.slice(0, 200), ifMode });
        if (bd) Object.assign(card, { bdDay: bd.win.day }, bd.mine ? { maskId: bd.maskId } : {}, bd.anniv ? { annivId: bd.anniv.id, annivName: bd.anniv.name, annivN: bd.anniv.n } : {});
        if (lim) Object.assign(card, { theme: lim.name, themeLine: lim.line, themeLook: lim.look || "", limited: lim.id, series: lim.series || lim.id, limYear: new Date(Date.parse(lim.from)).getFullYear(), ifMode });
        // 限定（限时池一期、生日池一年）每人只有一张 SSR：再抽到就是重复，不写新卡，折成印泥
        const same = rar === "SSR" && (lim || bd) ? s.cards.concat(cards).find(x => x.rarity === "SSR" && !x.dupe && x.charId === cid && (lim ? x.limited === lim.id : x.pool === bdPool && x.bdDay === bd.win.day && (!bd.mine || x.maskId === bd.maskId) && (!bd.anniv || x.annivId === bd.anniv.id))) : null;
        if (same) { s.ink += C().DUPE_INK; cards.push(Object.assign({}, same, { id: uid(), ts: now + i, dupe: true, dupeOf: same.id })); continue; }
        cards.push(card);
      }
      const fresh = cards.filter(c => !c.dupe);
      s.cards = s.cards.concat(fresh);
      C().save(s); setSt(s);
      setShow(cards);
      if (cards.length > fresh.length) { toast("有 " + (cards.length - fresh.length) + " 枚重复的限定 SSR，折成了 " + (cards.length - fresh.length) * C().DUPE_INK + " 印泥，原来那张多一段番外");
        cards.filter(c => c.dupe && c.dupeOf).forEach(c => props.onExtra && props.onExtra(c.dupeOf)); }
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
    if (open) { const card = (st.cards || []).find(c => c.id === open) || null; if (card) return h(CardPage, { key: card.id, onSwipe: d => { const ids = albumIds.current, k = ids.indexOf(card.id); if (k < 0) return; const nx = ids[k + d]; if (nx) setOpen(nx); else toast(d > 0 ? "已经是最后一张了" : "已经是第一张了"); }, t, card, char: charOf(card.charId), meName, onBack: () => setOpen(null), onDraw, onRewrite: c => onWrite([c]), toast, onPoke: (c, sd) => props.onPoke ? props.onPoke(c, sd) : null, onInner: c => props.onInner ? props.onInner(c) : null, onExtra: (id, xid, wish) => props.onExtra ? props.onExtra(id, xid, wish) : null, onExtraSend: (c, x) => props.onExtraSend && props.onExtraSend(c, x), onTheater: c => props.onTheater && props.onTheater(c), onTheaterLine: id => props.onTheaterLine && props.onTheaterLine(id, card.id), onExtraDraw: (id, xid) => props.onExtraDraw ? props.onExtraDraw(id, xid) : null,
      onSend: c => { props.onSend && props.onSend(c); }, onCanon: c => { props.onCanon && props.onCanon(c); } }); }

    const isBad = c => !c.text && (!c.writing || Date.now() - Number(c.writingTs || 0) > (c.queued ? 1800000 : 180000));
    const byChar = (st.cards || []).filter(c => albumChar === "all" || c.charId === albumChar);
    const themeOf = c => c.kind === "if" ? (c.theme || "IF") : c.kind === "bday" ? "生日" : c.kind === "mybday" ? "你的生日" : c.kind === "anniv" ? "纪念日" : "日常";
    const album = byChar.filter(c => (albumRar === "all" || (albumRar === "bad" ? isBad(c) : albumRar === "extra" ? (c.extras || []).some(x => x.text) : c.rarity === albumRar)) && (albumTheme === "all" || themeOf(c) === albumTheme)).slice().reverse();
    if (tab === "album") albumIds.current = album.map(c => c.id);
    // ── 卡池页像乙游那样：一整张大海报（一枚放大的邮票），左边一列小邮票换池，底下两颗大键；其余设置收进「⋯」 ──
    const NIGHT = "#15121f", PAPER = "#f4ecda", GOLD = "#e3b65c";
    const pools = [{ key: "mix", zh: "大混池", tag: "常驻 · 日常卡" }, { key: "char", zh: "角色池", tag: "常驻 · IF 卡" }]
      .concat(bds.map(b => ({ key: "bd:" + (b.pid || b.char.id), zh: (b.char.remark || b.char.name) + (b.anniv ? "「" + b.anniv.name + "」" : "的生日"), tag: b.anniv ? "纪念日 · 你们俩" : "生日 · 日常卡", bd: b })))
      .concat(lims.map(L => ({ key: "lim:" + L.id, zh: L.name, tag: "限时 · IF 卡", lim: L })));
    const cur = pools.find(p => p.key === pool) || pools[0];
    const charNow = charOf(charId);
    const faces = bd ? (bd.mine ? (mbOne ? [mbOne] : bd.charIds).map(charOf).filter(Boolean) : [bd.char]) : pool === "mix" ? mixIds.map(charOf).filter(Boolean) : pool === "char" ? (charNow ? [charNow] : []) : (limOne ? [charOf(limOne)] : limIds.map(charOf)).filter(Boolean);
    // 生日池每人一点自己的颜色：有人设色用人设色，没有就按 id 算一个色相；只动海报里的辅助色，齿孔和版式不变
    const hx = (hh, ss, ll) => { ll /= 100; const a2 = ss * Math.min(ll, 1 - ll) / 100, f = n => { const k = (n + hh / 30) % 12; return Math.round(255 * (ll - a2 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); }; return "#" + f(0) + f(8) + f(4); };
    const hueOf = c => { const m = /^#([0-9a-f]{6})$/i.exec(c.color || ""); if (m) { const r = parseInt(m[1].slice(0, 2), 16) / 255, g2 = parseInt(m[1].slice(2, 4), 16) / 255, b2 = parseInt(m[1].slice(4), 16) / 255, mx = Math.max(r, g2, b2), mn = Math.min(r, g2, b2); if (mx === mn) return 330; const d = mx - mn; const hh = mx === r ? ((g2 - b2) / d) % 6 : mx === g2 ? (b2 - r) / d + 2 : (r - g2) / d + 4; return Math.round(hh * 60 + 360) % 360; } let x = 0; for (const ch of String(c.id)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x % 360; };
    const bdHue = bd ? hueOf(bd.char) : 0;
    const ann = !!(bd && bd.anniv);
    // 生日券和纪念日券记在同一个 bdTickets 里（纪念日的 key 以 an_ 开头），名字照手上有的那种叫
    const tkKeys = Object.keys(st.bdTickets || {}).filter(k => st.bdTickets[k] > 0), tkName = tkKeys.length && tkKeys.every(k => k.indexOf("an_") === 0) ? "纪念日券" : tkKeys.some(k => k.indexOf("an_") === 0) ? "生日券、纪念日券" : "生日券";   // 纪念日池：玫瑰色一套，跟生日池分得开（她 2026-10-27）
    const acc = ann ? "#f3bfcc" : bd ? hx(bdHue, 48, 80) : "#e6b8a2";
    const tone = ann ? ["#4a1a2c", "#f3bfcc"] : bd ? [hx((bd ? hueOf(bd.char) : 0), 28, 22), hx((bd ? hueOf(bd.char) : 0), 50, 80)] : pool === "mix" ? ["#2f4a46", "#7fa79a"] : pool === "char" ? [((charNow && charNow.color) || "#4a3d6b"), "#b9a7e0"] : (cur.lim && LIM_TONE[cur.lim.deco] ? LIM_TONE[cur.lim.deco] : ["#3a1f3d", "#e08a3a"]);
    const testInf = !!opt.testInf;
    const perf = c => "radial-gradient(circle at 6px 6px, transparent 4.6px, " + c + " 5px) -6px -6px / 12px 12px";
    // 限时池的节日装饰：只加在边角，不动整张模板（现在只有万圣夜：蝙蝠、南瓜、星星、蛛网）
    const deco = cur.lim && cur.lim.deco === "halloween";
    const fall = cur.lim && cur.lim.deco === "autumn";
    const steam = cur.lim && cur.lim.deco === "onsen", xmas = cur.lim && cur.lim.deco === "xmas", nyr = cur.lim && cur.lim.deco === "newyear", cny = cur.lim && cur.lim.deco === "spring";   // 圣诞：墨绿底、金边   // 温泉：几缕热气从海报下沿往上飘，顶上一点雪   // 深秋：几片银杏和枫叶从海报上沿飘下来
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
    const titleLen = bd ? (bd.char.remark || bd.char.name).length + (bd.anniv ? bd.anniv.name.length + 2 : 2) : pool === "char" ? charTheme.trim().length + 2 : cur.zh.length;
    const annDays = bd && bd.anniv && bd.anniv.since ? Math.floor((Date.now() - bd.anniv.since) / 86400000) + 1 : 0;
    const hook = bd && bd.anniv ? (bd.win.isDay ? (annDays ? "在一起的第 " + annDays + " 天。每一张都是你们俩。" : "就是今天。这一池的每一张，都是你们俩。") : (bd.anniv.n > 0 ? "第 " + bd.anniv.n + " 年" : "那一天") + "快到了。这一池，每一张都是你们俩。") : bd && bd.mine ? (bd.win.isDay ? "生日快乐。今天这一池，每一张都是他们陪你过的。" : "你的生日快到了。这一池里的每一张，都是他们陪你过的那几天。") : bd ? (bd.win.isDay ? "就是今天。一年只有这一天，今年的他会留下什么样的瞬间？" : "一年只有一次的日子快到了。今年的他，又会留下什么不一样的瞬间？") : pool === "mix" ? "不同的人，不同的故事。下一封会是谁寄来的？" : pool === "char" ? (charThemeLine.trim() || (charNow ? "如果 " + (charNow.remark || charNow.name) + " 活在「" + (charTheme.trim() || "另一个世界") + "」里——" : "")) : (cur.lim.hook || cur.lim.line.split("。")[0] + "。");
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
        steam ? [0, 1, 2].map(k => h("svg", { key: "st" + k, viewBox: "0 0 20 60", style: { position: "absolute", left: (22 + k * 26) + "%", bottom: 40, width: 22, height: 70, opacity: .28, pointerEvents: "none" } },
          h("path", { d: "M10 58 C 2 46, 18 38, 10 26 S 4 8, 12 2", stroke: "#e8f4f4", strokeWidth: 2.2, fill: "none", strokeLinecap: "round" })))
          .concat([[12, 18], [60, 40], [150, 24], [210, 60], [90, 90], [240, 110]].map((q, i) => h("span", { key: "sn" + i, style: { position: "absolute", left: q[0], top: q[1], width: 4, height: 4, borderRadius: 9, background: "#fff", opacity: .5 } }))) : null,
        // 圣诞：几片小雪花从上沿慢慢飘（很淡、很慢），右上角挂一小枝冬青
        xmas ? [h("style", { key: "xs" }, "@keyframes stSnow{0%{transform:translateY(-20px);opacity:0}15%{opacity:.7}100%{transform:translateY(460px);opacity:0}}")]
          .concat([[14, 0, 9], [34, 3.5, 11], [52, 7, 8], [68, 1.8, 12], [84, 5.2, 10], [24, 9, 9], [76, 11, 11]].map((q, i) => h("span", { key: "xf" + i, style: { position: "absolute", left: q[0] + "%", top: 0, width: i % 3 ? 4 : 6, height: i % 3 ? 4 : 6, borderRadius: 9, background: "#fff", opacity: 0, animation: "stSnow " + q[2] + "s linear " + q[1] + "s infinite", pointerEvents: "none" } })))
          .concat([h("svg", { key: "holly", viewBox: "0 0 40 30", style: { position: "absolute", right: 14, top: 14, width: 46, height: 34, opacity: .9, pointerEvents: "none" } },
            h("path", { d: "M20 16 C 12 4, 4 8, 2 4 C 6 12, 4 16, 8 18 C 6 22, 12 24, 20 16 Z", fill: "#2f6a48" }),
            h("path", { d: "M20 16 C 28 4, 36 8, 38 4 C 34 12, 36 16, 32 18 C 34 22, 28 24, 20 16 Z", fill: "#3c7a56" }),
            h("circle", { cx: 17, cy: 19, r: 3, fill: "#b8323a" }), h("circle", { cx: 23, cy: 19.5, r: 3, fill: "#c9404a" }), h("circle", { cx: 20, cy: 23.5, r: 3, fill: "#a82a33" }))]) : null,
        // 新年：几颗很淡的金色烟火点，一闪一闪
        nyr ? [h("style", { key: "nys" }, "@keyframes stSpark{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:.75;transform:scale(1.1)}}")].concat([[70, 14, 0], [86, 30, 1.2], [62, 40, 2.1], [80, 62, .6], [12, 74, 1.7], [24, 86, .9]].map((q, i) => h("svg", { key: "fw" + i, viewBox: "0 0 20 20", style: { position: "absolute", left: q[0] + "%", top: q[1] + "%", width: i % 2 ? 14 : 20, height: i % 2 ? 14 : 20, animation: "stSpark 3.2s ease-in-out " + q[2] + "s infinite", pointerEvents: "none" } },
          [0, 45, 90, 135].map(a => h("line", { key: a, x1: 10, y1: 2, x2: 10, y2: 18, stroke: "#e8d49a", strokeWidth: 1.2, strokeLinecap: "round", transform: "rotate(" + a + " 10 10)" }))))) : null,
        // 年前：右上角一盏小红灯笼，左下一个很淡的斗方「福」
        cny ? [h("svg", { key: "lan", viewBox: "0 0 30 50", style: { position: "absolute", right: 18, top: 0, width: 34, height: 58, pointerEvents: "none" } },
            h("line", { x1: 15, y1: 0, x2: 15, y2: 10, stroke: "#f0c060", strokeWidth: 1.2 }), h("rect", { x: 10, y: 9, width: 10, height: 3, rx: 1, fill: "#f0c060" }),
            h("ellipse", { cx: 15, cy: 24, rx: 11, ry: 12, fill: "#d8352a" }), h("path", { d: "M15 12 V36 M9 14 Q5 24 9 34 M21 14 Q25 24 21 34", stroke: "#a8221a", strokeWidth: 1, fill: "none" }),
            h("rect", { x: 10, y: 35, width: 10, height: 3, rx: 1, fill: "#f0c060" }), h("path", { d: "M12 38 V48 M15 38 V50 M18 38 V48", stroke: "#f0c060", strokeWidth: 1 }))]
          .concat([h("div", { key: "fu", style: { position: "absolute", left: "10%", top: "64%", width: 54, height: 54, transform: "rotate(45deg)", border: "1.5px solid #f3c766", borderRadius: 3, opacity: .16, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" } },
            h("span", { style: { transform: "rotate(-45deg)", fontFamily: F_DISPLAY, fontSize: 30, color: "#f3c766" } }, "福"))]) : null,
        fall ? [leaf("72%", 10, 26, -20, "#d9a25a", "l1"), leaf("86%", 52, 18, 30, "#c06a3a", "l2", 1), leaf("60%", 86, 14, 60, "#e3c06a", "l3"), leaf(8, "70%", 22, -40, "#c06a3a", "l4", 1), leaf("80%", "78%", 20, 15, "#d9a25a", "l5")] : null,
        // 生日：边上一层淡金光，底下藏两道很淡的丝带
        bd ? h("svg", { key: "rib", viewBox: "0 0 100 160", preserveAspectRatio: "none", style: { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .16, pointerEvents: "none" } },
          h("path", { d: "M-5 120 C 25 95, 45 140, 70 112 S 105 90, 110 100", stroke: acc, strokeWidth: 1.2, fill: "none" }),
          h("path", { d: "M-5 132 C 30 110, 50 152, 75 124 S 105 104, 110 114", stroke: acc, strokeWidth: .7, fill: "none" })) : null,
        bd ? h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 0 1px rgba(230,184,162,.35), inset 0 0 40px rgba(230,184,162,.18)" } }) : null,
        h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "14px 16px 12px" } },
        h("div", { style: { paddingRight: pool === "char" ? 64 : 0, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: ".2em", color: tone[1] } }, bd ? "特别投递 · " + bd.win.year : cur.tag),
          h("div", { "data-wk": "stampbannertitle", style: { marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: F_DISPLAY, fontSize: "calc(" + (titleLen > 6 ? 18 : titleLen > 4 ? 21 : 24) + "px * var(--app-fs, 1))", lineHeight: 1.15, color: PAPER, textShadow: "0 2px 12px rgba(0,0,0,.5)" } },
            bd ? h(React.Fragment, null, bd.char.remark || bd.char.name, h("span", { style: { fontSize: "0.62em", marginLeft: 4, opacity: .85 } }, bd.anniv ? "「" + bd.anniv.name + "」" : "的生日")) : pool === "char" ? (charTheme.trim() ? "「" + charTheme.trim() + "」" : "还没写主题") : cur.zh,
            bd ? h("span", { style: { marginLeft: 6, fontSize: "calc(16px * var(--app-fs, 1))", color: acc, verticalAlign: "super", textShadow: "0 0 10px " + acc + "" } }, "✦") : null),
          bd ? h("div", { style: { marginTop: 3, fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".3em", color: acc, opacity: .6 } }, ann ? "你们俩 · 一年一次" : "生日限定 · 一年一次") : null,
          h("div", { "data-wk": "stampbannerhook", style: { marginTop: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.5, color: "rgba(244,236,218,.88)", whiteSpace: "pre-line" } }, hook),
          h("div", { style: { flex: 1, minHeight: 0, display: "flex", justifyContent: "center", alignItems: "center", paddingBottom: 0 } }, faceRow),
          h("div", { className: "flex items-end justify-between", style: { gap: 8 } },
          // 邮戳：常驻写「常驻」；限时写截止日和还剩多久，万圣夜那枚是南瓜色的限定戳
          h("div", { "data-wk": "stampcountdown", style: { order: 2, flexShrink: 0, marginLeft: "auto", width: bd ? 62 : regular ? 88 : 72, height: bd ? 62 : regular ? 48 : 72, marginBottom: bd ? 18 : 0, borderRadius: regular ? 4 : 999,
            backgroundImage: regular ? "repeating-linear-gradient(0deg, transparent 0 5px, rgba(227,182,92,.13) 5px 6px)" : "none", border: (deco ? "2px dashed #e08a3a" : fall ? "2px dashed #d9a25a" : cur.lim && LIM_TONE[cur.lim.deco] ? "2px dashed " + LIM_TONE[cur.lim.deco][1] : regular ? "1.5px double " + GOLD : bd ? "2px double " + acc + "" : "2px solid " + GOLD), outline: deco ? "1px solid #e08a3a66" : bd ? "1px dashed " + acc + "88" : "none", outlineOffset: 3, color: deco ? "#f0a24f" : bd ? acc : GOLD, transform: regular ? "rotate(-5deg)" : "rotate(-12deg)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, textAlign: "center", lineHeight: 1.25 } },
            cur.bd ? h(React.Fragment, null, h("div", { style: { fontSize: "calc(9.5px * var(--app-fs, 1))" } }, cur.bd.anniv ? "纪念邮戳" : "生日邮戳"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, (d => (d.getMonth() + 1) + "." + d.getDate())(new Date(cur.bd.win.day))), h("div", { style: { fontSize: "calc(9px * var(--app-fs, 1))" } }, String(cur.bd.win.year)))
            : cur.lim ? h(React.Fragment, null, h("div", { style: { fontSize: "calc(9.5px * var(--app-fs, 1))" } }, deco ? "万圣夜限定" : fall ? "深秋限定" : steam ? "温泉限定" : xmas ? "圣诞限定" : cur.lim.deco === "newyear" ? "新年限定" : cur.lim.deco === "spring" ? "年前限定" : "限定"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, new Date(Date.parse(cur.lim.to) - 1).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " 止"), h("div", { style: { fontSize: "calc(9px * var(--app-fs, 1))" } }, "还剩 " + leftText(Date.parse(cur.lim.to) - Date.now())))
              : h(React.Fragment, null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))", letterSpacing: ".15em" } }, "常驻发行"), h("div", { style: { fontSize: "calc(9px * var(--app-fs, 1))", opacity: .85 } }, "已收录 " + (st.cards || []).length + " 枚"))),
          h("div", { style: { order: 1, minWidth: 0, paddingBottom: 4, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.6, color: "rgba(244,236,218,.6)" } },
            bd ? h("span", { style: { whiteSpace: "nowrap", color: acc } }, (bd.anniv ? "纪念日限定" : "生日限定") + " · 距结束 " + leftText(bd.win.close - Date.now())) : pool === "mix" ? "" : pool === "char" ? "IF 卡 · 衣服照主题来" : "IF 卡 · 每人只有一张限定 SSR"))),
        pool === "char" ? h("button", { onClick: () => setCfg(true), className: "active:opacity-70", style: { position: "absolute", right: 14, top: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid " + tone[1], color: tone[1], fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, "改主题") : null));
    // 左边一列小邮票：换池。选中的那枚像从邮册里抽出来一截：放大、往右探出去
    const rail = h("div", { "data-wk": "stamprail", className: "flex flex-col shrink-0 overflow-y-auto", style: { gap: 8, width: 72, padding: "6px 12px 10px 0", maxHeight: "calc(min(56vh, 440px) + 18px)", scrollbarWidth: "none" } },
      pools.map(p => { const on = p.key === pool, hal = p.lim && p.lim.deco === "halloween", xm = p.lim && LIM_TONE[p.lim.deco];   // 每期左边那枚小邮票跟海报一套颜色
        return h("button", { key: p.key, "data-wk": "stamprailitem", "data-on": on ? "1" : "0", onClick: () => setPool(p.key), className: "active:opacity-80",
          style: { width: 60, height: 72, flexShrink: 0, padding: 4, background: perf(on ? (p.bd && p.bd.anniv ? "#f3bfcc" : p.bd ? "#e6b8a2" : hal ? "#e08a3a" : xm ? xm[1] : GOLD) : p.bd && p.bd.anniv ? "rgba(243,191,204,.75)" : p.bd ? "rgba(230,184,162,.75)" : hal ? "rgba(224,138,58,.7)" : xm ? xm[1] + "99" : "rgba(244,236,218,.8)"), transform: on ? "translateX(10px) scale(1.08) rotate(-2deg)" : "none", transition: "transform .25s", zIndex: on ? 2 : 1,
            filter: on ? "drop-shadow(0 6px 12px rgba(0,0,0,.5))" : "none" } },
          h("div", { style: { width: "100%", height: "100%", borderRadius: 2, background: p.bd && p.bd.anniv ? (on ? "#5a1f34" : "#4a2433") : p.bd ? (on ? "#4a2a3a" : "#3d2c38") : hal ? (on ? "#3a1f3d" : "#3a2830") : xm ? (on ? xm[0] : xm[0] + "cc") : on ? NIGHT : "#3a3448", color: on ? (p.bd && p.bd.anniv ? "#f3bfcc" : p.bd ? "#e6b8a2" : hal ? "#f0a24f" : xm ? xm[1] : GOLD) : PAPER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center",
            fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.25, padding: 3, gap: 3 } },
            p.bd ? (p.bd.char.remark || p.bd.char.name).slice(0, 4) : p.zh, h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", opacity: .7 } }, p.lim ? "限时" : p.bd ? (p.bd.anniv ? "纪念" : "生日") : "常驻"))); }));
    // 钱包：不用药丸（她 2026-10-26），做成一张张小票根——方角、左右两个半圆缺口、虚线分隔，名字小字在上、数在下
    const capsule = (k, v, tone) => h("span", { key: k, "data-wk": "stampwallet", style: { position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", minWidth: 50, padding: "3px 10px 4px", borderRadius: 3,
        background: tone ? tone.bg : "#FFF8E9", border: "1px solid " + (tone ? tone.line : "rgba(87,119,103,.4)"), boxShadow: "0 1px 0 rgba(57,56,47,.08)", color: tone ? tone.ink : "#2f2a22", lineHeight: 1.15,
        WebkitMaskImage: "radial-gradient(circle at 0 50%, transparent 4px, #000 4.5px), radial-gradient(circle at 100% 50%, transparent 4px, #000 4.5px)", WebkitMaskComposite: "source-in", maskComposite: "intersect" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", letterSpacing: ".1em", opacity: .65, borderBottom: "1px dashed " + (tone ? tone.line : "rgba(87,119,103,.35)"), paddingBottom: 1, marginBottom: 1 } }, k),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(13px * var(--app-fs, 1))" } }, v));
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
        h(Eyebrow, { style: { color: "rgba(47,42,34,.55)", marginTop: 18 } }, "今天的信由谁来寄（不勾就是所有人里随机）"),
        peoplePick((opt.letterPick || []).filter(id => characters.some(c => c.id === id)), (id, on) => { const cu = opt.letterPick || []; setOpt({ letterPick: on ? cu.filter(x => x !== id) : cu.concat(id) }); }),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 18 } },
          h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#2f2a22" } }, "今天的信带他一句话"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, opt.letterLine ? "开着：每天寄信的那个人顺手写一两句附言，一天多一次调用" : "关着：只寄券，不花调用")),
          h(Toggle, { on: !!opt.letterLine, onChange: () => setOpt({ letterLine: !opt.letterLine }) })),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 18 } },
          h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#2f2a22" } }, "抽到就画卡面"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, opt.autoDraw ? "开着：每张都画，十连就是十次生图" : "关着：点开哪张、想看再画哪张，省钱")),
          h(Toggle, { on: !!opt.autoDraw, onChange: () => setOpt({ autoDraw: !opt.autoDraw }) })),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 18 } },
          h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#2f2a22" } }, "信寄进聊天"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, opt.noLetters ? "关着：今天的信、生日信、纪念日信、里程碑信都不在聊天里发，券直接到账" : "开着：他把信寄进你们的私聊，点「领取」才到账")),
          h(Toggle, { on: !opt.noLetters, onChange: () => setOpt({ noLetters: !opt.noLetters }) })),
        // SSR 剧情里你少开口（群里 2026-10-27）：开着＝正文里你基本不说话，你的部分都在选项里，往前推的是他
        h("div", { className: "flex items-center justify-between", style: { marginTop: 18 } },
          h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#2f2a22" } }, "剧情里你少开口"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, opt.meQuiet ? "开着：SSR 正文里你基本不说话，你的部分都在选项里，剧情由他往前推" : "关着：正文里你也会说几句")),
          h(Toggle, { on: !!opt.meQuiet, onChange: () => setOpt({ meQuiet: !opt.meQuiet }) })),
        h("button", { onClick: () => { const r = testTap.current, now = Date.now(); r.n = now - r.t < 900 ? r.n + 1 : 1; r.t = now; if (r.n >= 7) { r.n = 0; setOpt({ testInf: !testInf }); toast(testInf ? "测试券关了" : "测试券开了：抽卡不花邮资和券，盖印不花印泥"); } },
          style: { display: "block", marginTop: 22, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: "#2f2a22", background: "transparent", border: "none", padding: 0 } }, "规则"),
        // 规则（她 2026-10-27：写好看点）：分几块，一块一个小标题；数字从 StampsCore 里取，改了常量这儿跟着变
        (() => { const G = C().GAIN, F = C().FULL_COST, B = C().BDAY;
          const blk = (title, rows) => h("div", { "data-wk": "stamprules", style: { marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(255,248,233,.65)", border: "1px solid rgba(47,42,34,.1)" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#285C4B", letterSpacing: ".15em", marginBottom: 4 } }, title),
            rows.map((r, k) => h("div", { key: k, className: "flex", style: { gap: 10, padding: "3px 0", borderTop: k ? "1px dashed rgba(47,42,34,.1)" : "none", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.6, color: "rgba(47,42,34,.78)" } },
              h("span", { style: { flex: 1, minWidth: 0 } }, r[0]), r[1] != null ? h("span", { style: { flexShrink: 0, textAlign: "right", color: "#2f2a22", fontVariantNumeric: "tabular-nums" } }, r[1]) : null)));
          const pi = k => G[k][0] + " / " + G[k][1];
          return h("div", null,
            blk("三档卡", [["R　你不在时，他一个人的一刻"], ["SR　你俩的一小段，卡上印着他一句台词"], ["SSR　分节、带选项的剧情，等级越高路越多"]]),
            blk("概率与保底", [["R / SR / SSR", "70% / 25% / 5%"], ["SSR 保底（所有常驻和限时池通用）", "60 抽必出"], ["50 抽起 SSR 概率往上加"], ["每十抽至少一张", "SR"],
              ["生日池、纪念日池 SSR", Math.round(B.rate * 100) + "%，当天 " + Math.round(B.dayRate * 100) + "%"], ["生日池、纪念日池保底（单独算）", B.hard + " 抽必出"],
              ["限定 SSR 每人一期（一年）一张，重复的折成", C().DUPE_INK + " 印泥"]]),
            blk("寄一封 · 寄一版", [["单抽", C().PRICE_ONE + " 邮资"], ["十连", C().PRICE_TEN + " 邮资"], ["单抽先用单抽券"],
              ["十连先用生日券、纪念日券，再用十连券；没有券时单抽券一张顶 " + C().PRICE_ONE + "，不够的拿邮资补"], ["两种券都有时，寄一版上面能挑这次用哪种"]]),
            blk("从哪来 · 右边是 邮资 / 印泥", [["聊天、群聊、通话一轮", pi("round")], ["线下一拍", pi("beat")], ["论坛、片刻、广场、朋友圈发一条或评论", pi("public")], ["匿名信箱、情书、交换日记这些两个人的小事", pi("duo")],
              ["一起听、一起看、一起读、查手机、看他玩手机", pi("stay")], ["同人、梦境、擂台、跑团、塔罗这些别的玩法", pi("play")], ["他主动发来一条", G.nudge[0] + " 邮资"], ["情侣空间甜蜜打卡（每人每天一次）", pi("sweet")], ["把邮票发给他看，他回了你", G.share[1] + " 印泥"], ["都没有上限；重 roll 的不算"]]),
            blk("他寄来的信（在私聊里点「领取」）", [["今天的信：每天一个人寄一张", "单抽券"], ["限时池上新：每两个人一张，最多五张", "十连券＋同样多番外券"], ["他的生日池出现", "1 张十连券"], ["你的生日", "10 张生日券"], ["在一起的纪念日", "5 张纪念日券"],
              ["在一起了、满 100 / 520 / 1000 天，甜蜜值 10 / 30 / 50 / 100", "十连券，一辈子一次"], ["每张十连都配", C().INK_PER_TEN + " 印泥"]]),
            blk("盖印升满一张", [["R", F.R + " 印泥"], ["SR", F.SR + " 印泥"], ["SSR", F.SSR + " 印泥"]])); })(),
        testInf ? h("div", { style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: RC.SSR } }, "测试券开着：抽卡不花邮资和券、盖印不花印泥（连点七下「规则」关掉）") : null));
    if (tab === "album") return h("div", { "data-wk": "stampalbumpage", "data-page": "1", className: "h-full flex flex-col overflow-hidden", style: { background: "repeating-linear-gradient(180deg, transparent 0 116px, rgba(47,42,34,.07) 116px 117px, transparent 117px 120px), linear-gradient(#f1e9d8, #e9dfca)" } },
      h(Head, { zh: "邮票册", sub: (st.cards || []).length + " 枚", bg: "transparent", ink: "#2f2a22", onBack: () => setTab("pull") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5", ref: el => { if (el && !el.__y) { el.__y = 1; el.scrollTop = albumY.current; } }, onScroll: e => { albumY.current = e.currentTarget.scrollTop; }, style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        // 一行三个下拉（她 2026-10-26：分类一行行往下加太高、往右滑不方便）：点开在下面弹一小块，选项换行平铺
        (() => { const chs = characters.filter(c => (st.cards || []).some(x => x.charId === c.id));
          const thAll = Array.from(new Set((st.cards || []).filter(c => albumChar === "all" || c.charId === albumChar).map(themeOf)));
          const lab = { who: albumChar === "all" ? "全部" : ((charOf(albumChar) || {}).remark || (charOf(albumChar) || {}).name || "?"), rar: albumRar === "all" ? "全部" : albumRar === "bad" ? "没写好" : albumRar === "extra" ? "有番外" : albumRar, theme: albumTheme === "all" ? "全部" : albumTheme };
          const pill = (k, zh) => h("button", { key: k, "data-wk": "stampfilter", "data-part": k, "data-on": albumPick === k ? "1" : "0", onClick: () => setAlbumPick(albumPick === k ? "" : k), className: "flex-1 min-w-0 active:opacity-70",
            style: { padding: "7px 8px", borderRadius: 8, border: "1px solid " + (albumPick === k || lab[k] !== "全部" ? "#2f5d4a" : "rgba(47,42,34,.22)"), background: lab[k] !== "全部" ? "rgba(47,93,74,.08)" : "transparent", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, zh + "：" + lab[k] + " ▾");
          const opts = albumPick === "who" ? [["all", "全部 " + (st.cards || []).length]].concat(chs.map(c => [c.id, (c.remark || c.name) + " " + st.cards.filter(x => x.charId === c.id).length]))
            : albumPick === "rar" ? [["all", "全部"], ["SSR", "SSR"], ["SR", "SR"], ["R", "R"]].concat(byChar.some(c => (c.extras || []).some(x => x.text)) ? [["extra", "有番外"]] : []).concat(byChar.some(isBad) ? [["bad", "没写好"]] : []).map(x => [x[0], x[1] + " " + (x[0] === "all" ? byChar.length : x[0] === "bad" ? byChar.filter(isBad).length : x[0] === "extra" ? byChar.filter(c => (c.extras || []).some(e => e.text)).length : byChar.filter(c => c.rarity === x[0]).length)])
            : albumPick === "theme" ? [["all", "全部"]].concat(thAll.map(t2 => [t2, t2 + " " + byChar.filter(c => themeOf(c) === t2).length])) : [];
          const cur = albumPick === "who" ? albumChar : albumPick === "rar" ? albumRar : albumTheme;
          const set = v => { if (albumPick === "who") { setAlbumChar(v); setAlbumTheme("all"); } else if (albumPick === "rar") setAlbumRar(v); else setAlbumTheme(v); setAlbumPick(""); };
          return h("div", { style: { paddingTop: 10 } },
            h("div", { className: "flex", style: { gap: 6 } }, pill("who", "人"), pill("rar", "稀有度"), pill("theme", "主题")),
            albumPick ? h("div", { "data-wk": "stampfilterpanel", className: "flex flex-wrap", style: { gap: 6, marginTop: 8, padding: 10, borderRadius: 10, background: "#FFF8E9", border: "1px solid rgba(87,119,103,.3)", boxShadow: "0 4px 14px rgba(57,56,47,.08)" } },
              opts.map(o => chip(cur === o[0], o[1], () => set(o[0]), o[0]))) : null); })(),
        (() => { const ds = albumChar === "all" ? [] : weekDays(st, albumChar), wks = Math.floor(ds.length / 7);
          return albumChar !== "all" && ds.length ? h("button", { "data-wk": "stampweekbtn", "data-full": wks ? "1" : "0", onClick: () => setWeek(Math.ceil(ds.length / 7)), className: "w-full active:opacity-70", style: { marginTop: 10, minHeight: 40, borderRadius: 10, background: "#FFF8E9", border: "1px solid #577767", color: "#285C4B", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "翻他的一周 · " + (wks ? "攒满 " + wks + " 周" : "") + (ds.length % 7 ? (wks ? "，" : "") + "这一周 " + (ds.length % 7) + " / 7 天" : "")) : null; })(),
        // 写失败的（或者写了三分钟还没回来的）一起重写：同一个人的 R、SR 还是并成一次调用，SSR 各一次
        (() => { const bad = (st.cards || []).filter(c => !c.text && (!c.writing || Date.now() - Number(c.writingTs || 0) > (c.queued ? 1800000 : 180000)));
          return bad.length ? h("button", { "data-wk": "stamprewriteall", onClick: () => { onWrite(bad); toast("在重写 " + bad.length + " 张"); }, className: "w-full active:opacity-70",
            style: { marginTop: 12, minHeight: 40, borderRadius: 10, border: "1px dashed #b23a2e", color: "#b23a2e", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, "有 " + bad.length + " 张没写好 · 一起重写") : null; })(),
        album.length ? h("div", { "data-wk": "stampalbum", className: "grid", style: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 14, justifyItems: "center" } },
          album.map(c => { const ch = albumChar === "all" ? charOf(c.charId) : null;   // 「全部」时每枚下面写是谁的
            return h("div", { key: c.id, className: "flex flex-col items-center", style: { gap: 3, minWidth: 0 } }, h("div", { style: { position: "relative" } }, h(StampFace, { t, card: c, size: 88, onClick: () => setOpen(c.id) }),
                // 没点开过的：右上角一个小点，淡淡的（她 2026-10-27：不要太明显）
                // 有番外的 SSR：右上角折起一个小角（她 2026-10-27：纸边太显眼）
                (c.extras || []).some(x => x.text) ? h("span", { "data-wk": "stampextratab", style: { position: "absolute", right: 5, top: 5, width: 14, height: 14, background: "linear-gradient(225deg, #ece3cf 0 50%, #d9c9a6 50% 100%)", boxShadow: "-1px 1px 2px rgba(40,30,20,.25)", borderBottomLeftRadius: 2, pointerEvents: "none" } }) : null,
                c.unread ? h("span", { "data-wk": "stampunread", style: { position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: 999, background: "rgba(181,140,85,.75)", pointerEvents: "none" } }) : null),
              // 每枚下面：星（养到哪儿了）、谁的、什么主题（群里许愿 2026-10-26）
              (() => { const cp = C().CAP[c.rarity] || 30, all = Math.round(cp / 10), on = Math.min(all, Math.floor((c.lv || 1) / 10));
                return h("div", { "data-wk": "stampstarsmini", style: { fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: ".1em", color: "#285C4B", lineHeight: 1 } }, Array.from({ length: all }, (_, k) => k < on ? "★" : "☆").join("")); })(),
              h("div", { "data-wk": "stampwho", style: { maxWidth: 92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(47,42,34,.62)" } },
                [ch ? (ch.remark || ch.name) : "", c.kind === "if" ? (c.theme || "IF") : c.kind === "bday" ? "生日" : c.kind === "mybday" ? "你的生日" : c.kind === "anniv" ? "纪念日" : "日常"].filter(Boolean).join(" · "))); }))
          : h("div", { style: { padding: "48px 0", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } }, "还没有邮票，去寄一封")),
      week ? (() => { const ch = charOf(albumChar); const all = byChar.filter(c => c.rarity === "R" && c.text).sort((x, y) => (x.ts || 0) - (y.ts || 0));
        const ds = weekDays(st, albumChar), weeks = Math.ceil(ds.length / 7), wk = Math.min(weeks, Math.max(1, Number(week) || 1));
        const rs = ds.slice((wk - 1) * 7, wk * 7).map(d => Object.assign({}, d.card, { _day: d.day, _all: d.all })), full = rs.length === 7;
        const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"], md = ts => { const d = new Date(ts); return (d.getMonth() + 1) + "." + d.getDate(); };
        const fz = n => "calc(" + n + "px * var(--app-fs, 1))", INK = "#39382F", SUB = "#827C6F", CU = "#B58C55", GR = "#285C4B";
        const tag = c => c.kind === "bday" ? "生日" : c.kind === "mybday" ? "你的生日" : c.kind === "anniv" ? "纪念日" : c.kind === "if" ? "IF「" + (c.theme || "") + "」" : "日常";
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
        capsule("邮资", st.postage), capsule("印泥", st.ink), (st.singles || 0) > 0 ? capsule("单抽券", st.singles) : null,
        C().bdTicketCount(st) > 0 ? capsule((tkName === "纪念日券" ? "💌 " : "🎂 ") + tkName, C().bdTicketCount(st), { bg: "linear-gradient(120deg, #fbe9e4, #f6e7c8)", line: "#c98f74", ink: "#8a3a4a" }) : null, capsule("十连券", testInf ? "∞（手上 " + st.tickets + " 张）" : st.tickets)),
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
        bd && (bd.mine || bd.anniv) && C().bdTicketCount(st) > 0 ? h("div", { "data-wk": "stampbdticket", style: { position: "relative", margin: "12px 20px 4px", padding: "12px 14px 12px 64px", borderRadius: 8, overflow: "hidden",
            background: "linear-gradient(120deg, #fbe9e4, #FFF8E9 55%, #f6e7c8)", border: "1.5px dashed #c98f74", boxShadow: "0 4px 14px rgba(160,97,74,.15)" } },
          h("div", { style: { position: "absolute", left: 10, top: "50%", marginTop: -22, width: 44, height: 44, borderRadius: 999, border: "1.5px double #b23a2e", color: "#b23a2e", transform: "rotate(-12deg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: "calc(9px * var(--app-fs, 1))", lineHeight: 1.2, background: "rgba(255,248,233,.8)" } },
            h("div", null, bd.anniv ? "纪念" : "生日"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(11px * var(--app-fs, 1))" } }, (d => (d.getMonth() + 1) + "." + d.getDate())(new Date(bd.win.day)))),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: "#8a3a4a" } }, tkName + " × " + C().bdTicketCount(st) + "  ·  十连"),
          h("div", { style: { marginTop: 3, fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: "#6b4a3a" } },
            bd.anniv ? "「" + bd.anniv.name + "」快乐。这一池里的每一封，都是你们俩的。" : "生日快乐，" + (bd.char.name || "你") + "。这一池里的每一封，都是他们寄给你的；愿你新的一岁，被好好地爱着。")) : null,
        h("div", { style: { margin: "12px 0 6px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: "rgba(47,42,34,.6)" } },
          bd ? (() => { const b = st.bday[bd.key] || {}, n = b.since || 0, H = C().BDAY.hard;
              if (b.got) return bd.anniv ? "今年的纪念日 SSR 已经到手了" : bd.mine ? "今年你的生日 SSR 已经到手了" : "今年他的生日 SSR 已经到手了";
              return h("div", { "data-wk": "stamppity", style: { maxWidth: 300, margin: "0 auto" } },
                h("div", { className: "flex justify-between", style: { color: "#a0614a" } }, h("span", null, ann ? "纪念日 SSR 保底" : "生日 SSR 保底"), h("span", null, n + " / " + H)),
                h("div", { style: { marginTop: 4, height: 3, borderRadius: 9, background: "rgba(47,42,34,.12)" } }, h("div", { style: { width: Math.min(100, n / H * 100) + "%", height: "100%", borderRadius: 9, background: "linear-gradient(90deg,#c98f74,#f6dcc8)" } })),
                h("div", { style: { marginTop: 4 } }, b.force ? "求过情了，下一封就是他的生日 SSR" : "再寄出 " + Math.max(1, H - n) + " 封，必得" + (bd.anniv ? "一张你们的纪念日 SSR" : bd.mine ? "一张你的生日 SSR" : "他的生日 SSR"))); })()
            : "再抽 " + Math.max(1, ssrLeft) + " 次一定出 SSR · 每十抽至少一张 SR"),
        lim || bd ? h("div", { "data-wk": "stamplimitnote", style: { margin: "-2px 0 6px", textAlign: "center", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: "rgba(47,42,34,.5)" } },
          (lim ? "这一期" : "这个生日") + "每个人只有一张限定 SSR，再抽到他的就折成 " + C().DUPE_INK + " 印泥") : null,
        bd && !bd.mine && !bd.anniv && C().canBeg(st, bd.key) ? h("div", { className: "flex justify-center" }, h("button", { "data-wk": "stampbeg", disabled: begging, onClick: () => doBeg(), className: "active:opacity-70 disabled:opacity-50",
          style: { marginTop: 2, padding: "6px 16px", borderRadius: 999, border: "1px solid #b0566e", color: "#b0566e", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, begging ? "他在想…" : "去跟他求个情")) : null,
        begLine ? h("div", { "data-wk": "stampbegline", onClick: () => setBegLine(""), style: { margin: "8px 20px 0", padding: "10px 14px", borderRadius: 12, background: "rgba(176,86,110,.12)", border: "1px solid rgba(176,86,110,.4)", color: "#2f2a22", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.7 } }, begLine) : null),
      // 底下两颗大键
      bothTk ? h("div", { "data-wk": "stamptkpick", className: "flex shrink-0 justify-end", style: { gap: 6, padding: "6px 16px 0" } },
        [["bd", tkName + " ×" + C().bdTicketCount(st)], ["ten", "十连券 ×" + st.tickets]].map(x => { const on = (x[0] === "ten") === useTen;
          return h("button", { key: x[0], "data-on": on ? "1" : "0", onClick: () => setOpt({ tkPref: Object.assign({}, opt.tkPref, { [pool]: x[0] }) }), className: "active:opacity-70",
            style: { padding: "3px 10px", borderRadius: 4, border: "1px " + (on ? "solid" : "dashed") + " " + (x[0] === "bd" ? "#c98f74" : "#3c7a60"), background: on ? (x[0] === "bd" ? "#fbe9e4" : "#e2ece4") : "transparent", color: x[0] === "bd" ? "#8a3a4a" : "#2a5242", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))" } }, x[1]); })) : null,
      h("div", { "data-wk": "stamppullbar", className: "flex shrink-0 px-4", style: { gap: 10, padding: "10px 16px calc(env(safe-area-inset-bottom) * 0.4 + 12px)" } },
        h("button", { "data-wk": "stamppullbtn", "data-part": "one", onClick: () => doPull(1), className: "flex-1 active:opacity-80",
          style: { minHeight: 56, borderRadius: 16, border: "1.5px solid #2f2a22", color: "#2f2a22", background: "transparent", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))" } },
          "寄一封", h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .75 } }, testInf ? "测试券" : (st.singles || 0) > 0 ? "用单抽券 · 持有 " + st.singles + " 张" : C().PRICE_ONE + " 邮资")),
        h("button", { "data-wk": "stamppullbtn", "data-part": "ten", onClick: () => doPull(10, st.tickets > 0), className: "flex-1 active:opacity-80",
          style: { minHeight: 56, borderRadius: 16, background: C().bdTicketCount(st) > 0 && !testInf && !useTen ? "linear-gradient(160deg, #c98f74, #8a3a4a)" : "linear-gradient(160deg, #3c7a60, #2a5242)", color: "#f6efe0", fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", boxShadow: "0 4px 18px rgba(47,93,74,.3)" } },
          "寄一版", h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", opacity: .8 } }, testInf ? "测试券" : C().bdTicketCount(st) > 0 && !useTen ? "用" + tkName + " · 还有 " + C().bdTicketCount(st) + " 张" : st.tickets > 0 ? "用十连券 · 持有 " + st.tickets + " 张" : (st.singles || 0) > 0 ? (st.singles >= 9 ? "用 9 张单抽券" : "用 " + st.singles + " 张单抽券＋" + (9 - st.singles) * C().PRICE_ONE + " 邮资") : C().PRICE_TEN + " 邮资"))),
      show ? h(PullShow, { t, cards: show.map(c => c.dupe ? c : (st.cards || []).find(x => x.id === c.id) || c), onDone: () => setShow(null), onOpen: c => { setShow(null); setOpen(c.id); }, charOf }) : null);
  }
  window.StampBookApp = StampBookApp;
})();
