// 第一版可操作骨架：默认读字，显式逐句收听；不在后台偷偷生成下一段。
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
    const [frequency, tune] = useState(1);
    const [fragmentId, setFragment] = useState("");
    const [lineIndex, setLine] = useState(-1);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [together, setTogether] = useState(false);
    const [question, setQuestion] = useState("");
    const [correction, setCorrection] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const lock = useRef(false), alive = useRef(true), speaking = useRef(false);
    const scroll = useRef(null), listScroll = useRef(0), playbackScroll = useRef(0);
    const branch = branches.find(x => x.id === selected);
    const fragment = branch && branch.fragments.find(x => x.id === fragmentId);
    const heard = branch && fragment ? R.heardLines(branch, fragment.id) : [];
    const currentEra = R.ERAS[frequency];
    const uid = () => "rt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
    const stop = () => { if (speaking.current && root.speechSynthesis) root.speechSynthesis.cancel(); speaking.current = false; };
    useEffect(() => { alive.current = true; root.RadioUI.Engine.setPower(false); return () => { alive.current = false; stop(); }; }, []);
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
    const resetPlayback = () => { stop(); setHistoryOpen(false); setFragment(""); setLine(-1); setQuestion(""); setCorrection(""); setError(""); };
    const back = () => { if (lock.current) return; if (historyOpen) { setHistoryOpen(false); return; } resetPlayback(); if (selected) select(""); else p.onBack(); };
    const open = id => { listScroll.current = scroll.current ? scroll.current.scrollTop : 0; resetPlayback(); setTogether(false); select(id); };
    const newBranch = () => {
      try {
        const c = p.characters.find(x => x.id === charId);
        const b = R.create(c, topic, limits, p.loreFor(c, topic), uid());
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
    // 手动下一句、回放选句及未来的播完回调共用这一处切句和听闻落库。
    const showLine = index => {
      stop(); if (!fragment) return;
      if (!Number.isInteger(index) || index < 0 || index >= fragment.lines.length) return;
      update(branch.id, x => R.reveal(x, fragment.id, index, together ? branch.charId : ""));
      setLine(index);
    };
    const nextLine = () => showLine(lineIndex + 1);
    const ask = () => run(async () => {
      const b = branch, q = question.trim();
      if (!q || !together) return;
      const raw = await p.onCompanion(b, q);
      if (!raw || typeof raw.say !== "string" || !raw.say.trim()) throw Error("这次没有收到完整回应，问题还留着。");
      if (!alive.current) return;
      update(b.id, x => ({ ...x, talks: x.talks.concat({ companionId: b.charId, question: q, answer: raw.say.trim() }) }));
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
          field("想探索的事／分岔条件", h("textarea", { style: inputStyle, rows: 3, value: topic, onChange: e => setTopic(e.target.value) })),
          field("已知设定与不想出现的内容（可留空）", h("textarea", { style: inputStyle, rows: 2, value: limits, onChange: e => setLimits(e.target.value) })),
          btn("建立这条时间线", newBranch, !charId || !topic.trim()),
          h("p", { style: { fontSize: 12 } }, "建立不调用模型；接收新片段和陪听回应时才各调用一次。"),
          h("h3", null, "留在这里的频率"),
          branches.map(b => h("div", { key: b.id, style: { marginBottom: 10 } }, btn(b.name + " · " + b.topic, () => open(b.id)))),
          btn("打开旧电台", p.onLegacy)
        ) : h(React.Fragment, null,
          h("h3", { style: { marginTop: 0 } }, branch.name + " · " + branch.topic),
          h("p", { style: { fontSize: 12 } }, "角色卡与世界设定在建线时留存；修改角色卡后可新建一条线。"),
          h("div", { style: { border: "1px solid #c6bba7", padding: 14, borderRadius: 10, background: "#e7ddca" } },
            h("div", { style: { textAlign: "center", fontSize: 24 } }, currentEra.freq + " · " + currentEra.label),
            h("input", { type: "range", min: 0, max: 2, step: 1, value: frequency, "aria-label": "调频", disabled: busy, style: { width: "100%", minHeight: 44, accentColor: "#876347" }, onChange: e => { resetPlayback(); tune(Number(e.target.value)); } }),
            h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12 } }, R.ERAS.map(x => h("span", { key: x.id }, x.label)))
          ),
          h("label", { style: { display: "block", padding: "14px 0" } }, h("input", { type: "checkbox", checked: together, disabled: busy, onChange: e => { stop(); setTogether(e.target.checked); } }), " 邀请此刻的" + branch.name + "陪听"),
          btn("接收这个频率的新章节", generate),
          branch.fragments.filter(x => x.era === currentEra.id).map(f => h("div", { key: f.id, style: { marginTop: 8 } }, btn("回听 · " + f.title, () => { stop(); setFragment(f.id); setLine(-1); }))),
          fragment ? h("section", { style: { marginTop: 16, padding: 14, background: "#fffaf1", borderRadius: 10 } },
            h("h4", null, fragment.title),
            h("p", { style: { fontSize: 12 } }, "广播中 · " + (lineIndex < 0 ? "尚未开始" : "已暂停，可接话")),
            lineIndex >= 0 ? h("div", { "data-radio-current": true, "aria-live": "polite", style: { marginBottom: 14, lineHeight: 1.85 } },
              h("small", null, "第" + (lineIndex + 1) + "句 · " + (fragment.lines[lineIndex].speaker || branch.name)),
              h("div", null, fragment.lines[lineIndex].text)) : null,
            btn(lineIndex < 0 ? "开始收听这一句" : "继续下一句", nextLine, lineIndex >= fragment.lines.length - 1),
            btn("已听回放（" + heard.length + "）", () => { stop(); playbackScroll.current = scroll.current ? scroll.current.scrollTop : 0; setHistoryOpen(true); }, !heard.length),
            btn("朗读当前句（系统音色）", () => {
              stop(); if (!root.speechSynthesis || !root.SpeechSynthesisUtterance) { setError("当前设备不支持系统朗读，可以继续看文字。"); return; }
              const u = new root.SpeechSynthesisUtterance(fragment.lines[lineIndex].text); u.pitch = 1;
              u.onend = u.onerror = () => { speaking.current = false; }; speaking.current = true; root.speechSynthesis.speak(u);
            }, lineIndex < 0), btn("暂停声音", stop),
            field("这不像他？写下你的纠正", h("textarea", { style: inputStyle, rows: 2, value: correction, onChange: e => setCorrection(e.target.value), disabled: busy })),
            btn("记作本分支约束", () => { update(branch.id, x => ({ ...x, corrections: x.corrections.concat(correction.trim()) })); setCorrection(""); }, !correction.trim()),
            h("small", { style: { display: "block", lineHeight: 1.7 } }, "纠正用于之后的新片段，旧片段本版不自动重写。")
          ) : null,
          together ? h("section", { style: { marginTop: 20, borderTop: "1px solid #c6bba7", paddingTop: 12 } },
            h("h3", null, "身边的" + branch.name),
            h("p", { style: { fontSize: 12 } }, "只知道一起听到的句子；陪听对话仅留在这条分支里。"),
            branch.talks.map((t, i) => h("div", { key: i, style: { lineHeight: 1.8, marginBottom: 12 } }, h("div", null, "你：" + t.question), h("div", null, branch.name + "：" + t.answer))),
            field("暂停，和他说一句", h("textarea", { style: inputStyle, value: question, rows: 2, disabled: busy, onChange: e => setQuestion(e.target.value) })),
            btn("问问他", ask, !question.trim() || !R.companionContext(branch, branch.charId).heard.length)
          ) : null
        ),
        busy ? h("p", { role: "status" }, "正在接收；不会自动重试。") : null,
        error ? h("p", { role: "alert", style: { color: "#913d32", whiteSpace: "pre-wrap" } }, error) : null
      ));
  }
  root.RadioTimelineScreen = RadioTimelineScreen;
})(typeof window !== "undefined" ? window : globalThis);
