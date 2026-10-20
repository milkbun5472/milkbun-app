// 番茄钟的开机那半（2026-10-18 瘦身第八批，从 js/pomodoro.js 拆出来）：聊天里那张番茄钟卡（PomoShareCard）和纯逻辑（PomodoroLogic）开机就要；
//   番茄钟整页在 js/pomodoro.js，点进去才加载（js/lazy-mods.js）。
// ============================================================
// 番茄钟 · 共桌专注（pomodoro）—— 独立小 app
// 玩法：选一个角色坐到对面，写下这轮只做的一件事，再决定 Ta 怎么陪。
// 开始时只调用一次 AI，预先生成开场、半程与收尾三张「桌边纸条」和结局批注；
// 专注中不自动请求模型；主动点「再说几句」才补一组新话，语音逐句按需播放。
//
// 计时以墙上时间 endTs 为准，并把当前场次存进 x_pomodoro_active：
// 切后台、退出页面或重开 app 后都会按真实经过时间恢复。可以暂停，也可以随时正常收桌。
// 往期记录存 x_pomodoro_saves（随云同步）；旧版逃跑/暗号记录仍可回看。
// ============================================================
(function () {
  const focusCategories = { reading: "阅读", study: "学习", work: "工作", create: "创作", other: "其他" };
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  // 禁烟这一层（她 2026-09-05：「你看看还有哪儿没禁烟的」）。
  // ⚠️它是【世界事实】，不是文风：这个 app 里没人抽烟，那在哪一处都得成立。
  //   原来它只挂在 buildBundle / groupBans 上，于是【凡是自己拼 sys 的地方一律没有】。
  //   不许塞进 ANTI_CLICHE 搭便车（v55.90 那条：能独立成立的规则就让它独立成立，
  //   挂在别人身上，别人不发的那一轮它就跟着消失）。
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");
  const pad2 = n => String(n).padStart(2, "0");
  const fmtClock = s => pad2(Math.floor(Math.max(0, s) / 60)) + ":" + pad2(Math.max(0, s) % 60);
  const modeLabels = { quiet: "安静同桌", notes: "偶尔递纸条", checkpoints: "节点提醒" };

  function remainingSec(s, now) {
    if (!s || !s.endTs) return 0;
    const at = s.pausedAt || now || Date.now();
    return Math.max(0, Math.ceil((s.endTs - at) / 1000));
  }

  // 三种计时（她 2026-10-07「都做了吧」）：down 倒计时（原来那种）、up 正计时（不设时长，想停就停）、
  //   cycle 循环番茄（专注 min 分 → 休息 → 下一轮，每 CYCLE_LONG_EVERY 轮长休一次）。
  //   正计时也照样走 endTs 那一套（封顶 UP_CAP 分钟），暂停/恢复/重开 app 都不用另写一份。
  const UP_CAP = 24 * 60, CYCLE_BREAK = 5, CYCLE_LONG = 15, CYCLE_LONG_EVERY = 4;
  function focusedSec(s, now) {
    if (!s) return 0;
    const inPhase = s.kind === "cycle" && s.phase === "break" ? 0 : Math.max(0, Number(s.min || 0) * 60 - remainingSec(s, now || Date.now()));
    return (s.kind === "cycle" ? Number(s.doneFocusSec || 0) : 0) + inPhase;
  }
  // 循环番茄走完一段：专注完→休息（第 4、8… 轮长休），休息完→下一轮专注
  function nextCyclePhase(s, now) {
    const t = now || Date.now();
    if (s.phase === "break") return { ...s, phase: "focus", round: (s.round || 1) + 1, endTs: t + Number(s.min) * 60000, pausedAt: null };
    const brk = (s.round || 1) % CYCLE_LONG_EVERY === 0 ? CYCLE_LONG : CYCLE_BREAK;
    return { ...s, phase: "break", doneFocusSec: Number(s.doneFocusSec || 0) + Number(s.min) * 60, rounds: (s.rounds || 0) + 1, endTs: t + brk * 60000, breakMin: brk, pausedAt: null };
  }

  function resumeSession(s, now) {
    if (!s || !s.pausedAt) return s;
    const at = now || Date.now();
    return { ...s, endTs: s.endTs + Math.max(0, at - s.pausedAt), pausedAt: null };
  }

  function noteIndex(s, left) {
    if (!s || !s.pack || s.mode === "quiet") return 0;
    if (s.kind === "up") { const m = focusedSec(s) / 60; return m >= 40 ? 2 : m >= 15 ? 1 : 0; }
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
      pause: "去处理吧，位置给你留着。",
      brk: "起来走两步，喝口水。", back: "好，接着来下一轮。", caught: "刚刚跑哪去了？",
      his: "", hisDone: "", goalYes: "做完了就好，这一轮没白坐。", goalNo: "没做完也没关系，下次从这儿接。"
    };
  }

  function companionSubtitle(s, left, turn, kind) {
    const fb = fallbackPack(s.task, s.mode), pack = s.pack || fb, idx = noteIndex(s, left);
    const node = (pack.notes && pack.notes[idx]) || fb.notes[idx];
    const lines = tapChoices(s), picked = lines[(turn || 0) % lines.length];
    const onBreak = s.kind === "cycle" && s.phase === "break";
    const text = s.pausedAt ? (pack.pause || fb.pause) : onBreak && kind !== "tap" ? (pack.brk || fb.brk) : kind === "tap" ? picked.text : node;
    const label = s.pausedAt ? "位置给你留着" : onBreak && kind !== "tap" ? "休息一下" : s.mode === "checkpoints"
      ? "已专注 " + fmtClock(focusedSec(s, s.endTs - left * 1000)) + " · 还剩 " + fmtClock(left)
      : s.mode === "notes" ? "递给你的小纸条" : kind === "tap" ? "轻轻回应你" : "一起安静坐一会儿";
    return { text, label, key: (s.pausedAt ? "pause" : onBreak && kind !== "tap" ? "brk-" + (s.round || 1) : kind === "tap" ? picked.key : "note-" + idx), extraId: !s.pausedAt && kind === "tap" ? picked.extraId : undefined };
  }

  async function requestCompanionText(active, ctx, instruction, schemaHint) {
    const bundle = ctx.bundle || { char: { name: ctx.charName, persona: ctx.persona }, profile: { name: ctx.uName }, moodLabel: ctx.mood, worldbook: ctx.worldbook, recentChat: ctx.chatRef };
    // 开场和手动续句共用角色上下文；一次输出不写回聊天、记忆或关系。
    if (typeof runProbe === "function") return runProbe(active, bundle, {
      voice: true, voiceScene: true, once: true, tag: "番茄钟", maxTokens: 65000,
      instruction: instruction + (typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? "\n" + REGISTER_FOLLOWS_SCENE : "") + (typeof ECHO_QUESTION_BAN !== "undefined" ? "\n" + ECHO_QUESTION_BAN : ""), schemaHint
    });
    const raw = await callAI(active, AC() + CB() + "【人设】" + (ctx.persona || "") + "\n【最近聊天】" + (ctx.chatRef || "") + "\n【世界书】" + (ctx.worldbook || "") + "\n" + instruction + "\n【输出】" + schemaHint, [{ role: "user", content: "开始。" }], { maxTokens: 65000, tag: "番茄钟" });
    const result = extractJSON(raw);
    if (!result) throw new Error("没有读懂这次回应：" + String(raw || "").slice(0, 300));
    return result;
  }

  function tapChoices(s) {
    const taps = s.pack && Array.isArray(s.pack.taps) ? s.pack.taps.filter(x => typeof x === "string" && x.trim()) : [];
    return (taps.length ? taps : fallbackPack(s.task, s.mode).taps).map((text, i) => ({ text, key: "tap-" + i }))
      .concat((s.extraLines || []).filter(x => x && typeof x.text === "string" && x.text.trim()).map(x => ({ text: x.text, key: "extra-" + x.id, extraId: x.id })));
  }

  function existingCompanionLines(s) {
    const pack = s.pack || {};
    return [].concat(pack.notes || [], pack.taps || [], [pack.pause, pack.done, pack.left], (s.extraLines || []).map(x => x.text)).filter(x => typeof x === "string" && x.trim());
  }

  function uniqueCompanionLines(value, existing) {
    const key = text => text.replace(/[\s\p{P}]/gu, "").toLowerCase();
    const seen = new Set((existing || []).map(key)), result = [];
    for (const text of Array.isArray(value) ? value : []) {
      if (typeof text !== "string" || !text.trim()) continue;
      const clean = text.trim(), k = key(clean);
      if (!k || seen.has(k)) continue;
      seen.add(k); result.push(clean);
      if (result.length === 8) break;
    }
    return result;
  }

  async function genMore(active, ctx, session, now) {
    const left = remainingSec(session, now), elapsed = focusedSec(session, now), old = existingCompanionLines(session);
    const p = await requestCompanionText(active, ctx,
      "你在陪 " + ctx.uName + " 专注。Ta 主动点了「再说几句」，请补 6 句可独立点播的陪伴话。\n"
      + "【这一轮】任务：" + session.task + "；专注类别：" + (focusCategories[session.category] || (session.curId ? "学习" : "未指定")) + "；课程：" + (ctx.course || "未关联")
      + "；陪伴模式：" + (modeLabels[session.mode] || modeLabels.notes) + "；计划 " + session.min + " 分钟；已经专注 " + fmtClock(elapsed) + "；准确剩余 " + fmtClock(left) + "；现在" + (session.pausedAt ? "已暂停，时间冻结" : "仍在计时") + "。\n"
      + "【已有内容】这些是已准备的纸条与回应，包含尚未播放和结束时才用的句子，仅供衔接和避免重复，不能据此声称任务已经完成：\n" + JSON.stringify(old)
      + "\n根据你自己的性格、当前关系与最近聊天，说此刻真正想说的几句；句子长短跟人设走，每句可以有一至三句话，以适合专注时短暂听一段为准。具体任务是当前唯一确定在做的事，类别只帮你拿捏节奏，不替Ta编造完成成果。时间是请求这一刻的快照，生成和点播期间计时仍会继续，避免把这组句子都绑成同一秒的报时。延续已有内容但带来新信息，换词复述也算重复。只写可念出的台词，视频是独立的循环肖像。",
      "{\"lines\":[\"独立可点播的陪伴话\"]}");
    const lines = uniqueCompanionLines(p.lines, old);
    if (!lines.length) throw new Error("这次没有取到新的回应。返回内容：" + JSON.stringify(p).slice(0, 300));
    return lines;
  }

  function minutesText(v) {
    const n = Number(v || 0);
    return (Math.round(n * 10) / 10).toString() + " 分钟";
  }

  window.PomodoroLogic = { remainingSec, focusedSec, resumeSession, noteIndex, companionSubtitle, uniqueCompanionLines, genMore, nextCyclePhase };
  // 私聊里那张「一起专注」小卡（群里 2026-10-05：「一起番茄时钟后，能不能返回 char 的私聊给一个交互的小卡片」）。
  //   点一下翻开：做的什么、停了几次、戳了几次；再点收回去。外框和别的分享卡同一张表（components.js shareCardOf）。
  function PomoShareCard({ m }) {
    const t = useTheme(), r = (m && m.pomo) || {};
    const [open, setOpen] = React.useState(false);
    const done = r.status === "done";
    const row = (k, v) => h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, marginTop: 4, gap: 10 } },
      h("span", { style: { color: t.fog } }, k), h("span", { style: { textAlign: "right" } }, v));
    return h("button", { "data-wk": "pomoshare", "data-done": done ? "1" : "0", onClick: () => setOpen(v => !v), className: "active:opacity-90",
      style: { width: 230, textAlign: "left", borderRadius: 14, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 3px 10px rgba(40,30,20,.08)", padding: 0 } },
      h("div", { style: { padding: "10px 12px 11px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: 2, color: t.fog } }, "一起专注 · " + (done ? "坐住了" : "先收桌")),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.ink, marginTop: 3 } }, minutesText(r.focusedMinutes != null ? r.focusedMinutes : r.minutes)),
        r.annotation ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, color: t.ink, marginTop: 6 } }, r.annotation) : null,
        open ? h("div", { style: { marginTop: 8, paddingTop: 6, borderTop: "1px dashed " + t.line } },
          r.task ? row("做的事", r.task) : null,
          row("停下来", (r.pauseCount || 0) + " 次"),
          row("戳了 TA", (r.pokes || 0) + " 次"),
          r.interruptReason ? row("为什么收桌", r.interruptReason) : null) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", color: t.fog, marginTop: 6 } }, "点开看细节")));
  }
  window.PomoShareCard = PomoShareCard;

  // 页面那半要用的，原样递过去
  window.PomoCore = { focusCategories, pad2, fmtClock, modeLabels, remainingSec, UP_CAP, CYCLE_BREAK, CYCLE_LONG, CYCLE_LONG_EVERY, focusedSec, nextCyclePhase, resumeSession, noteIndex, recentChat, fallbackPack, companionSubtitle, requestCompanionText, tapChoices, genMore, minutesText };
})();
