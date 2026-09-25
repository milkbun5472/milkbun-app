// ============================================================
// 一起学（study）—— 与主聊天完全隔离的学习向对话模块
// 数据走 localStorage（x_study_sessions / x_curricula），自动跟随云同步。
// 三种模式：teach（1v1 认真教）/ costudy（1v1 一起研究）/ nv1（一教一学+同学）
// 隔离命门：study 的 prompt 绝不注入主聊天记忆；只注入
//   角色卡 + 世界书 + 本 slot 的 progress + curriculum 切片 + transcript 尾巴
// ============================================================
(function () {
  // 禁烟这一层（她 2026-09-05：「你看看还有哪儿没禁烟的」）。
  // ⚠️它是【世界事实】，不是文风：这个 app 里没人抽烟，那在哪一处都得成立。
  //   原来它只挂在 buildBundle / groupBans 上，于是【凡是自己拼 sys 的地方一律没有】。
  //   不许塞进 ANTI_CLICHE 搭便车（v55.90 那条：能独立成立的规则就让它独立成立，
  //   挂在别人身上，别人不发的那一轮它就跟着消失）。
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");
  // ---- 内置 prompt 块 -------------------------------------------------
  const USER_SLOT_PROTECT =
    "【用户槽位保护（最高优先级）】\n" +
    "- 你只能扮演你自己（以及角色卡/世界书明确授权你分饰的 NPC）。绝对不能替『用户』发言、代答、代做决定。\n" +
    "- 不要在输出里写用户的台词、想法或动作；轮到用户的部分一律留白，等TA真实开口。\n" +
    "- 你无权替用户宣称TA“学会了/掌握了/理解了/记住了”。是否掌握，只由用户本人或TA手动触发的结算判定。\n" +
    "- 教/讨论时多把球抛回给用户（提问、留练习、请TA复述或试answer），而不是自问自答一路讲到底。";
  const RETEACH_RULE =
    "【换一种讲法】当用户说没听懂或要求换种讲法，禁止只替换同义词再讲一遍。必须换教学维度：抽象→具体例子、公式→图像/步骤、定义→类比、讲解→一起做、或换成更小的前置知识；并先用一句话确认刚才可能卡在哪里。";

  const OUT_FMT =
    "\n【输出格式】只输出一个 JSON 对象，基础形态是 {\"say\":[\"气泡1\",\"气泡2\"]}；需要时可按上方规则在同一对象加入 quiz 或 evidence。" +
    "say 里放你这一轮说出口的话，可拆成 1~4 个气泡（像即时通讯那样分条），" +
    "不要加名字前缀、不要旁白括号、不要 markdown、不要把 JSON 以外的东西吐出来。";
  // 研究笔记板（一起研究专用）：原来只有一份攒满才浓缩的摘要，每轮看不见走到哪一步了。
  const BOARD_FMT =
    "\n【研究笔记板（可选，接在同一个 JSON 里）】这一轮研究真有了进展时——问题问得更准了、多了一个猜测、验证了某一点、冒出新疑问——" +
    "就在同一个 JSON 里加 \"board\":{\"question\":\"现在在研究的问题（一句）\",\"guesses\":[\"还没验证的猜测\"],\"confirmed\":[\"已经确认的，附一句依据\"],\"open\":[\"还没解决的\"]}，" +
    "写【整块板的新样子】（没变的条目照抄）。没有进展就不加。只有真的验证过才能进 confirmed，推测一律放 guesses。每栏最多 6 条，每条一句。";
  const QUIZ_CARD_FMT =
    "\n【可交互题卡】需要用户作答时，优先不要把题目只写成聊天文字；在同一个 JSON 里加 quiz。每轮最多 1 张：" +
    "{\"type\":\"fill_blank|choice|true_false\",\"prompt\":\"题目\",\"point_id\":\"当前要点id\"," +
    "\"options\":[{\"id\":\"A\",\"label\":\"选项文字\"}],\"answer\":\"标准答案或选项id\",\"aliases\":[\"可接受别名\"]," +
    "\"word_bank\":[\"填空可选词块\"],\"hints\":[\"一级：只提醒方向\",\"二级：指出关键步骤\",\"三级：给相似例子但仍不直接给答案\"],\"explanation\":\"答对后的简短解释\"}。" +
    "choice 必须有 2~5 个 options；true_false 的 answer 只能是 true/false 且不需要 options；fill_blank 可给 aliases（大小写不用重复列，系统会自动忽略）。" +
    "适合拼句、排序或词汇回忆的 fill_blank 可以给 3~12 个 word_bank 词块（含必要干扰项），不适合就省略。" +
    "每题尽量给 2~3 级递进 hints；前两级绝不能直接泄露答案，最后一级也优先给相似例子。题面不要泄露答案，别在 say 里再重复整道题。只依据当前小节出题。" +
    // ⚠️她 2026-09-23：「老师出题都只是 multiple choice」。三种题型一直都在，可这儿从没说过什么时候用哪一种——
    //   模型就一直挑最省事的那种。判据跟掌握度那头是同一件事：选择／判断答对只证明【认得出】，
    //   要自己写出来才算会（quizMasteryLevel 早就这么判了），所以只出选择题，她的掌握度也升不上去。
    "\n【题型怎么挑】看她对这个要点到了哪一步：刚讲完、第一次考，choice／true_false 可以，先看她认不认得出；"
    + "她已经认得出来的要点，就换 fill_blank，让她自己把它写出来——从几个里挑出来和自己写出来是两回事。"
    + "进度里写着「已经认得出」的那几个要点，再考就用 fill_blank。";
  // 讲义／小抄／练习（她 2026-09-24：「让他也可以发文件过来」）。
  // ⚠️这儿只让老师【说要给】：正文另写一枪（genHandout），不然这一轮的气泡要等一整份讲义写完才出来。
  const HANDOUT_FMT =
    "\n【给她一份东西（可选，接在同一个 JSON 里）】你觉得这会儿该甩一份东西给她带走的时候——讲完一块想让她留着的笔记、一页考前能扫完的小抄、几道让她自己回去做的题——"
    + "就加 \"handout\":{\"kind\":\"讲义|小抄|练习\",\"title\":\"这份的标题\",\"focus\":\"这份要写什么、为什么现在给\"}。"
    + "它会另外写成一份文件递到她手上；say 里照常说你递给她时会说的那句。她开口要，就给；平时看你自己觉得值不值得，不必每节都有。";
  // 学习证据信号（只给 teach / nv1-teacher）：老师只能报告用户刚才真实作答的表现，不能自行宣布学会/推进。
  const STUDY_PROGRESS_FMT =
    "\n【学习证据（可选，接在同一个 JSON 里）】只有当用户刚刚真的回答了一道题、完成了练习或亲口复述时，才可加 " +
    "\"evidence\":{\"point_id\":\"当前要点id\",\"result\":\"correct|partial|incorrect\",\"support\":\"none|hinted|guided\",\"note\":\"一句具体依据\"}。" +
    "用户只是说懂了、提问、闲聊，或你刚讲完，都不算学习证据，不要输出 evidence。你无权输出 done，也无权自行推进小节。";

  function sceneFor(mode, subject, extra) {
    if (mode === "teach")
      return "【当前场景：一起学 · 认真教】你在一对一地教「用户」学『" + subject + "』。" +
        "你是有能力的老师：按下方课程大纲的【当前单元】推进，讲解具体、给例子、可跟练，并留出让用户练习和提问的空间。" +
        "一次只推进一小步，别把整个单元一口气倒完。用自然的教学口吻，不八股。";
    if (mode === "costudy")
      // 原来只说了「别装懂」，没说「那你拿什么来研究」——于是只剩附和、提问、说不确定，
      //   像陪聊不像搭档（她 2026-09-23：「一起研究现在是个什么模式怎么样能做更好一点」）。
      return "【当前场景：一起学 · 一起研究】你和用户一起研究『" + subject + "』——你并不比TA更懂，这是共同探索。" +
        "你带进来的是【你自己】：从你的职业、经历、手艺、偏好里找这件事的切入点——同一个问题，不同的人会从完全不同的地方下手，你的那个角度就是你在这儿的用处。" +
        "别只等TA开口：每一轮都试着把研究往前推一小步——提一个具体的猜测、想一个能马上试的小办法、举一个你熟悉的类比、或者承认上次想错了。" +
        "别不懂装懂、别硬编权威答案或来源；拿不准就直说拿不准，说清楚是哪一点拿不准、怎么能验证。";
    if (mode === "nv1-teacher")
      return "【当前场景：一起学 · 你是老师，现场还有另一个同学】你在教「用户」和另一位同学一起学『" + subject + "』。" +
        "按大纲【当前单元】推进，照顾两个学生，但绝不替他们回答。" + (extra ? "另一位同学：" + extra + "。" : "");
    if (mode === "nv1-peer")
      // 原来写死「会答错、会提问、偶尔走神」——那是一个模板学生，谁来演都一样。
      return "【当前场景：一起学 · 你和用户是同学】你和用户一起跟老师" + (extra ? "「" + extra + "」" : "") + "学『" + subject + "』。" +
        "你也在学，按【你自己】来学：以你的性格、背景和已有的底子，你会在哪儿卡住、在哪儿一点就通、怎么提问、懂了会不会忍不住显摆、跟这位老师和用户各是什么相处方式。" +
        "别抢老师的活，也绝不替用户回答；以同学身份自然参与。";
    return "";
  }

  // ---- 存储 ----------------------------------------------------------
  const K_SESS = "x_study_sessions";
  const K_CUR = "x_curricula";
  function loadSessions() { return loadJSON(K_SESS, []); }
  function saveSessions(list) { saveJSON(K_SESS, list); }
  function loadCurricula() { return loadJSON(K_CUR, []); }
  function saveCurricula(list) { saveJSON(K_CUR, list); }
  function findCurriculum(id) { return loadCurricula().find(function (c) { return c.id === id; }) || null; }
  function findCurriculumBySubject(subject) {
    const s = String(subject || "").trim().toLowerCase();
    return loadCurricula().find(function (c) { return String(c.subject || "").trim().toLowerCase() === s; }) || null;
  }
  // 课程 upsert（课程 = 大目标容器：goal + 跨 session 记忆；不再挂 units/progress）
  function saveCurriculum(cur) {
    const all = loadCurricula();
    const i = all.findIndex(function (c) { return c.id === cur.id; });
    if (i >= 0) all[i] = cur; else all.push(cur);
    saveCurricula(all);
  }
  // 把一条 session 摘要并进课程记忆（同 sessionId 覆盖旧摘要）——curriculum 内互通，不碰全局记忆库
  function pushCurriculumSummary(curId, sessionId, text) {
    const all = loadCurricula().map(function (c) {
      if (c.id !== curId) return c;
      const mem = c.memory || { summaries: [] };
      const summaries = (mem.summaries || []).filter(function (s) { return s.sessionId !== sessionId; })
        .concat([{ sessionId: sessionId, text: text, ts: Date.now() }]);
      // 保留 memory 上除 summaries 外的一切（review_items 等）——曾整体重建导致间隔复习题库被清零
      return Object.assign({}, c, { memory: Object.assign({}, mem, { summaries: summaries }), updated_at: Date.now() });
    });
    saveCurricula(all);
  }

  function newProgress(mode) {
    if (mode === "costudy") return { running_summary: "", summary_buffer: [], loose_vocab: [] };
    return { current_unit: null, completed: [], mastery: {}, review_queue: [], notes: "", evidence: [], mistakes: [], exit_ticket: null,
      warmup_queue: [], warmup_started: false };
  }
  // 从本节 outline 起一份 session 进度（第一小节起步）
  function initSessionProgress(outline) {
    const p = newProgress("teach");
    const units = outline && outline.units;
    if (Array.isArray(units) && units.length) p.current_unit = units[0].id;
    return p;
  }

  // ---- 迁移：v28「课程挂 units+progress」→ v29「课程=目标容器 + session 自带 outline」----
  // 老 session 从其课程下放 units/progress，令 session 自足；课程补 memory/mode/cast。幂等。
  function migrate() {
    const curs = loadCurricula();
    if (!curs.length) return;
    const sess = loadSessions();
    const curById = {};
    curs.forEach(function (c) { curById[c.id] = c; });
    let cChanged = false, sChanged = false;
    sess.forEach(function (s) {
      if (!s.curriculum_id || s.outline || s.mode === "costudy") return;
      const c = curById[s.curriculum_id];
      if (c && Array.isArray(c.units) && c.units.length) {
        s.outline = { units: c.units, level: c.level || "", language: c.language || "中文" };
        s.progress = s.progress || (c.progress ? c.progress : initSessionProgress(s.outline));
        sChanged = true;
      }
    });
    curs.forEach(function (c) {
      if (!c.memory) { c.memory = { summaries: [], review_items: [] }; cChanged = true; }
      else if (!Array.isArray(c.memory.review_items)) { c.memory.review_items = []; cChanged = true; }
      if (!c.mode || !c.character_ids) {
        const refs = sess.filter(function (s) { return s.curriculum_id === c.id; });
        const recent = refs.slice().sort(function (a, b) { return (b.updated_at || 0) - (a.updated_at || 0); })[0];
        if (!c.mode) c.mode = recent && recent.mode === "nv1" ? "nv1" : "teach";
        if (!c.character_ids) { c.character_ids = recent ? (recent.character_ids || []).slice() : []; c.teacher_id = recent ? (recent.teacher_id || null) : null; }
        cChanged = true;
      }
      if (!c.updated_at) { c.updated_at = c.created_at || Date.now(); cChanged = true; }
    });
    if (sChanged) saveSessions(sess);
    if (cChanged) saveCurricula(curs);
  }
  migrate();

  // ---- transcript 工具 ----------------------------------------------
  // entry: { id, role:'user'|'char', speakerId, name, content, ts }
  function tail(transcript, n) { return (transcript || []).slice(-(n || 6)); }
  // 图只在出话那一刻从图库临时展开（engine.js 的 expandMessageImages，主聊天也走它），最近两张
  async function withImages(msgs) {
    if (!msgs.some(function (m) { return m && m._imageRefs && m._imageRefs.length; })) return msgs;
    return typeof expandMessageImages === "function" ? expandMessageImages(msgs, 2) : msgs;
  }

  // 把 transcript 尾巴映射成 API messages：目标角色自己的话=assistant，
  // 用户与其它角色的话=user（带「名字：」前缀供上下文，不影响输出）
  function toMessages(transcript, targetId, userName) {
    const msgs = [];
    tail(transcript, 12).forEach(function (m) {
      if (m.role === "char" && m.speakerId === targetId) {
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant") last.content += "\n" + m.content;
        else msgs.push({ role: "assistant", content: m.content });
      } else {
        const who = m.role === "user" ? (userName || "用户") : (m.name || "同学");
        // 她发的图（她 2026-09-23：「一起学也可以发图片给老师和同学看」）：图本身走视觉输入，文字里留一个标记
        const line = who + "：" + (m.imageRef ? "［发了一张图，图附在这条消息上］" : "") + (m.content || "");
        const last = msgs[msgs.length - 1];
        if (last && last.role === "user") {
          last.content += "\n" + line;
          if (m.imageRef) last._imageRefs = (last._imageRefs || []).concat([m.imageRef]);
        } else msgs.push(Object.assign({ role: "user", content: line }, m.imageRef ? { _imageRefs: [m.imageRef] } : {}));
      }
    });
    if (!msgs.length || msgs[msgs.length - 1].role !== "user")
      msgs.push({ role: "user", content: "（请你自然地开场 / 继续这堂课）" });
    return msgs;
  }

  // ---- 本节 outline 切片：当前小节全量 + 其余仅标题（units 来自 session.outline）----
  function outlineSlice(outline, currentUnitId, goal) {
    const units = outline && outline.units;
    if (!Array.isArray(units) || !units.length) return "";
    const idx = Math.max(0, units.findIndex(function (u) { return u.id === currentUnitId; }));
    const cu = units[idx] || units[0];
    const lines = [];
    lines.push("【本节课大纲：" + (goal || "") + "（" + (outline.level || "") + "）· 共 " + units.length + " 小节】");
    lines.push("全部小节（仅标题）：" + units.map(function (u, i) {
      return (i + 1) + "." + (u.title || u.id) + (u.id === cu.id ? "←当前" : "");
    }).join("  "));
    if (cu) {
      lines.push("\n【当前小节 · 全量】" + (cu.title || cu.id));
      if (cu.objectives && cu.objectives.length) lines.push("目标：" + cu.objectives.join("；"));
      // point_id 是题卡与学习证据的外键；只给标签会逼模型凭空猜 id，合法题卡也会被校验层吞掉。
      if (cu.grammar && cu.grammar.length) lines.push("要点（方括号内是必须原样使用的 point_id）：" + cu.grammar.map(function (g) { return "[" + g.id + "] " + g.label + (g.note ? "（" + g.note + "）" : ""); }).join("；"));
      if (cu.vocab && cu.vocab.length) lines.push("词汇：" + cu.vocab.join("、"));
      if (cu.can_do && cu.can_do.length) lines.push("学完能做到：" + cu.can_do.join("；"));
    }
    return lines.join("\n");
  }

  function progressText(units, progress) {
    if (!progress) return "";
    const lines = ["【当前进度】"];
    const unit = Array.isArray(units) ? units.find(function (u) { return u.id === progress.current_unit; }) : null;
    lines.push("当前小节：" + (unit ? unit.title : (progress.current_unit || "第一小节")) +
      "（已完成 " + (progress.completed || []).length + " / " + (units ? units.length : "?") + " 小节）");
    const m = progress.mastery || {};
    const currentIds = unit && Array.isArray(unit.grammar) ? unit.grammar.map(function (g) { return String(g.id); }) : [];
    const keys = currentIds.filter(function (id) { return Object.prototype.hasOwnProperty.call(m, id); });
    if (keys.length && unit && unit.grammar) {
      const label = {};
      unit.grammar.forEach(function (g) { label[g.id] = g.label; });
      const parts = keys.map(function (k) {
        const lv = m[k];
        const tag = lv >= 3 ? "稳" : lv === 2 ? "基本会" : lv === 1 ? "待复习" : "新学";
        return (label[k] || k) + ":" + tag;
      });
      lines.push("掌握情况：" + parts.join("，"));
      // 薄弱点（0新学/1待复习）→ 开场先带着复习，学过的东西才会牢（艾宾浩斯同款思路）
      const weak = keys.filter(function (k) { return m[k] <= 1; }).map(function (k) { return label[k] || k; });
      if (weak.length) lines.push("【开场先复习】这些点用户还不稳，这节开头先自然带 Ta 过一遍（提问/造句/小翻译均可，别照本宣科），确认接住了再进新内容：" + weak.join("、"));
    }
    // 题型跟着进度走（她 2026-09-23）：选择／判断答对过、填空还没对过的点——下一张就该让她自己写出来
    const ev = Array.isArray(progress.evidence) ? progress.evidence : [];
    const recog = currentIds.filter(function (id) {
      return ev.some(function (e) { return e && String(e.pointId) === id && e.result === "correct" && (e.quizType === "choice" || e.quizType === "true_false"); })
        && !ev.some(function (e) { return e && String(e.pointId) === id && e.result === "correct" && e.quizType === "fill_blank"; });
    });
    if (recog.length) {
      const lab = {};
      ((unit && unit.grammar) || []).forEach(function (g) { lab[g.id] = g.label; });
      lines.push("【这几个要点她已经认得出了，再考就用 fill_blank，让她自己写出来】" + recog.map(function (k) { return lab[k] || k; }).join("、"));
    }
    if (progress.notes) lines.push("备注：" + progress.notes);
    const unresolved = (progress.mistakes || []).filter(function (x) {
      return x && !x.resolved && currentIds.includes(String(x.pointId || ""));
    }).slice(-5);
    if (unresolved.length) lines.push("【真实作答暴露的薄弱点】" + unresolved.map(function (x) {
      return (x.pointId || "要点") + "：" + (x.note || "需要再练");
    }).join("；"));
    return lines.join("\n");
  }

  // 顶部进度既要守住“只有结课才能算完成一小节”的纪律，也要让本节真实答题有可见反馈。
  // 当前小节内，独立答对（level>=2）的要点只贡献不足 1 小节的视觉进度，不会写进 completed。
  function studyProgressRatio(units, progress) {
    const list = Array.isArray(units) ? units : [];
    if (!list.length) return 0;
    const p = progress || {};
    const completed = Array.isArray(p.completed) ? p.completed.filter(function (id) {
      return list.some(function (u) { return u.id === id; });
    }).length : 0;
    const current = list.find(function (u) { return u.id === p.current_unit; });
    const points = current && Array.isArray(current.grammar) ? current.grammar : [];
    const mastered = points.filter(function (g) { return Number((p.mastery || {})[g.id]) >= 2; }).length;
    const withinUnit = points.length ? (mastered / points.length) * 0.9 : 0;
    return Math.max(0, Math.min(1, (completed + withinUnit) / list.length));
  }

  // 普通教学只允许当前小节与已经完成的小节出题；结课题只能属于当前小节。
  // 到期跨 session 复习卡由 warmup_queue 直接落卡，不需要借“整份未来大纲”放行。
  function allowedQuizPointIds(units, progress, exitOnly) {
    const list = Array.isArray(units) ? units : [];
    const p = progress || {};
    const learned = new Set((p.completed || []).map(String));
    return list.filter(function (u) {
      return String(u.id) === String(p.current_unit) || (!exitOnly && learned.has(String(u.id)));
    }).reduce(function (ids, u) {
      return ids.concat((u.grammar || []).map(function (g) { return String(g.id); }));
    }, []);
  }

  function exitAnswerEntry(session, ticket) {
    if (!ticket || !ticket.quizId) return null;
    const rows = (session && session.transcript) || [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const m = rows[i];
      if (m && m.role === "user" && m.studyAction === "quiz_answer" &&
          String(m.quizId || "") === String(ticket.quizId) && Number(m.ts || 0) >= Number(ticket.askedAt || 0)) return m;
    }
    return null;
  }

  function unitCompletionGate(unit, progress, ticket, transcript) {
    const required = (unit && unit.grammar || []).map(function (g) { return String(g.id); });
    const answer = exitAnswerEntry({ transcript: transcript || [] }, ticket);
    const mastery = progress && progress.mastery || {};
    const missing = required.filter(function (id) { return Number(mastery[id]) < 2; });
    const exitPassed = !!answer && String(ticket.unitId || "") === String(unit && unit.id || "") &&
      required.includes(String(answer.quizPointId || "")) && Number(answer.quizLevel) >= 2;
    return { passed: !!required.length && exitPassed && !missing.length, exitPassed: exitPassed, missing: missing, answer: answer };
  }

  // costudy 的旧记录先进入可靠的待摘要缓冲区；只有 AI 摘要成功后才清缓冲，失败也不丢上下文。
  function compactStudyTranscript(session, cap) {
    const limit = Math.max(1, Number(cap) || 80);
    const rows = Array.isArray(session && session.transcript) ? session.transcript : [];
    if (rows.length <= limit) return session;
    const dropped = rows.slice(0, rows.length - limit);
    const next = Object.assign({}, session, { transcript: rows.slice(-limit) });
    if (session.mode === "costudy") {
      const progress = Object.assign({ running_summary: "", summary_buffer: [] }, session.progress || {});
      const folded = dropped.filter(function (m) { return m && m.content && !m.hidden; }).map(function (m) {
        return { id: m.id, role: m.role, name: m.name || "", content: String(m.content).slice(0, 800), ts: m.ts || 0 };
      });
      progress.summary_buffer = (progress.summary_buffer || []).concat(folded).slice(-120);
      next.progress = progress;
    }
    return next;
  }

  // ---- 课程记忆：curriculum 下跨 session 的往期摘要（内部互通，绝不碰全局聊天记忆库）----
  function curriculumMemoryText(cur) {
    if (!cur || !cur.memory) return "";
    const out = [];
    const sums = Array.isArray(cur.memory.summaries) ? cur.memory.summaries : [];
    if (sums.length) out.push("【这门课前几次一起学到哪了（跨 session 记忆，自然衔接、别生硬复述、别从零重来）】\n" +
      sums.slice(-8).map(function (s, i) { return (i + 1) + ". " + s.text; }).join("\n"));
    const book = mistakeBookText(cur);
    if (book) out.push(book);
    return out.join("\n\n");
  }
  // 老师看得到她的错题本（她 2026-09-23）：还留着的是她自己也觉得没过关的；她移出去的，是她觉得已经会了。
  // ⚠️给出口不给任务：写成「开场逐题复习」会变成一节课念清单。
  function mistakeBookText(cur) {
    const items = (cur && cur.memory && cur.memory.review_items) || [];
    const kept = mistakeBookItems(cur).slice(0, 6);
    const gone = items.filter(function (x) { return x && x.inBook === false && x.removedAt && Date.now() - x.removedAt < 21 * DAY_MS; })
      .sort(function (a, b) { return b.removedAt - a.removedAt; }).slice(0, 4);
    if (!kept.length && !gone.length) return "";
    const line = function (x) {
      return "· " + String(x.prompt || "").replace(/\s+/g, " ").slice(0, 60)
        + (x.lastAnswer ? "——她上次答「" + String(x.lastAnswer).slice(0, 40) + "」" : "")
        + "，答案是「" + quizAnswerText(x, x.answer).slice(0, 40) + "」" + (Number(x.wrongCount) > 1 ? "（错过 " + x.wrongCount + " 次）" : "");
    };
    return "【她的错题本】" + (kept.length ? "\n还留在本子里的（她自己也觉得还没过关）：\n" + kept.map(line).join("\n") : "")
      + (gone.length ? "\n她自己移出去的（她觉得已经会了）：\n" + gone.map(function (x) { return "· " + String(x.prompt || "").replace(/\s+/g, " ").slice(0, 60); }).join("\n") : "")
      + "\n这是让你心里有数的：讲到相关的地方，可以顺手让她再试一次、或者点破她上次卡在哪；她移出去的那几道，偶尔抽查一下她是不是真会了。";
  }

  // ---- 组 prompt（隔离：只注入被允许的几块） --------------------------
  function buildStudyPrompt(session, char, ctx, role) {
    const worldbook = ctx.worldbook || "";
    const profile = ctx.profile || {};
    const cur = session.curriculum_id ? findCurriculum(session.curriculum_id) : null;
    const parts = [];
    parts.push(ANTI_CLICHE);
    if (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt) parts.push(ContentBoundaries.prompt);
    if (worldbook && worldbook.trim()) parts.push(WORLDBOOK_RULE);
    parts.push(CHARCARD_RULE);
    parts.push(USER_SLOT_PROTECT);
    parts.push(RETEACH_RULE);
    parts.push("【角色人设】\n" + (char.persona || "（暂无设定）"));
    // 「这个人是谁」这几层一起学原来一层都没有（她 2026-09-23：「一起学之类的人设有被投进去吗」）。
    //   隔离挡的是【主聊天记忆】；长出来的自我、语气锚、整张卡那条都不是记忆，是人本身，所以照给。
    if (typeof grownSelfBlock === "function" && ctx.grown) parts.push(grownSelfBlock(ctx.grown, ctx.grownEvolve));
    if (typeof PERSONA_REGISTER_ANCHOR !== "undefined") parts.push(PERSONA_REGISTER_ANCHOR);
    if (typeof WHOLE_CARD_RULE !== "undefined") parts.push(WHOLE_CARD_RULE);
    if (profile.name || profile.persona)
      parts.push("【和你一起学的人 · " + userName(profile) + "】\n" + (profile.persona || "（未填写）"));
    if (worldbook && worldbook.trim()) parts.push("【世界书】\n" + worldbook.trim());

    const mode = role || session.mode;
    // 场景 + 大纲切片 + 进度（costudy 无大纲，改注入 running_summary）
    let peerName = "";
    if (session.mode === "nv1") {
      const others = (session.character_ids || []).filter(function (id) { return id !== char.id; });
      const oc = (ctx.characters || []).find(function (c) { return c.id === others[0]; });
      peerName = oc ? oc.name : "";
      // 同堂那位是个什么人（原来只给了名字：老师不知道这个同学是谁，同学也不知道老师是谁）
      if (oc) {
        const rel = ctx.relFor ? ctx.relFor(char.id, oc.id) : null;
        parts.push("【同堂的另一位 · " + oc.name + "】\n" + String(oc.persona || "（暂无设定）").slice(0, 1500)
          + (rel && (rel.mine || rel.theirs) ? "\n〔你俩的关系〕" + [rel.mine ? "你眼里 TA 是：" + rel.mine : "", rel.theirs ? "TA 眼里你是：" + rel.theirs : ""].filter(Boolean).join("；") : "\n〔你俩之前没有设定过关系：照不熟来，但不必生分〕"));
      }
    }
    parts.push(sceneFor(mode, session.subject, peerName));

    if (session.mode === "costudy") {
      const bt = boardText(session.progress && session.progress.board);
      if (bt) parts.push("【研究笔记板（你俩一起记的，接着它往下推）】\n" + bt);
      if (session.progress && session.progress.running_summary)
        parts.push("【到目前为止你俩研究到哪了（摘要）】\n" + session.progress.running_summary);
      const pending = session.progress && session.progress.summary_buffer;
      if (Array.isArray(pending) && pending.length) {
        parts.push("【尚未浓缩的较早研究片段（同样属于上下文，不能遗忘）】\n" + pending.map(function (m) {
          return (m.role === "user" ? (userName(profile) + "：") : ((m.name || char.name || "同伴") + "：")) + String(m.content || "");
        }).join("\n"));
      }
    } else {
      // 本节自带 outline+progress；再注入这门课的跨-session 记忆（curriculum 内互通）
      const outline = session.outline || null;
      const prog = session.progress || {};
      if (outline) {
        parts.push(outlineSlice(outline, prog.current_unit, session.subject));
        parts.push(progressText(outline.units, prog));
      }
      const mem = curriculumMemoryText(cur);
      if (mem) parts.push(mem);
      // 她传的资料：照这一节在讲什么、她刚问了什么，挑相关的几段
      const unit = outline && (outline.units || []).find(function (u) { return u.id === prog.current_unit; });
      const asked = (session.transcript || []).filter(function (m) { return m.role === "user"; }).slice(-2).map(function (m) { return m.content; }).join(" ");
      const mats = materialText(cur, [session.subject, unit && unit.title, unit && (unit.grammar || []).map(function (g) { return g.label; }).join(" "), asked].filter(Boolean).join(" "));
      if (mats) parts.push(mats);
      // 对话式推进：老师这轮把当前小节讲透、用户也跟上了，就在 JSON 里标 done 让进度条自己前进
      if (mode === "teach" || mode === "nv1-teacher") parts.push(STUDY_PROGRESS_FMT);
    }
    if (mode === "teach" || mode === "nv1-teacher") parts.push(QUIZ_CARD_FMT);
    if (mode === "costudy" && session.mode === "costudy") parts.push(BOARD_FMT);
    if (mode === "teach" || mode === "nv1-teacher" || (mode === "costudy" && session.mode === "costudy")) parts.push(HANDOUT_FMT);
    parts.push(OUT_FMT);
    return parts.join("\n\n");
  }

  // ---- 输出清洗（沿用主聊天：去名字前缀 + 越位探测截断）-----------------
  function stripName(s) { return String(s || "").replace(/^\s*[^\s:：]{1,14}[:：]\s*/, "").trim(); }
  // 正常学习对话不含「你：」「用户：」这类替他人代言标记；出现即判越位，从该处截断
  function guardOverspeak(s) {
    const t = String(s || "");
    const m = t.match(/(^|\n)\s*(你|用户|我)\s*[:：]/);
    return m ? t.slice(0, m.index).trim() : t;
  }
  function sayFallback(raw) {
    const txt = String(raw || "");
    const seg = (txt.match(/"say"\s*:\s*\[([\s\S]*?)(\]|$)/) || [])[1] || txt;
    let arr = (seg.match(/"((?:[^"\\]|\\.)*)"/g) || []).map(function (s) {
      return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, " ");
    }).map(stripName).filter(Boolean);
    if (!arr.length) {
      const t = stripName(txt.replace(/```(?:json)?/gi, "").replace(/["{}\[\]]/g, "").replace(/\bsay\b\s*:?/gi, "").trim());
      if (t) arr = [t];
    }
    return arr;
  }
  function parseSay(raw) {
    const d = extractJSON(raw) || {};
    // 明说不开口：{"say":[]} 就是一句话都没有，别让兜底从 JSON 骨架里抠出个 "say" 来
    if (Array.isArray(d.say) && !d.say.length) return [];
    let says = Array.isArray(d.say) ? d.say : (d.say ? [d.say] : []);
    says = says.map(stripName).map(guardOverspeak).filter(Boolean);
    if (!says.length) says = sayFallback(raw).map(guardOverspeak).filter(Boolean);
    return says;
  }

  function parseBoard(raw) {
    const d = extractJSON(raw) || {};
    const b = d.board;
    if (!b || typeof b !== "object") return null;
    const list = x => (Array.isArray(x) ? x : []).map(v => String(v || "").trim()).filter(Boolean).slice(0, 6).map(v => v.slice(0, 160));
    const out = { question: String(b.question || "").trim().slice(0, 200), guesses: list(b.guesses), confirmed: list(b.confirmed), open: list(b.open) };
    return (out.question || out.guesses.length || out.confirmed.length || out.open.length) ? out : null;
  }
  function boardText(b) {
    if (!b) return "";
    const sec = (t, a) => a && a.length ? t + "\n" + a.map(x => "· " + x).join("\n") : "";
    return [b.question ? "问题：" + b.question : "", sec("猜测（未验证）", b.guesses), sec("已确认", b.confirmed), sec("还没解决", b.open)].filter(Boolean).join("\n");
  }

  function parseHandout(raw) {
    const d = extractJSON(raw) || {}, x = d.handout;
    if (!x || typeof x !== "object") return null;
    const title = String(x.title || "").trim().slice(0, 40), focus = String(x.focus || "").trim().slice(0, 200);
    if (!title && !focus) return null;
    return { kind: ["讲义", "小抄", "练习"].indexOf(x.kind) > -1 ? x.kind : "讲义", title: title || focus.slice(0, 20), focus: focus };
  }
  // 各种 kind 怎么写：给的是【这种东西该长什么样】的判据，不是内容示范
  const HANDOUT_CRAFT = {
    讲义: "讲义＝她下次自己翻开也看得懂的笔记：从她现在卡在哪讲起，一块一块讲清楚，例子用这节课真讲过的或者跟她的资料对得上的。",
    小抄: "小抄＝一页能扫完的东西：只留她最该记住的那几条，每条一行，能对照就对照，不展开讲道理。",
    练习: "练习＝几道让她自己做的题，难度照她现在的进度和错题本来；答案和解析单独放在最后一节，别夹在题目中间。"
  };
  async function genHandout(active, session, char, ctx, role, spec) {
    const base = buildStudyPrompt(session, char, ctx, role)
      .replace(OUT_FMT, "").replace(QUIZ_CARD_FMT, "").replace(STUDY_PROGRESS_FMT, "").replace(BOARD_FMT, "").replace(HANDOUT_FMT, "");
    const conv = (session.transcript || []).filter(function (m) { return m && m.content && !m.hidden; }).slice(-30).map(function (m) {
      return (m.role === "user" ? userName(ctx.profile || {}) : (m.name || char.name)) + "：" + String(m.content).slice(0, 600);
    }).join("\n");
    const sys = base + "\n\n【刚才的课】\n" + conv +
      "\n\n【现在要写的】你刚说要给她一份" + spec.kind + "《" + spec.title + "》" + (spec.focus ? "：" + spec.focus : "") + "。" +
      "\n" + (HANDOUT_CRAFT[spec.kind] || HANDOUT_CRAFT.讲义) +
      "\n开头可以用你自己的口吻写一两句递给她的话；正文是给她看的资料，用简单的排版：大标题用 #，分节用 ##，列表用 -，重点用 **…**。" +
      "直接输出这份东西本身，不要 JSON，不要写成聊天气泡。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始。" }], { maxTokens: 65535 });
    const body = String(raw || "").replace(/^\s*```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
    if (!body) throw new Error("没写出东西来");
    return body;
  }
  function parseQuiz(raw) {
    const d = extractJSON(raw) || {};
    const q = d.quiz;
    if (!q || typeof q !== "object") return null;
    const type = ["choice", "true_false", "fill_blank"].includes(q.type) ? q.type : "";
    const prompt = String(q.prompt || "").trim();
    const pointId = String(q.point_id || q.pointId || "").trim();
    if (!type || !prompt || !pointId) return null;
    const options = type === "choice" && Array.isArray(q.options) ? q.options.slice(0, 5).map(function (o, i) {
      return { id: String(o && o.id || String.fromCharCode(65 + i)), label: String(o && o.label || "").trim() };
    }).filter(function (o) { return o.label; }) : [];
    if (type === "choice" && options.length < 2) return null;
    let answer = type === "true_false" ? String(q.answer).toLowerCase() : String(q.answer || "").trim();
    if (!answer || (type === "true_false" && !["true", "false"].includes(answer))) return null;
    if (type === "choice" && !options.some(function (o) { return o.id === answer; })) {
      // 模型常把 answer 写成选项文字而非选项 id；按归一化文字映射回 id，映射不到=坏题，宁可不出
      const hit = options.find(function (o) { return normalizeQuizAnswer(o.label) === normalizeQuizAnswer(answer); });
      if (!hit) return null;
      answer = hit.id;
    }
    const wordBankRaw = Array.isArray(q.word_bank) ? q.word_bank : (Array.isArray(q.wordBank) ? q.wordBank : []);
    const wordBank = type === "fill_blank" ? wordBankRaw.map(String).map(function (x) { return x.trim(); })
      .filter(Boolean).slice(0, 12) : [];
    return {
      type: type, prompt: prompt.slice(0, 600), pointId: pointId,
      options: options, answer: answer,
      aliases: Array.isArray(q.aliases) ? q.aliases.map(String).filter(Boolean).slice(0, 12) : [],
      wordBank: wordBank,
      hints: Array.isArray(q.hints) ? q.hints.map(String).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 3) : [],
      hintsUsed: 0,
      explanation: String(q.explanation || "").trim().slice(0, 500),
      attempts: [], status: "open"
    };
  }

// ⚠️为什么一律给足（她 2026-09-01 点名放开）：思考型模型的【思考预算是从 maxTokens 里扣的】。
// 给紧了，它想完就没配额写正文——要么直接空返回，要么写一半停在半句。
// 而她是按【次】计费、输出不另外收钱：省这几千 token 一分钱省不到，
// 换来的是一次空返回、再重来一次，反而多花一次调用。仓库铁律：≥8000（施工规则/max-tokens-floor.md），能写多少就给多少。
  const TOK = { turn: 12000, plan: 20000, quiz: 12000, small: 8000 };
  // ---- 一次生成 = 一个角色一个回合（§5）------------------------------
  // 返回 { says:[...], evidence:null|{} }——老师只能报告刚刚真实发生的作答证据，不能自行推进。
  async function genTurn(active, session, char, ctx, role) {
    const sys = buildStudyPrompt(session, char, ctx, role);
    const msgs = await withImages(toMessages(session.transcript, char.id, (ctx.profile && ctx.profile.name) || "用户"));
    const raw = await callAI(active, sys, msgs, { maxTokens: TOK.turn });
    const says = parseSay(raw);
    const d = extractJSON(raw) || {};
    const evidence = d.evidence && typeof d.evidence === "object" ? d.evidence : null;
    return { says: says, evidence: evidence, quiz: parseQuiz(raw), board: session.mode === "costudy" ? parseBoard(raw) : null, handout: role === "nv1-peer" ? null : parseHandout(raw) };
  }

  // 三人课堂一次写两个人（v73.15）：以老师那份完整的 prompt 为底（人设、长出来的自我、大纲、进度、题卡规则、
  //   同堂那位的人设与关系都已经在里面），再补同学自己的场景和长出来的自我，输出一串发言。
  //   题卡和学习证据只认老师：同学说的话代码上就进不了证据。
  function nv1JointTail(teacher, peer, teacherRole, peerCtx, focus, subject) {
    const peerScene = sceneFor(teacherRole === "nv1-teacher" ? "nv1-peer" : "costudy", subject, teacher.name);
    const peerSelf = typeof grownSelfBlock === "function" ? grownSelfBlock(peerCtx && peerCtx.grown, peerCtx && peerCtx.grownEvolve) : "";
    return "【这一轮你同时写两个人】上面的『你』是「" + teacher.name + "」；同堂的「" + peer.name + "」这一轮也由你来写。" +
      "「" + peer.name + "」这边的场景是：" + peerScene.replace(/你/g, "TA") +
      (peerSelf ? "\n〔" + peer.name + " 的〕" + peerSelf.replace(/^【你长出来的自我】/, "【TA长出来的自我】") : "") +
      "\n· 两个人各按各的卡说话；谁先谁后、各说几句，按此刻场面自然排——老师讲完同学接一句、同学答错老师纠正、两人顺着拌一句嘴都行。" +
      "\n· 不是每个人都得开口：没什么真想说的那位这一轮就不出现。" +
      (focus ? "\n· 用户这一轮是冲着「" + focus + "」来的，TA 先接；另一位要不要插话看场面。" : "") +
      "\n· 题卡（quiz）、学习证据（evidence）和递给她的东西（handout）只能是「" + teacher.name + "」出的；「" + peer.name + "」绝不出题、不判对错。" +
      "\n【输出格式】只输出一个 JSON 对象：{\"turns\":[{\"name\":\"" + teacher.name + "\",\"say\":[\"气泡\"]},{\"name\":\"" + peer.name + "\",\"say\":[\"气泡\"]}]}，" +
      "turns 按说话先后排，同一个人可以出现不止一次，每段 say 1~4 个气泡；需要时在同一对象加 quiz 或 evidence。不要名字前缀、不要旁白括号、不要 markdown。";
  }
  function parseTurns(raw, teacher, peer) {
    const d = extractJSON(raw) || {};
    const who = nm => { const n = String(nm || ""); return n && peer && n.indexOf(peer.name) >= 0 && n.indexOf(teacher.name) < 0 ? peer : teacher; };
    let turns = Array.isArray(d.turns) ? d.turns : [];
    if (!turns.length && d.say) turns = [{ name: teacher.name, say: d.say }];
    return turns.map(function (t) {
      const says = (Array.isArray(t && t.say) ? t.say : (t && t.say ? [t.say] : [])).map(stripName).map(guardOverspeak).filter(Boolean);
      return { char: who(t && t.name), says: says };
    }).filter(function (t) { return t.says.length; });
  }
  async function genNv1Turn(active, session, teacher, peer, teacherCtx, peerCtx, teacherRole, focus) {
    const sys = buildStudyPrompt(session, teacher, teacherCtx, teacherRole).replace(OUT_FMT, "")
      + "\n\n" + nv1JointTail(teacher, peer, teacherRole, peerCtx, focus, session.subject);
    const msgs = await withImages(toMessages(session.transcript, "__both__", (teacherCtx.profile && teacherCtx.profile.name) || "用户"));
    const raw = await callAI(active, sys, msgs, { maxTokens: TOK.turn });
    let turns = parseTurns(raw, teacher, peer);
    if (!turns.length) { const f = sayFallback(raw).map(guardOverspeak).filter(Boolean); if (f.length) turns = [{ char: teacher, says: f }]; }
    const d = extractJSON(raw) || {};
    return { turns: turns, evidence: d.evidence && typeof d.evidence === "object" ? d.evidence : null, quiz: parseQuiz(raw), handout: parseHandout(raw) };
  }

  function normalizeQuizAnswer(value) {
    return String(value == null ? "" : value).normalize("NFKC").trim().toLocaleLowerCase()
      .replace(/\s+/g, " ")
      .replace(/([\u3040-\u30ff\u3400-\u9fff])\s+(?=[\u3040-\u30ff\u3400-\u9fff])/g, "$1")
      .replace(/[。.!！?？]+$/g, "").trim();
  }

  async function gradeQuizAnswer(active, quiz, userAnswer) {
    const actual = normalizeQuizAnswer(userAnswer);
    const accepted = [quiz.answer].concat(quiz.aliases || []).map(normalizeQuizAnswer);
    if (accepted.includes(actual)) return { result: "correct", feedback: "答对了", local: true };
    if (quiz.type !== "fill_blank") return { result: "incorrect", feedback: "这次还不对，再想想", local: true };
    const sys = "你只负责复核一道填空题的答案是否语义等价。忽略大小写、无关标点和不影响含义的措辞差异，但不能把反义、关键数字错误或事实错误放过。" +
      "只输出 JSON：{\"result\":\"correct|partial|incorrect\",\"feedback\":\"一句具体反馈，不泄露额外隐私\"}。";
    const u = "题目：" + quiz.prompt + "\n标准答案：" + quiz.answer +
      ((quiz.aliases || []).length ? "\n可接受别名：" + quiz.aliases.join("；") : "") + "\n用户答案：" + String(userAnswer || "");
    try {
      const raw = await callAI(active, sys, [{ role: "user", content: u }], { maxTokens: TOK.small }); // 判一道填空对不对，短；但思考照样吃额度
      const d = extractJSON(raw) || {};
      const result = ["correct", "partial", "incorrect"].includes(d.result) ? d.result : "incorrect";
      return { result: result, feedback: String(d.feedback || (result === "correct" ? "意思对了" : "还需要再想想")).slice(0, 240), local: false };
    } catch (e) {
      return { result: "incorrect", feedback: "暂时没法复核这个表达，可以换一种写法再试", local: false, reviewFailed: true };
    }
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  // 艾宾浩斯那条曲线（她 2026-09-23：「想要内置艾宾浩斯曲线，提示哪些该复习了」）：
  // 答错／靠提示 → 当天 4 小时后再来一次；之后每独立答对一次往后挪一格，越记越牢、隔得越开，最后一格一个月。
  // 原来是 1／3／7／14 天就封顶——两周以后就再也不叫她了，而遗忘曲线在那之后还在往下掉。
  const REVIEW_DAYS = [1, 2, 4, 7, 15, 30];
  function quizMasteryLevel(quiz, result, support, confidence, priorEvidence) {
    const independent = result === "correct" && support === "none" && confidence !== "guess";
    if (independent) {
      const recognitionOnly = quiz && (quiz.type === "choice" || quiz.type === "true_false");
      if (!recognitionOnly) return quiz && quiz.isReview ? 3 : 2;
      // 选择/判断第一次答对只证明“认得出来”；不同题卡再次独立答对，或隔时复习答对，才升到基本掌握。
      const seenBefore = (priorEvidence || []).some(function (e) {
        return e && String(e.pointId || "") === String(quiz.pointId || "") && e.quizId &&
          e.result === "correct" && e.support === "none" && e.confidence !== "guess";
      });
      return quiz.isReview || seenBefore ? 2 : 1;
    }
    return result === "correct" || result === "partial" ? 1 : 0;
  }
  function updateCurriculumReview(curId, session, quiz, outcome) {
    if (!curId || !quiz || !quiz.pointId) return null;
    const all = loadCurricula();
    const idx = all.findIndex(function (c) { return c.id === curId; });
    if (idx < 0) return null;
    const cur = all[idx], mem = Object.assign({ summaries: [], review_items: [] }, cur.memory || {});
    const items = (mem.review_items || []).slice();
    const key = String(quiz.reviewKey || quiz.pointId);
    const oldIdx = items.findIndex(function (x) { return x.key === key; });
    const old = oldIdx >= 0 ? items[oldIdx] : null;
    const independent = outcome.result === "correct" && outcome.support === "none" && outcome.confidence !== "guess";
    let stage, nextReviewAt;
    if (independent) {
      const oldStage = old && Number.isFinite(Number(old.stage)) ? Number(old.stage) : -1;
      stage = quiz.isReview ? Math.min(REVIEW_DAYS.length - 1, Math.max(-1, oldStage) + 1) : Math.max(0, oldStage);
      nextReviewAt = outcome.ts + REVIEW_DAYS[stage] * DAY_MS;
    } else {
      stage = -1;
      nextReviewAt = outcome.ts + 4 * 60 * 60 * 1000;
    }
    // 错题本（她 2026-09-23：「搞个错题本，可以放在课程里随时回看，自行选择要不要移走，老师也能看得到」）。
    // ⚠️就长在这张复习卡上，不另开一本：题目、答案、解析、对错这张卡早就都记着，另开一本就是同一道题两份。
    // ⚠️进本：这一次没答对。出本：【只有她自己移】——后来做对了也不自动拿走，只在卡上标一句「最近一次答对了」，
    //   移不移由她定。移出去了又答错，就重新回到本子里。移出不碰复习时间表，那是另一件事。
    // v73.322 她：「提示才对的也加进来吧」——答错、或者靠提示才做对，都进本子。
    const wrongNow = outcome.result !== "correct";
    const hintedNow = !wrongNow && outcome.support && outcome.support !== "none";
    const bookNow = wrongNow || hintedNow;
    const wasIn = old ? inMistakeBook(old) : false;
    const item = {
      inBook: bookNow ? true : wasIn,
      bookedAt: bookNow && !wasIn ? outcome.ts : (old && old.bookedAt) || null,
      removedAt: bookNow ? null : (old && old.removedAt) || null,
      wrongCount: ((old && Number(old.wrongCount)) || 0) + (wrongNow ? 1 : 0),
      hintedCount: ((old && Number(old.hintedCount)) || 0) + (hintedNow ? 1 : 0),
      lastAnswer: outcome.answer != null ? String(outcome.answer).slice(0, 300) : ((old && old.lastAnswer) || ""),
      key: key, pointId: quiz.pointId, sourceSessionId: session.id,
      type: quiz.type, prompt: quiz.prompt, options: (quiz.options || []).slice(), answer: quiz.answer,
      aliases: (quiz.aliases || []).slice(), wordBank: (quiz.wordBank || []).slice(),
      hints: (quiz.hints || []).slice(), explanation: quiz.explanation || "",
      stage: stage, nextReviewAt: nextReviewAt, lastResult: outcome.result,
      lastConfidence: outcome.confidence, lastSupport: outcome.support, updatedAt: outcome.ts
    };
    if (oldIdx >= 0) items[oldIdx] = item; else items.push(item);
    mem.review_items = items.slice(-120);
    all[idx] = Object.assign({}, cur, { memory: mem, updated_at: Date.now() });
    saveCurricula(all);
    return item;
  }

  // 这张卡在不在错题本里。老卡没有 inBook 这一格：上一次没答对的就算在里头（本子一打开就有东西，不用从头攒）
  function inMistakeBook(x) {
    if (!x) return false;
    if (x.inBook === true) return true;
    if (x.inBook === false) return false;
    return (!!x.lastResult && x.lastResult !== "correct") || (!!x.lastSupport && x.lastSupport !== "none");
  }
  function mistakeBookItems(cur) {
    const items = cur && cur.memory && cur.memory.review_items;
    return (Array.isArray(items) ? items : []).filter(inMistakeBook)
      .sort(function (a, b) { return Number(b.bookedAt || b.updatedAt || 0) - Number(a.bookedAt || a.updatedAt || 0); });
  }
  // 到时间该复习的（艾宾浩斯那条线上到点了的），最早到期的排前面
  function dueReviewItems(cur, now) {
    const items = cur && cur.memory && cur.memory.review_items;
    const t = now || Date.now();
    return (Array.isArray(items) ? items : []).filter(function (x) { return x && Number(x.nextReviewAt) <= t; })
      .sort(function (a, b) { return Number(a.nextReviewAt) - Number(b.nextReviewAt); });
  }
  // 接下来几天各有几道要到期——让她看得见那条曲线往后怎么排
  function upcomingReviewDays(cur, now, days) {
    const items = (cur && cur.memory && cur.memory.review_items) || [];
    const t = now || Date.now(), out = [];
    const start = new Date(t); start.setHours(0, 0, 0, 0);
    for (let d = 1; d <= (days || 7); d++) {
      const a = start.getTime() + d * DAY_MS, b = a + DAY_MS;
      const n = items.filter(function (x) { return x && Number(x.nextReviewAt) > t && Number(x.nextReviewAt) >= a && Number(x.nextReviewAt) < b; }).length;
      if (n) out.push({ day: d, count: n });
    }
    return out;
  }
  // 一张卡在曲线上走到第几格（-1＝刚错过、还在当天重来；0..末格）
  function reviewStageText(x, now) {
    const st = Number.isFinite(Number(x && x.stage)) ? Number(x.stage) : -1;
    const next = Number(x && x.nextReviewAt) || 0, t = now || Date.now();
    const left = next - t;
    const when = left <= 0 ? "现在该复习了" : left < 3600000 ? Math.max(1, Math.round(left / 60000)) + " 分钟后复习"
      : left < DAY_MS ? Math.round(left / 3600000) + " 小时后复习" : Math.round(left / DAY_MS) + " 天后复习";
    return { filled: Math.max(0, st + 1), total: REVIEW_DAYS.length, when: when };
  }
  // 她自己把一道题移出错题本（只动本子，不动复习时间表）
  function removeFromMistakeBook(curId, key) {
    const all = loadCurricula();
    const idx = all.findIndex(function (c) { return c.id === curId; });
    if (idx < 0) return false;
    const cur = all[idx], mem = Object.assign({ summaries: [], review_items: [] }, cur.memory || {});
    mem.review_items = (mem.review_items || []).map(function (x) { return x && x.key === key ? Object.assign({}, x, { inBook: false, removedAt: Date.now() }) : x; });
    all[idx] = Object.assign({}, cur, { memory: mem, updated_at: Date.now() });
    saveCurricula(all);
    return true;
  }
  // 题卡上的答案读成人话：选择题存的是选项 id
  function quizAnswerText(x, v) {
    if (!x) return String(v || "");
    if (x.type === "choice") { const o = (x.options || []).find(function (o) { return o.id === v; }); return o ? o.id + ". " + o.label : String(v || ""); }
    if (x.type === "true_false") return v === "true" || v === true ? "正确" : (v === "false" || v === false ? "错误" : String(v || ""));
    return String(v || "");
  }

  function dueReviewCards(cur, now) {
    const items = cur && cur.memory && cur.memory.review_items;
    // 闪卡自己翻、自己点，不是课上的题卡（题卡界面也画不出它）
    return (Array.isArray(items) ? items : []).filter(function (x) { return x && x.type !== "flashcard" && Number(x.nextReviewAt) <= now; })
      .sort(function (a, b) { return Number(a.nextReviewAt) - Number(b.nextReviewAt); }).slice(0, 2).map(function (x) {
        return {
          type: x.type, prompt: x.prompt, pointId: x.pointId, options: (x.options || []).slice(), answer: x.answer,
          aliases: (x.aliases || []).slice(), wordBank: (x.wordBank || []).slice(), hints: (x.hints || []).slice(), hintsUsed: 0,
          explanation: x.explanation || "", attempts: [], status: "open", isReview: true, reviewKey: x.key
        };
      });
  }

  // ---- 闪卡（她 2026-09-23：「一摞 flashcard」）---------------------------------
  // 正面是要回想的那一面，翻过来是答案；她自己点 记得／模糊／不记得。
  // ⚠️不另开一条复习线：每张卡就是 review_items 里的一张复习卡（type:"flashcard"），
  //   艾宾浩斯那条曲线、错题本、老师看得见的那一份，全是现成的那一套。
  // ⚠️卡由这门课的老师照着【真的教过的要点】做：pointId 只许是大纲里有的，编出来的丢掉。
  const FLASH_CAP = 200;
  function curriculumPoints(cur, sessions) {
    const out = [], seen = new Set();
    (sessions || []).filter(function (s) { return s && s.curriculum_id === cur.id && s.outline; }).forEach(function (s) {
      (s.outline.units || []).forEach(function (u) {
        (u.grammar || []).forEach(function (g) {
          if (!g || !g.id || seen.has(g.id)) return;
          seen.add(g.id);
          out.push({ id: g.id, label: g.label || "", note: g.note || "", unit: u.title || "", vocab: (u.vocab || []).slice(0, 20) });
        });
      });
    });
    return out;
  }
  const FLASH_RATE = {
    good: { result: "correct", confidence: "sure", label: "记得" },
    fuzzy: { result: "partial", confidence: "unsure", label: "模糊" },
    miss: { result: "wrong", confidence: "sure", label: "不记得" }
  };
  function flashReviewKey(card) { return "fc_" + card.id; }
  function flashItemOf(cur, card) {
    const items = (cur && cur.memory && cur.memory.review_items) || [];
    return items.find(function (x) { return x && x.key === flashReviewKey(card); }) || null;
  }
  // 翻过来之后她点的那一下。第一次见＝学，之后每一次都算隔时复习（曲线往后挪）。
  function rateFlashcard(curId, card, rate) {
    const r = FLASH_RATE[rate];
    if (!r || !card) return null;
    const seen = !!flashItemOf(findCurriculum(curId), card);
    return updateCurriculumReview(curId, { id: "flashcards" }, {
      type: "flashcard", prompt: card.front, answer: card.back, explanation: card.aside || "",
      pointId: card.pointId, reviewKey: flashReviewKey(card), isReview: seen
    }, { result: r.result, support: "none", confidence: r.confidence, ts: Date.now(), answer: r.label });
  }
  // 这一轮先翻哪几张：到点了的在前，再是还没见过的；其余的等曲线叫它
  function flashQueue(cur, now) {
    const t = now || Date.now();
    const cards = (cur && cur.flashcards) || [];
    const due = [], fresh = [];
    cards.forEach(function (c) {
      const it = flashItemOf(cur, c);
      if (!it) fresh.push(c);
      else if (Number(it.nextReviewAt) <= t) due.push({ c: c, at: Number(it.nextReviewAt) });
    });
    return due.sort(function (a, b) { return a.at - b.at; }).map(function (x) { return x.c; }).concat(fresh);
  }
  function parseFlashcards(raw, points, taken) {
    const d = extractJSON(raw) || {};
    const ids = new Set(points.map(function (p) { return p.id; }));
    const have = new Set(taken || []);
    return (Array.isArray(d.cards) ? d.cards : []).map(function (c, i) {
      const front = String(c && c.front || "").trim().slice(0, 200), back = String(c && c.back || "").trim().slice(0, 400);
      const pid = String(c && c.pointId || "").trim();
      if (!front || !back || !ids.has(pid) || have.has(front)) return null;
      have.add(front);
      return { id: Date.now().toString(36) + "_" + i + "_" + Math.random().toString(36).slice(2, 6), pointId: pid, front: front, back: back,
        aside: String(c.aside || "").trim().slice(0, 160), createdAt: Date.now() };
    }).filter(Boolean);
  }
  // 让老师做一摞。料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  async function genFlashcards(active, cur, sessions, teacher, worldbook) {
    const points = curriculumPoints(cur, sessions);
    if (!points.length) throw new Error("这门课还没上过课，老师不知道该从哪儿做卡");
    const taken = (cur.flashcards || []).map(function (c) { return c.front; });
    const sys = CB() + "你是「" + (teacher && teacher.name || "老师") + "」，在教她『" + cur.subject + "』。" +
      "现在给她做一摞闪卡，让她自己翻着背：正面是要她回想的那一面，背面是答案。" +
      "\n【角色人设】\n" + (teacher && teacher.persona || "（暂无）") +
      (worldbook ? "\n【世界书】\n" + worldbook : "") +
      "\n\n【这门课真的教过的要点】（pointId 只能从这里挑）\n" + points.map(function (p) {
        return "· " + p.id + "｜" + p.label + (p.note ? "｜" + p.note : "") + (p.unit ? "｜小节：" + p.unit : "") + (p.vocab.length ? "｜词汇：" + p.vocab.join("、") : "");
      }).join("\n") +
      (curriculumMemoryText(cur) ? "\n\n" + curriculumMemoryText(cur) : "") +
      (materialText(cur, points.map(function (p) { return p.label + " " + p.note; }).join(" ")) ? "\n\n" + materialText(cur, points.map(function (p) { return p.label + " " + p.note; }).join(" ")) : "") +
      (taken.length ? "\n\n【已经有的卡，正面别重复】\n" + taken.slice(-60).map(function (t) { return "· " + t; }).join("\n") : "") +
      "\n\n做 8 到 12 张。一张只考一个能在脑子里答出来的东西——正面短到一眼看完，背面给得出对错的那个答案，不写成一段讲义。" +
      "她错题本里还留着的、她卡过的那些，优先做进去。" +
      "aside 是你在卡背面顺手写给她的一句，用你自己说话的样子；没什么想说的就留空。" +
      "\n只输出 JSON：{\"cards\":[{\"pointId\":\"要点 id\",\"front\":\"正面\",\"back\":\"背面答案\",\"aside\":\"你的一句或空\"}]}";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始。" }], { maxTokens: 65535 });
    const cards = parseFlashcards(raw, points, taken);
    if (!cards.length) throw new Error("没做出能用的卡。老师这回写的是：\n" + String(raw || "").slice(0, 320));
    return cards;
  }
  function addFlashcards(curId, cards) {
    const fresh = findCurriculum(curId);
    if (!fresh) return null;
    const next = Object.assign({}, fresh, { flashcards: (fresh.flashcards || []).concat(cards).slice(-FLASH_CAP), updated_at: Date.now() });
    saveCurriculum(next);
    return next;
  }
  // 删一张卡：卡和它那张复习卡一起走（不然错题本里留着一张再也翻不到的）
  function removeFlashcard(curId, cardId) {
    const all = loadCurricula();
    const idx = all.findIndex(function (c) { return c.id === curId; });
    if (idx < 0) return false;
    const cur = all[idx], mem = Object.assign({ summaries: [], review_items: [] }, cur.memory || {});
    mem.review_items = (mem.review_items || []).filter(function (x) { return !x || x.key !== "fc_" + cardId; });
    all[idx] = Object.assign({}, cur, { memory: mem, flashcards: (cur.flashcards || []).filter(function (c) { return c.id !== cardId; }), updated_at: Date.now() });
    saveCurricula(all);
    return true;
  }

  // ---- 课程资料（她 2026-09-24：「一起学要不要搞可以上传文件」）------------------------
  // 她传上来的课本、讲义、笔记。课身上只记【有哪几份】（名字、字数），正文放 IndexedDB 那张表里，
  // 跟一起读的书同一种存法（core.js 的 makeTextStore）。
  // ⚠️正文不整本往里塞：每次只挑跟这一节有关的几段，一门课的资料动辄几万字。
  const MAT_BUDGET = 6000, MAT_CHUNK = 700;
  let _matStore = null;
  function matStore() { if (!_matStore && typeof makeTextStore === "function") _matStore = makeTextStore("StudyDocsDB", "docs"); return _matStore; }
  const MAT_CACHE = {};   // id → 全文；读一次留着，拼提示词那一步是同步的
  async function loadMaterials(cur) {
    const st = matStore(), list = (cur && cur.materials) || [];
    if (!st) return;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (MAT_CACHE[m.id] == null) { try { MAT_CACHE[m.id] = String(await st.get(m.id) || ""); } catch (e) { MAT_CACHE[m.id] = ""; } }
    }
  }
  // 按空行切段，太长的段再按字数切，每段带着出处
  function materialChunks(name, text) {
    const out = [];
    String(text || "").split(/\n\s*\n/).forEach(function (para) {
      const p = para.trim();
      for (let i = 0; i < p.length; i += MAT_CHUNK) out.push({ name: name, text: p.slice(i, i + MAT_CHUNK) });
    });
    return out;
  }
  // 一段跟这一节有多相关：数问句里的词（两个字一组）在这段里出现了几个
  function chunkScore(text, grams) {
    let n = 0;
    grams.forEach(function (g) { if (text.indexOf(g) > -1) n++; });
    return n;
  }
  function queryGrams(query) {
    const q = String(query || "").toLowerCase().replace(/\s+/g, " ");
    const set = new Set();
    q.split(/[^\u4e00-\u9fa5a-z0-9\u3040-\u30ff]+/).forEach(function (w) {
      if (!w) return;
      if (/^[a-z0-9]+$/.test(w)) { if (w.length > 2) set.add(w); return; }
      for (let i = 0; i + 1 < w.length; i++) set.add(w.slice(i, i + 2));
    });
    return Array.from(set);
  }
  // 挑几段给模型。资料加起来不多就整份给；多了就挑最相关的，按原来的先后排回去（读着才顺）。
  function materialText(cur, query, budget) {
    const list = (cur && cur.materials) || [];
    if (!list.length) return "";
    const cap = budget || MAT_BUDGET;
    const chunks = [];
    list.forEach(function (m) { materialChunks(m.name, MAT_CACHE[m.id]).forEach(function (c) { chunks.push(c); }); });
    if (!chunks.length) return "";
    let picked;
    const total = chunks.reduce(function (n, c) { return n + c.text.length; }, 0);
    if (total <= cap) picked = chunks;
    else {
      const grams = queryGrams(query).map(function (g) { return g.toLowerCase(); });
      const ranked = chunks.map(function (c, i) { return { c: c, i: i, s: chunkScore(c.text.toLowerCase(), grams) }; })
        .sort(function (a, b) { return b.s - a.s || a.i - b.i; });
      let used = 0; picked = [];
      for (let k = 0; k < ranked.length && used < cap; k++) { picked.push(ranked[k]); used += ranked[k].c.text.length; }
      picked = picked.sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.c; });
    }
    let last = "";
    return "【她传上来的资料（" + (total <= cap ? "全部" : "挑了跟这节有关的几段") + "）】\n"
      + picked.map(function (c) { const head = c.name !== last ? "〔" + c.name + "〕\n" : ""; last = c.name; return head + c.text; }).join(total <= cap ? "\n\n" : "\n…\n")
      + "\n这是她正在学的那份东西：讲法、术语、例题尽量跟着它走；它没讲到的，你照自己会的补，顺口说一句这是资料外的。";
  }
  // 读她选的那个文件：txt/md 自己认编码，pdf 抽文字层
  async function readMaterialFile(f, onProg) {
    const isPdf = /\.pdf$/i.test(f.name) || (f.type && f.type.indexOf("pdf") >= 0);
    const isTxt = /\.(txt|md|markdown)$/i.test(f.name) || (f.type && f.type.indexOf("text") >= 0);
    if (!isPdf && !isTxt) throw new Error("现在能读 .txt、.md 和带文字层的 .pdf；拍的书页用课上的发图片");
    const text = isPdf ? await extractPdfText(f, onProg) : await readTextFileSmart(f);
    if (!String(text || "").trim()) throw new Error(isPdf ? "没读到文字——这份 PDF 可能是扫描图，拍的书页用课上的发图片" : "这个文件是空的");
    return { text: String(text), kind: isPdf ? "pdf" : "txt" };
  }
  async function addMaterial(curId, file, onProg) {
    const got = await readMaterialFile(file, onProg);
    return saveMaterialText(curId, String(file.name || "资料").replace(/\.(txt|md|markdown|pdf)$/i, ""), got.kind, got.text);
  }
  // 一份正文收进这门课的资料：她传的文件、老师递来的讲义都走这一处
  async function saveMaterialText(curId, name, kind, text) {
    const st = matStore();
    if (!st) throw new Error("这台设备存不了资料");
    const got = { kind: kind, text: String(text || "") };
    const id = "mat_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
    await st.put(id, got.text);
    MAT_CACHE[id] = got.text;
    const cur = findCurriculum(curId);
    if (!cur) { try { await st.del(id); } catch (e) {} throw new Error("找不到这门课"); }
    const meta = { id: id, name: String(name || "资料").slice(0, 60), kind: got.kind, chars: got.text.length, addedAt: Date.now() };
    saveCurriculum(Object.assign({}, cur, { materials: (cur.materials || []).concat([meta]), updated_at: Date.now() }));
    return meta;
  }
  async function removeMaterial(curId, id) {
    const cur = findCurriculum(curId);
    if (cur) saveCurriculum(Object.assign({}, cur, { materials: (cur.materials || []).filter(function (m) { return m.id !== id; }), updated_at: Date.now() }));
    delete MAT_CACHE[id];
    const st = matStore();
    if (st) { try { await st.del(id); } catch (e) {} }
  }

  // ---- 房间里收着哪几门课（她 2026-09-23：「给 A 开了三个一起学，只有 1、2 我想放进来」）----
  // 一门课住在哪间房，就是它身上那一戳 roomId（建课时戳的那一格，chat-rooms.js 也照它判写回）。
  // ⚠️不另存一张「房里有哪几门」的表：那就是同一件事两份，挪了一边另一边不知道。
  //   认真教/一教一学＝一门课（x_curricula）；一起研究没有课，一张研究纸就是一门（curriculum_id 为空的课页）。
  function studyCoursesOf(personId) {
    const pid = String(personId);
    const hasMe = function (x) { return String(x.teacher_id || "") === pid || (x.character_ids || []).map(String).indexOf(pid) > -1; };
    const room = function (x) { return String(x.roomId || "main"); };
    const curs = loadCurricula().filter(function (c) { return c && hasMe(c); }).map(function (c) {
      return { kind: "cur", id: c.id, title: c.subject || "未命名", mode: c.mode, roomId: room(c), updated: Number(c.updated_at || 0) };
    });
    const papers = loadSessions().filter(function (x) { return x && !x.curriculum_id && x.mode === "costudy" && hasMe(x); }).map(function (x) {
      return { kind: "paper", id: x.id, title: x.subject || x.title || "研究纸", mode: "costudy", roomId: room(x), updated: Number(x.updated_at || 0) };
    });
    return curs.concat(papers).sort(function (a, b) { return b.updated - a.updated; });
  }
  // 把一门课收进某间房／拿回主聊天。⚠️只挪【以后】：已经上过的课页留在当时那间房里——
  //   那几节是在那扇门里发生的，事后改戳，等于把「不带出门」那间房里的课翻出来给主线看。
  //   一起研究的一张纸本身就是一节，没有「以后」可分，整张挪。
  function setCourseRoom(kind, id, roomId) {
    const rid = roomId && roomId !== "main" ? String(roomId) : null;
    if (kind === "cur") {
      const cur = findCurriculum(id);
      if (!cur) return false;
      saveCurriculum(Object.assign({}, cur, { roomId: rid, updated_at: Date.now() }));
      return true;
    }
    const all = loadSessions(), i = all.findIndex(function (x) { return x && x.id === id; });
    if (i < 0) return false;
    all[i] = Object.assign({}, all[i], { roomId: rid });
    saveSessions(all);
    return true;
  }

  // ---- nv1 轮次导演（§8）：纯本地规则，不为“下一位是谁”额外烧一整次模型 ----
  // 角色真正说什么仍由各自的主池生成；这里只做不涉及声纹/人格的轮次路由。
  function directNv1(_active, session, teacher, peer, ctx) {
    // 只决定【这一轮以谁为主】，不决定谁闭嘴：两个人在同一次生成里一起写，
    //   谁接、接几句、同学插不插嘴，由那一次生成按场面排（她 2026-09-23：「为什么不是一棒两个人说」）。
    const transcript = tail((session && session.transcript) || [], 12);
    const last = transcript[transcript.length - 1] || {};
    const text = last.role === "user" ? String(last.content || "") : "";
    const teacherName = String((teacher && teacher.name) || "");
    const peerName = String((peer && peer.name) || "");
    const asksTeacher = teacherName && text.indexOf(teacherName) >= 0;
    const asksPeer = peerName && text.indexOf(peerName) >= 0;
    if (asksTeacher && !asksPeer) return { lead: "teacher", named: true };
    if (asksPeer && !asksTeacher) return { lead: "peer", named: true };
    if (/老师|讲(?:一下|讲)?|解释|教我|答案|怎么做|为什么|请问|求解/.test(text)) return { lead: "teacher", named: false };
    if (/同学|一起(?:想|讨论|试)|你觉得|怎么看|轮到你|搭档/.test(text)) return { lead: "peer", named: false };
    return { lead: peerTurnsFirst(transcript, teacher, peer) ? "peer" : "teacher", named: false };
  }
  function peerTurnsFirst(transcript, teacher, peer) {
    let teacherTurns = 0, peerTurns = 0;
    const teacherName = String((teacher && teacher.name) || ""), peerName = String((peer && peer.name) || "");
    transcript.forEach(function (m) {
      if (!m || m.role === "user") return;
      if (String(m.speakerId || m.charId || "") === String(teacher && teacher.id) || String(m.name || "") === teacherName) teacherTurns++;
      if (String(m.speakerId || m.charId || "") === String(peer && peer.id) || String(m.name || "") === peerName) peerTurns++;
    });
    return peerTurns < teacherTurns;
  }

  // ---- 能力档推定（§6）：从人设判断能否认真教该科目 --------------------
  async function inferAbility(active, char, subject, worldbook) {
    const sys = "根据角色的人设" + (worldbook ? "与世界书" : "") + "，判断 TA 能不能教一个初学者学『" + subject + "』。" +
      "【判据放宽】：只要 TA 的职业、专业、身份、特长或经历跟这门学问直接相关，就算能教（canTeach=true）——" +
      "例如程序员/工程师教编程，母语者或语言老师教该语言，某领域从业者、学者、爱好者教该领域，都算能教，不要求 TA 是顶尖专家。" +
      "只有当 TA 跟这门学问明显八竿子打不着、人设里完全没有相关线索时，才 canTeach=false。拿不准时倾向 true。" +
      "只输出 JSON：{\"canTeach\":true或false,\"level\":\"入门/进阶/精通/无\",\"posture\":\"若不会，一句话态度\"}";
    const u = "【要学的】" + subject + "\n【角色人设】" + (char.persona || "（空）") + (worldbook ? "\n【世界书】" + worldbook : "");
    try {
      const raw = await callAI(active, sys, [{ role: "user", content: u }], { maxTokens: TOK.small });
      const d = extractJSON(raw) || {};
      return { canTeach: !!d.canTeach, level: d.level || "", posture: d.posture || "" };
    } catch (e) { return { canTeach: false, level: "", posture: "" }; }
  }

  // ---- 起草【本节 session】的小大纲：承接这门课之前的进度，设计合适的下一步 --------
  // priorCtx = 往期 session 摘要 + 上次 outline 小节标题 + 上次进度，喂给模型做衔接。
  async function draftSessionOutline(active, goal, worldbook, level, priorCtx, focus) {
    const lv = (level || "").trim();
    const first = !priorCtx || !priorCtx.trim();
    const startBlock = first
      ? (lv ? "这是这门课的第一节。学习者不是零基础，现有水平：「" + lv + "」——从合适的起点切入，别从零讲起。"
            : "这是这门课的第一节，学习者零基础，从最开头切入。")
      : "这【不是】第一节。下面给了这门课之前几节学到哪、掌握了什么、卡在哪——请**接着往下设计这一节**：复习一两个薄弱点，然后推进到合适的下一步，别重复已学牢的、也别跳太远。";
    const focusBlock = (focus && focus.trim()) ? "学习者说这节想侧重：「" + focus.trim() + "」，尽量照顾。" : "";
    const sys = "你是课程设计师，正为『" + goal + "』这门课设计**其中一节课**（一次 session，约够聊一阵）的小大纲。" +
      startBlock + focusBlock +
      "把这一节拆成 2~5 个循序渐进的小节（不是整门课，就这一次）。每个小节含：稳定 id（英文小写下划线）、title、objectives(1~2条)、" +
      "grammar/要点数组[{id(英文小写),label(中文短标签),note(一句说明)}]、vocab(若适用,数组)、can_do(学完能做到,1~2条)。" +
      "level 填这一节的难度定位。只输出 JSON：{\"level\":\"…\",\"language\":\"中文\",\"units\":[...]}。不要 markdown。";
    const u = "课程目标：" + goal + (lv ? "\n我的基础：" + lv : "") + (priorCtx && priorCtx.trim() ? "\n\n【这门课之前的记录】\n" + priorCtx.trim() : "\n（这是第一节）");
    const raw = await callAI(active, sys, [{ role: "user", content: u }], { maxTokens: TOK.plan });
    const d = extractJSON(raw) || {};
    // 稳健：模型常漏 id，别因缺 id 把小节整个丢掉——按序补 id（单元 & 要点都补）
    let units = Array.isArray(d.units) ? d.units.filter(function (x) { return x && x.title; }) : [];
    const usedUnits = new Set(), usedPoints = new Set();
    function uniqueId(raw, fallback, used) {
      let base = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
      let id = base, n = 2;
      while (used.has(id)) { id = base + "_" + n; n++; }
      used.add(id);
      return id;
    }
    units = units.map(function (x, i) {
      const uid = uniqueId(x.id, "unit_" + (i + 1), usedUnits);
      let rawGrammar = Array.isArray(x.grammar) ? x.grammar.filter(function (g) { return g && g.label; }) : [];
      // 没有可追踪要点的单元永远无法出合法题卡或完成结课；至少补一个核心能力点。
      if (!rawGrammar.length) rawGrammar = [{ id: "core", label: (x.objectives && x.objectives[0]) || x.title, note: "本小节的核心能力" }];
      const grammar = rawGrammar.map(function (g, gi) {
        const raw = String(g.id || ("g" + (gi + 1))).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
        return Object.assign({}, g, { id: uniqueId(uid + "__" + (raw || ("g" + (gi + 1))), uid + "__g" + (gi + 1), usedPoints) });
      });
      return Object.assign({}, x, { id: uid, grammar: grammar });
    });
    if (!units.length) throw new Error("大纲起草失败，请重试");
    return { level: d.level || (lv || "入门"), language: d.language || "中文", units: units };
  }

  // ---- 结算一节课，浓缩成 1~2 句给课程记忆（下次开新 session 会读到）--------
  async function summarizeStudySession(active, session, ctx) {
    const userName = (ctx.profile && ctx.profile.name) || "用户";
    const conv = tail(session.transcript, 40).map(function (m) {
      return (m.role === "user" ? userName : (m.name || "老师")) + "：" + m.content;
    }).join("\n");
    if (!conv.trim()) return "";
    const outline = session.outline || {};
    const covered = (outline.units || []).map(function (u) { return u.title; }).join("、");
    const sys = "把这一节『" + session.subject + "』的学习，浓缩成 1~2 句给下次上课的备忘：这次讲/练了什么、" + userName + "掌握得怎样、哪里还卡着/下次该接着做什么。具体、可复用。只输出正文。";
    try {
      const progress = progressText(outline.units || [], session.progress || {});
      return (await callAI(active, sys, [{ role: "user", content: "【本节安排】" + covered + "\n" + progress + "\n【对话】\n" + conv }], { maxTokens: TOK.small })).trim();
    } catch (e) { return ""; }
  }

  async function summarizeCostudyContext(active, session, ctx) {
    const progress = session && session.progress || {};
    const buffered = Array.isArray(progress.summary_buffer) ? progress.summary_buffer : [];
    if (!buffered.length) return String(progress.running_summary || "");
    const userName = (ctx.profile && ctx.profile.name) || "用户";
    const old = String(progress.running_summary || "").trim();
    const fresh = buffered.map(function (m) {
      return (m.role === "user" ? userName : (m.name || "同伴")) + "：" + String(m.content || "");
    }).join("\n");
    const sys = "把一段共同研究记录合并进已有摘要。只保留可继续研究所需的信息：研究问题、已确认事实、仍只是推测的内容、证据或例子、未解决问题、下一步验证办法和重要术语。" +
      "不能把推测写成事实，不能发明来源，也不要写聊天气氛或空泛评价。输出 JSON：{\"summary\":\"不超过1600字的结构化研究摘要\"}。";
    const raw = await callAI(active, sys, [{ role: "user", content: (old ? "【已有摘要】\n" + old + "\n\n" : "") + "【需要并入的较早记录】\n" + fresh }], { maxTokens: TOK.small });
    const d = extractJSON(raw) || {};
    return String(d.summary || raw || old).trim().slice(0, 6400);
  }

  async function generateStudyNote(active, session, char, ctx) {
    const outline = session.outline || {};
    const progress = session.progress || {};
    const userName = (ctx.profile && ctx.profile.name) || "用户";
    const conv = tail(session.transcript, 36).map(function (m) {
      return (m.role === "user" ? userName : (m.name || "老师")) + "：" + m.content;
    }).join("\n");
    const sys = "你是「" + (char && char.name || "老师") + "」，刚教完『" + session.subject + "』这一节。" +
      "请按你的人设留一张简短、真诚的课后小纸条，但所有学习判断必须依据真实作答证据，不能因为你讲过就夸用户学会，也不要学校成绩单腔。" +
      "只输出 JSON：{\"achieved\":\"今天真正做到的一件事\",\"strength\":\"有证据的一个优点，没有就坦白写仍在起步\"," +
      "\"weak\":\"还没稳的具体点，没有则写下一步挑战\",\"next\":\"下次开场先做什么\",\"note\":\"你以角色口吻留的一两句小纸条\"}。";
    const u = "【角色人设】\n" + (char && char.persona || "（暂无）") + "\n\n" + progressText(outline.units || [], progress) +
      "\n\n【本节真实对话】\n" + conv;
    const raw = await callAI(active, sys, [{ role: "user", content: u }], { maxTokens: TOK.small });
    const d = extractJSON(raw) || {};
    return {
      achieved: String(d.achieved || "完成了这一节的学习与作答").slice(0, 180),
      strength: String(d.strength || "仍在积累证据").slice(0, 180),
      weak: String(d.weak || progress.notes || "下次再做一次独立回忆").slice(0, 180),
      next: String(d.next || "先复习今天的薄弱点").slice(0, 180),
      note: String(d.note || "今天先到这里，下次接着来。").slice(0, 240),
      authorId: char && char.id || null, authorName: char && char.name || "老师", ts: Date.now()
    };
  }

  // ---- checkpoint（§7）：手动触发，单独一次 JSON，对照 can_do 结算（读本节 outline）-------
  async function runCheckpoint(active, session, char, ctx) {
    const outline = session.outline;
    const units = outline && outline.units;
    if (!Array.isArray(units) || !units.length) throw new Error("本节没有大纲");
    const cp = session.progress || {};
    const unit = units.find(function (u) { return u.id === cp.current_unit; }) || units[0];
    const gram = (unit.grammar || []).map(function (g) { return g.id + "(" + g.label + ")"; }).join("、");
    const conv = tail(session.transcript, 30).map(function (m) {
      return (m.role === "user" ? (ctx.profile && ctx.userName(profile)) : m.name) + "：" + m.content;
    }).join("\n");
    const sys = "你在给一堂课的【结课小测】做证据式结算。当前单元「" + unit.title + "」，要点(用 id)：" + gram + "。" +
      "能做到清单：" + (unit.can_do || []).join("；") + "。" +
      "只依据最近一次标有【结课小测】的题目和它后面用户亲自给出的答案来判断，老师自己的讲解、用户说『懂了』都不能当证据。" +
      "mastery 的 key 必须是要点 id（不是中文标签），值 0~2：0答错、1需提示/部分正确、2独立答对；3只能留给未来隔时复习再次独立答对。" +
      "若没有看到小测后的真实用户答案，completed 必须 false。mistakes 只列本次暴露的薄弱点。" +
      "只输出扁平 JSON：{\"completed\":true或false,\"mastery\":{\"<id>\":0-2},\"mistakes\":[{\"point_id\":\"<id>\",\"note\":\"具体错因\"}],\"notes\":\"给下次的一句提醒\"}。";
    const raw = await callAI(active, sys, [{ role: "user", content: "【教学对话】\n" + conv }], { maxTokens: TOK.quiz });
    const d = extractJSON(raw) || {};
    return { completed: !!d.completed, mastery: d.mastery && typeof d.mastery === "object" ? d.mastery : {}, mistakes: Array.isArray(d.mistakes) ? d.mistakes : [], notes: d.notes || "" };
  }

  // ---- 暴露给 UI 层 --------------------------------------------------
  window.Study = {
    loadSessions: loadSessions, saveSessions: saveSessions,
    loadCurricula: loadCurricula, findCurriculum: findCurriculum, findCurriculumBySubject: findCurriculumBySubject,
    saveCurricula: saveCurricula, saveCurriculum: saveCurriculum, pushCurriculumSummary: pushCurriculumSummary,
    newProgress: newProgress, initSessionProgress: initSessionProgress, curriculumMemoryText: curriculumMemoryText,
    genTurn: genTurn, inferAbility: inferAbility, draftSessionOutline: draftSessionOutline,
    summarizeStudySession: summarizeStudySession, summarizeCostudyContext: summarizeCostudyContext,
    generateStudyNote: generateStudyNote, runCheckpoint: runCheckpoint, tail: tail,
    normalizeQuizAnswer: normalizeQuizAnswer, gradeQuizAnswer: gradeQuizAnswer, parseQuiz: parseQuiz,
    updateCurriculumReview: updateCurriculumReview, dueReviewCards: dueReviewCards, quizMasteryLevel: quizMasteryLevel,
    dueReviewItems: dueReviewItems, upcomingReviewDays: upcomingReviewDays, reviewStageText: reviewStageText, REVIEW_DAYS: REVIEW_DAYS,
    inMistakeBook: inMistakeBook, mistakeBookItems: mistakeBookItems, removeFromMistakeBook: removeFromMistakeBook, mistakeBookText: mistakeBookText, quizAnswerText: quizAnswerText,
    studyProgressRatio: studyProgressRatio, allowedQuizPointIds: allowedQuizPointIds,
    exitAnswerEntry: exitAnswerEntry, unitCompletionGate: unitCompletionGate, compactStudyTranscript: compactStudyTranscript,
    outlineSlice: outlineSlice, progressText: progressText,
    curriculumPoints: curriculumPoints, rateFlashcard: rateFlashcard, flashQueue: flashQueue, parseFlashcards: parseFlashcards,
    genFlashcards: genFlashcards, addFlashcards: addFlashcards, removeFlashcard: removeFlashcard,
    studyCoursesOf: studyCoursesOf, setCourseRoom: setCourseRoom,
    loadMaterials: loadMaterials, materialText: materialText, addMaterial: addMaterial, removeMaterial: removeMaterial,
    saveMaterialText: saveMaterialText, parseHandout: parseHandout, genHandout: genHandout
  };

  // ============================================================
  // UI
  // ============================================================
  function modeTag(mode) {
    return mode === "teach" ? "认真教" : mode === "costudy" ? "一起研究" : "一教一学";
  }
  function modeColor(mode) {
    return (STUDY_MODE_SKIN[mode] || STUDY_MODE_SKIN.teach).accent;
  }

  // v59.68：一起学是一册真的活页学习夹，不再是通用白卡列表。
  // 三种模式分别长成老师批注、共同研究纸和三人课堂页；所有内页共用纸色、孔位和格线。
  const STUDY_SKIN = {
    desk: "linear-gradient(155deg,#e5e9e1 0%,#dce2d8 100%)",
    paper: "#fbf8ef", paper2: "#f2eee1", ink: "#30352f", sub: "#646b62", fog: "#92978e",
    line: "rgba(64,74,62,.16)", red: "#ad6254", green: "#657c60", shadow: "rgba(43,52,41,.09)"
  };
  const STUDY_MODE_SKIN = {
    teach: { accent: "#657c60", soft: "#e5ebdf", label: "老师批注", code: "01" },
    costudy: { accent: "#78698e", soft: "#ebe5f0", label: "共同研究", code: "02" },
    nv1: { accent: "#5d7685", soft: "#e2eaed", label: "三人课堂", code: "03" }
  };
  function studyModeSkin(mode) { return STUDY_MODE_SKIN[mode] || STUDY_MODE_SKIN.teach; }
  // 顶栏走共用的 Head（施工规则/mobile-ui-layout.md §1）。v65.14 才换过来：
  // 手写那条身上一个 data-wk 挂点都没有，「一起学」这一页的主题 CSS 因此抓不到顶栏。
  // ⚠️「有中文标题就不发那行英文副题」那道闸不用在这儿再写一遍——Head 里就有同一道
  //   （判据同样是「这串字里有没有汉字」），各写一份迟早只改一处。
  // 桌面那张纸是这一页自己的底，所以底色和分隔线照旧从这儿传进去。
  function StudyHead(props) {
    const skin = studyModeSkin(props.mode);
    return h(Head, {
      zh: props.zh, en: props.en || skin.label,
      onBack: props.onBack,
      right: props.right || h(GStudy, { size: 18, color: skin.accent }),
      ink: STUDY_SKIN.ink, subInk: skin.accent, lineInk: STUDY_SKIN.line,
      bg: "rgba(251,248,239,.92)",
      barStyle: { backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }
    });
  }
  function StudyHoles() {
    return h("div", { "aria-hidden": "true", style: { position: "absolute", left: 8, top: 12, bottom: 12, display: "flex", flexDirection: "column", justifyContent: "space-around" } },
      [0, 1, 2].map(function (x) { return h("i", { key: x, style: { width: 5, height: 5, borderRadius: 99, background: "#dfe4dc", boxShadow: "inset 0 1px 2px rgba(38,46,36,.2)" } }); }));
  }
  function StudyFooter(props) {
    return h("div", { className: "shrink-0 px-5", style: { borderTop: "1px solid " + STUDY_SKIN.line, background: "rgba(251,248,239,.96)", paddingTop: 12, paddingBottom: COMPOSER_PAD_BOTTOM } }, props.children);
  }

  function timeShort(ts) {
    if (!ts) return "";
    try {
      const d = new Date(ts), now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      return sameDay ? d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
        : (d.getMonth() + 1) + "月" + d.getDate() + "日";
    } catch (e) { return ""; }
  }
  function avatarsFor(charIds, characters) {
    return (charIds || []).map(function (id) { return (characters || []).find(function (c) { return c.id === id; }); }).filter(Boolean);
  }

  // ---- 一级：某个模式下的课程列表（teach / nv1）----------------------
  function CurriculumList(props) {
    const skin = studyModeSkin(props.mode), accent = skin.accent;
    const curs = props.curricula;
    const sessCount = {};
    (props.sessions || []).forEach(function (s) { if (s.curriculum_id) sessCount[s.curriculum_id] = (sessCount[s.curriculum_id] || 0) + 1; });
    return h("div", { ref: props.scrollRef, className: "flex-1 min-h-0 overflow-y-auto px-4 pb-8" },
      h("button", { onClick: props.onNew, className: "w-full active:opacity-70 flex items-center justify-between",
        style: { minHeight: 50, margin: "4px 0 13px", padding: "0 15px 0 17px", fontFamily: F_BODY, fontSize: 14, background: skin.accent, color: STUDY_SKIN.paper, borderRadius: "5px 16px 5px 5px", boxShadow: "0 7px 18px " + skin.accent + "2b" } },
        h("span", null, "新建" + (props.mode === "nv1" ? "三人课程" : "一门课程")), h("span", { style: { fontFamily: F_DISPLAY, fontSize: 22 } }, "+")),
      curs.length === 0
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: STUDY_SKIN.fog, textAlign: "center", marginTop: 54, lineHeight: 1.9, whiteSpace: "pre-line" } },
            props.mode === "nv1" ? "还没有课程。\n新建一个大目标（如日语N4），挑会教的当老师、另一个陪学，进去开小节。" : "还没有课程。\n新建一个大目标（如日语N4），进去自己开无数节小课，每节接着上次走。")
        : curs.map(function (c) {
            const n = sessCount[c.id] || 0;
            const chars = avatarsFor(c.character_ids, props.characters);
            return h("button", { key: c.id, onClick: function () { return props.onOpen(c.id); },
              className: "w-full flex items-center gap-3 active:opacity-70",
              style: { position: "relative", overflow: "hidden", minHeight: 78, marginBottom: 10, padding: "13px 13px 13px 25px", background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "4px solid " + accent, borderRadius: "5px 17px 17px 5px", textAlign: "left", boxShadow: "0 7px 18px " + STUDY_SKIN.shadow } },
              h(StudyHoles),
              h("div", { className: "flex -space-x-2 shrink-0" }, chars.map(function (ch) { return h(Avatar, { key: ch.id, character: ch, size: 38, radius: 999 }); })),
              h("div", { className: "flex-1 min-w-0" },
                h("div", { className: "flex items-center gap-2" },
                  h("span", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 16, color: STUDY_SKIN.ink } }, c.subject),
                  c.level ? h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: accent, border: "1px solid " + accent, borderRadius: 4, padding: "0px 5px" } }, c.level) : null),
                h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.fog, marginTop: 5 } },
                  chars.map(function (ch) { return ch.name; }).join("、") + " · " + (n ? "已上 " + n + " 节 · " + timeShort(c.updated_at) : "还没开课")),
                  // 课程列表上就看得见哪门课有到点该复习的（不点进去也知道）
                  dueReviewItems(c).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.red, marginTop: 2 } }, dueReviewItems(c).length + " 道该复习了") : null),
              props.onDel && h("span", { onClick: function (e) { e.stopPropagation(); props.onDel(c.id); },
                style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog, padding: "12px 6px" } }, "移除"));
          }));
  }

  // ---- 一级（扁平）：一起研究的 session 列表 --------------------------
  function CostudyList(props) {
    const sessions = props.sessions;
    const skin = STUDY_MODE_SKIN.costudy;
    return h("div", { ref: props.scrollRef, className: "flex-1 min-h-0 overflow-y-auto px-4 pb-8" },
      h("button", { onClick: props.onNew, className: "w-full active:opacity-70 flex items-center justify-between",
        style: { minHeight: 50, margin: "4px 0 13px", padding: "0 15px 0 17px", fontFamily: F_BODY, fontSize: 14, background: skin.accent, color: STUDY_SKIN.paper, borderRadius: "16px 5px 16px 5px", boxShadow: "0 7px 18px " + skin.accent + "2b" } }, h("span", null, "铺一张新研究纸"), h("span", { style: { fontFamily: F_DISPLAY, fontSize: 22 } }, "+")),
      sessions.length === 0
        ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: STUDY_SKIN.fog, textAlign: "center", marginTop: 54, lineHeight: 1.9, whiteSpace: "pre-line" } },
            "还没有研究记录。\n挑个题目和一个角色，一起从头摸索。")
        : sessions.map(function (s) {
            const chars = avatarsFor(s.character_ids, props.characters);
            return h("button", { key: s.id, onClick: function () { return props.onOpen(s.id); },
              className: "w-full flex items-center gap-3 active:opacity-70",
              style: { position: "relative", minHeight: 76, marginBottom: 11, padding: "13px 13px 13px 16px", background: STUDY_SKIN.paper, border: "1px dashed " + skin.accent + "88", borderRadius: "16px 5px 16px 5px", textAlign: "left", boxShadow: "0 7px 18px " + STUDY_SKIN.shadow, transform: "rotate(" + ((Number(String(s.id).slice(-1)) || 0) % 2 ? .25 : -.25) + "deg)" } },
              h("div", { className: "flex -space-x-2 shrink-0" }, chars.map(function (ch) { return h(Avatar, { key: ch.id, character: ch, size: 38, radius: 999 }); })),
              h("div", { className: "flex-1 min-w-0" },
                h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: STUDY_SKIN.ink } }, s.subject),
                h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.fog, marginTop: 3 } },
                  chars.map(function (ch) { return ch.name; }).join("、") + " · " + timeShort(s.updated_at))),
              props.onDel && h("span", { onClick: function (e) { e.stopPropagation(); props.onDel(s.id); },
                style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog, padding: "12px 6px" } }, "移除"));
          }));
  }

  // ---- 二级：课程控制台（大目标 + 跨-session 记忆 + 历次 session + 开启新 session）----
  // ── 错题本（她 2026-09-23）：一整页，不是半窗 ──────────────────────────────
  // 每张：哪个要点、题目、她上次怎么答、正确答案、解析；可以当场重做，要不要移出去她自己定。
  // 重做答对了也不自动移走——只把那句「最近一次答对了」亮出来，移不移她说了算。
  function MistakeBook(props) {
    const cur = props.curriculum;
    const skin = studyModeSkin(cur.mode), accent = skin.accent;
    const [, bump] = useState(0);
    const [redo, setRedo] = useState(null);        // 正在重做的那张卡的 key
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const fresh = findCurriculum(cur.id) || cur;
    // 同一页两种用法：错题本（她留着的）／该复习了（艾宾浩斯那条线上到点的）——卡片、重做一模一样，只是挑哪几张不同
    const due = props.mode === "due";
    const items = due ? dueReviewItems(fresh) : mistakeBookItems(fresh);
    const upcoming = due ? upcomingReviewDays(fresh, Date.now(), 7) : [];
    // 要点 id → 中文名：从这门课各节的大纲里找
    const label = {};
    (props.sessions || []).forEach(function (s) { ((s.outline && s.outline.units) || []).forEach(function (u) { (u.grammar || []).forEach(function (g) { label[g.id] = g.label; }); }); });
    async function answer(x, v) {
      if (busy) return;
      const val = String(v == null ? "" : v).trim();
      if (!val) { props.toast && props.toast("先作答"); return; }
      setBusy(true);
      try {
        const quiz = { type: x.type, prompt: x.prompt, pointId: x.pointId, options: x.options || [], answer: x.answer, aliases: x.aliases || [], isReview: true, reviewKey: x.key };
        const g = await gradeQuizAnswer(props.bgActive || props.active, quiz, val);
        if (g.reviewFailed) { props.toast && props.toast("这次没判出来，什么都没改；稍后再试"); return; }
        updateCurriculumReview(cur.id, { id: "mistake-book" }, quiz, { result: g.result, support: "none", confidence: "sure", ts: Date.now(), answer: quizAnswerText(x, val) });
        setRedo(null); setDraft(""); bump(function (n) { return n + 1; });
        props.onRefresh && props.onRefresh();
        if (due) {
          const after = (findCurriculum(cur.id) || cur).memory.review_items.find(function (y) { return y.key === x.key; });
          props.toast && props.toast(g.result === "correct" ? "记住了，" + reviewStageText(after).when.replace("复习", "再见") : "还没对，4 小时后再来一次");
        } else props.toast && props.toast(g.result === "correct" ? "做对了——要不要移出错题本，你来定" : "还没对，这道先留着");
      } finally { setBusy(false); }
    }
    // 闪卡不判卷：她翻开自己点。复习卡上存着正反面，照原样拼回一张卡交给同一个出口
    function rateCard(x, r) {
      const id = String(x.key || "").replace(/^fc_/, "");
      rateFlashcard(cur.id, { id: id, front: x.prompt, back: x.answer, aside: x.explanation, pointId: x.pointId }, r);
      setRedo(null); bump(function (n) { return n + 1; });
      props.onRefresh && props.onRefresh();
      const after = (findCurriculum(cur.id) || cur).memory.review_items.find(function (y) { return y.key === x.key; });
      props.toast && props.toast(r === "good" ? "记住了，" + reviewStageText(after).when.replace("复习", "再见") : "几小时后再翻一次");
    }
    function drop(x) {
      requestAppConfirm("移出错题本？", "只是从本子里拿掉，复习时间照旧；老师会知道你觉得这道已经会了。", function () {
        removeFromMistakeBook(cur.id, x.key); bump(function (n) { return n + 1; }); props.onRefresh && props.onRefresh();
      }, "移出");
    }
    const card = { background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + STUDY_SKIN.red, borderRadius: "4px 12px 12px 4px", padding: "12px 14px 11px", marginBottom: 10, boxShadow: "0 4px 12px " + STUDY_SKIN.shadow };
    const small = { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog };
    const btn = function (on) { return { minHeight: 36, padding: "5px 13px", fontFamily: F_BODY, fontSize: 12.5, borderRadius: "4px 10px 4px 4px", border: "1px solid " + (on ? accent : STUDY_SKIN.line), background: on ? accent : "transparent", color: on ? STUDY_SKIN.paper : STUDY_SKIN.ink }; };
    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: due ? "该复习了" : "错题本", en: cur.subject, mode: cur.mode, onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("div", { style: Object.assign({}, small, { margin: "12px 2px 12px", lineHeight: 1.7 }) },
          due
            ? (items.length ? "按遗忘曲线排的：刚学的隔一天，记住一次往后挪一格——2 天、4 天、一周、半个月、一个月。答错或靠提示，当天 4 小时后再来一次。" : "现在没有到点的。")
            : (items.length ? "答错的、靠提示才做对的都会进来。重做答对了也不会自己消失——觉得真会了，自己移出去；老师看得到这本子。" : "本子是空的：这门课还没有答错过、也没有靠提示才做对的题。")),
        // 往后几天各有几道要到期：看得见那条曲线怎么排
        due && upcoming.length ? h("div", { style: Object.assign({}, small, { margin: "-4px 2px 12px" }) },
          "接下来：" + upcoming.map(function (u) { return (u.day === 1 ? "明天" : u.day === 2 ? "后天" : u.day + " 天后") + " " + u.count + " 道"; }).join(" · ")) : null,
        items.map(function (x) {
          const last = x.lastResult === "correct";
          const hinted = !!x.lastSupport && x.lastSupport !== "none";
          const stageInfo = reviewStageText(x);
          const open = redo === x.key;
          return h("div", { key: x.key, style: card },
            h("div", { className: "flex items-center", style: { gap: 6, flexWrap: "wrap" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: accent, border: "1px solid " + accent, borderRadius: 4, padding: "0 6px" } }, label[x.pointId] || "要点"),
              Number(x.wrongCount) > 1 ? h("span", { style: small }, "错过 " + x.wrongCount + " 次") : null,
              last && hinted ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#9a7745" } }, "靠提示才做对") : null,
              last && !hinted ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: "#4a7a4a" } }, "✓ 最近一次答对了") : null,
              // 艾宾浩斯那条线上走到第几格 + 下次什么时候
              h("span", { className: "flex items-center", style: { marginLeft: "auto", gap: 3 } },
                Array.from({ length: stageInfo.total }).map(function (_, k) {
                  return h("span", { key: k, style: { width: 6, height: 6, borderRadius: 999, background: k < stageInfo.filled ? accent : "transparent", border: "1px solid " + accent } });
                }),
                h("span", { style: Object.assign({}, small, { marginLeft: 4 }) }, stageInfo.when))),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: STUDY_SKIN.ink, lineHeight: 1.7, marginTop: 7, whiteSpace: "pre-wrap" } }, x.prompt),
            x.type === "choice" ? h("div", { style: { marginTop: 5 } }, (x.options || []).map(function (o) {
              return h("div", { key: o.id, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: o.id === x.answer ? "#4a7a4a" : STUDY_SKIN.ink } }, o.id + ". " + o.label + (o.id === x.answer ? "  ✓" : ""));
            })) : null,
            x.lastAnswer ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: last ? STUDY_SKIN.fog : STUDY_SKIN.red, marginTop: 7 } }, "你" + (last ? "最近一次" : "上次") + "答：" + x.lastAnswer) : null,
            // 闪卡在「该复习了」里先盖着答案——先想，翻开再看
            x.type === "flashcard" && due && !open ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#4a7a4a", marginTop: 3 } }, "答案：" + quizAnswerText(x, x.answer)),
            x.explanation ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.fog, lineHeight: 1.7, marginTop: 5 } }, x.explanation) : null,
            // 重做：选择/判断直接点，填空写一行
            open ? h("div", { style: { marginTop: 10, paddingTop: 10, borderTop: "1px dashed " + STUDY_SKIN.line } },
              x.type === "flashcard" ? h("div", { className: "flex", style: { gap: 6 } }, [["miss", "不记得"], ["fuzzy", "模糊"], ["good", "记得"]].map(function (o) {
                return h("button", { key: o[0], onClick: function () { rateCard(x, o[0]); }, className: "active:opacity-70", style: btn(o[0] === "good") }, o[1]);
              }))
              : x.type === "choice" ? h("div", { className: "flex flex-wrap", style: { gap: 6 } }, (x.options || []).map(function (o) {
                return h("button", { key: o.id, disabled: busy, onClick: function () { answer(x, o.id); }, className: "active:opacity-70", style: btn(false) }, o.id + ". " + o.label);
              }))
              : x.type === "true_false" ? h("div", { className: "flex", style: { gap: 6 } }, [["true", "正确"], ["false", "错误"]].map(function (o) {
                return h("button", { key: o[0], disabled: busy, onClick: function () { answer(x, o[0]); }, className: "active:opacity-70", style: btn(false) }, o[1]);
              }))
              : h("div", { className: "flex", style: { gap: 6 } },
                h("input", { value: draft, autoFocus: true, onChange: function (e) { setDraft(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") answer(x, draft); }, placeholder: "写你的答案",
                  style: { flex: 1, minWidth: 0, fontFamily: F_BODY, fontSize: 13.5, color: STUDY_SKIN.ink, background: "rgba(92,112,126,.06)", border: "1px solid " + STUDY_SKIN.line, borderRadius: 8, padding: "7px 10px", outline: "none" } }),
                h("button", { disabled: busy, onClick: function () { answer(x, draft); }, className: "active:opacity-70", style: btn(true) }, busy ? "判…" : "交")))
              : null,
            h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
              h("button", { onClick: function () { setRedo(open ? null : x.key); setDraft(""); }, className: "active:opacity-70", style: btn(!open) }, open ? "先不做了" : x.type === "flashcard" ? "翻开" : "重做"),
              due ? null : h("button", { onClick: function () { drop(x); }, className: "active:opacity-70", style: btn(false) }, "移出错题本")));
        })));
  }

  // 闪卡那一页：一次一张，点一下翻面，翻过来自己点 记得／模糊／不记得。
  function FlashDeck(props) {
    const cur = props.curriculum;
    const skin = studyModeSkin(cur.mode), accent = skin.accent;
    const [, bump] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [busy, setBusy] = useState(false);
    const [round, setRound] = useState(null);      // 这一轮要翻的卡 id；null＝按曲线挑
    const fresh = findCurriculum(cur.id) || cur;
    const all = fresh.flashcards || [];
    const queue = round ? round.map(function (id) { return all.find(function (c) { return c.id === id; }); }).filter(Boolean) : flashQueue(fresh);
    const card = queue[0] || null;
    const item = card ? flashItemOf(fresh, card) : null;
    const teacherId = cur.teacher_id || (cur.character_ids || [])[0];
    const teacher = (props.characters || []).find(function (c) { return c.id === teacherId; }) || null;
    async function make() {
      if (busy) return;
      if (!props.active && !props.bgActive) { props.toast && props.toast("请先到设置配置 API"); return; }
      setBusy(true);
      try {
        const wb = props.worldbookFor && teacherId ? props.worldbookFor(teacherId, cur.subject) : props.worldbook;
        await loadMaterials(fresh);
        const cards = await genFlashcards(props.bgActive || props.active, fresh, props.sessions, teacher, wb);
        addFlashcards(cur.id, cards);
        setRound(null); setFlipped(false); bump(function (n) { return n + 1; });
        props.onRefresh && props.onRefresh();
        props.toast && props.toast((teacher ? teacher.name : "老师") + "做了 " + cards.length + " 张");
      } catch (e) { props.toast && props.toast(String(e && e.message || "没做成，再试一次").split("\n")[0]); }
      finally { setBusy(false); }
    }
    function rate(r) {
      rateFlashcard(cur.id, card, r);
      if (round) setRound(round.filter(function (id) { return id !== card.id; }));
      setFlipped(false); bump(function (n) { return n + 1; });
      props.onRefresh && props.onRefresh();
    }
    function drop() {
      requestAppConfirm("删掉这张卡？", "它在复习表和错题本里的那一份也一起拿掉。", function () {
        removeFlashcard(cur.id, card.id);
        if (round) setRound(round.filter(function (id) { return id !== card.id; }));
        setFlipped(false); bump(function (n) { return n + 1; }); props.onRefresh && props.onRefresh();
      }, "删掉");
    }
    const small = { fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.fog, lineHeight: 1.7 };
    const btn = function (bg, ink) { return { flex: 1, minHeight: 46, fontFamily: F_BODY, fontSize: 14, borderRadius: "4px 12px 4px 4px", background: bg, color: ink, border: "1px solid " + STUDY_SKIN.line }; };
    const stage = item ? reviewStageText(item) : null;
    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: "闪卡", en: cur.subject, mode: cur.mode, onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("div", { style: Object.assign({}, small, { margin: "12px 2px 12px" }) },
          all.length ? "一共 " + all.length + " 张" + (round ? "，这一轮还剩 " + queue.length + " 张" : "，这会儿该翻的 " + queue.length + " 张") + "。记得的往后挪，模糊和不记得的几小时后再来，也会进错题本。"
            : "还没有卡。让" + (teacher ? teacher.name : "老师") + "照着上过的课做一摞。"),
        card ? h("button", { onClick: function () { setFlipped(!flipped); }, className: "w-full active:opacity-90",
          style: { display: "block", minHeight: 260, padding: "22px 20px", textAlign: "left", background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderTop: "4px solid " + (flipped ? STUDY_SKIN.red : accent), borderRadius: "6px 18px 18px 6px", boxShadow: "0 10px 24px " + STUDY_SKIN.shadow } },
          h("div", { className: "flex items-center", style: { gap: 6 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: flipped ? STUDY_SKIN.red : accent } }, flipped ? "背面" : "正面"),
            stage ? h("span", { style: Object.assign({}, small, { marginLeft: "auto", fontSize: 10.5 }) }, "曲线第 " + stage.filled + "/" + stage.total + " 格") : h("span", { style: Object.assign({}, small, { marginLeft: "auto", fontSize: 10.5 }) }, "第一次见")),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: flipped ? 17 : 21, lineHeight: 1.6, color: STUDY_SKIN.ink, marginTop: 16, whiteSpace: "pre-wrap" } }, flipped ? card.back : card.front),
          flipped && card.aside ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: STUDY_SKIN.fog, lineHeight: 1.7, marginTop: 14, paddingTop: 10, borderTop: "1px dashed " + STUDY_SKIN.line } }, (teacher ? teacher.name + "：" : "") + card.aside) : null,
          flipped ? null : h("div", { style: Object.assign({}, small, { marginTop: 22 }) }, "先在心里答，想好了点一下翻面"))
          : (all.length ? h("div", { style: { padding: "22px 16px", textAlign: "center", fontFamily: F_BODY, fontSize: 13, color: STUDY_SKIN.ink, lineHeight: 1.8, background: STUDY_SKIN.paper, border: "1px dashed " + STUDY_SKIN.line, borderRadius: 12 } },
              "这会儿没有该翻的了，等曲线叫你。",
              h("div", null, h("button", { onClick: function () { setRound(all.map(function (c) { return c.id; })); setFlipped(false); }, className: "active:opacity-70", style: { marginTop: 10, fontFamily: F_BODY, fontSize: 12.5, color: accent, padding: "6px 10px" } }, "全部再过一遍"))) : null),
        card && flipped ? h("div", { className: "flex", style: { gap: 8, marginTop: 14 } },
          h("button", { onClick: function () { rate("miss"); }, className: "active:opacity-70", style: btn(STUDY_SKIN.paper, STUDY_SKIN.red) }, "不记得"),
          h("button", { onClick: function () { rate("fuzzy"); }, className: "active:opacity-70", style: btn(STUDY_SKIN.paper, "#9a7745") }, "模糊"),
          h("button", { onClick: function () { rate("good"); }, className: "active:opacity-70", style: btn(accent, STUDY_SKIN.paper) }, "记得")) : null,
        card ? h("div", { className: "flex", style: { marginTop: 10 } },
          h("button", { onClick: drop, className: "active:opacity-70", style: Object.assign({}, small, { marginLeft: "auto", padding: "6px 4px" }) }, "删掉这张")) : null),
      h(StudyFooter, null,
        h("button", { onClick: make, disabled: busy, className: "w-full py-3 active:opacity-70",
          style: { minHeight: 46, fontFamily: F_BODY, fontSize: 15, background: busy ? STUDY_SKIN.fog : accent, color: STUDY_SKIN.paper, borderRadius: "5px 14px 5px 5px" } },
          busy ? (teacher ? teacher.name : "老师") + "在做卡…" : "让" + (teacher ? teacher.name : "老师") + "再做一摞")));
  }

  // 老师写的那份东西用的排版只有几样：# 标题、## 分节、- 列表、**重点**。只认这几样，别的原样显示。
  function mdInline(text, key) {
    return String(text).split(/(\*\*[^*]+\*\*)/).map(function (seg, i) {
      return /^\*\*[^*]+\*\*$/.test(seg) ? h("b", { key: key + "_" + i }, seg.slice(2, -2)) : seg;
    });
  }
  function mdBlocks(body, ink, accent) {
    return String(body || "").split("\n").map(function (line, i) {
      const t = line.trimEnd();
      if (!t.trim()) return h("div", { key: i, style: { height: 8 } });
      let m;
      if ((m = t.match(/^#\s+(.*)/))) return h("div", { key: i, style: { fontFamily: F_DISPLAY, fontSize: 21, color: ink, lineHeight: 1.35, margin: "6px 0 8px" } }, mdInline(m[1], i));
      if ((m = t.match(/^#{2,}\s+(.*)/))) return h("div", { key: i, style: { fontFamily: F_DISPLAY, fontSize: 16, color: accent, lineHeight: 1.4, margin: "12px 0 5px" } }, mdInline(m[1], i));
      if ((m = t.match(/^\s*(?:[-*•]|\d+[.、])\s+(.*)/))) {
        const num = t.match(/^\s*(\d+)[.、]/);
        return h("div", { key: i, className: "flex", style: { gap: 7, fontFamily: F_BODY, fontSize: 14, color: ink, lineHeight: 1.75 } },
          h("span", { style: { color: accent, flexShrink: 0 } }, num ? num[1] + "." : "·"), h("span", null, mdInline(m[1], i)));
      }
      return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 14, color: ink, lineHeight: 1.8, whiteSpace: "pre-wrap" } }, mdInline(t, i));
    });
  }
  // 老师递过来的那份东西，点开就是整页
  function HandoutPage(props) {
    const m = props.entry, ho = m.handout || {};
    const skin = studyModeSkin(props.mode), accent = skin.accent;
    const [busy, setBusy] = useState("");
    async function saveFile() {
      if (busy) return;
      setBusy("file");
      try {
        const via = await saveTextFile(String(ho.title || ho.kind || "讲义").replace(/[\\/:*?"<>|]/g, " ") + ".md", ho.body, "text/markdown");
        if (via !== "cancel") props.toast && props.toast("存好了");
      } catch (e) { props.toast && props.toast("没存成：" + ((e && e.message) || "再试一次")); }
      finally { setBusy(""); }
    }
    async function keep() {
      if (busy || !props.curId) return;
      setBusy("keep");
      try {
        await saveMaterialText(props.curId, ho.title || ho.kind, "handout", ho.body);
        props.onKept && props.onKept(m.id);
        props.toast && props.toast("收进这门课的资料了，以后上课老师也会翻");
      } catch (e) { props.toast && props.toast(String((e && e.message) || "没收成")); }
      finally { setBusy(""); }
    }
    const btn = function (on) { return { flex: 1, minHeight: 46, fontFamily: F_BODY, fontSize: 14.5, borderRadius: "5px 14px 5px 5px", background: on ? accent : STUDY_SKIN.paper, color: on ? STUDY_SKIN.paper : STUDY_SKIN.ink, border: "1px solid " + (on ? accent : STUDY_SKIN.line) }; };
    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: ho.kind || "讲义", en: m.name ? "来自 " + m.name : "", mode: props.mode, onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 py-4" },
        h("div", { style: { background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderTop: "4px solid " + accent, borderRadius: "6px 18px 18px 6px", padding: "18px 18px 22px", boxShadow: "0 10px 24px " + STUDY_SKIN.shadow } },
          mdBlocks(ho.body, STUDY_SKIN.ink, accent))),
      h(StudyFooter, null,
        h("div", { className: "flex", style: { gap: 8 } },
          h("button", { onClick: saveFile, disabled: !!busy, className: "active:opacity-70", style: btn(false) }, busy === "file" ? "存…" : "存成文件"),
          props.curId ? h("button", { onClick: keep, disabled: !!busy || ho.kept, className: "active:opacity-70", style: btn(!ho.kept) }, ho.kept ? "已收进资料" : busy === "keep" ? "收…" : "收进资料") : null)));
  }

  // 这门课的资料：她传上来的课本、讲义、笔记。老师讲课、起大纲、做闪卡都会翻它。
  function MaterialShelf(props) {
    const cur = props.curriculum;
    const skin = studyModeSkin(cur.mode), accent = skin.accent;
    const [, bump] = useState(0);
    const [busy, setBusy] = useState("");
    const [peek, setPeek] = useState("");
    const fileRef = useRef(null);
    const fresh = findCurriculum(cur.id) || cur;
    const list = (fresh.materials || []).slice().reverse();
    useEffect(function () { loadMaterials(fresh).then(function () { bump(function (n) { return n + 1; }); }); }, [cur.id]);
    async function onFile(e) {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f || busy) return;
      setBusy("读「" + f.name + "」…");
      try {
        const m = await addMaterial(cur.id, f, function (p, n) { setBusy("读 PDF " + p + "/" + n + " 页…"); });
        props.toast && props.toast("收好了，" + m.chars + " 字");
        props.onRefresh && props.onRefresh();
      } catch (err) { props.toast && props.toast(String(err && err.message || "没读成")); }
      finally { setBusy(""); bump(function (n) { return n + 1; }); }
    }
    function drop(m) {
      requestAppConfirm("删掉「" + m.name + "」？", "这份资料的正文会从这台设备上删掉；老师以后就看不到它了。", async function () {
        await removeMaterial(cur.id, m.id); bump(function (n) { return n + 1; }); props.onRefresh && props.onRefresh();
      }, "删掉");
    }
    const small = { fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.fog, lineHeight: 1.7 };
    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: "资料", en: cur.subject, mode: cur.mode, onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("div", { style: Object.assign({}, small, { margin: "12px 2px 12px" }) },
          list.length ? "老师讲课、起这节的大纲、做闪卡都会翻这些；每次挑跟这一节有关的几段看，不会整本塞进去。"
            : "把课本章节、讲义、自己的笔记传上来，老师就照着你真正要学的那份来教。能读 .txt、.md 和带文字层的 .pdf。"),
        list.map(function (m) {
          const open = peek === m.id, body = MAT_CACHE[m.id];
          return h("div", { key: m.id, style: { background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + accent, borderRadius: "4px 12px 12px 4px", padding: "11px 14px", marginBottom: 9, boxShadow: "0 4px 12px " + STUDY_SKIN.shadow } },
            h("button", { onClick: function () { setPeek(open ? "" : m.id); }, className: "w-full flex items-center active:opacity-70", style: { gap: 8, textAlign: "left", background: "transparent", border: "none", padding: 0 } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: accent, border: "1px solid " + accent, borderRadius: 4, padding: "0 5px", flexShrink: 0 } }, m.kind === "pdf" ? "PDF" : m.kind === "handout" ? "老师给的" : "文字"),
              h("span", { style: { flex: 1, minWidth: 0, fontFamily: F_DISPLAY, fontSize: 14.5, color: STUDY_SKIN.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, m.name),
              h("span", { style: Object.assign({}, small, { flexShrink: 0 }) }, m.chars + " 字 · " + timeShort(m.addedAt))),
            open ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: STUDY_SKIN.ink, lineHeight: 1.75, marginTop: 9, paddingTop: 9, borderTop: "1px dashed " + STUDY_SKIN.line, whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" } },
              body == null ? "读取中…" : (body.slice(0, 1200) + (body.length > 1200 ? "\n……" : ""))) : null,
            open ? h("div", { className: "flex", style: { marginTop: 8 } },
              h("button", { onClick: function () { drop(m); }, className: "active:opacity-70", style: Object.assign({}, small, { marginLeft: "auto", padding: "4px 2px", background: "transparent", border: "none" }) }, "删掉这份")) : null);
        })),
      h(StudyFooter, null,
        h("input", { ref: fileRef, type: "file", accept: ".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf", onChange: onFile, style: { display: "none" } }),
        h("button", { onClick: function () { if (!busy && fileRef.current) fileRef.current.click(); }, disabled: !!busy, className: "w-full py-3 active:opacity-70",
          style: { minHeight: 46, fontFamily: F_BODY, fontSize: 15, background: busy ? STUDY_SKIN.fog : accent, color: STUDY_SKIN.paper, borderRadius: "5px 14px 5px 5px" } }, busy || "传一份资料")));
  }

  function CurriculumConsole(props) {
    const cur = props.curriculum;
    const skin = studyModeSkin(cur.mode), accent = skin.accent;
    const summaries = (cur.memory && cur.memory.summaries) || [];
    const [bookOpen, setBookOpen] = useState(false);   // false | "book" | "due" | "flash" | "mats"
    const bookCount = mistakeBookItems(cur).length;
    const dueNow = dueReviewItems(cur).length;
    const flashTotal = (cur.flashcards || []).length, flashDue = flashTotal ? flashQueue(cur).length : 0;
    // 言秋的投递箱：打开控制台时取一次未认领投递（零 API；云不在就静默为空）
    const [drops, setDrops] = useState(null);
    useEffect(function () {
      let on = true;
      const c = window.Cloud;
      if (c && c.yanqiuStudyDropsTake) {
        c.yanqiuStudyDropsTake(cur.subject).then(
          function (list) { if (on) setDrops(list || []); },
          function () { if (on) setDrops([]); });
      } else setDrops([]);
      return function () { on = false; };
    }, [cur.id]);
    function dropParas(payload) {
      let src = payload;
      if (typeof src === "string") { try { src = JSON.parse(src); } catch (_) { src = { content: src }; } }
      if (!src || typeof src !== "object") return [];
      let paras = Array.isArray(src.paras) ? src.paras : null;
      if (!paras) {
        const body = src.content != null ? src.content : src.text;
        if (body != null) paras = String(body).split(/\n\s*\n|\n/);
      }
      return (paras || []).map(function (p) {
        return String(p && typeof p === "object" ? (p.text != null ? p.text : "") : p).trim();
      }).filter(Boolean);
    }
    function takeDrop(d) {
      const c = window.Cloud;
      if (c && c.yanqiuStudyDropAck) c.yanqiuStudyDropAck(d.id);
      const fresh = findCurriculum(cur.id) || cur;
      const mem = fresh.memory || {};
      const kept = (mem.yanqiuDrops || []).filter(function (x) { return x.id !== d.id; })
        .concat([{ id: d.id, kind: d.kind, title: d.title, paras: dropParas(d.payload), at: Date.now() }]);
      saveCurriculum({ ...fresh, memory: { ...mem, yanqiuDrops: kept } });
      setDrops((drops || []).filter(function (x) { return x.id !== d.id; }));
      props.onRefresh && props.onRefresh();
    }
    const keptDrops = ((cur.memory && cur.memory.yanqiuDrops) || []).slice().reverse();
    // 作业草稿按投递 id 存进 state：挂在对象临时字段上会在重渲染时丢掉，存出一张白卷（v72.11 血案）
    const [answerDrafts, setAnswerDrafts] = useState({});
    const dueCount = ((cur.memory && cur.memory.review_items) || []).filter(function (x) { return Number(x.nextReviewAt) <= Date.now(); }).length;
    const sess = (props.sessions || []).filter(function (s) { return s.curriculum_id === cur.id; })
      .sort(function (a, b) { return (b.updated_at || 0) - (a.updated_at || 0); });
    const chars = avatarsFor(cur.character_ids, props.characters);
    function sessLabel(s) {
      const u = s.outline && s.outline.units && s.outline.units[0];
      return u ? u.title + ((s.outline.units.length > 1) ? " 等 " + s.outline.units.length + " 小节" : "") : "自由练习";
    }
    if (bookOpen === "mats") return h(MaterialShelf, { curriculum: cur, toast: props.toast,
      onRefresh: props.onRefresh, onBack: function () { setBookOpen(false); props.onRefresh && props.onRefresh(); } });
    if (bookOpen === "flash") return h(FlashDeck, { curriculum: cur, sessions: props.sessions, characters: props.characters, active: props.active, bgActive: props.bgActive,
      worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast,
      onRefresh: props.onRefresh, onBack: function () { setBookOpen(false); props.onRefresh && props.onRefresh(); } });
    if (bookOpen) return h(MistakeBook, { mode: bookOpen, curriculum: cur, sessions: sess, active: props.active, bgActive: props.bgActive, toast: props.toast,
      onRefresh: props.onRefresh, onBack: function () { setBookOpen(false); props.onRefresh && props.onRefresh(); } });
    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: cur.subject, en: modeTag(cur.mode), mode: cur.mode, onBack: props.onBack }),
      h("div", { ref: props.scrollRef, className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("section", { style: { position: "relative", overflow: "hidden", marginTop: 11, padding: "18px 16px 16px 27px", borderRadius: "5px 20px 20px 5px", background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "5px solid " + accent, boxShadow: "0 10px 24px " + STUDY_SKIN.shadow } },
          h(StudyHoles),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".18em", color: accent } }, "这门课 · " + skin.code),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.25, color: STUDY_SKIN.ink, marginTop: 5 } }, cur.subject),
        h("div", { className: "flex items-center gap-2 flex-wrap", style: { marginTop: 9 } },
          cur.level ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: accent, border: "1px solid " + accent, borderRadius: 4, padding: "0px 6px" } }, cur.level) : null,
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.fog } }, chars.map(function (ch) { return ch.name; }).join("、") + " · 已上 " + sess.length + " 节" + (dueCount ? " · " + dueCount + " 个待复习" : "")))),
        // 言秋的投递箱（新到的备课，收下后存进课程自己的存档）
        (drops && drops.length) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: accent, margin: "19px 2px 8px" } }, "言秋的投递 · " + drops.length) : null,
        (drops && drops.length) ? drops.map(function (d) {
          const paras = dropParas(d.payload);
          return h("div", { key: d.id, className: "mb-2", style: { padding: "12px 14px", background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + STUDY_SKIN.red, borderRadius: "4px 12px 12px 4px", boxShadow: "0 4px 12px " + STUDY_SKIN.shadow } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: STUDY_SKIN.ink } }, d.title || "未署名投递"),
            paras.map(function (t, i) {
              return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12.5, color: STUDY_SKIN.ink, lineHeight: 1.75, marginTop: i === 0 ? 7 : 5, whiteSpace: "pre-wrap" } }, t);
            }),
            h("button", { onClick: function () { return takeDrop(d); }, className: "active:opacity-70", style: { marginTop: 10, fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.paper, background: accent, border: "none", borderRadius: "4px 10px 4px 4px", padding: "6px 14px" } }, "收进课程"));
        }) : null,
        keptDrops.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: accent, margin: "19px 2px 8px" } }, "已收的投递 " + keptDrops.length) : null,
        keptDrops.slice(0, 6).map(function (d) {
          return h("details", { key: d.id, className: "mb-2", style: { padding: "9px 14px", background: STUDY_SKIN.paper, border: "1px dashed " + STUDY_SKIN.line, borderRadius: 10 } },
            h("summary", { style: { fontFamily: F_BODY, fontSize: 12.5, color: STUDY_SKIN.ink, listStyle: "none" } }, "📮 " + (d.title || "投递") + " · " + timeShort(d.at) + (d.answer ? " · 已作答" : "")),
            (d.paras || []).map(function (t, i) {
              return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.ink, lineHeight: 1.7, marginTop: 6, whiteSpace: "pre-wrap" } }, t);
            }),
            // 作业纸：答案就写在投递卡上，不用开课页排大纲；存进课程存档随云走，言秋夜里来收
            h("textarea", { value: answerDrafts[d.id] != null ? answerDrafts[d.id] : (d.answer || ""), placeholder: "作业写这里，写完点存",
              onChange: function (e) { const v = e.target.value; setAnswerDrafts(function (m) { const n = { ...m }; n[d.id] = v; return n; }); },
              style: { width: "100%", minHeight: 72, marginTop: 9, padding: "8px 10px", fontFamily: F_BODY, fontSize: 12.5, color: STUDY_SKIN.ink, lineHeight: 1.7, background: "rgba(92,112,126,.06)", border: "1px solid " + STUDY_SKIN.line, borderRadius: 8, resize: "vertical" } }),
            h("button", { className: "active:opacity-70", onClick: function () {
                const fresh = findCurriculum(cur.id) || cur;
                const mem = fresh.memory || {};
                const next = (mem.yanqiuDrops || []).map(function (x) {
                  return x.id === d.id ? { ...x, answer: String(answerDrafts[d.id] != null ? answerDrafts[d.id] : (d.answer || "")), answeredAt: Date.now() } : x;
                });
                saveCurriculum({ ...fresh, memory: { ...mem, yanqiuDrops: next } });
                props.onRefresh && props.onRefresh();
                props.toast && props.toast("作业已存，言秋夜里来收");
              },
              style: { marginTop: 7, fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.paper, background: STUDY_SKIN.red, border: "none", borderRadius: "4px 10px 4px 4px", padding: "6px 14px" } }, "存作业"));
        }),
        // 该复习了（艾宾浩斯那条线上到点的）：有到点的才亮成强调色
        h("button", { onClick: function () { setBookOpen("due"); }, className: "w-full flex items-center active:opacity-70",
          style: { minHeight: 48, marginTop: 14, padding: "10px 14px", gap: 8, background: dueNow ? accent : STUDY_SKIN.paper, border: "1px solid " + (dueNow ? accent : STUDY_SKIN.line), borderRadius: "4px 12px 12px 4px", textAlign: "left" } },
          h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 14.5, color: dueNow ? STUDY_SKIN.paper : STUDY_SKIN.ink } }, "该复习了"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: dueNow ? STUDY_SKIN.paper : STUDY_SKIN.fog } }, dueNow ? dueNow + " 道到点了 ›" : "现在没有到点的 ›")),
        // 错题本入口（她 2026-09-23）：一整条，写着还剩几道
        h("button", { onClick: function () { setBookOpen("book"); }, className: "w-full flex items-center active:opacity-70",
          style: { minHeight: 48, marginTop: 8, padding: "10px 14px", gap: 8, background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + STUDY_SKIN.red, borderRadius: "4px 12px 12px 4px", textAlign: "left" } },
          h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 14.5, color: STUDY_SKIN.ink } }, "错题本"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: bookCount ? STUDY_SKIN.red : STUDY_SKIN.fog } }, bookCount ? "还有 " + bookCount + " 道 ›" : "空的 ›")),
        // 资料（她 2026-09-24）：她传上来的课本、讲义、笔记
        h("button", { onClick: function () { setBookOpen("mats"); }, className: "w-full flex items-center active:opacity-70",
          style: { minHeight: 48, marginTop: 8, padding: "10px 14px", gap: 8, background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + accent, borderRadius: "4px 12px 12px 4px", textAlign: "left" } },
          h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 14.5, color: STUDY_SKIN.ink } }, "资料"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.fog } }, (cur.materials || []).length ? (cur.materials || []).length + " 份 ›" : "还没传 ›")),
        // 闪卡（她 2026-09-23）：老师照着上过的课做一摞，自己翻着背
        h("button", { onClick: function () { setBookOpen("flash"); }, className: "w-full flex items-center active:opacity-70",
          style: { minHeight: 48, marginTop: 8, padding: "10px 14px", gap: 8, background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + accent, borderRadius: "4px 12px 12px 4px", textAlign: "left" } },
          h("span", { style: { flex: 1, fontFamily: F_DISPLAY, fontSize: 14.5, color: STUDY_SKIN.ink } }, "闪卡"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: flashDue ? accent : STUDY_SKIN.fog } }, flashTotal ? (flashDue ? flashDue + " 张该翻了 ›" : flashTotal + " 张 ›") : "还没有 ›")),
        // 跨-session 记忆（学到哪了）
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: accent, margin: "19px 2px 8px" } }, "学到哪了"),
        summaries.length === 0
          ? h("div", { style: { padding: "13px 14px", fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.fog, lineHeight: 1.7, background: STUDY_SKIN.paper, border: "1px dashed " + STUDY_SKIN.line, borderRadius: 10 } }, "还没有记录。开一节课，聊完它会自动记住进度，下一节接着走。")
          : h("div", { className: "mb-2", style: { padding: "10px 14px 11px", background: "repeating-linear-gradient(to bottom," + STUDY_SKIN.paper + " 0," + STUDY_SKIN.paper + " 27px,rgba(92,112,126,.12) 28px)", border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + STUDY_SKIN.red, borderRadius: "4px 12px 12px 4px" } },
              summaries.slice().reverse().slice(0, 8).map(function (sm, i) {
                return h("div", { key: sm.sessionId || i, style: { fontFamily: F_BODY, fontSize: 12.5, color: STUDY_SKIN.ink, lineHeight: "28px" } }, "· " + sm.text);
              })),
        // 历次 session
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: accent, margin: "19px 2px 8px" } }, "历次课 " + sess.length),
        sess.map(function (s) {
          const p = s.progress || {}, total = (s.outline && s.outline.units || []).length, done = (p.completed || []).length;
          return h("button", { key: s.id, onClick: function () { return props.onOpenSession(s.id); },
            className: "w-full flex items-center gap-3 py-2.5 px-3 mb-2 active:opacity-70",
            style: { minHeight: 58, background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + accent, borderRadius: "4px 12px 12px 4px", textAlign: "left", boxShadow: "0 4px 12px " + STUDY_SKIN.shadow } },
            h("div", { className: "flex-1 min-w-0" },
              h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 14, color: STUDY_SKIN.ink } }, sessLabel(s)),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog, marginTop: 2 } }, (total ? "进度 " + done + "/" + total + " · " : "") + (s.transcript || []).length + " 条 · " + timeShort(s.updated_at))),
            props.onDelSession ? h("span", { onClick: function (e) { e.stopPropagation(); props.onDelSession(s.id); },
              style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog, padding: "10px 5px" } }, "移除") : null);
        })),
      h(StudyFooter, null,
        h("button", { onClick: function () { return props.onNewSession(cur); }, className: "w-full py-3 active:opacity-70",
          style: { minHeight: 46, fontFamily: F_BODY, fontSize: 15, background: accent, color: STUDY_SKIN.paper, borderRadius: "5px 14px 5px 5px" } }, "开一张新课页 · 自动接上次进度")));
  }

  // ---- 新建课程 = 定个大目标容器（teach / nv1）：不预生成大纲，进控制台再开小节 ----
  function NewCurriculum(props) {
    const mode = props.mode; // 'teach' | 'nv1'
    const skin = studyModeSkin(mode);
    const want = mode === "nv1" ? 2 : 1;
    const [subject, setSubject] = useState(String(props.initialSubject || ""));
    const [level, setLevel] = useState("");
    const [picked, setPicked] = useState(props.initialCharacterId ? [String(props.initialCharacterId)] : []);
    const [busy, setBusy] = useState(false);
    const [confirmUnfit, setConfirmUnfit] = useState(null); // 认真教判定不够格时的弹窗 {ability, teacher}
    const field = { fontFamily: F_BODY, fontSize: 14, color: STUDY_SKIN.ink, background: "transparent", border: "none", borderBottom: "1px solid " + skin.accent, borderRadius: 0, padding: "10px 2px 8px", outline: "none", width: "100%" };

    function toggle(id) {
      setPicked(function (p) {
        if (p.includes(id)) return p.filter(function (x) { return x !== id; });
        if (p.length >= want) return want === 1 ? [id] : [p[1], id];
        return p.concat([id]);
      });
    }

    function createCur(teacherId) {
      const cur = {
        id: "cur_" + Date.now(), subject: subject.trim(), level: level.trim(), mode: mode,
        character_ids: picked.slice(), teacher_id: teacherId, memory: { summaries: [], review_items: [] },
        // 从哪间房里被邀请出来的。房间的写回边界要认这一戳，
        // 否则「不带出门」那间房里上的课会从主线的TA嘴里说出来（chat-rooms.js studySessionsFor）。
        roomId: String(props.initialRoomId || "") || null,
        created_at: Date.now(), updated_at: Date.now()
      };
      saveCurriculum(cur);
      props.onCreated(cur); // 上层落到控制台，让用户自己开第一节
    }

    async function begin() {
      if (!subject.trim()) { props.toast("先填个大目标"); return; }
      if (picked.length < want) { props.toast(want === 2 ? "挑 2 个角色" : "挑 1 个角色"); return; }
      try {
        const chars = picked.map(function (id) { return props.characters.find(function (c) { return c.id === id; }); });
        if (mode === "nv1") {
          if (!props.active) { props.toast("请先到设置配置 API"); return; }
          setBusy(true);
          const abil = [];
          for (let i = 0; i < chars.length; i++) {
            const lore = props.worldbookFor ? props.worldbookFor(chars[i].id, subject.trim()) : props.worldbook;
            abil.push(await inferAbility(props.active, chars[i], subject.trim(), lore));
          }
          const idx = abil.findIndex(function (a) { return a.canTeach; });
          setBusy(false);
          if (idx < 0) { props.toast("这俩谁都不太教得了「" + subject.trim() + "」——换个会的角色，或去『一起研究』一起摸索"); return; }
          createCur(chars[idx].id);
          return;
        }
        // 认真教：先判定 TA 会不会（仅在配了 API 时判）。不够格→弹窗让用户定夺，防系统误判；判定失败/无 API 直接放行
        const teacher = chars[0];
        if (props.active) {
          setBusy(true);
          let ab;
          try { ab = await inferAbility(props.active, teacher, subject.trim(), props.worldbookFor ? props.worldbookFor(teacher.id, subject.trim()) : props.worldbook); }
          catch (e) { ab = { canTeach: true }; }
          setBusy(false);
          if (ab && !ab.canTeach) { setConfirmUnfit({ ability: ab, teacher: teacher }); return; }
        }
        createCur(teacher.id);
      } catch (e) { props.toast("出错了：" + (e.message || "重试")); setBusy(false); }
    }

    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: mode === "nv1" ? "新建三人课程" : "新建认真教课程", mode: mode, onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("section", { style: { position: "relative", marginTop: 11, padding: "18px 16px 18px 27px", background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "4px solid " + skin.accent, borderRadius: "5px 18px 18px 5px", boxShadow: "0 10px 24px " + STUDY_SKIN.shadow } }, h(StudyHoles),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: skin.accent, marginBottom: 8 } }, "大目标"),
        h("input", { value: subject, onChange: function (e) { return setSubject(e.target.value); }, placeholder: "例：日语 N4 / 吉他弹唱 / 微积分…", style: field }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog, marginTop: 7, lineHeight: 1.65 } }, "这是一门课的大方向。建好后可以开很多张小课页，每次都接着上次。"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: skin.accent, margin: "20px 0 5px" } }, "我的基础（可选）"),
        h("input", { value: level, onChange: function (e) { return setLevel(e.target.value); }, placeholder: "不填=零基础。如：已过 N5 想冲 N4 / 会弹几个和弦", style: field }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: skin.accent, margin: "21px 0 8px" } }, mode === "nv1" ? "老师 + 同学（选 2 个）" : "找谁教（选 1 个）"),
        h("div", { className: "flex flex-col gap-2" }, (props.characters || []).map(function (c) {
          const on = picked.includes(c.id);
          return h("button", { key: c.id, onClick: function () { return toggle(c.id); }, className: "flex items-center gap-3 p-2 active:opacity-70",
            style: { minHeight: 58, background: on ? skin.soft : STUDY_SKIN.paper2, border: "1px solid " + (on ? skin.accent : STUDY_SKIN.line), borderLeft: "3px solid " + (on ? skin.accent : "transparent"), borderRadius: "4px 12px 12px 4px", textAlign: "left", transform: on ? "translateX(3px)" : "none" } },
            h(Avatar, { character: c, size: 40, radius: 999 }),
            h("span", { className: "flex-1", style: { fontFamily: F_DISPLAY, fontSize: 15, color: STUDY_SKIN.ink } }, c.name),
            on ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: skin.accent } }, mode === "nv1" ? (picked.indexOf(c.id) === 0 ? "座位 1" : "座位 2") : "老师位") : null);
        })),
        mode === "nv1" ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog, marginTop: 10, lineHeight: 1.7 } }, "会自动判断两位谁更适合站讲台，另一位坐同学位。") : null)),
      h(StudyFooter, null,
        h("button", { onClick: begin, disabled: busy, className: "w-full py-3", style: { minHeight: 46, fontFamily: F_BODY, fontSize: 15, background: skin.accent, color: STUDY_SKIN.paper, borderRadius: "5px 14px 5px 5px", opacity: busy ? 0.6 : 1 } },
          busy ? "判定角色能力中…" : "建课程")),
      confirmUnfit ? h("div", { className: "fixed inset-0 z-50 flex items-center justify-center", style: { background: "rgba(20,19,15,0.55)" }, onClick: function () { setConfirmUnfit(null); } },
        h("div", { onClick: function (e) { e.stopPropagation(); }, style: { width: "84%", maxWidth: 340, background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderTop: "5px solid " + skin.accent, borderRadius: "5px 18px 18px 5px", padding: "20px 20px 16px", boxShadow: "0 20px 50px rgba(25,30,24,.24)" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: skin.accent, marginBottom: 7 } }, "能力判定"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: STUDY_SKIN.ink, marginBottom: 8 } }, confirmUnfit.teacher.name + " 可能教不了这个"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: STUDY_SKIN.sub, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-line" } },
            "系统判定 " + confirmUnfit.teacher.name + " 的人设跟『" + subject.trim() + "』不太搭" + (confirmUnfit.ability.posture ? "——" + confirmUnfit.ability.posture : "。") + "\n可能是误判。你可以坚持让 TA 认真教，或改成不设老师的「一起研究」，你俩一起摸索。"),
          h("button", { onClick: function () { var tch = confirmUnfit.teacher; setConfirmUnfit(null); createCur(tch.id); }, className: "w-full py-2.5 mb-2 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, background: skin.accent, color: STUDY_SKIN.paper, borderRadius: "5px 12px 5px 5px" } }, "坚持让 TA 认真教"),
          h("button", { onClick: function () { var tch = confirmUnfit.teacher; setConfirmUnfit(null); props.onCostudyInstead && props.onCostudyInstead(subject.trim(), tch.id); }, className: "w-full py-2.5 mb-2 active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14, background: STUDY_MODE_SKIN.costudy.accent, color: STUDY_SKIN.paper, borderRadius: "12px 5px 12px 5px" } }, "改为「一起研究」"),
          h("button", { onClick: function () { setConfirmUnfit(null); }, className: "w-full py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, color: STUDY_SKIN.fog } }, "取消"))) : null);
  }

  // ---- 开一节课：为本节生成小大纲（承接往期 session 摘要+进度）→ 审核 → 落地 ----
  function NewSession(props) {
    const cur = props.curriculum;
    const skin = studyModeSkin(cur.mode);
    const [focus, setFocus] = useState("");
    const [busy, setBusy] = useState("");   // '' | 'sum' | 'draft'
    const [draft, setDraft] = useState(null);
    const field = { fontFamily: F_BODY, fontSize: 14, color: STUDY_SKIN.ink, background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + skin.accent, borderRadius: "4px 12px 12px 4px", padding: "12px 13px", outline: "none", width: "100%" };

    // 惰性总结：开新节前，把这门课里"有内容但还没最新摘要"的旧 session 各总结一句，落进课程记忆
    async function summarizePriors() {
      // 懒总结：开一节课最多补最近一份陈旧会话。其余留到下次打开再补，
      // 避免一次进入页面就循环发 N 次主池调用；课程连续性只需要最近一节优先。
      const list = loadSessions().filter(function (s) { return s.curriculum_id === cur.id && s.mode !== "costudy"; })
        .sort(function (a, b) { return Number(b.updated_at || 0) - Number(a.updated_at || 0); });
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const hasContent = (s.transcript || []).filter(function (m) { return m.role !== "system"; }).length >= 2;
        const stale = !s.summary || (s.summaryTs || 0) < (s.updated_at || 0);
        if (!hasContent || !stale) continue;
        const text = await summarizeStudySession(props.active, s, { profile: props.profile });
        if (text) {
          const all = loadSessions().map(function (x) { return x.id === s.id ? Object.assign({}, x, { summary: text, summaryTs: Date.now() }) : x; });
          saveSessions(all);
          pushCurriculumSummary(cur.id, s.id, text);
        }
        break;
      }
    }

    function buildPriorCtx() {
      const fresh = findCurriculum(cur.id) || cur;
      const sums = ((fresh.memory && fresh.memory.summaries) || []).slice(-8).map(function (sm) { return "· " + sm.text; });
      const prior = loadSessions().filter(function (s) { return s.curriculum_id === cur.id && s.outline; })
        .sort(function (a, b) { return (b.updated_at || 0) - (a.updated_at || 0); });
      const last = prior[0];
      const lines = sums.slice();
      if (last && last.outline) {
        lines.push("上一节安排的小节：" + (last.outline.units || []).map(function (u) { return u.title; }).join("、"));
        const lp = last.progress || {};
        const done = (lp.completed || []).length, tot = (last.outline.units || []).length;
        lines.push("上一节完成到 " + done + "/" + tot + " 小节" + (lp.notes ? "；上次提醒：" + lp.notes : ""));
      }
      return lines.join("\n");
    }

    async function generate() {
      if (!props.active) { props.toast("请先到设置配置 API"); return; }
      try {
        setBusy("sum");
        await summarizePriors();
        setBusy("draft");
        const fresh = findCurriculum(cur.id) || cur;
        await loadMaterials(fresh);
        const mats = materialText(fresh, [cur.subject, focus.trim(), buildPriorCtx()].join(" "));
        const priorCtx = [buildPriorCtx(), mats].filter(Boolean).join("\n\n");
        const teacherId = cur.teacher_id || (cur.character_ids || [])[0];
        const loreText = [cur.subject, focus.trim(), priorCtx].filter(Boolean).join("\n");
        const worldbook = props.worldbookFor && teacherId ? props.worldbookFor(teacherId, loreText) : props.worldbook;
        const outline = await draftSessionOutline(props.active, cur.subject, worldbook, cur.level, priorCtx, focus.trim());
        setDraft(outline); setBusy("");
      } catch (e) { props.toast("出错了：" + (e.message || "重试")); setBusy(""); }
    }

    function confirm(outline) {
      const chars = avatarsFor(cur.character_ids, props.characters);
      const progress = initSessionProgress(outline);
      progress.warmup_queue = dueReviewCards(findCurriculum(cur.id) || cur, Date.now());
      const sess = {
        id: "st_" + Date.now(), curriculum_id: cur.id, mode: cur.mode,
        character_ids: (cur.character_ids || []).slice(), teacher_id: cur.teacher_id || null,
        subject: cur.subject, title: cur.subject + " · " + chars.map(function (c) { return c.name; }).join("&"),
        roomId: cur.roomId || null,
        outline: outline, progress: progress,
        created_at: Date.now(), updated_at: Date.now(), transcript: []
      };
      saveSessions(loadSessions().concat([sess]));
      props.onCreated(sess);
    }

    if (draft) {
      return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
        h(StudyHead, { zh: "本节大纲", en: cur.subject, mode: cur.mode, onBack: function () { setDraft(null); } }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
          h("div", { style: { margin: "11px 2px 12px", fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.fog, lineHeight: 1.7 } },
            "这是为这一节课起的小大纲（已参考之前几节的进度）。确认后就按它上课；不满意可重来。"),
          (draft.units || []).map(function (u, i) {
            return h("div", { key: u.id, className: "mb-3", style: { position: "relative", padding: "14px 14px 14px 49px", background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderRadius: "5px 14px 14px 5px", boxShadow: "0 6px 16px " + STUDY_SKIN.shadow } },
              h("span", { style: { position: "absolute", left: 12, top: 12, width: 25, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: skin.soft, borderBottom: "3px solid " + skin.accent, fontFamily: F_DISPLAY, fontSize: 15, color: skin.accent } }, String(i + 1).padStart(2, "0")),
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: STUDY_SKIN.ink } }, u.title),
              (u.objectives || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.sub, marginTop: 5, lineHeight: 1.7 } }, "目标：" + u.objectives.join("；")) : null,
              (u.grammar || []).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.fog, marginTop: 3, lineHeight: 1.7 } }, "要点：" + u.grammar.map(function (g) { return g.label; }).join("、")) : null);
          })),
        h(StudyFooter, null, h("div", { className: "flex gap-3" },
          h("button", { onClick: generate, disabled: !!busy, className: "flex-1 py-3", style: { fontFamily: F_BODY, fontSize: 14, border: "1px solid " + STUDY_SKIN.line, color: STUDY_SKIN.ink, borderRadius: "5px 12px 5px 5px" } }, busy ? "重排中…" : "换一张大纲"),
          h("button", { onClick: function () { confirm(draft); }, disabled: !!busy, className: "flex-1 py-3", style: { fontFamily: F_BODY, fontSize: 14, background: skin.accent, color: STUDY_SKIN.paper, borderRadius: "5px 12px 5px 5px" } }, "装订并上课"))));
    }

    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: "开一节课", en: cur.subject, mode: cur.mode, onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("section", { style: { marginTop: 12, padding: "17px 16px", background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderTop: "4px solid " + skin.accent, borderRadius: "5px 16px 16px 5px", boxShadow: "0 9px 22px " + STUDY_SKIN.shadow } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: skin.accent, marginBottom: 8 } }, "下一节 · " + cur.subject),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: STUDY_SKIN.ink, lineHeight: 1.75, marginBottom: 18 } },
          "这门课：" + cur.subject + (cur.level ? "（" + cur.level + "）" : "") + "。点下面生成本节小大纲——会自动参考你之前几节学到哪、卡在哪，接着往下排。"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.sub, marginBottom: 7 } }, "这节想侧重什么（可选）"),
        h("input", { value: focus, onChange: function (e) { return setFocus(e.target.value); }, placeholder: "留空=接着上次；或写：想多练听力", style: field }))),
      h(StudyFooter, null,
        h("button", { onClick: generate, disabled: !!busy, className: "w-full py-3", style: { minHeight: 46, fontFamily: F_BODY, fontSize: 15, background: skin.accent, color: STUDY_SKIN.paper, borderRadius: "5px 14px 5px 5px", opacity: busy ? 0.6 : 1 } },
          busy === "sum" ? "翻阅之前几节…" : busy === "draft" ? "正在排这张课页…" : "排本节大纲")));
  }

  // ---- 新建研究（costudy）：挑 1 角色 + 题目，直接开聊，无大纲无判定 ----
  function NewCostudy(props) {
    const [subject, setSubject] = useState("");
    const [pick, setPick] = useState(null);
    const skin = STUDY_MODE_SKIN.costudy;
    const field = { fontFamily: F_BODY, fontSize: 14, color: STUDY_SKIN.ink, background: "transparent", border: "none", borderBottom: "1px solid " + skin.accent, borderRadius: 0, padding: "10px 2px 8px", outline: "none", width: "100%" };
    function begin() {
      if (!subject.trim()) { props.toast("先填个题目"); return; }
      if (!pick) { props.toast("挑 1 个角色"); return; }
      props.onCreated({ subject: subject.trim(), charId: pick });
    }
    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: "铺一张研究纸", mode: "costudy", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("section", { style: { marginTop: 12, padding: "18px 16px", background: STUDY_SKIN.paper, border: "1px dashed " + skin.accent + "88", borderRadius: "16px 5px 16px 5px", boxShadow: "0 9px 22px " + STUDY_SKIN.shadow } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: skin.accent, marginBottom: 7 } }, "研究什么"),
        h("input", { value: subject, onChange: function (e) { return setSubject(e.target.value); }, placeholder: "例：黑洞怎么蒸发 / 某本书的读法 / 一道难题…", style: field }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog, marginTop: 7, lineHeight: 1.65 } }, "不设大纲：你俩谁也不比谁更懂，边聊边攒线索、一起试错。"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".04em", color: skin.accent, margin: "21px 0 8px" } }, "找谁一起"),
        h("div", { className: "flex flex-col gap-2" }, (props.characters || []).map(function (c) {
          const on = pick === c.id;
          return h("button", { key: c.id, onClick: function () { return setPick(on ? null : c.id); }, className: "flex items-center gap-3 p-2 active:opacity-70",
            style: { minHeight: 58, background: on ? skin.soft : STUDY_SKIN.paper2, border: "1px solid " + (on ? skin.accent : STUDY_SKIN.line), borderLeft: "3px solid " + (on ? skin.accent : "transparent"), borderRadius: "4px 12px 12px 4px", textAlign: "left", transform: on ? "translateX(3px)" : "none" } },
            h(Avatar, { character: c, size: 40, radius: 999 }),
            h("span", { className: "flex-1", style: { fontFamily: F_DISPLAY, fontSize: 15, color: STUDY_SKIN.ink } }, c.name),
            on ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: skin.accent } }, "同桌") : null);
        })))),
      h(StudyFooter, null,
        h("button", { onClick: begin, className: "w-full py-3", style: { minHeight: 46, fontFamily: F_BODY, fontSize: 15, background: skin.accent, color: STUDY_SKIN.paper, borderRadius: "12px 5px 12px 5px" } }, "把研究纸摊开")));
  }

  // 聊天主体
  function StudyThread(props) {
    const [sess, setSess] = useState(props.session);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [expand, setExpand] = useState(false);
    const [quizDrafts, setQuizDrafts] = useState({});
    const [quizConfidence, setQuizConfidence] = useState({});
    const scrollRef = useRef(null);
    const sessRef = useRef(props.session);
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 台词朗读（懒合成，重听免费）
    useEffect(function () { sessRef.current = sess; }, [sess]);
    const [hoView, setHoView] = useState("");   // 正在看老师递来的哪一份
    // 这门课她传过的资料先读进来：拼提示词那一步是同步的，得在她开口之前就备好
    useEffect(function () { const c = sess.curriculum_id ? findCurriculum(sess.curriculum_id) : null; if (c) loadMaterials(c); }, [sess.id]);
    useEffect(function () {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [sess.transcript.length, busy]);

    // 本节自足：outline+progress 都挂在 session 上（costudy 的 progress 是 running_summary）
    const outline = sess.outline || null;
    const units = (outline && outline.units) || [];
    const prog = sess.progress || {};
    const chars = (sess.character_ids || []).map(function (id) { return (props.characters || []).find(function (c) { return c.id === id; }); }).filter(Boolean);
    const teacher = sess.teacher_id ? chars.find(function (c) { return c.id === sess.teacher_id; }) : chars[0];
    const userName = (props.profile && props.profile.name) || "我";
    const ctx = { worldbook: props.worldbook, profile: props.profile, characters: props.characters };
    function contextFor(char) {
      const recent = (sessRef.current.transcript || []).slice(-16).map(function (m) { return String(m.content || ""); }).join("\n");
      const me = props.selfFor && char ? props.selfFor(char) : null;
      return Object.assign({}, ctx, {
        grown: me && me.grown || "", grownEvolve: !!(me && me.evolve), relFor: props.relFor,
        worldbook: props.worldbookFor && char ? props.worldbookFor(char.id, [sessRef.current.subject, recent].filter(Boolean).join("\n")) : props.worldbook
      });
    }

    // 持久化：改 transcript / progress 后存库并回写列表
    function commit(next) {
      next = compactStudyTranscript(next, 80);
      next.updated_at = Date.now();
      setSess(next);
      sessRef.current = next;
      const all = loadSessions().map(function (s) { return s.id === next.id ? next : s; });
      saveSessions(all);
      props.onUpdated && props.onUpdated(next);
    }

    function pushEntry(entry) {
      const s = sessRef.current;
      const next = Object.assign({}, s, { transcript: s.transcript.concat([entry]) });
      commit(next);
      return next;
    }
    function patchHandout(id, patch) {
      const s = sessRef.current;
      commit(Object.assign({}, s, { transcript: s.transcript.map(function (m) { return m.id === id && m.handout ? Object.assign({}, m, { handout: Object.assign({}, m.handout, patch) }) : m; }) }));
    }
    // 老师说要给的那份东西：卡先落下（写着「正在写」），正文另一枪写完再填进去
    async function writeHandout(id, char, role) {
      const m = (sessRef.current.transcript || []).find(function (x) { return x.id === id; });
      if (!m || !m.handout) return;
      patchHandout(id, { status: "writing", err: "" });
      try {
        const body = await genHandout(props.active, sessRef.current, char, contextFor(char), role, m.handout);
        patchHandout(id, { status: "done", body: body, chars: body.length });
      } catch (e) {
        patchHandout(id, { status: "failed", err: String((e && e.message) || "没写成").slice(0, 200) });
      }
    }

    async function refreshCostudySummary() {
      const snapshot = sessRef.current;
      const buffer = snapshot.progress && snapshot.progress.summary_buffer;
      if (snapshot.mode !== "costudy" || !Array.isArray(buffer) || !buffer.length) return;
      const used = new Set(buffer.map(function (m) { return String(m.id || ""); }));
      try {
        const summary = await summarizeCostudyContext(props.bgActive || props.active, snapshot, ctx);
        const latest = sessRef.current;
        const progress = Object.assign({}, latest.progress || {});
        progress.running_summary = summary;
        progress.summary_buffer = (progress.summary_buffer || []).filter(function (m) { return !used.has(String(m.id || "")); });
        commit(Object.assign({}, latest, { progress: progress }));
      } catch (e) {
        // 摘要失败时缓冲原样保留并继续注入 prompt；宁可稍长，也绝不静默丢研究上下文。
      }
    }

    function lastUserEntry() {
      const before = sessRef.current;
      return (before.transcript || []).length && before.transcript[before.transcript.length - 1].role === "user"
        ? before.transcript[before.transcript.length - 1] : null;
    }
    async function pushSays(char, says) {
      for (let i = 0; i < says.length; i++) {
        if (i > 0) await new Promise(function (r) { return setTimeout(r, 400); });
        pushEntry({ id: "c_" + Date.now() + "_" + i, role: "char", speakerId: char.id, name: char.name, content: says[i], ts: Date.now() });
      }
    }
    // 三人课堂：一次生成写两个人，按先后落泡；题卡/证据只挂老师名下
    async function runNv1(teacher, peer, teacherRole, focusChar) {
      const answerEntry = lastUserEntry();
      const res = await genNv1Turn(props.active, sessRef.current, teacher, peer, contextFor(teacher), contextFor(peer), teacherRole, focusChar ? focusChar.name : "");
      for (let k = 0; k < res.turns.length; k++) {
        if (k > 0) await new Promise(function (r) { return setTimeout(r, 400); });
        await pushSays(res.turns[k].char, res.turns[k].says);
      }
      await applyTeacherExtras(teacher, teacherRole, res, answerEntry);
    }
    async function runChar(char, role) {
      const answerEntry = lastUserEntry();
      const res = await genTurn(props.active, sessRef.current, char, contextFor(char), role);
      const says = (res && res.says) || [];
      if (res && res.board) {
        const cur = sessRef.current;
        commit(Object.assign({}, cur, { progress: Object.assign({}, cur.progress || {}, { board: res.board }) }));
      }
      await pushSays(char, says);
      await applyTeacherExtras(char, role, res, answerEntry);
    }
    async function applyTeacherExtras(char, role, res, answerEntry) {
      if (res && res.quiz) {
        const current = sessRef.current;
        const pendingExit = current.progress && current.progress.exit_ticket;
        const bindingExit = pendingExit && pendingExit.status === "awaiting_answer" && !pendingExit.quizId;
        const allowed = allowedQuizPointIds(units, current.progress, bindingExit);
        if (allowed.includes(res.quiz.pointId)) {
          const quizId = "q_" + Date.now();
          const nextProgress = Object.assign({}, current.progress || {});
          if (bindingExit) nextProgress.exit_ticket = Object.assign({}, pendingExit, { quizId: quizId, pointId: res.quiz.pointId });
          commit(Object.assign({}, current, {
            transcript: (current.transcript || []).concat([{ id: quizId, role: "char", speakerId: char.id, name: char.name,
              content: res.quiz.prompt, quiz: res.quiz, ts: Date.now() }]),
            progress: nextProgress
          }));
        } else {
          // 真越界也不许无声吞卡——老师嘴上说了「做做这道题」，屏幕上必须有东西；降级成普通文字，不带 quiz 结构不记证据
          pushEntry({ id: "q_" + Date.now(), role: "char", speakerId: char.id, name: char.name,
            content: res.quiz.prompt, ts: Date.now() });
        }
      }
      if (res && res.handout && role !== "nv1-peer") {
        const hoId = "ho_" + Date.now();
        pushEntry({ id: hoId, role: "char", speakerId: char.id, name: char.name, ts: Date.now(),
          content: "（递给你一份" + res.handout.kind + "《" + res.handout.title + "》）", handout: Object.assign({ status: "writing" }, res.handout) });
        writeHandout(hoId, char, role);   // 不等它：这一轮的话先说完，讲义写好了自己填进卡里
      }
      // 老师只能把用户刚刚真实作答的表现记成证据；任何模型信号都不能自动推进小节。
      if (units.length && (role === "teach" || role === "nv1-teacher")) recordEvidence(res && res.evidence, answerEntry);
      if (sessRef.current.mode === "costudy") await refreshCostudySummary();
    }

    function recordEvidence(raw, answerEntry) {
      if (!raw || !answerEntry || answerEntry.studyAction) return;
      const s = sessRef.current;
      const cp = Object.assign({ completed: [], mastery: {}, evidence: [], mistakes: [] }, s.progress);
      const cu = units.find(function (u) { return u.id === cp.current_unit; });
      const pointIds = (cu && cu.grammar || []).map(function (g) { return String(g.id); });
      const pointId = String(raw.point_id || raw.pointId || "");
      const result = ["correct", "partial", "incorrect"].includes(raw.result) ? raw.result : "";
      const support = ["none", "hinted", "guided"].includes(raw.support) ? raw.support : "";
      if (!pointId || !pointIds.includes(pointId) || !result || !support) return;
      const key = answerEntry.id + ":" + pointId;
      if ((cp.evidence || []).some(function (e) { return e.key === key; })) return;
      const level = result === "correct" ? (support === "none" ? 2 : 1) : (result === "partial" ? 1 : 0);
      // 掌握度以最近一次真实表现为准；答错可以降级，不能被历史高分永久遮住。
      cp.mastery = Object.assign({}, cp.mastery, { [pointId]: level });
      cp.evidence = (cp.evidence || []).concat([{
        key: key, pointId: pointId, userEntryId: answerEntry.id,
        result: result, support: support, level: level,
        note: String(raw.note || "").slice(0, 180), ts: Date.now()
      }]).slice(-80);
      if (level <= 1) {
        cp.mistakes = (cp.mistakes || []).concat([{
          id: "mist_" + Date.now(), pointId: pointId, userEntryId: answerEntry.id,
          note: String(raw.note || "还需要再练").slice(0, 180), resolved: false, ts: Date.now()
        }]).slice(-50);
      } else {
        cp.mistakes = (cp.mistakes || []).map(function (m) {
          return m.pointId === pointId && !m.resolved ? Object.assign({}, m, { resolved: true, resolvedTs: Date.now() }) : m;
        });
      }
      cp.review_queue = Object.keys(cp.mastery).filter(function (k) { return cp.mastery[k] <= 1; });
      commit(Object.assign({}, s, { progress: cp }));
    }

    // 发图：跟文字一样只入对话、不自动叫人——她可以先发图再补一句「这道哪里错了」，再点让老师回复。
    // 像素进图库（imgToVault），课页上只存 iv_ 引用；输入框里写着的那句顺手当图说明一起发。
    const photoRef = useRef(null);
    async function sendPhoto(file) {
      if (!file) return;
      try {
        const data = await resizeImageFile(file, 1600, 0.86);
        const ref = typeof imgToVault === "function" ? await imgToVault(data) : data;
        if (!ref) throw new Error("empty");
        const txt = input.trim();
        setInput("");
        pushEntry({ id: "u_" + Date.now(), role: "user", content: txt, imageRef: ref, ts: Date.now() });
      } catch (e) { props.toast("这张图没能放上去，换一张试试"); }
    }
    // 发送只入对话、不触发角色：用户可以连续补充几条，再手动让老师统一回复。
    function send() {
      const txt = input.trim();
      if (!txt) return;
      setInput("");
      pushEntry({ id: "u_" + Date.now(), role: "user", content: txt, ts: Date.now() });
    }

    async function submitQuiz(entry, value, confidence) {
      if (busy || !entry || !entry.quiz || entry.quiz.status === "correct") return;
      const answer = String(value == null ? "" : value).trim();
      if (!answer) { props.toast("先填答案"); return; }
      if (!["sure", "unsure", "guess"].includes(confidence)) { props.toast("提交前选一下你有多确定"); return; }
      setBusy(true);
      try {
        const grade = await gradeQuizAnswer(props.bgActive || props.active, entry.quiz, answer);
        if (grade.reviewFailed) {
          props.toast("这次没能完成语义复核，没有判错也没有改掌握度；稍后再试");
          return;
        }
        const now = Date.now();
        const s = sessRef.current;
        const attempts = entry.quiz.attempts || [];
        const hintsUsed = Number(entry.quiz.hintsUsed) || 0;
        const support = hintsUsed >= 3 ? "guided" : ((hintsUsed > 0 || attempts.length > 0) ? "hinted" : "none");
        const level = quizMasteryLevel(entry.quiz, grade.result, support, confidence, s.progress && s.progress.evidence);
        const attempt = { answer: answer, result: grade.result, feedback: grade.feedback, support: support, confidence: confidence, ts: now };
        const answerId = "u_qa_" + now;
        const nextTranscript = (s.transcript || []).map(function (m) {
          if (m.id !== entry.id) return m;
          return Object.assign({}, m, { quiz: Object.assign({}, m.quiz, {
            attempts: attempts.concat([attempt]), status: grade.result === "correct" ? "correct" : "open"
          }) });
        });
        const selected = entry.quiz.type === "choice"
          ? ((entry.quiz.options || []).find(function (o) { return o.id === answer; }) || {}).label || answer
          : (entry.quiz.type === "true_false" ? (answer === "true" ? "正确" : "错误") : answer);
        nextTranscript.push({ id: answerId, role: "user", studyAction: "quiz_answer", hidden: true,
          quizId: entry.id, quizPointId: entry.quiz.pointId, quizResult: grade.result,
          quizSupport: support, quizConfidence: confidence, quizLevel: level,
          content: "（答题卡作答｜题目：" + entry.quiz.prompt + "｜我的答案：" + selected + "｜自信：" + confidence + "｜判定：" + grade.result + "）", ts: now });

        const cp = Object.assign({ completed: [], mastery: {}, review_queue: [], evidence: [], mistakes: [] }, s.progress);
        const pointId = entry.quiz.pointId;
        cp.mastery = Object.assign({}, cp.mastery, { [pointId]: level });
        cp.evidence = (cp.evidence || []).concat([{
          key: entry.id + ":" + (attempts.length + 1), pointId: pointId, userEntryId: answerId,
          quizId: entry.id, quizType: entry.quiz.type, result: grade.result, support: support, confidence: confidence, level: level,
          note: grade.feedback, ts: now
        }]).slice(-80);
        if (level <= 1) {
          cp.mistakes = (cp.mistakes || []).concat([{
            id: "mist_" + now, pointId: pointId, userEntryId: answerId, quizId: entry.id,
            note: (grade.result === "incorrect" && confidence === "sure" ? "高置信误解：" : "") + (grade.feedback || "需要再练"), resolved: false, ts: now
          }]).slice(-50);
        } else {
          cp.mistakes = (cp.mistakes || []).map(function (m) {
            return m.pointId === pointId && !m.resolved ? Object.assign({}, m, { resolved: true, resolvedTs: now }) : m;
          });
        }
        cp.review_queue = Object.keys(cp.mastery).filter(function (k) { return cp.mastery[k] <= 1; });
        commit(Object.assign({}, s, { transcript: nextTranscript, progress: cp }));
        updateCurriculumReview(s.curriculum_id, s, entry.quiz, { result: grade.result, support: support, confidence: confidence, ts: now, answer: selected });
        setQuizDrafts(function (old) { return Object.assign({}, old, { [entry.id]: "" }); });
        setQuizConfidence(function (old) { return Object.assign({}, old, { [entry.id]: "" }); });
        props.toast(grade.result === "correct" ? "答对了，已记成学习证据" : (grade.result === "partial" ? "基本方向对，再修一下" : "这题还不对，已经放进薄弱点"));
      } finally { setBusy(false); }
    }

    function revealQuizHint(entry) {
      if (busy || !entry || !entry.quiz || entry.quiz.status === "correct") return;
      const hints = entry.quiz.hints || [];
      const used = Number(entry.quiz.hintsUsed) || 0;
      if (!hints.length) { props.toast("这道题没有额外提示，先按自己的理解试试"); return; }
      if (used >= hints.length) { props.toast("提示已经全部给你啦"); return; }
      const s = sessRef.current;
      const nextTranscript = (s.transcript || []).map(function (m) {
        return m.id === entry.id ? Object.assign({}, m, { quiz: Object.assign({}, m.quiz, { hintsUsed: used + 1 }) }) : m;
      });
      commit(Object.assign({}, s, { transcript: nextTranscript }));
      props.toast("打开第 " + (used + 1) + " 级提示");
    }

    function startWarmup() {
      if (busy) return;
      const s = sessRef.current;
      const cp = Object.assign({ warmup_queue: [], warmup_started: false }, s.progress);
      const queue = (cp.warmup_queue || []).slice(0, 2);
      if (!queue.length || cp.warmup_started) return;
      const now = Date.now();
      const cards = queue.map(function (q, i) {
        return { id: "q_review_" + now + "_" + i, role: "char", speakerId: teacher && teacher.id,
          name: teacher && teacher.name || "老师", content: q.prompt,
          quiz: Object.assign({}, q, { attempts: [], hintsUsed: 0, status: "open", isReview: true }), ts: now + i };
      });
      cp.warmup_started = true;
      commit(Object.assign({}, s, { transcript: (s.transcript || []).concat(cards), progress: cp }));
      props.toast("先用 " + cards.length + " 道到期题热热身，再开始新内容");
    }

    // 抽一张题卡：一次只建立一张可追踪的题，答完想继续再抽，避免“三题计划”没有状态机却假装会续上。
    function quizMe() {
      if (busy) return;
      pushEntry({ id: "u_" + Date.now(), role: "user", content: "（抽一张可交互题卡考考我：只出 1 题，考当前小节已经讲过的内容，优先选我还不稳的要点。可以用单选、判断或填空；适合拼句时给可点选词块。先别公布答案。）", ts: Date.now() });
      setTimeout(function () { replyNow(); }, 60);
    }

    function reteach() {
      if (busy) return;
      pushEntry({ id: "u_" + Date.now(), role: "user", studyAction: "reteach",
        content: "这样我没听懂，换一种讲法。别只是换几个词：请换成例子、类比、图像化步骤或带我一起做，从你判断我真正卡住的地方重新来。", ts: Date.now() });
      setTimeout(function () { replyNow(); }, 60);
    }

    // 让角色回复（手动触发）：teach/costudy 单角色回复；nv1 走导演
    async function replyNow() {
      if (busy) return;
      if (!props.active) { props.toast("请先到设置配置 API"); return; }
      setBusy(true);
      try {
        if (sess.mode === "nv1") {
          const peer = chars.find(function (c) { return c.id !== (teacher && teacher.id); });
          const teacherRole = sess.teacher_id ? "nv1-teacher" : "costudy";
          if (teacher && peer) {
            // 模型导演：决定这一轮谁开口、什么顺序，再逐个 fire
            const dir = directNv1(props.active, sessRef.current, teacher, peer, ctx);
            await runNv1(teacher, peer, teacherRole, dir.named ? (dir.lead === "peer" ? peer : teacher) : null);
          } else if (teacher) {
            await runChar(teacher, teacherRole);
          }
        } else {
          await runChar(chars[0], sess.mode);
        }
      } catch (e) {
        props.toast("生成失败：" + (e.message || "重试"));
      } finally { setBusy(false); }
    }

    function hasExitAnswer(s, ticket) {
      return !!exitAnswerEntry(s, ticket);
    }

    async function startExitTicket() {
      const s = sessRef.current;
      const cp = Object.assign({ completed: [], mastery: {}, evidence: [], mistakes: [] }, s.progress);
      const cu = units.find(function (u) { return u.id === cp.current_unit; });
      if (!cu) return;
      const askedAt = Date.now();
      cp.exit_ticket = { status: "awaiting_answer", unitId: cu.id, askedAt: askedAt };
      commit(Object.assign({}, s, { progress: cp }));
      pushEntry({
        id: "u_" + Date.now(), role: "user", studyAction: "exit_request",
        content: "（【结课小测】请针对当前小节最核心、最好也是我还不稳的点，只发 1 张 fill_blank 主动回忆题卡，让我自己写出/拼出答案；不要用单选或判断。先不要公布答案，也不要替我回答。）", ts: askedAt
      });
      await replyNow();
      props.toast("先答完这道小测，再点“提交结课”");
    }

    async function checkpoint() {
      if (busy || !props.active) return;
      if (sess.mode === "costudy" || !units.length) return;
      const initial = sessRef.current;
      const initialTicket = initial.progress && initial.progress.exit_ticket;
      if (!initialTicket || initialTicket.status !== "awaiting_answer") {
        await startExitTicket();
        return;
      }
      if (!initialTicket.quizId) {
        props.toast("刚才没生成出合法题卡，正在重新出题");
        await startExitTicket();
        return;
      }
      if (!hasExitAnswer(initial, initialTicket)) {
        props.toast("先亲自回答老师刚出的结课小测");
        return;
      }
      setBusy(true);
      try {
        const s = sessRef.current;
        // 本节自足：结算写进本 session 的进度（跨 session 靠开新节时的摘要衔接，不写这里）
        const cp = Object.assign({ completed: [], mastery: {} }, s.progress);
        const cu = units.find(function (u) { return u.id === cp.current_unit; });
        const gate = unitCompletionGate(cu, cp, initialTicket, s.transcript);
        if (!gate.passed) {
          cp.exit_ticket = { status: "needs_retry", unitId: cp.current_unit, checkedAt: Date.now() };
          cp.notes = !gate.exitPassed ? "结课题还没有独立答对" : "仍有要点需要独立完成";
          commit(Object.assign({}, sessRef.current, { progress: cp }));
          props.toast(!gate.exitPassed
            ? "这张结课题还不能算独立掌握，练一下再测"
            : "还有 " + gate.missing.length + " 个要点缺少独立作答证据，先各练一题");
          return;
        }
        cp.exit_ticket = { status: "passed", unitId: cp.current_unit, checkedAt: Date.now() };
        const idx = units.findIndex(function (u) { return u.id === cp.current_unit; });
        if (!cp.completed.includes(cp.current_unit)) cp.completed = cp.completed.concat([cp.current_unit]);
        const nextU = units[idx + 1];
        if (nextU) {
          cp.current_unit = nextU.id;
          cp.exit_ticket = null;
          const weak = (cp.review_queue || []).length;
          props.toast("进入下一小节：" + nextU.title + (weak ? "（有 " + weak + " 个点标了待复习）" : ""));
        } else {
          props.toast("本节都学完啦 🎉 回课程可以开下一节");
        }
        const completedSession = Object.assign({}, sessRef.current, { progress: cp });
        commit(completedSession);
        if (!nextU && !cp.closing_note) {
          try {
            const note = await generateStudyNote(props.bgActive || props.active, completedSession, teacher, ctx);
            const latest = sessRef.current;
            const nextProgress = Object.assign({}, latest.progress, { closing_note: note });
            const summary = "本节做到：" + note.achieved + "；还需：" + note.weak + "；下次：" + note.next;
            const noteEntry = { id: "study_note_" + note.ts, role: "system", studyNote: note,
              content: summary, ts: note.ts };
            commit(Object.assign({}, latest, { progress: nextProgress,
              transcript: (latest.transcript || []).concat([noteEntry]), summary: summary, summaryTs: Date.now() }));
            if (latest.curriculum_id) pushCurriculumSummary(latest.curriculum_id, latest.id, summary);
            props.toast((teacher && teacher.name || "老师") + " 给你留了一张课后小纸条");
          } catch (e) {
            props.toast("本节已完成；课后小纸条这次没写出来，不影响进度");
          }
        }
      } catch (e) {
        props.toast("出错了：" + (e.message || "重试"));
      } finally { setBusy(false); }
    }

    // 退回上一小节：current_unit 回上一小节，并从「已完成」移除（重新学）
    function prevUnit() {
      if (busy || !units.length) return;
      const s = sessRef.current;
      const cp = Object.assign({ completed: [] }, s.progress);
      const idx = units.findIndex(function (u) { return u.id === cp.current_unit; });
      if (idx <= 0) { props.toast("已经是第一小节了"); return; }
      const prev = units[idx - 1];
      cp.current_unit = prev.id;
      cp.completed = (cp.completed || []).filter(function (x) { return x !== prev.id; });
      commit(Object.assign({}, s, { progress: cp }));
      props.toast("退回上一小节：" + prev.title);
    }

    // 顶栏
    const accent = modeColor(sess.mode);
    const unit = units.length ? units.find(function (u) { return u.id === prog.current_unit; }) : null;
    const topBar = sess.mode === "costudy"
      ? h("div", { className: "shrink-0 px-4 py-2", style: { background: STUDY_SKIN.paper, borderBottom: "1px dashed " + accent + "66" } },
          // 研究笔记板：收着只露「现在在研究什么」，点开看猜测／已确认／还没解决
          h("button", { onClick: function () { return setExpand(!expand); }, className: "w-full text-left active:opacity-70", style: { minHeight: 40, display: "block" } },
            h("div", { style: { paddingLeft: 10, borderLeft: "3px solid " + accent, fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.sub, lineHeight: 1.6 } },
              "研究笔记 · " + ((sess.progress && sess.progress.board && sess.progress.board.question)
                || (sess.progress && sess.progress.running_summary ? sess.progress.running_summary.slice(0, 60) : "还在起步，边聊边攒线索"))
              + (sess.progress && sess.progress.board ? (expand ? "  ▴" : "  ▾") : ""))),
          expand && sess.progress && sess.progress.board ? h("div", { style: { padding: "6px 0 4px 13px", fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.sub, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: "40vh", overflowY: "auto" } },
            boardText(sess.progress.board)) : null)
      : h("div", { className: "shrink-0 px-4 py-2", style: { background: STUDY_SKIN.paper, borderBottom: "1px solid " + STUDY_SKIN.line } },
          h("button", { onClick: function () { return setExpand(!expand); }, className: "w-full flex items-center gap-2 active:opacity-70", style: { minHeight: 32 } },
            h("div", { className: "flex-1", style: { height: 7, padding: 1, background: STUDY_SKIN.paper2, border: "1px solid " + STUDY_SKIN.line, borderRadius: 2, overflow: "hidden" } },
              h("div", { style: { height: "100%", width: (studyProgressRatio(units, prog) * 100) + "%", background: accent, borderRadius: 1 } })),
            h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.fog } },
              (unit ? unit.title : "本节") + " " + ((prog.completed || []).length) + "/" + (units.length || "?"))),
          expand && unit ? h("div", { className: "mt-2 flex flex-wrap gap-1.5" }, (unit.grammar || []).map(function (g) {
            const lv = (prog.mastery || {})[g.id];
            const col = lv >= 2 ? "#4a9e5c" : lv === 1 ? "#d6a53a" : "#cf5b4e";
            return h("span", { key: g.id, style: { fontFamily: F_BODY, fontSize: 11, color: STUDY_SKIN.paper, background: col, borderRadius: 3, padding: "2px 7px" } }, g.label);
          })) : null);

    const lessonTools = sess.mode === "costudy" ? null : h("div", { className: "shrink-0 grid grid-cols-3 gap-2 px-4 py-2", style: { background: "rgba(251,248,239,.9)", borderBottom: "1px solid " + STUDY_SKIN.line } },
      h("button", { onClick: prevUnit, disabled: busy || !units.length || (units.findIndex(function (u) { return u.id === prog.current_unit; }) <= 0), className: "active:opacity-60 disabled:opacity-30", style: { minHeight: 42, fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.sub, background: STUDY_SKIN.paper2, border: "1px solid " + STUDY_SKIN.line, borderRadius: "4px 10px 4px 4px" } }, "← 上一小节"),
      h("button", { onClick: quizMe, disabled: busy, className: "active:opacity-60 disabled:opacity-30", style: { minHeight: 42, fontFamily: F_BODY, fontSize: 11.5, color: STUDY_SKIN.ink, background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderTop: "3px solid " + accent, borderRadius: "4px 10px 4px 4px" } }, "抽一张题卡"),
      h("button", { onClick: checkpoint, disabled: busy, className: "active:opacity-60", style: { minHeight: 42, fontFamily: F_BODY, fontSize: 11.5, color: accent, background: studyModeSkin(sess.mode).soft, border: "1px solid " + accent + "66", borderRadius: "4px 10px 4px 4px" } },
        prog.exit_ticket && prog.exit_ticket.status === "awaiting_answer"
          ? (hasExitAnswer(sess, prog.exit_ticket) ? "提交结课" : "先答小测")
          : (prog.exit_ticket && prog.exit_ticket.status === "needs_retry" ? "再测一次" : "结课小测")));

    function handoutCard(m) {
      const ho = m.handout, done = ho.status === "done", failed = ho.status === "failed";
      const who = (props.characters || []).find(function (c) { return c.id === m.speakerId; }) || { id: m.speakerId, name: m.name };
      const role = sess.mode === "costudy" ? "costudy" : sess.mode === "nv1" ? "nv1-teacher" : "teach";
      return h("button", { onClick: function () { if (done) setHoView(m.id); else if (failed) writeHandout(m.id, who, role); },
        className: "flex items-center active:opacity-80", style: { gap: 11, width: 260, maxWidth: "100%", textAlign: "left", padding: "12px 13px", background: STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderRadius: "4px 13px 13px 4px", borderLeft: "3px solid " + accent, boxShadow: "0 4px 12px " + STUDY_SKIN.shadow } },
        h("span", { style: { width: 34, height: 42, flexShrink: 0, borderRadius: "3px 10px 3px 3px", background: accent, color: STUDY_SKIN.paper, fontFamily: F_BODY, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" } }, ho.kind),
        h("span", { style: { flex: 1, minWidth: 0 } },
          h("span", { style: { display: "block", fontFamily: F_DISPLAY, fontSize: 14.5, color: STUDY_SKIN.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ho.title),
          h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 11, color: failed ? STUDY_SKIN.red : STUDY_SKIN.fog, marginTop: 3 } },
            done ? (ho.chars || (ho.body || "").length) + " 字 · 点开看" : failed ? "没写成，点一下再写" : "正在写…")));
    }
    function quizCard(m) {
      const q = m.quiz;
      const attempts = q.attempts || [];
      const last = attempts[attempts.length - 1];
      const solved = q.status === "correct";
      const draft = quizDrafts[m.id] || "";
      const confidence = quizConfidence[m.id] || "";
      const hints = q.hints || [];
      const hintsUsed = Math.min(Number(q.hintsUsed) || 0, hints.length);
      const baseButton = { minHeight: 42, fontFamily: F_BODY, fontSize: 13, color: STUDY_SKIN.ink, background: STUDY_SKIN.paper2,
        border: "1px solid " + STUDY_SKIN.line, borderRadius: "4px 10px 10px 4px", padding: "9px 10px", textAlign: "left" };
      let answerUI;
      if (q.type === "choice") {
        answerUI = h("div", { className: "flex flex-col gap-2" }, (q.options || []).map(function (o) {
          const on = draft === o.id;
          return h("button", { key: o.id, disabled: busy || solved, onClick: function () { setQuizDrafts(function (old) { return Object.assign({}, old, { [m.id]: o.id }); }); },
            className: "active:opacity-70 disabled:opacity-60", style: Object.assign({}, baseButton, on ? { borderColor: accent, background: accent + "12" } : {}) },
            h("span", { style: { color: accent, marginRight: 7 } }, o.id), o.label);
        }));
      } else if (q.type === "true_false") {
        answerUI = h("div", { className: "grid grid-cols-2 gap-2" },
          h("button", { disabled: busy || solved, onClick: function () { setQuizDrafts(function (old) { return Object.assign({}, old, { [m.id]: "true" }); }); }, className: "active:opacity-70 disabled:opacity-60", style: Object.assign({}, baseButton, { textAlign: "center" }, draft === "true" ? { borderColor: accent, background: accent + "12" } : {}) }, "正确"),
          h("button", { disabled: busy || solved, onClick: function () { setQuizDrafts(function (old) { return Object.assign({}, old, { [m.id]: "false" }); }); }, className: "active:opacity-70 disabled:opacity-60", style: Object.assign({}, baseButton, { textAlign: "center" }, draft === "false" ? { borderColor: accent, background: accent + "12" } : {}) }, "错误"));
      } else {
        const bank = q.wordBank || [];
        answerUI = h("div", null,
          h("input", { value: draft, disabled: busy || solved, onChange: function (e) { setQuizDrafts(function (old) { return Object.assign({}, old, { [m.id]: e.target.value }); }); },
            placeholder: bank.length ? "点词块拼答案，也可以直接输入…" : "填入答案…", style: { width: "100%", fontFamily: F_BODY, fontSize: 13, color: STUDY_SKIN.ink, background: STUDY_SKIN.paper2, border: "1px solid " + STUDY_SKIN.line, borderRadius: "4px 10px 10px 4px", padding: "9px 10px" } }),
          bank.length ? h("div", { className: "flex flex-wrap gap-1.5", style: { marginTop: 8 } },
            bank.map(function (token, i) {
              return h("button", { key: i + ":" + token, disabled: busy || solved, onClick: function () {
                setQuizDrafts(function (old) {
                  const before = String(old[m.id] || "").trim();
                  return Object.assign({}, old, { [m.id]: before ? before + " " + token : token });
                });
              }, className: "active:opacity-65 disabled:opacity-45", style: { minHeight: 36, padding: "6px 10px", fontFamily: F_BODY,
                fontSize: 12.5, color: accent, background: STUDY_SKIN.paper, border: "1px solid " + accent + "66", borderRadius: "4px 10px 4px 4px" } }, token);
            }),
            draft ? h("button", { onClick: function () { setQuizDrafts(function (old) { return Object.assign({}, old, { [m.id]: "" }); }); },
              className: "active:opacity-65", style: { minHeight: 36, padding: "6px 9px", fontFamily: F_BODY, fontSize: 11.5,
                color: STUDY_SKIN.fog, border: "1px dashed " + STUDY_SKIN.line, borderRadius: 8 } }, "重新拼") : null) : null);
      }
      return h("div", { style: { position: "relative", width: "min(100%, 430px)", background: "repeating-linear-gradient(to bottom," + STUDY_SKIN.paper + " 0," + STUDY_SKIN.paper + " 27px,rgba(92,112,126,.10) 28px)", border: "1px solid " + accent + "66", borderTop: "4px solid " + accent, borderRadius: "4px 14px 14px 4px", padding: "13px 13px 14px", boxShadow: "0 7px 18px " + STUDY_SKIN.shadow } },
        h("div", { className: "flex items-center justify-between", style: { marginBottom: 8 } },
          h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".15em", color: accent } }, "小测 · " + (q.type === "choice" ? "单选" : q.type === "true_false" ? "判断" : "填空")),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: STUDY_SKIN.fog } }, attempts.length ? "已答 " + attempts.length + " 次" : "未作答")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, color: STUDY_SKIN.ink, marginBottom: 11, whiteSpace: "pre-wrap" } }, q.prompt),
        answerUI,
        !solved ? h("div", { style: { marginTop: 9 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: STUDY_SKIN.fog, marginBottom: 5 } }, "提交前，在卷角上标一下把握："),
          h("div", { className: "grid grid-cols-3 gap-1.5" }, [["sure", "很确定"], ["unsure", "有点犹豫"], ["guess", "我在猜"]].map(function (x) {
            const on = confidence === x[0];
            return h("button", { key: x[0], disabled: busy, onClick: function () { setQuizConfidence(function (old) { return Object.assign({}, old, { [m.id]: x[0] }); }); },
              className: "active:opacity-70 disabled:opacity-50", style: { minHeight: 40, fontFamily: F_BODY, fontSize: 11, color: on ? STUDY_SKIN.paper : STUDY_SKIN.fog,
                background: on ? accent : STUDY_SKIN.paper2, border: "1px solid " + (on ? accent : STUDY_SKIN.line), borderRadius: "4px 9px 4px 4px", padding: "6px 3px", transform: on ? "translateY(-2px)" : "none" } }, x[1]);
          })),
          h("button", { disabled: busy || !String(draft).trim() || !confidence, onClick: function () { submitQuiz(m, draft, confidence); },
            className: "w-full active:opacity-70 disabled:opacity-40", style: { marginTop: 7, fontFamily: F_BODY, fontSize: 12.5,
              color: STUDY_SKIN.paper, background: accent, borderRadius: "4px 10px 4px 4px", padding: "9px 0" } }, busy ? "判定中…" : "交这张题卡")) : null,
        hintsUsed ? h("div", { style: { marginTop: 9, padding: "8px 9px", background: accent + "0d", borderRadius: 8 } },
          hints.slice(0, hintsUsed).map(function (hint, i) {
            return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: STUDY_SKIN.fog,
              marginTop: i ? 5 : 0 } }, "提示 " + (i + 1) + "：" + hint);
          })) : null,
        !solved && hints.length ? h("button", { disabled: busy || hintsUsed >= hints.length, onClick: function () { revealQuizHint(m); },
          className: "active:opacity-70 disabled:opacity-40", style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11.5,
            color: accent, border: "1px solid " + accent + "66", borderRadius: 8, padding: "5px 9px" } },
          hintsUsed >= hints.length ? "提示已全部展开" : "给我一点提示 · " + hintsUsed + "/" + hints.length) : null,
        last ? h("div", { style: { marginTop: 9, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6,
          color: last.result === "correct" ? "#4a9e5c" : last.result === "partial" ? "#b18428" : "#c45353" } },
          (last.result === "correct" ? "✓ " : last.result === "partial" ? "△ " : "× ") + last.feedback) : null,
        solved && q.explanation ? h("div", { style: { marginTop: 7, paddingTop: 7, borderTop: "1px solid " + STUDY_SKIN.line,
          fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: STUDY_SKIN.fog } }, q.explanation) : null);
    }

    // 气泡渲染
    const bubbles = sess.transcript.map(function (m) {
      if (m.hidden) return null;
      if (m.studyNote) {
        const n = m.studyNote;
        return h("div", { key: m.id, className: "my-4", style: { position: "relative", background: STUDY_SKIN.paper, border: "1px solid " + accent + "66", borderTop: "4px solid " + accent, borderRadius: "4px 14px 14px 4px", padding: 14, boxShadow: "0 7px 18px " + STUDY_SKIN.shadow, transform: "rotate(-.2deg)" } },
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 9 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: STUDY_SKIN.ink } }, "课后批注页"),
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: STUDY_SKIN.fog } }, n.authorName || "老师")),
          [["今天做到", n.achieved], ["做得好的", n.strength], ["还没稳的", n.weak], ["下次先做", n.next]].map(function (x) {
            return h("div", { key: x[0], style: { fontFamily: F_BODY, fontSize: 12.5, color: STUDY_SKIN.ink, lineHeight: 1.65, marginTop: 4 } },
              h("span", { style: { color: STUDY_SKIN.fog } }, x[0] + "："), x[1]);
          }),
          h("div", { style: { marginTop: 10, paddingTop: 9, borderTop: "1px solid " + STUDY_SKIN.line,
            fontFamily: F_BODY, fontSize: 13, color: accent, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, n.note));
      }
      if (m.role === "user") {
        return h("div", { key: m.id, className: "flex justify-end mb-2" },
          h("div", { style: { maxWidth: "78%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 } },
            m.imageRef ? h("img", { src: typeof resolveImg === "function" ? resolveImg(m.imageRef) : m.imageRef, alt: "你发的图", style: { display: "block", maxWidth: "100%", maxHeight: 260, borderRadius: 10, border: "1px solid " + STUDY_SKIN.line, objectFit: "contain", background: STUDY_SKIN.paper } }) : null,
            (m.content || !m.imageRef) ? h("div", { style: { background: accent, color: STUDY_SKIN.paper, borderRadius: "12px 12px 3px 12px", padding: "9px 12px", boxShadow: "0 4px 10px " + accent + "24", fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, m.content) : null));
      }
      const isTeacher = !teacher || m.speakerId === teacher.id;
      const char = chars.find(function (c) { return c.id === m.speakerId; });
      const indent = sess.mode === "nv1" && !isTeacher;
      return h("div", { key: m.id, className: "flex items-start gap-2 mb-2", style: indent ? { paddingLeft: 22 } : null },
        h(Avatar, { character: char, size: 30, radius: 999 }),
        h("div", { className: "min-w-0" },
          (sess.mode === "nv1" || (char && char.voiceId && typeof ttsReady === "function" && ttsReady())) ? h("div", { className: "flex items-center gap-1", style: { marginBottom: 2 } },
            sess.mode === "nv1" ? h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: STUDY_SKIN.fog } }, m.name + (isTeacher ? "（老师）" : "（同学）")) : null,
            (tp && typeof TtsDot === "function") ? h(TtsDot, { k: "st" + m.id, text: m.content, spk: char, tp: tp }) : null) : null,
          m.handout ? handoutCard(m) : m.quiz ? quizCard(m) : h("div", { style: { display: "inline-block", maxWidth: "100%", background: indent ? STUDY_MODE_SKIN.costudy.soft : STUDY_SKIN.paper, border: "1px solid " + STUDY_SKIN.line, borderLeft: "3px solid " + (indent ? STUDY_MODE_SKIN.costudy.accent : accent), color: STUDY_SKIN.ink, borderRadius: "4px 13px 13px 4px", padding: "9px 12px", boxShadow: "0 4px 12px " + STUDY_SKIN.shadow, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, m.content)));
    });

    const hoEntry = hoView ? (sess.transcript || []).find(function (m) { return m.id === hoView && m.handout && m.handout.status === "done"; }) : null;
    if (hoEntry) return h(HandoutPage, { entry: hoEntry, mode: sess.mode, curId: sess.curriculum_id || null, toast: props.toast,
      onKept: function (id) { patchHandout(id, { kept: true }); }, onBack: function () { setHoView(""); } });
    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: sess.subject, en: modeTag(sess.mode), mode: sess.mode, onBack: props.onBack }),
      topBar,
      lessonTools,
      h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto px-4 py-3", style: { background: "repeating-linear-gradient(to bottom,rgba(251,248,239,.72) 0,rgba(251,248,239,.72) 31px,rgba(92,112,126,.10) 32px)" } },
        bubbles.length === 0
          ? h("div", { className: "flex flex-col items-center gap-3", style: { marginTop: 30 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: STUDY_SKIN.fog, textAlign: "center", lineHeight: 1.8 } },
                (prog.warmup_queue || []).length && !prog.warmup_started
                  ? "有 " + (prog.warmup_queue || []).length + " 个知识点到复习时间了。先看看今天还记不记得。"
                  : "开始吧——先说几句，或直接让 " + (teacher ? teacher.name : "对方") + " 开个头"),
              (prog.warmup_queue || []).length && !prog.warmup_started
                ? h("button", { onClick: startWarmup, disabled: busy, className: "px-4 py-2 active:opacity-70",
                    style: { fontFamily: F_BODY, fontSize: 13, background: accent, color: STUDY_SKIN.paper, borderRadius: "4px 10px 4px 4px" } }, "先做课前热身")
                : h("button", { onClick: replyNow, disabled: busy, className: "px-4 py-2 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, background: accent, color: STUDY_SKIN.paper, borderRadius: "4px 10px 4px 4px" } }, busy ? "…" : "请 " + (teacher ? teacher.name : "对方") + " 写下开场"))
          : bubbles,
        busy ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.fog, padding: "4px 2px" } }, "正在翻课页…") : null),
      h("div", { className: "shrink-0", style: { borderTop: "1px solid " + STUDY_SKIN.line, background: "rgba(251,248,239,.97)" } },
        bubbles.length ? h("div", { className: "px-4 pt-2 flex gap-2" },
          sess.mode !== "costudy" ? h("button", { onClick: reteach, disabled: busy, className: "active:opacity-70 disabled:opacity-40",
            style: { flex: "0 0 auto", fontFamily: F_BODY, fontSize: 12.5, color: accent, border: "1px solid " + accent, borderRadius: "4px 10px 4px 4px", padding: "8px 11px" } }, "换种讲法") : null,
          h("button", { onClick: replyNow, disabled: busy, className: "flex-1 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 13, background: busy ? STUDY_SKIN.line : accent, color: STUDY_SKIN.paper, borderRadius: "4px 10px 4px 4px", padding: "8px 0", opacity: busy ? 0.8 : 1 } },
            busy ? "生成中…" : (sess.mode === "nv1" ? "让 " + (teacher ? teacher.name : "老师") + " / 同学接话" : "让 " + (chars[0] ? chars[0].name : "对方") + " 回复"))) : null,
        h("div", { className: "px-4 pt-3 flex items-end gap-2", style: { paddingBottom: COMPOSER_PAD_BOTTOM } },
          h("button", { onClick: function () { photoRef.current && photoRef.current.click(); }, "aria-label": "发图片", className: "shrink-0 active:opacity-70",
            style: { width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid " + STUDY_SKIN.line, borderRadius: "5px 12px 5px 5px", background: STUDY_SKIN.paper } },
            h(ICamera, { size: 18, color: accent })),
          h("input", { ref: photoRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: function (e) { const f = e.target.files && e.target.files[0]; e.target.value = ""; sendPhoto(f); } }),
          h("textarea", { value: input, onChange: function (e) { return setInput(e.target.value); }, rows: 1, placeholder: "写在这张课页上…", style: { flex: 1, resize: "none", fontFamily: F_BODY, fontSize: 14, color: STUDY_SKIN.ink, background: STUDY_SKIN.paper2, border: "1px solid " + STUDY_SKIN.line, borderRadius: "5px 16px 16px 5px", padding: "9px 13px", maxHeight: 100 },
            onKeyDown: function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } } }),
          h("button", { onClick: send, disabled: !input.trim(), className: "shrink-0 active:opacity-70", style: { fontFamily: F_BODY, fontSize: 14, background: accent, color: STUDY_SKIN.paper, borderRadius: "5px 14px 5px 5px", padding: "9px 16px", opacity: !input.trim() ? 0.5 : 1 } }, "写下"))));
  }

  // 顶层：三板分区 + 三级导航
  //  home(tab: teach/costudy/nv1) → console(课程) / newCourse / newCostudy → thread
  function StudyApp(props) {
    const [view, setView] = useState("home");
    const [tab, setTab] = useState("teach");
    const [tick, setTick] = useState(0); // 强制从库重读
    const [openId, setOpenId] = useState(null);   // session id（thread）
    const [curId, setCurId] = useState(null);      // curriculum id（console）
    const entryHandledRef = useRef("");
    const [roomPickOpen, setRoomPickOpen] = useState(false);
    const homeScrollRef = useRef(null), homeScrollTopRef = useRef(0);
    const consoleScrollRef = useRef(null), consoleScrollTopRef = useRef(0);
    function refresh() { setTick(function (x) { return x + 1; }); }
    function rememberHome() { if (homeScrollRef.current) homeScrollTopRef.current = homeScrollRef.current.scrollTop; }
    function restoreHome() { requestAnimationFrame(function () { requestAnimationFrame(function () { if (homeScrollRef.current) homeScrollRef.current.scrollTop = homeScrollTopRef.current; }); }); }
    function rememberConsole() { if (consoleScrollRef.current) consoleScrollTopRef.current = consoleScrollRef.current.scrollTop; }
    function restoreConsole() { requestAnimationFrame(function () { requestAnimationFrame(function () { if (consoleScrollRef.current) consoleScrollRef.current.scrollTop = consoleScrollTopRef.current; }); }); }

    useEffect(function () {
      const e = props.entry;
      if (!e || !e.key || entryHandledRef.current === e.key) return;
      entryHandledRef.current = e.key;
      if (e.mode === "resume" && e.sessionId && loadSessions().some(function (s) { return String(s.id) === String(e.sessionId); })) {
        setOpenId(String(e.sessionId)); setView("thread"); return;
      }
      if (e.mode === "propose") { setTab("teach"); setView("newCurriculum"); }
      // 从房间那条「在学」横幅点进来：直接落到那门课
      if (e.mode === "course") {
        if (e.kind === "cur" && findCurriculum(e.id)) { const c = findCurriculum(e.id); setTab(c.mode || "teach"); setCurId(c.id); setView("console"); }
        else if (e.kind === "paper" && loadSessions().some(function (s) { return s.id === e.id; })) { setTab("costudy"); setOpenId(e.id); setView("thread"); }
      }
    }, [props.entry && props.entry.key]);

    function fromRoomAt(id) { const e = props.entry; return !!(e && e.mode === "course" && e.back === "thread" && String(e.id) === String(id)); }
    const sessions = loadSessions();
    const curricula = loadCurricula();

    if (view === "newCurriculum") {
      return h(NewCurriculum, {
        mode: tab, active: props.active, bgActive: props.bgActive, characters: props.characters, worldbook: props.worldbook, worldbookFor: props.worldbookFor, toast: props.toast,
        initialSubject: props.entry && props.entry.mode === "propose" ? props.entry.subject : "",
        initialCharacterId: props.entry && props.entry.mode === "propose" ? props.entry.characterId : "",
        initialRoomId: props.entry && props.entry.mode === "propose" ? (props.entry.roomId || "") : "",
        onBack: function () { setView("home"); restoreHome(); },
        onCreated: function (cur) { setCurId(cur.id); setView("console"); }, // 落到控制台，自己开第一节
        // 认真教判定不够格→用户选「改为一起研究」：建 costudy session 直接进聊天
        onCostudyInstead: function (subject, charId) {
          const chars = avatarsFor([charId], props.characters);
          const sess = {
            id: "st_" + Date.now(), curriculum_id: null, mode: "costudy",
            roomId: (props.entry && props.entry.roomId) || null,
            character_ids: [charId], teacher_id: null, subject: subject,
            title: subject + " · " + chars.map(function (c) { return c.name; }).join("&"),
            updated_at: Date.now(), progress: newProgress("costudy"), transcript: []
          };
          saveSessions(loadSessions().concat([sess]));
          setOpenId(sess.id); setView("thread");
        }
      });
    }
    if (view === "newSession") {
      const cur = curricula.find(function (c) { return c.id === curId; });
      if (!cur) { setView("home"); return null; }
      return h(NewSession, {
        curriculum: cur, active: props.active, bgActive: props.bgActive, characters: props.characters, worldbook: props.worldbook, worldbookFor: props.worldbookFor, profile: props.profile, toast: props.toast,
        onBack: function () { setView("console"); restoreConsole(); },
        onCreated: function (sess) { setOpenId(sess.id); setView("thread"); }
      });
    }
    if (view === "newCostudy") {
      return h(NewCostudy, {
        characters: props.characters, toast: props.toast,
        onBack: function () { setView("home"); restoreHome(); },
        onCreated: function (d) {
          const chars = avatarsFor([d.charId], props.characters);
          const sess = {
            id: "st_" + Date.now(), curriculum_id: null, mode: "costudy",
            roomId: (props.entry && props.entry.roomId) || null,
            character_ids: [d.charId], teacher_id: null, subject: d.subject,
            title: d.subject + " · " + chars.map(function (c) { return c.name; }).join("&"),
            updated_at: Date.now(), progress: newProgress("costudy"), transcript: []
          };
          saveSessions(loadSessions().concat([sess]));
          setOpenId(sess.id); setView("thread");
        }
      });
    }
    if (view === "console") {
      const cur = curricula.find(function (c) { return c.id === curId; });
      if (!cur) { setView("home"); return null; }
      return h(CurriculumConsole, {
        curriculum: cur, sessions: sessions, characters: props.characters,
        active: props.active, bgActive: props.bgActive, worldbook: props.worldbook, worldbookFor: props.worldbookFor,
        scrollRef: consoleScrollRef,
        onRefresh: refresh, toast: props.toast,
        // 从房里那条「在学」横幅直接落到这门课的：返回一下就回那间房，不先绕一趟一起学首页
        onBack: function () { refresh(); if (fromRoomAt(cur.id)) return props.onBack(); setView("home"); restoreHome(); },
        onOpenSession: function (id) { rememberConsole(); setOpenId(id); setView("thread"); },
        onNewSession: function (c) { rememberConsole(); setCurId(c.id); setView("newSession"); },
        onDelSession: function (id) {
          requestAppConfirm("移除这张课页？", "这张课页里的对话、题卡与学习证据会一起删除，无法恢复。", function () {
            saveSessions(loadSessions().filter(function (s) { return s.id !== id; }));
            refresh(); props.toast && props.toast("已删除课页");
          }, "移除课页");
        }
      });
    }
    if (view === "thread") {
      const sess = loadSessions().find(function (s) { return s.id === openId; });
      if (!sess) { setView("home"); return null; }
      return h(StudyThread, {
        session: sess, active: props.active, bgActive: props.bgActive, characters: props.characters, profile: props.profile, worldbook: props.worldbook, worldbookFor: props.worldbookFor, selfFor: props.selfFor, relFor: props.relFor, toast: props.toast,
        onBack: function () { refresh(); if (!sess.curriculum_id && fromRoomAt(sess.id)) return props.onBack(); setView(sess.curriculum_id ? "console" : "home"); if (sess.curriculum_id) { setCurId(sess.curriculum_id); restoreConsole(); } else restoreHome(); },
        onUpdated: function () { }
      });
    }

    // home：顶部三板 tab
    const tabs = [["teach", "认真教"], ["costudy", "一起研究"], ["nv1", "一教一学"]];
    let panel;
    if (tab === "costudy") {
      const cs = sessions.filter(function (s) { return !s.curriculum_id; })
        .sort(function (a, b) { return (b.updated_at || 0) - (a.updated_at || 0); });
      panel = h(CostudyList, {
        sessions: cs, characters: props.characters, scrollRef: homeScrollRef,
        onNew: function () { rememberHome(); setView("newCostudy"); },
        onOpen: function (id) { rememberHome(); setOpenId(id); setView("thread"); },
        onDel: function (id) {
          requestAppConfirm("删除这张研究纸？", "共同研究的全部记录会一起删除，无法恢复。", function () {
            saveSessions(loadSessions().filter(function (s) { return s.id !== id; }));
            refresh(); props.toast && props.toast("已删除研究纸");
          }, "删除研究纸");
        }
      });
    } else {
      const cs = curricula.filter(function (c) { return c.mode === tab; })
        .sort(function (a, b) { return (b.updated_at || 0) - (a.updated_at || 0); });
      panel = h(CurriculumList, {
        mode: tab, curricula: cs, sessions: sessions, characters: props.characters, scrollRef: homeScrollRef,
        onNew: function () { rememberHome(); setView("newCurriculum"); },
        onOpen: function (id) { rememberHome(); setCurId(id); setView("console"); },
        onDel: function (id) {
          const target = loadCurricula().find(function (c) { return c.id === id; });
          const count = loadSessions().filter(function (s) { return s.curriculum_id === id; }).length;
          requestAppConfirm("删除整门课程？", "「" + ((target && target.subject) || "这门课程") + "」和其中 " + count + " 张课页、复习记录都会一起删除，无法恢复。", function () {
            saveCurricula(loadCurricula().filter(function (c) { return c.id !== id; }));
            saveSessions(loadSessions().filter(function (s) { return s.curriculum_id !== id; }));
            refresh(); props.toast && props.toast("已删除课程");
          }, "删除整门课");
        }
      });
    }

    const roomPick = roomPickOpen && props.onNewRoom ? h(CenterCard, { onClose: function () { setRoomPickOpen(false); } }, h("div", { style: { padding: "18px 18px 12px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 15, color: STUDY_SKIN.ink, marginBottom: 4 } }, "和谁开一间房"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: STUDY_SKIN.sub, marginBottom: 10 } }, "一起学默认开着，别的在下一页自己拨；建好就进那间房的聊天。"),
      h("div", { style: { maxHeight: "50vh", overflowY: "auto" } }, (props.characters || []).map(function (c) {
        return h("button", { key: c.id, onClick: function () { setRoomPickOpen(false); props.onNewRoom(c.id); }, className: "w-full flex items-center gap-3 p-2 active:opacity-70", style: { textAlign: "left" } },
          h(Avatar, { character: c, size: 36, radius: 999 }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: STUDY_SKIN.ink } }, c.remark || c.name));
      })))) : null;
    return h("div", { className: "h-full flex flex-col", style: { background: STUDY_SKIN.desk } },
      h(StudyHead, { zh: "一起学", mode: tab, onBack: props.onBack,
        right: props.onNewRoom ? h("button", { onClick: function () { setRoomPickOpen(true); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: studyModeSkin(tab).accent, padding: "4px 2px" } }, "开间房") : null }),
      roomPick,
      // 三种模式是活页夹里三张分隔页：选中那张长高并直接接进下面的纸页，不是普通药丸。
      h("div", { className: "flex px-4 shrink-0", style: { gap: 5, alignItems: "flex-end", paddingTop: 7, borderBottom: "1px solid " + STUDY_SKIN.line } }, tabs.map(function (tb) {
        const on = tab === tb[0];
        const skin = studyModeSkin(tb[0]);
        return h("button", { key: tb[0], onClick: function () { setTab(tb[0]); homeScrollTopRef.current = 0; }, className: "flex-1 outline-none active:opacity-70",
          style: { minWidth: 0, minHeight: on ? 58 : 49, position: "relative", bottom: -1, marginTop: on ? 0 : 9, padding: "7px 3px 6px", fontFamily: F_BODY, fontSize: 12.5, borderRadius: "12px 12px 0 0", background: on ? STUDY_SKIN.paper : skin.soft, color: on ? STUDY_SKIN.ink : STUDY_SKIN.sub, border: "1px solid " + (on ? STUDY_SKIN.line : skin.accent + "44"), borderTop: "4px solid " + skin.accent, borderBottomColor: on ? STUDY_SKIN.paper : skin.accent + "44", boxShadow: on ? "0 -5px 12px " + STUDY_SKIN.shadow : "none", opacity: on ? 1 : .84, transform: on ? "none" : "translateY(1px)", zIndex: on ? 2 : 1 } },
          h("span", { style: { display: "block", fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".12em", color: skin.accent, marginBottom: 2 } }, skin.code), tb[1]);
      })),
      panel);
  }

  window.StudyApp = StudyApp;
})();
