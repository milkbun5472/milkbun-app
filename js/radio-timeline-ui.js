// 默认读字；显式选择单句或本章连播，不在后台生成下一章。
(function (root) {
  "use strict";
  function RadioTimelineScreen(p) {
    const R = root.RadioTimeline;
    const [branches, setBranches] = useState(() => loadJSON(R.KEY, []));
    const data = useRef(branches); data.current = branches;
    const [selected, select] = useState("");
    const [charId, setChar] = useState("");
    const [topic, setTopic] = useState("");
    const [limits, setLimits] = useState("");
    // 节目类型这一栏（她 2026-09-12 排的第三条）。名字那一格自由填；
    // 四根轴各自决定提示词里那几句话怎么写，默认值就是今天的样子。
    const [show, setShow] = useState(() => root.RadioTimeline.normalizeShow(null));
    const [frequency, tune] = useState(1);
    const [fragmentId, setFragment] = useState("");
    const [lineIndex, setLine] = useState(-1);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [talkOpen, setTalkOpen] = useState(false);
    // 纠正那一格默认收着（她 2026-09-13：「下面很多条条框框能不能收纳整齐一点」）
    const [noteOpen, setNoteOpen] = useState(false);
    const [inputMode, setInputMode] = useState("talk");
    const [keepPlaying, setKeepPlaying] = useState(false);
    const cursor = useRef(-1), completed = useRef(-1);
    // 谁陪你听（""＝没有人）。⚠️v67.57 之前这儿是个 boolean，陪听的人写死成
    // 广播里那个人本人——于是「暂停问他」等于当着当事人的面问当事人，他什么都知道。
    // 可隔离那一套代码早就按 companionId 分账了（reveal 记 companionId、companionContext
    // 按它筛、companionPrompt 也收 companionId）：能力一直在，只是界面把它焊死了。
    const [companionId, setCompanion] = useState("");
    const [question, setQuestion] = useState("");
    const [correction, setCorrection] = useState("");
    // 打进他节目的那句话。⚠️马甲用的是匿名箱那一个（x_anonMe），不另立一个身份：
    //   同一个人戴同一张面具，他在两处冒出来的猜测才是同一条线（施工规则/one-public-mechanism.md）。
    const [callSay, setCallSay] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [playing, setPlaying] = useState(false);
    const lock = useRef(false), alive = useRef(true), player = useRef(null);
    const scroll = useRef(null), listScroll = useRef(0), playbackScroll = useRef(0);
    const branch = branches.find(x => x.id === selected);
    const fragment = branch && branch.fragments.find(x => x.id === fragmentId);
    const queue = branch && fragment ? R.playlist(branch, fragment.id) : [];
    const paragraphs = branch && fragment ? R.replayParagraphs(branch, fragment.id) : [];
    const heard = paragraphs.flat();
    const current = queue[lineIndex];
    const currentPart = current && branch.fragments.find(f => f.id === current.fragmentId);
    const currentEra = R.ERAS[frequency];
    const companion = companionId ? (p.characters || []).find(c => c.id === companionId) : null;
    const uid = () => "rt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
    const stop = () => { if (player.current) player.current.stop(); };
    useEffect(() => {
      alive.current = true; root.RadioUI.Engine.setPower(false);
      const hidden = () => { if (document.hidden) stop(); };
      document.addEventListener("visibilitychange", hidden);
      return () => { alive.current = false; stop(); document.removeEventListener("visibilitychange", hidden); };
    }, []);
    useEffect(() => { if (scroll.current) scroll.current.scrollTop = selected ? 0 : listScroll.current; }, [selected]);
    useEffect(() => { if (scroll.current) scroll.current.scrollTop = historyOpen || talkOpen ? 0 : playbackScroll.current; }, [historyOpen, talkOpen]);
    const save = next => { saveJSON(R.KEY, next); data.current = next; setBranches(next); };
    const update = (id, fn) => save(data.current.map(x => x.id === id ? fn(x) : x));
    const run = async (work, boundary, continuing) => {
      if (lock.current) return;
      lock.current = true; setBusy(true); setError("");
      try {
        if (boundary && player.current) await player.current.pauseAfterLine();
        else if (!continuing) stop();
        if (alive.current) await work();
      } catch (e) { if (alive.current) setError(e.message || "这次没有接上，请手动重试。"); }
      finally { lock.current = false; if (alive.current) setBusy(false); }
    };
    const resetPlayback = () => { stop(); setHistoryOpen(false); setTalkOpen(false); setInputMode("talk"); setFragment(""); setLine(-1); cursor.current = completed.current = -1; setQuestion(""); setCorrection(""); setCallSay(""); setError(""); };
    const back = () => { if (lock.current) return; if (historyOpen || talkOpen) { setHistoryOpen(false); setTalkOpen(false); return; } resetPlayback(); if (selected) select(""); else p.onBack(); };
    const open = id => { listScroll.current = scroll.current ? scroll.current.scrollTop : 0; resetPlayback(); setCompanion(""); select(id); };
    const newBranch = () => {
      try {
        const c = p.characters.find(x => x.id === charId);
        const b = R.create(c, topic, limits, p.loreFor(c, topic), uid(), show);
        save(data.current.concat(b)); open(b.id);
      } catch (e) { setError(e.message); }
    };
    const generate = () => run(async () => {
      const b = branch, era = currentEra.id;
      const raw = await p.onFragment(b, era);
      const f = R.accept(raw, era, uid());
      if (!alive.current) return;
      update(b.id, x => ({ ...x, fragments: x.fragments.concat(f) }));
      setFragment(f.id); setLine(-1); cursor.current = completed.current = -1;
    });
    // 打进去：插在当前句之后；正文与旧语音定位不改，只另存插播和锚点。
    // ⚠️**播出去的才算数**——这儿只是把电话接进来，一个字都还没播；
    //   要等她一句句放出去，它才进见闻、才进他下一章读得到的那一栏（RadioTimeline.airedCalls）。
    const callIn = () => run(async () => {
      const b = data.current.find(x => x.id === branch.id), era = currentEra.id, say = callSay.trim();
      if (!say || !fragment) return;
      const at = R.playlist(b, fragment.id)[cursor.current];
      const anchor = { fragmentId: at ? at.fragmentId : fragment.id, index: at ? at.index : -1, rootId: fragment.id };
      const raw = await p.onCall(b, era, say, anchor);
      const f = R.acceptCall(raw, era, uid(), p.myMask, say, b.name);
      if (!alive.current) return;
      update(b.id, x => R.insertCall(x, anchor, f));
      const position = at ? R.playlist(data.current.find(x => x.id === b.id), fragment.id).findIndex(x => x.fragmentId === at.fragmentId && x.index === at.index) : -1;
      cursor.current = position; completed.current = position; setLine(position);
      setCallSay(""); setInputMode("talk");
    }, true);
    // 手动下一句、回放选句及未来的播完回调共用这一处切句和听闻落库。
    const revealLine = index => {
      if (!fragment) return;
      if (!Number.isInteger(index) || index < 0 || index >= queue.length) return;
      const row = queue[index];
      update(branch.id, x => R.reveal(x, row.fragmentId, row.index, companionId));
      cursor.current = index; completed.current = -1; setLine(index);
    };
    const showLine = index => { stop(); revealLine(index); };
    const nextLine = () => showLine(lineIndex + 1);
    const read = continuous => {
      stop(); setError("");
      if (!root.speechSynthesis || !root.SpeechSynthesisUtterance) { setError("当前设备不支持系统朗读，可以继续看文字。"); return; }
      let utterance = null;
      player.current = R.createPlayback({
        reveal: revealLine,
        ended: index => { completed.current = index; },
        state: value => { if (alive.current) setPlaying(value); },
        cancel: () => { if (utterance) { utterance.onend = utterance.onerror = null; root.speechSynthesis.cancel(); utterance = null; } },
        error: () => { if (alive.current) setError("朗读中断了，点连续收听可从当前句重试；也可以手动看下一句。"); },
        speak: (text, end, fail) => {
          const u = new root.SpeechSynthesisUtterance(text); utterance = u;
          u.onend = () => { if (utterance === u) utterance = null; end(); }; u.onerror = fail;
          root.speechSynthesis.speak(u);
        }
      });
      player.current.start(queue, Math.max(0, continuous && completed.current === lineIndex ? lineIndex + 1 : lineIndex), continuous);
    };
    const ask = () => run(async () => {
      const b = data.current.find(x => x.id === branch.id), q = question.trim();
      if (!q || !companionId) return;
      const raw = await p.onCompanion(b, q, companionId, keepPlaying);
      if (!raw || typeof raw.say !== "string" || !raw.say.trim()) throw Error("这次没有收到完整回应，问题还留着。");
      if (!alive.current) return;
      update(b.id, x => ({ ...x, talks: x.talks.concat({ companionId: companionId, question: q, answer: raw.say.trim() }) }));
      setQuestion("");
    }, !keepPlaying, keepPlaying);
    // ── 界面：一台真的收音机（她 2026-09-13）───────────────────────────
    // 她原话：「界面很丑……比如做个收音机然后左右两边有可以拧的按钮，然后下面也很多
    // 条条框框能不能收纳整齐一点……反正就是还是换个 app 它形状还成立吗」。
    // 所以这一页按【一台机器】来画，不是按一摞表单：
    //   · 上半是机器正面（不滚）：左旋钮＝调频，中间是调谐窗，右旋钮＝声音；
    //   · 下半只剩【正文】一件事（唯一的滚动区）；
    //   · 原来那一摞按钮收成机器下沿的一排铜键（新章节／回听／陪听／纠正）。
    // ⚠️配色跟旧电台同一份（RadioUI.NIGHT）：两块地方是同一台机器，不该是两个皮。
    const NT = (root.RadioUI && root.RadioUI.NIGHT)
      || { ink: "#efe7da", dim: "#a89a86", faint: "#6f6558", line: "rgba(239,231,218,.16)", warm: "#e3a86a" };
    const BRASS = "#c9a15e";
    const skin = { background: "linear-gradient(168deg,#3a2d23,#241c16 58%,#181310)", color: NT.ink, fontFamily: F_BODY };
    const inputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: 11, border: "1px solid " + NT.line,
      borderRadius: 9, background: "rgba(12,10,9,.55)", color: NT.ink, fontSize: 15, fontFamily: F_BODY };
    // 铜键：这一页所有按钮只有这一种（黄铜、方角、按下去暗一下）
    const btn = (label, click, disabled, hot) => h("button", { type: "button", disabled: busy || disabled, onClick: click,
      className: "active:opacity-60",
      style: { minHeight: 44, maxWidth: "100%", margin: "0 6px 8px 0", padding: "9px 13px",
        border: "1px solid " + (hot ? "rgba(201,161,94,.75)" : NT.line), borderRadius: 7,
        background: hot ? "rgba(201,161,94,.14)" : "rgba(255,255,255,.03)",
        color: hot ? BRASS : NT.ink, fontFamily: F_BODY, fontSize: 13,
        opacity: busy || disabled ? .38 : 1 } }, label);
    const field = (label, child) => h("label", { style: { display: "block", marginBottom: 14 } },
      h("div", { style: { marginBottom: 6, fontSize: 12.5, color: NT.dim } }, label), child);
    const title = (txt, style) => h("div", { style: Object.assign({ fontFamily: F_DISPLAY, fontSize: 17, color: NT.ink, margin: "0 0 8px" }, style || {}) }, txt);

    // 旋钮：一颗能拧的钮。⚠️它只是【那几颗真键的脸】——真正可点的还是下面带名字的键，
    //   不然读屏和自检都会摸到一颗没有名字的圆。拧到第几格用角度表示。
    const knob = (o) => h("div", { style: { width: 56, flexShrink: 0, textAlign: "center" } },
      h("div", { "aria-hidden": "true", style: {
        width: 46, height: 46, margin: "0 auto", borderRadius: 999, position: "relative",
        background: "radial-gradient(circle at 34% 28%, #6b584a, #2b221b 72%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.18), 0 3px 8px rgba(0,0,0,.45)",
        border: "1px solid rgba(0,0,0,.5)", transition: "transform .25s ease",
        transform: "rotate(" + o.deg + "deg)"
      } },
        h("span", { style: { position: "absolute", left: "50%", top: 5, width: 2.5, height: 14, marginLeft: -1.25,
          borderRadius: 2, background: BRASS, boxShadow: "0 0 6px rgba(201,161,94,.6)" } })),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: NT.faint, marginTop: 7, letterSpacing: ".08em" } }, o.zh),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: BRASS, marginTop: 2 } }, o.val));

    // 机器下沿那一排铜键：**一颗一行字**。⚠️不写死 nowrap 的话，「接收这个频率的新章节」
    //   在 320 宽上会被挤成六行，那一排能长到两百多像素，底下那条就被顶出屏幕了。
    const keyBtn = (label, click, disabled, hot) => h("button", { type: "button", disabled: busy || disabled, onClick: click,
      className: "active:opacity-60",
      style: { flexShrink: 0, minHeight: 40, padding: "8px 12px", whiteSpace: "nowrap",
        border: "1px solid " + (hot ? "rgba(201,161,94,.75)" : NT.line), borderRadius: 7,
        background: hot ? "rgba(201,161,94,.14)" : "rgba(255,255,255,.03)",
        color: hot ? BRASS : NT.ink, fontFamily: F_BODY, fontSize: 12.5,
        opacity: busy || disabled ? .38 : 1 } }, label);
    // 只有名字看不见，名字本身一个字不少（见下面那条注释）
    const SR = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };
    const soundKey = (name, glyph, click, disabled) => h("button", { type: "button", disabled: disabled, onClick: click,
      className: "active:opacity-60",
      style: { minHeight: 30, width: 26, borderRadius: 6, border: "1px solid " + NT.line, background: "transparent",
        color: disabled ? NT.faint : NT.dim, fontSize: 11, position: "relative", opacity: disabled ? .45 : 1 } },
      // ⚠️键上那个符号【不能是字】：写成字的话 textContent 会变成「停暂停声音」，
      //   读屏念一遍半，自检也认不出来。所以符号用画的（一条杠／两条杠／一个方块）。
      h("span", { "aria-hidden": "true", style: Object.assign({ display: "block", margin: "0 auto" }, glyph) }),
      h("span", { style: SR }, name));

    // 机器正面：左调频、中调谐窗、右声音
    const soundState = playing ? "念着" : lineIndex < 0 ? "静" : "停着";
    // ⚠️画成【函数】不是常量：还没选频道时 branch 是空的，常量会在建线那一屏就先炸一次
    const face = () => h("div", { className: "shrink-0", "data-radio-face": true, style: { padding: "6px 14px 0" } },
      h("div", { style: {
        borderRadius: 16, padding: "14px 12px 12px",
        background: "linear-gradient(178deg,rgba(255,255,255,.06),rgba(0,0,0,.28))",
        border: "1px solid " + NT.line, boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)"
      } },
        h("div", { className: "flex items-center", style: { gap: 10 } },
          // 左：调频（拧过去／拧回来都在这颗钮底下那两颗小键上）
          h("div", null,
            knob({ deg: -38 + frequency * 38, zh: "调频", val: currentEra.label }),
            h("div", { className: "flex", style: { gap: 4, marginTop: 6, justifyContent: "center" } },
              h("button", { type: "button", "aria-label": "往回拧", disabled: busy || frequency <= 0,
                onClick: () => { resetPlayback(); tune(Math.max(0, frequency - 1)); },
                className: "active:opacity-60",
                style: { minHeight: 30, width: 26, borderRadius: 6, border: "1px solid " + NT.line, background: "transparent", color: NT.dim, fontSize: 12 } }, "◂"),
              h("button", { type: "button", "aria-label": "往前拧", disabled: busy || frequency >= R.ERAS.length - 1,
                onClick: () => { resetPlayback(); tune(Math.min(R.ERAS.length - 1, frequency + 1)); },
                className: "active:opacity-60",
                style: { minHeight: 30, width: 26, borderRadius: 6, border: "1px solid " + NT.line, background: "transparent", color: NT.dim, fontSize: 12 } }, "▸"))),
          // 中：调谐窗。玻璃底下是频率、台名、和一根走到哪儿的细线
          h("div", { className: "flex-1 min-w-0", style: {
            borderRadius: 10, padding: "10px 12px", minWidth: 0, position: "relative",
            background: "linear-gradient(180deg,rgba(240,217,168,.14),rgba(0,0,0,.4))",
            border: "1px solid rgba(201,161,94,.28)", boxShadow: "inset 0 0 18px rgba(227,168,106,.12)"
          } },
            h("div", { className: "flex items-baseline", style: { gap: 5, flexWrap: "nowrap", whiteSpace: "nowrap" } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 27, lineHeight: 1, color: NT.ink, letterSpacing: "-.02em" } }, currentEra.freq),
              h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: NT.faint, flexShrink: 0 } }, "兆赫")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: BRASS, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              branch.name + (fragment ? " · " + fragment.title : "")),
            // 走到第几句：一根细线，不摆数字条
            h("div", { style: { height: 2, borderRadius: 2, marginTop: 8, background: "rgba(255,255,255,.09)", overflow: "hidden" } },
              h("div", { style: { height: "100%", width: (queue.length ? Math.max(2, Math.round((lineIndex + 1) / queue.length * 100)) : 0) + "%", background: BRASS, transition: "width .3s ease" } })),
            // ⚠️调频这一格仍然是个【真的 range】：读屏要摸得到，手指也能在窗上直接拖。
            //   只是它不该画成一根灰色滑杆压在玻璃上——摊平铺在调谐窗上、透明，
            //   看得见的是上面那根走针和左边那颗钮。
            h("input", { type: "range", min: 0, max: R.ERAS.length - 1, step: 1, value: frequency, "aria-label": "调频",
              disabled: busy, style: { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, margin: 0, cursor: "pointer" },
              onChange: e => { resetPlayback(); tune(Number(e.target.value)); } })),
          // 右：声音（三格——静、念一句、连着念）
          // ⚠️键上画的是符号，可【名字要整整齐齐地在那儿】：读屏念的、自检认的都是
          //   按钮的文字。所以文字照写，只是用 clip 收起来不占地方——
          //   拿 aria-label 顶替会让 textContent 变成「停」，自检当场摸空（v67.71 踩过）。
          h("div", null,
            knob({ deg: playing ? 38 : lineIndex < 0 ? -38 : 0, zh: "声音", val: soundState }),
            h("div", { className: "flex", style: { gap: 4, marginTop: 6, justifyContent: "center" } },
              soundKey("朗读当前句（系统音色）", { width: 11, height: 2, borderRadius: 2, background: "currentColor" }, () => read(false), busy || lineIndex < 0),
              soundKey("连续收听（系统音色）", { width: 11, height: 2, borderRadius: 2, background: "currentColor", boxShadow: "0 4px 0 currentColor", marginTop: -2 }, () => read(true),
                busy || playing || (completed.current === lineIndex && lineIndex === queue.length - 1)),
              soundKey("暂停声音", { width: 7, height: 7, borderRadius: 1.5, background: "currentColor" }, stop, busy || !playing)))),
        // 喇叭网：一排细孔，机器的下半张脸
        h("div", { "aria-hidden": "true", style: {
          height: 16, marginTop: 11, borderRadius: 5, opacity: .5,
          backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,.10) 0 1.5px, transparent 1.5px 5px)"
        } }),
        // 机器下沿那一排铜键：原来散在正文里的那一摞，全收到这儿
        h("div", { "data-radio-keys": true, className: "flex items-center", style: { gap: 6, marginTop: 10, overflowX: "auto", paddingBottom: 2 } },
          keyBtn("接收这个频率的新章节", generate),
          keyBtn("已听回放（" + heard.length + "）", () => { stop(); playbackScroll.current = scroll.current ? scroll.current.scrollTop : 0; setHistoryOpen(true); }, !heard.length),
          keyBtn(noteOpen ? "收起纠正" : "这不像他", () => setNoteOpen(!noteOpen), !fragment, noteOpen),
          h("select", { "aria-label": "谁陪你一起听", value: companionId, disabled: busy,
            onChange: e => { stop(); setCompanion(e.target.value); },
            style: { flexShrink: 0, minHeight: 40, padding: "0 8px", borderRadius: 7, border: "1px solid " + NT.line,
              background: "rgba(255,255,255,.03)", color: companion ? BRASS : NT.dim, fontFamily: F_BODY, fontSize: 12.5, maxWidth: 150 } },
            h("option", { value: "" }, "没有人，我自己听"),
            (p.characters || []).map(c => h("option", { key: c.id, value: c.id },
              c.id === branch.charId ? c.name + "（广播里的就是他）" : c.name))),
          companion ? keyBtn("陪听对话（" + R.companionContext(branch, companion.id).talks.length + "）",
            () => { stop(); playbackScroll.current = scroll.current ? scroll.current.scrollTop : 0; setTalkOpen(true); },
            !R.companionContext(branch, companion.id).talks.length) : null,
          companion ? h("label", { style: { flexShrink: 0, fontSize: 11.5, color: NT.faint, whiteSpace: "nowrap", display: "flex", alignItems: "center", minHeight: 40 } },
            h("input", { type: "checkbox", checked: keepPlaying, disabled: busy, onChange: e => setKeepPlaying(e.target.checked), style: { marginRight: 5 } }), "聊天时节目继续播放") : null)));

    return h("div", { className: "h-full flex flex-col", style: skin, "data-radio-timeline": true },
      h(Head, { zh: historyOpen ? "已听回放" : talkOpen ? "陪听对话" : "时间线电台",
        sub: historyOpen && fragment ? fragment.title : (branch ? R.showOf(branch).label || branch.topic : "调到过去、现在或未来"),
        bg: "transparent", ink: NT.ink, subInk: NT.faint, lineInk: NT.line, onBack: back }),
      branch && !historyOpen && !talkOpen ? face() : null,
      h("div", { ref: scroll, "data-radio-scroll": true, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "14px 16px 20px", overflowWrap: "anywhere" } },
        historyOpen && fragment ? h("section", { "data-radio-history": true },
          h("p", { style: { fontSize: 12.5, color: NT.dim, lineHeight: 1.9, marginTop: 0 } }, "本章已听过的句子。选一句回到播放屏重听，未播内容不会提前展开。"),
          paragraphs.map((rows, i) => h("p", { key: i, "data-radio-paragraph": true, style: { margin: "0 0 18px", lineHeight: 2.05, fontSize: 16.5, color: NT.ink } },
            rows.map(l => h("button", { key: l.fragmentId + ":" + l.index, "aria-label": "第" + (l.position + 1) + "句 · " + l.text,
              onClick: () => { showLine(l.position); setHistoryOpen(false); }, style: { display: "inline", padding: 0, border: 0, background: "transparent", color: "inherit", font: "inherit", lineHeight: "inherit", textAlign: "left", cursor: "pointer" } }, l.text + " ")))),
          btn("返回当前句", () => setHistoryOpen(false))
        ) : talkOpen && branch && companion ? h("section", { "data-radio-talk-history": true },
          R.companionContext(branch, companion.id).talks.map((t, i) => h("div", { key: i, style: { lineHeight: 1.85, marginBottom: 18 } },
            h("p", { style: { margin: 0, color: NT.dim } }, "你：" + t.question),
            h("p", { style: { margin: "4px 0 0" } }, companion.name + "：" + t.answer))),
          btn("返回电台", () => setTalkOpen(false))
        ) : !branch ? h(React.Fragment, null,
          h("p", { style: { fontSize: 12.5, lineHeight: 1.9, color: NT.dim, marginTop: 0 } }, "调到过去、现在或未来，听见他的另一种可能。内容不会成为主线史实。"),
          field("想听谁的时间线", h("select", { style: inputStyle, value: charId, onChange: e => setChar(e.target.value) }, h("option", { value: "" }, "选择角色"), p.characters.map(c => h("option", { key: c.id, value: c.id }, c.name)))),
          field(show.tell === "story" ? "想听什么样的故事" : "想探索的事／分岔条件", h("textarea", { style: inputStyle, rows: 3, value: topic, onChange: e => setTopic(e.target.value) })),
          // ⚠️名字那一格是空白的：写「深夜怪谈」也行，写一个我们没想到的东西也行。
          //   代码只管下面这四根轴，不拿一张写死的类型表去顶替想象力。
          title("这是一档什么节目"),
          field("节目名（可留空）", h("input", { style: inputStyle, value: show.label, placeholder: "比如：深夜怪谈", onChange: e => setShow({ ...show, label: e.target.value }) })),
          R.SHOW_AXES.map(ax => field(ax.zh, h("select", { style: inputStyle, value: show[ax.key], onChange: e => setShow({ ...show, [ax.key]: e.target.value }) },
            ax.opts.map(o => h("option", { key: o.id, value: o.zh === undefined ? o.id : o.id }, o.zh))))),
          field("已知设定与不想出现的内容（可留空）", h("textarea", { style: inputStyle, rows: 2, value: limits, onChange: e => setLimits(e.target.value) })),
          btn("建立这条时间线", newBranch, !charId || !topic.trim(), true),
          h("p", { style: { fontSize: 11.5, color: NT.faint, lineHeight: 1.8 } }, "建立不调用模型；接收新片段和陪听回应时才各调用一次。"),
          title("留在这里的频率", { marginTop: 22 }),
          branches.map(b => h("div", { key: b.id, style: { marginBottom: 6 } },
            btn(b.name + " · " + (R.showOf(b).label ? R.showOf(b).label + " · " : "") + b.topic, () => open(b.id)))),
          btn("打开旧电台", p.onLegacy)
        ) : h(React.Fragment, null,
          // 这一屏只剩【正文】一件事：机器在上面，纸在下面
          !fragment ? h("div", { style: { fontSize: 12.5, color: NT.faint, lineHeight: 2, paddingTop: 6 } },
            "拧到 " + currentEra.label + "。按机器下沿那颗「接收这个频率的新章节」，这一格上就会有东西。",
            branch.fragments.filter(x => x.era === currentEra.id && !x.insert).length
              ? h("div", { style: { marginTop: 14 } },
                h("div", { style: { fontSize: 11, color: NT.faint, marginBottom: 6 } }, "这一格上已经有的："),
                branch.fragments.filter(x => x.era === currentEra.id && !x.insert).map(f =>
                  h("div", { key: f.id }, btn("回听 · " + f.title, () => { stop(); setFragment(f.id); setLine(-1); cursor.current = completed.current = -1; }))))
              : null)
          : h("section", null,
            (function () {
              const sh = R.showOf(branch);
              return h("div", { "data-radio-show": true, style: { fontSize: 11, color: NT.faint, marginBottom: 4 } },
                (sh.label ? sh.label + " · " : "") + R.SHOW_AXES.map(ax => (ax.opts.find(o => o.id === sh[ax.key]) || {}).zh).filter(Boolean).join(" · "));
            })(),
            h("div", { style: { fontSize: 11, color: NT.faint, marginBottom: 10 } },
              h("span", { role: "status" }, "广播中 · " + (playing ? "正在朗读" : lineIndex < 0 ? "尚未开始" : "已暂停，可接话"))),
            current ? h("div", { "data-radio-current": true, "aria-live": "polite", style: { marginBottom: 16 } },
              h("small", { style: { color: BRASS, fontSize: 11 } }, (currentPart.call ? "插播 · " : "") + "第" + (lineIndex + 1) + "句 · " + (current.speaker || branch.name)),
              h("div", { style: { fontSize: 16.5, lineHeight: 2.05, marginTop: 7, color: NT.ink } }, current.text)) : null,
            // 他心里那句「这人是不是我认识的某某」——没播到的电话等于没发生，所以播出去了才给她看。
            currentPart && currentPart.call && currentPart.guess && R.heardLines(branch, currentPart.id).length
              ? h("p", { "data-radio-guess": true, style: { marginTop: 12, fontSize: 13, lineHeight: 1.9, color: NT.dim, borderLeft: "2px solid " + NT.line, paddingLeft: 10 } },
                  "挂掉之后他心里那句：" + currentPart.guess)
              : null,
            // 纠正那一格默认是收着的：按「这不像他」才展开（她 2026-09-13 要的「合起来」）
            noteOpen ? h("div", { style: { marginTop: 18, paddingTop: 14, borderTop: "1px dashed " + NT.line } },
              field("这不像他？写下你的纠正", h("textarea", { style: inputStyle, rows: 2, value: correction, onChange: e => setCorrection(e.target.value), disabled: busy })),
              btn("记作本分支约束", () => { update(branch.id, x => ({ ...x, corrections: x.corrections.concat(correction.trim()) })); setCorrection(""); setNoteOpen(false); }, !correction.trim()),
              h("small", { style: { display: "block", lineHeight: 1.8, color: NT.faint, fontSize: 11 } }, "纠正用于之后的新片段，旧片段本版不自动重写。")) : null,
            // 这一格上的章节：正在听的那一条也留着（从头再听一遍走的就是它）
            h("div", { style: { marginTop: 20, paddingTop: 12, borderTop: "1px dashed " + NT.line } },
              h("div", { style: { fontSize: 11, color: NT.faint, marginBottom: 6 } }, "这一格上的章节："),
              h("div", { className: "flex", style: { flexWrap: "wrap" } },
                branch.fragments.filter(x => x.era === currentEra.id && !x.insert).map(f =>
                  btn("回听 · " + f.title, () => { stop(); setFragment(f.id); setLine(-1); cursor.current = completed.current = -1; }, false, f.id === fragment.id)))),
            companion ? h("p", { style: { fontSize: 11.5, color: NT.faint, lineHeight: 1.9, marginTop: 18 } },
              "身边的" + companion.name + "只知道共同听见的内容；打进电台时，他仍留在这边陪听。") : null)
        ),
        busy ? h("p", { role: "status", style: { color: NT.dim, fontSize: 12.5 } }, "正在接收；不会自动重试。") : null,
        error && (!branch || historyOpen || talkOpen) ? h("p", { role: "alert", style: { color: "#e08b76", whiteSpace: "pre-wrap", fontSize: 12.5 } }, error) : null
      ),
      // 底下那一条：往下走的那一键 + 说话那一格。⚠️整页只有这一条，不再是一摞
      branch && !historyOpen && !talkOpen ? h("section", { "data-radio-composer": true, className: "shrink-0", style: { padding: "8px 12px", paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba(10,8,7,.72)", borderTop: "1px solid " + NT.line } },
        busy ? h("small", { role: "status", style: { color: NT.faint } }, "正在接收；播放中的这一句会先说完。") : null,
        error ? h("div", { role: "alert", style: { color: "#e08b76", fontSize: 12, maxHeight: 60, overflowY: "auto", overflowWrap: "anywhere" } }, error) : null,
        h("div", { className: "flex items-center", style: { gap: 8, marginBottom: 2 } },
          h("div", { style: { flex: 1, minWidth: 0 } },
            btn(lineIndex < 0 ? "开始收听这一句" : "继续下一句", nextLine, !fragment || lineIndex >= queue.length - 1, true)),
          btn(inputMode === "call" ? "回到陪听" : "接入故事", () => setInputMode(inputMode === "call" ? "talk" : "call"), !fragment)),
        inputMode === "call" ? h("div", { "data-radio-callin": true },
          h("p", { style: { fontSize: 11.5, color: NT.faint, margin: "0 0 6px" } }, "马甲：" + ((p.myMask && p.myMask.name) || "一个没报名字的人") + "。插播结束接回原文，原语音保留；陪听者不进入故事。"),
          h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
            h("textarea", { "aria-label": "对着话筒说一句", placeholder: "对着话筒说一句…", style: { ...inputStyle, flex: 1 }, rows: 2, value: callSay, disabled: busy, onChange: e => setCallSay(e.target.value) }),
            btn("打进去", callIn, !fragment || !callSay.trim())))
        : companion ? (function () {
          const mine = R.companionContext(branch, companion.id), latest = mine.talks.at(-1);
          // ⚠️底下这一条【只留一行】：小屏上（568 高）它一超过两行就把正文挤出屏幕。
          //   他上一句回话收成一行，翻旧账和「边听边聊」那个勾都搬到机器下沿那一排去了。
          return h(React.Fragment, null,
            latest ? h("div", { style: { lineHeight: 1.6, fontSize: 12.5, color: NT.faint, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, companion.name + "：" + latest.answer) : null,
            h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
              h("textarea", { "aria-label": "和他说一句", placeholder: "和他说一句…", style: { ...inputStyle, flex: 1 }, rows: 1, value: question, disabled: busy, onChange: e => setQuestion(e.target.value) }),
              btn("问问他", ask, !question.trim() || !mine.heard.length, true)));
        })() : h("small", { style: { color: NT.faint } }, "选一位陪听者，就能在这里边听边聊。")) : null);
  }
  root.RadioTimelineScreen = RadioTimelineScreen;
})(typeof window !== "undefined" ? window : globalThis);
