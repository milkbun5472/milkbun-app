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

  function fallbackPack(task) {
    return {
      notes: ["你做你的，我就在对面。", "走到一半了，先别抬头。", "快收尾了，把这一小段做好。"],
      done: "这张桌子没白坐，" + task + "被你好好推进了一截。",
      left: "先收桌也没关系，回来时我们从这里接上。",
      pause: "去处理吧，位置给你留着。"
    };
  }

  async function genPack(active, ctx) {
    const { charName, persona, mood, uName, task, min, mode, chatRef, worldbook } = ctx;
    const sys = AC() +
      "你是「" + charName + "」，正和 " + uName + " 在一张桌子两边专注。Ta 这轮只做：「" + task + "」，时长 " + min + " 分钟；陪伴方式是「" + (modeLabels[mode] || modeLabels.notes) + "」。你不是监督员，也不要把专注写成服从测试。\n" +
      "【你的人设】" + (persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 400) + (mood ? "\n【你此刻心情】" + mood : "") +
      (chatRef ? "\n【最近聊天（只用来还原关系与口吻）】\n" + chatRef : "") +
      (worldbook && worldbook.trim() ? "\n【世界书（仅参考）】\n" + worldbook.trim().slice(0, 300) : "") +
      "\n\n请写四类很短的文本，像对座的人在便签上随手写的，不要客服腔、鸡汤、训话或报菜名：\n" +
      "· notes：恰好 3 句，分别用于刚坐下、走到半程、快收尾。每句最多 24 字，彼此不能同义。安静同桌模式尤其克制。\n" +
      "· done：Ta 做完后的一句批注，承认具体投入，不夸张。\n" +
      "· left：Ta 提前收桌时的一句批注，不羞辱、不撒娇阻拦，允许以后接上。\n" +
      "· pause：Ta 暂停时的一句留座话。\n" +
      "【输出】只输出 JSON，不要代码块：{\"notes\":[\"..\",\"..\",\"..\"],\"done\":\"..\",\"left\":\"..\",\"pause\":\"..\"}";
    const raw = await callAI(active, sys, [{ role: "user", content: "把纸条放到桌上吧。" }], { maxTokens: 9800 });
    const p = extractJSON(raw) || {};
    const fb = fallbackPack(task);
    const str = (v, d) => { const s = v != null ? String(v).trim() : ""; return s && s.toLowerCase() !== "null" ? s : d; };
    const notes = Array.isArray(p.notes) ? p.notes.filter(Boolean).slice(0, 3).map(x => String(x).trim()) : [];
    while (notes.length < 3) notes.push(fb.notes[notes.length]);
    return { notes, done: str(p.done, fb.done), left: str(p.left, fb.left), pause: str(p.pause, fb.pause) };
  }

  function minutesText(v) {
    const n = Number(v || 0);
    return (Math.round(n * 10) / 10).toString() + " 分钟";
  }

  // 结局统计卡（结果页 + 往期回看共用；兼容旧版记录字段）
  function ResultCard(t, rec, char, onClose, tp) {
    const row = (k, v, tone) => h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "11px 0", borderBottom: "1px dashed " + t.line } },
      h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, k),
      h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: tone || t.ink, fontWeight: 600, textAlign: "right" } }, v));
    const isDone = rec.status === "done";
    return h("div", { onClick: onClose, style: { position: "absolute", inset: 0, zIndex: 60, background: "rgba(20,18,15,0.58)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "24px 18px calc(env(safe-area-inset-bottom) * 0.4 + 18px)" } },
      h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", maxWidth: 390, background: t.bg2, border: "1px solid " + t.line, borderRadius: 18, padding: "20px 20px 22px", animation: "fadeUp .2s ease both", maxHeight: "82%", overflowY: "auto" } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 } },
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.18em", color: t.fog } }, "FOCUS LOG"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, color: t.ink, marginTop: 4 } }, isDone ? "一起坐住了" : "这一轮先收桌")),
          h("button", { onClick: onClose, className: "active:opacity-60", style: { width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none" } }, h(IX, { size: 20, color: t.fog }))),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, padding: "14px 0 4px", borderTop: "1px solid " + t.line } }, rec.task),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 5 } }, fmtDate(rec.ts) + " · 对座 " + (rec.charName || (char && char.name) || "")),
        h("div", { style: { background: t.bg, border: "1px solid " + t.line, padding: "3px 15px", margin: "18px 0" } },
          row("计划时长", minutesText(rec.minutes)),
          row("实际专注", minutesText(rec.focusedMinutes != null ? rec.focusedMinutes : rec.minutes)),
          rec.pauseCount != null ? row("暂停次数", String(rec.pauseCount || 0)) : null,
          rec.interruptReason ? row("收桌原因", rec.interruptReason) : null,
          rec.escapes != null ? row("旧版 · 退出尝试", String(rec.escapes || 0), rec.escapes ? "#a8433a" : t.ink) : null,
          rec.wrong != null ? h("div", { style: { display: "flex", justifyContent: "space-between", padding: "11px 0" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "旧版 · 暗号输错"),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: rec.wrong ? "#a8433a" : t.ink, fontWeight: 600 } }, String(rec.wrong || 0))) : null),
        rec.annotation ? h("div", { style: { padding: "2px 4px 0" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 19, lineHeight: 1.65, color: t.ink } }, "“" + rec.annotation + "”"),
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 10 } },
            (tp && char && typeof TtsDot === "function") ? h(TtsDot, { k: "pmd" + rec.id, text: rec.annotation, spk: char, tp }) : null,
            h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "— " + (rec.charName || (char && char.name) || "")))) : null));
  }

  // ── 发条计时盘（v61.39，她 2026-09-03：「番茄钟的页面还是无聊」）──
  // 原来那一页是「一排横线分节的表单：输入框 + 一排头像 + 四颗药丸 + 三个单选点」。
  // 按她立的判据（换个 app 还成立吗）——那套东西搬到任何一个 app 上都成立，就是写坏了。
  // 番茄钟在现实里是【一个上发条的厨房定时器】：一圈刻度、一根指针、拧到几分就走几分。
  // 那是别的功能拿不走的形状，所以时长这一栏就做成那个盘，不是四颗药丸。
  //
  // ⚠️盘面按【60 分钟一圈】画：这样 25 分就真的落在四分之一多一点的位置，
  //   刻度和数字对得上真实的钟面。超过 60 的自定义值转满一圈就停在 60（指针不绕第二圈，
  //   绕了反而读不出来），但值本身照旧是她填的那个数。
  const DIAL_MAX = 60;
  function Dial({ t, min, onPick, size }) {
    const S = size || 216, R = S / 2, r = R - 16;
    const val = Math.max(0, Math.min(DIAL_MAX, Number(min) || 0));
    const ang = (val / DIAL_MAX) * 360;
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
      onPick(Math.max(1, Math.round(deg / 360 * DIAL_MAX)));
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
    return h("svg", { width: S, height: S, viewBox: "0 0 " + S + " " + S,
      onPointerDown: pick, onPointerMove: e => { if (e.buttons === 1) pick(e); },
      style: { touchAction: "none", cursor: onPick ? "pointer" : "default", display: "block" } },
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
    const [saves, setSaves] = useState(loadSaves);
    const [detail, setDetail] = useState(null);
    const [charId, setCharId] = useState(chars[0] ? chars[0].id : "");
    const [task, setTask] = useState("一起看书");
    const [min, setMin] = useState(25);
    const [mode, setMode] = useState("notes");
    const [busy, setBusy] = useState(false);
    const [sess, setSess] = useState(null);
    const sessRef = useRef(null);
    const [left, setLeft] = useState(0);
    const [endOpen, setEndOpen] = useState(false);
    const [result, setResult] = useState(null);
    const [resumed, setResumed] = useState(false);
    const didRestore = useRef(false);
    const timerRef = useRef(null);
    const charOf = id => chars.find(c => c.id === id);
    const moodOf = id => { const mo = props.moods && props.moods[id]; return mo && mo.label ? String(mo.label) : ""; };
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null;
    sessRef.current = sess;

    const keepSession = next => { sessRef.current = next; setSess(next); persistSession(next); };

    const finish = (status, reason) => {
      if (timerRef.current) clearInterval(timerRef.current);
      const s = sessRef.current;
      if (!s) return;
      const actual = Math.round((focusedSec(s, Date.now()) / 60) * 10) / 10;
      const rec = {
        id: uid(), charId: s.char.id, charName: s.char.name, task: s.task, minutes: s.min,
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
      setCharId(c.id); setTask(restored.task || "专注"); setMin(restored.min || 25); setMode(restored.mode || "notes");
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
          : fallbackPack(task.trim() || "专注");
      } catch (_) { pack = fallbackPack(task.trim() || "专注"); }
      const now = Date.now();
      const next = { char: c, charId: c.id, pack, min: duration, task: task.trim() || "专注", mode, startTs: now, endTs: now + duration * 60000, pausedAt: null, pauseCount: 0 };
      keepSession(next); setLeft(duration * 60); setBusy(false); setResumed(false); setView("focus");
    };

    const togglePause = () => {
      const s = sessRef.current; if (!s) return;
      const now = Date.now();
      if (s.pausedAt) keepSession(resumeSession(s, now));
      else keepSession({ ...s, pausedAt: now, pauseCount: (s.pauseCount || 0) + 1 });
    };

    if (view === "result" && result) {
      return h("div", { className: "h-full", style: { position: "relative", background: t.bg } },
        h("div", { className: "h-full flex flex-col items-center justify-center", style: { opacity: 0.16 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: "0.25em", color: t.fog } }, "DESK CLEARED"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 58, color: t.ink, marginTop: 12 } }, result.rec.status === "done" ? "✓" : "—")),
        ResultCard(t, result.rec, result.char, () => { setResult(null); setSess(null); sessRef.current = null; setView("setup"); }, tp));
    }

    if (view === "archive") {
      const archiveRight = h("div", { style: { minWidth: 32, textAlign: "right", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, saves.length);
      return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
        h(Head, { zh: "专注记录", en: "FOCUS LOG", onBack: () => setView("setup"), right: archiveRight }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
          saves.length === 0
            ? h("div", { style: { borderTop: "1px solid " + t.line, padding: "48px 0", fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "桌上还没有留下记录。")
            : saves.map((r, i) => h("button", { key: r.id, onClick: () => setDetail(r), className: "w-full text-left active:opacity-70", style: { background: "transparent", border: "none", borderTop: "1px solid " + t.line, padding: "17px 0", display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 10, alignItems: "start" } },
                h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, paddingTop: 3 } }, pad2(i + 1)),
                h("span", null,
                  h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, lineHeight: 1.35 } }, r.task),
                  h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 5 } }, fmtDate(r.ts) + " · " + r.charName + " · " + minutesText(r.focusedMinutes != null ? r.focusedMinutes : r.minutes))),
                h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: r.status === "done" ? "#52705b" : t.fog, paddingTop: 3 } }, r.status === "done" ? "完成" : "收桌")))),
        detail ? ResultCard(t, detail, charOf(detail.charId), () => setDetail(null), tp) : null);
    }

    if (view === "focus" && sess) {
      const c = sess.char;
      const idx = noteIndex(sess, left);
      const line = (sess.pack.notes && sess.pack.notes[idx]) || fallbackPack(sess.task).notes[idx];
      const progress = Math.max(0, Math.min(1, 1 - left / Math.max(1, sess.min * 60)));
      const bg = c.avatarImage
        ? { backgroundImage: "url(\"" + c.avatarImage + "\")", backgroundSize: "cover", backgroundPosition: "center" }
        : { background: "linear-gradient(160deg," + (c.color || "#3a3a3a") + ",#14140f)" };
      return h("div", { className: "h-full", style: { position: "relative", ...bg, overflow: "hidden" } },
        h("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(9,10,12,0.6),rgba(9,10,12,0.18) 43%,rgba(9,10,12,0.82))" } }),
        h("div", { style: { position: "absolute", top: "calc(env(safe-area-inset-top) + 18px)", left: 20, right: 18, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 } },
          h("div", null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.2em", color: "rgba(255,255,255,0.72)" } }, sess.pausedAt ? "SEAT RESERVED" : "FOCUS DESK"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#fff", marginTop: 3 } }, c.name + " 在对面")),
          h("button", { onClick: () => setEndOpen(true), className: "active:opacity-65", style: { minWidth: 52, height: 40, padding: "0 12px", background: "rgba(0,0,0,0.32)", border: "1px solid rgba(255,255,255,0.36)", color: "#fff", fontFamily: F_BODY, fontSize: 12 } }, "收桌")),
        h("div", { style: { position: "absolute", top: "calc(env(safe-area-inset-top) + 102px)", left: 22, right: 22, zIndex: 4 } },
          resumed ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.12em", color: "rgba(255,255,255,0.68)", marginBottom: 12 } }, "已接回刚才那一轮") : null,
          h("div", { key: idx + (sess.pausedAt ? "p" : "r"), style: { width: "min(100%, 310px)", background: "rgba(249,247,241,0.9)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 10px 30px rgba(0,0,0,0.18)", padding: "17px 18px", animation: "fadeUp .35s ease both" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: "0.18em", color: "#827e75", marginBottom: 9 } }, sess.pausedAt ? "留座纸条" : "桌边纸条 · " + pad2(idx + 1)),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, lineHeight: 1.55, color: "#24221e" } }, sess.pausedAt ? sess.pack.pause : line))),
        h("div", { style: { position: "absolute", left: 22, right: 22, bottom: "calc(env(safe-area-inset-bottom) * 0.4 + 30px)", zIndex: 4 } },
          h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14 } },
            h("div", null,
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 66, lineHeight: 0.95, color: "#fff", textShadow: "0 2px 15px rgba(0,0,0,0.5)" } }, fmtClock(left)),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,0.72)", marginTop: 10 } }, sess.task + (sess.pausedAt ? " · 已暂停" : ""))),
            // 进度做成【发条正在往回松】的一圈，跟摆桌那一页的计时盘是同一个东西；
            // 原来是底下一条 2px 的横线——那条线搬到任何 app 上都成立。
            h("div", { style: { position: "relative", width: 66, height: 66, flexShrink: 0 } },
              (function () {
                const RR = 30, C = 2 * Math.PI * RR;
                return h("svg", { width: 66, height: 66, viewBox: "0 0 66 66",
                  style: { position: "absolute", inset: 0, transform: "rotate(-90deg)", pointerEvents: "none" } },
                  h("circle", { cx: 33, cy: 33, r: RR, fill: "none", stroke: "rgba(255,255,255,.26)", strokeWidth: 2 }),
                  h("circle", { cx: 33, cy: 33, r: RR, fill: "none", stroke: "rgba(255,255,255,.92)", strokeWidth: 2,
                    strokeLinecap: "round", strokeDasharray: C,
                    // 剩下多少就画多少：走完这一圈就空了，跟真发条一样往回松
                    strokeDashoffset: (C * progress).toFixed(2),
                    style: { transition: "stroke-dashoffset .5s linear" } }));
              })(),
              h("button", { onClick: togglePause, className: "active:opacity-70", style: { position: "absolute", left: 4, top: 4, width: 58, height: 58, borderRadius: 999, background: "rgba(248,246,239,0.92)", border: "1px solid rgba(255,255,255,0.7)", color: "#24221e", fontFamily: F_BODY, fontSize: 12 } }, sess.pausedAt ? "继续" : "暂停")))),
        endOpen ? h("div", { onClick: () => setEndOpen(false), style: { position: "absolute", inset: 0, zIndex: 20, background: "rgba(10,10,12,0.58)", display: "flex", alignItems: "flex-end", padding: "20px 18px calc(env(safe-area-inset-bottom) * 0.4 + 18px)" } },
          h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: "#f5f2eb", border: "1px solid rgba(255,255,255,0.55)", padding: "21px 20px 18px", animation: "fadeUp .2s ease both" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.18em", color: "#8a857c" } }, "CLEAR THE DESK"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: "#24221e", marginTop: 7 } }, "这一轮要先收到这里吗？"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#716d65", lineHeight: 1.6, marginTop: 8 } }, "已经坐住的时间会照常留下。选一个原因，方便以后看懂自己的节奏。"),
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 } },
              ["临时有事", "状态不对", "任务已完成", "今天先到这里"].map(reason => h("button", { key: reason, onClick: () => finish("left", reason), className: "active:opacity-70", style: { background: "transparent", border: "1px solid #cdc8bd", padding: "12px 8px", fontFamily: F_BODY, fontSize: 12.5, color: "#34312c" } }, reason))),
            h("button", { onClick: () => setEndOpen(false), className: "w-full active:opacity-70", style: { marginTop: 10, background: "#24221e", color: "#f5f2eb", border: "none", padding: "13px 0", fontFamily: F_BODY, fontSize: 13 } }, "继续这一轮"))) : null);
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
      h(Head, { zh: "番茄钟", en: "FOCUS DESK", onBack: props.onBack, right: archiveRight, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        // ① 桌上那张便签：这一轮只做的一件事。写在纸上，不是写在一个输入框里。
        h("div", { style: { position: "relative", background: "#fdf6d8", padding: "16px 16px 18px",
          borderRadius: 2, boxShadow: "0 8px 20px rgba(80,60,25,.18)", transform: "rotate(-.7deg)", marginTop: 4 } },
          // 一段胶带把它粘在桌上
          h("div", { "aria-hidden": "true", style: { position: "absolute", top: -10, left: "50%", width: 76, height: 20,
            transform: "translateX(-56%) rotate(-2.6deg)", background: "rgba(226,214,186,.66)",
            borderLeft: "1px dashed rgba(255,255,255,.55)", borderRight: "1px dashed rgba(255,255,255,.55)" } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, letterSpacing: ".2em", color: "#a3925f" } }, "ONE THING"),
          h("input", { value: task, onChange: e => setTask(e.target.value), placeholder: "这一轮只做…", maxLength: 24,
            style: { width: "100%", fontFamily: F_DISPLAY, fontSize: 21, color: "#3a3024", background: "transparent",
              border: "none", borderBottom: "1px solid rgba(140,116,60,.28)", outline: "none", padding: "9px 0 7px", marginTop: 8 } })),
        // ② 发条计时盘：拧到几分就走几分
        h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 22 } },
          h(Dial, { t: t, min: min, size: 200, onPick: v => setMin(v) }),
          h("div", { className: "flex items-baseline", style: { gap: 6, marginTop: 10 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: t.ink, lineHeight: 1 } }, String(Number(min) || 0)),
            h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "分钟")),
          h("div", { className: "flex flex-wrap items-center justify-center", style: { gap: 7, marginTop: 12 } },
            [15, 25, 45, 60].map(p2 => h("button", { key: p2, onClick: () => setMin(p2), className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 11.5, minHeight: 34, padding: "0 13px", borderRadius: 999,
                color: Number(min) === p2 ? t.bg2 : "#6b5b3e", background: Number(min) === p2 ? t.ink : "transparent",
                border: "1px solid " + (Number(min) === p2 ? t.ink : "rgba(90,72,44,.28)") } }, p2 + " 分")),
            h("input", { value: String(min), onChange: e => setMin(e.target.value.replace(/[^0-9]/g, "").slice(0, 3)),
              inputMode: "numeric", "aria-label": "自定分钟",
              style: { width: 52, fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, background: "transparent",
                border: "none", borderBottom: "1px solid rgba(90,72,44,.4)", outline: "none", textAlign: "center", padding: "5px 0" } }))),
        // ③ 对面的座位
        h("div", { style: { marginTop: 24 } },
          h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 10 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#3a3024" } }, "谁坐对面"),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#8a7a5e" } }, cur ? cur.name + " 入座" : "还没有人")),
          chars.length
            ? h("div", { className: "flex", style: { gap: 10, overflowX: "auto", paddingBottom: 4 } }, chars.map(seat))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#8a7a5e" } }, "先去『人格档案馆』建个角色，再来共桌。")),
        // ④ 怎么陪：三张摊在桌上的小卡
        h("div", { style: { marginTop: 22 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#3a3024", marginBottom: 10 } }, "怎么陪"),
          h("div", { className: "flex", style: { gap: 8 } },
            [{ id: "quiet", name: "安静", desc: "开场一张纸条，之后不打扰" },
             { id: "notes", name: "递纸条", desc: "半程和收尾各换一张" },
             { id: "checkpoints", name: "报时", desc: "到节点提醒你看一眼" }].map(modeCard))),
        h("button", { onClick: start, disabled: busy || !cur, className: "w-full active:opacity-80 disabled:opacity-40",
          style: { marginTop: 24, background: t.ink, color: t.bg2, border: "none", borderRadius: 3,
            padding: "15px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: F_BODY, fontSize: 13, boxShadow: "0 8px 18px rgba(60,45,25,.22)" } },
          h("span", null, busy ? (cur ? cur.name + " 正在摆好纸条…" : "准备中…") : "坐下，上发条"),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16 } }, busy ? "···" : "→"))));
  }

  window.PomodoroLogic = { remainingSec, focusedSec, resumeSession, noteIndex };
  window.Pomodoro = Pomodoro;
})();
