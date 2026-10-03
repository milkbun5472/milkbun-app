// ============================================================
// 番茄钟 · 共桌专注（pomodoro）—— 独立小 app
// 玩法：选一个角色坐到对面，写下这轮只做的一件事，再决定 Ta 怎么陪。
// 开始时只调用一次 AI，预先生成开场、半程与收尾三张「桌边纸条」和结局批注；
// 专注中不继续请求模型，也不每几秒用新句子打断注意力。
//
// 计时以墙上时间 endTs 为准，并把当前场次存进 x_pomodoro_active：
// 切后台、退出页面或重开 app 后都会按真实经过时间恢复。可以暂停，也可以随时正常收桌。
// 往期记录存 x_pomodoro_saves（随云同步）；旧版逃跑/暗号记录仍可回看。
// ============================================================
(function () {
  const ACTIVE_KEY = "x_pomodoro_active";
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  // 禁烟这一层（她 2026-09-05：「你看看还有哪儿没禁烟的」）。
  // ⚠️它是【世界事实】，不是文风：这个 app 里没人抽烟，那在哪一处都得成立。
  //   原来它只挂在 buildBundle / groupBans 上，于是【凡是自己拼 sys 的地方一律没有】。
  //   不许塞进 ANTI_CLICHE 搭便车（v55.90 那条：能独立成立的规则就让它独立成立，
  //   挂在别人身上，别人不发的那一轮它就跟着消失）。
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");

  const loadSaves = () => loadJSON("x_pomodoro_saves", []);
  const saveSaves = l => saveJSON("x_pomodoro_saves", l);
  const loadActive = () => loadJSON(ACTIVE_KEY, null);
  const uid = () => "pf_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const pad2 = n => String(n).padStart(2, "0");
  const fmtClock = s => pad2(Math.floor(Math.max(0, s) / 60)) + ":" + pad2(Math.max(0, s) % 60);
  const fmtDate = ts => { const d = new Date(ts); return d.getFullYear() + "." + pad2(d.getMonth() + 1) + "." + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
  const modeLabels = { quiet: "安静同桌", notes: "偶尔递纸条", checkpoints: "节点提醒" };

  function clearActive() {
    try { localStorage.removeItem(ACTIVE_KEY); } catch (_) {}
  }

  function persistSession(s) {
    if (!s) { clearActive(); return; }
    const copy = { ...s, char: undefined };
    saveJSON(ACTIVE_KEY, copy);
  }

  function remainingSec(s, now) {
    if (!s || !s.endTs) return 0;
    const at = s.pausedAt || now || Date.now();
    return Math.max(0, Math.ceil((s.endTs - at) / 1000));
  }

  function focusedSec(s, now) {
    if (!s) return 0;
    return Math.max(0, Number(s.min || 0) * 60 - remainingSec(s, now || Date.now()));
  }

  function resumeSession(s, now) {
    if (!s || !s.pausedAt) return s;
    const at = now || Date.now();
    return { ...s, endTs: s.endTs + Math.max(0, at - s.pausedAt), pausedAt: null };
  }

  function noteIndex(s, left) {
    if (!s || !s.pack || s.mode === "quiet") return 0;
    const total = Math.max(1, Number(s.min || 1) * 60);
    const progress = 1 - Math.max(0, left) / total;
    if (s.mode === "checkpoints") return progress >= 0.78 ? 2 : progress >= 0.45 ? 1 : 0;
    return progress >= 0.72 ? 2 : progress >= 0.5 ? 1 : 0;
  }

  function recentChat(charId, uName, charName) {
    const msgs = loadJSON("x_chat:" + charId, []);
    if (!msgs.length) return "";
    return msgs.slice(-14).filter(m => m && (m.content || "").trim() && (m.role === "user" || m.role === "assistant") && !isOocMsg(m))
      .map(m => (m.role === "user" ? uName : charName) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 60)).join("\n");
  }

  function fallbackPack(task, mode) {
    return {
      notes: ["你做你的，我就在对面。", "走到一半了，先别抬头。", "快收尾了，把这一小段做好。"],
      taps: mode === "quiet" ? ["嗯，我在。", "陪你坐着呢。", "你忙，我等你。"] : mode === "checkpoints" ? ["照你的节奏来。", "这一段已经往前走了。", "把手上这小段做完就好。"] : ["给你留了一张小纸条。", "这一小段，陪你一起做。", "先做好眼前的这一件。"],
      done: "这张桌子没白坐，" + task + "被你好好推进了一截。",
      left: "先收桌也没关系，回来时我们从这里接上。",
      pause: "去处理吧，位置给你留着。"
    };
  }

  function companionSubtitle(s, left, turn, kind) {
    const fb = fallbackPack(s.task, s.mode), pack = s.pack || fb, idx = noteIndex(s, left);
    const node = (pack.notes && pack.notes[idx]) || fb.notes[idx];
    const taps = Array.isArray(pack.taps) ? pack.taps.filter(x => typeof x === "string" && x.trim()) : [];
    const lines = taps.length ? taps : fb.taps;
    const text = s.pausedAt ? (pack.pause || fb.pause) : kind === "tap" ? lines[(turn || 0) % lines.length] : node;
    const label = s.pausedAt ? "位置给你留着" : s.mode === "checkpoints"
      ? "已专注 " + fmtClock(focusedSec(s, s.endTs - left * 1000)) + " · 还剩 " + fmtClock(left)
      : s.mode === "notes" ? "递给你的小纸条" : kind === "tap" ? "轻轻回应你" : "一起安静坐一会儿";
    return { text, label, key: (s.pausedAt ? "pause" : kind === "tap" ? "tap-" + ((turn || 0) % lines.length) : "note-" + idx) };
  }

  async function genPack(active, ctx) {
    const { charName, persona, mood, uName, task, min, mode, chatRef, worldbook } = ctx;
    const sys = AC() + CB() +
      "你是「" + charName + "」，正和 " + uName + " 在一张桌子两边专注。Ta 这轮只做：「" + task + "」，时长 " + min + " 分钟；陪伴方式是「" + (modeLabels[mode] || modeLabels.notes) + "」。你不是监督员，也不要把专注写成服从测试。\n" +
      "【你的人设】" + (persona || "（暂无设定）") + (mood ? "\n【你此刻心情】" + mood : "") +
      (chatRef ? "\n【最近聊天（只用来还原关系与口吻）】\n" + chatRef : "") +
      (worldbook && worldbook.trim() ? "\n【世界书（仅参考）】\n" + worldbook.trim() : "") +
      "\n\n请写五类很短的文本，像对座的人在便签上随手写的，不要客服腔、鸡汤、训话或报菜名：\n" +
      "· notes：恰好 3 句，分别用于刚坐下、走到半程、快收尾。每句最多 24 字，彼此不能同义。安静同桌模式尤其克制。\n" +
      "· taps：3～5 句，用户主动轻戳画面时的独立回应，每句最多 24 字。按当前陪伴方式：安静模式回应短且轻；纸条模式带点彼此熟悉的互动；节点模式回应专注进度，具体时间由界面补上。语气与亲近程度来自你的人设和关系，每句都能单独显示。\n" +
      "· done：Ta 做完后的一句批注，承认具体投入，不夸张。\n" +
      "· left：Ta 提前收桌时的一句批注，不羞辱、不撒娇阻拦，允许以后接上。\n" +
      "· pause：Ta 暂停时的一句留座话。\n" +
      "【输出】只输出 JSON，不要代码块：{\"notes\":[\"..\",\"..\",\"..\"],\"taps\":[\"..\",\"..\",\"..\"],\"done\":\"..\",\"left\":\"..\",\"pause\":\"..\"}";
    const raw = await callAI(active, sys, [{ role: "user", content: "把纸条放到桌上吧。" }], { maxTokens: 65535 });
    const p = extractJSON(raw) || {};
    const fb = fallbackPack(task, mode);
    const str = (v, d) => { const s = v != null ? String(v).trim() : ""; return s && s.toLowerCase() !== "null" ? s : d; };
    const notes = Array.isArray(p.notes) ? p.notes.filter(Boolean).slice(0, 3).map(x => String(x).trim()) : [];
    while (notes.length < 3) notes.push(fb.notes[notes.length]);
    const taps = Array.isArray(p.taps) ? p.taps.filter(x => typeof x === "string" && x.trim()).slice(0, 5).map(x => x.trim()) : [];
    return { notes, taps: taps.length ? taps : fb.taps, done: str(p.done, fb.done), left: str(p.left, fb.left), pause: str(p.pause, fb.pause) };
  }

  function minutesText(v) {
    const n = Number(v || 0);
    return (Math.round(n * 10) / 10).toString() + " 分钟";
  }

  // 结算：一张【收桌时留在桌上的单子】（v61.40，她 2026-09-03：「结算的页面也很无聊」）
  // 原来是从底下掀起来的半窗（还犯了 no-half-sheet.md），里面是一排「键：值」。
  // 现在是整页：桌面打底，中间一张长条单据——齿孔边、虚线分栏、TA的批注写在最底下，
  // 像收摊时撕下来的那一联。结果页和往期回看共用它（一处画、两处用）。
  function ResultCard(t, rec, char, onClose, tp) {
    const isDone = rec.status === "done";
    const DESKC = "linear-gradient(163deg,#efe9dd,#e5dccb 62%,#dbd0bb)";
    const row = (k, v, tone) => h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "10px 0", borderBottom: "1px dashed rgba(120,96,58,.28)" } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: "#8a7a5e" } }, k),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: tone || "#3a3024", textAlign: "right" } }, v));
    // 齿孔：单据上下两条撕口
    const perf = pos => h("div", { "aria-hidden": "true", style: Object.assign({ position: "absolute", left: 0, right: 0, height: 8,
      background: "radial-gradient(circle at 6px 4px, transparent 3.4px, #fffdf7 3.6px) 0 0/12px 8px repeat-x" },
      pos === "top" ? { top: -4, transform: "scaleY(-1)" } : { bottom: -4 }) });
    return h("div", { className: "h-full flex flex-col", style: { background: DESKC,
      backgroundImage: "repeating-linear-gradient(96deg,rgba(120,96,58,.03) 0 2px,transparent 2px 26px)," + DESKC,
      boxShadow: "inset 0 0 60px rgba(96,72,40,.16)" } },
      h(Head, { zh: isDone ? "一起坐住了" : "这一轮先收桌", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h("div", { style: { position: "relative", background: "#fffdf7", padding: "20px 18px 22px", marginTop: 8,
          boxShadow: "0 10px 26px rgba(80,60,25,.20)", transform: "rotate(-.5deg)" } },
          perf("top"), perf("bottom"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: "#3a3024", lineHeight: 1.35 } }, rec.task),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#a3925f", marginTop: 6, letterSpacing: ".02em" } },
            fmtDate(rec.ts) + "　对座 " + (rec.charName || (char && char.name) || "")),
          h("div", { style: { marginTop: 16, borderTop: "1px solid rgba(120,96,58,.3)" } },
            row("计划坐多久", minutesText(rec.minutes)),
            row("实际坐住", minutesText(rec.focusedMinutes != null ? rec.focusedMinutes : rec.minutes), isDone ? "#4a6b52" : "#3a3024"),
            rec.pauseCount != null ? row("中间停了", (rec.pauseCount || 0) + " 次") : null,
            rec.interruptReason ? row("为什么收桌", rec.interruptReason) : null,
            rec.escapes != null ? row("旧版 · 想跑", String(rec.escapes || 0), rec.escapes ? "#a8433a" : "#3a3024") : null,
            rec.wrong != null ? row("旧版 · 暗号输错", String(rec.wrong || 0), rec.wrong ? "#a8433a" : "#3a3024") : null),
          // TA的批注：写在单子最下面那一格，像顺手划下的一行
          rec.annotation ? h("div", { style: { marginTop: 16, paddingTop: 14, borderTop: "1px dashed rgba(120,96,58,.35)" } },
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 15.5, lineHeight: 1.95, color: "#3a3024" } }, "“" + rec.annotation + "”"),
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 9 } },
              (tp && char && typeof TtsDot === "function") ? h(TtsDot, { k: "pmd" + rec.id, text: rec.annotation, spk: char, tp }) : null,
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#a3925f" } }, "—— " + (rec.charName || (char && char.name) || "")))) : null),
        h("button", { onClick: onClose, className: "w-full active:opacity-80",
          style: { marginTop: 22, background: "#3a3024", color: "#fffdf7", border: "none", borderRadius: 3,
            padding: "14px 0", fontFamily: F_BODY, fontSize: 13, boxShadow: "0 8px 18px rgba(60,45,25,.22)" } },
          isDone ? "收好这张单子" : "知道了")));
  }

  // ── 发条计时盘（v61.39，她 2026-09-03：「番茄钟的页面还是无聊」）──
  // 原来那一页是「一排横线分节的表单：输入框 + 一排头像 + 四颗药丸 + 三个单选点」。
  // 按她立的判据（换个 app 还成立吗）——那套东西搬到任何一个 app 上都成立，就是写坏了。
  // 番茄钟在现实里是【一个上发条的厨房定时器】：一圈刻度、一根指针、拧到几分就走几分。
  // 那是别的功能拿不走的形状，所以时长这一栏就做成那个盘，不是四颗药丸。
  //
  // ⚠️盘面按【60 分钟一圈】画：这样 25 分就真的落在四分之一多一点的位置，
  //   刻度和数字对得上真实的钟面。
  // 超过一小时怎么办（她 2026-09-03 问的）：真发条钟拧过头就是【多拧一圈】。
  //   所以 90 分 = 里圈满一圈 + 指针停在 30；每多一整圈，盘外面多一道细环。
  //   指针只走余数那一段——绕第二圈的话两个位置会重叠，反而读不出来。
  const DIAL_MAX = 60;
  function Dial({ t, min, onPick, size }) {
    const S = size || 216, R = S / 2, r = R - 32;   // 边上留够，套得下几道「多拧一圈」的细环
    const total = Math.max(0, Number(min) || 0);
    const laps = Math.floor(total / DIAL_MAX);       // 拧满了几整圈
    const val = total - laps * DIAL_MAX;             // 指针只指余数那一段
    // 正好整点（60/120）指针指回 12 点、但发条是满的：这时候把最后一圈算成「满」
    const wound = (val === 0 && laps > 0) ? DIAL_MAX : val;
    const ang = (wound / DIAL_MAX) * 360;
    const rad = d => (d - 90) * Math.PI / 180;
    const pt = (d, rr) => [R + rr * Math.cos(rad(d)), R + rr * Math.sin(rad(d))];
    // 拧到哪儿：按下/拖动时把坐标换算成分钟。⚠️用 getBoundingClientRect 而不是 offsetX——
    // offsetX 在 SVG 子元素上给的是【那个子元素】的局部坐标，指针会跳。
    const pick = e => {
      if (!onPick) return;
      const box = e.currentTarget.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - box.left - box.width / 2;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - box.top - box.height / 2;
      let deg = Math.atan2(cy, cx) * 180 / Math.PI + 90;
      if (deg < 0) deg += 360;
      const m = Math.max(1, Math.round(deg / 360 * DIAL_MAX));
      // 已经拧过几圈就接着往上加：不然拧到第二圈时手一动就掉回一小时以内
      onPick(laps * DIAL_MAX + m);
    };
    const ticks = [];
    for (let i = 0; i < DIAL_MAX; i++) {
      const big = i % 5 === 0;
      const [x1, y1] = pt(i * 6, r - (big ? 11 : 5));
      const [x2, y2] = pt(i * 6, r);
      ticks.push(h("line", { key: "t" + i, x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: t.ink, strokeWidth: big ? 1.6 : 0.8, opacity: big ? 0.55 : 0.22 }));
    }
    const nums = [];
    for (let i = 0; i < 12; i++) {
      const [x, y] = pt(i * 30, r - 26);
      nums.push(h("text", { key: "n" + i, x: x, y: y + 4, textAnchor: "middle",
        style: { fontFamily: F_BODY, fontSize: 10, fill: t.fog } }, String(i * 5)));
    }
    // 拧过的那一段：从 12 点走到指针，扇形填充——「上了多少发条」一眼看得见
    const [ax, ay] = pt(ang, r - 3);
    const arc = "M " + R + " " + R + " L " + R + " " + (R - (r - 3))
      + " A " + (r - 3) + " " + (r - 3) + " 0 " + (ang > 180 ? 1 : 0) + " 1 " + ax + " " + ay + " Z";
    const [hx, hy] = pt(ang, r - 22);
    // 拧满的每一圈，在盘外面多套一道细环——一眼数得出「拧了几圈」
    const lapRings = [];
    for (let i = 0; i < Math.min(laps, 4); i++) {
      lapRings.push(h("circle", { key: "l" + i, cx: R, cy: R, r: r + 11 + i * 4,
        fill: "none", stroke: t.accent, strokeWidth: 1.6, opacity: .5 }));
    }
    return h("svg", { width: S, height: S, viewBox: "0 0 " + S + " " + S,
      onPointerDown: pick, onPointerMove: e => { if (e.buttons === 1) pick(e); },
      style: { touchAction: "none", cursor: onPick ? "pointer" : "default", display: "block" } },
      lapRings,
      h("circle", { cx: R, cy: R, r: r + 8, fill: t.bg2, stroke: t.line }),
      h("circle", { cx: R, cy: R, r: r + 2, fill: "none", stroke: t.line, strokeDasharray: "1 3", opacity: .7 }),
      val > 0 ? h("path", { d: arc, fill: t.accent, opacity: .16 }) : null,
      ticks, nums,
      h("line", { x1: R, y1: R, x2: hx, y2: hy, stroke: t.ink, strokeWidth: 2.4, strokeLinecap: "round" }),
      h("circle", { cx: R, cy: R, r: 5.5, fill: t.ink }),
      h("circle", { cx: R, cy: R, r: 2, fill: t.bg2 }));
  }

  function Pomodoro(props) {
    const t = useTheme();
    const uName = (props.profile && props.profile.name) || "我";
    const chars = props.characters || [];
    const [view, setView] = useState("setup");
    const [videoRevision, setVideoRevision] = useState(0);
    const setupScroll = useRef(0), setupScroller = useRef(null);
    useEffect(() => { if (view === "setup" && setupScroller.current) setupScroller.current.scrollTop = setupScroll.current; }, [view]);
    const [saves, setSaves] = useState(loadSaves);
    const [detail, setDetail] = useState(null);
    const [charId, setCharId] = useState(chars[0] ? chars[0].id : "");
    const [task, setTask] = useState("一起看书");
    // 这一场算进哪门课（她 2026-09-28：「可以开番茄钟选一门课」）。记在场次和往期记录上，
    // 一起学那边的学习时长按它认；不选就不算进任何一门。
    const [curId, setCurId] = useState("");
    const courses = (window.Study && window.Study.loadCurricula ? window.Study.loadCurricula() : []).filter(function (c) { return c && c.id && c.subject; });
    const [min, setMin] = useState(25);
    const [mode, setMode] = useState("notes");
    const [busy, setBusy] = useState(false);
    const [sess, setSess] = useState(null);
    const sessRef = useRef(null);
    const [left, setLeft] = useState(0);
    const [endOpen, setEndOpen] = useState(false);
    const [result, setResult] = useState(null);
    const [resumed, setResumed] = useState(false);
    const [subtitle, setSubtitle] = useState(null);
    const pokeRef = useRef({ at: 0, turn: 0 });
    const subtitleTimer = useRef(null);
    const lastSubtitle = useRef(null);
    const showSubtitle = next => {
      clearTimeout(subtitleTimer.current);
      lastSubtitle.current = next; setSubtitle(next);
      subtitleTimer.current = setTimeout(() => setSubtitle(null), Math.max(6000, Math.min(14000, String(next.text).length * 260)));
    };
    const focusNote = sess ? noteIndex(sess, left) : 0;
    useEffect(() => {
      if (view !== "focus" || !sess) { clearTimeout(subtitleTimer.current); setSubtitle(null); return; }
      if (stopSpeechRef.current) stopSpeechRef.current();
      showSubtitle(companionSubtitle(sess, left, 0, "node"));
      return () => clearTimeout(subtitleTimer.current);
    }, [view, sess && sess.startTs, sess && sess.pausedAt, focusNote]);
    useEffect(() => () => clearTimeout(subtitleTimer.current), []);
    const didRestore = useRef(false);
    const timerRef = useRef(null);
    const charOf = id => chars.find(c => c.id === id);
    const moodOf = id => { const mo = props.moods && props.moods[id]; return mo && mo.label ? String(mo.label) : ""; };
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null;
    const stopSpeechRef = useRef(null);
    stopSpeechRef.current = tp && tp.stop;
    useEffect(() => { if (view !== "focus" && stopSpeechRef.current) stopSpeechRef.current(); }, [view]);
    useEffect(() => { const hidden = () => { if (document.hidden && stopSpeechRef.current) stopSpeechRef.current(); }; document.addEventListener("visibilitychange", hidden); return () => document.removeEventListener("visibilitychange", hidden); }, []);
    sessRef.current = sess;

    const keepSession = next => { sessRef.current = next; setSess(next); persistSession(next); };

    const finish = (status, reason) => {
      if (timerRef.current) clearInterval(timerRef.current);
      const s = sessRef.current;
      if (!s) return;
      const actual = Math.round((focusedSec(s, Date.now()) / 60) * 10) / 10;
      const rec = {
        id: uid(), charId: s.char.id, charName: s.char.name, task: s.task, curId: s.curId || null, minutes: s.min,
        focusedMinutes: status === "done" ? Number(s.min) : actual, pauseCount: s.pauseCount || 0,
        ts: Date.now(), status, statusZh: status === "done" ? "完成" : "提前收桌",
        interruptReason: status === "done" ? "" : (reason || "今天先到这里"),
        annotation: status === "done" ? s.pack.done : s.pack.left, mode: s.mode
      };
      const next = [rec].concat(loadSaves());
      saveSaves(next); setSaves(next); clearActive();
      setResult({ rec, char: s.char }); setEndOpen(false); setView("result");
    };
    const finishRef = useRef(finish);
    finishRef.current = finish;

    useEffect(() => {
      if (didRestore.current || !chars.length) return;
      didRestore.current = true;
      const raw = loadActive();
      const c = raw && charOf(raw.charId);
      if (!raw || !c || !raw.endTs || !raw.pack) { if (raw) clearActive(); return; }
      const restored = { ...raw, char: c };
      sessRef.current = restored; setSess(restored); setLeft(remainingSec(restored, Date.now()));
      setCharId(c.id); setTask(restored.task || "专注"); setMin(restored.min || 25); setMode(restored.mode || "notes"); setCurId(restored.curId || "");
      setResumed(true); setView("focus");
    }, [chars.length]);

    useEffect(() => {
      if (view !== "focus" || !sess) return;
      const tick = () => {
        const current = sessRef.current;
        if (!current) return;
        const remain = remainingSec(current, Date.now());
        setLeft(remain);
        if (remain <= 0 && !current.pausedAt) finishRef.current("done");
      };
      tick(); timerRef.current = setInterval(tick, 1000);
      return () => clearInterval(timerRef.current);
    }, [view, sess && sess.startTs]);

    const start = async () => {
      const c = charOf(charId);
      const duration = Number(min);
      if (!c) { props.toast && props.toast("先去『人格档案馆』选/建个角色陪你"); return; }
      if (!duration || duration < 1) { props.toast && props.toast("时长至少 1 分钟"); return; }
      setBusy(true);
      let pack;
      try {
        const chatRef = recentChat(c.id, uName, c.name);
        const scopedWorldbook = props.worldbookFor ? props.worldbookFor(c.id, (task.trim() || "专注") + "\n" + chatRef) : props.worldbook;
        pack = props.active
          ? await genPack(props.active, { charName: c.name, persona: c.persona, mood: moodOf(c.id), uName, task: task.trim() || "专注", min: duration, mode, chatRef, worldbook: scopedWorldbook })
          : fallbackPack(task.trim() || "专注", mode);
      } catch (_) { pack = fallbackPack(task.trim() || "专注", mode); }
      const now = Date.now();
      const next = { char: c, charId: c.id, curId: curId || null, pack, min: duration, task: task.trim() || "专注", mode, startTs: now, endTs: now + duration * 60000, pausedAt: null, pauseCount: 0 };
      pokeRef.current = { at: 0, turn: 0 }; keepSession(next); setLeft(duration * 60); setBusy(false); setResumed(false); setView("focus");
    };

    const togglePause = () => {
      const s = sessRef.current; if (!s) return;
      if (stopSpeechRef.current) stopSpeechRef.current();
      const now = Date.now();
      if (s.pausedAt) keepSession(resumeSession(s, now));
      else keepSession({ ...s, pausedAt: now, pauseCount: (s.pauseCount || 0) + 1 });
    };

    if (view === "result" && result) {
      return ResultCard(t, result.rec, result.char, () => { setResult(null); setSess(null); sessRef.current = null; setView("setup"); }, tp);
    }

    // ⚠️结算从半窗改成整页之后，往期那张不能再当兄弟节点挂在列表下面
    //   （那会变成「列表底下又接了一页」）。要么整页替换，要么就不是整页。
    if (view === "archive" && detail) return ResultCard(t, detail, charOf(detail.charId), () => setDetail(null), tp);
    if (view === "archive") {
      const archiveRight = h("div", { style: { minWidth: 32, textAlign: "right", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, saves.length);
      const DESKA = "linear-gradient(163deg,#efe9dd,#e5dccb 62%,#dbd0bb)";
      return h("div", { className: "h-full flex flex-col", style: { background: DESKA,
        backgroundImage: "repeating-linear-gradient(96deg,rgba(120,96,58,.03) 0 2px,transparent 2px 26px)," + DESKA,
        boxShadow: "inset 0 0 60px rgba(96,72,40,.16)" } },
        h(Head, { zh: "坐过的那些", onBack: () => setView("setup"), right: archiveRight, bg: "transparent" }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
          saves.length === 0
            ? h("div", { style: { borderTop: "1px solid rgba(120,96,58,.24)", padding: "48px 0", fontFamily: F_BODY, fontSize: 13, color: "#8a7a5e" } }, "桌上还没有留下记录。")
            : saves.map((r, i) => h("button", { key: r.id, onClick: () => setDetail(r), className: "w-full text-left active:opacity-70", style: { background: "transparent", border: "none", borderTop: "1px solid rgba(120,96,58,.24)", padding: "17px 0", display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 10, alignItems: "start" } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a3925f", paddingTop: 3 } }, pad2(i + 1)),
                h("span", null,
                  h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 17, color: "#3a3024", lineHeight: 1.35 } }, r.task),
                  h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11, color: "#8a7a5e", marginTop: 5 } }, fmtDate(r.ts) + " · " + r.charName + " · " + minutesText(r.focusedMinutes != null ? r.focusedMinutes : r.minutes))),
                h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: r.status === "done" ? "#4a6b52" : "#a3925f", paddingTop: 3 } }, r.status === "done" ? "完成" : "收桌"))))
      );
    }

    if (view === "video" && charOf(charId)) return h(PomodoroVideoEditor, { key: charId, character: charOf(charId), onBack: () => setView("setup"), onSaved: () => setVideoRevision(v => v + 1), toast: props.toast });

    if (view === "focus" && sess) {
      const c = sess.char, companion = VideoApi.media(c.id);
      const progress = Math.max(0, Math.min(1, 1 - left / Math.max(1, sess.min * 60)));
      const bg = c.avatarImage
        ? { backgroundImage: "url(\"" + resolveImg(c.avatarImage) + "\")", backgroundSize: "cover", backgroundPosition: "center" }
        : { background: "radial-gradient(ellipse at 50% 32%," + (c.color || "#716552") + ",#201e19 85%)" };
      const voiceReady = tp && c.voiceId && typeof ttsReady === "function" && ttsReady();
      const poke = () => {
        const now = Date.now();
        if (now - pokeRef.current.at < 650) return;
        if (stopSpeechRef.current) stopSpeechRef.current();
        const next = companionSubtitle(sess, left, pokeRef.current.turn, "tap");
        pokeRef.current = { at: now, turn: pokeRef.current.turn + 1 };
        showSubtitle(next);
      };
      const current = subtitle || lastSubtitle.current || companionSubtitle(sess, left, Math.max(0, pokeRef.current.turn - 1), "tap");
      const speak = () => { showSubtitle(current); tp.toggle("pmd-note-" + sess.startTs + "-" + current.key, current.text, c.voiceId); };
      const cream = "#f6efdf", dim = "rgba(246,239,223,.66)";
      const exitRight = h("button", { onClick: () => setEndOpen(true), "aria-label": "收桌", style: { width: 46, minHeight: 40, border: "none", background: "transparent", color: cream, fontFamily: F_BODY, fontSize: 12 } }, "收桌");
      return h("div", { className: "h-full flex flex-col", "data-wk": "pomfocus", "data-pomodoro-focus": sess.mode, style: { position: "relative", ...bg, overflow: "hidden", color: cream } },
        h("style", null, ".pom-subtitle{animation:fadeUp .3s ease both}.pom-poke:focus-visible{outline:2px solid #f6efdf;outline-offset:-8px}@media(prefers-reduced-motion:reduce){.pom-subtitle{animation:none}}"),
        companion ? h(PomodoroLoopVideo, { key: companion.videoRef, videoRef: companion.videoRef, poster: companion.imageRef, controls: true, controlStyle: { right: 18, top: safeTop(82), bottom: "auto", zIndex: 6, fontSize: 10.5, borderRadius: 999, minHeight: 36, background: "rgba(26,25,21,.38)", backdropFilter: "blur(12px)" }, style: { position: "absolute", inset: 0 } }) : null,
        h("div", { "aria-hidden": "true", style: { pointerEvents: "none", position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(18,17,14,.62) 0%,transparent 30%,transparent 45%,rgba(18,17,14,.44) 65%,rgba(18,17,14,.95) 100%)" } }),
        h(Head, { zh: c.name + " 在对面", sub: modeLabels[sess.mode] || modeLabels.notes, onBack: props.onBack, right: exitRight, bg: "transparent", ink: cream, subInk: dim, noLine: true, inkShadow: "0 1px 12px rgba(0,0,0,.35)", barStyle: { position: "relative", zIndex: 5 } }),
        h("div", { className: "flex-1 min-h-0", style: { position: "relative", zIndex: 1 } },
          h("div", { style: { position: "absolute", top: 14, left: 22, pointerEvents: "none", fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".06em", color: dim } }, sess.pausedAt ? "暂时歇一会儿" : resumed ? "接着刚才的这一轮" : "这一刻，只做一件事"),
          h("button", { className: "pom-poke", "data-wk": "pompoke", "aria-label": "戳一戳陪伴画面", onClick: poke, style: { position: "absolute", inset: 0, width: "100%", border: "none", background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent" } }),
          h("div", { style: { position: "absolute", left: 22, right: 22, bottom: 12, pointerEvents: "none" } },
            subtitle || (tp && tp.play) ? h("div", { key: current.key, className: "pom-subtitle", "data-wk": "pomsubtitle", "data-pomodoro-subtitle": "", role: "status", "aria-live": "polite", style: { maxWidth: 380, margin: "0 auto", padding: sess.mode === "notes" ? "17px 18px" : "14px 16px", borderRadius: sess.mode === "notes" ? "2px 16px 16px 16px" : 14, background: sess.mode === "notes" ? "rgba(249,243,230,.94)" : "rgba(30,29,25,.65)", border: "1px solid " + (sess.mode === "notes" ? "rgba(255,255,255,.32)" : "rgba(246,239,223,.18)"), backdropFilter: "blur(14px)", boxShadow: "0 8px 28px rgba(0,0,0,.12)", color: sess.mode === "notes" ? "#3c382e" : cream } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".06em", opacity: .6, marginBottom: 7 } }, current.label),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1.6, overflowWrap: "anywhere", maxHeight: 150, overflowY: "auto", pointerEvents: "auto" } }, current.text),
              voiceReady ? h("button", { "aria-label": "听桌边纸条", onClick: speak, style: { pointerEvents: "auto", minHeight: 36, display: "flex", alignItems: "center", gap: 6, marginTop: 5, padding: 0, background: "transparent", border: "none", color: "inherit", opacity: .65, fontFamily: F_BODY, fontSize: 11 } }, h("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": "true" }, h("path", { d: "M11 4 5 9H2v6h3l6 5V4Z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14" })), tp.play ? tp.play.st === "gen" ? "声音准备中…" : "停止语音" : "听这句") : null)
              : h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".06em", color: dim } }, "轻戳画面，看看对座想说什么"))),
        h("div", { className: "shrink-0", "data-wk": "pomtimer", style: { position: "relative", zIndex: 4, padding: "14px 22px calc(env(safe-area-inset-bottom) * 0.4 + 22px)", borderTop: "1px solid rgba(246,239,223,.16)", background: "linear-gradient(180deg,rgba(20,19,16,.12),rgba(20,19,16,.42))" } },
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 } },
            h("div", { style: { minWidth: 0 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".12em", color: dim, marginBottom: 5 } }, sess.pausedAt ? "发条停了一会儿" : "这一圈发条，还剩"),
              h("div", { "data-pomodoro-clock": "", style: { fontFamily: F_DISPLAY, fontSize: 46, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em", color: cream } }, fmtClock(left))),
            h("div", { style: { position: "relative", width: 62, height: 62, flexShrink: 0 } },
              (function () { const RR = 28, C = 2 * Math.PI * RR; return h("svg", { width: 62, height: 62, viewBox: "0 0 62 62", "aria-hidden": "true", style: { position: "absolute", inset: 0, transform: "rotate(-90deg)", pointerEvents: "none" } },
                h("circle", { cx: 31, cy: 31, r: RR, fill: "none", stroke: "rgba(246,239,223,.22)", strokeWidth: 1.5 }),
                h("circle", { cx: 31, cy: 31, r: RR, fill: "none", stroke: "#dac8a4", strokeWidth: 1.5, strokeLinecap: "round", strokeDasharray: C, strokeDashoffset: (C * progress).toFixed(2) })); })(),
              h("button", { onClick: togglePause, style: { position: "absolute", left: 5, top: 5, width: 52, height: 52, borderRadius: 999, background: cream, color: "#39352b", border: "none", fontFamily: F_BODY, fontSize: 12 } }, sess.pausedAt ? "继续" : "暂停"))),
          h("div", { style: { display: "flex", gap: 12, alignItems: "baseline", justifyContent: "space-between", marginTop: 12, fontFamily: F_BODY, fontSize: 11, color: dim } },
            h("span", { style: { overflowWrap: "anywhere", maxHeight: 42, overflowY: "auto", lineHeight: 1.7 } }, sess.task),
            h("span", { style: { flexShrink: 0, fontSize: 10 } }, "已坐住 " + Math.floor((sess.min * 60 - left) / 60) + " 分钟"))),
        endOpen ? h("div", { role: "dialog", "aria-modal": "true", "aria-label": "收桌确认", className: "absolute inset-0 flex flex-col", style: { zIndex: 20, background: "#eee6d6", color: "#3c382e" } },
          h(Head, { zh: "收桌", onBack: () => setEndOpen(false), bg: "transparent", ink: "#3c382e" }),
          h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "32px 24px calc(env(safe-area-inset-bottom) * 0.4 + 24px)" } },
            h("div", { style: { borderTop: "1px solid #c9bea7", paddingTop: 22, fontFamily: F_BODY, fontSize: 11, color: "#8d816a" } }, c.name + " · 这一桌"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 27, marginTop: 14 } }, "这一轮先收到这里？"),
            h("p", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.9, color: "#7d725d" } }, "已经坐住的时间会留下。给这一轮留个原因，下次回来接着做。"),
            h("div", { style: { display: "grid", gap: 10, marginTop: 26 } }, ["临时有事", "状态不对", "任务已完成", "今天先到这里"].map(reason => h("button", { key: reason, onClick: () => finish("left", reason), style: { minHeight: 50, padding: "12px 16px", textAlign: "left", border: "1px solid #c9bea7", background: "rgba(255,253,247,.5)", fontFamily: F_BODY, fontSize: 13 } }, reason))),
            h("button", { onClick: () => setEndOpen(false), style: { width: "100%", minHeight: 48, marginTop: 22, background: "#3c382e", color: cream, border: "none", fontFamily: F_BODY, fontSize: 13 } }, "继续这一轮"))) : null);
    }

    const cur = charOf(charId);
    const archiveRight = h("button", { onClick: () => setView("archive"), className: "active:opacity-60", style: { minWidth: 44, height: 44, marginRight: -10, background: "transparent", border: "none", fontFamily: F_BODY, fontSize: 11.5, color: t.sub } }, "记录 " + saves.length);
    // ── 这一页就是【摆好的一张桌子】（v61.39）──
    // 桌面木纹打底，上面摆着：一张便签（写这一轮做什么）、对面的座位、一个发条计时盘、
    // 三张「怎么陪」的小卡。原来那版是横线分节的表单，搬到任何 app 上都成立。
    const DESK = "linear-gradient(163deg,#efe9dd,#e5dccb 62%,#dbd0bb)";
    const seat = c => { const on = charId === c.id;
      return h("button", { key: c.id, onClick: () => setCharId(c.id), className: "active:opacity-80",
        style: { flexShrink: 0, width: 74, background: "transparent", border: "none", padding: 0, textAlign: "center" } },
        // 座位：一把椅子的正视——椅背（圆角方）＋座面（一条），选中的那张往前推、椅背上墨
        h("div", { style: { position: "relative", height: 78, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end", transform: on ? "translateY(-4px)" : "none",
          transition: "transform .18s ease" } },
          h("div", { style: { position: "relative", padding: 3, borderRadius: 12,
            background: on ? t.ink : "transparent", boxShadow: on ? "0 6px 14px rgba(60,45,25,.22)" : "none" } },
            h(Avatar, { character: c, size: 46, radius: 9 })),
          // 座面那一条：椅子从这儿被推到桌边
          h("div", { style: { width: on ? 60 : 46, height: 4, marginTop: 6, borderRadius: 2,
            background: on ? t.ink : "rgba(90,72,44,.22)", transition: "width .18s ease" } })),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: on ? t.ink : t.fog, marginTop: 6,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name)); };
    const modeCard = x => { const on = mode === x.id;
      return h("button", { key: x.id, onClick: () => setMode(x.id), className: "active:opacity-80",
        style: { flex: 1, minWidth: 0, textAlign: "left", padding: "11px 11px 12px", borderRadius: 3,
          background: on ? "#fffdf6" : "rgba(255,253,246,.5)",
          border: "1px solid " + (on ? "rgba(90,72,44,.5)" : "rgba(90,72,44,.16)"),
          boxShadow: on ? "0 5px 13px rgba(60,45,25,.16)" : "none",
          transform: on ? "translateY(-2px)" : "none", transition: "transform .16s ease" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13.5, color: "#3a3024" } }, x.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: "#8a7a5e", lineHeight: 1.55, marginTop: 4 } }, x.desc)); };
    return h("div", { className: "h-full flex flex-col", style: { background: DESK,
      backgroundImage: "repeating-linear-gradient(96deg,rgba(120,96,58,.03) 0 2px,transparent 2px 26px)," + DESK,
      boxShadow: "inset 0 0 60px rgba(96,72,40,.16)" } },
      h(Head, { zh: "番茄钟", onBack: props.onBack, right: archiveRight, bg: "transparent" }),
      h("div", { ref: setupScroller, className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        // ① 桌上那张便签：这一轮只做的一件事。写在纸上，不是写在一个输入框里。
        h("div", { style: { position: "relative", background: "#fdf6d8", padding: "16px 16px 18px",
          borderRadius: 2, boxShadow: "0 8px 20px rgba(80,60,25,.18)", transform: "rotate(-.7deg)", marginTop: 4 } },
          // 一段胶带把它粘在桌上
          h("div", { "aria-hidden": "true", style: { position: "absolute", top: -10, left: "50%", width: 76, height: 20,
            transform: "translateX(-56%) rotate(-2.6deg)", background: "rgba(226,214,186,.66)",
            borderLeft: "1px dashed rgba(255,255,255,.55)", borderRight: "1px dashed rgba(255,255,255,.55)" } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".12em", color: "#a3925f" } }, "这一轮只做"),
          h("input", { value: task, onChange: e => setTask(e.target.value), placeholder: "这一轮只做…", maxLength: 24,
            style: { width: "100%", fontFamily: F_DISPLAY, fontSize: 21, color: "#3a3024", background: "transparent",
              border: "none", borderBottom: "1px solid rgba(140,116,60,.28)", outline: "none", padding: "9px 0 7px", marginTop: 8 } }),
          // 算进哪门课：一起学里开过课才出现。点一门就挂上，再点一下取消；空着的便签顺手填上课名
          courses.length ? h("div", { style: { marginTop: 11 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".12em", color: "#a3925f", marginBottom: 6 } }, "算进哪门课"),
            h("div", { className: "flex flex-wrap", style: { gap: 6 } }, courses.slice(0, 8).map(function (c) {
              const on = curId === c.id;
              return h("button", { key: c.id, className: "active:opacity-70", onClick: function () {
                  setCurId(on ? "" : c.id);
                  if (!on && (!task.trim() || task === "一起看书" || task === "专注")) setTask(c.subject);
                },
                style: { minHeight: 30, padding: "3px 11px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5,
                  border: "1px solid " + (on ? "#8c743c" : "rgba(140,116,60,.3)"), background: on ? "#8c743c" : "transparent", color: on ? "#fdf6d8" : "#6b5a36" } }, c.subject);
            }))) : null),
        // ② 发条计时盘：拧到几分就走几分
        h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 22 } },
          h(Dial, { t: t, min: min, size: 200, onPick: v => setMin(v) }),
          // 超过一小时就按「几小时几分」念——「90 分钟」得在脑子里再换算一次
          (function () {
            const v = Number(min) || 0, hh = Math.floor(v / 60), mm = v % 60;
            return h("div", { className: "flex items-baseline", style: { gap: 5, marginTop: 10 } },
              hh ? h(Fragment, null,
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: t.ink, lineHeight: 1 } }, String(hh)),
                h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginRight: 3 } }, "小时")) : null,
              (mm || !hh) ? h(Fragment, null,
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: t.ink, lineHeight: 1 } }, String(mm)),
                h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "分钟")) : null);
          })(),
          h("div", { className: "flex flex-wrap items-center justify-center", style: { gap: 7, marginTop: 12 } },
            [15, 25, 45, 60, 90].map(p2 => h("button", { key: p2, onClick: () => setMin(p2), className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 11.5, minHeight: 34, padding: "0 13px", borderRadius: 999,
                color: Number(min) === p2 ? t.bg2 : "#6b5b3e", background: Number(min) === p2 ? t.ink : "transparent",
                border: "1px solid " + (Number(min) === p2 ? t.ink : "rgba(90,72,44,.28)") } }, p2 >= 60 ? (p2 / 60) + " 小时" : p2 + " 分")),
            h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8a7a5e" } }, "自定"),
            h("input", { value: String(min), onChange: e => setMin(e.target.value.replace(/[^0-9]/g, "").slice(0, 3)),
              inputMode: "numeric", "aria-label": "自定分钟",
              style: { width: 52, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, background: "transparent",
                border: "none", borderBottom: "1px solid rgba(90,72,44,.4)", outline: "none", textAlign: "center", padding: "5px 0" } }),
            h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8a7a5e" } }, "分"))),
        // ③ 对面的座位
        h("div", { style: { marginTop: 24 } },
          h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 10 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#3a3024" } }, "谁坐对面"),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#8a7a5e" } }, cur ? cur.name + " 入座" : "还没有人")),
          chars.length
            ? h("div", { className: "flex", style: { gap: 10, overflowX: "auto", paddingBottom: 4 } }, chars.map(seat))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#8a7a5e" } }, "先去『人格档案馆』建个角色，再来共桌。")),
        cur ? h("button", { onClick: () => { setupScroll.current = setupScroller.current ? setupScroller.current.scrollTop : 0; setView("video"); }, "data-pomodoro-video-entry": "", "data-wk": "pomvideoentry", style: { width: "100%", minHeight: 48, marginTop: 14, padding: "12px 14px", textAlign: "left", border: "1px solid rgba(90,72,44,.28)", borderRadius: 3, background: "#fffdf6", color: "#3a3024", fontFamily: F_BODY, fontSize: 12 } }, VideoApi.media(cur.id) ? "动态陪伴图 · 已选好，换一段或导出" : "动态陪伴图 · 上传 / 生图，让它动起来") : null,
        // ④ 怎么陪：三张摊在桌上的小卡
        h("div", { style: { marginTop: 22 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#3a3024", marginBottom: 10 } }, "怎么陪"),
          h("div", { className: "flex", style: { gap: 8 } },
            [{ id: "quiet", name: "安静", desc: "轻戳才回应，平时安静陪你" },
             { id: "notes", name: "递纸条", desc: "节点递纸条，轻戳也有回应" },
             { id: "checkpoints", name: "报时", desc: "节点提醒，轻戳看当前进度" }].map(modeCard))),
        h("button", { onClick: start, disabled: busy || !cur, className: "w-full active:opacity-80 disabled:opacity-40",
          style: { marginTop: 24, background: t.ink, color: t.bg2, border: "none", borderRadius: 3,
            padding: "15px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: F_BODY, fontSize: 13, boxShadow: "0 8px 18px rgba(60,45,25,.22)" } },
          h("span", null, busy ? (cur ? cur.name + " 正在摆好纸条…" : "准备中…") : "坐下，上发条"),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16 } }, busy ? "···" : "→"))));
  }

  window.PomodoroLogic = { remainingSec, focusedSec, resumeSession, noteIndex, companionSubtitle };
  window.Pomodoro = Pomodoro;
})();
