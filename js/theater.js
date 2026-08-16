// ============================================================
// 小剧场（theater）—— if 线扮演
// 选角色 + 关键词 → 生成平行身份(角色新身份/你的新身份/世界情境) + 本轮小目标。
// 线下叙事式演出;目标由模型报告 + 用户确认;同一条 if 线可多轮续演(每轮一个新目标)。
// 完全沙箱:不读写主线记忆/世界书/好感/状态卡;数据只存 x_theater(跟随 x_ 前缀整包云同步)。
// 生成走线下创作线路(props.active),prompt 复用全局 ANTI_CLICHE / CHARCARD_RULE / 线下叙事准则。
// ============================================================
(function () {
  const useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  // 图标:两片小幕布 + 星(挂进 REG 的 window.GTheater)
  window.GTheater = p => h(Svg, p, h("path", { d: "M3 4c3 2 15 2 18 0v5a9 9 0 01-18 0z" }), h("path", { d: "M7.5 13.5v4M12 14.5v5M16.5 13.5v4" }), h("path", { d: "M12 6.2l.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4z" }));

  const load = () => { try { return JSON.parse(localStorage.getItem("x_theater") || "[]"); } catch (e) { return []; } };
  const persist = list => { try { localStorage.setItem("x_theater", JSON.stringify(list)); } catch (e) {} };
  const rid = pre => pre + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

  function TheaterApp(props) {
    const t = useTheme();
    const uName = (props.profile && props.profile.name) || "你";
    const [lines, setLines] = useState(load);
    const [view, setView] = useState("list"); // list | create | play
    const [playId, setPlayId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [draft, setDraft] = useState(null); // create 预览:{charId, keywords, title, charRole, userRole, setting, goal}
    const [pickChar, setPickChar] = useState((props.characters[0] || {}).id || null);
    const [kw, setKw] = useState("");
    const [input, setInput] = useState("");
    const scrollRef = useRef(null);
    const update = fn => setLines(p => { const n = fn(p.slice()); persist(n); return n; });
    const line = lines.find(l => l.id === playId) || null;
    const charOf = l => props.characters.find(c => c.id === l.charId) || {};
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });

    // ---- 生成:if 线设定 ----
    const genSetting = async () => {
      const char = props.characters.find(c => c.id === pickChar);
      if (!char) return props.toast("先选一个角色");
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(true);
      try {
        const sys = "你在为一场「if 线小剧场」做开场设定:保持角色的性格、说话方式和反应习惯,但把身份、职业、处境替换到一个全新的平行世界。\n先构思一个把两人绑在一起的【张力核心】——一段未清算的过去、一个不能说的秘密、互相冲突的立场、一笔没还清的债;两人的新身份都必须长在这个张力上,不是随便两个职业的偶遇。\ngoal 必须是这条张力的【关键节点】:说出口就回不了头、做了就改变两人关系的那种揭示/确认/抉择——有代价、有风险,达成要跨过一个心理门槛。禁止事务级小目标(承认个小错、答应个小要求、问个身份这种一句话就能完成的事)。\nsetting 要把 " + uName + " 直接放进一个【正在进行、必须做选择】的具体时刻,不是平静的日常介绍。\nopening 是写给 " + uName + " 的开场正文(第二人称『你』,5-9句):交代 Ta 的身份处境与内心冲突,把场景推进到那个时刻,以张力悬在半空收尾;绝不替 " + uName + " 做任何决定或行动。\n只输出 JSON:{\"title\":\"这条if线的短名字(≤10字)\",\"charRole\":\"角色的新身份与处境(2-3句)\",\"userRole\":\"" + uName + " 的新身份+Ta 背负的冲突或赌注(2-3句)\",\"setting\":\"世界背景+张力核心+当下这个时刻(3-5句)\",\"opening\":\"开场正文\",\"goal\":\"本轮目标:一句话,写清那个有代价的关键节点\"}";
        const user = "【角色人设】\n" + (char.persona || char.name) + "\n\n【关键词(可空,空则自由发挥)】" + (kw.trim() || "无") + "\n\n【对方名字】" + uName;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2400, timeout: 150000 });
        const p = extractJSON(raw);
        if (!p || !p.charRole || !p.setting || !p.goal) throw new Error("设定生成不完整,再试一次");
        setDraft({ charId: char.id, keywords: kw.trim(), title: p.title || "if线", charRole: p.charRole, userRole: p.userRole || "", setting: p.setting, opening: p.opening || "", goal: p.goal });
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    const acceptDraft = () => {
      const l = { id: rid("th_"), charId: draft.charId, title: draft.title, keywords: draft.keywords, charRole: draft.charRole, userRole: draft.userRole, setting: draft.setting, createdAt: Date.now(), rounds: [{ id: rid("tr_"), goal: draft.goal, goalDone: false, goalNote: null, pending: false, msgs: draft.opening ? [{ id: rid("tm_"), role: "char", content: draft.opening, ts: Date.now() }] : [], startTs: Date.now() }] };
      update(list => [l, ...list]); setDraft(null); setKw(""); setPlayId(l.id); setView("play"); setPanelOpen(true);
    };

    // ---- 演出 ----
    const allMsgs = l => l.rounds.flatMap(r => r.msgs);
    const send = async () => {
      const text = input.trim();
      if (!text || !line || busy) return;
      if (!props.active) return props.toast("请先配置线下 API");
      const char = charOf(line);
      const round = line.rounds[line.rounds.length - 1];
      setInput("");
      update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: rid("tm_"), role: "user", content: text, ts: Date.now() }] }) }));
      setBusy(true);
      try {
        const sys = [ANTI_CLICHE, CHARCARD_RULE, OFFLINE_NARRATIVE_RUNTIME,
          "【小剧场·if 线(独立平行时空)】这是一场与主线完全无关的平行扮演:不引用主线聊天里发生过的事,也不提及这是扮演。世界观、身份以下面的设定为准。",
          "【角色人设(性格与声纹的根基,保持不变)】\n" + (char.persona || char.name),
          "【if 线身份·你(" + char.name + ")】" + line.charRole + "\n身份、职业、处境按此替换;性格、说话方式、注意力习惯仍是上面这个人。",
          "【if 线身份·" + uName + "】" + (line.userRole || "如设定所述"),
          "【世界与情境】" + line.setting,
          "【本轮目标(远景,不是本轮任务)】" + round.goal + (round.goalDone ? "(已达成,剧情自然继续即可)" : " —— 这是这一轮剧情【最终】要自然抵达的节点,通常需要多次来回互动、经过铺垫、并由 " + uName + " 的行动共同促成。绝不许在开场或单次回复里自己一步演完整条弧,更不许自导自演替对方完成属于对方的部分;每轮只朝它走一小步,留足对方行动的空间。只有当它经过铺垫在剧情里【真实发生】后,才在 goalReached 里报告。"),
          "【输出】用第一人称『我』完全代入「" + char.name + "」,称对方为『你』,对话用引号,写成连续场景正文;篇幅由内容决定。只输出 JSON:{\"scene\":\"场景正文\",\"goalReached\":false,\"goalNote\":null}(目标达成时 goalReached 为 true,goalNote 用一句话指出达成的瞬间)"
        ].join("\n\n");
        const hist = allMsgs(line).concat([{ role: "user", content: text, ts: Date.now() }])
          .slice(-40).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
        const raw = await callAI(props.active, sys, hist, { maxTokens: 3200, timeout: 180000 });
        const p = extractJSON(raw) || { scene: String(raw || "").replace(/```(?:json)?/gi, "").trim() };
        if (!p.scene) throw new Error("没拿到正文");
        // 达成硬门槛:本轮用户发言不满 3 条时,模型报 goalReached 也不采信——防"开场自导自演一步通关"
        update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: rid("tm_"), role: "char", content: p.scene, ts: Date.now() }], pending: !r.goalDone && !!p.goalReached && r.msgs.filter(m => m.role === "user").length >= 3 ? (p.goalNote || "看起来目标达成了") : r.pending }) }));
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    const confirmGoal = ok => update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : ok ? { ...r, goalDone: true, goalNote: typeof r.pending === "string" ? r.pending : r.goalNote, pending: false, endTs: Date.now() } : { ...r, pending: false }) }));
    const newRound = async () => {
      if (!line || busy) return;
      setBusy(true);
      try {
        const recent = allMsgs(line).slice(-8).map(m => (m.role === "user" ? uName : charOf(line).name) + ":" + m.content).join("\n").slice(-1800);
        const sys = "为一场进行中的 if 线小剧场想【下一轮目标】:顺着已发生的剧情,把两人之间的张力再拧深一档——新目标同样要有代价、有心理门槛、达成后会改变关系走向(更深的揭示、更难的抉择、必须兑现的承诺);禁止事务级小目标,不重复已达成的。只输出 JSON:{\"goal\":\"一句话目标\"}";
        const user = "【设定】" + line.setting + "\n【角色身份】" + line.charRole + "\n【已达成过的目标】" + line.rounds.map(r => r.goal + (r.goalDone ? "(✓)" : "")).join(";") + "\n【最近剧情】\n" + recent;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 400, timeout: 60000 });
        const p = extractJSON(raw);
        if (!p || !p.goal) throw new Error("目标没生成出来");
        update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: [...l.rounds, { id: rid("tr_"), goal: p.goal, goalDone: false, goalNote: null, pending: false, msgs: [], startTs: Date.now() }] }));
        setPanelOpen(true);
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    const delLine = id => { if (!confirm("删除这条 if 线和全部记录?")) return; setView("list"); setPlayId(null); update(list => list.filter(l => l.id !== id)); };

    // ---- UI ----
    const S = { wrap: { position: "fixed", inset: 0, zIndex: 60, background: t.bg, display: "flex", flexDirection: "column" },
      top: { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 10px", borderBottom: "1px solid " + t.line },
      h1: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, flex: 1 },
      btn: (fill) => ({ padding: "7px 14px", borderRadius: 12, fontFamily: F_BODY, fontSize: 12, border: "1px solid " + (fill ? t.ink : t.line), background: fill ? t.ink : "transparent", color: fill ? t.bg2 : t.ink }),
      card: { margin: "10px 14px 0", padding: 13, borderRadius: 16, background: t.bg2, border: "1px solid " + t.line },
      lbl: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginBottom: 3 },
      txt: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.7, whiteSpace: "pre-wrap" } };
    const back = () => view === "list" ? props.onBack() : (setView("list"), setPlayId(null), setDraft(null));
    const header = title => h("div", { style: S.top },
      h("button", { onClick: back, style: { fontSize: 18, color: t.ink, background: "none", border: "none", padding: "0 4px" } }, "←"),
      h("div", { style: S.h1 }, title),
      view === "list" ? h("button", { onClick: () => { setDraft(null); setView("create"); }, style: S.btn(true) }, "新开if线") : null,
      view === "play" && line ? h("button", { onClick: () => setPanelOpen(v => !v), style: S.btn(false) }, panelOpen ? "收起" : "背景与目标") : null);

    if (view === "create") {
      const preview = draft && h("div", { style: S.card },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, marginBottom: 8 } }, draft.title),
        [["Ta 的新身份", draft.charRole], [uName + " 的新身份", draft.userRole], ["世界与情境", draft.setting], ["开场", draft.opening], ["本轮目标", draft.goal]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 8 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, v)) : null),
        h("div", { style: { display: "flex", gap: 8, marginTop: 6 } },
          h("button", { onClick: acceptDraft, style: S.btn(true) }, "就这个,开演"),
          h("button", { onClick: genSetting, disabled: busy, style: S.btn(false) }, busy ? "在想…" : "换一版")));
      return h("div", { style: S.wrap }, header("新开 if 线"),
        h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
          h("div", { style: S.card }, h("div", { style: S.lbl }, "选角色"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, props.characters.map(c =>
              h("button", { key: c.id, onClick: () => setPickChar(c.id), style: Object.assign({}, S.btn(pickChar === c.id)) }, c.name)))),
          h("div", { style: S.card }, h("div", { style: S.lbl }, "关键词(选填:题材/身份/氛围,如「民国 报社 追凶」)"),
            h("textarea", { value: kw, onChange: e => setKw(e.target.value), rows: 2, placeholder: "空着=让 Ta 自由发挥", style: { width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none" } }),
            !draft && h("button", { onClick: genSetting, disabled: busy, style: Object.assign({ marginTop: 4 }, S.btn(true)) }, busy ? "在想…" : "生成设定")),
          preview));
    }

    if (view === "play" && line) {
      const char = charOf(line);
      const round = line.rounds[line.rounds.length - 1];
      const panel = panelOpen && h("div", { style: Object.assign({}, S.card, { margin: "8px 14px" }) },
        [["Ta 的身份", line.charRole], [uName + " 的身份", line.userRole], ["世界与情境", line.setting]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 7 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, v)) : null),
        h("div", { style: S.lbl }, "各轮目标"),
        line.rounds.map((r, i) => h("div", { key: r.id, style: Object.assign({}, S.txt, { marginBottom: 3 }) }, "第" + (i + 1) + "轮:" + r.goal + (r.goalDone ? " ✓" : i === line.rounds.length - 1 ? "(进行中)" : "(未完)"))),
        h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          round.goalDone ? h("button", { onClick: newRound, disabled: busy, style: S.btn(true) }, busy ? "在想…" : "开启下一轮目标") : null,
          h("button", { onClick: () => delLine(line.id), style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "删除此线")));
      const banner = round.pending && h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: t.ink }) },
        h("div", { style: S.txt }, "本轮目标可能已达成:" + round.goal + (typeof round.pending === "string" ? "\n(" + round.pending + ")" : "")),
        h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          h("button", { onClick: () => confirmGoal(true), style: S.btn(true) }, "确认达成"),
          h("button", { onClick: () => confirmGoal(false), style: S.btn(false) }, "还没有")));
      let ri = 0;
      const flow = line.rounds.flatMap((r, i) => [h("div", { key: "rd" + r.id, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10, color: t.fog, margin: "14px 0 4px" } }, "— 第" + (i + 1) + "轮 · " + r.goal + (r.goalDone ? " ✓" : "") + " —")]
        .concat(r.msgs.map(m => m.role === "user"
          ? h("div", { key: m.id, style: { margin: "10px 14px", textAlign: "right" } }, h("span", { style: { display: "inline-block", maxWidth: "82%", textAlign: "left", padding: "9px 13px", borderRadius: 15, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, m.content))
          : h("div", { key: m.id, style: Object.assign({ margin: "10px 14px" }, S.txt) }, m.content))));
      return h("div", { style: S.wrap }, header(line.title + " · " + (char.name || "")),
        panel, banner,
        h("div", { ref: scrollRef, style: { flex: 1, overflowY: "auto", paddingBottom: 16 } }, flow,
          busy ? h("div", { style: { margin: "10px 14px", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "Ta 在演…") : null),
        h("div", { style: { display: "flex", gap: 8, padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: "1px solid " + t.line } },
          h("textarea", { value: input, onChange: e => setInput(e.target.value), rows: 1, placeholder: "你的行动或台词…", style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", outline: "none" } }),
          h("button", { onClick: send, disabled: busy, style: S.btn(true) }, "演")));
    }

    // list
    return h("div", { style: S.wrap }, header("小剧场"),
      h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
        lines.length ? lines.map(l => { const c = charOf(l); const n = allMsgs(l).length; const done = l.rounds.filter(r => r.goalDone).length;
          return h("div", { key: l.id, onClick: () => { setPlayId(l.id); setView("play"); setPanelOpen(false); }, style: Object.assign({}, S.card, { cursor: "pointer" }) },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, l.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 4 } }, (c.name || "?") + " · 第" + l.rounds.length + "轮 · 目标达成" + done + " · " + n + "条"),
            h("div", { style: Object.assign({}, S.txt, { color: t.fog, fontSize: 12, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }) }, l.setting)); })
        : h("div", { style: { textAlign: "center", marginTop: 80, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有 if 线。", h("br"), "选个角色,把 Ta 扔进另一种人生试试。")));
  }
  window.TheaterApp = TheaterApp;
})();
