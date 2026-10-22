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
    const chars = (props.characters || []).filter(c => c && !c.npc);
    const [who, setWho] = useState(chars[0] ? chars[0].id : "me");      // 在看谁的
    const [testId, setTestId] = useState(null);                         // 点开的那一套
    const [run, setRun] = useState(null);       // { mode:"char"|"me", testId, picks, whys, step, shown, done, busy }
    const [openRec, setOpenRec] = useState(null);
    const [tick, bump] = useState(0);
    const [compare, setCompare] = useState(false);
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
      Z.addRecord(r.who, { testId: r.testId, ts: Date.now(), picks: r.picks, whys: r.whys || [], code: res.code, title: res.title, line: res.line });
      setRun(Object.assign({}, r, { done: true, res, step: Z.byId(r.testId).qs.length }));
      bump(x => x + 1);
    };
    const startChar = async () => {
      if (!char || !test) return;
      const prev = Z.recordsOf(char.id, test.id);
      setRun({ mode: "char", who: char.id, testId: test.id, busy: true, picks: [], whys: [], step: 0 });
      try {
        const d = await runProbe(props.apiFor(char.id), props.ctxFor(char), { voice: true, tag: "zhaoying",
          instruction: Z.askInstruction(test, meName, prev), schemaHint: Z.ASK_SCHEMA, maxTokens: 20000 });
        const a = Z.readAnswers(test, d);
        play({ mode: "char", who: char.id, testId: test.id, picks: a.picks, whys: a.whys }, 0);
      } catch (e) { setRun(null); props.toast && props.toast("他这回没做成：" + String((e && e.message) || e).slice(0, 60)); }
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
    const qBlock = (tt, i, pick, why, live) => {
      const q = tt.qs[i];
      return h("div", { key: i, "data-wk": "zyq", style: { padding: "12px 0", borderBottom: "1px dashed " + LINE } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: INK, lineHeight: 1.6 } }, (i + 1) + ". " + q.q),
        h("div", { style: { marginTop: 6, display: "flex", flexDirection: "column", gap: 5 } }, q.opts.map((o, j) => h("div", { key: j, "data-wk": "zyopt", "data-on": pick === j ? "1" : "0",
          style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", padding: "6px 10px", borderRadius: 6, border: "1px solid " + (pick === j ? ACC : LINE),
            background: pick === j ? "rgba(176,118,74,.10)" : "transparent", color: pick === j ? INK : FOG, transition: "all .25s" } }, (pick === j ? "✓ " : "") + o.t))),
        why ? h("div", { "data-wk": "zywhy", style: { marginTop: 7, fontFamily: F_BODY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", color: "#7a6a58", lineHeight: 1.6,
          animation: live ? "wkpop .3s ease-out both" : undefined } }, "心声：" + why) : null);
    };
    const resultBox = (res, whoId) => h("div", { "data-wk": "zyresult", style: { margin: "14px 0", padding: "14px 14px", borderRadius: 10, background: "#efe6da", border: "1px solid " + LINE } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: ".2em", color: FOG } }, nameOf(whoId) + " 测出来是"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: INK, marginTop: 4 } }, res.title),
      res.line && res.line !== res.title ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: "#6d6255", marginTop: 4, lineHeight: 1.6 } }, res.line) : null);
    const page = (title, back, kids) => h("div", { "data-wk": "zypage", className: "h-full flex flex-col", style: { background: PAPER } },
      h(Head, { zh: title, sub: "照影", onBack: back, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 18px 40px" } }, kids));

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
          run.done ? resultBox(run.res, run.who) : null, share,
          run.mode === "me" && !run.done && run.step < tt.qs.length ? h("div", { "data-wk": "zyq" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: INK, lineHeight: 1.6, margin: "10px 0 12px" } }, (run.step + 1) + ". " + tt.qs[run.step].q),
            tt.qs[run.step].opts.map((o, j) => h("button", { key: j, "data-wk": "zyopt", onClick: () => mePick(j), className: "w-full text-left active:opacity-70",
              style: { display: "block", marginBottom: 8, padding: "11px 12px", borderRadius: 8, border: "1px solid " + LINE, background: "#fffaf3", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: INK } }, o.t))) : null,
          // 他做的：已经选完的那几题按顺序摞下来，最新那题先出题、过一会儿亮出选项和心声
          run.mode === "char" ? tt.qs.map((q, i) => i < run.step || run.done ? qBlock(tt, i, run.picks[i], run.whys[i], false)
            : i === run.step ? qBlock(tt, i, run.shown ? run.picks[i] : -1, run.shown ? run.whys[i] : "", true) : null).filter(Boolean).reverse() : null));
    }

    // ── 一套题的档案 ──
    if (test) {
      const recs = Z.recordsOf(who, test.id);
      const mine = Z.recordsOf("me", test.id)[0], his = who !== "me" ? recs[0] : null;
      return page(test.name, () => { setTestId(null); setOpenRec(null); setCompare(false); },
        h(Fragment, null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: FOG, lineHeight: 1.6, padding: "8px 0 12px" } }, test.sub + " · " + test.qs.length + " 题"),
          who !== "me" ? h("button", { "data-wk": "zygo", onClick: startChar, className: "w-full active:opacity-70", style: { padding: "12px 0", borderRadius: 10, background: INK, color: PAPER, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } },
            (recs.length ? "让 " + nameOf(who) + " 再做一次" : "让 " + nameOf(who) + " 做"))
            : h("button", { "data-wk": "zygo", onClick: startMe, className: "w-full active:opacity-70", style: { padding: "12px 0", borderRadius: 10, background: INK, color: PAPER, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } }, recs.length ? "我再做一次" : "我来做"),
          who !== "me" ? h("button", { "data-wk": "zygome", onClick: startMe, className: "w-full active:opacity-70", style: { marginTop: 8, padding: "10px 0", borderRadius: 10, border: "1px solid " + LINE, color: INK, fontFamily: F_BODY } }, mine ? "我也再做一次" : "我也做一份") : null,
          his && mine ? h("button", { "data-wk": "zycompare", onClick: () => setCompare(v => !v), className: "w-full active:opacity-70", style: { marginTop: 8, padding: "10px 0", borderRadius: 10, border: "1px dashed " + ACC, color: ACC, fontFamily: F_BODY } }, compare ? "收起对比" : "我们俩对一对") : null,
          compare && his && mine ? h("div", { "data-wk": "zycomparebox", style: { marginTop: 10 } },
            h("div", { className: "flex gap-2" }, resultBox({ title: his.title, line: his.line }, who), resultBox({ title: mine.title, line: mine.line }, "me")),
            test.qs.map((q, i) => h("div", { key: i, style: { padding: "9px 0", borderBottom: "1px dashed " + LINE } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: INK } }, (i + 1) + ". " + q.q),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: his.picks[i] === mine.picks[i] ? ACC : "#6d6255", marginTop: 4, lineHeight: 1.6 } },
                nameOf(who) + "：" + Z.optText(test, i, his.picks[i]) + "\n我：" + Z.optText(test, i, mine.picks[i]) + (his.picks[i] === mine.picks[i] ? "　· 一样" : ""))))) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: FOG, margin: "18px 0 6px" } }, recs.length ? nameOf(who) + " 做过 " + recs.length + " 次" : "还没做过"),
          recs.map(r => h("div", { key: r.id, "data-wk": "zyrec", style: { borderTop: "1px solid " + LINE, padding: "10px 0" } },
            h("button", { onClick: () => setOpenRec(openRec === r.id ? null : r.id), className: "w-full text-left active:opacity-70", style: { display: "flex", alignItems: "center", gap: 8 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: INK, flex: 1 } }, r.title),
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: FOG } }, Z.dateZh(r.ts) + (openRec === r.id ? " ▴" : " ▾"))),
            openRec === r.id ? h("div", null,
              test.qs.map((q, i) => qBlock(test, i, r.picks[i], (r.whys || [])[i], false)),
              h("button", { onClick: () => requestAppConfirm("删掉这一次？", "这次的结果和每题选了什么一起删掉，他也就不记得做过这一次了。", () => { Z.delRecord(who, r.id); setOpenRec(null); bump(x => x + 1); }, "删掉"),
                className: "active:opacity-60", style: { marginTop: 8, fontFamily: F_BODY, fontSize: 12, color: "#b85c5c" } }, "删掉这一次")) : null))));
    }

    // ── 首页：挑人、挑一套 ──
    return h("div", { "data-wk": "zypage", className: "h-full flex flex-col", style: { background: PAPER } },
      h(Head, { zh: "照影", sub: "看看他会怎么选", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 18px 40px" } },
        h("div", { "data-wk": "zywho", className: "flex gap-2 overflow-x-auto", style: { padding: "6px 0 14px" } },
          chars.map(c => pill(who === c.id, c.remark || c.name, () => setWho(c.id))), pill(who === "me", "我自己", () => setWho("me"))),
        Z.TESTS.map(tt => { const last = Z.recordsOf(who, tt.id)[0];
          return h("button", { key: tt.id, "data-wk": "zytest", onClick: () => setTestId(tt.id), className: "w-full text-left active:opacity-70",
            style: { display: "block", padding: "14px 14px", marginBottom: 10, borderRadius: 10, background: "#fffaf3", border: "1px solid " + LINE } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: INK } }, tt.name),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: FOG, marginTop: 3 } }, tt.sub),
            last ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: ACC, marginTop: 6 } }, "上次：" + last.title + " · " + Z.dateZh(last.ts)) : null); })));
  }
  g.ZhaoyingApp = ZhaoyingApp;
})();
