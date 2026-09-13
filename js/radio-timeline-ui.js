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
    const heard = branch && fragment ? R.heardLines(branch, fragment.id) : [];
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
    useEffect(() => { if (scroll.current) scroll.current.scrollTop = historyOpen ? 0 : playbackScroll.current; }, [historyOpen]);
    const save = next => { saveJSON(R.KEY, next); data.current = next; setBranches(next); };
    const update = (id, fn) => save(data.current.map(x => x.id === id ? fn(x) : x));
    const run = async work => {
      if (lock.current) return;
      lock.current = true; setBusy(true); setError(""); stop();
      try { await work(); } catch (e) { if (alive.current) setError(e.message || "这次没有接上，请手动重试。"); }
      finally { lock.current = false; if (alive.current) setBusy(false); }
    };
    const resetPlayback = () => { stop(); setHistoryOpen(false); setFragment(""); setLine(-1); setQuestion(""); setCorrection(""); setCallSay(""); setError(""); };
    const back = () => { if (lock.current) return; if (historyOpen) { setHistoryOpen(false); return; } resetPlayback(); if (selected) select(""); else p.onBack(); };
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
      setFragment(f.id); setLine(-1);
    });
    // 打进去：她那句是她自己写的，模型只写他这一头；合成一个片段挂在当前频率上。
    // ⚠️**播出去的才算数**——这儿只是把电话接进来，一个字都还没播；
    //   要等她一句句放出去，它才进见闻、才进他下一章读得到的那一栏（RadioTimeline.airedCalls）。
    const callIn = () => run(async () => {
      const b = branch, era = currentEra.id, say = callSay.trim();
      if (!say) return;
      const raw = await p.onCall(b, era, say);
      const f = R.acceptCall(raw, era, uid(), p.myMask, say, b.name);
      if (!alive.current) return;
      update(b.id, x => ({ ...x, fragments: x.fragments.concat(f) }));
      setCallSay(""); setFragment(f.id); setLine(-1);
    });
    // 手动下一句、回放选句及未来的播完回调共用这一处切句和听闻落库。
    const revealLine = index => {
      if (!fragment) return;
      if (!Number.isInteger(index) || index < 0 || index >= fragment.lines.length) return;
      update(branch.id, x => R.reveal(x, fragment.id, index, companionId));
      setLine(index);
    };
    const showLine = index => { stop(); revealLine(index); };
    const nextLine = () => showLine(lineIndex + 1);
    const read = continuous => {
      stop(); setError("");
      if (!root.speechSynthesis || !root.SpeechSynthesisUtterance) { setError("当前设备不支持系统朗读，可以继续看文字。"); return; }
      let utterance = null;
      player.current = R.createPlayback({
        reveal: revealLine,
        state: value => { if (alive.current) setPlaying(value); },
        cancel: () => { if (utterance) { utterance.onend = utterance.onerror = null; root.speechSynthesis.cancel(); utterance = null; } },
        error: () => { if (alive.current) setError("朗读中断了，点连续收听可从当前句重试；也可以手动看下一句。"); },
        speak: (text, end, fail) => {
          const u = new root.SpeechSynthesisUtterance(text); utterance = u;
          u.onend = () => { if (utterance === u) utterance = null; end(); }; u.onerror = fail;
          root.speechSynthesis.speak(u);
        }
      });
      player.current.start(fragment.lines, Math.max(0, lineIndex), continuous);
    };
    const ask = () => run(async () => {
      const b = branch, q = question.trim();
      if (!q || !companionId) return;
      const raw = await p.onCompanion(b, q, companionId);
      if (!raw || typeof raw.say !== "string" || !raw.say.trim()) throw Error("这次没有收到完整回应，问题还留着。");
      if (!alive.current) return;
      update(b.id, x => ({ ...x, talks: x.talks.concat({ companionId: companionId, question: q, answer: raw.say.trim() }) }));
      setQuestion("");
    });
    const skin = { background: "#f1eade", color: "#39362f", fontFamily: F_BODY };
    const inputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: 12, border: "1px solid #c9beaa", borderRadius: 8, background: "#fffaf1", color: "#39362f", fontSize: 15 };
    const btn = (label, click, disabled) => h("button", { type: "button", disabled: busy || disabled, onClick: click, style: { minHeight: 44, maxWidth: "100%", margin: "0 6px 8px 0", padding: "8px 12px", border: "1px solid #b9ac95", borderRadius: 6, background: "#fffaf1", color: "#39362f", opacity: busy || disabled ? .5 : 1 } }, label);
    const field = (label, child) => h("label", { style: { display: "block", marginBottom: 14 } }, h("div", { style: { marginBottom: 6, fontSize: 13 } }, label), child);
    return h("div", { className: "h-full flex flex-col", style: skin, "data-radio-timeline": true },
      h(Head, { zh: historyOpen ? "已听回放" : "时间线电台", sub: historyOpen && fragment ? fragment.title : "平行故事 · 框架试用", bg: "transparent", ink: "#39362f", subInk: "#706552", lineInk: "#d7cdbb", onBack: back }),
      h("div", { ref: scroll, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: 16, overflowWrap: "anywhere" } },
        historyOpen && fragment ? h("section", { "data-radio-history": true },
          h("p", { style: { fontSize: 13 } }, "本章已听过的句子。选一句回到播放屏重听，未播内容不会提前展开。"),
          heard.map(l => h("div", { key: l.index, style: { marginBottom: 12 } },
            btn("第" + (l.index + 1) + "句 · " + l.text, () => { showLine(l.index); setHistoryOpen(false); }))),
          btn("返回当前句", () => setHistoryOpen(false))
        ) : !branch ? h(React.Fragment, null,
          h("p", { style: { fontSize: 13, lineHeight: 1.8 } }, "调到过去、现在或未来，听见他的另一种可能。内容不会成为主线史实。"),
          field("想听谁的时间线", h("select", { style: inputStyle, value: charId, onChange: e => setChar(e.target.value) }, h("option", { value: "" }, "选择角色"), p.characters.map(c => h("option", { key: c.id, value: c.id }, c.name)))),
          field(show.tell === "story" ? "想听什么样的故事" : "想探索的事／分岔条件", h("textarea", { style: inputStyle, rows: 3, value: topic, onChange: e => setTopic(e.target.value) })),
          // ⚠️名字那一格是空白的：写「深夜怪谈」也行，写一个我们没想到的东西也行。
          //   代码只管下面这四根轴，不拿一张写死的类型表去顶替想象力。
          h("h3", null, "这是一档什么节目"),
          field("节目名（可留空）", h("input", { style: inputStyle, value: show.label, placeholder: "比如：深夜怪谈", onChange: e => setShow({ ...show, label: e.target.value }) })),
          R.SHOW_AXES.map(ax => field(ax.zh, h("select", { style: inputStyle, value: show[ax.key], onChange: e => setShow({ ...show, [ax.key]: e.target.value }) },
            ax.opts.map(o => h("option", { key: o.id, value: o.id }, o.zh))))),
          field("已知设定与不想出现的内容（可留空）", h("textarea", { style: inputStyle, rows: 2, value: limits, onChange: e => setLimits(e.target.value) })),
          btn("建立这条时间线", newBranch, !charId || !topic.trim()),
          h("p", { style: { fontSize: 12 } }, "建立不调用模型；接收新片段和陪听回应时才各调用一次。"),
          h("h3", null, "留在这里的频率"),
          branches.map(b => h("div", { key: b.id, style: { marginBottom: 10 } },
            btn(b.name + " · " + (R.showOf(b).label ? R.showOf(b).label + " · " : "") + b.topic, () => open(b.id)))),
          btn("打开旧电台", p.onLegacy)
        ) : h(React.Fragment, null,
          h("h3", { style: { marginTop: 0 } }, branch.name + " · " + branch.topic),
          (function () {
            const sh = R.showOf(branch);
            return h("p", { "data-radio-show": true, style: { fontSize: 12, marginTop: 0 } },
              (sh.label ? sh.label + " · " : "") + R.SHOW_AXES.map(ax => (ax.opts.find(o => o.id === sh[ax.key]) || {}).zh).filter(Boolean).join(" · "));
          })(),
          h("p", { style: { fontSize: 12 } }, "角色卡与世界设定在建线时留存；修改角色卡后可新建一条线。"),
          h("div", { style: { border: "1px solid #c6bba7", padding: 14, borderRadius: 10, background: "#e7ddca" } },
            h("div", { style: { textAlign: "center", fontSize: 24 } }, currentEra.freq + " · " + currentEra.label),
            h("input", { type: "range", min: 0, max: 2, step: 1, value: frequency, "aria-label": "调频", disabled: busy, style: { width: "100%", minHeight: 44, accentColor: "#876347" }, onChange: e => { resetPlayback(); tune(Number(e.target.value)); } }),
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12 } }, R.ERAS.map(x => h("span", { key: x.id }, x.label)))
          ),
          // ⚠️换人之后，新来的那位【从你切给他的那一句开始听】：前面那些他没在场，
          //   heard 按 companionId 分账，所以这一条不用另写代码，它自己就成立。
          field("谁陪你一起听", h("select", { style: inputStyle, value: companionId, disabled: busy,
            onChange: e => { stop(); setCompanion(e.target.value); } },
            h("option", { value: "" }, "没有人，我自己听"),
            p.characters.map(c => h("option", { key: c.id, value: c.id },
              c.id === branch.charId ? c.name + "（广播里的就是他）" : c.name)))),
          btn("接收这个频率的新章节", generate),
          branch.fragments.filter(x => x.era === currentEra.id).map(f => h("div", { key: f.id, style: { marginTop: 8 } }, btn("回听 · " + f.title, () => { stop(); setFragment(f.id); setLine(-1); }))),
          h("section", { "data-radio-callin": true, style: { marginTop: 16, padding: 14, background: "#fffaf1", borderRadius: 10 } },
            h("h4", { style: { marginTop: 0 } }, "打进这档节目"),
            h("p", { style: { fontSize: 12, lineHeight: 1.8 } },
              "他不知道打进来的是你——你在他那儿只是"
              + ((p.myMask && p.myMask.name) || "一个没报名字的人")
              + "。接进来之后要你一句句放出去；没播的那几句等于没发生，他下一章也读不到。"),
            field("对着话筒说一句", h("textarea", { style: inputStyle, rows: 2, value: callSay, disabled: busy, onFocus: stop, onChange: e => setCallSay(e.target.value) })),
            btn("打进去", callIn, !callSay.trim())
          ),
          fragment ? h("section", { style: { marginTop: 16, padding: 14, background: "#fffaf1", borderRadius: 10 } },
            h("h4", null, fragment.title),
            h("p", { role: "status", style: { fontSize: 12 } }, "广播中 · " + (playing ? "正在朗读" : lineIndex < 0 ? "尚未开始" : "已暂停，可接话")),
            lineIndex >= 0 ? h("div", { "data-radio-current": true, "aria-live": "polite", style: { marginBottom: 14, lineHeight: 1.85 } },
              h("small", null, "第" + (lineIndex + 1) + "句 · " + (fragment.lines[lineIndex].speaker || branch.name)),
              h("div", null, fragment.lines[lineIndex].text)) : null,
            btn(lineIndex < 0 ? "开始收听这一句" : "继续下一句", nextLine, lineIndex >= fragment.lines.length - 1),
            btn("已听回放（" + heard.length + "）", () => { stop(); playbackScroll.current = scroll.current ? scroll.current.scrollTop : 0; setHistoryOpen(true); }, !heard.length),
            btn("连续收听（系统音色）", () => read(true), playing),
            btn("朗读当前句（系统音色）", () => read(false), lineIndex < 0), btn("暂停声音", stop, !playing),
            field("这不像他？写下你的纠正", h("textarea", { style: inputStyle, rows: 2, value: correction, onChange: e => setCorrection(e.target.value), disabled: busy })),
            btn("记作本分支约束", () => { update(branch.id, x => ({ ...x, corrections: x.corrections.concat(correction.trim()) })); setCorrection(""); }, !correction.trim()),
            h("small", { style: { display: "block", lineHeight: 1.7 } }, "纠正用于之后的新片段，旧片段本版不自动重写。"),
            // 他心里那句「这人是不是我认识的某某」——没播到的电话等于没发生，所以播出去了才给她看。
            fragment.call && fragment.guess && heard.length
              ? h("p", { "data-radio-guess": true, style: { marginTop: 12, fontSize: 13, lineHeight: 1.8 } },
                  "挂掉之后他心里那句：" + fragment.guess)
              : null
          ) : null,
          companion ? (function () {
            const mine = R.companionContext(branch, companion.id);
            return h("section", { style: { marginTop: 20, borderTop: "1px solid #c6bba7", paddingTop: 12 } },
              h("h3", null, "身边的" + companion.name),
              h("p", { style: { fontSize: 12 } }, companion.id === branch.charId
                ? "广播里那个人是另一条时间线上的他；他只知道你俩一起听到的句子。"
                : "他只知道你俩一起听到的句子——没播的、你自己听过的，他都不知道。"),
              mine.talks.map((t, i) => h("div", { key: i, style: { lineHeight: 1.8, marginBottom: 12 } }, h("div", null, "你：" + t.question), h("div", null, companion.name + "：" + t.answer))),
              field("暂停，和他说一句", h("textarea", { style: inputStyle, value: question, rows: 2, disabled: busy, onFocus: stop, onChange: e => setQuestion(e.target.value) })),
              btn("问问他", ask, !question.trim() || !mine.heard.length));
          })() : null
        ),
        busy ? h("p", { role: "status" }, "正在接收；不会自动重试。") : null,
        error ? h("p", { role: "alert", style: { color: "#913d32", whiteSpace: "pre-wrap" } }, error) : null
      ));
  }
  root.RadioTimelineScreen = RadioTimelineScreen;
})(typeof window !== "undefined" ? window : globalThis);
