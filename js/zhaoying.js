// 照影页面那半（她 2026-10-22「就照影吧宝宝做吧」）：开机那半（题库、计分、存档）在 js/zhaoying-core.js。
// 挑一个人、挑一套题：
//   · 让他做——像查手机看他玩那样，一题一题看着他选；他选的时候心里那句（心声）落在那一题底下，整套留档。
//   · 我来做——自己一题题点。两个人都做过同一套，就能并排对一对。
//   · 都能重做；他重做时知道自己前几次测出了什么。
(function () {
  const g = typeof window !== "undefined" ? window : globalThis;
  const Z = g.Zhaoying;
  const PAPER = "#f6f1ea", INK = "#3b332a", FOG = "#9a8a76", LINE = "#e2d8ca", ACC = "#b0764a";

  function ZhaoyingApp(props) {
    const t = useTheme();
    // 这一页的几支底色接主题工作台的「这一页的颜色」（她 2026-10-22「这页的美化顺便做了」）：没改过就是原来的纸色
    const { PAPER, INK, FOG, LINE, ACC } = Z.colors();
    const chars = (props.characters || []).filter(c => c && !c.npc);
    const [who, setWho] = useState(chars[0] ? chars[0].id : "me");      // 在看谁的
    const [testId, setTestId] = useState(null);                         // 点开的那一套
    const [run, setRun] = useState(null);       // { mode:"char"|"me", testId, picks, whys, step, shown, done, busy }
    const [openRec, setOpenRec] = useState(null);
    const [tick, bump] = useState(0);
    const [compare, setCompare] = useState(false);
    const [edit, setEdit] = useState(null);     // 正在出／改的那套题（草稿，存了才算）
    const [gen, setGen] = useState({ theme: "", count: 10, busy: false });
    const [scene, setScene] = useState("");        // 换个处境再做：这一次的前提，空＝平时
    const [guess, setGuess] = useState(-1);        // 排序／拍卖：发出去之前押他的第一（她 2026-10-23）
    const [badgeOpen, setBadgeOpen] = useState(false);
    const [genMode, setGenMode] = useState("");      // 让他出题：""＝写给我的，"open"＝大家都能做
    const [sendTo, setSendTo] = useState("");        // 自己做完发给谁看
    const [groupLie, setGroupLie] = useState(false); // 群里一起做时每人撒一题谎
    const [busyWho, setBusyWho] = useState("");    // 他在出题 / 群里谁在做
    // 分类：记得上次停在哪一类（她 2026-10-22「搞个分类」）
    const [cat, setCatS] = useState(() => { try { return (typeof loadJSON === "function" && loadJSON("x_zyCat", "all")) || "all"; } catch (e) { return "all"; } });
    // 记着的那一类空了（比如自己出的题都删了）就回到全部
    const curCat = cat !== "all" && !Z.allTests().some(tt => Z.catOf(tt) === cat) ? "all" : cat;
    // 「自己出的」里按出题人筛：""＝都看，"me"＝我出的，角色 id＝他出的；只在这一页里记着，不存
    const [byWho, setByWho] = useState("");
    // 「最近做过」收起来（她 2026-10-23）：记着，下次进来还是收着
    const [recFold, setRecFoldS] = useState(() => { try { return !!(typeof loadJSON === "function" && loadJSON("x_zyRecentFold", false)); } catch (e) { return false; } });
    const setRecFold = v => { setRecFoldS(v); try { typeof saveJSON === "function" && saveJSON("x_zyRecentFold", v); } catch (e) {} };
    const setCat = c => { setCatS(c); setByWho(""); try { typeof saveJSON === "function" && saveJSON("x_zyCat", c); } catch (e) {} };

    // 从「最近做过」点进来：滚到翻开的那一次
    const jumpRec = useRef("");
    useEffect(() => { if (!jumpRec.current || !testId) return; const id = jumpRec.current; jumpRec.current = ""; setTimeout(() => { try { const el = document.querySelector('[data-rec="' + id + '"]'); el && el.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) {} }, 80); }, [testId]);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const char = chars.find(c => c.id === who) || null;
    const meName = props.meName || "我";
    const nameOf = id => id === "me" ? meName : ((chars.find(c => c.id === id) || {}).remark || (chars.find(c => c.id === id) || {}).name || "TA");
    const test = testId ? Z.byId(testId) : null;

    // ── 看着他一题题选 ──
    const play = (r, step) => {
      clearTimeout(timer.current);
      const tt = Z.byId(r.testId);
      if (step >= tt.qs.length) { finish(r); return; }
      setRun(Object.assign({}, r, { step, shown: false }));
      timer.current = setTimeout(() => {
        setRun(x => x ? Object.assign({}, x, { shown: true }) : x);
        timer.current = setTimeout(() => play(r, step + 1), 1700 + Math.min(1600, (r.whys[step] || "").length * 45));
      }, 900);
    };
    // 自己做到一半退出：存着，下次接着做（她 2026-10-23「跟小游戏一样」）；每套只留一份，做完就清
    //   存档那一份收在 core（Z.drafts / Z.saveDraft），删题时也从那儿一起清
    const drafts = Z.drafts, saveDraft = Z.saveDraft;
    const finish = r => {
      clearTimeout(timer.current);
      if (r.mode === "me") saveDraft(r.testId, null);
      const res = Z.resultOf(r.testId, r.picks, r.bids);
      if (res.free) { res.title = "做完了"; res.line = ""; }
      Z.addRecord(r.who, { testId: r.testId, ts: Date.now(), picks: r.picks, whys: r.whys || [], code: res.code, title: res.title, line: res.line, free: !!res.free, ...(r.bids ? { bids: r.bids } : {}), ...(r.fills ? { fills: r.fills } : {}) });
      setRun(Object.assign({}, r, { done: true, res, step: Z.byId(r.testId).qs.length }));
      bump(x => x + 1);
    };
    const startMe = fresh => { if (!test) return; const d = !fresh && drafts()[test.id];
      if (fresh) saveDraft(test.id, null);
      setRun(Object.assign({ mode: "me", who: "me", testId: test.id, picks: [], whys: [], step: 0, ...(test.bid ? { bids: test.qs.map(() => 0) } : {}), ...(test.fill ? { fills: [] } : {}) }, d || {})); };
    const mePick = (p, fillText) => setRun(r => {
      const picks = r.picks.concat([p]);
      const next = Object.assign({}, r, { picks, step: r.step + 1 }, r.fills ? { fills: r.fills.concat([String(fillText || "").trim()]) } : {});
      if (picks.length >= Z.byId(r.testId).qs.length) { setTimeout(() => finish(next), 0); } else saveDraft(r.testId, next);
      return next;
    });
    // 退一题：做错了能改（存档也跟着退）
    const meBack = () => setRun(r => { if (!r || !r.step) return r; const next = Object.assign({}, r, { picks: r.picks.slice(0, -1), step: r.step - 1 }, r.fills ? { fills: r.fills.slice(0, -1) } : {}); saveDraft(r.testId, next); return next; });
    const [fillDraft, setFillDraft] = useState("");
    const [note, setNote] = useState("");          // 做完想跟出题的他说的那句（她 2026-10-23）
    const [lie, setLie] = useState(false);         // 这次让他偷偷撒一题谎

    const pill = (on, label, fn, wk) => h("button", { "data-wk": wk || "zychip", "data-on": on ? "1" : "0", onClick: fn, className: "active:opacity-70 shrink-0",
      style: { padding: "6px 12px", borderRadius: 999, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", border: "1px solid " + (on ? INK : LINE), background: on ? INK : "transparent", color: on ? PAPER : INK } }, label);
    // 答题卡上那颗圈：涂上了就是选了
    const bubble = on => h("span", { style: { flexShrink: 0, width: 14, height: 14, borderRadius: 999, border: "1.5px solid " + (on ? ACC : "#cbbca9"), background: on ? ACC : "transparent", boxShadow: on ? "inset 0 0 0 2px #fffaf3" : "none", transition: "all .25s" } });
    const whyStyle = live => ({ marginTop: 8, padding: "6px 10px", borderLeft: "2px solid " + ACC, background: "rgba(176,118,74,.06)", borderRadius: "0 6px 6px 0", fontFamily: F_BODY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#6f5f4d", lineHeight: 1.65, whiteSpace: "pre-wrap", animation: live ? "wkpop .3s ease-out both" : undefined });
    // 挑人：一排小像，挑中的那张抬起来、描一圈
    const face = (on, c, label, fn) => h("button", { key: c ? c.id : "me", "data-wk": "zychip", "data-on": on ? "1" : "0", onClick: fn, className: "shrink-0 flex flex-col items-center active:opacity-70", style: { gap: 5, width: 56, opacity: on ? 1 : .62, transform: on ? "translateY(-2px)" : "none", transition: "all .2s" } },
      h("span", { style: { display: "block", padding: 2, borderRadius: 999, border: "1.5px solid " + (on ? ACC : "transparent") } },
        c ? h(Avatar, { character: c, size: 40, radius: 999 }) : h("span", { style: { display: "flex", width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", background: INK, color: PAPER, fontFamily: F_DISPLAY, fontSize: 15 } }, "我")),
      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: on ? INK : FOG, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, label));
    // 每套一张封面：测试小网站那种——一块有颜色的底、一个大符号、题数和用时、谁测过
    const pal = Z.pal;   // 颜色表收在 core 那一份，聊天里的卡也用它
    const cover = (tt, big) => {
      const c = pal(tt), done = [...chars.map(x => x.id), "me"].filter(id => Z.recordsOf(id, tt.id).length);
      return h("div", { "data-wk": "zycover", "data-test": tt.id, style: { position: "relative", overflow: "hidden", borderRadius: 18, padding: big ? "22px 18px 18px" : "18px 16px 14px", background: "linear-gradient(135deg, " + c.a + " 0%, " + c.b + " 100%)", boxShadow: "0 8px 22px -14px " + c.deep } },
        h("span", { "aria-hidden": true, style: { position: "absolute", right: -6, top: big ? -18 : -14, fontSize: big ? 120 : 92, lineHeight: 1, color: "rgba(255,255,255,.45)", fontFamily: F_DISPLAY, pointerEvents: "none" } }, c.g),
        h("div", { style: { position: "relative", fontFamily: F_BODY, fontSize: 11, letterSpacing: ".25em", color: c.deep } }, tt.qs.length + " 题 · 约 " + Math.max(1, Math.round(tt.qs.length / 4)) + " 分钟"),
        h("div", { style: { position: "relative", fontFamily: F_DISPLAY, fontSize: big ? "calc(26px * var(--app-fs, 1))" : "calc(21px * var(--app-fs, 1))", color: "#2e261e", marginTop: 6 } }, tt.name),
        h("div", { style: { position: "relative", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: "rgba(46,38,30,.72)", marginTop: 5, lineHeight: 1.6, maxWidth: "82%" } }, tt.sub),
        tt.by ? h("div", { "data-wk": "zyby", style: { position: "relative", fontFamily: F_BODY, fontSize: 11.5, color: c.deep, marginTop: 4 } }, "—— " + nameOf(tt.by) + (tt.open ? " 出的" : " 给你出的")) : null,
        h("div", { style: { position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: big ? 14 : 12 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: c.deep, background: "rgba(255,255,255,.6)", padding: "3px 10px", borderRadius: 999 } }, done.length ? done.length + " 人测过" : "还没人测过"),
          big ? null : h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: "#fff", background: c.deep, padding: "5px 14px", borderRadius: 999 } }, "去测 →")));
    };
    // 一题的样子：选项那块跟看他做的那页走同一份（Z.optsView），拍卖、滑杆、填空、颜色块都在里面
    const qBlock = (tt, i, pick, why, live, ex) => {
      const q = tt.qs[i], e = ex || {};
      return h("div", { key: i, "data-wk": "zyq", style: { padding: "12px 0", borderBottom: "1px dashed " + LINE } },
        h("div", { style: { display: "flex", gap: 8, alignItems: "baseline" } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: ACC, letterSpacing: ".05em", flexShrink: 0 } }, "Q" + (i + 1)),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: INK, lineHeight: 1.65 } }, q.q)),
        Z.optsView(tt, q, i, { on: tt.bid && e.amt == null ? -1 : pick, col: { INK, FOG, LINE, ACC }, amt: e.amt, fill: e.fill }),
        why ? h("div", { "data-wk": "zywhy", style: whyStyle(live) }, why) : null);
    };
    const resultBox = (res, whoId) => h("div", { "data-wk": "zyresult", style: { position: "relative", flex: 1, minWidth: 0, margin: "14px 0", padding: "16px 14px 14px", borderRadius: 12, background: "#fffaf3", border: "1px solid " + LINE, boxShadow: "inset 0 0 0 4px #fffaf3, inset 0 0 0 5px " + LINE } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".2em", color: FOG } }, nameOf(whoId) + (res.free ? " 做完说" : " 测出来是")),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: INK, marginTop: 4 } }, res.title),
      res.line && res.line !== res.title ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#6d6255", marginTop: 4, lineHeight: 1.6 } }, res.line) : null);
    const page = (title, back, kids) => h("div", { "data-wk": "zypage", className: "h-full flex flex-col", style: { background: PAPER } },
      h(Head, { zh: title, sub: "照影", onBack: back, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 18px 40px" } }, kids));

    // ── 出题／改题 ──
    if (edit) {
      const E = edit, up = patch => setEdit(Object.assign({}, E, patch)), K = E.kind || "", itemKind = K === "rank" || K === "bid" || K === "bracket";
      // 换答法：排序／拍卖／淘汰赛要的是条目，从已写的题面里先挪过来；淘汰赛凑满 16 格
      const setKind = k => { const its = (E.items && E.items.length ? E.items : E.qs.map(q => q.q).filter(Boolean)).slice(0, k === "bracket" ? 16 : 12);
        while (k === "bracket" && its.length < 16) its.push("");
        up({ kind: k, items: its, scored: k ? false : E.scored, qs: k === "quick" ? E.qs.map(q => Object.assign({}, q, { opts: (q.opts || []).slice(0, 2).concat([{ t: "" }, { t: "" }]).slice(0, 2) })) : E.qs }); };
      const upItem = (i, v) => up({ items: E.items.map((x, k) => k === i ? v : x) });
      const upQ = (i, patch) => up({ qs: E.qs.map((q, k) => k === i ? Object.assign({}, q, patch) : q) });
      const upO = (i, j, patch) => upQ(i, { opts: E.qs[i].opts.map((o, k) => k === j ? Object.assign({}, o, patch) : o) });
      const c = pal(E.id ? E : { id: "new", name: E.name });
      const doGen = async () => {
        if (!gen.theme.trim()) { props.toast && props.toast("先写个主题"); return; }
        if (!props.onGenTest) return;
        setGen(Object.assign({}, gen, { busy: true }));
        try { const t = await props.onGenTest(gen.theme, gen.count, !!E.scored && !K, K); if (t) setEdit(Object.assign(Z.draftOf(t), { id: E.id || "", kind: K, scored: !K && !!E.scored && t.results.length >= 2 })); }
        catch (e) { props.toast && props.toast("没出成：" + String((e && e.message) || e).slice(0, 40)); }
        setGen(g2 => Object.assign({}, g2, { busy: false }));
      };
      const save = () => { const t = Z.saveCustom(E); if (!t) { props.toast && props.toast(K === "bracket" ? "淘汰赛要填满 16 样" : itemKind ? "至少写 3 样" : K === "scale" || K === "fill" || K === "trade" || K === "star" || K === "link" ? "至少写一道题" : "至少写一道题、每题两个选项"); return; } setEdit(null); setTestId(t.id); bump(x => x + 1); };
      // ── 这一页是一张正在出的卷子（她 2026-10-23「这个页面 ui 也还是简陋啊」）──
      //   上面一排是「题型卡」：每张画着那种答法长什么样；AI 出题是贴在卷子上的便签；底下是装订好的卷面，题号照卷子的样子排
      const CN = "一二三四五六七八九十";
      const qNo = i => i < 10 ? CN[i] : i < 20 ? "十" + (i === 10 ? "" : CN[i - 11]) : String(i + 1);
      const line = (v, fn, ph, o) => h(o && o.multi ? "textarea" : "input", { value: v || "", placeholder: ph, rows: o && o.multi ? 2 : undefined, onChange: e => fn(e.target.value),
        style: Object.assign({ width: "100%", boxSizing: "border-box", padding: "8px 2px", border: "none", borderBottom: "1px solid " + LINE, background: "transparent", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: INK, outline: "none", resize: "none", lineHeight: 1.6 }, (o && o.style) || {}) });
      const iconBtn = (t, fn, color, label) => h("button", { onClick: fn, "aria-label": label || t, className: "active:opacity-50", style: { flexShrink: 0, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: 14, color: color || FOG } }, t);
      const addRow = (t, fn) => h("button", { onClick: fn, className: "w-full active:opacity-60", style: { minHeight: 44, marginTop: 6, borderRadius: 10, border: "1.5px dashed " + LINE, fontFamily: F_BODY, fontSize: 13, color: c.deep, background: "transparent" } }, t);
      const sec = (t, sub) => h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, margin: "22px 0 8px", paddingBottom: 6, borderBottom: "2px solid " + INK } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: INK, letterSpacing: ".12em" } }, t),
        sub ? h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG } }, sub) : null);
      // 题型卡上那幅小画：一眼看出这种答法长什么样
      const mini = k => {
        const ink = "rgba(46,38,30,.55)", bar = (w, o) => h("span", { style: Object.assign({ display: "block", height: 3, width: w, borderRadius: 2, background: ink }, o || {}) });
        const dot = on => h("span", { style: { width: 7, height: 7, borderRadius: 999, border: "1.5px solid " + ink, background: on ? ink : "transparent", flexShrink: 0 } });
        const row = (kids, o) => h("span", { style: Object.assign({ display: "flex", alignItems: "center", gap: 4 }, o || {}) }, kids);
        if (k === "") return h("span", { style: { display: "flex", flexDirection: "column", gap: 5 } }, [0, 1, 2].map(i => row([dot(i === 1), bar(i === 1 ? 26 : 20)], { key: i })));
        if (k === "quick") return row([h("span", { key: 1, style: { width: 20, height: 22, borderRadius: 4, border: "1.5px solid " + ink, background: ink } }), h("span", { key: 2, style: { fontSize: 9, color: ink } }, "/"), h("span", { key: 3, style: { width: 20, height: 22, borderRadius: 4, border: "1.5px solid " + ink } })]);
        if (k === "scale") return h("span", { style: { position: "relative", display: "block", width: 46, height: 14 } }, h("span", { style: { position: "absolute", left: 0, right: 0, top: 6, height: 2, background: ink } }), h("span", { style: { position: "absolute", left: 28, top: 1, width: 12, height: 12, borderRadius: 999, background: ink } }));
        if (k === "fill") return row([h("span", { key: 1, style: { fontSize: 11, color: ink, fontFamily: F_DISPLAY } }, "我"), bar(30, { key: 2, height: 1.5, marginTop: 10 })]);
        if (k === "rank") return h("span", { style: { display: "flex", flexDirection: "column", gap: 4 } }, [30, 22, 14].map((w, i) => row([h("span", { key: "n", style: { fontSize: 9, color: ink, width: 6 } }, i + 1), bar(w)], { key: i })));
        if (k === "trade") return row([h("span", { key: 1, style: { width: 18, height: 24, borderRadius: 3, border: "1.5px solid " + ink, background: ink } }), h("span", { key: 2, style: { fontSize: 11, color: ink } }, "⇄"), h("span", { key: 3, style: { width: 18, height: 24, borderRadius: 3, border: "1.5px solid " + ink } })]);
        if (k === "star") return row([0, 1, 2, 3, 4].map(i => h("span", { key: i, style: { fontSize: 11, color: i < 3 ? ink : "rgba(46,38,30,.2)" } }, "★")), { gap: 1 });
        if (k === "link") return h("span", { style: { display: "flex", flexDirection: "column", gap: 6 } }, [0, 1].map(i => row([bar(10), h("span", { key: "l", style: { width: 16, borderTop: "1.5px dashed " + ink } }), h("span", { key: "c", style: { width: 12, height: 8, borderRadius: 999, border: "1.5px solid " + ink } })], { key: i })));
        if (k === "bid") return row([10, 14, 18].map((d, i) => h("span", { key: i, style: { width: d, height: d, borderRadius: 999, border: "1.5px solid " + ink, background: i === 2 ? ink : "transparent" } })), { alignItems: "flex-end" });
        return h("span", { style: { display: "flex", alignItems: "center" } },
          h("span", { style: { display: "flex", flexDirection: "column", gap: 8 } }, [0, 1].map(i => h("span", { key: i, style: { width: 14, height: 10, borderTop: "1.5px solid " + ink, borderBottom: "1.5px solid " + ink, borderRight: "1.5px solid " + ink } }))),
          h("span", { style: { width: 10, height: 18, borderTop: "1.5px solid " + ink, borderBottom: "1.5px solid " + ink, borderRight: "1.5px solid " + ink } }), bar(10, { height: 1.5 }));
      };
      const kindTip = { trade: "每题一笔交易，答应或不答应", star: "每样打一到五颗星", link: "每一格填一个身边的人", "": "每题几个选项，挑一个", quick: "两个选项，一口气做完", scale: "每题拖一下，不会到一定会", fill: "半句话，自己往空里写", rank: "一串东西排先后", bid: "100 枚金币分给几样东西", bracket: "16 样两两对决" };
      const nQ = itemKind ? E.items.filter(x => String(x || "").trim()).length : E.qs.length;
      return page(E.id ? "改这套题" : "出一套题", () => setEdit(null), h("div", { "data-wk": "zyedit", style: { paddingBottom: 20 } },
        // 题型卡：横着一排小卷子，挑中的那张抬起来、顶上一道颜色
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, margin: "6px 2px 8px", letterSpacing: ".15em" } }, "题 型"),
        h("div", { "data-wk": "zykind", role: "tablist", className: "flex overflow-x-auto", style: { gap: 10, padding: "6px 2px 12px", margin: "0 -2px" } }, Z.KINDS.map(([k, zh]) => {
          const on = K === k;
          return h("button", { key: k || "choice", role: "tab", "aria-selected": on, "data-on": on ? "1" : "0", onClick: () => setKind(k), className: "shrink-0 active:scale-95",
            style: { position: "relative", width: 76, height: 92, borderRadius: 8, overflow: "hidden", background: on ? "#fffdf8" : "rgba(255,253,248,.55)", border: "1px solid " + (on ? c.deep : LINE),
              boxShadow: on ? "0 10px 18px -10px " + c.deep : "none", transform: on ? "translateY(-4px)" : "none", transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10 } },
            h("span", { style: { position: "absolute", left: 0, right: 0, top: 0, height: on ? 5 : 0, background: c.deep, transition: "height .2s" } }),
            h("span", { style: { height: 40, display: "flex", alignItems: "center", justifyContent: "center", opacity: on ? 1 : .6 } }, mini(k)),
            h("span", { style: { marginTop: 8, fontFamily: F_DISPLAY, fontSize: 13, color: on ? c.deep : INK } }, zh),
            on ? h("span", { style: { position: "absolute", right: 6, bottom: 5, fontSize: 10, color: c.deep } }, "✓") : null);
        })),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: c.deep, margin: "0 2px" } }, "「" + (Z.KINDS.find(x => x[0] === K) || ["", ""])[1] + "」" + kindTip[K]),
        // AI 出题：一张贴在卷子上的便签，上面一截胶带
        h("div", { "data-wk": "zygen", style: { position: "relative", margin: "20px 6px 6px", padding: "18px 14px 12px", background: "linear-gradient(170deg, " + c.a + ", " + c.b + ")", boxShadow: "0 8px 16px -10px rgba(0,0,0,.35)", transform: "rotate(-.8deg)", borderRadius: 3 } },
          h("span", { "aria-hidden": true, style: { position: "absolute", top: -9, left: "50%", width: 64, height: 18, marginLeft: -32, background: "rgba(255,255,255,.55)", transform: "rotate(2deg)", boxShadow: "0 1px 2px rgba(0,0,0,.08)" } }),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: "#2e261e", marginBottom: 4 } }, "懒得写？给个主题，让 AI 出"),
          line(gen.theme, v => setGen(Object.assign({}, gen, { theme: v })), "想测什么，比如：你是哪种猫", { style: { borderBottom: "1px solid rgba(46,38,30,.35)", color: "#2e261e" } }),
          h("div", { className: "flex items-center", style: { marginTop: 10, gap: 6 } },
            itemKind ? h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: c.deep } }, K === "bracket" ? "会出正好 16 样" : "会出一串东西")
              : [6, 10, 15].map(n => h("button", { key: n, onClick: () => setGen(Object.assign({}, gen, { count: n })), "data-on": gen.count === n ? "1" : "0",
                  style: { minWidth: 44, minHeight: 40, fontFamily: F_DISPLAY, fontSize: 13, color: gen.count === n ? "#2e261e" : "rgba(46,38,30,.5)", borderBottom: "2px solid " + (gen.count === n ? "#2e261e" : "transparent") } }, n + " 题")),
            h("button", { onClick: doGen, disabled: gen.busy, className: "active:scale-95", style: { marginLeft: "auto", minHeight: 40, padding: "0 16px", borderRadius: 999, background: "#2e261e", color: "#fff", fontFamily: F_DISPLAY, fontSize: 13, opacity: gen.busy ? .6 : 1 } }, gen.busy ? "在出…" : "出题 →")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(46,38,30,.6)", marginTop: 4 } }, "出完填进下面的卷子，随便改；会盖掉已经写的")),
        // 卷面：左边一道装订线，三个孔
        h("div", { "data-wk": "zypaper", style: { position: "relative", marginTop: 18, padding: "20px 16px 18px 30px", background: "#fffdf8", borderRadius: 4, boxShadow: "0 1px 0 " + LINE + ", 0 10px 24px -16px rgba(0,0,0,.35)" } },
          h("span", { "aria-hidden": true, style: { position: "absolute", left: 16, top: 10, bottom: 10, borderLeft: "1px dashed " + LINE } }),
          ["14%", "50%", "86%"].map((y, k) => h("span", { key: k, "aria-hidden": true, style: { position: "absolute", left: 6, top: y, width: 8, height: 8, borderRadius: 999, background: PAPER, boxShadow: "inset 0 1px 2px rgba(0,0,0,.18)" } })),
          // 卷头：大标题、一句说明、类别印章
          h("div", { style: { textAlign: "center" } },
            line(E.name, v => up({ name: v }), "给这套题起个名字", { style: { textAlign: "center", fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", borderBottom: "3px double " + INK, padding: "4px 2px 6px" } }),
            line(E.sub, v => up({ sub: v }), "一句话说测什么（可不写）", { style: { textAlign: "center", fontSize: 12.5, color: "#6d6255", borderBottom: "none", marginTop: 2 } }),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, marginTop: 2, letterSpacing: ".1em" } }, (itemKind ? "共 " + nQ + " 样" : "共 " + nQ + " 题") + " · " + (Z.KINDS.find(x => x[0] === K) || ["", ""])[1])),
          // 类别：一排小印章，盖上的那枚是实心的
          h("div", { "data-wk": "zyeditcat", className: "flex justify-center flex-wrap", style: { gap: 8, marginTop: 14 } }, [["", "自出"], ["xg", "性格"], ["gx", "关系"], ["xl", "心里"], ["wan", "好玩"]].map(([k, zh]) => {
            const on = (E.cat || "") === k;
            return h("button", { key: k || "mine", onClick: () => up({ cat: k }), "aria-pressed": on, className: "active:scale-95",
              style: { width: 44, height: 44, borderRadius: 999, fontFamily: F_DISPLAY, fontSize: 12, letterSpacing: ".05em", color: on ? "#fffdf8" : c.deep, background: on ? c.deep : "transparent",
                border: "1.5px " + (on ? "solid " : "dashed ") + c.deep, opacity: on ? 1 : .55, transform: on ? "rotate(-8deg)" : "none", transition: "all .2s" } }, zh);
          })),
          // 选择题：算不算分，写成卷子上的两个勾选框
          K ? null : h("div", { "data-wk": "zyscore", style: { display: "flex", gap: 14, marginTop: 16, justifyContent: "center", flexWrap: "wrap" } }, [[false, "不算分", "做完说一句感觉"], [true, "算分", "选项指向结果"]].map(([v, t, d]) =>
            h("button", { key: t, onClick: () => up({ scored: v, results: v && !(E.results || []).length ? [{ title: "", line: "" }, { title: "", line: "" }] : E.results }), "aria-pressed": !!E.scored === v, className: "active:opacity-70",
              style: { display: "flex", alignItems: "center", gap: 6, minHeight: 40, fontFamily: F_BODY, fontSize: 13, color: !!E.scored === v ? INK : FOG } },
              h("span", { style: { width: 16, height: 16, border: "1.5px solid " + (!!E.scored === v ? c.deep : FOG), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: c.deep } }, !!E.scored === v ? "✓" : ""),
              t, h("span", { style: { fontSize: 11, color: FOG } }, d)))),
          // 结果：每种结果一张小签，左边一个字母印
          !K && E.scored ? h(Fragment, null, sec("结 果", "选哪个结果的选项最多，就测出哪个"),
            (E.results || []).map((r, k) => h("div", { key: k, style: { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 } },
              h("span", { style: { flexShrink: 0, width: 28, height: 28, marginTop: 6, borderRadius: 999, border: "1.5px solid " + c.deep, color: c.deep, fontFamily: F_DISPLAY, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-6deg)" } }, String.fromCharCode(65 + k)),
              h("div", { style: { flex: 1, minWidth: 0 } }, line(r.title, v => up({ results: E.results.map((x, i) => i === k ? Object.assign({}, x, { title: v }) : x) }), "结果名字", { style: { fontFamily: F_DISPLAY } }),
                line(r.line, v => up({ results: E.results.map((x, i) => i === k ? Object.assign({}, x, { line: v }) : x) }), "一句说明（可不写）", { style: { fontSize: 12.5, borderBottom: "1px dashed " + LINE } })),
              E.results.length > 2 ? iconBtn("✕", () => up({ results: E.results.filter((x, i) => i !== k), qs: E.qs.map(q => Object.assign({}, q, { opts: q.opts.map(o => Object.assign({}, o, { r: (o.r || 0) > k ? o.r - 1 : (o.r === k ? 0 : o.r) })) })) }), FOG, "删这个结果") : null)),
            // 配得平不平：每种结果被指到的机会，差太多就提醒（她 2026-10-23）
            (function () { const b = Z.scoreBalance(E), mx = Math.max.apply(null, b), mn = Math.min.apply(null, b), even = !b.length || mx - mn < 0.34;
              return b.length ? h("div", { "data-wk": "zybalance", style: { margin: "6px 0 2px", padding: "8px 10px", borderRadius: 8, background: even ? "rgba(74,127,92,.08)" : "rgba(192,80,63,.08)", fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: even ? "#4a7f5c" : "#c0503f" } },
                (even ? "配得挺平：" : "配得不平，容易一直测出「" + ((E.results[b.indexOf(mx)] || {}).title || String.fromCharCode(65 + b.indexOf(mx))) + "」：") + b.map((v, i) => String.fromCharCode(65 + i) + " " + v.toFixed(1)).join(" · ") + (even ? "" : "。把指向它的选项改几个给少的那几种")) : null; })(),
            (E.results || []).length < 8 ? addRow("＋ 再加一种结果", () => up({ results: [...(E.results || []), { title: "", line: "" }] })) : null) : null,
          K === "scale" ? h(Fragment, null, sec("总 分", "做完显示成「它 N / 10」"), line(E.scale, v => up({ scale: v }), "总分叫什么，比如：胆量、心软指数")) : null,
          K === "star" ? h(Fragment, null, sec("总 分", "做完显示成「它 N 星」"), line(E.star, v => up({ star: v }), "总分叫什么，比如：理想程度、难开口")) : null,
          // 取舍：两个选项的字，答应的那个在前
          K === "trade" ? h(Fragment, null, sec("两 个 选 项", "答应的在前"), h("div", { className: "flex", style: { gap: 10 } }, [0, 1].map(j => h("div", { key: j, style: { flex: 1 } },
            line((E.trade || ["换", "不换"])[j], v => up({ trade: [0, 1].map(k => k === j ? v : (E.trade || ["换", "不换"])[k]) }), j ? "比如：不换" : "比如：换", { style: { textAlign: "center", fontFamily: F_DISPLAY } }))))) : null,
          // 排序：一张名次表；拍卖：一张拍品单；淘汰赛：八组对阵
          itemKind ? h(Fragment, null,
            K === "rank" ? h(Fragment, null, sec("名 次 表", "第一位叫什么"), line(E.rankHead, v => up({ rankHead: v }), "比如：最先顾的、最不能接受的")) : null,
            sec(K === "bracket" ? "对 阵 表" : K === "bid" ? "拍 品 单" : "要 排 的", K === "bracket" ? nQ + " / 16 · 上下两个一组开打" : K === "bid" ? "每人 100 枚金币" : "做的人自己排先后"),
            h("div", { "data-wk": "zyedititems" }, K === "bracket"
              ? h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, [0, 1, 2, 3, 4, 5, 6, 7].map(m => h("div", { key: m, style: { position: "relative", padding: "4px 18px 4px 8px", border: "1px solid " + LINE, borderRadius: 6 } },
                  h("span", { style: { position: "absolute", right: 4, top: "50%", marginTop: -8, fontFamily: F_DISPLAY, fontSize: 10, color: c.deep } }, "vs"),
                  [0, 1].map(j => h("div", { key: j }, line(E.items[2 * m + j], v => upItem(2 * m + j, v), (2 * m + j + 1) + "", { style: { fontSize: 13, padding: "6px 2px", borderBottom: j ? "none" : "1px dashed " + LINE } }))))))
              : E.items.map((x, i) => h("div", { key: i, className: "flex items-center", style: { gap: 8 } },
                  K === "rank" ? h("span", { style: { width: 24, flexShrink: 0, fontFamily: F_DISPLAY, fontSize: i < 3 ? 20 : 15, color: i < 3 ? c.deep : FOG, textAlign: "center" } }, i + 1)
                    : h("span", { style: { width: 22, height: 22, flexShrink: 0, borderRadius: 999, border: "1.5px solid " + c.deep, color: c.deep, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" } }, "¥"),
                  h("div", { style: { flex: 1, minWidth: 0 } }, line(x, v => upItem(i, v), K === "bid" ? "一件拍品" : "一样东西")),
                  iconBtn("✕", () => up({ items: E.items.filter((y, k) => k !== i) }), FOG, "删掉这一样")))),
            K !== "bracket" && E.items.length < (K === "bid" ? 12 : 8) ? addRow("＋ 再加一样", () => up({ items: [...E.items, ""] })) : null) : null,
          // 题目：一、二、三……像卷子那样排
          itemKind ? null : sec("题 目", K === "trade" ? "每题一笔交易" : K === "star" ? "每样一行" : K === "link" ? "每一格一个位置" : K === "fill" ? "空用 ____ 表示" : K === "scale" ? "每题一件事" : K === "quick" ? "每题两个选项" : "每题 2 到 4 个选项"),
          itemKind ? null : E.qs.map((q, i) => h("div", { key: i, "data-wk": "zyeditq", style: { padding: "6px 0 12px", borderBottom: "1px dashed " + LINE } },
            h("div", { className: "flex items-start", style: { gap: 6 } },
              h("span", { style: { flexShrink: 0, fontFamily: F_DISPLAY, fontSize: 15, color: c.deep, paddingTop: 8, minWidth: 28 } }, qNo(i) + "、"),
              h("div", { style: { flex: 1, minWidth: 0 } }, line(q.q, v => upQ(i, { q: v }), K === "fill" ? "半句话，比如：我最怕 ____" : K === "scale" ? "一件事，比如：一个人去旅行" : K === "trade" ? "一笔交易：得到什么，同时失去什么" : K === "star" ? "一样东西，比如：睡到自然醒" : K === "link" ? "一个位置，比如：最靠得住的" : "题目", { multi: true, style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } })),
              i > 0 ? iconBtn("↑", () => { const a = E.qs.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; up({ qs: a }); }, FOG, "往上挪") : null,
              iconBtn("✕", () => up({ qs: E.qs.filter((x, k) => k !== i) }), "#b85c5c", "删这题")),
            K === "scale" ? h("div", { style: { margin: "6px 0 0 34px", display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: FOG } }, "绝对不会", h("span", { style: { flex: 1, height: 2, background: LINE } }), "一定会") : null,
            K === "scale" || K === "fill" || K === "trade" || K === "star" || K === "link" ? null : h("div", { style: { marginLeft: 34 } }, (q.opts || []).map((o, j) => h("div", { key: j, className: "flex items-center", style: { gap: 6 } },
              h("span", { style: { flexShrink: 0, fontFamily: F_DISPLAY, fontSize: 12, color: FOG, width: 14 } }, String.fromCharCode(65 + j)),
              h("span", { style: { flexShrink: 0, width: 12, height: 12, borderRadius: 999, border: "1.5px solid #cbbca9" } }),
              h("div", { style: { flex: 1, minWidth: 0 } }, line(o.t, v => upO(i, j, { t: v }), "选项", { style: { fontSize: 13.5, borderBottom: "1px dashed " + LINE } })),
              E.scored ? h("select", { value: o.r || 0, onChange: e => upO(i, j, { r: Number(e.target.value) }), "aria-label": "指向哪个结果", style: { flexShrink: 0, minHeight: 40, padding: "0 4px", border: "none", borderBottom: "1.5px solid " + c.deep, background: "transparent", fontFamily: F_DISPLAY, fontSize: 12.5, color: c.deep } },
                (E.results || []).map((r, k) => h("option", { key: k, value: k }, "→" + String.fromCharCode(65 + k) + (r.title ? " " + r.title.slice(0, 4) : "")))) : null,
              q.opts.length > 2 ? iconBtn("✕", () => upQ(i, { opts: q.opts.filter((x, k) => k !== j) }), FOG, "删这个选项") : null)),
              K || (q.opts || []).length >= 4 ? null : h("button", { onClick: () => upQ(i, { opts: [...q.opts, { t: "", r: 0 }] }), className: "active:opacity-60", style: { minHeight: 40, fontFamily: F_BODY, fontSize: 12.5, color: c.deep } }, "＋ 再加一个选项")))),
          itemKind ? null : addRow("＋ 再出一题", () => up({ qs: [...E.qs, { q: "", opts: [{ t: "", r: 0 }, { t: "", r: 0 }] }] }))),
        // 收卷：一枚印章似的按钮
        h("button", { "data-wk": "zysave", onClick: save, className: "w-full active:scale-[.98]", style: { marginTop: 22, minHeight: 50, borderRadius: 999, background: c.deep, color: "#fff", fontFamily: F_DISPLAY, fontSize: 16, letterSpacing: ".3em", boxShadow: "0 8px 18px -8px " + c.deep } }, "收 卷"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, textAlign: "center", marginTop: 6 } }, characterText(char, "存好就能发给他做、自己做")),
        E.id ? h("button", { onClick: () => requestAppConfirm("删掉这套题？", "题删了，做过这套的记录也就看不到了。", () => { Z.delCustom(E.id); setEdit(null); setTestId(null); bump(x => x + 1); }, "删掉"), className: "w-full active:opacity-60", style: { marginTop: 10, minHeight: 40, fontFamily: F_BODY, fontSize: 12.5, color: "#b85c5c" } }, "删掉这套题") : null));
    }

    // ── 正在做 ──
    if (run && test && run.testId === test.id) {
      const tt = test;
      if (run.busy) return page(tt.name, () => setRun(null), h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, color: FOG } }, nameOf(run.who) + " 拿起手机，开始做题…"));
      const share = run.done && run.mode === "char" && props.onShare
        ? h("button", { "data-wk": "zyshare", onClick: () => props.onShare(char, { testName: tt.name, title: run.res.title, line: run.res.line, who: nameOf(run.who) }), className: "w-full active:opacity-70",
            style: { marginTop: 4, padding: "12px 0", borderRadius: 10, background: INK, color: PAPER, fontFamily: F_DISPLAY } }, characterText(char, "发到跟他的聊天里")) : null;
      return page(tt.name, () => { clearTimeout(timer.current); setRun(null); },
        h(Fragment, null,
          run.mode === "char" && !run.done ? h("button", { "data-wk": "zyskip", onClick: () => finish(run), className: "active:opacity-60", style: { float: "right", fontFamily: F_BODY, fontSize: 12, color: FOG, padding: "6px 0" } }, "直接看结果 ›") : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, padding: "8px 0" } }, run.mode === "char" ? (run.done ? nameOf(run.who) + " 做完了" : nameOf(run.who) + " 在做第 " + Math.min(run.step + 1, tt.qs.length) + " / " + tt.qs.length + " 题") : "你在做第 " + Math.min(run.step + 1, tt.qs.length) + " / " + tt.qs.length + " 题"),
          run.done ? resultBox(run.res, run.who) : null,
          // 钓鱼题（她 2026-10-23）：做完才揭开他出这套其实想知道什么
          run.done && run.mode === "me" && tt.bait ? h("div", { "data-wk": "zybait", style: { margin: "4px 0 12px", padding: "12px 14px", borderRadius: 12, border: "1.5px dashed " + ACC, background: "rgba(176,118,74,.06)", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: INK, lineHeight: 1.7, animation: "wkpop .35s ease-out both" } },
            h("div", { style: { fontSize: 11, letterSpacing: ".2em", color: ACC, marginBottom: 4 } }, "其实"), nameOf(tt.by) + " 出这套题，是想知道：" + tt.bait) : null,
          share,
          // 做完发给谁看（她 2026-10-23「两个人互相发结果」）：任何一套都能发，附一句话；他也做过的话发过去就是你俩并排的对照
          run.done && run.mode === "me" && props.onSendMine && chars.length ? (function () {
            const to = sendTo && chars.some(c => c.id === sendTo) ? sendTo : (tt.by && chars.some(c => c.id === tt.by) ? tt.by : chars[0].id);
            const hisRec = Z.recordsOf(to, tt.id)[0];
            return h("div", { "data-wk": "zysendbox", style: { margin: "6px 0 10px", padding: "12px 12px 10px", borderRadius: 12, background: "#fffaf3", border: "1px solid " + LINE } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: INK, marginBottom: 6 } }, "发给谁看"),
              h("div", { className: "flex gap-3 overflow-x-auto", style: { padding: "2px 2px 6px" } }, chars.map(c => face(to === c.id, c, c.remark || c.name, () => setSendTo(c.id)))),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: hisRec ? ACC : FOG, margin: "2px 0 8px" } }, hisRec ? nameOf(to) + " 也做过这套（测出「" + hisRec.title + "」），发过去是你俩并排的对照" : nameOf(to) + " 还没做过这套，发过去是你的答案"),
              h("textarea", { "data-wk": "zynote", value: note, onChange: e => setNote(e.target.value), rows: 2, placeholder: "想跟 " + nameOf(to) + " 说的（会一起发过去，可不写）",
                style: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + LINE, background: "#fffdf8", color: INK, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, resize: "none", outline: "none" } }),
              h("button", { "data-wk": "zysendmine", onClick: () => { const r0 = Z.recordsOf("me", tt.id)[0]; if (r0) { props.onSendMine(to, tt.id, r0, note); setNote(""); } }, className: "w-full active:opacity-70",
                style: { marginTop: 8, minHeight: 44, borderRadius: 10, background: INK, color: PAPER, fontFamily: F_DISPLAY } }, "发给 " + nameOf(to) + " 看"));
          })() : null,
          // 拍卖自己做：一页摆开十样，加加减减，剩多少一直看得见，不会超
          run.mode === "me" && !run.done && tt.bid ? (function () {
            const left = tt.bid - run.bids.reduce((x, y) => x + y, 0);
            const set = (i, d) => setRun(r => { const b = r.bids.slice(), l = tt.bid - b.reduce((x, y) => x + y, 0); b[i] = Math.max(0, b[i] + Math.min(d, l)); const next = Object.assign({}, r, { bids: b }); saveDraft(r.testId, next); return next; });
            const stepBtn = (lab, fn, off) => h("button", { onClick: fn, disabled: off, className: "active:opacity-60", style: { width: 40, height: 40, borderRadius: 999, border: "1px solid " + LINE, background: "#fffaf3", color: INK, fontSize: 16, opacity: off ? .35 : 1 } }, lab);
            return h("div", { "data-wk": "zybidme" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: left ? ACC : INK, margin: "6px 0 10px" } }, "手里还剩 " + left + " 枚"),
              tt.qs.map((q, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px dashed " + LINE } },
                h("span", { style: { flex: 1, fontFamily: F_BODY, fontSize: 14, color: INK } }, q.q),
                stepBtn("−", () => set(i, -5), !run.bids[i]),
                h("span", { style: { width: 36, textAlign: "center", fontFamily: F_BODY, fontSize: 14, color: INK } }, run.bids[i]),
                stepBtn("＋", () => set(i, 5), !left))),
              h("button", { onClick: () => finish(Object.assign({}, run, { picks: run.bids.map(v => v <= 0 ? 0 : v < 10 ? 1 : v < 25 ? 2 : v < 50 ? 3 : 4) })), className: "w-full active:scale-[.98]",
                style: { marginTop: 14, padding: "13px 0", borderRadius: 999, background: ACC, color: "#fff", fontFamily: F_DISPLAY, fontSize: 15 } }, left ? "就出这些（还剩 " + left + " 枚不花）" : "出完了"));
          })() : null,
          run.mode === "me" && !run.done && !tt.bid && run.step < tt.qs.length ? (function () { const lt = Z.live(tt, run.picks), q = lt.qs[run.step];
            return h("div", { "data-wk": "zyq" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: INK, lineHeight: 1.6, margin: "10px 0 12px" } }, (run.step + 1) + ". " + q.q),
              tt.fill ? h("div", null,
                h("textarea", { value: fillDraft, onChange: e => setFillDraft(e.target.value), rows: 3, placeholder: tt.link ? "写一个人…" : "填进空里…", style: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid " + LINE, background: "#fffaf3", color: INK, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, resize: "none", outline: "none" } }),
                h("button", { onClick: () => { mePick(0, fillDraft); setFillDraft(""); }, className: "w-full active:scale-[.98]", style: { marginTop: 8, padding: "12px 0", borderRadius: 999, background: ACC, color: "#fff", fontFamily: F_DISPLAY, fontSize: 14 } }, run.step + 1 >= tt.qs.length ? "填完了" : "下一题"))
              : Z.optsView(lt, q, run.step, { on: -1, col: { INK, FOG, LINE, ACC }, gone: tt.rank ? run.picks : [], pick: j => mePick(j) }),
              run.step ? h("button", { onClick: meBack, className: "active:opacity-60", style: { marginTop: 10, minHeight: 40, fontFamily: F_BODY, fontSize: 12.5, color: FOG } }, "‹ 上一题") : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, marginTop: 6 } }, "中途退出会存着，下次点进来接着做"));
          })() : null,
          // 他做的：已经选完的那几题按顺序摞下来，最新那题先出题、过一会儿亮出选项和心声
          run.mode === "char" ? tt.qs.map((q, i) => i < run.step || run.done ? qBlock(tt, i, run.picks[i], run.whys[i], false)
            : i === run.step ? qBlock(tt, i, run.shown ? run.picks[i] : -1, run.shown ? run.whys[i] : "", true) : null).filter(Boolean).reverse() : null));
    }

    // ── 一套题的档案 ──
    if (test) {
      const recs = Z.recordsOf(who, test.id);
      const mine = Z.recordsOf("me", test.id)[0];
      return page(test.name, () => { setTestId(null); setOpenRec(null); setCompare(false); },
        h(Fragment, null,
          cover(test, true),
          // 他出的题：谁都能做（她 2026-10-22「我俩都能做也能发给别的角色」）
          test.by && chars.some(c => c.id === test.by) ? h("div", { "data-wk": "zybyhint", style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginTop: 10, lineHeight: 1.6 } },
            nameOf(test.by) + " 出的这套：你、" + nameOf(test.by) + " 自己、别的角色都能做——在下面「谁来做」里点谁就发给谁；做过的人能在底下对一对。") : null,
          test.custom ? h("div", { style: { textAlign: "right", marginTop: 6 } }, h("button", { "data-wk": "zyeditbtn", onClick: () => setEdit(Z.draftOf(test)), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC } }, "✎ 改这套题")) : null,
          // 谁来做：点进来才挑人（她 2026-10-22「主页不要这个头像 要点进去才有」）；挑中谁，底下就是谁的档案
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: INK, margin: "18px 0 8px", letterSpacing: ".1em" } }, "谁来做"),
          h("div", { "data-wk": "zyaskrow", className: "flex gap-3 overflow-x-auto", style: { padding: "4px 2px 6px" } },
            chars.map(c => face(who === c.id, c, c.remark || c.name, () => setWho(c.id))), face(who === "me", null, "我自己", () => setWho("me"))),
          // 徽章（她 2026-10-23）：从他做过的记录里算出来，亮的是拿到了的
          // 一行：拿到了几个＋拿到的那几枚；点开才摊开全部（她 2026-10-23「改成一行吧，点开再看全部」）
          who !== "me" && char ? (function () { const bs = Z.badgesOf(char.id), got = bs.filter(b => b.on);
            return h("button", { "data-wk": "zybadgeline", onClick: () => setBadgeOpen(v => !v), className: "w-full text-left active:opacity-70",
              style: { marginTop: 8, minHeight: 40, display: "flex", alignItems: "center", gap: 6, fontFamily: F_BODY, fontSize: 12, color: FOG, overflow: "hidden", whiteSpace: "nowrap" } },
              h("span", { style: { color: ACC, flexShrink: 0 } }, "徽章 " + got.length + "/" + bs.length),
              h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, got.length ? got.map(b => "★" + b.zh).join(" ") : "还没拿到"),
              h("span", { style: { flexShrink: 0 } }, badgeOpen ? "收起 ▴" : "全部 ▾")); })() : null,
          who !== "me" && char && badgeOpen ? h("div", { "data-wk": "zybadges", className: "flex gap-2 flex-wrap", style: { marginTop: 4 } },
            Z.badgesOf(char.id).map(b => h("button", { key: b.k, "data-on": b.on ? "1" : "0", onClick: () => props.toast && props.toast((b.on ? "已拿到 · " : "还没拿到 · ") + b.zh + "：" + b.how), className: "active:opacity-70",
              style: { minHeight: 40, padding: "4px 10px", borderRadius: 10, fontFamily: F_BODY, fontSize: 11.5, border: "1px " + (b.on ? "solid " + ACC : "dashed " + LINE), color: b.on ? ACC : FOG, background: b.on ? "rgba(176,118,74,.08)" : "transparent" } }, (b.on ? "★ " : "☆ ") + b.zh))) : null,
          // 换个处境再做（她 2026-10-22）：挑一个前提，这一次照那个前提下的他来答；平时就是不挑
          who !== "me" && char ? h("div", { "data-wk": "zyscene", style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginBottom: 6 } }, "这一次假设（可不选）"),
            h("div", { className: "flex gap-2 flex-wrap" },
              ["", "刚跟你吵完架", "喝多了", "十年前的他", "你不在身边那阵子"].map(sc => pill(scene === sc, sc || "平时", () => setScene(sc), "zyscenechip")),
              pill(!!scene && !["刚跟你吵完架", "喝多了", "十年前的他", "你不在身边那阵子"].includes(scene), "自己写…", () => requestAppPrompt("这一次假设", characterText(char, "写一个前提，比如「刚升职那天」。他会照那时候的自己来答。"), scene, v => setScene(String(v || "").trim().slice(0, 60)), "好"), "zyscenechip"))) : null,
          who !== "me" && char && (test.rank || test.bid) ? h("div", { "data-wk": "zyguesspick", style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginBottom: 6 } }, test.rank ? characterText(char, "先押一个：他会把哪个排第一（可不押）") : characterText(char, "先押一个：他会把最多的钱砸在哪（可不押）")),
            h("div", { className: "flex gap-2 flex-wrap" }, (test.rank || test.qs.map(q => q.q)).map((x, k) => pill(guess === k, x, () => setGuess(guess === k ? -1 : k), "zyscenechip")))) : null,
          // 说谎题（她 2026-10-23）：让他偷偷撒一题谎，你看完回放来猜
          who !== "me" && char && !(test.rank || test.bid || test.bracket || test.fill) ? h("div", { "data-wk": "zylietoggle", style: { marginTop: 12 } },
            pill(lie, lie ? characterText(char, "✓ 这次让他偷偷撒一题谎") : characterText(char, "这次让他偷偷撒一题谎"), () => setLie(v => !v), "zyscenechip"),
            lie ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, marginTop: 6 } }, characterText(char, "他会挑一题故意不说实话，看完回放你点题号猜是哪一题，猜完揭晓。")) : null) : null,
          who !== "me" && char ? h("button", { "data-wk": "zyaskwho", onClick: () => { props.onAsk && props.onAsk(char.id, test.id, scene, guess, lie); setScene(""); setGuess(-1); setLie(false); }, className: "w-full active:scale-[.98]",
            style: { marginTop: 10, padding: "13px 0", borderRadius: 999, background: pal(test).deep, color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", letterSpacing: ".08em", boxShadow: "0 6px 16px -6px " + pal(test).deep } },
            "发给 " + (char.remark || char.name) + " 做" + (scene ? "（" + scene.slice(0, 8) + "）" : "") + " →") : null,
          who !== "me" && char ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, textAlign: "center", marginTop: 6 } }, characterText(char, "卡会落进你们的聊天，你按回复他就开始做")) : null,
          who === "me" && drafts()[test.id] ? h("div", { "data-wk": "zydraft", style: { marginTop: 10, fontFamily: F_BODY, fontSize: 12.5, color: ACC, textAlign: "center" } }, "上次做到第 " + (drafts()[test.id].step + 1) + " 题，点下面接着做 · ",
            h("button", { onClick: () => startMe(true), className: "active:opacity-60", style: { minHeight: 40, color: FOG, textDecoration: "underline" } }, "重新做")) : null,
          who === "me" ? h("button", { "data-wk": "zygome", onClick: () => startMe(false), className: "w-full active:scale-[.98]", style: { marginTop: 10, padding: "13px 0", borderRadius: 999, background: pal(test).deep, color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", letterSpacing: ".08em", boxShadow: "0 6px 16px -6px " + pal(test).deep } }, drafts()[test.id] ? "接着做 →" : mine ? "我再做一次 →" : "开始做题 →") : null,
          h("details", { "data-wk": "zyqlist", style: { marginTop: 12 } }, h("summary", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, cursor: "pointer" } }, "看看这套题（" + test.qs.length + " 题）"),
            test.qs.map((q, k) => qBlock(Z.live(test, []), k, -1, "", false))),
          // ── 跟谁对一对（她 2026-10-22「加3和4」）：任意两个做过这套的人并排看，我也算一个 ──
          (function () {
            const others = [...chars.map(c => c.id), "me"].filter(id => id !== who && Z.recordsOf(id, test.id).length);
            if (!recs.length || !others.length) return null;
            return h("div", { "data-wk": "zycompare", style: { marginTop: 12 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginBottom: 6 } }, "跟谁对一对"),
              h("div", { className: "flex gap-2 flex-wrap" }, others.map(id => pill(compare === id, id === "me" ? "我" : nameOf(id), () => setCompare(compare === id ? false : id), "zycomparewho"))));
          })(),
          compare && recs.length && Z.recordsOf(compare, test.id).length ? (function () {
            const A = recs[0], B = Z.recordsOf(compare, test.id)[0];
            // 一样不一样照答出来的东西比（拍卖比钱数、填空比写的字）
            const diff = test.qs.map((q, i) => i).filter(i => Z.answerText(test, A, i) !== Z.answerText(test, B, i));
            // 两个角色都在的群：意见不一样的那题可以丢进去让他俩接着聊
            const shared = who !== "me" && compare !== "me" ? (props.groups || []).filter(gr => gr && (gr.memberIds || []).includes(who) && (gr.memberIds || []).includes(compare)) : [];
            const toGroup = i => {
              const gr = shared[0]; if (!gr || !props.onShareToGroup) return;
              props.onShareToGroup(gr.id, "〔照影〕我让「" + nameOf(who) + "」和「" + nameOf(compare) + "」都做了「" + test.name + "」。第 " + (i + 1) + " 题「" + test.qs[i].q + "」："
                + nameOf(who) + " 选了「" + Z.answerText(test, A, i) + "」，" + nameOf(compare) + " 选了「" + Z.answerText(test, B, i) + "」。你俩说说？");
            };
            return h("div", { "data-wk": "zycomparebox", style: { marginTop: 10 } },
              h("div", { className: "flex gap-2" }, resultBox({ title: A.title, line: A.line, free: A.free }, who), resultBox({ title: B.title, line: B.line, free: B.free }, compare)),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, margin: "4px 0 6px" } }, test.qs.length - diff.length + " 题选得一样，" + diff.length + " 题不一样"),
              test.qs.map((q, i) => h("div", { key: i, style: { padding: "9px 0", borderBottom: "1px dashed " + LINE } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: INK } }, (i + 1) + ". " + q.q),
                // 滑杆、拍卖：两根杆子／两条钱并排画出来，看得出差多少（她 2026-10-23）
                test.scale || test.bid ? [[who, A], [compare, B]].map(([id, R0], k) => h("div", { key: k, "data-wk": "zycomparebar", style: { display: "flex", alignItems: "center", gap: 6 } },
                  h("span", { style: { width: 44, flexShrink: 0, fontFamily: F_BODY, fontSize: 11.5, color: FOG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, nameOf(id)),
                  h("div", { style: { flex: 1, minWidth: 0 } }, Z.optsView(test, q, i, { on: test.bid ? 0 : R0.picks[i], col: { INK, FOG, LINE, ACC }, amt: test.bid ? ((R0.bids || [])[i] || 0) : null })))) : null,
                test.scale || test.bid ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: A.picks[i] === B.picks[i] ? ACC : "#6d6255", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" } },
                  nameOf(who) + "：" + Z.answerText(test, A, i) + ((A.whys || [])[i] ? "（" + A.whys[i] + "）" : "") + "\n" + nameOf(compare) + "：" + Z.answerText(test, B, i) + ((B.whys || [])[i] ? "（" + B.whys[i] + "）" : "") + (A.picks[i] === B.picks[i] ? "　· 一样" : "")),
                A.picks[i] !== B.picks[i] && shared.length && props.onShareToGroup ? h("button", { "data-wk": "zytogroup", onClick: () => toGroup(i), className: "active:opacity-60",
                  style: { marginTop: 5, fontFamily: F_BODY, fontSize: 11.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "3px 10px" } }, "丢进「" + (shared[0].name || "群") + "」让他俩聊") : null)));
          })() : null,
          // ── 一个群一起做（她 2026-10-22）：群里每个主角色各做一遍，做完大家的选法发进群 ──
          (function () {
            const gs = (props.groups || []).filter(gr => gr && (gr.memberIds || []).filter(id => chars.some(c => c.id === id)).length >= 2);
            if (!gs.length || !props.onGroupRun) return null;
            return h("div", { "data-wk": "zygrouprun", style: { marginTop: 14 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginBottom: 6 } }, busyWho ? busyWho : "让一个群一起做（群里每人各花一次调用，做完发进群让他们聊）"),
              // 群里也能玩说谎（她 2026-10-23）：每人偷偷撒一题，回放里各自猜
              !(test.rank || test.bid || test.bracket || test.fill) ? h("div", { "data-wk": "zygrouplie", style: { marginBottom: 8 } }, pill(groupLie, groupLie ? "✓ 每人偷偷撒一题谎" : "每人偷偷撒一题谎", () => setGroupLie(v => !v), "zyscenechip")) : null,
              h("div", { className: "flex gap-2 flex-wrap" }, gs.map(gr => pill(false, gr.name || "群", () => {
                if (busyWho) return;
                const n0 = (gr.memberIds || []).filter(id => chars.some(c => c.id === id)).length;
                requestAppConfirm("让「" + (gr.name || "群") + "」一起做？", "群里 " + n0 + " 个人各做一遍，一人一次调用。卡会先落进群里、带你跳过去；你说完话按叶子他们才开始做，谁做完那一行就亮起来，点开看他怎么选的；每个人都看完，他们就接着聊。", async () => {
                  setBusyWho("在做…");
                  const n = await props.onGroupRun(gr.id, test.id, c => setBusyWho((c.remark || c.name) + " 在做…"), groupLie && !(test.rank || test.bid || test.bracket || test.fill));
                  setBusyWho(""); bump(x => x + 1);
                  if (n === -1) return;   // 卡已经落进群、人也跳过去了：等她按叶子才开始做
                  props.toast && props.toast(n >= 2 ? "做完了，发进群里了" : "做成的人太少，没发进群");
                }, "开始");
              }, "zygroupbtn"))));
          })(),
          // 大家怎么选：做过这套的人（含我）每人最近一次，每题各选了什么
          (function () {
            const ids = [...chars.map(c => c.id), "me"].filter(id => Z.recordsOf(id, test.id).length);
            if (ids.length < 3) return null;
            const last = id => Z.recordsOf(id, test.id)[0];
            const sp = Z.spreadOf(test, ids.map(id => ({ name: nameOf(id), rec: last(id) })));
            return h("details", { "data-wk": "zyspread", style: { marginTop: 14 } },
              h("summary", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, cursor: "pointer", minHeight: 40, display: "flex", alignItems: "center" } }, "大家怎么选（" + ids.length + " 人）"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#6d6255", lineHeight: 1.7, marginTop: 6 } }, sp.head.map((l, k) => h("div", { key: k }, l))),
              sp.rows.map((r, i) => h("div", { key: i, style: { padding: "8px 0", borderBottom: "1px dashed " + LINE } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: INK } }, (i + 1) + ". " + r.q),
                r.lines.map((l, k) => h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 12, color: "#6d6255", marginTop: 3, lineHeight: 1.6 } }, l)))));
          })(),
          // ── 他的变化：做过两次以上，按时间排出每次测出了什么；最早那次和最近那次换了选项的题，前后心声放一起 ──
          recs.length >= 2 ? (function () {
            const old = recs[recs.length - 1], now = recs[0];
            const moved = test.qs.map((q, i) => i).filter(i => old.picks[i] !== now.picks[i]);
            return h("div", { "data-wk": "zychange", style: { marginTop: 16, padding: "12px 12px", borderRadius: 10, background: "#fffaf3", border: "1px solid " + LINE } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: INK } }, nameOf(who) + " 这几次"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#6d6255", marginTop: 6, lineHeight: 1.9 } }, recs.slice().reverse().map(r => Z.dateZh(r.ts) + "　" + r.title).join("\n").split("\n").map((l, k) => h("div", { key: k }, (k ? "→ " : "") + l))),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, margin: "10px 0 4px" } }, moved.length ? "从 " + Z.dateZh(old.ts) + " 到 " + Z.dateZh(now.ts) + "，换了选项的 " + moved.length + " 题：" : "从第一次到最近一次，每题都没换"),
              moved.map(i => h("div", { key: i, style: { padding: "7px 0", borderTop: "1px dashed " + LINE } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: INK } }, (i + 1) + ". " + test.qs[i].q),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#6d6255", marginTop: 3, lineHeight: 1.6, whiteSpace: "pre-wrap" } },
                  "那时：" + Z.answerText(test, old, i) + ((old.whys || [])[i] ? "（" + old.whys[i] + "）" : "") + "\n现在：" + Z.answerText(test, now, i) + ((now.whys || [])[i] ? "（" + now.whys[i] + "）" : "")))));
          })() : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, margin: "18px 0 6px" } }, recs.length ? nameOf(who) + " 做过 " + recs.length + " 次" : "还没做过"),
          recs.map(r => h("div", { key: r.id, "data-wk": "zyrec", "data-rec": r.id, style: { borderTop: "1px solid " + LINE, padding: "10px 0" } },
            h("button", { onClick: () => setOpenRec(openRec === r.id ? null : r.id), className: "w-full text-left active:opacity-70", style: { display: "flex", alignItems: "center", gap: 8 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: INK, flex: 1 } }, r.title,
                r.scene ? h("span", { "data-wk": "zyscenetag", style: { marginLeft: 6, fontFamily: F_BODY, fontSize: 11, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "1px 7px" } }, r.scene) : null,
                r.group ? h("span", { style: { marginLeft: 6, fontFamily: F_BODY, fontSize: 11, color: FOG } }, "群里一起做的") : null),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG } }, Z.dateZh(r.ts) + (openRec === r.id ? " ▴" : " ▾"))),
            openRec === r.id ? h("div", null,
              who !== "me" && props.onReplay ? h("button", { "data-wk": "zyreplay", onClick: () => props.onReplay(who, r), className: "active:opacity-70", style: { margin: "6px 0", fontFamily: F_BODY, fontSize: 12.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "4px 12px" } }, characterText(char, "▶ 看他做的回放")) : null,
              // 存成图／收进时刻／发给出题的他（她 2026-10-22）
              h("div", { "data-wk": "zyrecacts", className: "flex gap-2 flex-wrap", style: { margin: "6px 0" } },
                props.onSaveImage ? h("button", { onClick: () => props.onSaveImage(test.id, r, nameOf(who)), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "6px 12px", minHeight: 40 } }, "存成图") : null,
                who !== "me" && props.onPin ? h("button", { onClick: () => props.onPin(who, test.id, r), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "6px 12px", minHeight: 40 } }, "收进时刻") : null,
                // 我的那次：发给谁都行（她 2026-10-23）
                who === "me" && props.onSendMine ? chars.map(c => h("button", { key: c.id, onClick: () => props.onSendMine(c.id, test.id, r), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: ACC, borderRadius: 999, padding: "6px 12px", minHeight: 40 } }, "发给 " + nameOf(c.id))) : null),
              // 换了处境的那次：跟最近一次「平时」的并排，只列选得不一样的题
              r.scene ? (function () {
                const base = recs.find(x => !x.scene && x.id !== r.id);
                if (!base) return h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, margin: "4px 0" } }, characterText(char, "他还没在平时做过这套，做一次就能跟这次对着看"));
                const moved = test.qs.map((q, i) => i).filter(i => base.picks[i] !== r.picks[i]);
                return h("div", { "data-wk": "zyscenediff", style: { margin: "6px 0 10px", padding: "10px 12px", borderRadius: 10, background: "#fffaf3", border: "1px solid " + LINE } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC } }, moved.length ? "跟平时那次（" + Z.dateZh(base.ts) + "）比，这 " + moved.length + " 题换了：" : "跟平时那次（" + Z.dateZh(base.ts) + "）比，每题都一样"),
                  moved.map(i => h("div", { key: i, style: { padding: "6px 0", borderTop: "1px dashed " + LINE, fontFamily: F_BODY, fontSize: 12, color: "#6d6255", lineHeight: 1.6, whiteSpace: "pre-wrap" } },
                    h("div", { style: { color: INK, fontSize: 13 } }, (i + 1) + ". " + test.qs[i].q),
                    "平时：" + Z.answerText(test, base, i) + ((base.whys || [])[i] ? "（" + base.whys[i] + "）" : "") + "\n这次：" + Z.answerText(test, r, i) + ((r.whys || [])[i] ? "（" + r.whys[i] + "）" : ""))));
              })() : null,
              test.qs.map((q, i) => qBlock(Z.live(test, r.picks), i, r.picks[i], (r.whys || [])[i], false, { amt: r.bids ? r.bids[i] : null, fill: (r.fills || [])[i] })),
              // 结果和评语压在题目最下面（她 2026-10-22）
              h("div", { "data-wk": "zyresult", style: { margin: "14px 0 6px", padding: "14px 14px 12px", borderRadius: 12, background: "#fffaf3", border: "1px solid " + LINE } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".2em", color: FOG } }, nameOf(who) + (r.free ? " 做完说" : " 测出来是")),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: INK, marginTop: 4 } }, r.title),
                test.bid && r.bids ? Z.bidBars(test, r.bids, { INK, FOG, LINE, ACC }) : r.line && r.line !== r.title ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#6d6255", marginTop: 4, lineHeight: 1.6 } }, r.line) : null,
                Z.guessLine(test, r) ? h("div", { "data-wk": "zyguess", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, marginTop: 8 } }, Z.guessLine(test, r)) : null,
                (r.revs || []).length ? h("div", { "data-wk": "zyrev", style: { fontFamily: F_BODY, fontSize: 12, color: "#6f5f4d", marginTop: 8, lineHeight: 1.7 } }, r.revs.map((x, k) => h("div", { key: k }, "回头改了第 " + (x.i + 1) + " 题：「" + Z.optText(test, x.i, x.from).slice(0, 12) + "」→「" + Z.optText(test, x.i, x.to).slice(0, 12) + "」" + (x.why ? "——" + x.why : "")))) : null,
                r.review ? h("div", { "data-wk": "zyreview", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#5d5246", marginTop: 10, paddingTop: 10, borderTop: "1px dashed " + LINE, lineHeight: 1.75 } }, r.review) : null,
                r.react ? h("div", { "data-wk": "zyreact", style: { marginTop: 10, padding: "8px 12px", borderLeft: "2px solid " + ACC, background: "rgba(176,118,74,.06)", borderRadius: "0 8px 8px 0", fontFamily: F_BODY } },
                  h("div", { style: { fontSize: 11, color: ACC, letterSpacing: ".1em" } }, nameOf(who) + " 看完说"), h("div", { style: { fontSize: 14, color: INK, lineHeight: 1.7, marginTop: 2 } }, "「" + r.react + "」")) : null),
              h("button", { onClick: () => requestAppConfirm("删掉这一次？", characterText(char, "这次的结果和每题选了什么一起删掉，他也就不记得做过这一次了。"), () => { Z.delRecord(who, r.id); setOpenRec(null); bump(x => x + 1); }, "删掉"),
                className: "active:opacity-60", style: { marginTop: 8, fontFamily: F_BODY, fontSize: 12, color: "#b85c5c" } }, "删掉这一次")) : null))));
    }

    // ── 首页：挑人、挑一套 ──
    return h("div", { "data-wk": "zypage", className: "h-full flex flex-col", style: { background: PAPER } },
      h(Head, { zh: "照影", sub: "看看他会怎么选", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 18px 40px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: FOG, padding: "8px 2px 10px", lineHeight: 1.6 } }, "挑一套，点进去发给他做，或者自己做一份。"),
        // 最近做过：谁做的哪一套、测出什么，点了直接翻开那一次（她 2026-10-23「题多了不好找记录」）
        (() => {
          const rr = Z.recentRecords(8, w => w === "me" || chars.some(c => c.id === w));
          if (!rr.length) return null;
          return h("div", { "data-wk": "zyrecent", style: { marginBottom: 10 } },
            h("button", { "data-wk": "zyrecentfold", "aria-expanded": !recFold, onClick: () => setRecFold(!recFold), className: "w-full flex items-center active:opacity-70", style: { minHeight: 36, padding: "2px 2px", marginBottom: recFold ? 0 : 6 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: INK, flex: 1, textAlign: "left" } }, "最近做过"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG } }, recFold ? "展开 ▾" : "收起 ▴")),
            recFold ? null : h("div", { className: "flex overflow-x-auto", style: { gap: 10, padding: "2px 2px 8px" } }, rr.map(r => {
              const tt = Z.byId(r.testId), c = chars.find(x => x.id === r.who);
              return h("button", { key: r.who + r.id, "data-wk": "zyrecentcard", onClick: () => { jumpRec.current = r.id; setWho(r.who); setTestId(r.testId); setOpenRec(r.id); }, className: "shrink-0 text-left active:scale-[.97]",
                style: { width: 150, padding: "10px 12px", borderRadius: 14, background: "#fffdf8", border: "1px solid " + LINE, borderTop: "3px solid " + Z.pal(tt).deep } },
                h("div", { className: "flex items-center", style: { gap: 6 } },
                  c ? h(Avatar, { character: c, size: 22, radius: 999 }) : h("span", { style: { display: "flex", width: 22, height: 22, borderRadius: 999, alignItems: "center", justifyContent: "center", background: INK, color: PAPER, fontFamily: F_DISPLAY, fontSize: 11 } }, "我"),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, nameOf(r.who) + " · " + Z.dateZh(r.ts))),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, tt.name),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: INK, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.title || ""));
            })));
        })(),
        // 分类是一排小圆镜（照影本来就是一面镜子）：照着的那面大一圈、镜面亮着、描一道边，名字在底下；没照的那几面小一号、蒙着
        h("div", { "data-wk": "zycats", role: "tablist", className: "flex overflow-x-auto", style: { gap: 6, padding: "4px 2px 14px", alignItems: "flex-end" } },
          Z.CATS.map(([k, zh, gl]) => {
            const on = curCat === k, n = k === "all" ? Z.allTests().length : Z.allTests().filter(tt => Z.catOf(tt) === k).length;
            if (k === "mine" && !n) return null;
            const d = on ? 50 : 40;
            return h("button", { key: k, role: "tab", "aria-selected": on, "data-wk": "zycat", "data-on": on ? "1" : "0", onClick: () => setCat(k), className: "shrink-0 flex flex-col items-center active:opacity-70",
              style: { width: 62, minHeight: 72, gap: 5, transition: "all .2s" } },
              h("span", { style: { position: "relative", width: d, height: d, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", transition: "all .2s",
                background: on ? "radial-gradient(circle at 32% 28%, #fffdf8 0%, #f4ece0 38%, #d9c8b2 100%)" : "radial-gradient(circle at 35% 30%, #f3ece2 0%, #e2d6c6 100%)",
                border: (on ? 2 : 1) + "px solid " + (on ? ACC : LINE), boxShadow: on ? "0 4px 12px -5px " + ACC + ", inset 0 -3px 6px rgba(120,90,60,.18)" : "inset 0 -2px 4px rgba(120,90,60,.12)", opacity: on ? 1 : .72 } },
                on ? h("span", { "aria-hidden": true, style: { position: "absolute", left: "18%", top: "12%", width: "34%", height: "18%", borderRadius: 999, background: "rgba(255,255,255,.85)", transform: "rotate(-28deg)" } }) : null,
                h("span", { style: { position: "relative", fontFamily: F_DISPLAY, fontSize: on ? 19 : 15, color: on ? ACC : FOG } }, gl)),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: on ? INK : FOG, fontWeight: on ? 700 : 400, whiteSpace: "nowrap" } }, zh + " " + n));
          })),
        // 「自己出的」下面一排出题人：谁出过题才排出来
        (() => {
          if (curCat !== "mine") return null;
          const ms = Z.allTests().filter(tt => Z.catOf(tt) === "mine");
          const ids = []; ms.forEach(tt => { const k = tt.by || "me"; if (ids.indexOf(k) < 0) ids.push(k); });
          if (ids.length < 2) return null;
          const known = ids.filter(k => k === "me" || chars.some(c => c.id === k));
          return h("div", { "data-wk": "zyauthors", className: "flex gap-3 overflow-x-auto", style: { padding: "0 2px 12px" } },
            h("button", { key: "all", "data-wk": "zychip", "data-on": byWho ? "0" : "1", onClick: () => setByWho(""), className: "shrink-0 flex flex-col items-center active:opacity-70", style: { gap: 5, width: 56, opacity: byWho ? .62 : 1 } },
              h("span", { style: { display: "flex", width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", border: "1.5px solid " + (byWho ? LINE : ACC), fontFamily: F_DISPLAY, fontSize: 13, color: byWho ? FOG : ACC } }, "全部"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: byWho ? FOG : INK } }, ms.length + " 套")),
            known.map(k => face(byWho === k, k === "me" ? null : chars.find(c => c.id === k), (k === "me" ? "我" : nameOf(k)) + " " + ms.filter(tt => (tt.by || "me") === k).length, () => setByWho(byWho === k ? "" : k))));
        })(),
        Z.allTests().filter(tt => curCat === "all" || Z.catOf(tt) === curCat).filter(tt => curCat !== "mine" || !byWho || (tt.by || "me") === byWho).map(tt => h("button", { key: tt.id, "data-wk": "zytest", onClick: () => setTestId(tt.id), className: "w-full text-left active:scale-[.98]", style: { display: "block", marginBottom: 14, transition: "transform .15s" } }, cover(tt, false))),
        h("button", { "data-wk": "zynew", onClick: () => { setGen({ theme: "", count: 10, busy: false }); setEdit({ id: "", name: "", sub: "", scored: false, results: [], qs: [{ q: "", opts: [{ t: "", r: 0 }, { t: "", r: 0 }] }] }); }, className: "w-full active:scale-[.98]",
          style: { display: "block", padding: "22px 0", borderRadius: 18, border: "1.5px dashed #cbbca9", fontFamily: F_DISPLAY, fontSize: 15, color: INK } },
          "＋ 出一套题", h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, marginTop: 4 } }, "自己写，或者给个主题让 AI 出，出完能改")),
        // 他给你出一套（她 2026-10-22）：照他想知道你什么来出，出好了你来做
        props.onCharGen && chars.length ? h("div", { "data-wk": "zychargen", style: { marginTop: 18 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: INK, marginBottom: 8 } }, "让他出一套"),
          // 出给谁（她 2026-10-23）：一封写给你的信，或者一张谁都能拿的传单
          h("div", { "data-wk": "zygenmode", role: "tablist", className: "flex", style: { gap: 10, marginBottom: 8 } }, [["", "写给我的", "问的是他想知道你的事"], ["open", "大家都能做", "照他的兴趣出，谁拿到都能做"]].map(([m, t, d]) => {
            const on = genMode === m;
            return h("button", { key: m || "me", role: "tab", "aria-selected": on, "data-on": on ? "1" : "0", onClick: () => setGenMode(m), className: "flex-1 text-left active:scale-[.98]",
              style: { position: "relative", minHeight: 64, padding: "10px 12px", background: on ? "#fffdf8" : "transparent", border: "1px " + (on ? "solid " + ACC : "dashed " + LINE), borderRadius: m ? 4 : "4px 18px 4px 4px",
                boxShadow: on ? (m ? "3px 3px 0 -1px #fffdf8, 3px 3px 0 0 " + LINE + ", 0 8px 14px -10px " + ACC : "0 8px 14px -10px " + ACC) : "none", transform: on ? "translateY(-2px)" : "none", transition: "all .2s" } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: on ? ACC : INK } }, t),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: FOG, marginTop: 3, lineHeight: 1.5 } }, d));
          })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, marginBottom: 8 } }, busyWho || "点谁就是谁出，用他那条线路花一次调用；出过的题他看得到，不会出重复的"),
          h("div", { className: "flex gap-3 overflow-x-auto", style: { padding: "4px 2px 6px" } }, chars.map(c => face(false, c, c.remark || c.name, async () => {
            if (busyWho) return;
            setBusyWho((c.remark || c.name) + " 在出题…");
            const t2 = await props.onCharGen(c.id, genMode);
            setBusyWho("");
            if (t2) { setWho("me"); setTestId(t2.id); bump(x => x + 1); }
          })))) : null));
  }
  g.ZhaoyingApp = ZhaoyingApp;
})();
