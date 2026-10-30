// 健康页面那半（2026-10-18 瘦身第九批）：开机那半在 js/health-core.js（测试里要先 require 它）。
// ============================================================
// 健康（v74.640，她 2026-10-03：「按你说的先做健康app吧，页面简洁点方便操作但是不要没有设计感光秃秃」）
//
// 饮食（热量）、喝水、运动和步数、睡眠、体重、经期（跟日历月事本【同一份】x_period）、心情、这一周。
// 接手机健康数据要走快捷指令 → 云端收件箱，另起一版；现在步数和睡眠是她自己填的。
//
// 角色监督是【她自己开的开关】：开不开、谁来管、饭点会不会主动来问，都在「谁看着」那一页。
//   · 上下文只给她点名的那几位，而且只在用得上的时候给一行事实（饭点前后、她刚记过一餐）——
//     不是每轮都塞，也不附带「该怎么管」的规矩：怎么管、管不管，是那个人自己的事。
//   · 主动来问一天最多两次（午饭、晚饭），她那一顿已经记了就不问。
//
// 外卖 app 里点的是角色那边的假单子，不进这里（她 2026-10-03：「外卖是假的app角色的外卖啦」）。
// ============================================================
(function () {
  const { g, dayOf, shift, load, save, MEALS, FOODS, SPORTS, burnOf, lastKg, hrs, mealsOn, sum, dayTotals, weekOf, weightTrend, lateMin, PACT_KINDS, pactKind, pactDays, pactLive, weightEta, weekFacts, SHORTCUT_MARK, SHORTCUT_TEMPLATE, SHORTCUT_TEMPLATE_MINI, num, parseShortcut, applyShortcut, GATEWAY_WORKER, pullGateway, estimate, MOODS } = (typeof window !== "undefined" ? window : globalThis).HealthCore;
  const SLEEP_Q = ["老醒", "一般", "睡得沉"];

  // ── 画 ────────────────────────────────────────────────────
  const { useState, useMemo } = React;
  // 一张干净的化验单底：米白纸、墨绿字；热量暖橘、水是浅蓝、经期砖红
  const BASE = { bg: "#f3f1ea", bg2: "#e8e5db", ink: "#27332c", sub: "#6f7a72", fog: "#a3aba4", line: "rgba(39,51,44,.12)",
    accent: "#4f8a6c", tint: "#d9824f", water: "#4f8db5", blood: "#c25a4a" };
  const pal = () => (typeof pagePalette === "function" ? pagePalette("health", BASE) : BASE);
  const A = (c, a) => (typeof paletteAlpha === "function" ? paletteAlpha(c, a) : c);
  // 底纹：一层极淡的方格（化验单那种坐标纸），铺在外壳上、不跟着滚
  const GRID = c => "linear-gradient(" + A(c, "09") + " 1px, transparent 1px), linear-gradient(90deg, " + A(c, "09") + " 1px, transparent 1px)";

  // tab 长成一段心电图（tabs-not-plain-pills）：一根基线横贯三格，选中那一格正上方跳出一个波峰；
  //   走过的那段实线、后面淡下去。换个 app 这条线就不成立了。
  function PulseTabs({ tabs, cur, onPick, S }) {
    const n = tabs.length, idx = Math.max(0, tabs.findIndex(t => t[0] === cur));
    const W = 300, H = 34, base = 24, cx = (idx + 0.5) * W / n;
    const d = "M0 " + base + " L" + (cx - 22) + " " + base + " L" + (cx - 14) + " " + (base - 4) + " L" + (cx - 8) + " " + base
      + " L" + (cx - 4) + " " + (base + 5) + " L" + cx + " " + (base - 20) + " L" + (cx + 5) + " " + (base + 7) + " L" + (cx + 10) + " " + base
      + " L" + (cx + 18) + " " + (base - 5) + " L" + (cx + 26) + " " + base + " L" + W + " " + base;
    return h("div", { "data-wk": "healthtabs", style: { position: "relative", padding: "2px 0 0" } },
      h("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", style: { position: "absolute", left: 0, right: 0, top: 0, width: "100%", height: H, pointerEvents: "none" } },
        h("defs", null, h("linearGradient", { id: "hpulse", x1: 0, x2: 1 },
          h("stop", { offset: 0, stopColor: S.accent, stopOpacity: 0.9 }),
          h("stop", { offset: Math.min(1, (cx + 30) / W), stopColor: S.accent, stopOpacity: 0.9 }),
          h("stop", { offset: Math.min(1, (cx + 31) / W), stopColor: S.accent, stopOpacity: 0.22 }),
          h("stop", { offset: 1, stopColor: S.accent, stopOpacity: 0.22 }))),
        h("path", { d: d, fill: "none", stroke: "url(#hpulse)", strokeWidth: 1.6, strokeLinejoin: "round", vectorEffect: "non-scaling-stroke", style: { transition: "d .3s" } })),
      h("div", { style: { display: "flex", position: "relative" } },
        tabs.map((t, i) => {
          const on = i === idx;
          return h("button", { key: t[0], onClick: () => onPick(t[0]), "aria-pressed": on, className: "active:opacity-70",
            style: { flex: 1, minHeight: 56, paddingTop: 30, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: on ? 14 : 12.5, fontWeight: on ? 700 : 400, color: on ? S.ink : S.fog, letterSpacing: ".06em" } }, t[1]));
        })));
  }

  // 段落：不加框，一枚小十字（化验单上的那种）领一行小标题
  function Section({ S, title, right, children, wk }) {
    return h("div", { "data-wk": wk || "healthcard", style: { padding: "6px 0 18px" } },
      h("div", { className: "flex items-center", style: { gap: 7, margin: "8px 0 10px" } },
        h("svg", { width: 9, height: 9, viewBox: "0 0 10 10" }, h("path", { d: "M5 0v10M0 5h10", stroke: S.accent, strokeWidth: 2.2 })),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, letterSpacing: ".16em", flex: 1 } }, title),
        right || null),
      children);
  }
  // 不画框（她 2026-10-03：「这个页面的框不好看」）：按钮是一块浅色的底，输入框是化验单上那条填写横线
  const btnS = (S, strong) => ({ minHeight: 40, padding: "0 16px", borderRadius: 99, border: "none",
    background: strong ? S.accent : A(S.accent, "17"), color: strong ? S.bg : S.accent, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", fontWeight: 600 });
  const inputS = S => ({ minHeight: 42, padding: "0 2px", borderRadius: 0, border: "none", borderBottom: "1.5px solid " + A(S.ink, "2b"), background: "transparent",
    color: S.ink, fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", outline: "none", width: "100%", boxSizing: "border-box" });
  const chipS = (S, on, col) => ({ minHeight: 36, padding: "0 13px", borderRadius: 99, border: "none",
    background: on ? A(col || S.accent, "24") : A(S.ink, "0b"), color: on ? (col || S.accent) : S.sub, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: on ? 600 : 400 });

  // 热量环：吃了多少 / 定的多少；超了那一截换暖橘、转第二圈
  function Ring({ S, val, goal: g0, burn }) {
    const goal = g0 + (burn || 0);   // 动了多少，今天就多吃得下多少
    const R = 46, C = 2 * Math.PI * R, r = goal > 0 ? val / goal : 0;
    const left = Math.max(0, goal - val);
    return h("div", { style: { position: "relative", width: 112, height: 112, flexShrink: 0 } },
      h("svg", { width: 112, height: 112, viewBox: "0 0 112 112" },
        h("circle", { cx: 56, cy: 56, r: R, fill: "none", stroke: A(S.accent, "22"), strokeWidth: 9 }),
        h("circle", { cx: 56, cy: 56, r: R, fill: "none", stroke: S.accent, strokeWidth: 9, strokeLinecap: "round",
          strokeDasharray: C, strokeDashoffset: C * (1 - Math.min(1, r)), transform: "rotate(-90 56 56)", style: { transition: "stroke-dashoffset .4s" } }),
        r > 1 ? h("circle", { cx: 56, cy: 56, r: R, fill: "none", stroke: S.tint, strokeWidth: 9, strokeLinecap: "round",
          strokeDasharray: C, strokeDashoffset: C * (1 - Math.min(1, r - 1)), transform: "rotate(-90 56 56)" }) : null),
      h("div", { style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } },
        h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(24px * var(--app-fs, 1))", color: S.ink, lineHeight: 1 } }, val),
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: S.sub, marginTop: 4 } }, r > 1 ? "多了 " + (val - goal) : "还剩 " + left),
        burn ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: S.accent, marginTop: 2 } }, "运动 +" + burn) : null));
  }
  function MacroBar({ S, label, v, color, of }) {
    return h("div", { style: { marginBottom: 8 } },
      h("div", { className: "flex", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.sub, marginBottom: 4 } },
        h("span", { style: { flex: 1 } }, label), h("span", { style: { color: S.ink } }, v + " 克")),
      h("div", { style: { height: 5, borderRadius: 9, background: A(color, "22") } },
        h("div", { style: { width: Math.min(100, of > 0 ? v / of * 100 : 0) + "%", height: "100%", borderRadius: 9, background: color, transition: "width .3s" } })));
  }
  // 一杯水：点第几杯就记到第几杯，再点同一杯退回一杯
  function Cup({ S, full, onClick }) {
    return h("button", { "data-wk": "block", onClick, className: "active:scale-90", style: { width: 34, height: 44, background: "transparent", border: "none", padding: 0, transition: "transform .1s" } },
      h("svg", { width: 26, height: 34, viewBox: "0 0 26 34" },
        h("path", { d: "M3 3h20l-2.4 27a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8z", fill: full ? A(S.water, "cc") : "none", stroke: full ? S.water : S.fog, strokeWidth: 1.4, strokeLinejoin: "round" }),
        full ? h("path", { d: "M6 9q3.5 2 7 0t7 0", fill: "none", stroke: "rgba(255,255,255,.55)", strokeWidth: 1.2 }) : null));
  }
  function Face({ S, v, on, onClick, mini }) {
    const mouth = ["M8 19q5-5 10 0", "M8 18q5-2.5 10 0", "M8 17.5h10", "M8 16.5q5 3 10 0", "M7.5 15.5q5.5 5.5 11 0"][v];
    const col = on ? S.accent : S.fog;
    return h("button", { "data-wk": "block", onClick, "aria-pressed": on, style: { flex: 1, minHeight: 56, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 } },
      h("svg", { width: on ? 32 : 26, height: on ? 32 : 26, viewBox: "0 0 26 26", style: { transition: "all .2s" } },
        h("circle", { cx: 13, cy: 13, r: 11.5, fill: on ? A(S.accent, "1f") : "none", stroke: col, strokeWidth: 1.4 }),
        h("circle", { cx: 9.3, cy: 10.5, r: 1.2, fill: col }), h("circle", { cx: 16.7, cy: 10.5, r: 1.2, fill: col }),
        h("path", { d: mouth, fill: "none", stroke: col, strokeWidth: 1.5, strokeLinecap: "round" })),
      mini ? null : h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: on ? S.ink : S.fog } }, MOODS[v]));
  }
  // 体重那条线：最近三十次，一条细线，最后一个点钉住
  function Spark({ S, rows }) {
    if (rows.length < 2) return null;
    const W = 300, H = 70, ks = rows.map(r => Number(r.kg)), lo = Math.min.apply(null, ks), hi = Math.max.apply(null, ks), span = Math.max(0.5, hi - lo);
    const pt = (r, i) => [i / (rows.length - 1) * (W - 12) + 6, H - 8 - (Number(r.kg) - lo) / span * (H - 20)];
    const pts = rows.map(pt), last = pts[pts.length - 1];
    return h("svg", { viewBox: "0 0 " + W + " " + H, style: { width: "100%", height: H, display: "block" } },
      h("path", { d: "M" + pts.map(p => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L"), fill: "none", stroke: S.accent, strokeWidth: 1.6, strokeLinejoin: "round", vectorEffect: "non-scaling-stroke" }),
      h("circle", { cx: last[0], cy: last[1], r: 3.5, fill: S.bg, stroke: S.accent, strokeWidth: 2 }));
  }

  // ── 记一餐（整页，no-half-sheet）──────────────────────────────
  function AddMeal({ S, meal0, api, toast, onAdd, onBack }) {
    const [meal, setMeal] = useState(meal0 || "lunch");
    const [q, setQ] = useState("");
    const [pick, setPick] = useState(null), [qty, setQty] = useState(1);
    const [ai, setAi] = useState(""), [busy, setBusy] = useState(false), [guess, setGuess] = useState(null);
    const [man, setMan] = useState({ name: "", kcal: "" });
    const list = useMemo(() => (q.trim() ? FOODS.filter(f => f.name.includes(q.trim())) : FOODS), [q]);
    const add = rows => { onAdd(rows.map(r => Object.assign({ meal }, r))); onBack(); };
    const runAi = async () => {
      if (!ai.trim() || busy) return;
      setBusy(true);
      try { setGuess(await estimate(api, ai)); }
      catch (e) { toast && toast(String(e && e.message || e).split("\n")[0]); }
      finally { setBusy(false); }
    };
    return h("div", { "data-wk": "healthpage", "data-part": "addmeal", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: GRID(S.ink), backgroundSize: "22px 22px" } },
      h(Head, { zh: "记一餐", onBack, ink: S.ink, bg: "transparent", noLine: true }),
      h("div", { className: "shrink-0 flex", style: { padding: "0 16px 6px", gap: 6 } },
        MEALS.map(m => h("button", { key: m[0], onClick: () => setMeal(m[0]), "aria-pressed": meal === m[0],
          style: Object.assign(chipS(S, meal === m[0]), { flex: 1, minHeight: 40, fontSize: "calc(13px * var(--app-fs, 1))" }) }, m[1]))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 28px" } },
        h(Section, { S, title: "说一句，让模型估" },
          h("div", { className: "flex", style: { gap: 8 } },
            h("input", { "data-wk": "input", value: ai, onChange: e => setAi(e.target.value), placeholder: "吃了什么、大概多少", style: inputS(S), onKeyDown: e => { if (e.key === "Enter") runAi(); } }),
            h("button", { onClick: runAi, disabled: busy || !ai.trim(), style: Object.assign(btnS(S, true), { flexShrink: 0, opacity: busy || !ai.trim() ? 0.5 : 1 }) }, busy ? "估着…" : "估一下")),
          guess ? h("div", { style: { marginTop: 10 } },
            guess.map((x, i) => h("div", { key: i, className: "flex items-center", style: { padding: "8px 0", borderBottom: "1px dashed " + S.line, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: S.ink } },
              h("span", { style: { flex: 1 } }, x.name),
              h("span", { style: { color: S.sub, fontSize: "calc(11.5px * var(--app-fs, 1))", marginRight: 10 } }, "蛋白 " + x.p + " · 碳水 " + x.c + " · 脂肪 " + x.f),
              h("span", { style: { color: S.tint, fontWeight: 600 } }, x.kcal))),
            h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
              h("button", { onClick: () => setGuess(null), style: btnS(S) }, "不对，重说"),
              h("button", { onClick: () => add(guess.map(x => Object.assign({ src: "ai", qty: 1 }, x))), style: Object.assign(btnS(S, true), { flex: 1 }) }, "就记这些"))) : null),
        h(Section, { S, title: "常吃的" },
          h("input", { "data-wk": "input", value: q, onChange: e => setQ(e.target.value), placeholder: "搜一下", style: Object.assign(inputS(S), { marginBottom: 6 }) }),
          list.map(f => {
            const on = pick === f;
            return h("div", { key: f.name, style: { borderBottom: "1px dashed " + S.line } },
              h("button", { onClick: () => { setPick(on ? null : f); setQty(1); }, className: "flex items-center",
                style: { width: "100%", minHeight: 44, background: "transparent", border: "none", padding: 0, fontFamily: F_BODY, textAlign: "left" } },
                h("span", { style: { flex: 1, fontSize: "calc(14px * var(--app-fs, 1))", color: S.ink, fontWeight: on ? 600 : 400 } }, f.name),
                h("span", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.fog, marginRight: 10 } }, f.unit),
                h("span", { style: { fontSize: "calc(13px * var(--app-fs, 1))", color: S.tint } }, f.kcal)),
              on ? h("div", { className: "flex items-center", style: { gap: 8, paddingBottom: 10 } },
                h("button", { onClick: () => setQty(Math.max(0.5, qty - 0.5)), style: Object.assign(btnS(S), { padding: 0, width: 40 }) }, "−"),
                h("span", { style: { minWidth: 54, textAlign: "center", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: S.ink } }, qty + " 份"),
                h("button", { onClick: () => setQty(qty + 0.5), style: Object.assign(btnS(S), { padding: 0, width: 40 }) }, "＋"),
                h("button", { onClick: () => add([Object.assign({ src: "table", qty }, f)]), style: Object.assign(btnS(S, true), { flex: 1 }) }, "记下 · " + Math.round(f.kcal * qty))) : null);
          }),
          !list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: S.fog, padding: "10px 0" } }, "这里没有，用上面那行让模型估，或者下面自己填。") : null),
        h(Section, { S, title: "自己填" },
          h("div", { className: "flex", style: { gap: 8 } },
            h("input", { "data-wk": "input", value: man.name, onChange: e => setMan(Object.assign({}, man, { name: e.target.value })), placeholder: "吃了什么", style: inputS(S) }),
            h("input", { "data-wk": "input", value: man.kcal, onChange: e => setMan(Object.assign({}, man, { kcal: e.target.value.replace(/[^\d]/g, "") })), placeholder: "千卡", inputMode: "numeric", style: Object.assign(inputS(S), { width: 84, flexShrink: 0 }) }),
            h("button", { disabled: !man.name.trim() || !Number(man.kcal), onClick: () => add([{ name: man.name.trim().slice(0, 30), kcal: Number(man.kcal), p: 0, c: 0, f: 0, qty: 1, src: "manual" }]),
              style: Object.assign(btnS(S, true), { flexShrink: 0, opacity: !man.name.trim() || !Number(man.kcal) ? 0.5 : 1 }) }, "记下")))));
  }

  // ── 从手机健康导入（整页）：怎么搭快捷指令 + 剪贴板读不到时手动粘 ──────────
  function ImportPage({ S, onImport, toast, onBack }) {
    const [txt, setTxt] = useState("");
    const step = (n, title, body) => h("div", { className: "flex", style: { gap: 12, padding: "10px 0" } },
      h("span", { style: { width: 24, height: 24, borderRadius: 99, background: A(S.accent, "1c"), color: S.accent, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, n),
      h("div", { style: { flex: 1, fontFamily: F_BODY } },
        h("div", { style: { fontSize: "calc(14.5px * var(--app-fs, 1))", color: S.ink, fontWeight: 600 } }, title),
        h("div", { style: { fontSize: "calc(12.5px * var(--app-fs, 1))", color: S.sub, marginTop: 4, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, body)));
    const tryPaste = () => { if (!onImport(txt)) toast && toast("没认出来：第一行要是「" + SHORTCUT_MARK + "」，后面每行「名字：数」"); };
    return h("div", { "data-wk": "healthpage", "data-part": "importpage", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: GRID(S.ink), backgroundSize: "22px 22px" } },
      h(Head, { zh: "从手机健康导入", onBack, ink: S.ink, bg: "transparent", noLine: true }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 28px" } },
        h(Section, { S, title: "这是怎么走的", wk: "healthimport" },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: S.sub, lineHeight: 1.75 } },
            "网页读不到 iPhone 的健康 App，所以借你手机里的「快捷指令」：它把今天的步数、睡眠、活动能量、体重、喝水抄成几行字放进剪贴板，你回到这里点「导入」。整个过程不经过任何服务器，每个人在自己手机上搭一次就行，以后一点就跑。")),
        h(Section, { S, title: "搭一次快捷指令（iPhone）" },
          step(1, "新建快捷指令", "打开「快捷指令」App →「＋」。名字随便起，比如「秋秋健康」。"),
          step(2, "加动作：先只放步数、电量、位置三样", "先跑通三样，再往里加别的，出错好找。点底下「搜索操作」，依次加：\n① 查找健康样本：「类型」选 步数，「添加过滤条件」设成 开始日期 是 今天\n② 计算统计数据（搜「统计」）：选 总和——算出来的就是今天总步数\n③ 获取电池电量\n④ 获取当前位置\n以后想加：睡眠是「查找健康样本」类型选 睡眠分析、开始日期选 过去 1 天，再「计算统计数据」统计时长的总和；天气是「获取当前天气」；今天的预报是「获取天气预报」（类型选「每日」）→「从列表中获取项目」取第一项 → 填它的「状况」到「预报：」后面（一天报一次就够，早上那次带上）；活动能量、锻炼分钟、体重、水都跟步数一个做法。"),
          step(3, "加一个「文本」动作，贴进模板、填变量", "先点下面的「复制精简版」，粘进「文本」里；以后加了睡眠、天气这些，再换成「复制完整版」。用不上的行可以删掉，也可以空着。\n填变量：把光标点到冒号后面，键盘上方会出现变量栏——\n· 步数：后面选「统计数据」\n· 电量：后面选「电池电量」\n· 纬度：后面选「当前位置」，再点一下这个变量，属性选「纬度」；经度同理选「经度」\n日期那行空着就算今天。"),
          [["先跑通用的精简版（三样）", SHORTCUT_TEMPLATE_MINI, "复制精简版"], ["想要的都加上以后换成完整版", SHORTCUT_TEMPLATE, "复制完整版"]].map(m => h("div", { key: m[2], style: { margin: "6px 0 12px 36px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, marginBottom: 4 } }, m[0]),
            h("div", { style: { padding: "10px 12px", borderRadius: 12, background: A(S.ink, "08"), fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(12.5px * var(--app-fs, 1))", color: S.ink, whiteSpace: "pre-wrap", lineHeight: 1.7 } }, m[1].trim()),
            h("button", { onClick: async () => { const ok = typeof copyText === "function" && await copyText(m[1]); toast && toast(ok ? "已复制" : "没复制上，长按上面那段自己复制"); }, style: Object.assign(btnS(S), { marginTop: 8 }) }, m[2]))),
          step(4, "最后加「拷贝到剪贴板」，再加「打开 App」", "「拷贝到剪贴板」拷的是上面那个文本；「打开 App」选秋秋\u673a（用浏览器的就选 Safari）。\n点右下角 ▶ 试跑。第一次会问能不能读健康数据和位置，都点「允许」。"),
          step(5, "回到这里点「导入」", "健康页「今天」最上面那行的「导入」。第一次 iPhone 会问能不能粘贴，点允许。\n想每天自动跑：快捷指令 →「自动化」→「特定时间」，比如每晚十点跑它，第二天打开点一下就进来了。")),
        h(Section, { S, title: "剪贴板读不到的话，贴在这儿" },
          h("textarea", { "data-wk": "textarea", value: txt, onChange: e => setTxt(e.target.value), rows: 7, placeholder: SHORTCUT_TEMPLATE.trim(),
            style: Object.assign(inputS(S), { minHeight: 150, padding: "8px 2px", resize: "none", lineHeight: 1.6 }) }),
          h("button", { onClick: tryPaste, disabled: !txt.trim(), style: Object.assign(btnS(S, true), { width: "100%", marginTop: 12, opacity: txt.trim() ? 1 : 0.5 }) }, "导入这一段")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: S.fog, lineHeight: 1.6, textAlign: "center" } },
          "同一天再导一次，会换掉上次手机导进来的那份；你自己手记的不动。")));
  }

  // ── 怎么搭一个网关（整页）──────────────────────────────────────
  function GatewayGuide({ S, toast, onBack }) {
    const step = (n, title, body, extra) => h("div", { className: "flex", style: { gap: 12, padding: "10px 0" } },
      h("span", { style: { width: 24, height: 24, borderRadius: 99, background: A(S.accent, "1c"), color: S.accent, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, n),
      h("div", { style: { flex: 1, minWidth: 0, fontFamily: F_BODY } },
        h("div", { style: { fontSize: "calc(14.5px * var(--app-fs, 1))", color: S.ink, fontWeight: 600 } }, title),
        h("div", { style: { fontSize: "calc(12.5px * var(--app-fs, 1))", color: S.sub, marginTop: 4, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, body),
        extra || null));
    const code = (s, label) => h("div", { style: { marginTop: 8 } },
      h("div", { style: { padding: "10px 12px", borderRadius: 12, background: A(S.ink, "08"), fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(11px * var(--app-fs, 1))", color: S.ink,
        whiteSpace: "pre", overflowX: "auto", lineHeight: 1.6, maxHeight: 220, overflowY: "auto" } }, s),
      h("button", { onClick: async () => { const ok = typeof copyText === "function" && await copyText(s); toast && toast(ok ? "已复制" : "没复制上，长按那段自己复制"); },
        style: Object.assign(btnS(S), { marginTop: 8 }) }, label));
    return h("div", { "data-wk": "healthpage", "data-part": "gatewayguide", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: GRID(S.ink), backgroundSize: "22px 22px" } },
      h(Head, { zh: "搭一个自己的网关", onBack, ink: S.ink, bg: "transparent", noLine: true }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 28px" } },
        h(Section, { S, title: "先说它是什么", wk: "healthgatewayguide" },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: S.sub, lineHeight: 1.75 } },
            "网关就是一个一直在线的小信箱：手机定时把那几行字投进去，秋秋\u673a打开时去取。这里用 Cloudflare 的 Workers 搭，免费、自带 https、不用买服务器也不用装软件，手机浏览器就能弄完，大概二十分钟。信箱只有你自己的密钥打得开，数据只在你自己的 Cloudflare 账号里。")),
        h(Section, { S, title: "在 Cloudflare 上搭" },
          step(1, "注册 Cloudflare", "打开 dash.cloudflare.com，用邮箱注册一个免费账号（不用绑卡）。"),
          step(2, "建一个 KV（存数据的地方）", "左边菜单「存储和数据库」→「KV」（英文界面：Storage & Databases → Workers KV）→「创建」（Create）。名字随便，比如 qq-health。\n⚠️建好就行，里面什么都不用加——别点「Add entry」往里填东西。代码和密钥都不放这儿，放在下一步的 Worker 里。"),
          step(3, "建一个 Worker", "左边菜单「计算」（Compute，点开它）→「Workers 和 Pages」（Workers & Pages）→「创建」（Create）→「创建 Worker」（Create Worker / Start with Hello World）→ 名字随便起 → 部署（Deploy）。\n部署完点「编辑代码」（Edit code），把里面原来的代码全删掉，换成下面这段，再点右上角「部署」（Deploy）。",
            code(GATEWAY_WORKER, "复制网关代码")),
          step(4, "把 KV 接上", "回到这个 Worker 的页面 →「设置」（Settings）→「绑定」（Bindings）→「添加」（Add binding）。\n左边列表选「KV 命名空间」（KV namespace）——⚠️别选 Secrets Store，那是另一套，选了网关会一直说密钥不对。右边那段示例代码不用管、不用复制。\n点 Add Binding 后：变量名（Variable name）填 HEALTH（大写，一个字母都不能差），命名空间选第 2 步建的那个，再保存。\n接好后下面会出来一个黄框（Update your Wrangler configuration…），那是给用命令行的人看的，点 × 关掉就行。"),
          step(5, "设一把密钥", "同一页上面「运行时变量和机密」（Runtime variables and secrets）右边点「添加变量」（Add variable）：\n· 环境保持勾着 Production，Previews 不用勾\n· Key 填 SECRET（大写）\n· Value 填你自己编的一串乱码，二三十位，字母加数字随便敲，或者用 iPhone「密码」App 生成的强密码\n· 把 Value 右边「Secret」那个小方框勾上\n· 点「Add variable and deploy」\n为什么要这么长：网关地址是公开的，谁拿到都能来试密钥，短的（生日、123456）一下就被试出来，对方就能看到你的位置电量、还能塞假数据。这串只用填两次（快捷指令和秋秋\u673a），存进备忘录复制粘贴就行，不用背。"),
          step(6, "记下网关地址，顺手验一下", "Worker 页面上方（或者右上角 Visit）那个 https://名字.你的账号.workers.dev 就是网关地址。\n用浏览器直接打开它：显示「密钥不对」就说明网关活了——浏览器没带密钥，被拦下是对的。")),
        h(Section, { S, title: "让快捷指令往里投" },
          step(7, "快捷指令最后改成「获取 URL 内容」", "照「从手机健康导入」那页把前面的动作和「文本」搭好。然后把最后的「拷贝到剪贴板」换成「获取 URL 内容」：\n· URL 粘第 6 步的网关地址。⚠️加进来时它会自动把上一步的「文本」塞进 URL 那格（显示成「获取 文本 内容」）——点一下那个蓝色的「文本」，选「清除」，再把网关地址粘进去。只要一个「获取 URL 内容」，多加的那个点 × 删掉\n· 点「显示更多」展开\n· 方法：改成 POST\n· 头部：点「添加新头部」，键填 Authorization，值填 Bearer 加一个空格再加你的密钥（Bearer 后面一定要有那个空格）\n· 请求体：选「文件」，点那个文件格，选变量「文本」\n再临时加一个「显示结果」，点 ▶ 试跑。第一次会问能不能读健康和位置，都点允许。\n弹出「收到」就通了，把「显示结果」删掉（不然以后每次都弹）。\n弹出「密钥不对」：头部那行写错了，看 Bearer 后面的空格、密钥前后有没有多空格；弹出「第一行要是秋秋健康」：文本第一行没写对。\n\n想让他们也知道你到家、出门、起床、睡觉、插上或拔掉充电器：长按这个快捷指令 →「复制」，改名比如「秋秋·到家」；打开它，把查找健康、电量、位置那些动作删掉，只留「文本」和「获取 URL 内容」，「文本」里只写下面对应的两行。每件事各复制一份，不想要的不做。",
            h("div", null, ["到家", "出门", "起床", "睡觉", "充电", "拔掉充电器"].map(k => h("div", { key: k, className: "flex items-center", style: { gap: 10, marginTop: 8 } },
              h("div", { style: { flex: 1, padding: "8px 12px", borderRadius: 12, background: A(S.ink, "08"), fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(12.5px * var(--app-fs, 1))", color: S.ink, whiteSpace: "pre", lineHeight: 1.6 } }, SHORTCUT_MARK + "\n事件：" + k),
              h("button", { onClick: async () => { const ok = typeof copyText === "function" && await copyText(SHORTCUT_MARK + "\n事件：" + k); toast && toast(ok ? "已复制" : "没复制上，长按自己复制"); }, style: Object.assign(btnS(S), { flexShrink: 0 }) }, "复制"))))),
          step(8, "设成定时自动跑", "快捷指令 App 底部点「自动化」→ 右上角「＋」（第一次是「新建自动化」）→ 选「特定时间」：\n· 选一个时间，重复选「每天」\n· 下面选「立即运行」——⚠️别选「运行前确认」，不然每次都要你点；「运行时通知」可以关掉\n· 点「下一步」，选你那个「秋秋健康」快捷指令，完成\n想一天报几次就重复建几个（比如 9 点、13 点、18 点、22 点各一个）——报上来的位置三小时内才算「此刻」。锁屏的时候它也会跑。\n\n到家、出门、起床、睡觉那几份不用定时，换成这些触发（也都选「立即运行」）：\n· 到家：「到达」→ 位置选你家 → 任何时间\n· 出门：「离开」→ 位置选你家\n· 起床：「闹钟」→「停止时」（或「睡眠」→「醒来」）\n· 睡觉：「睡眠」→「就寝时间开始」（没设睡眠的话用「专注模式 → 睡眠 → 打开时」）\n· 充电：「充电器」→「已连接」\n· 拔掉充电器：「充电器」→「已断开」")),
        h(Section, { S, title: "回秋秋\u673a填上" },
          step(9, "填地址和密钥", "回「谁看着」最下面，网关地址填第 6 步那个，密钥填第 5 步那串（只填那串，不用写 Bearer）。点「现在拿一次」，显示拿到了就好了。以后每次打开秋秋\u673a都会自己去拿。\n要让他们知道你在哪、天气、电量、到家出门这些：「谁看着」里打开「让他们知道我在哪、天气、电量」；开着「饭点会来问」，电量低、下雨在外面、到家出门起床那会儿才会有人主动来找你（各一天一次，说去睡了不会来吵）。"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, lineHeight: 1.7, marginTop: 8 } },
            "没拿到时下面那行会写原因：「密钥不对」是两边那串不一样；「回了 404」多半是地址抄错；什么都没回，多半是快捷指令还没往里投过。")),
        h(Section, { S, title: "常被问到的" },
          step("问", "能用我放别的网页（比如公共版）的那个 Cloudflare 账号吗？", "能，不会互相吃额度。静态网页（Pages）打开不计次数；网关吃的是 Worker 和 KV 的免费额度——每天 10 万次请求、10 万次读、1000 次写。快捷指令一天跑几次、秋秋\u673a十分钟最多拿一次，连零头都用不到。就算哪天真超了，也只是网关那天拿不到数，网页照常开。"),
          step("问", "别人拿到我的网关地址怎么办？", "没有你那串密钥，只会被拦下（密钥不对），读不到也写不进。每个人要用就在自己账号里搭自己的。"),
          step("问", "KV 里要不要放东西？", "不用，建好就是空的。代码放在 Worker 里（第 3 步），密钥放在 Worker 的变量里（第 5 步）。要是之前往 KV 里加过一条，删掉就好。"),
          step("问", "左边菜单找不到 Workers？", "它收在「计算」（Compute）下面，点开就看到「Workers 和 Pages」。")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: S.fog, lineHeight: 1.6, textAlign: "center" } },
          "Cloudflare 的菜单叫法偶尔会改，对不上就找意思最接近的那一项。免费档一天能投一千次，够用很久。")));
  }

  // ── 谁看着（整页）────────────────────────────────────────────
  function WatchPage({ S, d, chars, onPatch, onPull, onGuide, onBack }) {
    const w = d.watch, ids = w.ids || [];
    const toggle = (on, label, desc, onClick) => h("div", { onClick, role: "button", tabIndex: 0, className: "flex items-center",
      style: { width: "100%", minHeight: 56, background: "transparent", border: "none", borderBottom: "1px dashed " + S.line, padding: "8px 0", textAlign: "left", fontFamily: F_BODY } },
      h("div", { style: { flex: 1 } },
        h("div", { style: { fontSize: "calc(14.5px * var(--app-fs, 1))", color: S.ink } }, label),
        desc ? h("div", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.sub, marginTop: 3, lineHeight: 1.5 } }, desc) : null),
      h("span", { onClick: e => e.stopPropagation(), style: { flexShrink: 0, display: "inline-flex" } }, h(Toggle, { on: !!on, onChange: () => onClick(), color: S.accent, offColor: S.bg2, label })));
    const num = (label, k, unit, step) => h("div", { className: "flex items-center", style: { minHeight: 52, borderBottom: "1px dashed " + S.line, fontFamily: F_BODY } },
      h("span", { style: { flex: 1, fontSize: "calc(14px * var(--app-fs, 1))", color: S.ink } }, label),
      h("input", { "data-wk": "input", value: d.goal[k] == null ? "" : d.goal[k], inputMode: "decimal", placeholder: "不定",
        onChange: e => { const v = e.target.value.replace(/[^\d.]/g, ""); onPatch({ goal: Object.assign({}, d.goal, { [k]: v === "" ? null : Number(v) }) }); },
        style: Object.assign(inputS(S), { width: 90, textAlign: "right" }) }),
      h("span", { style: { width: 34, textAlign: "right", fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub } }, unit));
    return h("div", { "data-wk": "healthpage", "data-part": "watchpage", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: GRID(S.ink), backgroundSize: "22px 22px" } },
      h(Head, { zh: "谁看着", onBack, ink: S.ink, bg: "transparent", noLine: true }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 28px" } },
        h(Section, { S, title: "让角色帮你盯着" },
          toggle(w.on, "开启监督", "开了以后，下面点了名的人会在饭点前后、或者你刚记过一餐的时候知道你今天吃了多少、喝了几杯水。别的时候不告诉他们。",
            () => onPatch({ watch: Object.assign({}, w, { on: !w.on }) })),
          w.on ? h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, margin: "14px 0 8px" } }, "谁来管（可以几个人）"),
            h("div", { className: "flex flex-wrap", style: { gap: 10 } },
              chars.map(c => {
                const on = ids.includes(c.id);
                return h("button", { key: c.id, "aria-pressed": on,
                  onClick: () => onPatch({ watch: Object.assign({}, w, { ids: on ? ids.filter(x => x !== c.id) : ids.concat([c.id]) }) }),
                  style: { width: 64, minHeight: 78, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: 0 } },
                  h("span", { style: { borderRadius: 99, padding: 2, border: "2px solid " + (on ? S.accent : "transparent"), opacity: on ? 1 : 0.55, transition: "all .2s" } },
                    typeof Avatar === "function" ? h(Avatar, { character: c, size: 44 }) : null),
                  h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: on ? S.ink : S.sub, maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name));
              })),
            h("div", { style: { height: 10 } }),
            toggle(w.nudge, "饭点会来问", "午饭、晚饭那会儿你还没记，点了名的人里有一位会主动来找你。一天最多两次，记了那一顿就不问。",
              () => onPatch({ watch: Object.assign({}, w, { nudge: !w.nudge }) })),
            toggle(w.env, "让他们知道我在哪、天气、电量", "要快捷指令或网关报上来过才有。只说在不在家、离家多远，不给具体坐标；开了「会来问」的话，手机快没电、或者在外面碰上下雨，也会有人来找你（各一天一次）。",
              () => onPatch({ watch: Object.assign({}, w, { env: !w.env }) }))) : null),
        h(Section, { S, title: "家在哪", wk: "healthhome" },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: S.sub, lineHeight: 1.7, marginBottom: 10 } },
            d.home ? "设好了。之后报上来的位置会跟它比，算你在不在家。" : "在家的时候让快捷指令跑一次（或者点下面那个按钮让浏览器读一次位置），再设成家。"),
          h("div", { className: "flex flex-wrap", style: { gap: 8 } },
            d.env && d.env.lat != null ? h("button", { onClick: () => onPatch({ home: { lat: d.env.lat, lon: d.env.lon } }), style: btnS(S) }, "把手机最近报的位置设成家") : null,
            h("button", { onClick: () => { try { navigator.geolocation.getCurrentPosition(p => onPatch({ home: { lat: p.coords.latitude, lon: p.coords.longitude } }), () => {}, { timeout: 15000 }); } catch (e) {} }, style: btnS(S) }, "用这台设备现在的位置"),
            d.home ? h("button", { onClick: () => onPatch({ home: null }), style: btnS(S) }, "清掉") : null)),
        h(Section, { S, title: "我有自己的网关", wk: "healthgateway",
            right: h("button", { "data-wk": "block", onClick: onGuide, style: { minHeight: 36, background: "transparent", border: "none", color: S.accent, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: 600 } }, "没有？免费搭一个") },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: S.sub, lineHeight: 1.7, marginBottom: 6 } },
            "没有就不用管，导入照旧用剪贴板。有的话：让快捷指令每天定时用「获取 URL 内容」把那段字发给你的网关，网关存着最新一份；在这儿填它给出那一份的地址，秋秋\u673a每次打开、切回来时去拿一次，就不用再点导入了。网关要用 https，并允许跨域访问。"),
          h("input", { "data-wk": "input", value: d.gateway.url || "", onChange: e => onPatch({ gateway: Object.assign({}, d.gateway, { url: e.target.value.trim() }) }), placeholder: "网关地址，https 开头", style: Object.assign(inputS(S), { marginBottom: 6 }) }),
          h("input", { "data-wk": "input", value: d.gateway.key || "", onChange: e => onPatch({ gateway: Object.assign({}, d.gateway, { key: e.target.value.trim() }) }), placeholder: "密钥（可空，会放在 Authorization: Bearer 里）", style: inputS(S) }),
          h("div", { className: "flex items-center", style: { gap: 10, marginTop: 12 } },
            h("button", { disabled: !d.gateway.url, onClick: onPull, style: Object.assign(btnS(S, true), { flexShrink: 0, opacity: d.gateway.url ? 1 : 0.5 }) }, "现在拿一次"),
            h("span", { style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: d.gateway.err ? S.blood : S.fog, lineHeight: 1.5, wordBreak: "break-all" } },
              d.gateway.err ? "上次没拿到：" + d.gateway.err : d.gateway.at ? "上次拿的时间 " + new Date(d.gateway.at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""))),
        h(Section, { S, title: "给自己定的数" },
          num("一天吃多少", "kcal", "千卡"), num("一天喝几杯水", "water", "杯"), num("目标体重", "kg", "公斤"),
          num("每晚睡够", "sleepH", "小时"),
          h("div", { className: "flex items-center", style: { minHeight: 52, borderBottom: "1px dashed " + S.line, fontFamily: F_BODY } },
            h("span", { style: { flex: 1, fontSize: "calc(14px * var(--app-fs, 1))", color: S.ink } }, "几点前睡"),
            h("input", { type: "time", value: d.goal.bedBy || "", onChange: e => onPatch({ goal: Object.assign({}, d.goal, { bedBy: e.target.value || null }) }), style: Object.assign(inputS(S), { width: 110, textAlign: "right" }) }),
            d.goal.bedBy ? h("button", { onClick: () => onPatch({ goal: Object.assign({}, d.goal, { bedBy: null }) }), style: { width: 34, minHeight: 40, background: "transparent", border: "none", color: S.fog, fontSize: "calc(14px * var(--app-fs, 1))" } }, "×") : h("span", { style: { width: 34 } })),
          num("每天走", "steps", "步"), num("一周动够", "sportWeek", "分钟"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.fog, lineHeight: 1.6, marginTop: 10 } }, "不填的就不定。定了的会在今天、身体、这周几页画出来，也能拿去跟 TA 立约。"))));
  }

  // ── 主页 ────────────────────────────────────────────────────
  const SYMS = ["痛经", "腰酸", "头疼", "胀气", "冒痘", "乏力", "失眠", "想吃甜", "情绪低"];

  function HealthApp(props) {
    const S = pal();
    const [d, setD] = useState(load);
    // 网关在后台拉到了新的一份：页面跟着刷新
    React.useEffect(() => { const f = () => setD(load()); g.addEventListener && g.addEventListener("qq-health-updated", f); pullGateway(false);
      return () => g.removeEventListener && g.removeEventListener("qq-health-updated", f); }, []);
    const [tab, setTab] = useState(() => (typeof takeOpenSub === "function" && takeOpenSub("health", ["today", "body"])) || "today");
    const [page, setPage] = useState(null);          // { kind: "add", meal } | { kind: "watch" }
    const [kg, setKg] = useState("");
    const [sp, setSp] = useState(null), [spMin, setSpMin] = useState(30), [stepIn, setStepIn] = useState("");
    const [week, setWeekNote] = useState(null), [weekBusy, setWeekBusy] = useState(false);
    const [habIn, setHabIn] = useState(""), [habAt, setHabAt] = useState("");
    const [pk, setPk] = useState({ charId: "", kind: "", days: 7 });   // 立约那一格正在挑的
    const today = dayOf();
    const patch = p => setD(prev => save(Object.assign({}, prev, typeof p === "function" ? p(prev) : p)));
    const tot = dayTotals(d, today);
    const chars = props.characters || [];
    const api = props.bgApi || (props.apiFor && chars[0] ? props.apiFor(chars[0]) : null);

    if (page && page.kind === "add") return h(AddMeal, { S, meal0: page.meal, api, toast: props.toast, onBack: () => setPage(null),
      onAdd: rows => patch(prev => ({ meals: (prev.meals || []).concat(rows.map((r, i) => ({ id: "m" + Date.now().toString(36) + i, day: today, ts: Date.now(),
        meal: r.meal, name: r.name, kcal: r.kcal, p: r.p || 0, c: r.c || 0, f: r.f || 0, qty: r.qty || 1, src: r.src }))) })) });
    // 导入：认得出就合进存档、回到今天；认不出返回 false，由调用的那一处决定怎么提示
    const importText = text => {
      const r = parseShortcut(text, today);
      if (!r) return false;
      patch(prev => applyShortcut(prev, r));
      const bits = [r.steps != null ? r.steps + " 步" : "", r.sleepMin ? "睡了 " + hrs(r.sleepMin) : "", r.kcal ? "活动 " + Math.round(r.kcal) + " 千卡" : "", r.kg ? r.kg + " 公斤" : ""].filter(Boolean);
      props.toast && props.toast((r.day === today ? "" : r.day + " · ") + "导进来了：" + (bits.join("，") || "已更新"));
      setPage(null);
      return true;
    };
    const importClip = async () => {
      let text = "";
      try { if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText(); } catch (e) {}
      if (!importText(text)) { setPage({ kind: "import" }); props.toast && props.toast(text ? "剪贴板里不是快捷指令那段，可以在这页贴进来" : "读不到剪贴板，可以在这页贴进来"); }
    };
    if (page && page.kind === "import") return h(ImportPage, { S, onImport: importText, toast: props.toast, onBack: () => setPage(null) });
    if (page && page.kind === "gateway") return h(GatewayGuide, { S, toast: props.toast, onBack: () => setPage({ kind: "watch" }) });
    if (page && page.kind === "watch") return h(WatchPage, { S, d, chars, onPatch: patch, onBack: () => setPage(null), onGuide: () => setPage({ kind: "gateway" }),
      onPull: async () => { const r = await pullGateway(true); props.toast && props.toast(r ? "拿到了" : "没拿到，看下面那行"); } });

    const delMeal = id => patch(prev => ({ meals: prev.meals.filter(m => m.id !== id) }));
    const toggleHabit = id => patch(prev => { const cur = (prev.habitLog || {})[today] || []; return { habitLog: { [today]: cur.includes(id) ? cur.filter(x => x !== id) : cur.concat([id]), ...Object.fromEntries(Object.entries(prev.habitLog || {}).filter(([k]) => k !== today && k >= shift(today, -60))) } }; });
    const addHabit = () => { const n = habIn.trim(); if (!n) return; patch(prev => ({ habits: (prev.habits || []).concat([{ id: "hb" + Date.now().toString(36), name: n, at: habAt || "" }]) })); setHabIn(""); setHabAt(""); };
    const delHabit = id => patch(prev => ({ habits: (prev.habits || []).filter(x => x.id !== id) }));
    const sportThisWeek = (d.sport || []).filter(x => x.day > shift(today, -7) && x.day <= today).reduce((a, x) => a + (Number(x.min) || 0), 0);
    const setWater = n => patch(prev => ({ water: Object.assign({}, prev.water, { [today]: n }) }));
    const setMood = v => patch(prev => ({ mood: Object.assign({}, prev.mood, { [today]: Object.assign({}, prev.mood[today] || {}, { v }) }) }));
    const toggleSym = s => patch(prev => { const cur = prev.symptoms[today] || []; return { symptoms: Object.assign({}, prev.symptoms, { [today]: cur.includes(s) ? cur.filter(x => x !== s) : cur.concat([s]) }) }; });
    const addSport = () => { if (!sp) return; const kc = burnOf(sp[1], spMin, lastKg(d));
      patch(prev => ({ sport: (prev.sport || []).concat([{ id: "s" + Date.now().toString(36), day: today, kind: sp[0], min: spMin, kcal: kc, ts: Date.now() }]) })); setSp(null); setSpMin(30); };
    const delSport = id => patch(prev => ({ sport: (prev.sport || []).filter(s => s.id !== id) }));
    const saveSteps = () => { const v = parseInt(stepIn, 10); if (!(v >= 0)) return; patch(prev => ({ steps: Object.assign({}, prev.steps, { [today]: v }) })); setStepIn(""); };
    const sl = (d.sleep || {})[today] || {};
    const setSleep = p2 => patch(prev => ({ sleep: Object.assign({}, prev.sleep, { [today]: Object.assign({}, (prev.sleep || {})[today] || {}, p2) }) }));
    const saveKg = () => { const v = Number(kg); if (!(v > 20 && v < 300)) return; patch(prev => ({ weight: (prev.weight || []).filter(w => w.day !== today).concat([{ day: today, kg: Math.round(v * 10) / 10 }]) })); setKg(""); };

    // ── 今天 ──
    const rowsToday = mealsOn(d, today);
    const todayView = h("div", null,
      h("div", { "data-wk": "healthsync", className: "flex items-center", style: { gap: 10, padding: "4px 0 2px" } },
        h("svg", { width: 16, height: 16, viewBox: "0 0 24 24", style: { flexShrink: 0 } }, h("path", { d: "M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z", fill: A(S.blood, "cc") })),
        h("button", { onClick: () => setPage({ kind: "import" }), style: { flex: 1, minHeight: 40, background: "transparent", border: "none", padding: 0, textAlign: "left", fontFamily: F_BODY } },
          h("div", { style: { fontSize: "calc(13px * var(--app-fs, 1))", color: S.ink } }, "手机健康"),
          h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: S.fog } }, d.hkAt ? "上次导入 " + new Date(d.hkAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "还没设过 · 点这里看怎么用快捷指令")),
        h("button", { onClick: importClip, style: Object.assign(btnS(S), { flexShrink: 0 }) }, "导入")),
      h("div", { "data-wk": "healthsum", className: "flex items-center", style: { gap: 18, padding: "10px 0 6px" } },
        h(Ring, { S, val: tot.kcal, goal: d.goal.kcal || 1800, burn: tot.burn }),
        h("div", { style: { flex: 1, minWidth: 0 } },
          h(MacroBar, { S, label: "蛋白质", v: tot.p, color: S.accent, of: Math.round((d.goal.kcal || 1800) * 0.2 / 4) }),
          h(MacroBar, { S, label: "碳水", v: tot.c, color: S.tint, of: Math.round((d.goal.kcal || 1800) * 0.5 / 4) }),
          h(MacroBar, { S, label: "脂肪", v: tot.f, color: S.water, of: Math.round((d.goal.kcal || 1800) * 0.3 / 9) }))),
      h(Section, { S, title: "吃了什么", wk: "healthmeals" },
        MEALS.map(m => {
          const rows = rowsToday.filter(r => r.meal === m[0]);
          return h("div", { key: m[0], style: { borderBottom: "1px dashed " + S.line, padding: "4px 0" } },
            h("div", { className: "flex items-center", style: { minHeight: 42 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: S.ink, fontWeight: 600, width: 48 } }, m[1]),
              h("span", { style: { flex: 1, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.fog } }, rows.length ? sum(rows, "kcal") + " 千卡" : "还没记"),
              h("button", { onClick: () => setPage({ kind: "add", meal: m[0] }), "aria-label": "记" + m[1],
                style: { width: 36, height: 36, borderRadius: 99, border: "none", background: A(S.accent, "17"), color: S.accent, fontSize: "calc(19px * var(--app-fs, 1))", lineHeight: 1 } }, "＋")),
            rows.map(r => h("div", { key: r.id, className: "flex items-center", style: { padding: "2px 0 6px 48px", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: S.sub } },
              h("span", { style: { flex: 1 } }, r.name + (r.qty && r.qty !== 1 ? " ×" + r.qty : "")),
              h("span", { style: { color: S.tint, marginRight: 4 } }, Math.round(r.kcal * (r.qty || 1))),
              h("button", { "data-wk": "block", onClick: () => delMeal(r.id), "aria-label": "删掉这一条", style: { width: 32, height: 32, background: "transparent", border: "none", color: S.fog, fontSize: "calc(15px * var(--app-fs, 1))" } }, "×"))));
        })),
      h(Section, { S, title: "喝水", wk: "healthwater", right: h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.water } }, tot.water + " / " + (d.goal.water || 8) + " 杯") },
        h("div", { className: "flex flex-wrap", style: { gap: 2 } },
          Array.from({ length: Math.max(d.goal.water || 8, tot.water + 1) }, (_, i) =>
            h(Cup, { key: i, S, full: i < tot.water, onClick: () => setWater(i + 1 === tot.water ? i : i + 1) })))),
      h(Section, { S, title: "动了动", wk: "healthsport", right: (tot.sportMin || d.goal.sportWeek) ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.accent } },
          (tot.sportMin ? tot.sportMin + " 分钟 · " + tot.burn + " 千卡" : "") + (d.goal.sportWeek ? (tot.sportMin ? " · " : "") + "这七天 " + sportThisWeek + " / " + d.goal.sportWeek : "")) : null },
        (d.sport || []).filter(s => s.day === today).map(s => h("div", { key: s.id, className: "flex items-center", style: { minHeight: 36, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: S.ink } },
          h("span", { style: { flex: 1 } }, s.kind + " · " + s.min + " 分钟"),
          h("span", { style: { color: S.accent, marginRight: 4 } }, "−" + s.kcal),
          h("button", { "data-wk": "block", onClick: () => delSport(s.id), "aria-label": "删掉这一条", style: { width: 32, height: 32, background: "transparent", border: "none", color: S.fog, fontSize: "calc(15px * var(--app-fs, 1))" } }, "×"))),
        h("div", { className: "flex flex-wrap", style: { gap: 8, marginTop: 6 } },
          SPORTS.map(x => h("button", { key: x[0], onClick: () => setSp(sp && sp[0] === x[0] ? null : x), "aria-pressed": !!(sp && sp[0] === x[0]), style: chipS(S, sp && sp[0] === x[0]) }, x[0]))),
        sp ? h("div", { className: "flex items-center", style: { gap: 8, marginTop: 12 } },
          h("button", { onClick: () => setSpMin(Math.max(5, spMin - 5)), style: Object.assign(btnS(S), { padding: 0, width: 40 }) }, "−"),
          h("span", { style: { minWidth: 64, textAlign: "center", fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: S.ink } }, spMin + " 分钟"),
          h("button", { onClick: () => setSpMin(spMin + 5), style: Object.assign(btnS(S), { padding: 0, width: 40 }) }, "＋"),
          h("button", { onClick: addSport, style: Object.assign(btnS(S, true), { flex: 1 }) }, "记下 · 约 " + burnOf(sp[1], spMin, lastKg(d)) + " 千卡")) : null,
        h("div", { className: "flex items-center", style: { gap: 8, marginTop: 14 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: S.sub, flexShrink: 0 } }, "今天走了"),
          h("input", { "data-wk": "input", value: stepIn, onChange: e => setStepIn(e.target.value.replace(/[^\d]/g, "")), inputMode: "numeric", placeholder: tot.steps ? String(tot.steps) : "多少步", style: inputS(S), onKeyDown: e => { if (e.key === "Enter") saveSteps(); } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: S.sub, flexShrink: 0 } }, "步"),
          h("button", { onClick: saveSteps, style: Object.assign(btnS(S), { flexShrink: 0 }) }, "记下")),
        d.goal.steps ? h("div", { style: { marginTop: 8 } },
          h("div", { style: { height: 4, borderRadius: 99, background: A(S.ink, "10"), overflow: "hidden" } },
            h("div", { "data-wk": "block", style: { width: Math.min(100, Math.round(tot.steps / d.goal.steps * 100)) + "%", height: "100%", background: S.accent, borderRadius: 99 } })),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: S.fog, marginTop: 4 } }, "今天 " + tot.steps + " / " + d.goal.steps + " 步")) : null),
      // 小习惯：自己加的那几样，每天勾一下；定了时间的，到点还没勾会弹一下
      h(Section, { S, title: "小习惯", wk: "healthhabit" },
        (d.habits || []).map(x => { const on = (d.habitLog[today] || []).includes(x.id);
          return h("div", { key: x.id, className: "flex items-center", style: { minHeight: 44, borderBottom: "1px dashed " + S.line } },
            h("button", { "data-wk": "block", onClick: () => toggleHabit(x.id), "aria-pressed": on, className: "flex items-center", style: { flex: 1, minHeight: 44, gap: 10, background: "transparent", border: "none", padding: 0, textAlign: "left" } },
              h("span", { style: { width: 22, height: 22, borderRadius: 7, border: "1.5px solid " + (on ? S.accent : A(S.ink, "33")), background: on ? S.accent : "transparent", color: S.bg, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: "19px", textAlign: "center", flexShrink: 0 } }, on ? "✓" : ""),
              h("span", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: on ? S.sub : S.ink, textDecoration: on ? "line-through" : "none" } }, x.name),
              x.at ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: S.fog } }, x.at) : null),
            h("button", { "data-wk": "block", onClick: () => delHabit(x.id), "aria-label": "删掉这个习惯", style: { width: 32, height: 32, background: "transparent", border: "none", color: S.fog, fontSize: "calc(15px * var(--app-fs, 1))" } }, "×")); }),
        h("div", { className: "flex items-center", style: { gap: 8, marginTop: 10 } },
          h("input", { "data-wk": "input", value: habIn, onChange: e => setHabIn(e.target.value.slice(0, 16)), placeholder: "吃维生素、护肤……", style: inputS(S), onKeyDown: e => { if (e.key === "Enter") addHabit(); } }),
          h("input", { type: "time", value: habAt, onChange: e => setHabAt(e.target.value), "aria-label": "几点提醒（可空）", style: Object.assign(inputS(S), { width: 92, flexShrink: 0 }) }),
          h("button", { onClick: addHabit, style: Object.assign(btnS(S), { flexShrink: 0 }) }, "加")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: S.fog, marginTop: 6 } }, "时间可以不填；填了的，到点还没勾会提醒一下（App 开着、或者后台醒着的时候）。")),
      h(Section, { S, title: "心情", wk: "healthmood" },
        h("div", { className: "flex" }, [0, 1, 2, 3, 4].map(v => h(Face, { key: v, S, v, on: tot.mood && tot.mood.v === v, onClick: () => setMood(v) })))));

    // ── 身体 ──
    const per = typeof periodPhaseNow === "function" ? periodPhaseNow(props.period) : null;
    const legacyToday = typeof pDK === "function" ? pDK(new Date()) : today;
    const plist = typeof periodList === "function" ? periodList(props.period) : [];
    const open = plist.filter(p => !p.end).slice(-1)[0];
    const startedToday = plist.some(p => p.start === legacyToday);
    const pBtn = startedToday ? "今天不算，撤掉" : open ? "今天走了" : "今天来了";
    const wrows = weightTrend(d), lastW = wrows[wrows.length - 1];
    const nights = weekOf(d, today);
    const bodyView = h("div", null,
      h(Section, { S, title: "睡觉", wk: "healthsleep", right: (tot.sleep || d.goal.sleepH) ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.water } },
          (tot.sleep ? "昨晚 " + hrs(tot.sleep) : "") + (d.goal.sleepH ? (tot.sleep ? " / " : "目标 ") + d.goal.sleepH + " 小时" : "")) : null },
        h("div", { className: "flex items-end", style: { gap: 14 } },
          [["bed", "几点睡的"], ["wake", "几点醒的"]].map(f => h("label", { key: f[0], style: { flex: 1, fontFamily: F_BODY } },
            h("div", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.sub, marginBottom: 2 } }, f[1]),
            h("input", { type: "time", value: sl[f[0]] || "", onChange: e => setSleep({ [f[0]]: e.target.value }), style: Object.assign(inputS(S), { fontSize: "calc(17px * var(--app-fs, 1))" }) })))),
        h("div", { className: "flex", style: { gap: 8, marginTop: 12 } },
          SLEEP_Q.map((q, i) => h("button", { key: q, onClick: () => setSleep({ q: sl.q === i ? null : i }), "aria-pressed": sl.q === i, style: Object.assign(chipS(S, sl.q === i, S.water), { flex: 1 }) }, q))),
        h("div", { className: "flex items-end", style: { gap: 8, height: 62, marginTop: 14, position: "relative" } },
          // 睡够几小时那条线：柱子高 44 对 10 小时
          d.goal.sleepH ? h("div", { "aria-hidden": "true", style: { position: "absolute", left: 0, right: 0, bottom: 19 + Math.min(1, d.goal.sleepH / 10) * 44, borderTop: "1px dashed " + A(S.water, "99") } }) : null,
          nights.map(x => h("div", { key: x.day, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" } },
            h("div", { style: { width: 8, height: x.sleep ? Math.max(4, Math.min(1, x.sleep / 600) * 44) : 2, borderRadius: 99, background: x.sleep ? (x.day === today ? S.water : A(S.water, "70")) : A(S.ink, "12") } }),
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: x.day === today ? S.ink : S.fog, marginTop: 5 } }, x.sleep ? (x.sleep / 60).toFixed(1) : "·")))),
        d.goal.bedBy ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.sub, marginTop: 10 } },
          "这七晚有 " + nights.filter(x => { const b = (d.sleep || {})[x.day]; return b && b.bed && lateMin(b.bed) <= lateMin(d.goal.bedBy); }).length + " 晚在 " + d.goal.bedBy + " 前睡了"
          + "（填了几点睡的有 " + nights.filter(x => ((d.sleep || {})[x.day] || {}).bed).length + " 晚）") : null),
      h(Section, { S, title: "体重", wk: "healthweight", right: lastW ? h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub } },
          "最近 " + lastW.kg + " 公斤" + (d.goal.kg ? " · 离目标 " + Math.round((lastW.kg - d.goal.kg) * 10) / 10 + " 公斤" : "")) : null },
        h(Spark, { S, rows: wrows }),
        (function () { const e = weightEta(d); if (!e) return null;
          return h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.sub, marginTop: 4, lineHeight: 1.6 } },
            e.reached ? "已经到目标了。" : e.away ? "最近四周每周大约 " + (e.perWeek > 0 ? "+" : "") + e.perWeek + " 公斤，跟目标是反着走的。" : "照最近四周的走法（每周 " + (e.perWeek > 0 ? "+" : "") + e.perWeek + " 公斤），大约 " + e.date + " 到目标。"); })(),
        h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
          h("input", { "data-wk": "input", value: kg, onChange: e => setKg(e.target.value.replace(/[^\d.]/g, "")), inputMode: "decimal", placeholder: "今天多少公斤", style: inputS(S), onKeyDown: e => { if (e.key === "Enter") saveKg(); } }),
          h("button", { onClick: saveKg, style: Object.assign(btnS(S, true), { flexShrink: 0 }) }, "记下"))),
      h(Section, { S, title: "经期", wk: "healthperiod" },
        h("div", { className: "flex items-center", style: { gap: 14, padding: "4px 0 10px" } },
          h("svg", { width: 40, height: 40, viewBox: "0 0 40 40", style: { flexShrink: 0 } },
            h("path", { d: "M20 5c6 9 11 15 11 21a11 11 0 0 1-22 0c0-6 5-12 11-21z", fill: per && per.kind === "period" ? A(S.blood, "d9") : "none", stroke: S.blood, strokeWidth: 1.6 })),
          h("div", { style: { flex: 1, fontFamily: F_BODY } },
            h("div", { style: { fontSize: "calc(15px * var(--app-fs, 1))", color: S.ink, fontWeight: 600 } }, per ? per.label : "还没记过"),
            h("div", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.sub, marginTop: 3 } }, per && per.next != null ? (per.next <= 0 ? "按周期算该来了" : "离下次大约 " + per.next + " 天") : "记一次之后就能往后推算"))),
        props.onRecordPeriod ? h("button", { onClick: () => props.onRecordPeriod(legacyToday), style: Object.assign(btnS(S), { width: "100%", background: A(S.blood, "17"), color: S.blood }) }, pBtn) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, margin: "16px 0 8px" } }, "今天身上哪儿不舒服"),
        h("div", { className: "flex flex-wrap", style: { gap: 8 } },
          SYMS.map(s => { const on = tot.sym.includes(s);
            return h("button", { key: s, onClick: () => toggleSym(s), "aria-pressed": on,
              style: chipS(S, on, S.blood) }, s); })),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: S.fog, marginTop: 12, lineHeight: 1.6 } }, "跟日历里的月事本是同一份，哪边记都一样；谁能看到也在月事本里设。")));

    // ── 这周 ──
    const wk = weekOf(d, today);
    const maxK = Math.max(d.goal.kcal || 1800, ...wk.map(x => x.kcal)) || 1;
    const logged = wk.filter(x => x.n);
    const avgK = logged.length ? Math.round(logged.reduce((a, x) => a + x.kcal, 0) / logged.length) : 0;
    const avgW = Math.round(wk.reduce((a, x) => a + x.water, 0) / 7 * 10) / 10;
    const wIn = (d.weight || []).filter(w => w.day >= wk[0].day && w.day <= today).sort((a, b) => (a.day < b.day ? -1 : 1));
    const dW = wIn.length >= 2 ? Math.round((wIn[wIn.length - 1].kg - wIn[0].kg) * 10) / 10 : null;
    const watchers = chars.filter(c => d.watch.on && (d.watch.ids || []).includes(c.id));
    const weekFactsNow = weekFacts(d, today);
    const askWeek = async c => {
      const p = props.apiFor && props.apiFor(c), ctx = props.ctxFor && props.ctxFor(c);
      if (!p || !ctx || typeof runProbe !== "function") { props.toast && props.toast("先到设置配置 API"); return; }
      setWeekBusy(true);
      try {
        // 靠调用点补的那三层走公共那一份（跟星测、塔罗同一个）
        const tail = typeof probeVoiceTail === "function" ? probeVoiceTail() : "";
        const r = await runProbe(p, ctx, { voice: true, maxTokens: 65000, tag: "health",
          instruction: "她把这一周的健康记录拿给你看。下面是记下来的数：\n" + weekFactsNow + "\n用你自己的口吻跟她说几句。" + tail,
          schemaHint: "{\"text\":\"你想对她说的话\"}" });
        const text = String(r && r.text || "").trim();
        if (!text) throw new Error("没说出话来");
        setWeekNote({ name: c.name, text });
      } catch (e) { props.toast && props.toast("没看成：" + String(e && e.message || e).slice(0, 60)); }
      finally { setWeekBusy(false); }
    };
    const weekView = h("div", null,
      h(Section, { S, title: "七天的热量", wk: "healthweek" },
        h("div", { className: "flex items-end", style: { gap: 8, height: 120, position: "relative", paddingTop: 6 } },
          h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 20 + (d.goal.kcal || 1800) / maxK * 94, borderTop: "1px dashed " + A(S.accent, "88") } }),
          wk.map(x => h("div", { key: x.day, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" } },
            h("div", { style: { width: "62%", height: Math.max(2, x.kcal / maxK * 94), borderRadius: "6px 6px 2px 2px",
              background: x.kcal > (d.goal.kcal || 1800) ? S.tint : x.day === today ? S.accent : A(S.accent, "66") } }),
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: x.day === today ? S.ink : S.fog, marginTop: 6, height: 14 } }, "日一二三四五六"[g.ScheduleClock.parseDayKey(x.day).getDay()]))))),
      h(Section, { S, title: "这周的数" },
        [["记了饮食", logged.length + " / 7 天"], ["平均热量", logged.length ? avgK + " 千卡" : "—"], ["平均喝水", avgW + " 杯"],
          ["体重", dW == null ? "这周记得不够两次" : (dW > 0 ? "+" : "") + dW + " 公斤"],
          ["运动", wk.reduce((a, x) => a + x.sportMin, 0) + " 分钟 · " + wk.filter(x => x.sportMin).length + " 天"],
          ["平均睡眠", wk.filter(x => x.sleep).length ? hrs(Math.round(wk.filter(x => x.sleep).reduce((a, x) => a + x.sleep, 0) / wk.filter(x => x.sleep).length)) : "没记"],
          ["不舒服的日子", wk.filter(x => x.sym.length).length + " 天"]].map(r =>
          h("div", { key: r[0], className: "flex", style: { minHeight: 40, alignItems: "center", borderBottom: "1px dashed " + S.line, fontFamily: F_BODY } },
            h("span", { style: { flex: 1, fontSize: "calc(13.5px * var(--app-fs, 1))", color: S.sub } }, r[0]), h("span", { style: { fontSize: "calc(14px * var(--app-fs, 1))", color: S.ink } }, r[1]))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, margin: "14px 0 2px" } }, "每天的心情"),
        h("div", { className: "flex items-center" },
          wk.map(x => h("div", { key: x.day, style: { flex: 1, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: S.fog } },
            x.mood ? h(Face, { S, v: x.mood.v, on: x.day === today, mini: true, onClick: () => {} }) : "·")))),
      // ── 跟 TA 立约：拿一个目标，约几天；他知道每天做到没，到期自己来结账 ──
      h(Section, { S, title: "跟 TA 立的约", wk: "healthpact" },
        (d.pacts || []).slice().reverse().slice(0, 6).map(p => { const K = pactKind(p.kind), c = chars.find(x => x.id === p.charId), ds = pactDays(d, p, today), live = pactLive(p, today);
          if (!K) return null;
          return h("div", { key: p.id, style: { padding: "8px 0 10px", borderBottom: "1px dashed " + S.line } },
            h("div", { className: "flex items-center", style: { gap: 8, fontFamily: F_BODY } },
              h("span", { style: { flex: 1, fontSize: "calc(13.5px * var(--app-fs, 1))", color: S.ink } }, (c ? c.name : "（不在了）") + " · " + K.zh + " " + K.unit(p.target)),
              h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: live ? S.accent : S.fog } }, live ? "进行中" : "做到 " + ds.filter(x => x.st === "ok").length + "/" + p.days),
              h("button", { onClick: () => patch(prev => ({ pacts: (prev.pacts || []).filter(x => x.id !== p.id) })), "aria-label": "撤掉这一约", style: { width: 30, height: 30, background: "transparent", border: "none", color: S.fog, fontSize: "calc(14px * var(--app-fs, 1))" } }, "×")),
            h("div", { className: "flex", style: { gap: 5, marginTop: 7, flexWrap: "wrap" } }, ds.map(x => h("span", { key: x.day, title: x.day,
              style: { width: 22, height: 22, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))",
                background: x.st === "ok" ? S.accent : x.st === "miss" ? A(S.tint, "33") : "transparent",
                color: x.st === "ok" ? S.bg : x.st === "miss" ? S.tint : S.fog, border: "1px " + (x.st === "wait" ? "dashed " : "solid ") + (x.st === "ok" ? S.accent : x.st === "miss" ? A(S.tint, "66") : A(S.ink, "22")) } },
              x.st === "ok" ? "✓" : x.st === "miss" ? "×" : x.st === "none" ? "?" : ""))));
        }),
        chars.length ? h("div", { style: { marginTop: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, marginBottom: 6 } }, "跟谁约"),
          h("div", { className: "flex flex-wrap", style: { gap: 8 } }, chars.map(c => h("button", { key: c.id, onClick: () => setPk(Object.assign({}, pk, { charId: c.id })), "aria-pressed": pk.charId === c.id, style: chipS(S, pk.charId === c.id) }, c.name))),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, margin: "12px 0 6px" } }, "约什么"),
          h("div", { className: "flex flex-wrap", style: { gap: 8 } }, PACT_KINDS.filter(K => K.goal(d)).map(K => h("button", { key: K.k, onClick: () => setPk(Object.assign({}, pk, { kind: K.k })), "aria-pressed": pk.kind === K.k, style: chipS(S, pk.kind === K.k) }, K.zh + " " + K.unit(K.goal(d))))),
          h("div", { className: "flex items-center", style: { gap: 8, marginTop: 12 } },
            [3, 7, 14].map(n => h("button", { key: n, onClick: () => setPk(Object.assign({}, pk, { days: n })), "aria-pressed": pk.days === n, style: chipS(S, pk.days === n) }, n + " 天")),
            h("button", { disabled: !pk.charId || !pk.kind, onClick: () => { const K = pactKind(pk.kind); if (!K || !pk.charId) return;
                patch(prev => ({ pacts: (prev.pacts || []).concat([{ id: "pc" + Date.now().toString(36), charId: pk.charId, kind: pk.kind, target: K.goal(prev), start: today, days: pk.days, reported: false }]) }));
                setPk({ charId: "", kind: "", days: 7 }); props.toast && props.toast("约好了，从今天算起"); },
              style: Object.assign(btnS(S, true), { marginLeft: "auto", opacity: pk.charId && pk.kind ? 1 : 0.45 }) }, "立约")),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: S.fog, marginTop: 8, lineHeight: 1.6 } }, characterText(chars.find(x => x.id === pk.charId), "约什么跟着你定的目标走（在右上角「谁看着」最底下改）。他这几天聊天时都知道你做到没，到期那天会自己来找你说。"))) : null),
      // ── 每周一封小结 ──
      h(Section, { S, title: "每周一封小结", wk: "healthweekly" },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: S.sub, lineHeight: 1.6, marginBottom: 8 } },
          d.weekly.charId ? "每周一上午，" + ((chars.find(c => c.id === d.weekly.charId) || {}).name || "TA") + " 会看完你上一周的饮食、睡觉、运动，来聊天里跟你说说。" : "挑一个人，每周一上午他会看完你上一周的数，来聊天里跟你说说。"),
        h("div", { className: "flex flex-wrap", style: { gap: 8 } },
          h("button", { onClick: () => patch(prev => ({ weekly: Object.assign({}, prev.weekly, { charId: "" }) })), "aria-pressed": !d.weekly.charId, style: chipS(S, !d.weekly.charId) }, "不用"),
          chars.map(c => h("button", { key: c.id, "aria-pressed": d.weekly.charId === c.id, style: chipS(S, d.weekly.charId === c.id),
            // 刚挑上的那一周不算：从下周一开始（不然周三挑上，立刻就来讲上一周）
            onClick: () => patch(prev => ({ weekly: { charId: c.id, last: shift(today, -((g.ScheduleClock.parseDayKey(today).getDay() + 6) % 7)) } })) }, c.name)))),
      watchers.length ? h(Section, { S, title: "让 TA 看看这周", wk: "healthnote" },
        h("div", { className: "flex flex-wrap", style: { gap: 8 } },
          watchers.map(c => h("button", { key: c.id, disabled: weekBusy, onClick: () => askWeek(c), style: Object.assign(btnS(S), { opacity: weekBusy ? 0.5 : 1 }) }, weekBusy ? "在看…" : "给" + c.name + "看"))),
        week ? h("div", { style: { marginTop: 12, paddingLeft: 12, borderLeft: "2px solid " + S.accent, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: S.ink, lineHeight: 1.75, whiteSpace: "pre-wrap" } },
          h("div", { style: { fontSize: "calc(11.5px * var(--app-fs, 1))", color: S.sub, marginBottom: 4 } }, week.name), week.text) : null) : null);

    const tabs = [["today", "今天"], ["body", "身体"], ["week", "这周"]];
    return h("div", { "data-wk": "app", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: GRID(S.ink), backgroundSize: "22px 22px" } },
      h(Head, { zh: "健康", onBack: props.onBack, ink: S.ink, bg: "transparent", noLine: true,
        right: h("button", { onClick: () => setPage({ kind: "watch" }), style: { minHeight: 40, padding: "0 4px", background: "transparent", border: "none", color: d.watch.on ? S.accent : S.sub, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "谁看着") }),
      h("div", { className: "shrink-0", style: { padding: "0 16px" } }, h(PulseTabs, { tabs, cur: tab, onPick: setTab, S })),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 16px 28px" } },
        tab === "today" ? todayView : tab === "body" ? bodyView : weekView));
  }
  g.HealthApp = HealthApp;
})();
