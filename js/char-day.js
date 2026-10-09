// Schedule viewer: no new narrative, model calls, memories or game saves.
(function (root) {
  "use strict";
  const DEMO = { id: "__char_day_demo", name: "示例小人", tz: "0" };
  const DEMO_ROWS = [
    { seq: 1, time: "08:00", end: "09:00", title: "吃早饭，慢慢醒过来", location: "家里的餐桌", type: "meal" },
    { seq: 2, time: "09:00", end: "12:00", title: "坐下来翻书、整理手头的事", location: "案边", type: "work" },
    { seq: 3, time: "14:00", end: "16:00", title: "出门走一走", location: "街边小路", type: "out" },
    { seq: 4, time: "19:00", end: "21:00", title: "回家喝茶，歇一会儿", location: "窗边", type: "coffee" },
    { seq: 5, time: "23:00", end: "24:00", title: "躺下来休息", location: "卧室", type: "sleep" }
  ];
  const clockText = n => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  function dayState(char, plans, at = Date.now()) {
    const clock = root.ScheduleClock, day = clock.dayKey(char, at), minute = clock.localMinute(char, at);
    const plan = (plans || {})[day], rows = typeof schedFillEnds === "function" ? schedFillEnds(plan?.seqs || []) : plan?.seqs || [];
    const slot = clock.currentSlot(char, plans, at, undefined, {
      fillEnds: typeof schedFillEnds === "function" ? schedFillEnds : x => x,
      sleepCarry: typeof schedSleepCarry === "function" ? schedSleepCarry : undefined
    });
    return { day, minute, time: clockText(minute), rows, slot, hasPlan: !!rows.length };
  }
  function presentation(slot) {
    const type = slot?.type || "other", words = String(slot?.deviation?.actual || slot?.title || "");
    // These are available visual gestures, not invented occupational activities.
    if (type === "sleep") return { map: "home", action: "sleep", gesture: "sleep" };
    if (type === "meal") return { map: "home", action: "meal", gesture: "eat" };
    if (type === "coffee") return { map: "home", action: "tea", gesture: "tea" };
    if (type === "out") return { map: "garden", action: "walk", gesture: "rest" };
    if (/喝茶|饮茶|品茶/.test(words)) return { map: "home", action: "tea", gesture: "tea" };
    if (/吃饭|用膳|早餐|午餐|晚餐/.test(words)) return { map: "home", action: "meal", gesture: "eat" };
    if (/散步|走走|逛街/.test(words)) return { map: "garden", action: "walk", gesture: "rest" };
    if (/读|阅读|翻书|看书/.test(words)) return { map: ["work", "create"].includes(type) ? "hall" : "home", action: "read", gesture: "read" };
    if (["work", "create"].includes(type)) return { map: "hall", action: "work", gesture: "rest" };
    if (type === "social") return { map: "hall", action: "rest", gesture: "rest" };
    return { map: "home", action: "rest", gesture: "rest" };
  }
  root.CharDayKit = { dayState, presentation, DEMO, DEMO_ROWS };
  root.CharDayApp = function CharDayApp(props) {
    const [id, setId] = useState(props.initialCharId || ""), [pulse, setPulse] = useState(0),
      [book, setBook] = useState(false), [preview, setPreview] = useState(null), [demoIndex, setDemoIndex] = useState(0),
      [follow, setFollow] = useState(true), [sceneStatus, setSceneStatus] = useState("正在准备画面…"), [retry, setRetry] = useState(0);
    const now = Date.now();
    const iframe = useRef(null), scroll = useRef(null), positions = useRef({}), stateRef = useRef(null);
    const demo = id === DEMO.id, char = demo ? DEMO : (props.characters || []).find(c => String(c.id) === String(id));
    useEffect(() => { const timer = setInterval(() => setPulse(n => n + 1), 1000); return () => clearInterval(timer); }, []);
    useEffect(() => { if (scroll.current) scroll.current.scrollTop = positions.current[book ? "book" : "picker"] || 0; }, [book, id]);
    const pick = value => { setId(value); setPreview(null); setBook(false); setDemoIndex(0); setFollow(true); setSceneStatus("正在准备画面…"); props.onSelect?.(value === DEMO.id ? "" : value); };
    const state = char ? (demo ? { day: "示例日程", time: DEMO_ROWS[demoIndex].time, rows: DEMO_ROWS, hasPlan: true, slot: { ...DEMO_ROWS[demoIndex], key: "demo:" + demoIndex } } : dayState(char, props.plansFor?.(char) || {}, now)) : null;
    const slot = preview || state?.slot, title = slot?.deviation?.actual || slot?.title || (state?.hasPlan ? "这会儿没排事情" : "今天还没有日程");
    const payload = char && { charId: String(char.id), ta: props.taFor?.(char) || "TA", look: props.lookFor?.(char) || {}, slot: slot || null,
      presentation: presentation(slot), minute: preview || demo ? String(slot?.time || "12:00").split(":").reduce((n, part, i) => n + Number(part) * (i ? 1 : 60), 0) : state.minute, follow,
      key: slot?.key || JSON.stringify([char.id, state?.day, slot?.time, slot?.end, slot?.title, slot?.location, slot?.deviation]) };
    stateRef.current = payload;
    const send = () => { try { iframe.current?.contentWindow?.CharDayScene?.setSnapshot(stateRef.current); } catch (_) { setSceneStatus("画面同步失败，请重新载入画面"); } };
    React.useLayoutEffect(() => { send(); }, [pulse, JSON.stringify(payload), retry, book]);
    useEffect(() => {
      const ready = e => {
        if (e.source !== iframe.current?.contentWindow || e.origin !== location.origin) return;
        if (e.data?.type === "char-day-view") { setFollow(!!e.data.following); return; }
        if (e.data?.type !== "char-day-status") return;
        setSceneStatus(e.data.error || ""); if (!e.data.error) send();
      };
      root.addEventListener("message", ready); return () => root.removeEventListener("message", ready);
    }, []);
    const ink = "#4a493c", soft = "#827d69", paper = "#eeeadf";
    const btn = { minHeight: 44, padding: "9px 12px", border: "1px solid #cfc5ae", borderRadius: 10, background: "#f9f5e9", color: ink, fontSize: 12 };
    const outer = body => h("div", { "data-wk": "cdaypage", className: "h-full flex flex-col", style: { background: paper, color: ink } }, body);
    const head = (back, right) => h(Head, { zh: "TA的一天", sub: char ? char.remark || char.name : "跟着TA看看今天", bg: "transparent", ink, onBack: back, right });
    const body = content => h("div", { ref: scroll, "data-wk": "cdaybody", className: "flex-1 min-h-0 overflow-y-auto", onScroll: e => { positions.current[book ? "book" : "picker"] = e.currentTarget.scrollTop; }, style: { padding: "12px 16px 24px" } }, content);
    if (!char) return outer(h(React.Fragment, null, head(props.onBack), body(h(React.Fragment, null,
      h("p", { style: { fontSize: 13, lineHeight: 1.9, color: soft, margin: "0 0 16px" } }, "挑一位，看看TA此刻在哪儿、在做什么。"),
      ...(props.characters || []).map(c => {
        const st = dayState(c, props.plansFor?.(c) || {}, now);
        return h("button", { key: c.id, "data-wk": "cdaypick", onClick: () => pick(c.id), style: { ...btn, width: "100%", textAlign: "left", padding: 14, marginBottom: 10 } },
          h("strong", { style: { display: "block", fontSize: 15, fontWeight: 500 } }, c.remark || c.name),
          h("span", { style: { display: "block", marginTop: 5, lineHeight: 1.7, color: soft } }, st.slot?.title || (st.hasPlan ? "这会儿没排事情" : "今天还没有日程")));
      }), h("button", { onClick: () => pick(DEMO.id), style: { ...btn, width: "100%", marginTop: 12, background: "transparent", borderStyle: "dashed" } }, "先看一段示例"),
      h("p", { style: { fontSize: 11, color: soft, lineHeight: 1.8 } }, "简单试玩版 · 用现有场景和基础动作表现日程。")))));
    if (book) return outer(h(React.Fragment, null, head(() => setBook(false)), body(h(React.Fragment, null,
      h("p", { style: { fontSize: 12, color: soft, lineHeight: 1.8, marginTop: 0 } }, demo ? "示例安排，仅用于试玩。" : state.day + " · TA当地 " + state.time),
      !state.rows.length && h("p", { style: { fontSize: 13, lineHeight: 1.9 } }, "还没有今天的安排，可以到日历里排好再来看。"),
      ...state.rows.map((row, i) => h("button", { key: i, "data-wk": "cdayrow", "data-on": String(slot?.time === row.time), onClick: () => {
        if (demo) setDemoIndex(i); else setPreview({ ...row, key: "preview:" + char.id + ":" + state.day + ":" + JSON.stringify(row) });
        setBook(false);
      }, style: { ...btn, width: "100%", textAlign: "left", borderRadius: 0, border: 0, borderLeft: "2px solid " + (state.slot?.time === row.time ? "#7c9269" : "#cfc5ae"), padding: "12px 14px", marginBottom: 8 } },
        h("span", { style: { fontSize: 11, color: soft } }, row.time + "—" + row.end + (state.slot?.time === row.time ? " · 此刻" : "")),
        h("div", { style: { fontSize: 14, lineHeight: 1.8, marginTop: 4 } }, row.title),
        row.location && h("div", { style: { color: soft, fontSize: 12, lineHeight: 1.8 } }, row.location),
        row.deviation && h("div", { style: { color: "#9b674d", fontSize: 12, lineHeight: 1.8 } }, "临时改了：" + (row.deviation.actual || row.deviation.reason || "安排有变化")))),
      !demo && h("button", { style: { ...btn, width: "100%", marginTop: 12 }, onClick: () => props.onSchedule?.(char) }, "去日历看完整安排")))));
    return outer(h(React.Fragment, null, head(() => pick(""), h("button", { style: { ...btn, border: 0, background: "transparent" }, onClick: () => pick("") }, "换人")),
      h("div", { "data-wk": "cdayscene", className: "flex-1 min-h-0 relative", style: { overflow: "hidden" } },
        h("iframe", { key: char.id + ":" + retry, ref: iframe, title: "TA的一天场景", src: "apps/fairy-garden/day/index.html?v=" + props.build,
          onLoad: send, style: { width: "100%", height: "100%", border: 0, display: "block" } }),
        h("div", { "data-wk": "cdaynow", style: { position: "absolute", top: 12, left: 12, right: 12, padding: "11px 14px", borderRadius: 12, background: "rgba(250,247,236,.94)", boxShadow: "0 2px 18px #6d5b3020", pointerEvents: "none" } },
          h("div", { style: { fontSize: 11, color: soft } }, demo ? "示例试玩 · " + slot.time : preview ? "预览日程 · " + slot.time + "—" + slot.end : "此刻 · TA当地 " + state.time),
          h("div", { style: { fontSize: 14, lineHeight: 1.7, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, title),
          slot?.location && h("div", { style: { fontSize: 11, lineHeight: 1.6, color: soft, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, slot.location),
          slot?.deviation && h("div", { style: { fontSize: 11, color: "#9b674d", marginTop: 3 } }, "安排临时改了")),
        preview && h("button", { style: { ...btn, position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)" }, onClick: () => setPreview(null) }, "回到此刻"),
        !state.hasPlan && !demo && h("button", { style: { ...btn, position: "absolute", bottom: 44, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }, onClick: () => props.onSchedule?.(char) }, "去日历排今天"),
        sceneStatus && h("div", { role: "status", style: { position: "absolute", top: "48%", left: 16, right: 16, textAlign: "center", padding: 16, background: "#eeeadfe8", borderRadius: 12, fontSize: 12 } }, sceneStatus,
          sceneStatus.includes("失败") && h("button", { style: { ...btn, display: "block", margin: "12px auto 0" }, onClick: () => { setSceneStatus("正在准备画面…"); setRetry(x => x + 1); } }, "重新载入画面")),
        h("div", { style: { position: "absolute", bottom: 8, left: 10, right: 10, textAlign: "center", fontSize: 10, color: "#655e50", background: "#eeeadfb8", borderRadius: 8, padding: "3px 8px", pointerEvents: "none" } }, demo ? "示例不写入角色日程 · 拖动看四周，双指缩放" : "场景与动作是简化示意 · 拖动看四周，双指缩放")),
      h("div", { "data-wk": "cdaytools", className: "shrink-0", style: { display: "flex", gap: 4, padding: "3px 6px", paddingBottom: "calc(3px + env(safe-area-inset-bottom) * 0.4)", borderTop: "1px solid #cfc5ae", minHeight: 56, background: "#eeeadf" } },
        h("button", { style: { ...btn, flex: 1, border: 0, background: "transparent", color: follow ? "#57734b" : ink }, "aria-pressed": follow, onClick: () => { setFollow(true); try { iframe.current.contentWindow.CharDayScene?.focus(); } catch (_) {} } }, "跟着TA"),
        h("button", { style: { ...btn, flex: 1, border: 0, background: "transparent" }, onClick: () => { setFollow(false); try { iframe.current.contentWindow.CharDayScene?.overview(); } catch (_) {} } }, "看全景"),
        h("button", { style: { ...btn, flex: 1, border: 0, background: "transparent" }, onClick: () => setBook(true) }, "今天的日程"),
        demo && h("button", { style: { ...btn, flex: 1, border: 0, background: "transparent" }, onClick: () => setDemoIndex(i => (i + 1) % DEMO_ROWS.length) }, "下一段"))));
  };
})(window);
