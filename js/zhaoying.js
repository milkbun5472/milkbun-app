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
    const [scene, setScene] = useState("");
    const [guess, setGuess] = useState(-1);        // 排序／拍卖：发出去之前押他的第一（她 2026-10-23）        // 换个处境再做：这一次的前提，空＝平时
    const [busyWho, setBusyWho] = useState("");    // 他在出题 / 群里谁在做
    // 分类：记得上次停在哪一类（她 2026-10-22「搞个分类」）
    const [cat, setCatS] = useState(() => { try { return (typeof loadJSON === "function" && loadJSON("x_zyCat", "all")) || "all"; } catch (e) { return "all"; } });
    // 记着的那一类空了（比如自己出的题都删了）就回到全部
    const curCat = cat !== "all" && !Z.allTests().some(tt => Z.catOf(tt) === cat) ? "all" : cat;
    const setCat = c => { setCatS(c); try { typeof saveJSON === "function" && saveJSON("x_zyCat", c); } catch (e) {} };

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
    const finish = r => {
      clearTimeout(timer.current);
      const res = Z.resultOf(r.testId, r.picks);
      if (res.free) { res.title = "做完了"; res.line = ""; }
      Z.addRecord(r.who, { testId: r.testId, ts: Date.now(), picks: r.picks, whys: r.whys || [], code: res.code, title: res.title, line: res.line, free: !!res.free });
      setRun(Object.assign({}, r, { done: true, res, step: Z.byId(r.testId).qs.length }));
      bump(x => x + 1);
    };
    const startMe = () => { if (test) setRun({ mode: "me", who: "me", testId: test.id, picks: [], whys: [], step: 0 }); };
    const mePick = p => setRun(r => {
      const picks = r.picks.concat([p]);
      const next = Object.assign({}, r, { picks, step: r.step + 1 });
      if (picks.length >= Z.byId(r.testId).qs.length) { setTimeout(() => finish(next), 0); }
      return next;
    });

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
        tt.by ? h("div", { "data-wk": "zyby", style: { position: "relative", fontFamily: F_BODY, fontSize: 11.5, color: c.deep, marginTop: 4 } }, "—— " + nameOf(tt.by) + " 给你出的") : null,
        h("div", { style: { position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: big ? 14 : 12 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: c.deep, background: "rgba(255,255,255,.6)", padding: "3px 10px", borderRadius: 999 } }, done.length ? done.length + " 人测过" : "还没人测过"),
          big ? null : h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: "#fff", background: c.deep, padding: "5px 14px", borderRadius: 999 } }, "去测 →")));
    };
    const qBlock = (tt, i, pick, why, live) => {
      const q = tt.qs[i];
      return h("div", { key: i, "data-wk": "zyq", style: { padding: "12px 0", borderBottom: "1px dashed " + LINE } },
        h("div", { style: { display: "flex", gap: 8, alignItems: "baseline" } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: ACC, letterSpacing: ".05em", flexShrink: 0 } }, "Q" + (i + 1)),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: INK, lineHeight: 1.65 } }, q.q)),
        h("div", { style: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 } }, q.opts.map((o, j) => h("div", { key: j, "data-wk": "zyopt", "data-on": pick === j ? "1" : "0",
          style: { display: "flex", alignItems: "center", gap: 9, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "7px 10px", borderRadius: 8, border: "1px solid " + (pick === j ? ACC : LINE),
            background: pick === j ? "rgba(176,118,74,.10)" : "#fffaf3", color: pick === j ? INK : "#7d6f60", transition: "all .25s" } },
          bubble(pick === j), h("span", null, o.t)))),
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
      const E = edit, up = patch => setEdit(Object.assign({}, E, patch));
      const upQ = (i, patch) => up({ qs: E.qs.map((q, k) => k === i ? Object.assign({}, q, patch) : q) });
      const upO = (i, j, patch) => upQ(i, { opts: E.qs[i].opts.map((o, k) => k === j ? Object.assign({}, o, patch) : o) });
      const inp = (v, fn, ph, multi) => h(multi ? "textarea" : "input", { value: v || "", placeholder: ph, rows: multi ? 2 : undefined, onChange: e => fn(e.target.value),
        style: { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10, border: "1px solid " + LINE, background: "#fffaf3", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: INK, outline: "none", resize: "none" } });
      const lab = t => h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: INK, letterSpacing: ".1em", margin: "18px 0 8px" } }, t);
      const small = (t, fn, color) => h("button", { onClick: fn, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: color || ACC, padding: "4px 2px" } }, t);
      const c = pal(E.id ? E : { id: "new", name: E.name });
      const doGen = async () => {
        if (!gen.theme.trim()) { props.toast && props.toast("先写个主题"); return; }
        if (!props.onGenTest) return;
        setGen(Object.assign({}, gen, { busy: true }));
        try { const t = await props.onGenTest(gen.theme, gen.count, !!E.scored); if (t) setEdit(Object.assign({}, t, { id: E.id || "", scored: !!E.scored && t.results.length >= 2 })); }
        catch (e) { props.toast && props.toast("没出成：" + String((e && e.message) || e).slice(0, 40)); }
        setGen(g2 => Object.assign({}, g2, { busy: false }));
      };
      const save = () => { const t = Z.saveCustom(E); if (!t) { props.toast && props.toast("至少写一道题、每题两个选项"); return; } setEdit(null); setTestId(t.id); bump(x => x + 1); };
      return page(E.id ? "改这套题" : "出一套题", () => setEdit(null), h("div", { "data-wk": "zyedit" },
        // 算不算分（她：「ab可以选」）
        h("div", { "data-wk": "zyscore", className: "flex gap-2", style: { marginTop: 8 } }, [[false, "不算分", "做完他自己说一句"], [true, "算分", "先定几个结果，选项指过去"]].map(([v, t, d]) =>
          h("button", { key: t, onClick: () => up({ scored: v, results: v && !(E.results || []).length ? [{ title: "", line: "" }, { title: "", line: "" }] : E.results }), className: "flex-1 text-left active:opacity-70",
            style: { padding: "10px 12px", borderRadius: 12, border: "1.5px solid " + (!!E.scored === v ? c.deep : LINE), background: !!E.scored === v ? "rgba(255,255,255,.7)" : "transparent" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: !!E.scored === v ? c.deep : INK } }, t),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, marginTop: 2 } }, d)))),
        // 给主题让 AI 出
        h("div", { "data-wk": "zygen", style: { marginTop: 14, padding: 14, borderRadius: 16, background: "linear-gradient(135deg, " + c.a + ", " + c.b + ")" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: "#2e261e", marginBottom: 8 } }, "给个主题，让 AI 出一套"),
          inp(gen.theme, v => setGen(Object.assign({}, gen, { theme: v })), "想测什么"),
          h("div", { className: "flex items-center gap-2", style: { marginTop: 8 } },
            [6, 10, 15].map(n => h("button", { key: n, onClick: () => setGen(Object.assign({}, gen, { count: n })), style: { padding: "5px 12px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5, background: gen.count === n ? c.deep : "rgba(255,255,255,.6)", color: gen.count === n ? "#fff" : c.deep } }, n + " 题")),
            h("button", { onClick: doGen, disabled: gen.busy, className: "active:scale-95", style: { marginLeft: "auto", padding: "6px 16px", borderRadius: 999, background: "#2e261e", color: "#fff", fontFamily: F_DISPLAY, fontSize: 13, opacity: gen.busy ? .6 : 1 } }, gen.busy ? "在出…" : "出题 →")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(46,38,30,.6)", marginTop: 6 } }, "出完会填进下面，随便改；会盖掉下面已经写的")),
        lab("名字"), inp(E.name, v => up({ name: v }), "这套题叫什么"),
        h("div", { style: { height: 8 } }), inp(E.sub, v => up({ sub: v }), "一句话说测什么（可不写）"),
        lab("放进哪一类"),
        h("div", { "data-wk": "zyeditcat", className: "flex gap-2 flex-wrap" }, [["", "自己出的"], ["xg", "性格"], ["gx", "关系"], ["xl", "心里"], ["wan", "好玩"]].map(([k, zh]) =>
          h("button", { key: k || "mine", onClick: () => up({ cat: k }), className: "active:opacity-70", style: { minHeight: 40, padding: "6px 14px", borderRadius: 10, fontFamily: F_BODY, fontSize: 13,
            border: "1.5px solid " + ((E.cat || "") === k ? c.deep : LINE), color: (E.cat || "") === k ? c.deep : INK, background: (E.cat || "") === k ? "rgba(255,255,255,.7)" : "transparent" } }, zh))),
        E.scored ? h(Fragment, null, lab("结果（选哪个结果的选项最多，就测出哪个）"),
          (E.results || []).map((r, k) => h("div", { key: k, style: { display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 8 } },
            h("span", { style: { flexShrink: 0, width: 22, height: 22, marginTop: 8, borderRadius: 999, background: c.deep, color: "#fff", fontFamily: F_DISPLAY, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" } }, String.fromCharCode(65 + k)),
            h("div", { style: { flex: 1 } }, inp(r.title, v => up({ results: E.results.map((x, i) => i === k ? Object.assign({}, x, { title: v }) : x) }), "结果名字"),
              h("div", { style: { height: 5 } }), inp(r.line, v => up({ results: E.results.map((x, i) => i === k ? Object.assign({}, x, { line: v }) : x) }), "一句说明（可不写）")),
            E.results.length > 2 ? small("✕", () => up({ results: E.results.filter((x, i) => i !== k), qs: E.qs.map(q => Object.assign({}, q, { opts: q.opts.map(o => Object.assign({}, o, { r: (o.r || 0) > k ? o.r - 1 : (o.r === k ? 0 : o.r) })) })) }), FOG) : null)),
          (E.results || []).length < 8 ? small("＋ 加一个结果", () => up({ results: [...(E.results || []), { title: "", line: "" }] })) : null) : null,
        lab("题目（" + E.qs.length + "）"),
        E.qs.map((q, i) => h("div", { key: i, "data-wk": "zyeditq", style: { padding: 12, marginBottom: 10, borderRadius: 14, background: "#fffaf3", border: "1px solid " + LINE } },
          h("div", { className: "flex items-center", style: { marginBottom: 6 } }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: 12, color: c.deep, flex: 1 } }, "Q" + (i + 1)),
            i > 0 ? small("↑", () => { const a = E.qs.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; up({ qs: a }); }, FOG) : null,
            small("删这题", () => up({ qs: E.qs.filter((x, k) => k !== i) }), "#b85c5c")),
          inp(q.q, v => upQ(i, { q: v }), "题目", true),
          q.opts.map((o, j) => h("div", { key: j, className: "flex items-center gap-2", style: { marginTop: 6 } },
            h("span", { style: { flexShrink: 0, width: 12, height: 12, borderRadius: 999, border: "1.5px solid #cbbca9" } }),
            h("div", { style: { flex: 1 } }, inp(o.t, v => upO(i, j, { t: v }), "选项 " + (j + 1))),
            E.scored ? h("select", { value: o.r || 0, onChange: e => upO(i, j, { r: Number(e.target.value) }), style: { flexShrink: 0, padding: "8px 4px", borderRadius: 8, border: "1px solid " + LINE, background: "#fffaf3", fontFamily: F_BODY, fontSize: 12.5, color: c.deep } },
              (E.results || []).map((r, k) => h("option", { key: k, value: k }, "→" + String.fromCharCode(65 + k) + (r.title ? " " + r.title.slice(0, 4) : "")))) : null,
            q.opts.length > 2 ? small("✕", () => upQ(i, { opts: q.opts.filter((x, k) => k !== j) }), FOG) : null)),
          q.opts.length < 4 ? small("＋ 选项", () => upQ(i, { opts: [...q.opts, { t: "", r: 0 }] })) : null)),
        h("button", { onClick: () => up({ qs: [...E.qs, { q: "", opts: [{ t: "", r: 0 }, { t: "", r: 0 }] }] }), className: "w-full active:opacity-70", style: { padding: "11px 0", borderRadius: 14, border: "1.5px dashed " + LINE, fontFamily: F_BODY, fontSize: 13, color: FOG } }, "＋ 加一题"),
        h("button", { "data-wk": "zysave", onClick: save, className: "w-full active:scale-[.98]", style: { marginTop: 18, padding: "13px 0", borderRadius: 999, background: c.deep, color: "#fff", fontFamily: F_DISPLAY, fontSize: 15, letterSpacing: ".08em", boxShadow: "0 6px 16px -6px " + c.deep } }, "存好"),
        E.id ? h("button", { onClick: () => requestAppConfirm("删掉这套题？", "题删了，做过这套的记录也就看不到了。", () => { Z.delCustom(E.id); setEdit(null); setTestId(null); bump(x => x + 1); }, "删掉"), className: "w-full active:opacity-60", style: { marginTop: 12, fontFamily: F_BODY, fontSize: 12.5, color: "#b85c5c" } }, "删掉这套题") : null));
    }

    // ── 正在做 ──
    if (run && test && run.testId === test.id) {
      const tt = test;
      if (run.busy) return page(tt.name, () => setRun(null), h("div", { style: { padding: "60px 0", textAlign: "center", fontFamily: F_BODY, color: FOG } }, nameOf(run.who) + " 拿起手机，开始做题…"));
      const share = run.done && run.mode === "char" && props.onShare
        ? h("button", { "data-wk": "zyshare", onClick: () => props.onShare(char, { testName: tt.name, title: run.res.title, line: run.res.line, who: nameOf(run.who) }), className: "w-full active:opacity-70",
            style: { marginTop: 4, padding: "12px 0", borderRadius: 10, background: INK, color: PAPER, fontFamily: F_DISPLAY } }, "发到跟他的聊天里") : null;
      return page(tt.name, () => { clearTimeout(timer.current); setRun(null); },
        h(Fragment, null,
          run.mode === "char" && !run.done ? h("button", { "data-wk": "zyskip", onClick: () => finish(run), className: "active:opacity-60", style: { float: "right", fontFamily: F_BODY, fontSize: 12, color: FOG, padding: "6px 0" } }, "直接看结果 ›") : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, padding: "8px 0" } }, run.mode === "char" ? (run.done ? nameOf(run.who) + " 做完了" : nameOf(run.who) + " 在做第 " + Math.min(run.step + 1, tt.qs.length) + " / " + tt.qs.length + " 题") : "你在做第 " + Math.min(run.step + 1, tt.qs.length) + " / " + tt.qs.length + " 题"),
          run.done ? resultBox(run.res, run.who) : null,
          // 钓鱼题（她 2026-10-23）：做完才揭开他出这套其实想知道什么
          run.done && run.mode === "me" && tt.bait ? h("div", { "data-wk": "zybait", style: { margin: "4px 0 12px", padding: "12px 14px", borderRadius: 12, border: "1.5px dashed " + ACC, background: "rgba(176,118,74,.06)", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: INK, lineHeight: 1.7, animation: "wkpop .35s ease-out both" } },
            h("div", { style: { fontSize: 11, letterSpacing: ".2em", color: ACC, marginBottom: 4 } }, "其实"), nameOf(tt.by) + " 出这套题，是想知道：" + tt.bait) : null,
          share,
          run.done && run.mode === "me" && tt.by && props.onSendMine && chars.some(c => c.id === tt.by) ? h("button", { "data-wk": "zysendmine", onClick: () => { const r0 = Z.recordsOf("me", tt.id)[0]; if (r0) props.onSendMine(tt.by, tt.id, r0); }, className: "w-full active:opacity-70",
            style: { marginTop: 4, padding: "12px 0", borderRadius: 10, background: INK, color: PAPER, fontFamily: F_DISPLAY } }, "发给 " + nameOf(tt.by) + " 看我的答案") : null,
          run.mode === "me" && !run.done && run.step < tt.qs.length ? h("div", { "data-wk": "zyq" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: INK, lineHeight: 1.6, margin: "10px 0 12px" } }, (run.step + 1) + ". " + tt.qs[run.step].q),
            tt.qs[run.step].opts.map((o, j) => tt.rank && run.picks.indexOf(j) >= 0 ? null : h("button", { key: j, "data-wk": "zyopt", onClick: () => mePick(j), className: "w-full text-left active:opacity-70",
              style: { display: "block", marginBottom: 8, padding: "11px 12px", borderRadius: 8, border: "1px solid " + LINE, background: "#fffaf3", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: INK } }, o.t))) : null,
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
          test.custom ? h("div", { style: { textAlign: "right", marginTop: 6 } }, h("button", { "data-wk": "zyeditbtn", onClick: () => setEdit(JSON.parse(JSON.stringify(test))), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC } }, "✎ 改这套题")) : null,
          // 谁来做：点进来才挑人（她 2026-10-22「主页不要这个头像 要点进去才有」）；挑中谁，底下就是谁的档案
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: INK, margin: "18px 0 8px", letterSpacing: ".1em" } }, "谁来做"),
          h("div", { "data-wk": "zyaskrow", className: "flex gap-3 overflow-x-auto", style: { padding: "4px 2px 6px" } },
            chars.map(c => face(who === c.id, c, c.remark || c.name, () => setWho(c.id))), face(who === "me", null, "我自己", () => setWho("me"))),
          // 徽章（她 2026-10-23）：从他做过的记录里算出来，亮的是拿到了的
          who !== "me" && char ? h("div", { "data-wk": "zybadges", className: "flex gap-2 flex-wrap", style: { marginTop: 8 } },
            Z.badgesOf(char.id).map(b => h("button", { key: b.k, "data-on": b.on ? "1" : "0", onClick: () => props.toast && props.toast((b.on ? "已拿到 · " : "还没拿到 · ") + b.zh + "：" + b.how), className: "active:opacity-70",
              style: { minHeight: 40, padding: "4px 10px", borderRadius: 10, fontFamily: F_BODY, fontSize: 11.5, border: "1px " + (b.on ? "solid " + ACC : "dashed " + LINE), color: b.on ? ACC : FOG, background: b.on ? "rgba(176,118,74,.08)" : "transparent" } }, (b.on ? "★ " : "☆ ") + b.zh))) : null,
          // 换个处境再做（她 2026-10-22）：挑一个前提，这一次照那个前提下的他来答；平时就是不挑
          who !== "me" && char ? h("div", { "data-wk": "zyscene", style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginBottom: 6 } }, "这一次假设（可不选）"),
            h("div", { className: "flex gap-2 flex-wrap" },
              ["", "刚跟你吵完架", "喝多了", "十年前的他", "你不在身边那阵子"].map(sc => pill(scene === sc, sc || "平时", () => setScene(sc), "zyscenechip")),
              pill(!!scene && !["刚跟你吵完架", "喝多了", "十年前的他", "你不在身边那阵子"].includes(scene), "自己写…", () => requestAppPrompt("这一次假设", "写一个前提，比如「刚升职那天」。他会照那时候的自己来答。", scene, v => setScene(String(v || "").trim().slice(0, 60)), "好"), "zyscenechip"))) : null,
          who !== "me" && char && (test.rank || test.bid) ? h("div", { "data-wk": "zyguesspick", style: { marginTop: 12 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginBottom: 6 } }, test.rank ? "先押一个：他会把哪个排第一（可不押）" : "先押一个：他会把最多的钱砸在哪（可不押）"),
            h("div", { className: "flex gap-2 flex-wrap" }, (test.rank || test.qs.map(q => q.q)).map((x, k) => pill(guess === k, x, () => setGuess(guess === k ? -1 : k), "zyscenechip")))) : null,
          who !== "me" && char ? h("button", { "data-wk": "zyaskwho", onClick: () => { props.onAsk && props.onAsk(char.id, test.id, scene, guess); setScene(""); setGuess(-1); }, className: "w-full active:scale-[.98]",
            style: { marginTop: 10, padding: "13px 0", borderRadius: 999, background: pal(test).deep, color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", letterSpacing: ".08em", boxShadow: "0 6px 16px -6px " + pal(test).deep } },
            "发给 " + (char.remark || char.name) + " 做" + (scene ? "（" + scene.slice(0, 8) + "）" : "") + " →") : null,
          who !== "me" && char ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, textAlign: "center", marginTop: 6 } }, "卡会落进你们的聊天，你按回复他就开始做") : null,
          who === "me" ? h("button", { "data-wk": "zygome", onClick: startMe, className: "w-full active:scale-[.98]", style: { marginTop: 10, padding: "13px 0", borderRadius: 999, background: pal(test).deep, color: "#fff", fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", letterSpacing: ".08em", boxShadow: "0 6px 16px -6px " + pal(test).deep } }, mine ? "我再做一次 →" : "开始做题 →") : null,
          h("details", { "data-wk": "zyqlist", style: { marginTop: 12 } }, h("summary", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, cursor: "pointer" } }, "看看这套题（" + test.qs.length + " 题）"),
            test.qs.map((q, k) => qBlock(test, k, -1, "", false))),
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
            const diff = test.qs.map((q, i) => i).filter(i => A.picks[i] !== B.picks[i]);
            // 两个角色都在的群：意见不一样的那题可以丢进去让他俩接着聊
            const shared = who !== "me" && compare !== "me" ? (props.groups || []).filter(gr => gr && (gr.memberIds || []).includes(who) && (gr.memberIds || []).includes(compare)) : [];
            const toGroup = i => {
              const gr = shared[0]; if (!gr || !props.onShareToGroup) return;
              props.onShareToGroup(gr.id, "〔照影〕我让「" + nameOf(who) + "」和「" + nameOf(compare) + "」都做了「" + test.name + "」。第 " + (i + 1) + " 题「" + test.qs[i].q + "」："
                + nameOf(who) + " 选了「" + Z.optText(test, i, A.picks[i]) + "」，" + nameOf(compare) + " 选了「" + Z.optText(test, i, B.picks[i]) + "」。你俩说说？");
            };
            return h("div", { "data-wk": "zycomparebox", style: { marginTop: 10 } },
              h("div", { className: "flex gap-2" }, resultBox({ title: A.title, line: A.line, free: A.free }, who), resultBox({ title: B.title, line: B.line, free: B.free }, compare)),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, margin: "4px 0 6px" } }, test.qs.length - diff.length + " 题选得一样，" + diff.length + " 题不一样"),
              test.qs.map((q, i) => h("div", { key: i, style: { padding: "9px 0", borderBottom: "1px dashed " + LINE } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: INK } }, (i + 1) + ". " + q.q),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: A.picks[i] === B.picks[i] ? ACC : "#6d6255", marginTop: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" } },
                  nameOf(who) + "：" + Z.optText(test, i, A.picks[i]) + ((A.whys || [])[i] ? "（" + A.whys[i] + "）" : "") + "\n" + nameOf(compare) + "：" + Z.optText(test, i, B.picks[i]) + ((B.whys || [])[i] ? "（" + B.whys[i] + "）" : "") + (A.picks[i] === B.picks[i] ? "　· 一样" : "")),
                A.picks[i] !== B.picks[i] && shared.length && props.onShareToGroup ? h("button", { "data-wk": "zytogroup", onClick: () => toGroup(i), className: "active:opacity-60",
                  style: { marginTop: 5, fontFamily: F_BODY, fontSize: 11.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "3px 10px" } }, "丢进「" + (shared[0].name || "群") + "」让他俩聊") : null)));
          })() : null,
          // ── 一个群一起做（她 2026-10-22）：群里每个主角色各做一遍，做完大家的选法发进群 ──
          (function () {
            const gs = (props.groups || []).filter(gr => gr && (gr.memberIds || []).filter(id => chars.some(c => c.id === id)).length >= 2);
            if (!gs.length || !props.onGroupRun) return null;
            return h("div", { "data-wk": "zygrouprun", style: { marginTop: 14 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, marginBottom: 6 } }, busyWho ? busyWho : "让一个群一起做（群里每人各花一次调用，做完发进群让他们聊）"),
              h("div", { className: "flex gap-2 flex-wrap" }, gs.map(gr => pill(false, gr.name || "群", () => {
                if (busyWho) return;
                const n0 = (gr.memberIds || []).filter(id => chars.some(c => c.id === id)).length;
                requestAppConfirm("让「" + (gr.name || "群") + "」一起做？", "群里 " + n0 + " 个人各做一遍，一人一次调用。做完会把大家的选法发进群里。", async () => {
                  setBusyWho("在做…");
                  const n = await props.onGroupRun(gr.id, test.id, c => setBusyWho((c.remark || c.name) + " 在做…"));
                  setBusyWho(""); bump(x => x + 1);
                  props.toast && props.toast(n >= 2 ? "做完了，发进群里了" : "做成的人太少，没发进群");
                }, "开始");
              }, "zygroupbtn"))));
          })(),
          // 大家怎么选：做过这套的人（含我）每人最近一次，每题各选了什么
          (function () {
            const ids = [...chars.map(c => c.id), "me"].filter(id => Z.recordsOf(id, test.id).length);
            if (ids.length < 3) return null;
            const last = id => Z.recordsOf(id, test.id)[0];
            return h("details", { "data-wk": "zyspread", style: { marginTop: 14 } },
              h("summary", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, cursor: "pointer" } }, "大家怎么选（" + ids.length + " 人）"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#6d6255", lineHeight: 1.7, marginTop: 6 } }, ids.map(id => h("div", { key: id }, nameOf(id) + "：" + last(id).title))),
              test.qs.map((q, i) => h("div", { key: i, style: { padding: "8px 0", borderBottom: "1px dashed " + LINE } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: INK } }, (i + 1) + ". " + q.q),
                q.opts.map((o, j) => { const who2 = ids.filter(id => last(id).picks[i] === j); return who2.length ? h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 12, color: "#6d6255", marginTop: 3 } }, o.t + "：" + who2.map(nameOf).join("、")) : null; }))));
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
                  "那时：" + Z.optText(test, i, old.picks[i]) + ((old.whys || [])[i] ? "（" + old.whys[i] + "）" : "") + "\n现在：" + Z.optText(test, i, now.picks[i]) + ((now.whys || [])[i] ? "（" + now.whys[i] + "）" : "")))));
          })() : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, margin: "18px 0 6px" } }, recs.length ? nameOf(who) + " 做过 " + recs.length + " 次" : "还没做过"),
          recs.map(r => h("div", { key: r.id, "data-wk": "zyrec", style: { borderTop: "1px solid " + LINE, padding: "10px 0" } },
            h("button", { onClick: () => setOpenRec(openRec === r.id ? null : r.id), className: "w-full text-left active:opacity-70", style: { display: "flex", alignItems: "center", gap: 8 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: INK, flex: 1 } }, r.title,
                r.scene ? h("span", { "data-wk": "zyscenetag", style: { marginLeft: 6, fontFamily: F_BODY, fontSize: 11, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "1px 7px" } }, r.scene) : null,
                r.group ? h("span", { style: { marginLeft: 6, fontFamily: F_BODY, fontSize: 11, color: FOG } }, "群里一起做的") : null),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG } }, Z.dateZh(r.ts) + (openRec === r.id ? " ▴" : " ▾"))),
            openRec === r.id ? h("div", null,
              who !== "me" && props.onReplay ? h("button", { "data-wk": "zyreplay", onClick: () => props.onReplay(who, r), className: "active:opacity-70", style: { margin: "6px 0", fontFamily: F_BODY, fontSize: 12.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "4px 12px" } }, "▶ 看他做的回放") : null,
              // 存成图／收进时刻／发给出题的他（她 2026-10-22）
              h("div", { "data-wk": "zyrecacts", className: "flex gap-2 flex-wrap", style: { margin: "6px 0" } },
                props.onSaveImage ? h("button", { onClick: () => props.onSaveImage(test.id, r, nameOf(who)), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "6px 12px", minHeight: 40 } }, "存成图") : null,
                who !== "me" && props.onPin ? h("button", { onClick: () => props.onPin(who, test.id, r), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, border: "1px solid " + ACC, borderRadius: 999, padding: "6px 12px", minHeight: 40 } }, "收进时刻") : null,
                who === "me" && test.by && props.onSendMine && chars.some(c => c.id === test.by) ? h("button", { onClick: () => props.onSendMine(test.by, test.id, r), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12.5, color: "#fff", background: ACC, borderRadius: 999, padding: "6px 12px", minHeight: 40 } }, "发给 " + nameOf(test.by) + " 看我的答案") : null),
              // 换了处境的那次：跟最近一次「平时」的并排，只列选得不一样的题
              r.scene ? (function () {
                const base = recs.find(x => !x.scene && x.id !== r.id);
                if (!base) return h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, margin: "4px 0" } }, "他还没在平时做过这套，做一次就能跟这次对着看");
                const moved = test.qs.map((q, i) => i).filter(i => base.picks[i] !== r.picks[i]);
                return h("div", { "data-wk": "zyscenediff", style: { margin: "6px 0 10px", padding: "10px 12px", borderRadius: 10, background: "#fffaf3", border: "1px solid " + LINE } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC } }, moved.length ? "跟平时那次（" + Z.dateZh(base.ts) + "）比，这 " + moved.length + " 题换了：" : "跟平时那次（" + Z.dateZh(base.ts) + "）比，每题都一样"),
                  moved.map(i => h("div", { key: i, style: { padding: "6px 0", borderTop: "1px dashed " + LINE, fontFamily: F_BODY, fontSize: 12, color: "#6d6255", lineHeight: 1.6, whiteSpace: "pre-wrap" } },
                    h("div", { style: { color: INK, fontSize: 13 } }, (i + 1) + ". " + test.qs[i].q),
                    "平时：" + Z.optText(test, i, base.picks[i]) + ((base.whys || [])[i] ? "（" + base.whys[i] + "）" : "") + "\n这次：" + Z.optText(test, i, r.picks[i]) + ((r.whys || [])[i] ? "（" + r.whys[i] + "）" : ""))));
              })() : null,
              test.qs.map((q, i) => qBlock(test, i, r.picks[i], (r.whys || [])[i], false)),
              // 结果和评语压在题目最下面（她 2026-10-22）
              h("div", { "data-wk": "zyresult", style: { margin: "14px 0 6px", padding: "14px 14px 12px", borderRadius: 12, background: "#fffaf3", border: "1px solid " + LINE } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".2em", color: FOG } }, nameOf(who) + (r.free ? " 做完说" : " 测出来是")),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", color: INK, marginTop: 4 } }, r.title),
                test.bid && r.bids ? Z.bidBars(test, r.bids, { INK, FOG, LINE, ACC }) : r.line && r.line !== r.title ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#6d6255", marginTop: 4, lineHeight: 1.6 } }, r.line) : null,
                Z.guessLine(test, r) ? h("div", { "data-wk": "zyguess", style: { fontFamily: F_BODY, fontSize: 12.5, color: ACC, marginTop: 8 } }, Z.guessLine(test, r)) : null,
                (r.revs || []).length ? h("div", { "data-wk": "zyrev", style: { fontFamily: F_BODY, fontSize: 12, color: "#6f5f4d", marginTop: 8, lineHeight: 1.7 } }, r.revs.map((x, k) => h("div", { key: k }, "回头改了第 " + (x.i + 1) + " 题：「" + Z.optText(test, x.i, x.from).slice(0, 12) + "」→「" + Z.optText(test, x.i, x.to).slice(0, 12) + "」" + (x.why ? "——" + x.why : "")))) : null,
                r.review ? h("div", { "data-wk": "zyreview", style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#5d5246", marginTop: 10, paddingTop: 10, borderTop: "1px dashed " + LINE, lineHeight: 1.75 } }, r.review) : null),
              h("button", { onClick: () => requestAppConfirm("删掉这一次？", "这次的结果和每题选了什么一起删掉，他也就不记得做过这一次了。", () => { Z.delRecord(who, r.id); setOpenRec(null); bump(x => x + 1); }, "删掉"),
                className: "active:opacity-60", style: { marginTop: 8, fontFamily: F_BODY, fontSize: 12, color: "#b85c5c" } }, "删掉这一次")) : null))));
    }

    // ── 首页：挑人、挑一套 ──
    return h("div", { "data-wk": "zypage", className: "h-full flex flex-col", style: { background: PAPER } },
      h(Head, { zh: "照影", sub: "看看他会怎么选", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 18px 40px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: FOG, padding: "8px 2px 10px", lineHeight: 1.6 } }, "挑一套，点进去发给他做，或者自己做一份。"),
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
        Z.allTests().filter(tt => curCat === "all" || Z.catOf(tt) === curCat).map(tt => h("button", { key: tt.id, "data-wk": "zytest", onClick: () => setTestId(tt.id), className: "w-full text-left active:scale-[.98]", style: { display: "block", marginBottom: 14, transition: "transform .15s" } }, cover(tt, false))),
        h("button", { "data-wk": "zynew", onClick: () => { setGen({ theme: "", count: 10, busy: false }); setEdit({ id: "", name: "", sub: "", scored: false, results: [], qs: [{ q: "", opts: [{ t: "", r: 0 }, { t: "", r: 0 }] }] }); }, className: "w-full active:scale-[.98]",
          style: { display: "block", padding: "22px 0", borderRadius: 18, border: "1.5px dashed #cbbca9", fontFamily: F_DISPLAY, fontSize: 15, color: INK } },
          "＋ 出一套题", h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, marginTop: 4 } }, "自己写，或者给个主题让 AI 出，出完能改")),
        // 他给你出一套（她 2026-10-22）：照他想知道你什么来出，出好了你来做
        props.onCharGen && chars.length ? h("div", { "data-wk": "zychargen", style: { marginTop: 18 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: INK, marginBottom: 4 } }, "让他给你出一套"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG, marginBottom: 8 } }, busyWho || "照他想知道你什么来出，用他那条线路花一次调用；出好了你来做，做完能发给他看"),
          h("div", { className: "flex gap-3 overflow-x-auto", style: { padding: "4px 2px 6px" } }, chars.map(c => face(false, c, c.remark || c.name, async () => {
            if (busyWho) return;
            setBusyWho((c.remark || c.name) + " 在出题…");
            const t2 = await props.onCharGen(c.id);
            setBusyWho("");
            if (t2) { setWho("me"); setTestId(t2.id); bump(x => x + 1); }
          })))) : null));
  }
  g.ZhaoyingApp = ZhaoyingApp;
})();
