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
            h("button", { onClick: togglePause, className: "active:opacity-70", style: { width: 58, height: 58, borderRadius: 999, background: "rgba(248,246,239,0.92)", border: "1px solid rgba(255,255,255,0.7)", color: "#24221e", fontFamily: F_BODY, fontSize: 12, flexShrink: 0 } }, sess.pausedAt ? "继续" : "暂停")),
          h("div", { style: { height: 2, background: "rgba(255,255,255,0.25)", marginTop: 22, position: "relative" } },
            h("div", { style: { position: "absolute", inset: "0 auto 0 0", width: (progress * 100).toFixed(2) + "%", background: "rgba(255,255,255,0.92)", transition: "width .5s linear" } }))),
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
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "番茄钟", en: "FOCUS DESK", onBack: props.onBack, right: archiveRight }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
        h("section", { style: { borderTop: "1px solid " + t.line, borderBottom: "1px solid " + t.line, padding: "18px 0 20px" } },
          h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 } },
            h("div", null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: "0.16em", color: t.fog } }, "这一轮的桌面"),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 28, color: t.ink, marginTop: 6 } }, "只留一件事")),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 31, color: t.ink } }, pad2(Number(min) || 0) + "′")),
          h("input", { value: task, onChange: e => setTask(e.target.value), placeholder: "例如：读完这一章", maxLength: 24,
            style: { width: "100%", fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, background: t.bg2, border: "1px solid " + t.line, outline: "none", padding: "14px 15px", marginTop: 17 } })),
        h("section", { style: { padding: "20px 0 18px", borderBottom: "1px solid " + t.line } },
          h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, "谁坐在对面"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, cur ? cur.name : "还没有人")),
          chars.length ? h("div", { style: { display: "flex", gap: 13, overflowX: "auto", paddingTop: 15 } },
            chars.map(c => { const on = charId === c.id; return h("button", { key: c.id, onClick: () => setCharId(c.id), className: "active:opacity-70", style: { flexShrink: 0, width: 58, textAlign: "center", background: "transparent", border: "none" } },
              h("div", { style: { padding: 2, border: "1px solid " + (on ? t.ink : "transparent") } }, h(Avatar, { character: c, size: 48, radius: 0 })),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: on ? t.ink : t.fog, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.name)); }))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, padding: "18px 0 4px" } }, "先去『人格档案馆』建个角色，再来共桌。")),
        h("section", { style: { padding: "20px 0 18px", borderBottom: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, "坐多久"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginTop: 13 } },
            [15, 25, 45, 60].map(p => h("button", { key: p, onClick: () => setMin(p), className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: Number(min) === p ? t.bg : t.sub, background: Number(min) === p ? t.ink : "transparent", border: "1px solid " + (Number(min) === p ? t.ink : t.line), padding: "11px 0" } }, p + " 分"))),
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 12 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "自定"),
            h("input", { value: String(min), onChange: e => setMin(e.target.value.replace(/[^0-9]/g, "").slice(0, 3)), inputMode: "numeric", style: { width: 62, fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, background: "transparent", border: "none", borderBottom: "1px solid " + t.ink, outline: "none", textAlign: "center", padding: "5px 0" } }),
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "分钟"))),
        h("section", { style: { padding: "20px 0 22px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, "怎么陪"),
          h("div", { style: { marginTop: 11 } },
            [{ id: "quiet", name: "安静同桌", desc: "开场留一张纸条，之后不打扰" }, { id: "notes", name: "偶尔递纸条", desc: "半程和收尾各换一张" }, { id: "checkpoints", name: "节点提醒", desc: "在关键进度提醒你看一眼时间" }].map(x => h("button", { key: x.id, onClick: () => setMode(x.id), className: "w-full text-left active:opacity-70", style: { display: "grid", gridTemplateColumns: "18px 1fr", gap: 10, background: "transparent", border: "none", borderTop: "1px solid " + t.line, padding: "12px 0" } },
              h("span", { style: { width: 11, height: 11, borderRadius: 999, border: "1px solid " + t.ink, background: mode === x.id ? t.ink : "transparent", marginTop: 4 } }),
              h("span", null,
                h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 13, color: t.ink } }, x.name),
                h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 3 } }, x.desc))))),
          h("button", { onClick: start, disabled: busy || !cur, className: "w-full active:opacity-80 disabled:opacity-40", style: { marginTop: 18, background: t.ink, color: t.bg, border: "none", padding: "15px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: F_BODY, fontSize: 13 } },
            h("span", null, busy ? (cur ? cur.name + " 正在摆好纸条…" : "准备中…") : "坐下，开始这一轮"),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16 } }, busy ? "···" : "→")))));
  }

  window.PomodoroLogic = { remainingSec, focusedSec, resumeSession, noteIndex };
  window.Pomodoro = Pomodoro;
})();
