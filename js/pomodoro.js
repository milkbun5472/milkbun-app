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
  const ACTIVE_KEY = "x_pomodoro_active";
  const MORE_PENDING = new Set();
  const focusCategories = { reading: "阅读", study: "学习", work: "工作", create: "创作", other: "其他" };
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

  // 三种计时（她 2026-10-07「都做了吧」）：down 倒计时（原来那种）、up 正计时（不设时长，想停就停）、
  //   cycle 循环番茄（专注 min 分 → 休息 → 下一轮，每 CYCLE_LONG_EVERY 轮长休一次）。
  //   正计时也照样走 endTs 那一套（封顶 UP_CAP 分钟），暂停/恢复/重开 app 都不用另写一份。
  const UP_CAP = 24 * 60, CYCLE_BREAK = 5, CYCLE_LONG = 15, CYCLE_LONG_EVERY = 4;
  const kindLabels = { down: "倒计时", up: "正计时", cycle: "循环番茄" };
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
      voice: true, voiceScene: true, once: true, tag: "番茄钟", maxTokens: 65535,
      instruction: instruction + (typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? "\n" + REGISTER_FOLLOWS_SCENE : "") + (typeof ECHO_QUESTION_BAN !== "undefined" ? "\n" + ECHO_QUESTION_BAN : ""), schemaHint
    });
    const raw = await callAI(active, AC() + CB() + "【人设】" + (ctx.persona || "") + "\n【最近聊天】" + (ctx.chatRef || "") + "\n【世界书】" + (ctx.worldbook || "") + "\n" + instruction + "\n【输出】" + schemaHint, [{ role: "user", content: "开始。" }], { maxTokens: 65535, tag: "番茄钟" });
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

  async function genPack(active, ctx) {
    const { uName, task, min, mode } = ctx;
    const timeLine = ctx.kind === "up" ? "不设时长（正计时，Ta 想停就停）" : ctx.kind === "cycle" ? "循环番茄：每轮专注 " + min + " 分钟、休息 " + CYCLE_BREAK + " 分钟，每 " + CYCLE_LONG_EVERY + " 轮长休 " + CYCLE_LONG + " 分钟" : "时长 " + min + " 分钟";
    const instruction = "你正和 " + uName + " 在一张桌子两边专注。Ta 这轮只做：「" + task + "」，类别「" + (focusCategories[ctx.category] || "未指定") + "」，" + timeLine + "；陪伴方式是「" + (modeLabels[mode] || modeLabels.notes) + "」。你不是监督员，也不要把专注写成服从测试。\n" +
      "【你这边】你也不是干坐着陪：这段时间你在做你自己的事。" + (ctx.schedNow ? "你此刻的日程：" + ctx.schedNow + "。照这个来，" : "") + "挑一件你这会儿真会做的、能做出进度的事（写东西、练琴、看书、整理什么都行，照你这个人来）。\n" +
      "\n\n请写五类很短的文本，像对座的人在便签上随手写的，不要客服腔、鸡汤、训话或报菜名：\n" +
      "· notes：恰好 3 句，分别用于刚坐下、走到半程、快收尾。每句最多 24 字，彼此不能同义。安静同桌模式尤其克制。\n" +
      "· taps：3～5 句，用户主动轻戳画面时的独立回应，每句最多 24 字。按当前陪伴方式：安静模式回应短且轻；纸条模式带点彼此熟悉的互动；节点模式回应专注进度，具体时间由界面补上。语气与亲近程度来自你的人设和关系，每句都能单独显示。\n" +
      "· done：Ta 做完后的一句批注，承认具体投入，不夸张。\n" +
      "· left：Ta 提前收桌时的一句批注，不羞辱、不撒娇阻拦，允许以后接上。\n" +
      "· pause：Ta 暂停时的一句留座话。\n" +
      "· his：你这段时间在做的那件事，一句第三人称的短描述（十来个字，比如在干嘛，不加引号），会显示成「他在：……」。\n" +
      "· hisDone：收桌时你报一下你那边的进度，一句台词（像「我这边写完两页了」那种，照你实际在做的事）。\n" +
      "· brk：循环番茄到休息时你说的一句；back：休息完叫 Ta 回来的一句（不是循环模式也照写，用不上就不用）。\n" +
      "· caught：Ta 专注到一半偷偷切出去刷别的、过了一会儿才回来，你发现了说的一句——照你的脾气，可以吐槽、可以装没看见但点一下，别训话。\n" +
      "· goalYes / goalNo：收桌后 Ta 告诉你「" + task + "」做完了 / 没做完时，你各回一句。\n" +
      "按格式准备这一轮的内容。";
    const p = await requestCompanionText(active, ctx, instruction, "{\"notes\":[\"开场\",\"半程\",\"收尾\"],\"taps\":[\"轻戳回应\"],\"done\":\"完成批注\",\"left\":\"提前结束批注\",\"pause\":\"暂停留座话\",\"his\":\"他这段在做的事\",\"hisDone\":\"他报进度的一句\",\"brk\":\"休息一句\",\"back\":\"叫回来一句\",\"caught\":\"发现溜号一句\",\"goalYes\":\"做完了回一句\",\"goalNo\":\"没做完回一句\"}");
    const fb = fallbackPack(task, mode);
    const str = (v, d) => { const s = v != null ? String(v).trim() : ""; return s && s.toLowerCase() !== "null" ? s : d; };
    const notes = Array.isArray(p.notes) ? p.notes.filter(Boolean).slice(0, 3).map(x => String(x).trim()) : [];
    while (notes.length < 3) notes.push(fb.notes[notes.length]);
    const taps = Array.isArray(p.taps) ? p.taps.filter(x => typeof x === "string" && x.trim()).slice(0, 5).map(x => x.trim()) : [];
    return { notes, taps: taps.length ? taps : fb.taps, done: str(p.done, fb.done), left: str(p.left, fb.left), pause: str(p.pause, fb.pause),
      his: str(p.his, ""), hisDone: str(p.hisDone, ""), brk: str(p.brk, fb.brk), back: str(p.back, fb.back), caught: str(p.caught, fb.caught), goalYes: str(p.goalYes, fb.goalYes), goalNo: str(p.goalNo, fb.goalNo) };
  }

  function minutesText(v) {
    const n = Number(v || 0);
    return (Math.round(n * 10) / 10).toString() + " 分钟";
  }

  // 结算：一张【收桌时留在桌上的单子】（v61.40，她 2026-09-03：「结算的页面也很无聊」）
  // 原来是从底下掀起来的半窗（还犯了 no-half-sheet.md），里面是一排「键：值」。
  // 现在是整页：桌面打底，中间一张长条单据——齿孔边、虚线分栏、TA的批注写在最底下，
  // 像收摊时撕下来的那一联。结果页和往期回看共用它（一处画、两处用）。
  function ResultCard(t, rec, char, onClose, tp, onGoal) {
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
            rec.kind && rec.kind !== "down" ? row("怎么计时", kindLabels[rec.kind] || rec.kind) : null,
            rec.kind === "cycle" ? row("坐满几轮", (rec.rounds || 0) + " 轮") : null,
            rec.pauseCount != null ? row("中间停了", (rec.pauseCount || 0) + " 次") : null,
            rec.sneaks ? row("偷偷溜出去", rec.sneaks + " 次", "#a8433a") : null,
            rec.earned ? row("攒到扭蛋点", "+" + rec.earned, "#4a6b52") : null,
            rec.his ? row((rec.charName || (char && char.name) || "TA") + " 这段在", rec.his) : null,
            rec.interruptReason ? row("为什么收桌", rec.interruptReason) : null,
            rec.escapes != null ? row("旧版 · 想跑", String(rec.escapes || 0), rec.escapes ? "#a8433a" : "#3a3024") : null,
            rec.wrong != null ? row("旧版 · 暗号输错", String(rec.wrong || 0), rec.wrong ? "#a8433a" : "#3a3024") : null),
          // TA的批注：写在单子最下面那一格，像顺手划下的一行
          rec.annotation ? h("div", { style: { marginTop: 16, paddingTop: 14, borderTop: "1px dashed rgba(120,96,58,.35)" } },
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 15.5, lineHeight: 1.95, color: "#3a3024" } }, "“" + rec.annotation + "”"),
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 9 } },
              (tp && char && typeof TtsDot === "function") ? h(TtsDot, { k: "pmd" + rec.id, text: rec.annotation, spk: char, tp }) : null,
              h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#a3925f" } }, "—— " + (rec.charName || (char && char.name) || "")))) : null),
        // TA报一下自己那边的进度（开场那一次就写好了，不另调模型）
        rec.hisDone ? h("div", { style: { marginTop: 16, padding: "12px 14px", background: "rgba(255,253,247,.7)", border: "1px dashed rgba(120,96,58,.35)", borderRadius: 3 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#a3925f", marginBottom: 4 } }, (rec.charName || (char && char.name) || "TA") + " 那边"),
          h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: 1.8, color: "#3a3024" } }, rec.hisDone)) : null,
        // 「这一轮只做」那件，做完没？——她答了，TA回一句（也是开场就写好的）
        rec.task && onGoal ? h("div", { "data-wk": "pomgoal", style: { marginTop: 16, padding: "14px 14px 12px", background: "#fdf6d8", borderRadius: 2, boxShadow: "0 6px 14px rgba(80,60,25,.14)", transform: "rotate(.4deg)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#8a7a5e" } }, (rec.charName || (char && char.name) || "TA") + " 问：「" + rec.task + "」做完了吗？"),
          rec.goalDone == null ? h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
            h("button", { onClick: () => onGoal(true), style: { flex: 1, minHeight: 42, border: "none", borderRadius: 3, background: "#3a3024", color: "#fffdf7", fontFamily: F_BODY, fontSize: 13 } }, "做完了"),
            h("button", { onClick: () => onGoal(false), style: { flex: 1, minHeight: 42, border: "1px solid rgba(90,72,44,.4)", borderRadius: 3, background: "transparent", color: "#3a3024", fontFamily: F_BODY, fontSize: 13 } }, "还没有"))
            : h("div", { style: { marginTop: 8 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: rec.goalDone ? "#4a6b52" : "#8a7a5e" } }, rec.goalDone ? "做完了" + (rec.memoId ? " · 备忘录里那条已经勾掉" : "") : "还没做完"),
              (rec.goalDone ? rec.goalYes : rec.goalNo) ? h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: 1.8, color: "#3a3024", marginTop: 4 } }, "“" + (rec.goalDone ? rec.goalYes : rec.goalNo) + "”") : null)) : null,
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

  // 背景音那一格（她 2026-10-05）：设置桌上和专注中的浮层用同一份。
  //   每一层一根滑块，往右拖就叠进去；拖到最左＝不要这一层。声音见 js/ambience.js。
  function AmbiencePanel({ ink, fog, line, accent, onChange }) {
    const A = window.Ambience;
    const [cfg, setCfg] = useState(() => A ? A.load() : { levels: {}, mine: 0, mineName: "" });
    const [on, setOn] = useState(() => !!(A && A.isPlaying()));
    const fileRef = useRef(null);
    // 先把用得上的几层在空闲时合好：点「放」的那一下就不用现算半秒（iPhone 认「她点的」那一刻很短）
    useEffect(() => { const tm = A && setTimeout(() => { try { A._mix(A.load().levels); } catch (e) {} }, 300); return () => clearTimeout(tm); }, []);
    if (!A) return null;
    const set = (k, v) => { const n = A.setLevel(k, v); setCfg({ ...n }); onChange && onChange(n); };
    const row = (k, zh, val, extra) => h("label", { key: k, style: { display: "flex", alignItems: "center", gap: 10, minHeight: 40 } },
      h("span", { style: { width: 52, flexShrink: 0, fontFamily: F_BODY, fontSize: 12, color: val > 0 ? ink : fog } }, zh),
      h("input", { type: "range", min: 0, max: 100, value: Math.round(val * 100), "aria-label": zh + "音量",
        onChange: e => set(k, Number(e.target.value) / 100), style: { flex: 1, minWidth: 0, accentColor: accent } }),
      extra || null);
    const toggle = () => { if (on) { A.stop(); setOn(false); } else { A.play(); setOn(true); } };
    return h("div", null,
      A.LAYERS.map(([k, zh]) => row(k, zh, Number(cfg.levels[k]) || 0)),
      cfg.mineName
        ? row("mine", "我的", cfg.mine, h("button", { onClick: e => { e.preventDefault(); A.clearMine().then(n => setCfg({ ...n })); }, style: { flexShrink: 0, minHeight: 32, padding: "0 4px", fontFamily: F_BODY, fontSize: 11, color: fog, background: "transparent", border: "none" } }, "移除"))
        : null,
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 } },
        h("button", { onClick: () => fileRef.current && fileRef.current.click(), style: { minHeight: 36, padding: "0 12px", borderRadius: 999, border: "1px solid " + line, background: "transparent", fontFamily: F_BODY, fontSize: 11.5, color: ink } },
          cfg.mineName ? "换一段我的音频" : "＋ 用我自己的音频"),
        h("button", { onClick: toggle, disabled: !A.anyOn(cfg), className: "disabled:opacity-40", style: { minHeight: 36, padding: "0 14px", borderRadius: 999, border: "none", background: ink, color: "#fdf6e6", fontFamily: F_BODY, fontSize: 11.5 } },
          on ? "停下背景音" : "放背景音")),
      cfg.mineName ? h("div", { style: { marginTop: 6, fontFamily: F_BODY, fontSize: 10.5, color: fog, lineHeight: 1.6 } }, "我的：" + cfg.mineName + "（iPhone 上它按文件原本的音量放）") : null,
      h("input", { ref: fileRef, type: "file", accept: "audio/*", style: { display: "none" }, onChange: e => {
        const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
        A.setMine(f).then(n => n && setCfg({ ...n }));
      } }));
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
    const [archWho, setArchWho] = useState("");   // 往期按人分：空＝全部
    // 日历下面「让TA点评」（她 2026-10-07：「做一个可以选择让他点评的按钮」）：点了才调一次模型，按人存最近那一句
    const [calNote, setCalNote] = useState(() => loadJSON("x_pomoCalNote", {}) || {});
    const [calBusy, setCalBusy] = useState(false);
    const archScroller = useRef(null), archScroll = useRef(0);
    // 看完一张再回来，停在原来那一行（mobile-ui-layout.md §3）
    useEffect(() => { if (view === "archive" && !detail && archScroller.current) archScroller.current.scrollTop = archScroll.current; }, [view, detail, archWho]);
    const [charId, setCharId] = useState(chars[0] ? chars[0].id : "");
    const [task, setTask] = useState("一起看书");
    // 这一场算进哪门课（她 2026-09-28：「可以开番茄钟选一门课」）。记在场次和往期记录上，
    // 一起学那边的学习时长按它认；不选就不算进任何一门。
    const [curId, setCurId] = useState("");
    const courses = (window.Study && window.Study.loadCurricula ? window.Study.loadCurricula() : []).filter(function (c) { return c && c.id && c.subject; });
    const [min, setMin] = useState(25);
    // 计时方式、溜号开关记住她上次选的；待办里挑的那条记 id，做完了顺手勾掉
    const [kind, setKindRaw] = useState(() => { try { const k = localStorage.getItem("x_pomoKind"); return kindLabels[k] ? k : "down"; } catch (e) { return "down"; } });
    const setKind = k => { setKindRaw(k); try { localStorage.setItem("x_pomoKind", k); } catch (e) {} };
    const [sneakOn, setSneakOnRaw] = useState(() => { try { return localStorage.getItem("x_pomoSneak") !== "0"; } catch (e) { return true; } });
    const setSneakOn = v => { setSneakOnRaw(v); try { localStorage.setItem("x_pomoSneak", v ? "1" : "0"); } catch (e) {} };
    const [memoId, setMemoId] = useState("");
    const memoTodos = (() => { try { return ((loadJSON("x_memo", {}) || {}).reminders || []).filter(r => r && r.id && !r.done && String(r.title || "").trim()).slice(0, 8); } catch (e) { return []; } })();
    const [mode, setMode] = useState("notes");
    const [category, setCategory] = useState("reading");
    const [moreBusy, setMoreBusy] = useState(() => { const s = loadActive(); return !!s && MORE_PENDING.has(s.startTs); });
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [busy, setBusy] = useState(false);
    const [sess, setSess] = useState(null);
    const sessRef = useRef(null);
    const [left, setLeft] = useState(0);
    const [endOpen, setEndOpen] = useState(false);
    const [ambOpen, setAmbOpen] = useState(false);   // 专注中打开背景音那一层
    const [result, setResult] = useState(null);
    const [resumed, setResumed] = useState(false);
    const [subtitle, setSubtitle] = useState(null);
    const pokeRef = useRef({ at: 0, turn: 0 });
    const subtitleTimer = useRef(null);
    const lastSubtitle = useRef(null);
    const showSubtitle = next => {
      clearTimeout(subtitleTimer.current);
      lastSubtitle.current = next; setSubtitle(next);
      const readFor = next.extraId ? Math.max(9000, Math.min(30000, String(next.text).length * 220)) : Math.max(6000, Math.min(14000, String(next.text).length * 260));
      subtitleTimer.current = setTimeout(() => setSubtitle(null), readFor);
    };
    const focusNote = sess ? noteIndex(sess, left) : 0;
    useEffect(() => {
      if (view !== "focus" || !sess) { clearTimeout(subtitleTimer.current); setSubtitle(null); return; }
      if (stopSpeechRef.current) stopSpeechRef.current();
      showSubtitle(companionSubtitle(sess, left, 0, "node"));
      return () => clearTimeout(subtitleTimer.current);
    }, [view, sess && sess.startTs, sess && sess.pausedAt, focusNote, sess && sess.phase === "break" && sess.round]);
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
    // 溜号会被发现（开关在设置桌上，默认开）：专注中切出去超过 20 秒再回来，TA就知道你跑了。
    //   暂停着、循环里的休息段不算——那本来就是给你走开的。
    const awayAt = useRef(0);
    useEffect(() => {
      const onVis = () => {
        const s0 = sessRef.current;
        if (!s0 || !s0.sneak || s0.pausedAt || (s0.kind === "cycle" && s0.phase === "break")) { awayAt.current = 0; return; }
        if (document.hidden) { awayAt.current = Date.now(); return; }
        const away = awayAt.current ? Date.now() - awayAt.current : 0; awayAt.current = 0;
        if (away < 20000) return;
        const n = (s0.sneaks || 0) + 1;
        keepSession({ ...s0, sneaks: n });
        showSubtitle({ text: (s0.pack && s0.pack.caught) || fallbackPack(s0.task, s0.mode).caught, label: "你刚刚跑出去了 " + Math.round(away / 60000 * 10) / 10 + " 分钟", key: "caught-" + n });
      };
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    }, []);
    sessRef.current = sess;

    const companionContext = (c, state) => {
      const base = props.ctxFor ? props.ctxFor(c) : null;
      const chatRef = base ? base.recentChat || "" : recentChat(c.id, uName, c.name);
      const worldbook = props.worldbookFor ? props.worldbookFor(c.id, state.task + "\n" + chatRef) : props.worldbook;
      const course = courses.find(x => x.id === state.curId);
      return { charName: c.name, persona: c.persona, mood: moodOf(c.id), uName, task: state.task, min: state.min, mode: state.mode, category: state.category, kind: state.kind || "down",
        schedNow: props.schedNowFor ? props.schedNowFor(c) : "",
        chatRef, worldbook, course: course && course.subject || "", bundle: base ? { ...base, char: c, worldbook } : null };
    };

    const keepSession = next => { sessRef.current = next; setSess(next); persistSession(next); };

    useEffect(() => {
      const sync = () => {
        const current = sessRef.current, latest = loadActive();
        setMoreBusy(!!latest && MORE_PENDING.has(latest.startTs));
        if (!current || !latest || current.startTs !== latest.startTs) return;
        const next = { ...latest, char: charOf(latest.charId) || current.char };
        keepSession(next); setMoreBusy(MORE_PENDING.has(latest.startTs));
        const extras = latest.extraLines || [], before = (current.extraLines || []).length;
        if (extras.length > before && !document.hidden) {
          if (stopSpeechRef.current) stopSpeechRef.current();
          const line = extras[before]; showSubtitle({ text: line.text, key: "extra-" + line.id, extraId: line.id, label: "刚刚多说的几句 · " + (before + 1) + "/" + extras.length });
        }
      };
      window.addEventListener("pomodoro-more-updated", sync);
      return () => window.removeEventListener("pomodoro-more-updated", sync);
    }, []);

    useEffect(() => { if (sess) setMoreBusy(MORE_PENDING.has(sess.startTs)); }, [sess && sess.startTs]);

    const finish = (status, reason) => {
      if (timerRef.current) clearInterval(timerRef.current);
      const s = sessRef.current;
      if (!s) return;
      const actual = Math.round((focusedSec(s, Date.now()) / 60) * 10) / 10;
      const down = !s.kind || s.kind === "down";
      // 坐满一轮攒扭蛋点（情侣空间那一份；段闸和日封顶在 GachaKit 里）
      const earned = status === "done" && props.onEarn ? (props.onEarn(s.char.id) || 0) : 0;
      const pk = s.pack || {};
      const rec = {
        id: uid(), charId: s.char.id, charName: s.char.name, task: s.task, curId: s.curId || null, minutes: down ? s.min : (s.kind === "cycle" ? s.min : actual),
        focusedMinutes: status === "done" && down ? Number(s.min) : actual, pauseCount: s.pauseCount || 0,
        kind: s.kind || "down", rounds: s.rounds || 0, sneaks: s.sneaks || 0, earned, memoId: s.memoId || null,
        his: pk.his || "", hisDone: pk.hisDone || "", goalYes: pk.goalYes || "", goalNo: pk.goalNo || "",
        ts: Date.now(), status, statusZh: status === "done" ? "完成" : "提前收桌",
        interruptReason: status === "done" ? "" : (reason || "今天先到这里"),
        annotation: status === "done" ? s.pack.done : s.pack.left, mode: s.mode, category: s.category || null,
        pokes: s.pokes || 0
      };
      const next = [rec].concat(loadSaves());
      saveSaves(next); setSaves(next); clearActive();
      if (window.Ambience) window.Ambience.stop();   // 收桌，声音也收
      setResult({ rec, char: s.char }); setEndOpen(false); setView("result");
      // 收桌就往 TA 的私聊里放一张小卡（不另调模型：批注是开场那一次就写好的）
      if (props.onShare) { try { props.onShare(rec, s.char); } catch (e) {} }
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
      setCategory(restored.category || (restored.curId ? "study" : "other")); setResumed(true); setView("focus");
    }, [chars.length]);

    useEffect(() => {
      if (view !== "focus" || !sess) return;
      const tick = () => {
        const current = sessRef.current;
        if (!current) return;
        const remain = remainingSec(current, Date.now());
        setLeft(remain);
        if (remain <= 0 && !current.pausedAt) {
          // 循环番茄：一段走完不收桌，换到下一段（专注→休息→下一轮）
          if (current.kind === "cycle") {
            const nx = nextCyclePhase(current, Date.now());
            keepSession({ ...nx, char: current.char }); setLeft(remainingSec(nx, Date.now()));
            if (nx.phase === "focus" && !document.hidden) showSubtitle({ text: (nx.pack && nx.pack.back) || fallbackPack(nx.task, nx.mode).back, label: "第 " + nx.round + " 轮", key: "back-" + nx.round });
            return;
          }
          finishRef.current("done");
        }
      };
      tick(); timerRef.current = setInterval(tick, 1000);
      return () => clearInterval(timerRef.current);
    }, [view, sess && sess.startTs]);

    const start = async () => {
      const c = charOf(charId);
      const duration = kind === "up" ? UP_CAP : Number(min);
      if (!c) { props.toast && props.toast("先去『人格档案馆』选/建个角色陪你"); return; }
      if (!duration || duration < 1) { props.toast && props.toast("时长至少 1 分钟"); return; }
      // 先在这一下点击里把背景音解锁——下面要 await 模型，等回来再 play 在 iPhone 上就不算「她点的」了
      if (window.Ambience && window.Ambience.anyOn()) window.Ambience.unlock();
      setBusy(true);
      let pack;
      try {
        pack = props.active
          ? await genPack(props.active, companionContext(c, { task: task.trim() || "专注", min: duration, mode, category, curId, kind }))
          : fallbackPack(task.trim() || "专注", mode);
      } catch (_) { pack = fallbackPack(task.trim() || "专注", mode); }
      const now = Date.now();
      const next = { char: c, charId: c.id, curId: curId || null, pack, category, extraLines: [], min: duration, task: task.trim() || "专注", mode, startTs: now, endTs: now + duration * 60000, pausedAt: null, pauseCount: 0,
        kind, phase: "focus", round: 1, rounds: 0, doneFocusSec: 0, memoId: memoId || null, sneak: sneakOn, sneaks: 0 };
      pokeRef.current = { at: 0, turn: 0 }; keepSession(next); setLeft(duration * 60); setBusy(false); setResumed(false); setView("focus");
      // 调好了背景音就跟着上发条一起响；退出 App 也不停（<audio> 那一路，见 ambience.js）
      if (window.Ambience && window.Ambience.anyOn()) window.Ambience.play();
    };

    const more = async () => {
      const s = sessRef.current, c = s && (charOf(s.charId) || s.char);
      if (!s || !c || MORE_PENDING.has(s.startTs)) return;
      if (!props.active) { props.toast && props.toast("先在设置里配好文字模型，再让他多说几句"); return; }
      if (!remainingSec(s, Date.now())) return;
      if (stopSpeechRef.current) stopSpeechRef.current();
      MORE_PENDING.add(s.startTs); setMoreBusy(true);
      keepSession({ ...s, moreError: null });
      try {
        const lines = await genMore(props.active, companionContext(c, s), s, Date.now());
        const latest = loadActive();
        // 请求途中暂停/离页不能倒拨计时；已经收桌或换场不能让迟到的回答复活旧场次。
        if (!latest || latest.startTs !== s.startTs || !remainingSec(latest, Date.now())) return;
        const extra = lines.map((text, i) => ({ id: uid() + "_" + i, text, createdAt: Date.now() }));
        const next = { ...latest, char: c, extraLines: (latest.extraLines || []).concat(extra), moreError: null };
        persistSession(next);
        if (mounted.current) {
          if (stopSpeechRef.current) stopSpeechRef.current();
          keepSession(next);
          const choices = tapChoices(next), first = choices.findIndex(x => x.extraId === extra[0].id);
          pokeRef.current = { at: Date.now(), turn: first + 1 };
          if (!document.hidden) showSubtitle({ ...choices[first], label: "刚刚多说的几句 · " + (next.extraLines.length - extra.length + 1) + "/" + next.extraLines.length });
        }
      } catch (e) {
        const latest = loadActive();
        if (latest && latest.startTs === s.startTs && remainingSec(latest, Date.now())) {
          const next = { ...latest, char: c, moreError: String(e && e.message || e).slice(0, 1000) };
          persistSession(next); if (mounted.current) keepSession(next);
        }
      } finally { MORE_PENDING.delete(s.startTs); if (mounted.current) setMoreBusy(false); window.dispatchEvent(new Event("pomodoro-more-updated")); }
    };

    const togglePause = () => {
      const s = sessRef.current; if (!s) return;
      if (stopSpeechRef.current) stopSpeechRef.current();
      const now = Date.now();
      if (s.pausedAt) { keepSession(resumeSession(s, now)); if (window.Ambience && window.Ambience.anyOn()) window.Ambience.play(); }
      else { keepSession({ ...s, pausedAt: now, pauseCount: (s.pauseCount || 0) + 1 }); if (window.Ambience) window.Ambience.stop(); }
    };

    // 「做完了吗」：她答了就记在那张单子上；做完了、又是从备忘录待办里挑的，就把那条勾掉
    const answerGoal = (rec, yes) => {
      const r2 = { ...rec, goalDone: !!yes };
      if (yes && rec.memoId) { try { const d = loadJSON("x_memo", {}) || {}; d.reminders = (d.reminders || []).map(x => x && x.id === rec.memoId ? { ...x, done: true } : x); saveJSON("x_memo", d); } catch (e) {} }
      const next = loadSaves().map(x => x && x.id === rec.id ? r2 : x);
      saveSaves(next); setSaves(next);
      return r2;
    };

    if (view === "result" && result) {
      return ResultCard(t, result.rec, result.char, () => { setResult(null); setSess(null); sessRef.current = null; setView("setup"); }, tp,
        yes => setResult({ ...result, rec: answerGoal(result.rec, yes) }));
    }

    // ⚠️结算从半窗改成整页之后，往期那张不能再当兄弟节点挂在列表下面
    //   （那会变成「列表底下又接了一页」）。要么整页替换，要么就不是整页。
    if (view === "archive" && detail) return ResultCard(t, detail, charOf(detail.charId), () => setDetail(null), tp, yes => setDetail(answerGoal(detail, yes)));
    if (view === "archive") {
      // 往期按人分（她 2026-10-05：「archive 要不要做好看点然后可以按角色分」）。
      //   这张桌子在现实里是什么？——每次换人坐对面，桌上就立一块【桌牌】。所以分栏就是一排桌牌：
      //   选中的那块立起来（高、上墨、看得见折痕），没选的平放着（矮、暗）。「全部」是桌角那叠单子。
      //   （施工规则/tabs-not-plain-pills.md）
      const DESKA = "linear-gradient(163deg,#efe9dd,#e5dccb 62%,#dbd0bb)";
      const ink = "#3a3024", fog = "#8a7a5e", line = "rgba(120,96,58,.24)";
      const who = [...new Set(saves.map(r => r.charId))].map(id => ({ id, name: (charOf(id) || {}).name || (saves.find(r => r.charId === id) || {}).charName || "?", n: saves.filter(r => r.charId === id).length }))
        .sort((a, b) => b.n - a.n);
      const list = archWho ? saves.filter(r => r.charId === archWho) : saves;
      const mins = list.reduce((a, r) => a + Number(r.focusedMinutes != null ? r.focusedMinutes : r.minutes || 0), 0);
      const doneN = list.filter(r => r.status === "done").length;
      // 专注日历（她 2026-10-07）：最近八周每天坐了多久，一格一天，越久越深；下面一行这周对上周
      const focusCal = rows => {
        const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
        const per = {}; rows.forEach(r => { const k = dayKey(r.ts); per[k] = (per[k] || 0) + Number(r.focusedMinutes != null ? r.focusedMinutes : r.minutes || 0); });
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dow = (today.getDay() + 6) % 7;                 // 周一是一列的第一格
        const start = new Date(today); start.setDate(today.getDate() - dow - 7 * 7);
        const cells = []; let thisWeek = 0, lastWeek = 0;
        for (let i = 0; i < 56; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i);
          const m = d > today ? null : (per[dayKey(d.getTime())] || 0);
          if (m != null && i >= 49) thisWeek += m; else if (m != null && i >= 42) lastWeek += m;
          const a = m == null ? 0 : m <= 0 ? .08 : Math.min(1, .25 + m / 120);
          cells.push(h("div", { key: i, title: (d.getMonth() + 1) + "/" + d.getDate() + (m ? " · " + Math.round(m) + " 分钟" : ""),
            style: { width: 16, height: 16, borderRadius: 3, background: m == null ? "transparent" : "rgba(74,107,82," + a + ")", border: m == null ? "1px dashed " + line : "none" } }));
        }
        const diff = Math.round(thisWeek - lastWeek);
        // 点评的人：选了哪个桌牌就是谁；看「全部」时是坐得最多的那位
        const critic = charOf(archWho) || charOf((who[0] || {}).id);
        const note = critic && calNote[critic.id];
        const askReview = async () => {
          if (!critic || calBusy) return;
          if (!props.active) { props.toast && props.toast("先在设置里配好文字模型，再让TA点评"); return; }
          const weekAgo = Date.now() - 7 * 86400000;
          const wk = rows.filter(r => r.ts >= weekAgo);
          const days = new Set(wk.map(r => dayKey(r.ts))).size;
          const facts = "这周（最近 7 天）一起坐了 " + Math.round(thisWeek) + " 分钟，上周 " + Math.round(lastWeek) + " 分钟；这周坐了 " + wk.length + " 场、分在 " + days + " 天，其中坐满 " + wk.filter(r => r.status === "done").length + " 场、提前收桌 " + wk.filter(r => r.status !== "done").length + " 场"
            + "；中途偷偷溜出去 " + wk.reduce((a, r) => a + (r.sneaks || 0), 0) + " 次；做过的事：" + ([...new Set(wk.map(r => r.task).filter(Boolean))].slice(0, 8).join("、") || "没写");
          setCalBusy(true);
          try {
            const res = await requestCompanionText(props.active, companionContext(critic, { task: "回看这几周一起专注的记录", min: 0, mode: "notes", category: "other" }),
              "你和 " + uName + " 一直在一张桌子两边一起专注（番茄钟）。Ta 翻开记录让你点评一下最近坐得怎么样。下面是真实的数：\n" + facts
              + "\n照你这个人说一两句：可以夸、可以损、可以心疼、可以点出哪儿松了，照你的脾气和你们的关系来。只说数里有的，别编没发生的事；别报菜名一样复述数字，挑你真在意的那一点说。",
              "{\"line\":\"你的点评\"}");
            const line = String((res && res.line) || "").trim();
            if (!line) throw new Error("这次没说出话来");
            const n = { ...calNote, [critic.id]: { text: line, ts: Date.now() } };
            saveJSON("x_pomoCalNote", n); setCalNote(n);
          } catch (e) { props.toast && props.toast("没点评成：" + String(e && e.message || e).slice(0, 80)); }
          finally { setCalBusy(false); }
        };
        return h("div", { key: "cal", "data-wk": "pomcal", style: { marginTop: 12, padding: "12px 12px 10px", background: "#fffdf6", border: "1px solid " + line, borderRadius: 3 } },
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(8,16px)", gridAutoFlow: "column", gridTemplateRows: "repeat(7,16px)", gap: 4, justifyContent: "center" } }, cells),
          h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: F_BODY, fontSize: 11, color: fog } },
            h("span", null, "这周 " + Math.round(thisWeek) + " 分钟"),
            h("span", null, lastWeek || thisWeek ? (diff >= 0 ? "比上周多 " + diff + " 分钟" : "比上周少 " + (-diff) + " 分钟") : "最近八周")),
          note ? h("div", { "data-wk": "pomcalnote", style: { marginTop: 10, paddingTop: 10, borderTop: "1px dashed " + line } },
            h("div", { style: { fontFamily: "'Noto Serif SC',serif", fontSize: 14.5, lineHeight: 1.85, color: ink } }, "“" + note.text + "”"),
            h("div", { style: { textAlign: "right", fontFamily: F_BODY, fontSize: 11, color: fog, marginTop: 4 } }, "—— " + critic.name + " · " + fmtDate(note.ts))) : null,
          critic ? h("button", { "data-wk": "pomcalask", onClick: askReview, disabled: calBusy, className: "w-full active:opacity-70 disabled:opacity-50",
            style: { marginTop: 10, minHeight: 40, border: "1px solid " + line, borderRadius: 3, background: "transparent", fontFamily: F_BODY, fontSize: 12.5, color: ink } },
            calBusy ? critic.name + " 在翻你的记录…" : (note ? "让 " + critic.name + " 再点评一次" : "让 " + critic.name + " 点评一下")) : null);
      };
      const tent = (id, label, n) => { const on = archWho === id;
        return h("button", { key: id || "all", onClick: () => { archScroll.current = 0; setArchWho(id); }, "aria-pressed": on, "data-on": on ? "1" : "0", className: "active:opacity-80",
          style: { flexShrink: 0, minWidth: 66, minHeight: on ? 58 : 46, padding: "0 10px", alignSelf: "flex-end", border: "1px solid " + (on ? ink : line), borderBottom: "none",
            borderRadius: "3px 3px 0 0", background: on ? "#fffdf6" : "rgba(255,253,246,.45)", color: on ? ink : fog, position: "relative", transition: "min-height .18s" } },
          on ? h("span", { "aria-hidden": "true", style: { position: "absolute", left: 6, right: 6, top: 9, borderTop: "1px dashed rgba(58,48,36,.28)" } }) : null,
          h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: on ? 15 : 13, marginTop: on ? 14 : 6, whiteSpace: "nowrap" } }, label),
          h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 9.5, color: fog, marginTop: 2 } }, n + " 场")); };
      const card = (r, i) => { const m = r.focusedMinutes != null ? r.focusedMinutes : r.minutes, done = r.status === "done";
        return h("button", { key: r.id, "data-wk": "pomarchrow", "data-done": done ? "1" : "0", onClick: () => { archScroll.current = archScroller.current ? archScroller.current.scrollTop : 0; setDetail(r); }, className: "w-full text-left active:opacity-80",
          style: { display: "grid", gridTemplateColumns: "62px 1fr", gap: 12, alignItems: "center", marginTop: 10, padding: "12px 12px 12px 0", background: "#fffdf6", border: "1px solid " + line, borderRadius: 3,
            boxShadow: "0 2px 6px rgba(96,72,40,.08)", transform: "rotate(" + ((i % 3) - 1) * 0.35 + "deg)" } },
          h("span", { style: { textAlign: "center", borderRight: "1px dashed " + line } },
            h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1, color: done ? "#4a6b52" : ink } }, Math.round(m)),
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 9.5, color: fog, marginTop: 3 } }, "分钟")),
          h("span", { style: { minWidth: 0 } },
            h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 16, color: ink, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.task || "没写做什么"),
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: fog, marginTop: 4 } }, fmtDate(r.ts) + (archWho ? "" : " · " + r.charName) + " · " + (done ? "坐满了" : "先收桌") + (r.pokes ? " · 戳了 " + r.pokes + " 次" : "")),
            r.annotation ? h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11.5, color: "#5a4c38", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "「" + r.annotation + "」") : null)); };
      return h("div", { className: "h-full flex flex-col", "data-wk": "pomarchive", style: { background: DESKA,
        backgroundImage: "repeating-linear-gradient(96deg,rgba(120,96,58,.03) 0 2px,transparent 2px 26px)," + DESKA,
        boxShadow: "inset 0 0 60px rgba(96,72,40,.16)" } },
        h(Head, { zh: "坐过的那些", onBack: () => setView("setup"), right: h("div", { style: { minWidth: 32, textAlign: "right", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, saves.length), bg: "transparent" }),
        saves.length ? h("div", { "data-wk": "pomarchtabs", className: "shrink-0 flex", style: { gap: 6, overflowX: "auto", padding: "4px 24px 0", borderBottom: "1px solid " + ink } },
          tent("", "全部", saves.length), who.map(w => tent(w.id, w.name, w.n))) : null,
        h("div", { ref: archScroller, className: "flex-1 min-h-0 overflow-y-auto px-6", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 28px)" } },
          saves.length === 0
            ? h("div", { style: { borderTop: "1px solid " + line, padding: "48px 0", fontFamily: F_BODY, fontSize: 13, color: fog } }, "桌上还没有留下记录。")
            : [h("div", { key: "sum", "data-wk": "pomarchsum", style: { display: "flex", gap: 18, padding: "14px 2px 4px", fontFamily: F_BODY, fontSize: 11, color: fog } },
                h("span", null, h("b", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: ink, fontWeight: 400, marginRight: 4 } }, minutesText(Math.round(mins))), archWho ? "一起坐过" : "一共坐过"),
                h("span", null, h("b", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: ink, fontWeight: 400, marginRight: 4 } }, list.length), "场"),
                h("span", null, h("b", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: "#4a6b52", fontWeight: 400, marginRight: 4 } }, doneN), "场坐满")),
              focusCal(list),
              list.map(card)]));
    }

    if (view === "video" && charOf(charId)) return h(MotionEditor, { key: charId, scene: "focus", character: charOf(charId), onBack: () => setView("setup"), onSaved: () => setVideoRevision(v => v + 1), toast: props.toast });

    if (view === "focus" && sess) {
      const c = sess.char, companion = VideoApi.slotFor(c.id, "focus");
      const onBreak = sess.kind === "cycle" && sess.phase === "break";
      const elapsed = focusedSec(sess, Date.now());
      const progress = sess.kind === "up" ? (elapsed % 3600) / 3600
        : onBreak ? Math.max(0, Math.min(1, 1 - left / Math.max(1, (sess.breakMin || CYCLE_BREAK) * 60)))
        : Math.max(0, Math.min(1, 1 - left / Math.max(1, sess.min * 60)));
      const clockLabel = sess.pausedAt ? "发条停了一会儿" : sess.kind === "up" ? "已经一起坐了" : onBreak ? "休息一下，还剩" : sess.kind === "cycle" ? "第 " + (sess.round || 1) + " 轮，还剩" : "这一圈发条，还剩";
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
        // 戳了几次记在这一场上，收桌时带进私聊那张小卡（群里 2026-10-05：「中间偷偷戳了我几次呀」）
        if (sessRef.current) keepSession({ ...sessRef.current, pokes: (sessRef.current.pokes || 0) + 1 });
        showSubtitle(next);
      };
      const current = subtitle || lastSubtitle.current || companionSubtitle(sess, left, Math.max(0, pokeRef.current.turn - 1), "tap");
      const extraIndex = (sess.extraLines || []).findIndex(x => x.id === current.extraId);
      const browseExtra = delta => {
        if (stopSpeechRef.current) stopSpeechRef.current();
        const extras = sess.extraLines || [], at = (extraIndex + delta + extras.length) % extras.length;
        const choices = tapChoices(sess), index = choices.findIndex(x => x.extraId === extras[at].id);
        pokeRef.current = { at: Date.now(), turn: index + 1 };
        showSubtitle({ ...choices[index], label: "对座多说几句 · " + (at + 1) + "/" + extras.length });
      };
      const speak = () => { showSubtitle(current); tp.toggle("pmd-note-" + sess.startTs + "-" + current.key, current.text, c.voiceId); };
      const listenButton = voiceReady ? h("button", { "aria-label": "听桌边纸条", onClick: speak, style: { pointerEvents: "auto", minHeight: 36, display: "flex", alignItems: "center", gap: 6, marginTop: 5, padding: 0, background: "transparent", border: "none", color: "inherit", opacity: .65, fontFamily: F_BODY, fontSize: 11 } }, h("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": "true" }, h("path", { d: "M11 4 5 9H2v6h3l6 5V4Z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14" })), tp.play ? tp.play.st === "gen" ? "声音准备中…" : "停止语音" : "听这句") : null;
      const cream = "#f6efdf", dim = "rgba(246,239,223,.66)";
      const exitRight = h("button", { onClick: () => setEndOpen(true), "aria-label": "收桌", style: { width: 46, minHeight: 40, border: "none", background: "transparent", color: cream, fontFamily: F_BODY, fontSize: 12 } }, "收桌");
      return h("div", { className: "h-full flex flex-col", "data-wk": "pomfocus", "data-pomodoro-focus": sess.mode, style: { position: "relative", ...bg, overflow: "hidden", color: cream } },
        h("style", null, ".pom-subtitle{animation:fadeUp .3s ease both}.pom-poke:focus-visible{outline:2px solid #f6efdf;outline-offset:-8px}@media(max-height:650px){.pom-extra-subtitle{padding:12px 14px!important}.pom-extra-copy{max-height:3.2em!important;font-size:15.5px!important}}@media(prefers-reduced-motion:reduce){.pom-subtitle{animation:none}}"),
        companion ? h(MotionStage, { slot: companion, controls: true, controlStyle: { right: 18, top: safeTop(82), bottom: "auto", zIndex: 6, fontSize: 10.5, borderRadius: 999, minHeight: 36, background: "rgba(26,25,21,.38)", backdropFilter: "blur(12px)" }, style: { position: "absolute", inset: 0 } }) : null,
        h("div", { "aria-hidden": "true", style: { pointerEvents: "none", position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(18,17,14,.62) 0%,transparent 30%,transparent 45%,rgba(18,17,14,.44) 65%,rgba(18,17,14,.95) 100%)" } }),
        h(Head, { zh: c.name + " 在对面", sub: modeLabels[sess.mode] || modeLabels.notes, onBack: props.onBack, right: exitRight, bg: "transparent", ink: cream, subInk: dim, noLine: true, inkShadow: "0 1px 12px rgba(0,0,0,.35)", barStyle: { position: "relative", zIndex: 5 } }),
        h("div", { className: "flex-1 min-h-0", style: { position: "relative", zIndex: 1 } },
          h("div", { style: { position: "absolute", top: 14, left: 22, pointerEvents: "none", fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".06em", color: dim } }, sess.pausedAt ? "暂时歇一会儿" : onBreak ? "休息段 · 走开也不算溜号" : resumed ? "接着刚才的这一轮" : "这一刻，只做一件事",
            // TA这段在忙他自己的（开场那一次就照日程写好了）
            sess.pack && sess.pack.his ? h("div", { "data-wk": "pomhis", style: { marginTop: 4, fontFamily: F_BODY, fontSize: 11, letterSpacing: 0, color: "rgba(246,239,223,.8)", textShadow: "0 1px 6px rgba(0,0,0,.4)" } }, c.name + " 在：" + sess.pack.his) : null),
          h("button", { className: "pom-poke", "data-wk": "pompoke", "aria-label": "戳一戳陪伴画面", onClick: poke, style: { position: "absolute", inset: 0, width: "100%", border: "none", background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent" } }),
          h("div", { style: { position: "absolute", left: 22, right: 22, bottom: 12, pointerEvents: "none" } },
            subtitle || (tp && tp.play) ? h("div", { key: current.key, className: "pom-subtitle" + (current.extraId ? " pom-extra-subtitle" : ""), "data-wk": "pomsubtitle", "data-pomodoro-subtitle": "", role: "status", "aria-live": "polite", style: { maxWidth: 380, margin: "0 auto", padding: sess.mode === "notes" ? "17px 18px" : "14px 16px", borderRadius: sess.mode === "notes" ? "2px 16px 16px 16px" : 14, background: sess.mode === "notes" ? "rgba(249,243,230,.94)" : "rgba(30,29,25,.65)", border: "1px solid " + (sess.mode === "notes" ? "rgba(255,255,255,.32)" : "rgba(246,239,223,.18)"), backdropFilter: "blur(14px)", boxShadow: "0 8px 28px rgba(0,0,0,.12)", color: sess.mode === "notes" ? "#3c382e" : cream } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".06em", opacity: .6, marginBottom: 7 } }, current.label),
              h("div", { className: current.extraId ? "pom-extra-copy" : undefined, style: { fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1.6, overflowWrap: "anywhere", maxHeight: "min(150px, 23vh)", overflowY: "auto", pointerEvents: "auto" } }, current.text),
              current.extraId ? h("div", { style: { pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 5, fontFamily: F_BODY, fontSize: 10 } },
                h("button", { onClick: () => browseExtra(-1), "aria-label": "上一句陪伴话", style: { minHeight: 40, border: "none", padding: "0 6px", color: "inherit", background: "transparent" } }, "上一句"),
                h("span", null, (extraIndex + 1) + " / " + sess.extraLines.length),
                listenButton,
                h("button", { onClick: () => browseExtra(1), "aria-label": "下一句陪伴话", style: { minHeight: 40, border: "none", padding: "0 6px", color: "inherit", background: "transparent" } }, "下一句")) : null,
              current.extraId ? null : listenButton)
              : h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".06em", color: dim } }, "轻戳画面，看看对座想说什么"))),
        h("div", { className: "shrink-0", "data-wk": "pomtimer", style: { position: "relative", zIndex: 4, padding: "14px 22px calc(env(safe-area-inset-bottom) * 0.4 + 22px)", borderTop: "1px solid rgba(246,239,223,.16)", background: "linear-gradient(180deg,rgba(20,19,16,.12),rgba(20,19,16,.42))" } },
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 } },
            h("div", { style: { minWidth: 0 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".12em", color: dim, marginBottom: 5 } }, clockLabel),
              h("div", { "data-pomodoro-clock": "", style: { fontFamily: F_DISPLAY, fontSize: 46, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em", color: cream } }, fmtClock(sess.kind === "up" ? elapsed : left))),
            h("div", { style: { position: "relative", width: 62, height: 62, flexShrink: 0 } },
              (function () { const RR = 28, C = 2 * Math.PI * RR; return h("svg", { width: 62, height: 62, viewBox: "0 0 62 62", "aria-hidden": "true", style: { position: "absolute", inset: 0, transform: "rotate(-90deg)", pointerEvents: "none" } },
                h("circle", { cx: 31, cy: 31, r: RR, fill: "none", stroke: "rgba(246,239,223,.22)", strokeWidth: 1.5 }),
                h("circle", { cx: 31, cy: 31, r: RR, fill: "none", stroke: "#dac8a4", strokeWidth: 1.5, strokeLinecap: "round", strokeDasharray: C, strokeDashoffset: (C * progress).toFixed(2) })); })(),
              h("button", { onClick: togglePause, style: { position: "absolute", left: 5, top: 5, width: 52, height: 52, borderRadius: 999, background: cream, color: "#39352b", border: "none", fontFamily: F_BODY, fontSize: 12 } }, sess.pausedAt ? "继续" : "暂停"))),
          h("div", { style: { display: "flex", gap: 12, alignItems: "baseline", justifyContent: "space-between", marginTop: 12, fontFamily: F_BODY, fontSize: 11, color: dim } },
            h("span", { style: { overflowWrap: "anywhere", maxHeight: 42, overflowY: "auto", lineHeight: 1.7 } }, sess.task),
            h("span", { style: { flexShrink: 0, fontSize: 10 } }, "已坐住 " + Math.floor(elapsed / 60) + " 分钟" + (sess.kind === "cycle" && sess.rounds ? " · 满 " + sess.rounds + " 轮" : ""))),
          h("div", { "data-wk": "pommore", style: { display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginTop: 12 } },
            h("button", { onClick: () => setAmbOpen(true), "aria-label": "背景音", style: { minHeight: 40, padding: "0 10px", borderRadius: 3, border: "1px solid rgba(246,239,223,.26)", background: "transparent", color: dim, fontFamily: F_BODY, fontSize: 11 } }, "背景音"),
            h("button", { onClick: more, disabled: moreBusy, "aria-label": "再说几句", style: { minHeight: 40, padding: "0 14px", borderRadius: 3, border: "1px solid rgba(246,239,223,.38)", background: "rgba(246,239,223,.06)", color: cream, fontFamily: F_BODY, fontSize: 12, opacity: moreBusy ? .6 : 1 } }, moreBusy ? "正在想新的几句…" : "再说几句"),
            (sess.extraLines || []).length ? h("button", { onClick: () => {
              const choices = tapChoices(sess), index = choices.findIndex(x => x.extraId); if (stopSpeechRef.current) stopSpeechRef.current();
              showSubtitle({ ...choices[index], label: "对座多说几句 · 1/" + sess.extraLines.length });
            }, style: { minHeight: 40, padding: "0 3px", border: "none", background: "transparent", color: dim, fontFamily: F_BODY, fontSize: 10.5 } }, "已留 " + sess.extraLines.length + " 句 · 翻一翻") : h("span", { style: { color: dim, fontFamily: F_BODY, fontSize: 10 } }, "点了才准备新话")),
          sess.moreError ? h("div", { role: "alert", style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11, color: dim } }, "这次没续上，原来的纸条还在。",
            h("details", null, h("summary", { style: { paddingTop: 5, cursor: "pointer" } }, "查看原因"), h("div", { style: { maxHeight: 65, overflowY: "auto", overflowWrap: "anywhere", paddingTop: 5 } }, sess.moreError))) : null),
        ambOpen ? h("div", { role: "dialog", "aria-modal": "true", "aria-label": "背景音", className: "absolute inset-0 flex flex-col", style: { zIndex: 20, background: "#eee6d6", color: "#3c382e" } },
          h(Head, { zh: "背景音", onBack: () => setAmbOpen(false), bg: "transparent", ink: "#3c382e" }),
          h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "16px 24px calc(env(safe-area-inset-bottom) * 0.4 + 24px)" } },
            h(AmbiencePanel, { ink: "#3a3024", fog: "#8a7a5e", line: "rgba(90,72,44,.28)", accent: "#8c743c" }))) : null,
        endOpen ? h("div", { role: "dialog", "aria-modal": "true", "aria-label": "收桌确认", className: "absolute inset-0 flex flex-col", style: { zIndex: 20, background: "#eee6d6", color: "#3c382e" } },
          h(Head, { zh: "收桌", onBack: () => setEndOpen(false), bg: "transparent", ink: "#3c382e" }),
          h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "32px 24px calc(env(safe-area-inset-bottom) * 0.4 + 24px)" } },
            h("div", { style: { borderTop: "1px solid #c9bea7", paddingTop: 22, fontFamily: F_BODY, fontSize: 11, color: "#8d816a" } }, c.name + " · 这一桌"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 27, marginTop: 14 } }, "这一轮先收到这里？"),
            h("p", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.9, color: "#7d725d" } }, "已经坐住的时间会留下。给这一轮留个原因，下次回来接着做。"),
            // 正计时、循环番茄本来就没有「到点」：收桌就是坐完了，算坐满
            sess.kind === "up" || sess.kind === "cycle" ? h("button", { onClick: () => finish("done"), style: { width: "100%", minHeight: 52, marginTop: 22, background: "#3c382e", color: cream, border: "none", fontFamily: F_BODY, fontSize: 14 } }, "坐完了，收桌") : null,
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
          h("input", { value: task, onChange: e => { setTask(e.target.value); setMemoId(""); }, placeholder: "这一轮只做…", maxLength: 24,
            style: { width: "100%", fontFamily: F_DISPLAY, fontSize: 21, color: "#3a3024", background: "transparent",
              border: "none", borderBottom: "1px solid rgba(140,116,60,.28)", outline: "none", padding: "9px 0 7px", marginTop: 8 } }),
          h("label", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 10, fontFamily: F_BODY, fontSize: 11, color: "#8a7a5e" } }, "专注类别",
            h("select", { value: category, "aria-label": "专注类别", onChange: e => setCategory(e.target.value), style: { minHeight: 40, border: "none", borderBottom: "1px solid rgba(140,116,60,.28)", background: "transparent", color: "#3a3024", minWidth: 100 } }, Object.entries(focusCategories).map(([id, label]) => h("option", { key: id, value: id }, label)))),
          // 从备忘录的待办里挑一条当这一轮要做的：收桌时说做完了，那条就顺手勾掉
          memoTodos.length ? h("div", { "data-wk": "pommemo", style: { marginTop: 11 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".12em", color: "#a3925f", marginBottom: 6 } }, "从待办里挑"),
            h("div", { className: "flex flex-wrap", style: { gap: 6 } }, memoTodos.map(r => { const on = memoId === r.id;
              return h("button", { key: r.id, className: "active:opacity-70", onClick: () => { if (on) { setMemoId(""); } else { setMemoId(r.id); setTask(String(r.title).slice(0, 24)); } },
                style: { minHeight: 30, padding: "3px 11px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  border: "1px solid " + (on ? "#8c743c" : "rgba(140,116,60,.3)"), background: on ? "#8c743c" : "transparent", color: on ? "#fdf6d8" : "#6b5a36" } }, r.title); }))) : null,
          // 算进哪门课：一起学里开过课才出现。点一门就挂上，再点一下取消；空着的便签顺手填上课名
          courses.length ? h("div", { style: { marginTop: 11 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".12em", color: "#a3925f", marginBottom: 6 } }, "算进哪门课"),
            h("div", { className: "flex flex-wrap", style: { gap: 6 } }, courses.slice(0, 8).map(function (c) {
              const on = curId === c.id;
              return h("button", { key: c.id, className: "active:opacity-70", onClick: function () {
                  setCurId(on ? "" : c.id); if (!on) setCategory("study");
                  if (!on && (!task.trim() || task === "一起看书" || task === "专注")) setTask(c.subject);
                },
                style: { minHeight: 30, padding: "3px 11px", borderRadius: 999, fontFamily: F_BODY, fontSize: 12.5,
                  border: "1px solid " + (on ? "#8c743c" : "rgba(140,116,60,.3)"), background: on ? "#8c743c" : "transparent", color: on ? "#fdf6d8" : "#6b5a36" } }, c.subject);
            }))) : null),
        // ② 怎么计时：倒计时 / 正计时 / 循环番茄（她 2026-10-07）
        h("div", { "data-wk": "pomkind", className: "flex", style: { gap: 6, marginTop: 22, padding: 3, borderRadius: 999, background: "rgba(255,253,246,.5)", border: "1px solid rgba(90,72,44,.16)" } },
          ["down", "up", "cycle"].map(k => h("button", { key: k, "data-on": kind === k ? "1" : "0", onClick: () => setKind(k), className: "active:opacity-70",
            style: { flex: 1, minHeight: 38, borderRadius: 999, border: "none", fontFamily: F_BODY, fontSize: 12.5, background: kind === k ? t.ink : "transparent", color: kind === k ? t.bg2 : "#6b5b3e" } }, kindLabels[k]))),
        kind === "up" ? h("div", { style: { textAlign: "center", marginTop: 16, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: "#8a7a5e" } },
          "不设时长，从零往上走，想停就点「收桌」。", h("br"), "适合不知道要做多久的事。") : null,
        // 发条计时盘：拧到几分就走几分（正计时不用拧）
        kind === "up" ? null : h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 18 } },
          h(Dial, { t: t, min: min, size: 200, onPick: v => setMin(v) }),
          kind === "cycle" ? h("div", { style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11.5, color: "#8a7a5e", textAlign: "center" } }, "每轮专注这么久，休息 " + CYCLE_BREAK + " 分钟，每 " + CYCLE_LONG_EVERY + " 轮长休 " + CYCLE_LONG + " 分钟，自动接着下一轮") : null,
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
        cur ? h("button", { onClick: () => { setupScroll.current = setupScroller.current ? setupScroller.current.scrollTop : 0; setView("video"); }, "data-pomodoro-video-entry": "", "data-wk": "pomvideoentry", style: { width: "100%", minHeight: 48, marginTop: 14, padding: "12px 14px", textAlign: "left", border: "1px solid rgba(90,72,44,.28)", borderRadius: 3, background: "#fffdf6", color: "#3a3024", fontFamily: F_BODY, fontSize: 12 } }, VideoApi.slotFor(cur.id, "focus") ? "动态形象 · 专注时已挂好，换一段或导出" : "动态形象 · 挂一张图或一段视频，坐在对面陪你") : null,
        // ④ 怎么陪：三张摊在桌上的小卡
        h("div", { style: { marginTop: 22 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#3a3024", marginBottom: 10 } }, "怎么陪"),
          h("div", { className: "flex", style: { gap: 8 } },
            [{ id: "quiet", name: "安静", desc: "轻戳才回应，平时安静陪你" },
             { id: "notes", name: "递纸条", desc: "节点递纸条，轻戳也有回应" },
             { id: "checkpoints", name: "报时", desc: "节点提醒，轻戳看当前进度" }].map(modeCard))),
        // 溜号会被发现：专注中切出去超过 20 秒，回来TA会说你两句
        h("button", { "data-wk": "pomsneak", "data-on": sneakOn ? "1" : "0", onClick: () => setSneakOn(!sneakOn), className: "w-full flex items-center justify-between active:opacity-80",
          style: { marginTop: 14, minHeight: 48, padding: "10px 12px", background: "rgba(255,253,246,.5)", border: "1px solid rgba(90,72,44,.16)", borderRadius: 3, textAlign: "left" } },
          h("span", null,
            h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 13.5, color: "#3a3024" } }, "溜号会被发现"),
            h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: "#8a7a5e", marginTop: 3 } }, "专注中切出去刷别的超过 20 秒，回来TA会知道")),
          h("span", { style: { flexShrink: 0, width: 44, height: 25, borderRadius: 13, padding: 3, background: sneakOn ? "#3a3024" : "rgba(90,72,44,.25)", display: "block" } },
            h("span", { style: { display: "block", width: 19, height: 19, borderRadius: 10, background: "#fffdf6", transform: sneakOn ? "translateX(19px)" : "none", transition: "transform .18s" } }))),
        // ⑤ 背景音：桌边一台小收音机，几层声音拧着叠
        h("div", { style: { marginTop: 22 } },
          h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 6 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#3a3024" } }, "背景音"),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#8a7a5e" } }, "上发条时一起响，退出 App 也不停")),
          h("div", { style: { background: "rgba(255,253,246,.6)", border: "1px solid rgba(90,72,44,.16)", borderRadius: 3, padding: "8px 12px 12px" } },
            h(AmbiencePanel, { ink: "#3a3024", fog: "#8a7a5e", line: "rgba(90,72,44,.28)", accent: "#8c743c" }))),
        h("button", { onClick: start, disabled: busy || !cur, className: "w-full active:opacity-80 disabled:opacity-40",
          style: { marginTop: 24, background: t.ink, color: t.bg2, border: "none", borderRadius: 3,
            padding: "15px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: F_BODY, fontSize: 13, boxShadow: "0 8px 18px rgba(60,45,25,.22)" } },
          h("span", null, busy ? (cur ? cur.name + " 正在摆好纸条…" : "准备中…") : "坐下，上发条"),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16 } }, busy ? "···" : "→"))));
  }

  window.PomodoroLogic = { remainingSec, focusedSec, resumeSession, noteIndex, companionSubtitle, uniqueCompanionLines, genMore, nextCyclePhase };
  window.Pomodoro = Pomodoro;
  // 私聊里那张「一起专注」小卡（群里 2026-10-05：「一起番茄时钟后，能不能返回 char 的私聊给一个交互的小卡片」）。
  //   点一下翻开：做的什么、停了几次、戳了几次；再点收回去。外框和别的分享卡同一张表（components.js shareCardOf）。
  function PomoShareCard({ m }) {
    const t = useTheme(), r = (m && m.pomo) || {};
    const [open, setOpen] = React.useState(false);
    const done = r.status === "done";
    const row = (k, v) => h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 4, gap: 10 } },
      h("span", { style: { color: t.fog } }, k), h("span", { style: { textAlign: "right" } }, v));
    return h("button", { "data-wk": "pomoshare", "data-done": done ? "1" : "0", onClick: () => setOpen(v => !v), className: "active:opacity-90",
      style: { width: 230, textAlign: "left", borderRadius: 14, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 3px 10px rgba(40,30,20,.08)", padding: 0 } },
      h("div", { style: { padding: "10px 12px 11px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 2, color: t.fog } }, "一起专注 · " + (done ? "坐住了" : "先收桌")),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink, marginTop: 3 } }, minutesText(r.focusedMinutes != null ? r.focusedMinutes : r.minutes)),
        r.annotation ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, color: t.ink, marginTop: 6 } }, r.annotation) : null,
        open ? h("div", { style: { marginTop: 8, paddingTop: 6, borderTop: "1px dashed " + t.line } },
          r.task ? row("做的事", r.task) : null,
          row("停下来", (r.pauseCount || 0) + " 次"),
          row("戳了 TA", (r.pokes || 0) + " 次"),
          r.interruptReason ? row("为什么收桌", r.interruptReason) : null) : h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 6 } }, "点开看细节")));
  }
  window.PomoShareCard = PomoShareCard;
})();
