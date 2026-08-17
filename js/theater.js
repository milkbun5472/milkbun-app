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
    // 收藏的基线设定(x_theaterPresets):满意的身份/世界可复用开新局,只重新生成开场与目标
    const [presets, setPresets] = useState(() => { try { return JSON.parse(localStorage.getItem("x_theaterPresets") || "[]"); } catch (e) { return []; } });
    const savePresets = fn => setPresets(p => { const n = fn(p.slice()); try { localStorage.setItem("x_theaterPresets", JSON.stringify(n)); } catch (e) {} return n; });
    const addPreset = src => { savePresets(l => [{ id: rid("tp_"), charId: src.charId, title: src.title, charRole: src.charRole, userRole: src.userRole, setting: src.setting, keywords: src.keywords || "", ts: Date.now() }, ...l]); props.toast("已收藏为基线"); };
    const [view, setView] = useState("list"); // list | create | play
    const [playId, setPlayId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [draft, setDraft] = useState(null); // create 预览:{charId, keywords, title, charRole, userRole, setting, goal}
    const [pickChar, setPickChar] = useState((props.characters[0] || {}).id || null);
    const [kw, setKw] = useState("");
    const [input, setInput] = useState("");
    const [edit, setEdit] = useState(null); // 演出面板的设定编辑缓冲:null | {title, charRole, userRole, setting, goal}
    const [note, setNote] = useState(""); // 导演便签:一次性,喂给下一拍生成后自动清空
    const [noteOpen, setNoteOpen] = useState(false);
    const [dice, setDice] = useState(false); // 剧场骰子:下一拍注入一个意外,一次性
    const [plusOpen, setPlusOpen] = useState(false); // + 菜单(骰子/便签/背景/出图)
    const [photoMenu, setPhotoMenu] = useState(null); // 长按剧照弹出的操作单:msg|null
    const pressRef = useRef(null);
    const fileRef = useRef(null);
    const [writeGoal, setWriteGoal] = useState(null); // null | string:手写下一轮目标的缓冲
    const [diff, setDiff] = useState("normal"); // 开线时的难度档
    const scrollRef = useRef(null);
    const linesRef = useRef(null);
    const sumBusyRef = useRef(false);
    const update = fn => setLines(p => { const n = fn(p.slice()); persist(n); return n; });
    useEffect(() => { linesRef.current = lines; });
    // 难度档:目标重量 + 演出时他有多难撬
    const DIFF = {
      easy: { name: "轻松", goal: "目标门槛放轻:日常温度,几轮内可自然达成,不必生死攸关。", play: "他对目标方向的抵抗不高:给个台阶就下,顺水推舟就能到。" },
      normal: { name: "标准", goal: "", play: "" },
      hard: { name: "硬核", goal: "目标门槛要重:他有充分理由死守,达成应当很难、需要多轮真正的攻坚。", play: "他会【真实地抵抗】目标方向:回避、装傻、转移话题、反将一军;只有被真正说动、戳中要害或无路可退时才让步,绝不因为对方坚持了两句就松口。" }
    };
    const diffOf = l => DIFF[(l && l.difficulty) || "normal"] || DIFF.normal;
    // 滚动摘要(防长线失忆):超过 48 条后,把最老的部分浓缩进 line.summary,只留近 32 条逐句喂
    const maybeSummarize = async lineId => {
      if (sumBusyRef.current || !props.active) return;
      const l = (linesRef.current || []).find(x => x.id === lineId);
      if (!l) return;
      const all = l.rounds.flatMap(r => r.msgs);
      const done = l.sumCount || 0;
      if (all.length - done <= 48) return;
      const cut = all.length - 32;
      const seg = all.slice(done, cut).filter(m => m.role !== "photo").map(m => (m.role === "user" ? uName : (charOf(l).name || "Ta")) + ":" + m.content).join("\n").slice(0, 9000);
      sumBusyRef.current = true;
      try {
        const sys = "把这段小剧场剧情浓缩成【前情提要】(第三人称,400字内):只保留已发生的关键事件、已揭示的事实、双方关系变化和未解决的悬念,不保留文风渲染。若已有旧前情,合并续写成一段完整提要。只输出提要正文。";
        const user = (l.summary ? "【旧前情】\n" + l.summary + "\n\n" : "") + "【新增剧情】\n" + seg;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2000, timeout: 120000 });
        const text = String(raw || "").replace(/```/g, "").trim().slice(0, 3000);
        if (text) update(list => list.map(x => x.id !== lineId ? x : { ...x, summary: text, sumCount: cut }));
      } catch (e) { /* 静默:下次再试 */ } finally { sumBusyRef.current = false; }
    };
    const line = lines.find(l => l.id === playId) || null;
    const charOf = l => props.characters.find(c => c.id === l.charId) || {};
    const msgCount = line ? line.rounds.reduce((n, r) => n + r.msgs.length, 0) : 0;
    // 只在消息数或换线时滚到底;无依赖数组会让每次打字/点按钮都把滚动条按回底部,想往上翻都翻不了
    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgCount, playId]);

    // ---- 生成:if 线设定 ----
    const genSetting = async () => {
      const char = props.characters.find(c => c.id === pickChar);
      if (!char) return props.toast("先选一个角色");
      if (!props.active) return props.toast("请先配置线下 API");
      setBusy(true);
      try {
        const sys = "你在为一场「if 线小剧场」做开场设定:保持角色的性格、说话方式和反应习惯,但把身份、职业、处境替换到一个全新的平行世界。\n【保留的只是性格机制】——他怎么说话、怎么注意、怎么反应、那股聪明劲;履历、职业领域、社会位置、甚至道德立场都属于可替换的部分。新身份要敢于远离原设定:换时代、换世界观、换职业大类都行;除非关键词点名,【不要】沿用原人设的职业领域(原本搞研究就总派研究员,这是偷懒)。关键词为空时,从彼此差异大的题材池(悬疑/权谋/江湖/末世/民国/赛博/奇幻/宫廷/职场犯罪…)里挑一个与原设定不重合的。\n【关键词拥有最高优先级】:题材、身份、阵营都照办——包括要求他当反派/坏人时,就让他【真的坏】,用他原本的聪明、魅力和说话方式去坏,不许洗白、软化或让他偷偷还是好人。\n先构思一个把两人绑在一起的【张力核心】——一段未清算的过去、一个不能说的秘密、互相冲突的立场、一笔没还清的债;两人的新身份都必须长在这个张力上,不是随便两个职业的偶遇。\ngoal 必须是这条张力的【关键节点】,而且【必须是角色一方做出/说出的事】——让他承认、让他答应、让他交出、让他做出那个选择;由 " + uName + " 在对话里想办法促成,他跨过那道心理门槛才算达成。绝不许把目标写成要 " + uName + " 自己去坦白/抉择/行动的任务(Ta 是解题的人,不是被出题的人)。节点要有代价、有风险:他说出口就回不了头、做了就改变两人关系。禁止事务级小目标。\n【目标只定门槛,不定路径】:写清他要跨过【哪一类】门槛(承认/交出/答应/放手…),但不预设具体内容、真相细节或唯一剧情走法——写『让他说出他一直瞒着你的那件事』,不写『让他承认那件事其实是XX造成的』;方向明确,真相和抵达方式留给演出时自然长出来,解法必须不止一种。\nsetting 要把 " + uName + " 直接放进一个【正在进行、必须做选择】的具体时刻,不是平静的日常介绍。\nopening 是写给 " + uName + " 的开场正文(第二人称『你』,5-9句):交代 Ta 的身份处境与内心冲突,把场景推进到那个时刻,以张力悬在半空收尾;绝不替 " + uName + " 做任何决定或行动。\n只输出 JSON:{\"title\":\"这条if线的短名字(≤10字)\",\"charRole\":\"角色的新身份与处境(2-3句)\",\"userRole\":\"" + uName + " 的新身份+Ta 背负的冲突或赌注(2-3句)\",\"setting\":\"世界背景+张力核心+当下这个时刻(3-5句)\",\"opening\":\"开场正文\",\"goal\":\"本轮目标:一句话,写清那个有代价的关键节点\"}";
        const user = "【角色人设】\n" + (char.persona || char.name) + "\n\n【关键词(可空,空则自由发挥)】" + (kw.trim() || "无") + (DIFF[diff].goal ? "\n\n【难度要求】" + DIFF[diff].goal : "") + "\n\n【对方名字】" + uName;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 3200, timeout: 150000 });
        const p = extractJSON(raw);
        if (!p || !p.charRole || !p.setting || !p.goal) throw new Error("设定生成不完整,再试一次");
        setDraft({ charId: char.id, keywords: kw.trim(), difficulty: diff, title: p.title || "if线", charRole: p.charRole, userRole: p.userRole || "", setting: p.setting, opening: p.opening || "", goal: p.goal });
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    // 从收藏基线开新局:身份/世界/张力固定不动,只生成新的开场与本轮目标
    const genFromPreset = async ps => {
      const char = props.characters.find(c => c.id === ps.charId);
      if (!char) return props.toast("这个基线的角色不在了");
      if (!props.active) return props.toast("请先配置线下 API");
      setPickChar(ps.charId); setBusy(true);
      try {
        const sys = "基于下面这套【固定的 if 线设定】开一局新的:设定本身(身份/世界/张力核心)一个字不许改,只生成新的开场与本轮目标。\nopening:第二人称『你』写给 " + uName + " 的开场正文(5-9句),把 Ta 放进一个正在进行、必须做选择的时刻,张力悬着收尾,不替 Ta 做任何决定。\ngoal:【必须是角色做出/说出的事】(让他承认/答应/揭示/抉择),由 " + uName + " 促成、他跨过心理门槛才算达成;有代价、说出口就回不了头;只定门槛类型、不预设具体真相或唯一剧情路径,解法要不止一种;禁止事务级小目标,也不许写成要 " + uName + " 自己行动的任务。\n只输出 JSON:{\"opening\":\"开场正文\",\"goal\":\"一句话目标\"}";
        const user = "【角色人设】\n" + (char.persona || char.name) + "\n\n【固定设定】\nTa 的身份:" + ps.charRole + "\n" + uName + " 的身份:" + ps.userRole + "\n世界与张力:" + ps.setting;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2600, timeout: 150000 });
        const p = extractJSON(raw);
        if (!p || !p.goal) throw new Error("开局生成不完整,再试一次");
        setDraft({ charId: ps.charId, keywords: ps.keywords, difficulty: diff, title: ps.title, charRole: ps.charRole, userRole: ps.userRole, setting: ps.setting, opening: p.opening || "", goal: p.goal, fromPreset: true });
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    const acceptDraft = () => {
      const l = { id: rid("th_"), charId: draft.charId, title: draft.title, keywords: draft.keywords, difficulty: draft.difficulty || "normal", charRole: draft.charRole, userRole: draft.userRole, setting: draft.setting, createdAt: Date.now(), rounds: [{ id: rid("tr_"), goal: draft.goal, goalDone: false, goalNote: null, pending: false, msgs: draft.opening ? [{ id: rid("tm_"), role: "char", content: draft.opening, ts: Date.now() }] : [], startTs: Date.now() }] };
      update(list => [l, ...list]); setDraft(null); setKw(""); setPlayId(l.id); setView("play"); setPanelOpen(true);
    };

    // ---- 演出 ----
    const allMsgs = l => l.rounds.flatMap(r => r.msgs);
    const send = async () => {
      const text = input.trim();
      if (!line || busy) return;
      const round = line.rounds[line.rounds.length - 1];
      const lastIsUser = round.msgs.length && round.msgs[round.msgs.length - 1].role === "user";
      // 空输入 + 历史末尾是自己的消息 = 上次生成失败的重试:不重复入史,直接用现有历史再生成
      if (!text && !lastIsUser && !dice) return;
      if (!props.active) return props.toast("请先配置线下 API");
      const char = charOf(line);
      let addedId = null;
      if (text) {
        addedId = rid("tm_");
        setInput("");
        update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: addedId, role: "user", content: text, ts: Date.now() }] }) }));
      }
      setBusy(true);
      try {
        const sys = [ANTI_CLICHE, CHARCARD_RULE, OFFLINE_NARRATIVE_RUNTIME, NARRATIVE_ANTI_CLICHE, INTIMATE_ANTI_CLICHE,
          "【小剧场·if 线(独立平行时空)】这是一场与主线完全无关的平行扮演:不引用主线聊天里发生过的事,也不提及这是扮演。世界观、身份以下面的设定为准。",
          "【角色人设(性格与声纹的根基,保持不变)】\n" + (char.persona || char.name),
          "【if 线身份·你(" + char.name + ")】" + line.charRole + "\n身份、职业、处境按此替换;性格、说话方式、注意力习惯仍是上面这个人。",
          "【if 线身份·" + uName + "】" + (line.userRole || "如设定所述"),
          "【世界与情境】" + line.setting,
          "【本轮目标(远景,不是本轮任务)】" + round.goal + (round.goalDone ? "(已达成,剧情自然继续即可)" : " —— 这是这一轮剧情【最终】要自然抵达的节点,通常需要多次来回互动、经过铺垫、并由 " + uName + " 的行动共同促成。绝不许在开场或单次回复里自己一步演完整条弧,更不许自导自演替对方完成属于对方的部分;每轮只朝它走一小步,留足对方行动的空间。只有当它经过铺垫在剧情里【真实发生】后,才在 goalReached 里报告。\n【失败判定】他拒绝、抵抗、僵持都不是失败——只要继续演还有任何一条路能自然走到目标,就没失败。只有目标变得【不可逆地无法达成】(他彻底离场断绝、目标所系之物已毁、剧内时限已过、他做出了反向的不可逆承诺)时,才在 goalFailed 里报告。" + (diffOf(line).play ? "\n【难度·" + diffOf(line).name + "】" + diffOf(line).play : "")),
          line.summary ? "【前情提要(早前剧情已浓缩,接着往下演,别倒回去复述)】\n" + line.summary : null,
          note.trim() ? "【临时导演提示(本拍务必遵循;这是幕后指示,绝不在正文中提及它的存在)】" + note.trim() : null,
          dice ? "【剧场骰子】本拍必须自然引入一个出乎双方意料的外部意外(第三者闯入/环境突变/时限出现/被撞破…):与世界观相容、落在具体行动上,并让它实际搅动当前局面。" : null,
          "【对方主权】" + uName + " 的行动、反应和台词永远由 Ta 本人输入:你只能写「我」的言行心理与 NPC/环境,绝不替『你』做动作、说台词、下决定——哪怕剧情顺手也不行,写到需要 Ta 行动的位置就停。",
          "【节拍】一次回复只演【一拍】:你的一个反应、至多一次行动和随之的话;演到需要 " + uName + " 回应、选择或行动的位置就自然停下。不把几个情绪阶段压进同一拍(震惊、想通、劝阻、逼问要分几个来回演),不替 Ta 说出 Ta 没说出口的意图,也不自问自答替 Ta 推进。",
          "【输出】用第一人称『我』完全代入「" + char.name + "」,称对方为『你』,对话用引号,写成连续场景正文;篇幅由内容决定。只输出 JSON:{\"scene\":\"场景正文\",\"goalReached\":false,\"goalFailed\":false,\"goalNote\":null}(达成时 goalReached=true;不可逆失败时 goalFailed=true;goalNote 一句话指出达成或失败的瞬间)"
        ].filter(Boolean).join("\n\n");
        const base = allMsgs(line).slice(line.sumCount || 0).filter(m => m.role !== "photo");
        const hist = (text ? base.concat([{ role: "user", content: text, ts: Date.now() }]) : base)
          .slice(-40).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
        // 尾部守则(recency 最强处;史里有旧八股时 system 中段压不住自我模仿)
        const tail = "\n\n〔本拍守则〕只演我自己的一拍,绝不写「你」的动作、反应或台词,写到需要你行动处就停;用这个角色自己的说话方式,砍掉现成网文反应、连环强度词和总结旁白。";
        if (hist.length && hist[hist.length - 1].role === "user") hist[hist.length - 1] = { ...hist[hist.length - 1], content: hist[hist.length - 1].content + tail };
        else hist.push({ role: "user", content: "(继续)" + tail });
        const raw = await callAI(props.active, sys, hist, { maxTokens: 3200, timeout: 180000 });
        const p = extractJSON(raw) || { scene: String(raw || "").replace(/```(?:json)?/gi, "").trim() };
        if (!p.scene) throw new Error("没拿到正文");
        // 达成硬门槛:本轮用户发言不满 3 条时,模型报 goalReached 也不采信——防"开场自导自演一步通关"
        update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: rid("tm_"), role: "char", content: p.scene, ts: Date.now() }], pending: !r.goalDone && !r.failed && !!p.goalReached && r.msgs.filter(m => m.role === "user").length >= 3 ? (p.goalNote || "看起来目标达成了") : r.pending, pendingFail: !r.goalDone && !r.failed && !p.goalReached && !!p.goalFailed && r.msgs.filter(m => m.role === "user").length >= 3 ? (p.goalNote || "看起来这条路走死了") : r.pendingFail }) }));
        setNote(""); setNoteOpen(false); setDice(false); // 便签与骰子都是一次性,用完即清
        setTimeout(() => maybeSummarize(line.id), 400);
      } catch (e) {
        // 失败回滚:撤回刚入史的那条,文字放回输入框,再按一次「演」即重试;历史不留残尾
        if (addedId) { update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: r.msgs.filter(m => m.id !== addedId) }) })); setInput(text); }
        props.toast("生成失败:" + (e.message || "再按一次「演」重试"));
      } finally { setBusy(false); }
    };
    const confirmGoal = ok => update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : ok ? { ...r, goalDone: true, goalNote: typeof r.pending === "string" ? r.pending : r.goalNote, pending: false, endTs: Date.now() } : { ...r, pending: false }) }));
    const confirmFail = ok => update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : ok ? { ...r, failed: true, goalNote: typeof r.pendingFail === "string" ? r.pendingFail : r.goalNote, pendingFail: false, endTs: Date.now() } : { ...r, pendingFail: false }) }));
    // mode="next" 开下一轮;mode="redo" 重掷当前轮目标(剧情保留,只换目标)
    const genGoal = async mode => {
      if (!line || busy) return;
      setBusy(true);
      try {
        const recent = allMsgs(line).slice(-8).map(m => (m.role === "user" ? uName : charOf(line).name) + ":" + m.content).join("\n").slice(-1800);
        const cur = line.rounds[line.rounds.length - 1];
        const sys = (mode === "redo"
          ? "为一场进行中的 if 线小剧场【重新想当前这一轮的目标】(替换旧目标『" + cur.goal + "』,方向要和它不同)。"
          : "为一场进行中的 if 线小剧场想【下一轮目标】:顺着已发生的剧情,把两人之间的张力再拧深一档;若上一轮以失败告终,新目标应从失败的后果里长出来(挽回/付代价/换一条路)。")
          + "目标【必须是角色一方做出/说出的事】(让他承认/答应/揭示/兑现),由 " + uName + " 促成,他跨过心理门槛才算达成——绝不许写成要 " + uName + " 自己行动的任务。要有代价、有心理门槛、达成后改变关系走向;【只定门槛类型,不预设具体真相或唯一剧情路径】,解法要不止一种;禁止事务级小目标,不重复已达成的。只输出 JSON:{\"goal\":\"一句话目标\"}";
        const user = "【设定】" + line.setting + "\n【角色身份】" + line.charRole + "\n【各轮目标】" + line.rounds.map(r => r.goal + (r.goalDone ? "(✓)" : r.failed ? "(✗失败)" : "")).join(";") + "\n【最近剧情】\n" + recent;
        // 思考型模型的思考也从 maxTokens 里扣,给窄了 JSON 会被写一半截断
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2000, timeout: 120000 });
        const p = extractJSON(raw);
        if (!p || !p.goal) throw new Error("目标没生成出来");
        update(list => list.map(l => l.id !== line.id ? l : mode === "redo"
          ? { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, goal: p.goal, pending: false }) }
          : { ...l, rounds: [...l.rounds, { id: rid("tr_"), goal: p.goal, goalDone: false, goalNote: null, pending: false, msgs: [], startTs: Date.now() }] }));
        setPanelOpen(true);
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    // 重开:旧剧情整段归档,同一套设定从第一轮重来(新开场+新目标)
    const restartLine = async () => {
      if (!line || busy) return;
      if (!confirm("重开此线?当前剧情会归档,从第一轮重新开始。")) return;
      setBusy(true);
      try {
        const char = charOf(line);
        const sys = "基于下面这套【固定的 if 线设定】重开一局:设定一个字不许改,只生成新的开场与本轮目标。opening:第二人称『你』写给 " + uName + " 的开场正文(5-9句),把 Ta 放进一个必须做选择的时刻,悬着收尾。goal:【必须是角色做出/说出的事】,由 " + uName + " 促成;只定门槛类型不预设路径;禁止事务级小目标。只输出 JSON:{\"opening\":\"开场正文\",\"goal\":\"一句话目标\"}";
        const user = "【角色人设】\n" + (char.persona || char.name) + "\n\n【固定设定】\nTa 的身份:" + line.charRole + "\n" + uName + " 的身份:" + line.userRole + "\n世界与张力:" + line.setting;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2600, timeout: 150000 });
        const p = extractJSON(raw);
        if (!p || !p.goal) throw new Error("重开生成失败,再试一次");
        update(list => list.map(l => l.id !== line.id ? l : { ...l, ended: false, summary: "", sumCount: 0,
          archives: [...(l.archives || []), { rounds: l.rounds, summary: l.summary || "", ts: Date.now() }],
          rounds: [{ id: rid("tr_"), goal: p.goal, goalDone: false, goalNote: null, pending: false, msgs: p.opening ? [{ id: rid("tm_"), role: "char", content: p.opening, ts: Date.now() }] : [], startTs: Date.now() }] }));
        setPanelOpen(true);
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    // 谢幕:生成终场戏并标记完结(仍可回看,面板里可重开)
    const endLine = async () => {
      if (!line || busy) return;
      if (!confirm("为这条线谢幕?会生成终场戏并标记完结。")) return;
      setBusy(true);
      try {
        const char = charOf(line);
        const recent = allMsgs(line).slice(-14).map(m => (m.role === "user" ? uName : char.name) + ":" + m.content).join("\n").slice(-3000);
        const sys = ANTI_CLICHE + "\n\n" + OFFLINE_NARRATIVE_RUNTIME + "\n\n【谢幕】为这条 if 线写终场戏:用第一人称『我』代入「" + char.name + "」,顺着已发生的剧情把这条线收在一个有余味的落点——不强行大团圆、不总结陈词,最后一拍落在具体的动作或一句话上。只输出 JSON:{\"scene\":\"终场正文\"}";
        const user = "【设定】" + line.setting + "\n【各轮目标】" + line.rounds.map(r => r.goal + (r.goalDone ? "(✓)" : r.failed ? "(✗失败)" : "")).join(";") + "\n【最近剧情】\n" + recent;
        const raw = await callAI(props.active, sys, [{ role: "user", content: user }], { maxTokens: 2600, timeout: 150000 });
        const p = extractJSON(raw) || { scene: String(raw || "").replace(/```(?:json)?/gi, "").trim() };
        if (!p.scene) throw new Error("终场没写出来");
        update(list => list.map(l => l.id !== line.id ? l : { ...l, ended: true, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: rid("tm_"), role: "char", content: p.scene, ts: Date.now(), curtain: true }] }) }));
      } catch (e) { props.toast("生成失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    // 当轮剧照:第三人称旁观构图,服饰道具跟 if 线世界观;有两张脸参考才双人,否则他单人
    const genPhoto = async () => {
      if (!line || busy) return;
      const char = charOf(line);
      if (!(typeof imgApiReady === "function" && imgApiReady())) return props.toast("请先配置图像 API");
      if (!(char.refPhoto || char.appearance)) return props.toast("角色还没有参考照或外貌描述");
      const duo = !!(char.refPhoto && props.profile && props.profile.refPhoto);
      setPlusOpen(false); setBusy(true);
      try {
        const recent = allMsgs(line).filter(m => m.role !== "photo").slice(-4).map(m => (m.role === "user" ? uName : char.name) + ":" + m.content).join("\n").slice(-1200);
        const prompt = "第三人称旁观视角的电影感画面(绝不是自拍,人物不看镜头,像剧照):" + (duo ? "画面里有两个人同框:「" + char.name + "」(脸严格按参考图1)和「" + uName + "」(脸严格按参考图2)。" : "画面里只有「" + char.name + "」一个人" + (char.refPhoto ? "(脸严格按参考图)" : "(外貌:" + char.appearance + ")") + ",绝不出现第二个人。") + "\n【世界与场景】" + line.setting + "\n【" + char.name + " 的身份】" + line.charRole + (duo ? "\n【" + uName + " 的身份】" + line.userRole : "") + "\n【此刻正在发生(画最近剧情的当下一瞬)】\n" + recent + "\n服装、发型、道具、环境必须符合上述 if 线的世界观与身份,绝不让原设定或现代便装乱入;构图取此刻最有张力的一瞬。";
        const refs = duo ? [char.refPhoto, props.profile.refPhoto] : (char.refPhoto ? [char.refPhoto] : null);
        const out = await generateSelfieImage(prompt, refs);
        if (!out || !out.blob) throw new Error("没出图");
        const durl = await blobToDataUrl(out.blob);
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, msgs: [...r.msgs, { id: rid("tm_"), role: "photo", img: ref, ts: Date.now() }] }) }));
      } catch (e) { props.toast("出图失败:" + (e.message || "重试")); } finally { setBusy(false); }
    };
    const rerollPhoto = m => { if (busy) return; update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: l.rounds.map(r => ({ ...r, msgs: r.msgs.filter(x => x.id !== m.id) })) })); setTimeout(genPhoto, 60); };
    const pressStart = m => { clearTimeout(pressRef.current); pressRef.current = setTimeout(() => setPhotoMenu(m), 550); };
    const pressEnd = () => clearTimeout(pressRef.current);
    const onBgFile = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = "";
      if (!f || !line) return;
      try {
        const durl = typeof resizeImageFile === "function" ? await resizeImageFile(f, 1600, 0.85) : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        const ref = typeof imgToVault === "function" ? await imgToVault(durl) : durl;
        update(list => list.map(l => l.id !== line.id ? l : { ...l, bg: ref }));
        setPlusOpen(false);
      } catch (err) { props.toast("背景设置失败"); }
    };
    const imgSrc = ref => (typeof resolveImg === "function" ? resolveImg(ref) : ref);
    const delLine = id => { if (!confirm("删除这条 if 线和全部记录?")) return; setView("list"); setPlayId(null); update(list => list.filter(l => l.id !== id)); };

    // ---- UI ----
    const S = { wrap: { position: "fixed", inset: 0, zIndex: 60, background: t.bg, display: "flex", flexDirection: "column" },
      top: { display: "flex", alignItems: "center", gap: 10, padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 10px", borderBottom: "1px solid " + t.line },
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
        h("div", { style: { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" } },
          h("button", { onClick: acceptDraft, style: S.btn(true) }, "就这个,开演"),
          !draft.fromPreset && h("button", { onClick: genSetting, disabled: busy, style: S.btn(false) }, busy ? "在想…" : "换一版"),
          !draft.fromPreset && h("button", { onClick: () => addPreset(draft), style: S.btn(false) }, "收藏为基线")));
      return h("div", { style: S.wrap }, header("新开 if 线"),
        h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
          h("div", { style: S.card }, h("div", { style: S.lbl }, "选角色"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, props.characters.map(c =>
              h("button", { key: c.id, onClick: () => setPickChar(c.id), style: Object.assign({}, S.btn(pickChar === c.id)) }, c.name)))),
          h("div", { style: S.card }, h("div", { style: S.lbl }, "关键词(选填:题材/身份/氛围,如「民国 报社 追凶」)"),
            h("textarea", { value: kw, onChange: e => setKw(e.target.value), rows: 2, placeholder: "空着=让 Ta 自由发挥", style: { width: "100%", background: "transparent", border: "none", outline: "none", fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none" } }),
            h("div", { style: S.lbl }, "难度"),
            h("div", { style: { display: "flex", gap: 6, marginBottom: 6 } }, ["easy", "normal", "hard"].map(k =>
              h("button", { key: k, onClick: () => setDiff(k), style: S.btn(diff === k) }, DIFF[k].name))),
            !draft && h("button", { onClick: genSetting, disabled: busy, style: Object.assign({ marginTop: 4 }, S.btn(true)) }, busy ? "在想…" : "生成设定")),
          !draft && presets.filter(p => p.charId === pickChar).length ? h("div", { style: S.card },
            h("div", { style: S.lbl }, "收藏的基线(用同一套身份世界开新局)"),
            presets.filter(p => p.charId === pickChar).map(ps => h("div", { key: ps.id, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
              h("div", { style: Object.assign({}, S.txt, { flex: 1 }) }, ps.title),
              h("button", { onClick: () => genFromPreset(ps), disabled: busy, style: S.btn(true) }, "开新局"),
              h("button", { onClick: () => { if (confirm("删除这条基线?")) savePresets(l => l.filter(x => x.id !== ps.id)); }, style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "✕")))) : null,
          preview));
    }

    if (view === "play" && line) {
      const char = charOf(line);
      const round = line.rounds[line.rounds.length - 1];
      const ta = (k, rows) => h("textarea", { value: edit[k], onChange: e => setEdit(p => ({ ...p, [k]: e.target.value })), rows: rows || 3, style: { width: "100%", padding: 8, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "vertical", outline: "none" } });
      const panel = panelOpen && h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", maxHeight: "56vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }) },
        edit
          ? [h("div", { key: "e1", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "线名"), ta("title", 1)),
             h("div", { key: "e2", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "Ta 的身份"), ta("charRole")),
             h("div", { key: "e3", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, uName + " 的身份"), ta("userRole", 2)),
             h("div", { key: "e4", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "世界与情境"), ta("setting", 4)),
             h("div", { key: "e5", style: { marginBottom: 7 } }, h("div", { style: S.lbl }, "当前轮目标"), ta("goal", 2)),
             h("div", { key: "e6", style: { display: "flex", gap: 8 } },
               h("button", { onClick: () => { const e2 = edit; update(list => list.map(l => l.id !== line.id ? l : { ...l, title: e2.title.trim() || l.title, charRole: e2.charRole, userRole: e2.userRole, setting: e2.setting, rounds: l.rounds.map((r, i) => i !== l.rounds.length - 1 ? r : { ...r, goal: e2.goal }) })); setEdit(null); props.toast("已保存"); }, style: S.btn(true) }, "保存"),
               h("button", { onClick: () => setEdit(null), style: S.btn(false) }, "取消"))]
          : [[["Ta 的身份", line.charRole], [uName + " 的身份", line.userRole], ["世界与情境", line.setting]].map(([k, v]) => v ? h("div", { key: k, style: { marginBottom: 7 } }, h("div", { style: S.lbl }, k), h("div", { style: S.txt }, v)) : null),
             h("div", { key: "df", style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 7 } },
               h("span", { style: S.lbl }, "难度"),
               ["easy", "normal", "hard"].map(k => h("button", { key: k, onClick: () => update(list => list.map(l => l.id !== line.id ? l : { ...l, difficulty: k })), style: S.btn((line.difficulty || "normal") === k) }, DIFF[k].name))),
             h("div", { key: "gl", style: S.lbl }, "各轮目标"),
             line.rounds.map((r, i) => h("div", { key: r.id, style: Object.assign({}, S.txt, { marginBottom: 3 }) }, "第" + (i + 1) + "轮:" + r.goal + (r.goalDone ? " ✓" : r.failed ? " ✗失败" : i === line.rounds.length - 1 ? "(进行中)" : "(未完)"))),
             h("div", { key: "bt", style: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" } },
               line.ended ? null : (round.goalDone || round.failed)
                 ? [h("button", { key: "ai", onClick: () => genGoal("next"), disabled: busy, style: S.btn(true) }, busy ? "在想…" : "下一轮·AI想"),
                    h("button", { key: "hand", onClick: () => setWriteGoal(""), style: S.btn(false) }, "下一轮·自己写")]
                 : h("button", { onClick: () => genGoal("redo"), disabled: busy, style: S.btn(false) }, busy ? "在想…" : "换个目标"),
               !line.ended && h("button", { onClick: endLine, disabled: busy, style: S.btn(false) }, "谢幕收线"),
               h("button", { onClick: restartLine, disabled: busy, style: S.btn(false) }, "重开此线"),
               h("button", { onClick: () => setEdit({ title: line.title, charRole: line.charRole, userRole: line.userRole, setting: line.setting, goal: round.goal }), style: S.btn(false) }, "编辑设定"),
               h("button", { onClick: () => addPreset(line), style: S.btn(false) }, "收藏此设定"),
               h("button", { onClick: () => delLine(line.id), style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "删除此线")),
             writeGoal !== null && h("div", { key: "wg", style: { marginTop: 8 } },
               h("div", { style: S.lbl }, "写下一轮目标(记得写成「让他…」)"),
               h("textarea", { value: writeGoal, onChange: e => setWriteGoal(e.target.value), rows: 2, style: { width: "100%", padding: 8, borderRadius: 10, border: "1px solid " + t.line, background: t.bg, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "vertical", outline: "none" } }),
               h("div", { style: { display: "flex", gap: 8, marginTop: 6 } },
                 h("button", { onClick: () => { const g = (writeGoal || "").trim(); if (!g) return; update(list => list.map(l => l.id !== line.id ? l : { ...l, rounds: [...l.rounds, { id: rid("tr_"), goal: g, goalDone: false, goalNote: null, pending: false, msgs: [], startTs: Date.now() }] })); setWriteGoal(null); }, style: S.btn(true) }, "开这一轮"),
                 h("button", { onClick: () => setWriteGoal(null), style: S.btn(false) }, "算了")))]);
      const banner = round.pending ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: t.ink }) },
        h("div", { style: S.txt }, "本轮目标可能已达成:" + round.goal + (typeof round.pending === "string" ? "\n(" + round.pending + ")" : "")),
        h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          h("button", { onClick: () => confirmGoal(true), style: S.btn(true) }, "确认达成"),
          h("button", { onClick: () => confirmGoal(false), style: S.btn(false) }, "还没有")))
      : round.pendingFail ? h("div", { style: Object.assign({}, S.card, { margin: "8px 14px", borderColor: "#a4442e" }) },
        h("div", { style: S.txt }, "这条路可能已经走死了:" + round.goal + (typeof round.pendingFail === "string" ? "\n(" + round.pendingFail + ")" : "")),
        h("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
          h("button", { onClick: () => confirmFail(true), style: Object.assign({}, S.btn(true), { background: "#a4442e", borderColor: "#a4442e" }) }, "确认失败"),
          h("button", { onClick: () => confirmFail(false), style: S.btn(false) }, "还有机会"))) : null;
      let ri = 0;
      const flow = line.rounds.flatMap((r, i) => [h("div", { key: "rd" + r.id, style: { textAlign: "center", fontFamily: F_BODY, fontSize: 10, color: t.fog, margin: "14px 0 4px" } }, "— 第" + (i + 1) + "轮 · " + r.goal + (r.goalDone ? " ✓" : r.failed ? " ✗" : "") + " —")]
        .concat(r.msgs.map(m => m.role === "photo"
          ? h("div", { key: m.id, onPointerDown: () => pressStart(m), onPointerUp: pressEnd, onPointerMove: pressEnd, onPointerLeave: pressEnd, onContextMenu: e => e.preventDefault(), style: { margin: "10px 14px", textAlign: "center" } }, h("img", { src: imgSrc(m.img), style: { maxWidth: "86%", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.18)" } }))
          : m.role === "user"
          ? h("div", { key: m.id, style: { margin: "10px 14px", textAlign: "right" } }, h("span", { style: { display: "inline-block", maxWidth: "82%", textAlign: "left", padding: "9px 13px", borderRadius: 15, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, m.content))
          : h("div", { key: m.id, style: Object.assign({ margin: "10px 14px" }, S.txt) }, m.content))));
      const photoSheet = photoMenu && h("div", { onClick: () => setPhotoMenu(null), style: { position: "fixed", inset: 0, zIndex: 140, background: "rgba(30,28,24,.4)", display: "flex", alignItems: "flex-end" } },
        h("div", { onClick: e => e.stopPropagation(), style: { width: "100%", background: t.bg2, borderRadius: "18px 18px 0 0", padding: "14px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)" } },
          [["重拍这张", () => { const m = photoMenu; setPhotoMenu(null); rerollPhoto(m); }],
           ["保存到手机相册", async () => { const m = photoMenu; setPhotoMenu(null); try {
             let blob = null;
             if (String(m.img).indexOf("iv_") === 0 && typeof idbVaultGet === "function") blob = await idbVaultGet(m.img);
             if (!blob) blob = await (await fetch(imgSrc(m.img))).blob();
             const file = new File([blob], "theater_" + Date.now() + ".png", { type: blob.type || "image/png" });
             if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] }); // iOS 分享单里选「存储图像」即入系统相册
             else { window.open(URL.createObjectURL(blob), "_blank"); props.toast("在新页长按图片存储"); }
           } catch (e) { if (!/Abort/i.test(String(e && e.name || e))) props.toast("保存失败"); } }],
           ["取消", () => setPhotoMenu(null)]].map(([label, fn], i) => h("button", { key: label, onClick: fn, style: { width: "100%", padding: "13px 0", fontFamily: F_BODY, fontSize: 14, color: i === 0 ? t.ink : i === 2 ? t.fog : t.ink, background: "transparent", border: "none", borderTop: i ? "1px solid " + t.line : "none" } }, label))));
      return h("div", { style: S.wrap },
        line.bg ? h("div", { style: { position: "absolute", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(240,236,228,.8),rgba(240,236,228,.8)), url(" + imgSrc(line.bg) + ")", backgroundSize: "cover", backgroundPosition: "center" } }) : null,
        h("div", { style: { position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } }, header(line.title + " · " + (char.name || "")), photoSheet,
        panel, banner,
        h("div", { ref: scrollRef, style: { flex: 1, overflowY: "auto", paddingBottom: 16 } }, flow,
          busy ? h("div", { style: { margin: "10px 14px", fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "Ta 在演…") : null),
        line.ended ? h("div", { style: { textAlign: "center", padding: "16px 14px calc(env(safe-area-inset-bottom, 0px) + 16px)", borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 11, letterSpacing: 2, color: t.fog } }, "—— 已完结 · 可在「背景与目标」里重开 ——") : noteOpen ? h("div", { style: { padding: "8px 14px 0", borderTop: "1px solid " + t.line } },
          h("textarea", { value: note, onChange: e => setNote(e.target.value), rows: 2, placeholder: "导演便签(只给这一拍的幕后指示,不入剧情):比如「让他更凶一点」「引入一个不速之客」", style: { width: "100%", padding: 8, borderRadius: 10, border: "1px dashed " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12, color: t.ink, resize: "none", outline: "none" } })) : null,
        !line.ended && plusOpen ? h("div", { style: { display: "flex", gap: 8, padding: "8px 14px 0", borderTop: "1px solid " + t.line, flexWrap: "wrap" } },
          h("button", { onClick: () => { setDice(v => !v); }, style: S.btn(dice) }, "🎲 骰子" + (dice ? "·已上膛" : "")),
          h("button", { onClick: () => { setNoteOpen(v => !v); }, style: S.btn(noteOpen || !!note.trim()) }, "() 便签"),
          h("button", { onClick: genPhoto, disabled: busy, style: S.btn(false) }, "📷 当轮剧照"),
          h("button", { onClick: () => fileRef.current && fileRef.current.click(), style: S.btn(false) }, "🖼 背景图"),
          line.bg ? h("button", { onClick: () => { update(list => list.map(l => l.id !== line.id ? l : { ...l, bg: null })); setPlusOpen(false); }, style: Object.assign({}, S.btn(false), { color: "#a4442e", borderColor: "#a4442e55" }) }, "清除背景") : null) : null,
        line.ended ? null : h("div", { style: { display: "flex", gap: 8, padding: "10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px)", borderTop: (noteOpen || plusOpen) ? "none" : "1px solid " + t.line } },
          h("input", { type: "file", accept: "image/*", ref: fileRef, onChange: onBgFile, style: { display: "none" } }),
          h("button", { onClick: () => setPlusOpen(v => !v), style: Object.assign({}, S.btn(plusOpen || dice || !!note.trim()), { padding: "7px 12px" }) }, plusOpen ? "×" : "+"),
          h("textarea", { value: input, onChange: e => setInput(e.target.value), rows: 1, placeholder: (round.msgs.length && round.msgs[round.msgs.length - 1].role === "user") ? "上条没生成出来,直接按「演」重试" : "你的行动或台词…", style: { flex: 1, padding: "10px 13px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13, color: t.ink, resize: "none", outline: "none" } }),
          h("button", { onClick: send, disabled: busy, style: S.btn(true) }, "演"))));
    }

    // list:按角色分组收纳;每条记录可单独删除
    const groups = [];
    lines.forEach(l => { let g = groups.find(x => x.charId === l.charId); if (!g) { g = { charId: l.charId, items: [] }; groups.push(g); } g.items.push(l); });
    return h("div", { style: S.wrap }, header("小剧场"),
      h("div", { style: { flex: 1, overflowY: "auto", paddingBottom: 30 } },
        lines.length ? groups.map(g => { const c = props.characters.find(x => x.id === g.charId) || {};
          return h("div", { key: g.charId },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: t.sub, margin: "16px 16px 0" } }, (c.name || "?") + " · " + g.items.length + "条线"),
            g.items.map(l => { const n = allMsgs(l).length; const done = l.rounds.filter(r => r.goalDone).length;
              return h("div", { key: l.id, onClick: () => { setPlayId(l.id); setView("play"); setPanelOpen(false); }, style: Object.assign({}, S.card, { cursor: "pointer", position: "relative" }) },
                h("button", { onClick: e => { e.stopPropagation(); if (confirm("删除「" + l.title + "」和全部记录?")) update(list => list.filter(x => x.id !== l.id)); },
                  style: { position: "absolute", top: 10, right: 10, background: "none", border: "none", color: t.fog, fontSize: 15, padding: 4 } }, "✕"),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, paddingRight: 26 } }, l.title),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, marginTop: 4 } }, (l.ended ? "已完结 · " : "") + "第" + l.rounds.length + "轮 · 目标达成" + done + " · " + n + "条" + (l.archives && l.archives.length ? " · 重开过" + l.archives.length + "次" : "")),
                h("div", { style: Object.assign({}, S.txt, { color: t.fog, fontSize: 12, marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }) }, l.setting)); })); })
        : h("div", { style: { textAlign: "center", marginTop: 80, fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 2 } }, "还没有 if 线。", h("br"), "选个角色,把 Ta 扔进另一种人生试试。")));
  }
  window.TheaterApp = TheaterApp;
})();
