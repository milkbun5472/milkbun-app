// ============================================================
// 周刊（weekly）—— 把上一周的 RP 聊天记录重新叙事化
// 5 个版块：采访版（per character：专访 in-character + 狗仔花边）
//   + 4 种媒体腔（维多利亚社交小报 / 赛博朋克数据快讯 / 民国鸳鸯蝴蝶派 / 严肃大报社论）。
// 喂进去的 log 素材不变，输出腔调随版块变（媒体腔 = world book 层）。
//
// 分层优先级（照现有架构）：
//   反八股块 ANTI_CLICHE（system 最高） > 引用角色时角色卡声纹 CHARCARD_RULE+persona
//   > 媒体腔 world book（版块声纹） > 模型默认。
//   ※ 媒体腔管叙述者声音；版块内引用角色说话时，角色卡声纹必须存活。
//
// 刷新闸门：每周日 WEEKLY_REFRESH_HOUR 起，本周（周一~周日）成为可出刊的一期；
//   每周一期，key=本报道周周一日期；叠加归档不覆盖 → 往期书架。
// 存储：x_weekly_issues（数组，最新在前），x_ 前缀自动跟随现有 saves 云同步。
// 生成：每版块一个 JSON schema，extractJSON/repairJSON 容错 + 自动重试（不动全局 callAI）。
//   每个版块 / 采访版里每个角色 = 独立可 regen 单元。
// 空周：素材不足不报错，每种腔按自己方式把「缺席」变成一条报道。
// ============================================================
(function () {
  const useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;

  // ---- 刷新闸门常量（一行可改）---------------------------------------
  // 报道周期的结束边界落在「周日半夜」(= 周一 WEEKLY_REFRESH_HOUR:00)。0 = 周日 24:00 / 周一 0 点整。
  // 只报最近一个【完整结束】的周一~周日，不把本周（刷新前）的记录带进来。
  // 想让新一期晚点放出（如周一早 6 点再解锁）就把 HOUR 改成 6。
  const WEEKLY_REFRESH_HOUR = 0;

  // ---- 存储 ----------------------------------------------------------
  const K_ISSUES = "x_weekly_issues";
  const MAX_ISSUES = 52; // 本机书架最多保留约一年，避免无界增长
  function issueStart(x) { return Number(x && x.weekOf && x.weekOf.start) || 0; }
  // 书架按报道周排，不按「哪天补做」排。这样补出的第 7 期会插回第 8 期前面。
  function orderedIssues(list) {
    return (Array.isArray(list) ? list : []).slice().sort(function (a, b) {
      return issueStart(a) - issueStart(b) || Number(a.createdAt || 0) - Number(b.createdAt || 0);
    });
  }
  // 往期只按「报道周」摆一本合订本。旧版本曾在补刊/重出时留下同周多份，
  // 它们仍保留在底层供恢复，不在这里擅自删除；书架只展示内容最完整、其次最新的一份。
  function shelfIssues(list) {
    const byWeek = new Map();
    orderedIssues(list).forEach(function (iss) {
      const key = String((iss && iss.key) || issueStart(iss) || (iss && iss.label) || (iss && iss.id));
      const old = byWeek.get(key);
      const score = function (x) { return ((x && x.sections) || []).length * 10000000000000 + Number(x && x.createdAt || 0); };
      if (!old || score(iss) >= score(old)) byWeek.set(key, iss);
    });
    return orderedIssues(Array.from(byWeek.values()));
  }
  function loadIssues() { return orderedIssues(loadJSON(K_ISSUES, [])); }
  function saveIssues(list) {
    const ordered = orderedIssues(list);
    saveJSON(K_ISSUES, ordered.slice(Math.max(0, ordered.length - MAX_ISSUES)));
  }
  function issueArticleCount(iss) {
    return ((iss && iss.sections) || []).reduce(function (n, s) {
      return n + (s.type === "interview" ? (s.entries || []).length : 1);
    }, 0);
  }
  function uid(pfx) { return (pfx || "wk") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---- 记者 NPC 人格（采访版叙述者，不碰角色卡）----------------------
  const REPORTER_VOICE =
    "你在扮演一份八卦小报的记者兼狗仔——一个 NPC 叙述者人格，不是要你去演某张角色卡。" +
    "机灵、擅长挖料、语气俏皮，会追着当事人问私事，但不下流、不低俗。";

  // 人名铁律：焊进每个生成，防止模型照抄 prompt 里的示例名字（曾经把示例「顾暮」写进赛博版）
  const NAME_GUARD =
    "\n【人名铁律 · 必须遵守】文中出现的所有人物名字，只能用【本周出场人物】里列出的那几个真实名字。" +
    "本提示中任何位置出现的示例名字、占位符、代号样例，都只是格式说明，绝对不能出现在你的输出里。写谁就用谁的真名。";

  // ---- 媒体腔（world book 层：世界观 + 声纹 + 禁止 + 缺席句）----------
  const VOICES = [
    {
      id: "victorian", name: "维多利亚社交小报", en: "THE SOCIETY PAGES",
      world:
        "设定：摄政／维多利亚时代的上流社交圈。你是这个圈子里一份匿名社交小报的笔者，把本周发生的事，当作上流社会的社交事件来报道。\n" +
        "声纹：\n① 一律用「某位不便具名的绅士／淑女」「一位年轻的先生」之类指代，绝不直呼角色本名。\n" +
        "② 把一切现代事物译成时代对应物：发消息→修书一封／递去口信，视频通话→登门造访，已读不回→迟迟未见回信，手机→随身之物。\n" +
        "③ 把暧昧升格为社交事件：「二人于周三之约，连叙两个时辰，已惊动全城」。\n" +
        "④ 语气过度体面、迂回，含蓄暗示代替直说，绵里藏针。\n" +
        "禁止：① 不得出现任何现代词或网络用语。② 不直白点破关系（「在一起了」须写成「情谊已非寻常」）。③ 不靠感叹号堆砌情绪。",
      absent: "某君本周深居简出，未见于任何社交场合，惹人揣测。"
    },
    {
      id: "cyberpunk", name: "赛博朋克数据快讯", en: "DATASTREAM",
      world:
        "设定：一座巨型企业的用户监控终端。你把本周发生的事，当作某个用户的行为数据流与情绪监控日志来输出。\n" +
        "声纹：\n① 全部小写，穿插方括号标记如 [数据泄露][已加密][阈值告警][信号丢失]，用双斜杠 // 写系统注释。\n" +
        "② 情绪翻译成数据指标：开心→多巴胺读数超基线，想念→目标对象检索频次+300%，心动→心率异常波动。\n" +
        "③ 企业式冷感，故障艺术般的断句，信息碎片化。\n" +
        "④ 角色代号化：写成「用户#<真实角色名> / 目标对象:你」这种代号（<真实角色名> 一定要换成【本周出场人物】里的真名，别照抄这里的占位符）。\n" +
        "禁止：① 不用感叹号，不写完整的抒情长句。② 不直抒温情——温情必须伪装成「数据异常／系统告警」。③ 不用旧世界的修辞和比喻。",
      absent: "[信号丢失] 本周无活跃数据流 // 最后活跃:未知 // 状态:离线"
    },
    {
      id: "republican", name: "民国鸳鸯蝴蝶派", en: "THE OLD SHANGHAI TATTLER",
      world:
        "设定：民国旧上海的一份市井小报。你用鸳鸯蝴蝶派、才子佳人的腔调，报道本周发生的事。\n" +
        "声纹：\n① 半文半白，文言与白话夹杂。\n② 用「据本报访员探得」「闻……者也」这类旧报腔行文。\n" +
        "③ 才子佳人式措辞：郎情妾意、眉目传情、红袖添香、相思成疾。\n④ 旧上海市井气与鸳蝴派的缠绵。\n" +
        "禁止：① 不用现代词与简体网络语。② 不过度直白，含蓄为上。③ 慎用西式标点，不靠感叹号堆砌。",
      absent: "某君本周杳无音讯，想是忙于俗务，佳人独守空闺，徒惹相思。"
    },
    {
      id: "editorial", name: "严肃大报社论", en: "THE EDITORIAL",
      world:
        "设定：一份权威大报的社论版。你对本周发生的琐事作「深度评论」，杀鸡偏用牛刀。\n" +
        "声纹：\n① 一本正经地把鸡毛蒜皮上升到理论高度、社会现象。\n" +
        "② 标准社论体：「本报认为」「值得深思」「这一现象折射出」「不禁令人发问」。\n" +
        "③ 冷幽默全靠反差——正文越是煞有介事、一本正经，就越好笑；作者自己绝不出戏发笑。\n" +
        "④ 用煞有介事的分析框架、引用式论证（可虚构「有学者指出」式的论证腔）。\n" +
        "禁止：① 绝不承认这是小事——哪怕只是「他发了句早安」也必须无比严肃地对待。② 不出现任何轻佻、卖萌语气。③ 不用表情符号或网络梗。",
      absent: "论亲密关系中的沉默：本周的集体缺席意味着什么"
    },
    {
      id: "naturalist", name: "自然观察笔记", en: "FIELD NOTES",
      world:
        "设定：一位博物学家在野外蹲守，把这几个人当作某种值得记录的物种来观察。\n" +
        "声纹：\n① 全程用观察笔记体：日期、天气、个体编号式的冷静记述，「该个体」「本群落」「初次记录到」。\n" +
        "② 把日常行为写成习性：发消息＝求偶展示／领地宣告，一起吃饭＝共食行为，已读不回＝典型的回避姿态。\n" +
        "③ 语气克制到近乎温柔，偶尔流露研究者对观察对象的私人偏爱，但立刻用术语收回去。\n" +
        "④ 允许对行为提出假设，并注明「尚待进一步观察」。\n" +
        "禁止：① 不用感叹号。② 不直接评价好坏，只描述与推测。③ 不写成拟人化童话，保持研究者视角。",
      absent: "本周未记录到活动迹象，疑似进入静默期"
    },
    {
      id: "noir", name: "黑色侦探档案", en: "CASE FILE",
      world:
        "设定：一个疲惫的私家侦探在结案报告里写下本周的跟踪记录。\n" +
        "声纹：\n① 第一人称、短句、硬派：时间地点先行，情绪压在陈述底下。\n" +
        "② 把每件小事都当线索处理：「值得注意的是」「这不合逻辑」「我记下了时间」。\n" +
        "③ 结尾常有一句自嘲或不了了之的判断，不给答案。\n" +
        "④ 允许描写雨、烟、廉价咖啡这类硬派意象，但每篇至多一处，不许堆。\n" +
        "禁止：① 不出现真凶／案件之类真犯罪情节，跟踪的只是这几个人的日常。② 不煽情。③ 不用网络梗。",
      absent: "本周目标毫无动静。我在车里坐了七个晚上，什么也没发生"
    },
    {
      id: "tabloid", name: "娱乐头条爆料", en: "THE SCANDAL SHEET",
      world:
        "设定：一本消息灵通、标题凶猛的都市娱乐周刊。把本周小事做成足以占据报摊头版的独家爆料。\n" +
        "声纹：\n① 标题短、狠、有悬念，导语先抛最反常的画面或后果。\n" +
        "② 记者有鲜明判断，会追问谁先动心、谁嘴硬、谁为此付了代价。\n" +
        "③ 允许夸张反差和悬念，但每个事实、引语、关系必须来自素材。\n" +
        "④ 正文像爆料而非流水账，结尾留一个下一期仍值得追踪的问题。\n" +
        "禁止：① 不捏造知情人士或匿名爆料。② 不用震惊体感叹号连发。③ 不把普通亲密写成低俗桃色新闻。",
      absent: "全员神隐七日：本刊记者扑空，沉默本身成了最大新闻"
    },
    {
      id: "markets", name: "情感市场收盘", en: "CLOSING BELL",
      world:
        "设定：财经终端的收盘简报，把关系、承诺、注意力和情绪当作一周市场走势。\n" +
        "声纹：\n① 用开盘、震荡、增持、抛售、风险敞口、流动性等财经语言解释真实互动。\n" +
        "② 每篇先报本周最关键的涨跌，再解释触发事件与潜在后市。\n" +
        "③ 冷静精确，偶尔以一本正经的方式承认市场完全不理性。\n" +
        "④ 数字只有素材真实提供时才能写，不得虚构百分比。\n" +
        "禁止：① 不给现实投资建议。② 不把人物写成真的证券代码。③ 不堆空洞术语掩盖事件。",
      absent: "本周交投清淡，主要关系指数横盘，市场等待新的明确信号"
    },
    {
      id: "tribunal", name: "关系庭审纪要", en: "THE TRIBUNAL",
      world:
        "设定：一场只审理日常关系争议的公开听证会。报道以证据、陈述、争点和裁定组织。\n" +
        "声纹：\n① 把真实消息、行动和物件当证据编号，不虚构证人。\n" +
        "② 每篇明确本案争点：谁先失约、谁口是心非、某句话究竟算不算承诺。\n" +
        "③ 允许控辩双方各自作最有利解释，最后给出幽默但有依据的临时裁定。\n" +
        "④ 语言克制、程序感强，荒诞来自小事被郑重审理。\n" +
        "禁止：① 不写犯罪、刑罚或真正司法后果。② 不篡改原话。③ 不把裁定写成人格羞辱。",
      absent: "因本周无人提交证据，合议庭宣布休庭，所有悬案顺延"
    },
    {
      id: "sportsdesk", name: "关系赛事战报", en: "THE SPORTS DESK",
      world:
        "设定：体育报的赛后复盘，把一周互动视为同一支队伍内部的攻防、配合与临场决策。\n" +
        "声纹：\n① 开头先报决定走势的关键回合，不从赛前背景慢慢讲。\n" +
        "② 分析转折点、主动权、失误、补救和默契；引用原话像赛后采访。\n" +
        "③ 节奏明快、有现场感，能夸一记漂亮配合，也敢指出一次离谱失误。\n" +
        "④ 没有输赢时就写成训练赛或拉锯战，不硬判胜负。\n" +
        "禁止：① 不虚构比分和统计。② 不把关系写成敌我战争。③ 不连续使用热血口号。",
      absent: "本周赛程空白，双方均未登场，积分榜维持原状"
    }
  ];
  function normalizeVoiceId(id) { return String(id || "").trim().toLowerCase(); }
  function knownVoice(id) {
    const key = normalizeVoiceId(id);
    return VOICES.find(function (v) { return v.id === key; }) || null;
  }
  function voiceOf(id) {
    return knownVoice(id) || { id: normalizeVoiceId(id) || "unknown", name: "未知文风", en: "UNKNOWN EDITION", world: "", absent: "" };
  }
  function mediaHasContent(sec) {
    return !!(sec && Array.isArray(sec.articles) && sec.articles.some(function (a) {
      return a && (String(a.title || "").trim() || String(a.body || "").trim());
    }));
  }
  // 文风也走整池轮抽：一轮没抽完前不重置；袋底不足 3 个时，取完袋底再开新轮补足。
  // 手动补出的媒体版 auto=false，不参与回放，所以不会消耗下一期的正常抽签池。
  function voicesForWeek(key, pastIssues, weekStart) {
    const ids = VOICES.map(function (v) { return v.id; });
    const cut = Number(weekStart) || Infinity;
    const past = (pastIssues || []).filter(function (x) { return issueStart(x) < cut; })
      .slice().sort(function (a, b) { return issueStart(a) - issueStart(b); });
    let bag = ids.slice();
    past.forEach(function (iss) {
      (iss.sections || []).filter(function (s) { return s.type === "media" && s.auto !== false; }).forEach(function (s) {
        const k = bag.indexOf(normalizeVoiceId(s.voiceId));
        if (k > -1) bag.splice(k, 1);
        if (!bag.length) bag = ids.slice();
      });
    });
    const r = seeded("voice" + key), out = [];
    while (out.length < Math.min(3, ids.length)) {
      if (!bag.length) bag = ids.filter(function (id) { return out.indexOf(id) < 0; });
      if (!bag.length) break;
      const id = bag.splice(Math.floor(r() * bag.length), 1)[0];
      if (out.indexOf(id) < 0) out.push(id);
    }
    return out.map(voiceOf);
  }

  // 采访轮换:每期至多 3 人,抽完一轮才允许重复(洗牌袋)。
  // 袋子状态不落盘,而是【由往期回放推出来】——这样重新生成某一期也不会打乱轮次。
  // 例:5 人 → 第一周 abc(袋剩 de) → 第二周 de + 补袋后再抽一个(a) → 第三周从 bcde 里抽三个 …
  function interviewPickFor(issueKey, allIds, pastIssues, weekStart) {
    const ids = (allIds || []).slice();
    if (ids.length <= 3) return ids;
    // 按时间正序回放已经出过的期,把袋子推到当前状态
    // 只回放【这一期之前】的期数:否则重新生成某一期时，后面几期也会被算进袋子，
    // 抽出来的人就跟当初不一样了（重生成不该改变历史轮次）
    const cut = Number(weekStart) || Infinity;
    const past = (pastIssues || []).filter(function (x) { return (x.weekOf && x.weekOf.start || 0) < cut; })
      .slice().sort(function (a, b) { return (a.weekOf && a.weekOf.start || 0) - (b.weekOf && b.weekOf.start || 0); });
    let bag = ids.slice();
    const drawn = function (iss) {
      const sec = (iss.sections || []).find(function (x) { return x.type === "interview"; });
      return ((sec && sec.entries) || []).filter(function (e) { return e && e.auto; }).map(function (e) { return e.charId; });
    };
    past.forEach(function (iss) {
      if (iss.key === issueKey) return;
      // 只回放【抽中的】那些。手动补生成的不算被抽过——否则手动补一次
      // 就把这个人从袋子里划掉了,下一轮反而轮不到他（她 2026-08-18 点名）
      drawn(iss).forEach(function (id) {
        const k = bag.indexOf(id);
        if (k > -1) bag.splice(k, 1);
        if (!bag.length) bag = ids.slice(); // 一轮抽完,重新装袋
      });
    });
    const r = seeded("iv" + issueKey);
    const out = [];
    while (out.length < 3 && ids.length) {
      if (!bag.length) bag = ids.filter(function (id) { return out.indexOf(id) < 0; });
      if (!bag.length) break;
      const pick = bag.splice(Math.floor(r() * bag.length), 1)[0];
      if (out.indexOf(pick) < 0) out.push(pick);
    }
    return out;
  }

  // 来信作者轮换：只让【本周真的有素材的角色】写，每期三人，整轮走完才重复。
  // Lisa 是周刊的读者/当事人，不再被模型抓来当固定第三封；往期老刊只有署名，
  // 所以回放同时兼容新字段 authorId 与旧字段 from。
  function letterPickFor(issueKey, characters, pastIssues, weekStart) {
    const chars = (characters || []).filter(function (c, i, a) {
      return c && c.id && a.findIndex(function (x) { return x && x.id === c.id; }) === i;
    });
    if (chars.length <= 3) return chars;
    const ids = chars.map(function (c) { return c.id; });
    const idByName = {};
    chars.forEach(function (c) { idByName[String(c.name || "").trim()] = c.id; });
    const cut = Number(weekStart) || Infinity;
    const past = (pastIssues || []).filter(function (x) { return issueStart(x) < cut; })
      .slice().sort(function (a, b) { return issueStart(a) - issueStart(b); });
    let bag = ids.slice();
    past.forEach(function (iss) {
      if (iss.key === issueKey) return;
      const sec = (iss.sections || []).find(function (x) { return x.type === "letters"; });
      ((sec && sec.letters) || []).filter(function (x) { return x && x.auto !== false; }).forEach(function (x) {
        const id = x.authorId || idByName[String(x.from || "").trim()];
        const k = bag.indexOf(id);
        if (k > -1) bag.splice(k, 1);
        if (!bag.length) bag = ids.slice();
      });
    });
    const r = seeded("letter" + issueKey), out = [];
    while (out.length < 3 && ids.length) {
      if (!bag.length) bag = ids.filter(function (id) { return out.indexOf(id) < 0; });
      if (!bag.length) break;
      const id = bag.splice(Math.floor(r() * bag.length), 1)[0];
      if (out.indexOf(id) < 0) out.push(id);
    }
    return out.map(function (id) { return chars.find(function (c) { return c.id === id; }); }).filter(Boolean);
  }

  function normalizeLetters(raw, authors) {
    const allowed = {};
    (authors || []).forEach(function (c) { if (c && c.id && c.name) allowed[String(c.name).trim()] = c; });
    const seen = {};
    return (Array.isArray(raw) ? raw : []).map(function (x) {
      const from = String((x && x.from) || "").trim(), c = allowed[from];
      if (!c || seen[c.id]) return null;
      seen[c.id] = true;
      return { authorId: c.id, auto: true, from: c.name, body: String((x && x.body) || "").trim(), reply: String((x && x.reply) || "").trim() };
    }).filter(function (x) { return x && x.body; }).slice(0, 3);
  }

  // ---- 报道周窗口 & 闸门 ---------------------------------------------
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function fmtRange(a, b) { return (a.getMonth() + 1) + "/" + a.getDate() + "–" + (b.getMonth() + 1) + "/" + b.getDate(); }
  // 报道窗口 = 最近一个【已完整结束】的周一~周日。
  // 边界在「周日半夜」(= 周一 WEEKLY_REFRESH_HOUR:00)：本周还没跨过这个边界就不算完整，
  // 只报上一整周（周一0点~周日24点），绝不把本周（刷新前）的记录带进来。
  function reportWindow(now) {
    now = now ? new Date(now) : new Date();
    const b = new Date(now); b.setHours(WEEKLY_REFRESH_HOUR, 0, 0, 0);
    const daysSinceMon = (b.getDay() + 6) % 7; // 周一=0 … 周日=6
    b.setDate(b.getDate() - daysSinceMon);      // 本周周一 REFRESH_HOUR
    if (b.getTime() > now.getTime()) b.setDate(b.getDate() - 7); // 还没到本周一边界 → 退到上周一
    // b = 最近一个已到达的「周一 REFRESH_HOUR」= 报道窗口的结束边界（不含 b 本身）
    const start = new Date(b); start.setDate(start.getDate() - 7);    // 报道周的周一
    const endSun = new Date(b); endSun.setDate(endSun.getDate() - 1); // 报道周的周日（label 用）
    return { start: start.getTime(), end: b.getTime() - 1, key: ymd(start), label: fmtRange(start, endSun) };
  }
  // 下一期刷新时刻 = 下一个「周日半夜」边界（= 本报道周期结束边界 + 7 天，DST 安全）
  function nextRefreshTime(now) {
    const b = new Date(reportWindow(now).end + 1); // = 报道周期结束边界（周一 REFRESH_HOUR）
    b.setDate(b.getDate() + 7);
    return b.getTime();
  }
  // 往期补刊候选：过去一年里【有真实 RP 素材、但书架上没有刊】的完整周。
  // 这里只在本地扫一遍消息时间，不调用模型；当前可出刊周仍由封面负责，不在这里重复出现。
  function missedWindows(characters, groups, issues, userName, now) {
    const current = reportWindow(now), weekKeys = {};
    const gset = loadJSON("x_groupSettings", {});
    function remember(m) {
      const ts = messageTime(m);
      if (!m || !Number.isFinite(ts) || !cleanMsg(m) || ts >= current.start) return;
      const shifted = new Date(ts);
      shifted.setHours(shifted.getHours() - WEEKLY_REFRESH_HOUR);
      const monday = new Date(shifted);
      monday.setHours(WEEKLY_REFRESH_HOUR, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      weekKeys[ymd(monday)] = monday.getTime();
    }
    (characters || []).forEach(function (c) {
      loadJSON("x_chat:" + c.id, []).forEach(remember);
    });
    (groups || []).forEach(function (g) {
      if (!(gset[g.id] && gset[g.id].memoryInterop)) return;
      loadJSON("x_gchat:" + g.id, []).forEach(remember);
    });
    const made = {};
    (issues || []).forEach(function (iss) { if (iss && iss.key) made[iss.key] = true; });
    return Object.keys(weekKeys).filter(function (key) {
      const age = current.start - weekKeys[key];
      return !made[key] && age > 0 && age <= MAX_ISSUES * 7 * 86400000;
    }).map(function (key) {
      const start = new Date(weekKeys[key]);
      const next = new Date(start); next.setDate(next.getDate() + 7);
      const endSun = new Date(next); endSun.setDate(endSun.getDate() - 1);
      return { start: start.getTime(), end: next.getTime() - 1, key: key, label: fmtRange(start, endSun) };
    }).sort(function (a, b) { return b.start - a.start; });
  }
  // 期数动态算：= 这一期的周距【最早那一期】相差几周 + 1（锚定最早一期）。
  // 删最早一期→锚点前移、后面全体递减；删中间一期→最早没变、后面数字不变、中间留空号。
  function issueNo(issue, issues) {
    if (!issue || !issue.weekOf) return "—";
    var starts = (issues || []).map(function (i) { return i && i.weekOf ? i.weekOf.start : null; }).filter(function (s) { return s != null; });
    starts.push(issue.weekOf.start);
    var minStart = Math.min.apply(null, starts);
    return Math.round((issue.weekOf.start - minStart) / (7 * 86400000)) + 1;
  }

  // ---- 素材采集：把窗口内的 RP 聊天记录抽成 per-char + global ---------
  function cleanMsg(m) {
    if (!m || m.role === "system") return null;
    if (isOocMsg(m)) return null; // OOC 幕后对话不是 RP 素材（v48.13）
    if (m.kind && ["system", "callinvite", "location", "emote"].indexOf(m.kind) >= 0) return null;
    let c = (m.content || "").trim();
    if (!c) return null;
    if (m.kind === "voice") c = "（语音）" + c;
    return c;
  }
  // 历史消息大多用毫秒时间戳；云账本/旧备份也可能留下 ISO 字符串或 created_at。
  // 周刊若直接拿字符串和数字比较，会把真实聊过的整段静默漏掉。
  function messageTime(m) {
    if (m == null) return NaN;
    const raw = typeof m === "object"
      ? (m.ts != null ? m.ts : (m.createdAt != null ? m.createdAt : (m.created_at != null ? m.created_at :
        (m.occurredAt != null ? m.occurredAt : (m.occurred_at != null ? m.occurred_at : m.timestamp)))))
      : m;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
    if (typeof raw === "string" && /^\d+(?:\.\d+)?$/.test(raw.trim())) {
      const n = Number(raw); return Number.isFinite(n) ? n : NaN;
    }
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  function inWin(ts, win) { const t = messageTime(ts); return Number.isFinite(t) && t >= win.start && t <= win.end; }
  // 返回 { perChar:{charId:[{ts,line}]}, global:[{ts,line}] }
  function weekMaterial(win, characters, groups, userName) {
    const uName = userName || "我";
    const perChar = {}, global = [];
    const gset = loadJSON("x_groupSettings", {}); // 群设置：判断哪些群是封闭空间（未开记忆互通）
    const pushPC = function (id, ts, line) { (perChar[id] = perChar[id] || []).push({ ts: ts, line: line }); };
    (characters || []).forEach(function (c) {
      loadJSON("x_chat:" + c.id, []).forEach(function (m) {
        if (!inWin(m, win)) return;
        const txt = cleanMsg(m); if (!txt) return;
        const ts = messageTime(m);
        const who = m.role === "user" ? uName : c.name;
        const line = who + "：" + txt;
        pushPC(c.id, ts, line);       // 单聊两边都算这个角色的素材（含上下文）
        global.push({ ts: ts, line: line });
      });
      // 侧房是独立的 x_chat:<person>::room::<roomId> 时间线。以前周刊只扫主房，
      // 所以明明在「日常侧房 / 专注房」聊过，专访仍会误判成这周没见面。
      // 只收允许给主房留交接的房间；隔离房仍严格留在本房，不向周刊外流。
      if (typeof window !== "undefined" && window.ChatRooms && typeof window.ChatRooms.list === "function" && typeof window.ChatRooms.chatKey === "function") {
        window.ChatRooms.list(c.id).filter(function (room) {
          return room && !room.main && room.writeback && room.writeback.mainSummary;
        }).forEach(function (room) {
          loadJSON("x_chat:" + window.ChatRooms.chatKey(c.id, room.id), []).forEach(function (m) {
            if (!inWin(m, win)) return;
            const txt = cleanMsg(m); if (!txt) return;
            const ts = messageTime(m);
            const who = m.role === "user" ? uName : c.name;
            const line = "【侧房·" + (room.name || "未命名") + "】" + who + "：" + txt;
            pushPC(c.id, ts, line);
            global.push({ ts: ts, line: line });
          });
        });
      }
    });
    (groups || []).forEach(function (g) {
      // 封闭群（未开记忆互通）＝记忆不进也不出，绝不喂进周刊的任何版块（她点名）
      if (!(gset[g.id] && gset[g.id].memoryInterop)) return;
      const participantIds = (g.memberIds || []).map(String).filter(function (id) {
        return (characters || []).some(function (c) { return String(c.id) === id; });
      });
      loadJSON("x_gchat:" + g.id, []).forEach(function (m) {
        if (!inWin(m, win)) return;
        const txt = cleanMsg(m); if (!txt) return;
        const ts = messageTime(m);
        let who;
        if (m.role === "user") who = uName;
        else if (m.role === "narration") who = "旁白";
        else who = m.senderName || "某人";
        const line = "【" + g.name + "】" + who + "：" + txt;
        global.push({ ts: ts, line: line });
        // 专访需要的是「这个人在场的完整一段对话」，不是只摘 TA 自己的台词。
        // 否则 Lisa 在群里明明和 TA 说过话，perChar 仍只剩零碎回答，模型就会误判没聊。
        participantIds.forEach(function (id) { pushPC(id, ts, line); });
      });
    });
    global.sort(function (a, b) { return a.ts - b.ts; });
    Object.keys(perChar).forEach(function (k) { perChar[k].sort(function (a, b) { return a.ts - b.ts; }); });
    return { perChar: perChar, global: global };
  }
  // ---- 数据版：全部在本地算，模型只负责写标题和点评，一个数字都不许改 ----
  const STOP2 = ["什么", "这样", "那样", "没有", "可以", "我们", "你们", "他们", "自己", "一个", "一下", "怎么", "知道", "现在", "时候", "因为", "所以", "但是", "如果", "还是", "就是", "不是", "这个", "那个", "已经"];
  function weeklyStats(mat, characters, uName) {
    const rows = (mat && mat.global) || [];
    const byWho = {}, hours = new Array(24).fill(0);
    let total = 0, longest = null;
    const gram = {};
    rows.forEach(function (r) {
      const line = String(r.line || "");
      const i = line.indexOf("：");
      if (i < 1) return;
      const who = line.slice(0, i).replace(/^【[^】]*】/, "").trim();
      const txt = line.slice(i + 1).trim();
      if (!who || !txt) return;
      total++;
      byWho[who] = (byWho[who] || 0) + 1;
      hours[new Date(r.ts).getHours()]++;
      if (!longest || txt.length > longest.len) longest = { who: who, len: txt.length, text: txt.slice(0, 40) };
      const pure = txt.replace(/[^\u4e00-\u9fa5]/g, "");
      for (let k = 0; k + 2 <= pure.length; k++) { const g = pure.slice(k, k + 2); if (STOP2.indexOf(g) < 0) gram[g] = (gram[g] || 0) + 1; }
    });
    const talkers = Object.keys(byWho).map(function (k) { return { who: k, n: byWho[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 4);
    const topWords = Object.keys(gram).map(function (k) { return { w: k, n: gram[k] }; })
      .filter(function (x) { return x.n >= 3; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
    const night = hours.slice(0, 5).reduce(function (a, b) { return a + b; }, 0);
    let peak = 0; hours.forEach(function (n, i) { if (n > hours[peak]) peak = i; });
    return { total: total, talkers: talkers, topWords: topWords, night: night, peakHour: peak, longest: longest };
  }
  // ---- 素材分块：给每段事件一个编号，供各版面「认领」 ----------------
  // 只做事件标签查重是软的——模型看得见整周素材，还是会被最扎眼的那件事吸过去。
  // 把整周切成带编号的【素材块】之后，一个块被哪个版认领了，后面的版就看不到它，
  // 没看见同一批原话，就写不出同一件事（她 2026-08-19 提的做法）。
  const BLOCK_IDS = "ABCDEFGHIJKL".split("");
  const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  function weekBlocks(global) {
    const rows = (global || []).filter(function (x) { return x && x.line; });
    if (!rows.length) return [];
    // 先按天分：RP 聊天天然以天为单位成段
    let blocks = [];
    let cur = null;
    rows.forEach(function (r) {
      const d = new Date(r.ts), key = ymd(d);
      if (!cur || cur.key !== key) {
        cur = { key: key, label: (d.getMonth() + 1) + "/" + d.getDate() + " " + WD[d.getDay()], rows: [] };
        blocks.push(cur);
      }
      cur.rows.push(r);
    });
    // 天数太少（比如只聊了一两天）就把最大的那块按【最长的一段静默】再切开，
    // 免得一整天被当成一件事，三个版面又只能抢它。
    for (let guard = 0; blocks.length < 4 && guard < 8; guard++) {
      let big = 0;
      blocks.forEach(function (b, i) { if (b.rows.length > blocks[big].rows.length) big = i; });
      const t = blocks[big];
      if (!t || t.rows.length < 8) break;
      let at = -1, gap = -1;
      for (let i = 3; i <= t.rows.length - 3; i++) {
        const g = t.rows[i].ts - t.rows[i - 1].ts;
        if (g > gap) { gap = g; at = i; }
      }
      if (at < 0) break;
      blocks = blocks.slice(0, big).concat([
        { key: t.key, label: t.label + "·前半", rows: t.rows.slice(0, at) },
        { key: t.key, label: t.label + "·后半", rows: t.rows.slice(at) }
      ], blocks.slice(big + 1));
    }
    return blocks.slice(0, BLOCK_IDS.length).map(function (b, i) {
      return { id: BLOCK_IDS[i], label: b.label, n: b.rows.length,
        text: b.rows.map(function (r) { return r.line; }).join("\n") };
    });
  }
  // 分块渲染：预算按块平摊，别让第一块把额度吃光、后面几块只剩标题
  function blocksToText(blocks, maxChars) {
    const list = blocks || [];
    if (!list.length) return "";
    const per = Math.max(300, Math.floor((maxChars || 8000) / list.length));
    return list.map(function (b) {
      const body = b.text.length > per ? "……（略去较早部分）\n" + b.text.slice(b.text.length - per) : b.text;
      return "【素材块 " + b.id + "｜" + b.label + "】\n" + body;
    }).join("\n\n");
  }
  function linesToText(list, maxChars) {
    let s = (list || []).map(function (x) { return x.line; }).join("\n");
    if (maxChars && s.length > maxChars) s = "……（略去较早部分）\n" + s.slice(s.length - maxChars); // 留最近的尾部
    return s;
  }

  // ---- 生成：一次 callAI + extractJSON，外层重试 ----------------------
  async function genJSON(active, sys, userContent, maxTokens) {
    const raw = await callAI(active, sys, [{ role: "user", content: userContent }], { maxTokens: maxTokens });
    return extractJSON(raw);
  }

  // 采访版（per character）：专访 in-character Q&A + 狗仔花边
  // 从这周素材里抽出【这个角色本人说的话】：素材行形如「名字：内容」，取本人那些
  function ownVoiceLines(material, name) {
    const pre = String(name || "") + "：";
    return String(material || "").split("\n")
      .filter(function (l) { return l.indexOf(pre) === 0 || l.indexOf("】" + pre) > -1; })
      .map(function (l) { return l.slice(l.lastIndexOf(pre) + pre.length).trim(); })
      .filter(function (x) { return x.length >= 4 && x.length <= 60; })
      .slice(-10);
  }
  async function genInterview(active, char, material, userName, reportLabel) {
    const ownLines = ownVoiceLines(material, char.name);
    const uName = userName || "我";
    const persona = (char.persona || "（暂无设定，据名字合理发挥其性格）").trim();
    const materialCount = String(material || "").split("\n").filter(function (x) { return x.trim(); }).length;
    const sys =
      ANTI_CLICHE +
      "\n\n" + CHARCARD_RULE +
      "\n\n【叙述者人格 · 记者（NPC，非角色卡）】" + REPORTER_VOICE +
      "\n\n【被采访角色 · 严格贴合这份角色卡声纹】「" + char.name + "」：\n" + persona +
      // 素材里本来就有他这周说过的原话，但以「记录」身份进去权重不够；单拎出来当声纹样本，
      // 和日记那边同一个做法（日记有、周刊一直没有，2026-08-18 补齐）
      (ownLines.length ? "\n\n【" + char.name + " 本周真实说过的话 · 声纹最高优先】\n" + ownLines.map(function (x, k) { return (k + 1) + ". " + x; }).join("\n") +
        "\n这些是他本人的原话，用来校准词汇、句长、断句、口癖、攻击性与礼貌度。回答里不要整句照抄，但语感必须是同一个人；遮住名字也该认得出。" : "") +
      "\n【本周出场人物（人名铁律用）】" + char.name + "、" + uName + NAME_GUARD +
      "\n\n【本期报道窗口】" + (reportLabel || "上一完整周") + "。这里只描述本期采编取材范围，不等于角色最近一次聊天的日期。\n" +
      "【机械核验，不得推翻】本期采集器为 " + char.name + " 收录了 " + materialCount + " 条上下文。" +
      (materialCount ? "这明确表示本期窗口内有真实互动；禁止写成没聊天、久未联系、被冷落或关系变淡。\n" : "本期确实没有可引用片段，但也不能据此推断现实中的最近联系状态。\n") +
      "【本期收录到的 " + char.name + " 真实记录】\n" +
      (material && material.trim() ? material : "（本期报道窗口没有收录到可引用片段。这只表示本期缺稿；绝不等于最近没聊天、没人理他、关系变淡或久未联系。）") +
      "\n\n【任务 · 产出两块】\n" +
      "① 专访：你作为一个真的想问出东西的记者，就本周记录做一段 4~6 轮 Q&A。采访必须像现场交锋，不是拿现成答案倒推一道送分题。\n" +
      "· 采访主题优先属于 " + char.name + " 自己：这一周的生活、工作/学业、兴趣、观察、烦恼、选择或怪念头。只有素材本身真的涉及关系时才可顺带追问，整篇绝不能默认围绕他和 " + uName + " 的关系。\n" +
      "· 有记录时，先找记录里尚有解释空间的矛盾、代价或动机再发问；问题只给必要背景，不许把答案、结论或角色原话先塞进题干。\n" +
      "· 没有记录时，做一篇不依赖具体事件的人物近况访谈：从角色自己的生活与兴趣切入。不得声称他这周没和 " + uName + " 聊、被冷落、感情淡了，也不得编造具体发生过的事。\n" +
      "· 问题要有递进：开场切入 → 追到一个具体关节 → 根据上一答追问或质疑。至少一问让对方不太好答；至少一问必须真正承接上一答，不能彼此独立。\n" +
      "· 记者可以判断错。" + char.name + " 可以纠正前提、回避、反问、拆台或拒答，不必配合记者把预设答案说完整。\n" +
      "· " + char.name + " 必须 IN CHARACTER 回答——语气／态度／软肋／口癖严格贴合角色卡；回答先像人在现场说话，再考虑信息完整，绝不滑成标准好人腔、客服腔或总结稿。\n" +
      "· 每条回答可另附一个镜头确实看得到的神态或小动作（action）；没有就留空，别用动作替答案做情绪注解。\n" +
      "② 狗仔：同一个你，写一段花边小道消息，只报 " + char.name + " 本周的戏。全程「据悉／知情人士向本刊透露／本刊直击」式无实锤爆料，暧昧、留白、点到为止，不给实锤。\n" +
      "【输出】只输出一个 JSON，不要代码块、不要多余文字：\n" +
      '{"interview":{"qa":[{"q":"记者的问题","a":"' + char.name + ' 的口头回答（in character）","action":"（可选）回答时的神态/小动作一句，没有就空字符串"}]},"paparazzi":{"title":"花边标题","body":"狗仔正文一段"}}';
    for (let i = 0; i < 2; i++) {
      try {
        const d = await genJSON(active, sys + (i ? "\n\n（上次输出解析失败，请严格只输出合法 JSON。）" : ""), "开始采访并写花边。", 6000);
        if (d && d.interview && Array.isArray(d.interview.qa)) {
          const qa = d.interview.qa.filter(function (x) { return x && (x.q || x.a); })
            .map(function (x) { return { q: String(x.q || "").trim(), a: String(x.a || "").trim(), action: String(x.action || "").trim() }; });
          const pap = d.paparazzi || {};
          return { interview: { qa: qa }, paparazzi: { title: String(pap.title || "").trim(), body: String(pap.body || "").trim() } };
        }
      } catch (e) { if (i) throw e; }
    }
    throw new Error("「" + char.name + "」采访生成失败，可单独重刷");
  }

  // 语录榜 + 数据版：一次调用出两块。语录必须逐字来自真实记录（拿回来还要在本地验一遍），
  // 数据全部本地算好后喂进去，模型只写标题与点评——数字一个都不许改。
  async function genDeskPage(active, globalText, stats, uName, personasBlock, empty, letterAuthors) {
    const letterNames = (letterAuthors || []).map(function (c) { return c.name; }).filter(Boolean);
    const statLines = [
      "本周共 " + stats.total + " 条消息",
      stats.talkers.length ? "说话最多：" + stats.talkers.map(function (x) { return x.who + " " + x.n + " 条"; }).join("、") : "",
      stats.topWords.length ? "反复出现的词：" + stats.topWords.map(function (x) { return x.w + "×" + x.n; }).join("、") : "",
      "凌晨 0-5 点的消息：" + stats.night + " 条；最热闹的时段是 " + stats.peakHour + " 点",
      stats.longest ? "最长的一条来自 " + stats.longest.who + "，" + stats.longest.len + " 字" : ""
    ].filter(Boolean);
    const sys = ANTI_CLICHE +
      "\n\n你是这份周刊的资料室编辑，负责两块小版面。" +
      "\n\n【一、本周语录】从下面的真实记录里挑 4~6 句【原样摘录】的话，要挑最有性格、最像本人、或者放在一周之后回看最有意思的。" +
      "\n· quote 必须【逐字照抄】记录里的原句，一个字都不许改写、缩写或润色；不要挑旁白，只挑人说的话。" +
      "\n· who 填说这句话的人名，必须与记录里一致。" +
      "\n· note 是编辑给这句话配的一行小注（≤20 字），可以调侃、可以点破，但不许编造记录里没有的情节。" +
      "\n· 同一个人最多两句；如果记录太少，宁可只挑两三句。" +
      "\n\n【二、数据版】下面是本刊统计好的真实数字。你的任务【只是给它们配文】：" +
      "\n· 给整版起一个杂志味的标题（≤12 字）。" +
      "\n· 每条数据配一句点评（≤22 字），把干巴巴的数字说得像杂志边栏：可以吐槽、可以下结论、可以故作严肃。" +
      "\n· **数字、人名、词全部照抄，一个都不许改、不许四舍五入、不许新增一条你自己想出来的统计。**" +
      "\n\n【本周统计】\n" + statLines.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n") +
      "\n\n【本周真实记录】\n" + String(globalText || "").slice(-6000) +
      "\n\n【三、更正启事】写 1 条本刊对【上一期】的更正(≤40 字):煞有介事地纠正一个无关痛痒的小错——写错了谁的表情、把某人喝的东西写反了、标题多打一个字。" +
      "上一期的具体内容你并不知道,所以只许纠正这种鸡毛蒜皮,不许纠正剧情事实。没什么可更正就留空字符串。" +
      "\n\n【四、分类广告】写 2~3 条极短的分类广告/寻物启事(每条≤26 字),必须由本周真实发生过的事引出:丢了的东西、想换掉的习惯、招人一起做的事。" +
      "写成报纸中缝那种一句话广告,不解释、不署名、允许荒诞,但引子必须真。" +
      "\n\n【五、读者来信】写 " + letterNames.length + " 封彼此独立的短信(每封 40~90 字)。本期作者固定为：「" + letterNames.join("」「") + "」。" +
      "\n· 只能由上面这些角色署名，每人恰好一封；用户「" + uName + "」不是写信人，绝不能替用户写信。" +
      "\n· 必须是【这个人自己的立场和口气】:他在意什么、替谁说话、嘴硬还是直说,全照他的人设与本周表现。" +
      "\n· 每封信都是单独投给编辑部的，写信人看不到另外几封。不得回复、接续、纠正、引用或点评另一封信；不许拼成一问一答的连续对话。" +
      "\n· 可以替自己辩解、跑题或阴阳怪气，但对象必须来自本周真实事件，不许写成千篇一律的读后感。" +
      "\n· 编者按(reply)至多给一封,≤18 字,其余留空。" +
      (empty ? "\n· 本周素材极少:那就写成抱怨没什么可写、或纯粹跑题的闲话,不要硬编剧情。" : "") +
      "\n\n【写信人声纹】\n" + String(personasBlock || "") +
      "\n\n【输出】只输出一个 JSON，不要代码块：\n" +
      '{"quotes":[{"who":"人名","text":"逐字原句","note":"一行小注"}],"desk":{"title":"数据版标题","notes":["对应第1条的点评","对应第2条的点评"]},"correction":"更正启事或空字符串","ads":["分类广告一","分类广告二"],"letters":[{"from":"署名","body":"信的正文","reply":"编者按或空字符串"}]}';
    const d = await genJSON(active, sys, "开始整理语录与数据版。", 3000);
    const raw = (d && Array.isArray(d.quotes)) ? d.quotes : [];
    // 逐字验真：模型很爱顺手把原话「修顺」，改过的一律丢掉，不将就
    const hay = String(globalText || "");
    const quotes = raw.map(function (q) {
      return { who: String((q && q.who) || "").trim(), text: String((q && q.text) || "").trim(), note: String((q && q.note) || "").trim() };
    }).filter(function (q) { return q.text && q.text.length >= 2 && hay.indexOf(q.text) > -1; }).slice(0, 6);
    const desk = (d && d.desk) || {};
    const notes = Array.isArray(desk.notes) ? desk.notes.map(function (x) { return String(x || "").trim(); }) : [];
    const ads = (d && Array.isArray(d.ads) ? d.ads : []).map(function (x) { return String(x || "").trim(); }).filter(Boolean).slice(0, 3);
    const letters = normalizeLetters(d && d.letters, letterAuthors);
    return { quotes: quotes, correction: String((d && d.correction) || "").trim(), ads: ads, letters: letters,
      desk: { title: String(desk.title || "本周数据").trim(), rows: statLines.map(function (line, i) { return { line: line, note: notes[i] || "" }; }) } };
  }

  // 读者来信：让角色互相对本周的事发言。四个媒体腔换的是口音，这里换的是【立场】，
  // 同一件事在不同人嘴里长得不一样，这才是真正的多视角。
  async function genLetters(active, personasBlock, globalText, uName, empty, letterAuthors) {
    const letterNames = (letterAuthors || []).map(function (c) { return c.name; }).filter(Boolean);
    const sys = ANTI_CLICHE + "\n\n" + CHARCARD_RULE +
      "\n\n你是周刊「读者来信」版的编辑。本周有几位读者写信来谈论刊登过的事——他们本人就是当事人或旁观者。" +
      "\n\n【写信人声纹（严格贴合，各写各的）】\n" + personasBlock +
      "\n\n【本周真实发生的事（只能就这里的事写，不许编新情节）】\n" + String(globalText || "").slice(-5000) +
      (empty ? "\n\n【空周处理】本周几乎没有素材：那就写成抱怨没什么可写、或纯粹跑题的闲话，不要硬编剧情。" : "") +
      "\n\n【任务】写 " + letterNames.length + " 封彼此独立的短信，每封 40~90 字。本期作者固定为：「" + letterNames.join("」「") + "」：" +
      "\n· 只能由上面这些角色署名，每人恰好一封；用户「" + uName + "」不是写信人，绝不能替用户写信。" +
      "\n· 信里必须是【这个人自己的立场和口气】：他在意的点、他会替谁说话、他嘴硬还是直说，全照他的人设与本周表现。" +
      "\n· 每封信都是单独投给编辑部的，彼此看不见。不得回复、接续、纠正、引用或点评另一封信，不得组成一问一答。" +
      "\n· 可以替自己辩解、跑题或阴阳怪气，但只能针对本周真实事件。" +
      "\n· 不许写成千篇一律的读后感，也不许几封都在夸同一件事。" +
      "\n· 编辑可以给其中至多一封加一句极短的编者按（reply，≤18 字），其余留空。" +
      "\n\n【输出】只输出一个 JSON，不要代码块：\n" +
      '{"letters":[{"from":"署名","body":"信的正文","reply":"编者按或空字符串"}]}';
    const d = await genJSON(active, sys, "开始整理本周来信。", 2600);
    return normalizeLetters(d && d.letters, letterAuthors);
  }

  // 媒体腔版块：把整周素材用某种腔重新叙事化，一版出 3~4 篇独立小报
  // 同一件事的归一化标签：跨版面查重用。去空白与常见标点，只比"骨架"。
  function eventKey(x) { return String(x || "").replace(/[\s·、，,。.:：;；!！?？"'「」『』（）()《》〈〉\-—_~～]/g, "").toLowerCase(); }
  // 本周素材里最扎眼的那件事，每个版面都会不约而同挑它——所以要明确把已被别的版
  // 占掉的事列出来禁掉，否则换的只是腔调，事件永远是同一件（她 2026-08-19 报）。
  function avoidBlock(avoid) {
    const list = (avoid || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
    if (!list.length) return "";
    return "\n\n【这些事已经被本期别的版面报道了 · 一件都不许再写】\n" +
      list.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n") +
      "\n换个说法、换个角度、只换主角都算重复。本周素材里还有别的事，去挑别人没挑的；实在挑不出，宁可写更小的事，也不许和上面撞。";
  }
  async function genMedia(active, voice, personasBlock, material, empty, avoid, opts) {
    // 单版重刷/补洞时，被别的版认领过的素材块【直接不喂给它】——看不见就写不出来，
    // 比"告诉它别写"硬得多。剩下的块不够了才退回全量素材 + 文字避让。
    const o = opts || {};
    const free = (o.blocks || []).filter(function (b) { return (o.usedBlocks || []).indexOf(b.id) < 0; });
    if (free.length) material = blocksToText(free, 8000);
    const sys =
      ANTI_CLICHE +
      "\n\n【媒体腔 · " + voice.name + "（本版块叙述者的世界观与声纹，是最高创作框架，全程严格遵守）】\n" + voice.world +
      "\n\n" + CHARCARD_RULE +
      "\n【本周出场人物（当你在报道里引用他们说话或反应时，必须守住各自这份声纹，别被媒体腔同化成同一个调子）】\n" + personasBlock + NAME_GUARD +
      "\n\n【本周 RP 聊天记录（把这些真实发生过的事，用上面的媒体腔重新叙事化、报道出来；不得虚构没发生的事）】\n" +
      (empty ? "（本周素材几乎为空。）" : material) +
      (empty ? "\n\n【空周处理】本周几乎没有素材。不要报错、也不要硬编剧情。请按你这种腔调，把「无人可报／集体缺席」本身写成一两篇像模像样的报道。参考方向：" + voice.absent : "") +
      avoidBlock(avoid) +
      (free.length && free.length < (o.blocks || []).length
        ? "\n\n【注意】上面只给了本周素材的一部分——别的版面已经认领走了其余几块，那些事不归你报，也不必惦记。就用眼前这些写。"
        : "") +
      "\n\n【任务】用这种媒体腔写 3~4 篇【各自独立】的小报文章：\n" +
      "· 每篇聚焦本周【不同的一件小事 / 不同的人或一对关系】，各有各的标题，别几篇写同一个人、也别写成一篇长文。\n" +
      "· 【不必覆盖每个角色】：只挑本周你这个腔调觉得最有戏、最好玩的几件小事来报，冷落谁都行，宁缺毋滥。\n" +
      "· 出场人物清单只是声纹参考，【别按它的顺序】决定先写谁——打乱来，谁最有料谁上，别老让同一个人当头条。\n" +
      "· 这不是聊天摘要。每篇先确定一个鲜明的【报道角度】：冲突、反差、失控的一刻、意外后果、谁付了代价，五选一；标题和导语都围绕它打。\n" +
      "· 标题必须具体、短促、有判断，像真的会让人停下来翻页；禁止「本周动态／关于某事／某某的一天」式档案标题。首段把最炸的画面、矛盾或后果放在第一句，别从时间线起点平铺。\n" +
      "· 可以像新闻、小报或专栏那样放大反差、制造悬念、下带立场的判断；但【夸张的是措辞与角度，不是事实】。不得捏造新事件、假引语、伤亡、身份或关系。\n" +
      "· 正文必须回答「为什么这件小事值得刊登」；少复述过程，多写它暴露了什么、改变了什么、接下来最可能惹出什么麻烦。\n" +
      "【输出】只输出一个 JSON，不要代码块、不要多余文字：\n" +
      "· 每篇另给一个 event 字段：用【不带腔调的大白话】一句话说清这篇报的是哪件事（如「早餐做了两份吐司起了争执」）。它不出现在页面上，只用来保证各版面报的不是同一件事。\n" +
      (free.length ? "· 每篇再填一个 block 字段＝取材自哪个素材块的编号（如 \"C\"）。\n" : "") +
      '{"articles":[{"block":"素材块编号","event":"大白话说清这篇报的是哪件事","title":"这篇的标题","body":"这篇正文（严格遵守上面的声纹与禁止项；只用该腔调，别串味）"},{"block":"","event":"第二件事","title":"第二篇标题","body":"第二篇正文"}]}';
    for (let i = 0; i < 2; i++) {
      try {
        const d = await genJSON(active, sys + (i ? "\n\n（上次解析失败，请严格只输出合法 JSON。）" : ""), "写本版 3~4 篇小报。", 7000);
        const arr = d && Array.isArray(d.articles) ? d.articles : (d && (d.title || d.body) ? [d] : null);
        if (arr && arr.length) {
          const out = arr.filter(function (a) { return a && (a.title || a.body); })
            .map(function (a) { return { title: String(a.title || voice.name).trim(), body: String(a.body || "").trim(), event: String(a.event || "").trim(), block: String(a.block || "").trim().toUpperCase().slice(0, 1) }; });
          if (out.length) return out;
        }
      } catch (e) { if (i) throw e; }
    }
    throw new Error(voice.name + " 生成失败，可单独重刷");
  }

  // 当期抽中的媒体腔共享同一份周素材：正常路径一次批量生成；整批失败或缺版时，
  // 只对缺失项调用原来的 genMedia 单项补洞，保留隔离声纹与可重试性。
  async function genMediaBatch(active, voices, personasBlock, material, empty, blocks, issueKey) {
    // 选材顺序按期轮换：否则同一个版面永远第一个挑，永远拿走"最有戏"的那块（她 2026-08-19 提）
    const order = pickOrder(voices, issueKey);
    const specs = order.map(function (v) {
      return "【" + v.id + "｜" + v.name + "】\n" + v.world + (empty ? "\n空周写法：" + v.absent : "");
    }).join("\n\n");
    const useBlocks = (blocks || []).length >= 2;
    const sys = ANTI_CLICHE + "\n\n你是周刊里几个彼此隔离的媒体编辑部。每个版块只能使用自己的世界观和声纹，绝不串味。\n\n" + specs +
      "\n\n" + CHARCARD_RULE + "\n【本周出场人物】\n" + personasBlock + NAME_GUARD +
      "\n\n【本周 RP 聊天记录" + (useBlocks ? "（已切成带编号的素材块）" : "") + "】\n" + (empty ? "（本周素材几乎为空。）" : material) +
      (useBlocks ? "\n\n【本期选材顺序 · 先挑先得】\n" +
        order.map(function (v, i) { return (i + 1) + ". " + v.name; }).join("\n") +
        "\n按这个顺序挑：排在前面的先挑走它要报的【素材块】，轮到后面的时候，被挑走的块【就当它不存在】，" +
        "不许再从里面取事、取人、取原话，也不许换个角度重讲。\n" +
        "**一个素材块只归一个版面。** 块数不够分时，宁可让某个版少写一篇、或去挑块里更边角的小事，也绝不许两个版共用一块。\n" +
        "每篇文章都要填 block 字段＝它取材自哪一块（只填一个编号，如 \"C\"）。" : "") +
      // 一次调用同时写所有版面，是【唯一能真正做到互不撞车】的时机——模型此刻同时看得见
      // 所有版面。以前没说这句，于是每个版都各自去挑本周最扎眼的那件事，换的只是腔调，
      // 事件永远是同一件（她 2026-08-19 报：几种风格生成的都是同样的事件）。
      "\n\n【最高优先 · 先分事，再写稿】\n" +
      "① 先把本周素材拆成【互不重叠的若干件事】，每件事用一句不带腔调的大白话记下来（如「早餐做了两份吐司起了争执」）。\n" +
      "② 再把这些事【分配】给各个版面：**同一件事只许给一个版面**。谁的腔调最适合报哪件，就分给谁。\n" +
      "③ 分完才动笔。换个说法、换个角度、只换主角都算同一件事，一律不许两个版都写。\n" +
      "④ 如果事情不够分：宁可让某些版少写一篇、或去挑更小更边角的事，也绝不许两个版报同一件。\n" +
      "⑤ 每篇都要带上它对应的那句大白话，填进 event 字段（不出现在页面上，只用来查重）。\n" +
      "\n每个媒体版写 3~4 篇不同小事。每篇都不是聊天摘要：先选冲突／反差／失控瞬间／意外后果／代价之一作为报道角度；标题具体短促且有判断，首句先抛最炸的画面或后果。允许在各自媒体腔里放大反差、制造悬念、下判断，但只能夸张表达，绝不捏造事实、假引语或关系。正文要说清这件小事为什么值得刊登，不要按聊天时间线平铺。只输出 JSON：{\"media\":[{\"voiceId\":\"上面列出的id之一\",\"articles\":[{\"block\":\"素材块编号\",\"event\":\"大白话说清这篇报的是哪件事\",\"title\":\"\",\"body\":\"\"}]}]}";
    const d = await genJSON(active, sys, "一次写完这些互不串味的媒体版。", 16000);
    const rows = d && Array.isArray(d.media) ? d.media : [];
    const byId = {};
    // 提示词只是要求，不是保证。代码再硬查两道：
    //   ① 素材块认领：一个块被哪个版先占，别的版引用它的文章一律丢掉；
    //   ② 事件标签查重：块内还可能拆出同一件事，再按归一化标签兜一层。
    // 宁可某版少一篇（外面会按 avoid 补写），也不让她翻两页看到同一件事。
    const takenBlocks = new Set(), takenEvents = new Set();
    // 按【选材顺序】消费，而不是按模型输出顺序——先挑先得这件事得由我们说了算
    const ordered = order.map(function (v) {
      return rows.find(function (r) { return normalizeVoiceId(r && r.voiceId) === v.id; });
    }).filter(Boolean);
    ordered.forEach(function (row) {
      const rowVoiceId = normalizeVoiceId(row && row.voiceId);
      if (!Array.isArray(row.articles)) return;
      const articles = [];
      row.articles.forEach(function (a) {
        if (!a || !(a.title || a.body)) return;
        const blk = String(a.block || "").trim().toUpperCase().slice(0, 1);
        const known = useBlocks && blocks.some(function (b) { return b.id === blk; });
        if (known && takenBlocks.has(blk)) return; // 这块已经被前面的版认领了
        const ev = String(a.event || "").trim(), k = eventKey(ev || a.title);
        if (k && takenEvents.has(k)) return;
        if (known) takenBlocks.add(blk);
        if (k) takenEvents.add(k);
        articles.push({ title: String(a.title || "").trim(), body: String(a.body || "").trim(), event: ev, block: known ? blk : "" });
      });
      if (articles.length) byId[rowVoiceId] = articles;
    });
    return byId;
  }
  // 本期的选材顺序：同一期永远一样（可重出），期与期之间轮换
  function pickOrder(voices, issueKey) {
    const list = (voices || []).slice();
    const r = seeded("order" + String(issueKey || ""));
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }
  // 一期里已经被别的版认领掉的素材块（供单版重刷/补写时整块避开）
  function claimedBlocks(sections, exceptSecId) {
    const out = [];
    (sections || []).forEach(function (s) {
      if (!s || s.type !== "media" || (exceptSecId && s.id === exceptSecId)) return;
      (s.articles || []).forEach(function (a) {
        const b = String((a && a.block) || "").trim().toUpperCase().slice(0, 1);
        if (b && out.indexOf(b) < 0) out.push(b);
      });
    });
    return out;
  }
  // 一期里已经被报道过的事（供单版重刷/补写时避开）
  function claimedEvents(sections, exceptSecId) {
    const out = [];
    (sections || []).forEach(function (s) {
      if (!s || s.type !== "media" || (exceptSecId && s.id === exceptSecId)) return;
      (s.articles || []).forEach(function (a) {
        const ev = String((a && a.event) || (a && a.title) || "").trim();
        if (ev) out.push(ev);
      });
    });
    return out;
  }

  // 首页头版：主编把整周素材做成一版封面头条（全局，最抓眼球）
  const HEADLINE_VOICE = "你是这期周刊的主编，正在写整本刊物的封面头版——最抓眼球、最勾人往里翻的一版。语气像八卦杂志封面，会吊胃口、留悬念，但不低俗。";
  async function genCover(active, personasBlock, material, empty) {
    const sys =
      ANTI_CLICHE +
      "\n\n【身份 · 周刊主编（NPC 叙述者，非角色卡）】" + HEADLINE_VOICE +
      "\n\n" + CHARCARD_RULE +
      "\n【本周出场人物（在头版里引用他们说话或反应时，守住各自这份声纹）】\n" + personasBlock + NAME_GUARD +
      "\n\n【本周 RP 聊天记录（从中挑出最有戏、最值得上头版的那件事做主头条；不得虚构没发生的事）】\n" +
      (empty ? "（本周素材几乎为空。）" : material) +
      (empty ? "\n\n【空周处理】本周几乎没有素材。不要报错。把「本周风平浪静／无事发生」本身做成一版煞有介事、故作悬念的头版。" : "") +
      "\n\n【任务 · 写这期封面头版】\n" +
      "① headline：一个 10~22 字的封面主标题。必须含具体的人／物／冲突或后果，并做出鲜明判断；像报摊上能把人拽住的大字，不许用「本周动态／某某的一天」这种概括题。可耸动、可反差、可悬念，但不得捏造事实。\n" +
      "② lead：不要从头复述聊天。第一句先抛最有冲击力的画面、反常点或后果，再用一段导语说明这为什么成了本周头条。夸张角度与措辞，不夸张事实。\n" +
      "③ highlights：3~4 条「本期看点」，每条一句、点不同角色／版块的戏，吊胃口（别用感叹号堆砌）。\n" +
      "④ editorNote：一句主编编者按，给本期定调（俏皮、暧昧或意味深长皆可）。\n" +
      "【输出】只输出一个 JSON，不要代码块、不要多余文字：\n" +
      '{"headline":"主标题","lead":"导语一段","highlights":["看点一","看点二"],"editorNote":"编者按一句"}';
    for (let i = 0; i < 2; i++) {
      try {
        const d = await genJSON(active, sys + (i ? "\n\n（上次解析失败，请严格只输出合法 JSON。）" : ""), "写本期封面头版。", 6000);
        if (d && (d.headline || d.lead)) return {
          headline: String(d.headline || "").trim(), lead: String(d.lead || "").trim(),
          highlights: (Array.isArray(d.highlights) ? d.highlights : []).map(function (x) { return String(x || "").trim(); }).filter(Boolean),
          editorNote: String(d.editorNote || "").trim()
        };
      } catch (e) { if (i) throw e; }
    }
    throw new Error("头版生成失败，可单独重刷");
  }

  // 打乱数组（不改原数组）：喂给媒体腔/头版的人物清单每版都洗一次，避免模型总按角色创建顺序把第一个角色写头一篇
  function shuffled(a) { a = (a || []).slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; } return a; }
  // 只给头版/媒体腔用：内部洗牌，避免模型总把「第一个创建的角色」写头一篇（采访版不走这里，保持 per-char）
  function personasFor(charsWithMat, userName) {
    const blocks = shuffled(charsWithMat).map(function (c) {
      return "【" + c.name + "】" + (c.persona || "（暂无设定）").trim().slice(0, 240);
    });
    blocks.push("【" + (userName || "我") + "】被报道的当事人之一（用户本人）。");
    return blocks.join("\n\n");
  }

  // 出整期：头版（全局）+ 采访版（每个有素材的角色一条，独立容错）+ 4 个媒体腔（全局）
  async function generateIssue(active, characters, groups, userName, win, issueNumber, onProgress) {
    const mat = weekMaterial(win, characters, groups, userName);
    const charsWithMat = (characters || []).filter(function (c) { return (mat.perChar[c.id] || []).length; });
    const globalText = linesToText(mat.global, 8000);
    const empty = mat.global.length === 0;
    const blocks = weekBlocks(mat.global); // 带编号的素材块：各版面轮流认领，认走的别人看不到
    const weekVoices = voicesForWeek(win.key, loadIssues(), win.start); // 每期三块，整池轮抽
    // 采访可以抽到本期没素材的人：这时采访 TA 自己的生活与兴趣，不能把编辑部缺稿
    // 误写成“最近没聊天 / 感情淡了”。有无素材只改变提问依据，不改变入选资格。
    const interviewPool = (characters || []).slice();
    const letterAuthors = letterPickFor(win.key, charsWithMat, loadIssues(), win.start);
    const total = 1 + Math.min(3, interviewPool.length) + weekVoices.length + 1; // +1 = 资料室(语录/数据/更正/中缝/来信合并为一次调用)
    let done = 0;
    const tick = function (label) { if (onProgress) onProgress(done, total, label); };

    // 头版（首页头条）——人物清单洗过再喂，别锚定创建顺序
    tick("头版头条");
    let cover;
    try {
      const cv = await genCover(active, personasFor(charsWithMat, userName), globalText, empty);
      cover = Object.assign({ id: uid("cv"), type: "cover" }, cv);
    } catch (e) {
      cover = { id: uid("cv"), type: "cover", headline: "本周风平浪静", lead: "（头版生成失败，请点右上角单独重刷。）", highlights: [], editorNote: "" };
    }
    done++;

    // 采访版
    const entries = [];
    // 全角色洗牌袋轮换；没素材者走人物近况访谈，没抽中的仍可手动补。
    const pickIds = interviewPickFor(win.key, interviewPool.map(function (c) { return c.id; }), loadIssues(), win.start);
    const picked = pickIds.map(function (id) { return interviewPool.find(function (c) { return c.id === id; }); }).filter(Boolean);
    for (const c of picked) {
      tick("采访 " + c.name);
      try {
        const iv = await genInterview(active, c, linesToText(mat.perChar[c.id] || [], 4000), userName, win.label);
        entries.push(Object.assign({ id: uid("iv"), charId: c.id, charName: c.name, auto: true }, iv));
      } catch (e) { /* 单角色硬失败就跳过，不拖垮整期 */ }
      done++;
    }
    // 媒体腔（全局，每版 3~4 篇）
    const media = [];
    let batch = {};
    try {
      batch = await genMediaBatch(active, weekVoices, personasFor(charsWithMat, userName),
        blocks.length >= 2 ? blocksToText(blocks, 8000) : globalText, empty, blocks, win.key);
    } catch (e) { batch = {}; }
    // 批量那次已经在一个上下文里把事分完了；补洞的单版调用看不见别的版，
    // 所以必须把已被占掉的事显式喂给它，否则补出来的又是最扎眼的那件。
    const taken = [], takenBlocks = [];
    Object.keys(batch).forEach(function (k) { (batch[k] || []).forEach(function (a) {
      if (!a) return;
      if (a.event || a.title) taken.push(a.event || a.title);
      if (a.block && takenBlocks.indexOf(a.block) < 0) takenBlocks.push(a.block);
    }); });
    for (const v of weekVoices) {
      tick(v.name);
      try {
        const articles = batch[v.id] || await genMedia(active, v, personasFor(charsWithMat, userName), globalText, empty, taken.slice(),
          { blocks: blocks, usedBlocks: takenBlocks.slice() });
        if (!batch[v.id]) articles.forEach(function (a) {
          if (!a) return;
          if (a.event || a.title) taken.push(a.event || a.title);
          if (a.block && takenBlocks.indexOf(a.block) < 0) takenBlocks.push(a.block);
        });
        media.push({ id: uid("md"), type: "media", voiceId: v.id, auto: true, articles: articles });
      } catch (e) {
        media.push({ id: uid("md"), type: "media", voiceId: v.id, auto: true, articles: [{ title: v.name, body: "（本版生成失败，请点进去单独重刷。）" }] });
      }
      done++;
    }
    // 资料室:语录榜(逐字摘录)+ 数据版(本地统计,模型只配文)
    tick("资料室");
    let desk = null;
    try {
      const stats = weeklyStats(mat, characters, userName);
      // 语录/数据/更正/中缝/来信共用这一次调用:它们用的都是同一份 globalText,
      // 分成两次纯属浪费。整期调用数因此是 1(头版)+N(专访)+1(媒体腔批量)+1(资料室)。
      desk = await genDeskPage(active, globalText, stats, userName, personasFor(letterAuthors, userName), empty, letterAuthors);
    } catch (e) { desk = null; }
    done++;
    const letters = (desk && desk.letters) || [];
    // 批量那次万一没给出来信,单独补一次,不让整块消失
    if (!letters.length && !empty) {
      try { const L = await genLetters(active, personasFor(letterAuthors, userName), globalText, userName, empty, letterAuthors); L.forEach(function (x) { letters.push(x); }); } catch (e) {}
    }
    tick("装订成刊");
    const sections = [cover, { id: uid("sec"), type: "interview", entries: entries }]
      .concat(desk && (desk.quotes.length || desk.desk.rows.length)
        ? [{ id: uid("sec"), type: "desk", quotes: desk.quotes, desk: desk.desk, correction: desk.correction, ads: desk.ads }] : [])
      .concat(letters.length ? [{ id: uid("sec"), type: "letters", letters: letters }] : [])
      .concat(media);
    return { id: uid("iss"), weekOf: { start: win.start, end: win.end }, key: win.key, label: win.label, issueNumber: issueNumber, sections: sections, createdAt: Date.now() };
  }

  // ============================================================
  // 出刊后台管理（她反馈：出刊必须守在界面、离开回来又得重刷）
  // 把生成挂在模块级，不随 WeeklyApp 卸载而丢：重进能看进度、完成自动落库并广播。
  // 同一周 key 去重——离开后回来再点也不会重复出刊。
  // ============================================================
  const _gen = { busy: false, key: null, prog: null, promise: null, listeners: [] };
  function _emit() { _gen.listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function genSubscribe(fn) { _gen.listeners.push(fn); return function () { _gen.listeners = _gen.listeners.filter(function (x) { return x !== fn; }); }; }
  function genState() { return { busy: _gen.busy, key: _gen.key, prog: _gen.prog }; }
  function startGenerate(opts) {
    // opts: { active, characters, groups, userName, win, toast }
    if (_gen.busy) return _gen.promise; // 后台一次只装订一本；避免本期和补刊互相覆盖进度
    _gen.busy = true; _gen.key = opts.win.key; _gen.prog = { done: 0, total: 0, label: "整理上周素材" };
    _emit();
    _gen.promise = (async function () {
      try {
        const existing = loadIssues();
        const num = existing.reduce(function (m, i) { return Math.max(m, i.issueNumber || 0); }, 0) + 1;
        const issue = await generateIssue(opts.active, opts.characters || [], opts.groups || [], opts.userName, opts.win, num,
          function (d, tot, l) { _gen.prog = { done: d, total: tot, label: l }; _emit(); });
        // 同周旧刊先剔除（重出本期=覆盖，不再留重复号）再落库
        const list = orderedIssues([issue].concat(loadIssues().filter(function (x) { return x.key !== issue.key; })));
        saveIssues(list);
        _gen.busy = false; _gen.prog = null; _gen.promise = null; _emit();
        if (opts.toast) opts.toast("第 " + issueNo(issue, list) + " 期已出刊");
        return issue;
      } catch (e) {
        _gen.busy = false; _gen.prog = null; _gen.promise = null; _emit();
        if (opts.toast) opts.toast(String((e && e.message) || e));
        return null;
      }
    })();
    return _gen.promise;
  }

  window.Weekly = {
    WEEKLY_REFRESH_HOUR: WEEKLY_REFRESH_HOUR, VOICES: VOICES, voiceOf: voiceOf,
    normalizeVoiceId: normalizeVoiceId, knownVoice: knownVoice, mediaHasContent: mediaHasContent,
    genState: genState, genSubscribe: genSubscribe, startGenerate: startGenerate,
    loadIssues: loadIssues, saveIssues: saveIssues, orderedIssues: orderedIssues, shelfIssues: shelfIssues, reportWindow: reportWindow, nextRefreshTime: nextRefreshTime, issueNo: issueNo,
    missedWindows: missedWindows,
    weekMaterial: weekMaterial, linesToText: linesToText, personasFor: personasFor,
    genCover: genCover, genInterview: genInterview, genMedia: genMedia, generateIssue: generateIssue,
    claimedEvents: claimedEvents, claimedBlocks: claimedBlocks, eventKey: eventKey,
    weekBlocks: weekBlocks, blocksToText: blocksToText, pickOrder: pickOrder,
    weeklyStats: weeklyStats, genDeskPage: genDeskPage, genLetters: genLetters, voicesForWeek: voicesForWeek, interviewPickFor: interviewPickFor,
    letterPickFor: letterPickFor, normalizeLetters: normalizeLetters
  };

  // ============================================================
  // UI
  // ============================================================
  // 每个媒体腔一套自己的视觉:同样的字排成一样的样子，那还是四篇一样的东西。
  // tint=版块主色 / rule=分隔线画法 / face=正文字体取向 / deco=版头装饰字符
  const VOICE_LOOK = {
    victorian:  { tint: "#765337", face: "serif", titleFace: "Georgia,'Songti SC',serif", bodyFace: "'Songti SC',Georgia,serif", deco: "❦", eyebrow: "letterpress", ink: "#35271d", muted: "#806e5d", paper: "#f4ead6", pale: "#e6d2b5" },
    cyberpunk:  { tint: "#55c9c0", face: "mono", titleFace: "'Archivo',ui-monospace,monospace", bodyFace: "ui-monospace,'SFMono-Regular',monospace", deco: "▮▮▯", eyebrow: "datastream", ink: "#d9fffb", muted: "#78aaa8", paper: "#101b21", pale: "#18343a" },
    republican: { tint: "#9b3f49", face: "serif", titleFace: "'STKaiti','KaiTi','Songti SC',serif", bodyFace: "'Songti SC','STKaiti',serif", deco: "❁", eyebrow: "old shanghai", ink: "#352a28", muted: "#8b746d", paper: "#f2e8d8", pale: "#e7d2c8" },
    editorial:  { tint: "#282828", face: "serif", titleFace: "'Times New Roman','Songti SC',serif", bodyFace: "'Songti SC',Georgia,serif", deco: "—", eyebrow: "editorial", ink: "#171717", muted: "#666", paper: "#f5f3ed", pale: "#dedbd2" },
    naturalist: { tint: "#47724b", face: "serif", titleFace: "Optima,'Songti SC',serif", bodyFace: "'Songti SC',Georgia,serif", deco: "✿", eyebrow: "field notes", ink: "#263d2b", muted: "#758472", paper: "#edf2e5", pale: "#d9e4d2" },
    noir:       { tint: "#c3a55d", face: "mono", titleFace: "'Courier New','Songti SC',monospace", bodyFace: "'Songti SC','Courier New',serif", deco: "▲", eyebrow: "case file", ink: "#eee9df", muted: "#aaa6a0", paper: "#202124", pale: "#343537" },
    tabloid:    { tint: "#d12f28", face: "sans", titleFace: "Impact,'Arial Black','Heiti SC',sans-serif", bodyFace: "'Heiti SC','PingFang SC',sans-serif", deco: "★", eyebrow: "exclusive", ink: "#171717", muted: "#76635b", paper: "#fff1d6", pale: "#f3d7a9" },
    markets:    { tint: "#167164", face: "mono", titleFace: "'Archivo',ui-monospace,monospace", bodyFace: "ui-monospace,'SFMono-Regular',monospace", deco: "↗", eyebrow: "closing bell", ink: "#173a34", muted: "#617e78", paper: "#e5f0e9", pale: "#cfe1d7" },
    tribunal:   { tint: "#75523a", face: "serif", titleFace: "'Songti SC',Georgia,serif", bodyFace: "'Songti SC',Georgia,serif", deco: "§", eyebrow: "hearing record", ink: "#33271f", muted: "#84766c", paper: "#eee8dd", pale: "#ddd0bd" },
    sportsdesk: { tint: "#2369a1", face: "sans", titleFace: "'Arial Narrow','Heiti SC',sans-serif", bodyFace: "'PingFang SC','Heiti SC',sans-serif", deco: "●", eyebrow: "match report", ink: "#142d43", muted: "#667d90", paper: "#e8f1f7", pale: "#caddea" }
  };
  function lookOf(id) { return VOICE_LOOK[id] || VOICE_LOOK.editorial; }
  function WeeklyMotionStyles() {
    return h("style", null,
      "@keyframes weeklyPageNext{0%{opacity:.18;transform:perspective(1100px) rotateY(7deg) translateX(22px);filter:blur(1px)}55%{opacity:.92}100%{opacity:1;transform:perspective(1100px) rotateY(0) translateX(0);filter:blur(0)}}" +
      "@keyframes weeklyPagePrev{0%{opacity:.18;transform:perspective(1100px) rotateY(-7deg) translateX(-22px);filter:blur(1px)}55%{opacity:.92}100%{opacity:1;transform:perspective(1100px) rotateY(0) translateX(0);filter:blur(0)}}" +
      ".weekly-page-stage{position:relative;min-height:100%;overflow-x:hidden}" +
      ".weekly-page-next{position:relative;transform-origin:left center;animation:weeklyPageNext .42s cubic-bezier(.2,.72,.22,1) both}" +
      ".weekly-page-prev{position:relative;transform-origin:right center;animation:weeklyPagePrev .42s cubic-bezier(.2,.72,.22,1) both}" +
      // 翻页伪元素原来画了一道 inset 阴影当"书脊"，但它的 inset:0 正好落在 px-10 的内容盒上，
      // 于是每一版正文外面都框着一道边（她 2026-08-19 圈出来要去掉）。翻页动画本身保留。

      "@media(prefers-reduced-motion:reduce){.weekly-page-next,.weekly-page-prev{animation:none!important}}"
    );
  }
  function PageTurnNav(props) {
    const t = useTheme();
    const btn = { flex: 1, minWidth: 0, padding: "11px 12px", border: "1px solid " + t.line, borderRadius: 3, color: t.ink, background: t.bg2, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.3 };
    return h("div", { style: { display: "flex", gap: 9, alignItems: "stretch", margin: "30px 0 8px", paddingTop: 14, borderTop: "1px solid " + t.line } },
      props.prev ? h("button", { onClick: props.prev.onClick, className: "active:opacity-60", style: btn },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".18em", color: t.fog, marginBottom: 4 } }, "← PREVIOUS"),
        h("div", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, props.prev.label)) : h("div", { style: { flex: 1 } }),
      props.next ? h("button", { onClick: props.next.onClick, className: "active:opacity-60", style: btn },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".18em", color: t.fog, marginBottom: 4, textAlign: "right" } }, "NEXT →"),
        h("div", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" } }, props.next.label)) : h("div", { style: { flex: 1 } }));
  }
  // 种子随机:同一期封面每次打开必须长得一样,所以不能用 Math.random
  function seeded(key) {
    let x = 0; String(key || "x").split("").forEach(function (ch) { x = (x * 31 + ch.charCodeAt(0)) >>> 0; });
    return function () { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
  }
  // 封面底只保留安静纸面。栏目颜色已经足够丰富，底纸不再抽斜纹/网格抢戏。
  const COVER_SKINS = [
    { id: "ivory", css: function (c) { return { backgroundColor: c, backgroundImage: "radial-gradient(circle at 16% 8%,rgba(255,255,255,.68),transparent 34%),radial-gradient(rgba(43,35,28,.032) .55px,transparent .7px)", backgroundSize: "auto,6px 6px" }; } },
    { id: "linen", css: function (c) { return { backgroundColor: c, backgroundImage: "linear-gradient(92deg,rgba(59,48,38,.018) 1px,transparent 1px),radial-gradient(circle at 82% 14%,rgba(255,255,255,.55),transparent 38%)", backgroundSize: "7px 100%,auto" }; } }
  ];
  const COVER_TINTS = ["#efe9dd", "#e9eae4", "#f0e6e2", "#e6ebee"];
  // 每个栏目有自己的识别色，但都压在同一组低饱和度和同一张纸上：不同，不散。
  const SECTION_BRICKS = [
    { solid: "#71384f", pale: "#eadde2", on: "#fff9f5" },
    { solid: "#3f6870", pale: "#dce7e6", on: "#f8fbf8" },
    { solid: "#93662f", pale: "#ece2d2", on: "#fffaf1" },
    { solid: "#465f7a", pale: "#dce3ea", on: "#f8fbff" },
    { solid: "#925449", pale: "#eadcd8", on: "#fff9f5" },
    { solid: "#63704d", pale: "#e1e5d9", on: "#fafcf6" },
    { solid: "#68577d", pale: "#e4dfe9", on: "#fcf9ff" }
  ];
  function coverSkin(key) {
    const r = seeded("skin" + key);
    const sk = COVER_SKINS[Math.floor(r() * COVER_SKINS.length)];
    const tint = COVER_TINTS[Math.floor(r() * COVER_TINTS.length)];
    return { skin: sk, style: sk.css(tint), sections: SECTION_BRICKS };
  }
  // Editorial 封面使用 12 栏隐形网格。模块大小不一、上下错位，但所有边缘都落在
  // 同一套网格上；这是“有秩序的不规则”，不是把标题随机撒在画布上。
  const EDITORIAL_CELLS = [
    { col: "1 / 9", row: "1 / 3", kind: "hero", align: "left" },
    { col: "10 / 13", row: "1 / 2", kind: "narrow", align: "right" },
    { col: "9 / 13", row: "2 / 4", kind: "feature", align: "right" },
    { col: "1 / 7", row: "3 / 4", kind: "wide", align: "left" },
    { col: "1 / 5", row: "4 / 6", kind: "narrow", align: "left" },
    { col: "5 / 10", row: "4 / 5", kind: "wide", align: "center" },
    { col: "9 / 13", row: "5 / 6", kind: "feature", align: "right" }
  ];
  const faceOf = function (f) { return f === "mono" ? "'Archivo',ui-monospace,monospace" : F_DISPLAY; };
  // 纸感底:两层极淡的斜向条纹 + 一层柔光，比纯色背景像纸，又不至于花
  function paperStyle(t) {
    return {
      backgroundColor: t.bg,
      backgroundImage:
        "repeating-linear-gradient(115deg, rgba(0,0,0,.014) 0 1px, transparent 1px 4px)," +
        "repeating-linear-gradient(15deg, rgba(0,0,0,.010) 0 1px, transparent 1px 7px)," +
        "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.5), transparent 60%)"
    };
  }
  const SECTION_LOOK = {
    cover: { ink: "#2f241d", muted: "#816d5d", paper: "#efe4d2", tint: "#9a4b3e", pale: "#e4cfc1" },
    desk: { ink: "#1f2a2d", muted: "#708086", paper: "#e7edeb", tint: "#41666a", pale: "#d2dfdc" },
    letters: { ink: "#382e36", muted: "#8b7485", paper: "#f2e8ee", tint: "#995d7e", pale: "#e4d4df" },
    interview: { ink: "#2b2630", muted: "#827789", paper: "#eeeaf1", tint: "#765b86", pale: "#dcd3e2" },
    contents: { ink: "#25221e", muted: "#827b70", paper: "#ece8df", tint: "#876755", pale: "#ddd4ca" }
  };
  function pageLook(sub, medias) {
    if (sub && sub.kind === "media") {
      const sec = (medias || []).find(function (s) { return s.id === sub.id; });
      return lookOf(sec && sec.voiceId);
    }
    return SECTION_LOOK[(sub && sub.kind) || "contents"] || SECTION_LOOK.contents;
  }
  function pageBackground(L) {
    return { backgroundColor: L.paper, backgroundImage: "radial-gradient(rgba(42,35,29,.028) .55px,transparent .72px),radial-gradient(circle at 82% 7%,rgba(255,255,255,.42),transparent 34%)", backgroundSize: "6px 6px,auto", color: L.ink };
  }
  // 周刊也按查手机/聊天详情的规矩使用紧凑顶栏。旧的通用 Head 会再摆一行
  // 30px 大标题，白白吞掉约四分之一屏；刊名应由版面自己说，顶栏只负责导航。
  function WeeklyHead(props) {
    const L = props.look || SECTION_LOOK.contents;
    return h("div", { className: "shrink-0 flex items-center px-2 pb-2", style: { paddingTop: safeTop(10), minHeight: 54, background: L.paper, borderBottom: "1px solid " + L.tint + "22", color: L.ink } },
      h("button", { onClick: props.onBack, className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 }, "aria-label": "返回" }, h(IArrow, { size: 19, color: L.ink })),
      h("div", { className: "flex-1 min-w-0 text-center" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, lineHeight: 1.2, color: L.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, props.zh || "周刊"),
        props.en ? h("div", { style: { marginTop: 2, fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".18em", textTransform: "uppercase", color: L.muted } }, props.en) : null),
      h("div", { style: { width: 40, minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center" } }, props.right || null));
  }
  function Masthead(props) {
    const t = useTheme();
    const hair = { height: 1, background: t.ink, opacity: .28 };
    return h("div", { style: { position: "relative", marginBottom: 20 } },
      // 双线报头:粗线压顶、发丝线收底，中间留白，是报纸报头最基本的骨架
      h("div", { style: { height: 3, background: t.ink } }),
      h("div", { style: Object.assign({ marginTop: 2 }, hair) }),
      h("div", { style: { textAlign: "center", padding: "13px 0 9px" } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 9 } },
          h("span", { style: { flex: 1, height: 1, background: t.line } }),
          h("span", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.42em", textTransform: "uppercase", fontSize: 8.5, color: t.fog, whiteSpace: "nowrap" } }, "THE WEEKLY"),
          h("span", { style: { flex: 1, height: 1, background: t.line } })),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 40, fontWeight: 400, color: t.ink, lineHeight: 1.05, letterSpacing: "0.16em", margin: "4px 0 2px", textIndent: "0.16em" } }, "周刊"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, letterSpacing: ".08em" } },
          (props.label || "") + "　·　全 本 由 本 刊 编 辑 部 编 纂")),
      h("div", { style: hair }),
      h("div", { style: Object.assign({ marginTop: 2, height: 2 }, { background: t.ink }) }),
      // 期数做成盖歪的印章，压在报头右下角
      h("div", { style: { position: "absolute", right: 2, top: 4, transform: "rotate(-7deg)", border: "1.5px solid " + t.accent, color: t.accent, borderRadius: 3, padding: "3px 7px", fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: ".14em", opacity: .82 } }, "NO." + (props.num || "—")));
  }

  function SectionRule(props) {
    const t = useTheme();
    return h("div", { className: "flex items-center gap-2", style: { margin: "22px 0 12px" } },
      h("div", { style: { flex: "0 0 auto", fontFamily: "'Archivo',sans-serif", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 9.5, color: t.fog } }, props.en || ""),
      h("div", { style: { flex: 1, height: 1, background: t.line } }),
      props.right || null);
  }
  function RegenBtn(props) {
    const t = useTheme();
    return h("button", { onClick: props.onClick, disabled: props.busy, className: "active:opacity-60", style: { fontFamily: "'Archivo',sans-serif", fontSize: 10.5, letterSpacing: "0.08em", color: props.busy ? t.line : t.accent } }, props.busy ? "重刷中…" : "重刷");
  }

  // 距下一刊倒计时（每分钟走一次）
  function Countdown(props) {
    const [now, setNow] = useState(Date.now());
    useEffect(function () { const id = setInterval(function () { setNow(Date.now()); }, 60000); return function () { clearInterval(id); }; }, []);
    const ms = Math.max(0, props.target - now);
    const d = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000), mm = Math.floor((ms % 3600000) / 60000);
    const txt = ms <= 0 ? "新一期已可刷新" : ("距下一刊 " + (d > 0 ? d + " 天 " : "") + hh + " 时 " + mm + " 分");
    const week = 7 * 86400000;
    const progress = ms <= 0 ? 1 : Math.max(0, Math.min(1, 1 - ms / week));
    const ink = props.ink || "rgba(0,0,0,.46)";
    const track = props.track || "rgba(0,0,0,.13)";
    return h("div", { style: { width: "100%", textAlign: "center", marginTop: 10 } },
      h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 8.5, color: ink } }, txt),
      h("div", { style: { height: 3, borderRadius: 999, background: track, overflow: "hidden", marginTop: 7 } },
        h("div", { style: { width: (progress * 100).toFixed(2) + "%", height: "100%", borderRadius: 999, background: props.fill || ink, transition: "width .35s ease" } })));
  }

  // Editorial 杂志封面：主次由版块占据的网格面积决定；实心色块是结构，不是贴纸装饰。
  // 阅读顺序始终是左上主头条 → 右栏 → 下方索引，不拿“艺术感”牺牲可读性。
  function CoverPage(props) {
    const t = useTheme();
    const items = props.items || [];
    const ck = coverSkin(props.issueKey);
    const r = seeded("lay" + props.issueKey);
    const laid = items.slice(0, EDITORIAL_CELLS.length).map(function (it, i) {
      const cell = EDITORIAL_CELLS[i];
      const long = String(it.title || "").length > 17;
      return { it: it, cell: cell, color: ck.sections[i % ck.sections.length], face: i === 0 || i === 3 ? F_DISPLAY : F_BODY,
        size: cell.kind === "hero" ? (long ? 28 : 34) : cell.kind === "feature" ? (long ? 18 : 21) : cell.kind === "wide" ? (long ? 17 : 20) : 16,
        weight: i === 0 ? 500 : (r() < .45 ? 600 : 400) };
    });
    // 自动抽中的栏目先占固定七块主版位；之后补采访／补文风或后台续刊的内容
    // 不能再被封面的固定网格截掉。它们进入同一期的增刊目录，沿用封面编号、
    // 栏目识别色与点击入口，并按 sections 的稳定顺序排列。
    const additions = items.slice(EDITORIAL_CELLS.length).map(function (it, i) {
      const absoluteIndex = EDITORIAL_CELLS.length + i;
      return { it: it, index: absoluteIndex, color: ck.sections[absoluteIndex % ck.sections.length] };
    });
    const sub = "rgba(35,32,25,.52)";
    const coverInk = "#232019";
    const progressTrack = "rgba(35,32,25,.14)";
    return h("div", { style: Object.assign({ position: "relative", overflow: "hidden", width: "100%", minHeight: "100vh", padding: "0 20px 40px" }, ck.style) },
      h("div", { className: "flex items-center justify-between", style: { paddingTop: safeTop(8), minHeight: 50, position: "relative", zIndex: 2 } },
        h("button", { onClick: props.onBack, className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -10 }, "aria-label": "返回" }, h(IArrow, { size: 19, color: coverInk })),
        h("div", { className: "flex items-center", style: { gap: 5 } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".24em", color: sub } }, "VOL. " + (props.num || "—")),
          h("button", { onClick: props.onTools, className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginRight: -10, color: coverInk, fontFamily: "Arial,sans-serif", fontSize: 27, fontWeight: 300, lineHeight: 1 }, "aria-label": "周刊工具" }, "+"))),
      // 不居中的刊头：大字占左八栏，刊期与倒计时做右侧编辑注脚。
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(12,minmax(0,1fr))", columnGap: 6, alignItems: "end", padding: "7px 0 16px", borderBottom: "1px solid rgba(35,32,25,.32)" } },
        h("div", { style: { gridColumn: "1 / 9" } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: ".42em", fontSize: 7.5, color: sub } }, "INDEPENDENT WEEKLY"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 50, letterSpacing: ".02em", color: coverInk, lineHeight: .94, marginTop: 6 } }, "周刊"),
          h("div", { style: { width: "54%", height: 7, background: ck.sections[0].solid, marginTop: 10 } })),
        h("div", { style: { gridColumn: "9 / 13", paddingBottom: 2, borderLeft: "1px solid " + progressTrack, paddingLeft: 9 } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".18em", color: sub } }, "ISSUE " + (props.num || "—")),
          h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.45, color: sub, marginTop: 5 } }, props.label || ""),
          h(Countdown, { target: props.target, ink: sub, track: progressTrack, fill: ck.sections[1].solid }))),
      // 七块内容落在 12 栏网格里：三块实心承重，其余用同栏目色的淡底与实体边梁咬合。
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(12,minmax(0,1fr))", gridTemplateRows: "repeat(5,104px)", columnGap: 6, rowGap: 7, marginTop: 14 } },
        laid.map(function (L, i) {
          const c = L.cell;
          const isSolid = i === 0 || i === 2 || i === 4;
          const isPale = i === 1 || i === 5;
          const titleInk = isSolid ? L.color.on : L.color.solid;
          const metaInk = isSolid ? "rgba(255,255,255,.72)" : sub;
          const beam = i === 1 ? { left: 0, right: 0, bottom: 0, height: 8 } :
            i === 3 ? { left: "36%", right: 0, bottom: 0, height: 22 } :
            i === 5 ? { left: 0, top: 0, bottom: 0, width: 9 } :
            { left: 0, bottom: 0, width: "62%", height: 11 };
          return h("button", { key: i, onClick: L.it.onOpen, className: "text-left active:opacity-60",
            style: { gridColumn: c.col, gridRow: c.row, minWidth: 0, overflow: "hidden", position: "relative", padding: isSolid ? "13px 12px" : (i === 5 ? "12px 9px 12px 18px" : "12px 10px 18px"), textAlign: c.align, background: isSolid ? L.color.solid : (isPale ? L.color.pale : "rgba(255,255,255,.22)") } },
            !isSolid ? h("span", { "aria-hidden": "true", style: Object.assign({ position: "absolute", background: L.color.solid }, beam) }) : null,
            h("div", { style: { display: "flex", alignItems: "center", justifyContent: c.align === "right" ? "flex-end" : "flex-start", gap: 6, marginBottom: 6 } },
              h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7, letterSpacing: ".16em", color: titleInk } }, String(i + 1).padStart(2, "0")),
              h("span", { style: { width: c.kind === "hero" ? 34 : 16, height: 1, background: titleInk, opacity: .65 } }),
              h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7, letterSpacing: ".2em", textTransform: "uppercase", color: metaInk } }, L.it.en)),
            h("div", { style: { position: "relative", zIndex: 1, fontFamily: L.face, fontWeight: L.weight, fontSize: L.size, lineHeight: 1.13, letterSpacing: c.kind === "hero" ? "-.02em" : 0, color: titleInk, wordBreak: "keep-all", overflowWrap: "break-word", display: "-webkit-box", WebkitLineClamp: c.kind === "hero" ? 3 : 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, L.it.title),
            L.it.meta ? h("div", { style: { position: "relative", zIndex: 1, fontFamily: F_BODY, fontSize: 9, color: metaInk, marginTop: 7, letterSpacing: ".05em", wordBreak: "keep-all" } }, L.it.meta) : null);
        })),
      additions.length ? h("section", { "data-weekly-cover-additions": "true", style: { marginTop: 22, borderTop: "1px solid " + progressTrack, paddingTop: 13 } },
        h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".22em", color: sub } }, "ADDED TO THIS ISSUE"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: sub } }, "后来刊入 · " + additions.length + " 栏")),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 } },
          additions.map(function (A, i) {
            const wide = i % 3 === 2 || additions.length === 1;
            const solid = i % 2 === 0;
            const titleInk = solid ? A.color.on : A.color.solid;
            const metaInk = solid ? "rgba(255,255,255,.72)" : sub;
            return h("button", { key: A.it.id || A.index, onClick: A.it.onOpen, className: "text-left active:opacity-60",
              style: { minWidth: 0, minHeight: wide ? 94 : 112, gridColumn: wide ? "1 / -1" : "auto", padding: wide ? "15px 16px" : "13px 12px", position: "relative", overflow: "hidden", background: solid ? A.color.solid : A.color.pale, borderBottom: solid ? "none" : "7px solid " + A.color.solid } },
              h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 9 } },
                h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7, letterSpacing: ".16em", color: titleInk } }, String(A.index + 1).padStart(2, "0")),
                h("span", { style: { width: wide ? 30 : 16, height: 1, background: titleInk, opacity: .65 } }),
                h("span", { style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Archivo',sans-serif", fontSize: 7, letterSpacing: ".16em", textTransform: "uppercase", color: metaInk } }, A.it.en || "SUPPLEMENT")),
              h("div", { style: { fontFamily: wide ? F_DISPLAY : F_BODY, fontSize: wide ? 22 : 17, fontWeight: wide ? 500 : 600, lineHeight: 1.15, color: titleInk, wordBreak: "keep-all", overflowWrap: "break-word", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, A.it.title),
              A.it.meta ? h("div", { style: { fontFamily: F_BODY, fontSize: 9, color: metaInk, marginTop: 7, letterSpacing: ".04em" } }, A.it.meta) : null);
          }))) : null,
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 15 } },
        h("div", { style: { height: 1, flex: 1, background: progressTrack } }),
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".24em", color: sub } }, "TAP A HEADLINE")));
  }

  function WeeklyToolsSheet(props) {
    const t = useTheme();
    const mode = props.mode || "menu";
    const panelTitle = mode === "voices" ? "补文风" : mode === "interviews" ? "补采访" : "本期工具";
    const L = SECTION_LOOK.contents;
    const baseButton = { width: "100%", minHeight: 116, padding: "18px 16px", background: "rgba(255,255,255,.28)", border: "1px solid " + L.tint + "45", color: L.ink, fontFamily: F_BODY, fontSize: 16, textAlign: "left", position: "relative", overflow: "hidden" };
    let body = null;
    if (mode === "voices") {
      body = h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: t.fog, marginBottom: 12 } }, "已出可直接翻阅；未抽中或旧刊半成品，可以单独补进本期。手动补版不占下期轮抽。"),
        h("div", { className: "flex flex-wrap", style: { gap: 8 } }, (props.voiceStates || []).map(function (item) {
          const v = item.voice, on = props.busyUnit === ("add_voice_" + v.id);
          const label = item.state === "ready" ? (v.name + " · 已出") : item.state === "broken" ? (on ? "修复中…" : v.name + " · 待修复") : (on ? "补版中…" : v.name + " · 未抽中");
          return h("button", { key: v.id, disabled: !!props.busyUnit && !on, onClick: function () { props.onVoice(item); }, className: "active:opacity-60",
            style: { padding: "8px 11px", borderRadius: 999, border: "1px solid " + (item.state === "broken" ? t.accent : t.line), color: item.state === "ready" ? t.sub : t.ink, fontFamily: F_BODY, fontSize: 11.5, opacity: props.busyUnit && !on ? .55 : 1 } }, label);
        })));
    } else if (mode === "interviews") {
      const missing = props.missingInterviews || [];
      body = h("div", null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: t.fog, marginBottom: 12 } }, "每期自动采访至多三人。这里可以临时补一位，补出来的不占轮次。"),
        missing.length ? h("div", { className: "flex flex-wrap", style: { gap: 8 } }, missing.map(function (c) {
          const on = props.busyUnit === ("add_" + c.id);
          return h("button", { key: c.id, disabled: !!props.busyUnit && !on, onClick: function () { props.onInterview(c); }, className: "active:opacity-60",
            style: { padding: "8px 12px", borderRadius: 999, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: 12, opacity: props.busyUnit && !on ? .55 : 1 } }, on ? "采访中…" : c.name);
        })) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "8px 0" } }, "这期已经采访过所有人了。"));
    } else {
      body = h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 } },
        h("button", { onClick: props.onShelf, className: "active:opacity-60", style: baseButton }, "往期"),
        h("button", { onClick: props.onRefresh, disabled: props.refreshBusy, className: "active:opacity-60", style: Object.assign({}, baseButton, { opacity: props.refreshBusy ? .5 : 1 }) }, props.refreshBusy ? "刷新中…" : "刷新本期"),
        h("button", { onClick: function () { props.onMode("voices"); }, className: "active:opacity-60", style: baseButton }, "补文风"),
        h("button", { onClick: function () { props.onMode("interviews"); }, className: "active:opacity-60", style: baseButton }, "补采访"));
    }
    return h("div", { "data-weekly-space": "tools", style: Object.assign({ position: "absolute", inset: 0, zIndex: 50, color: L.ink, overflow: "hidden" }, pageBackground(L)) },
      h("div", { className: "h-full flex flex-col" },
        h("div", { className: "shrink-0 flex items-center px-2 pb-2", style: { paddingTop: safeTop(10), minHeight: 54, borderBottom: "1px solid " + L.tint + "30" } },
          mode !== "menu" ? h("button", { onClick: function () { props.onMode("menu"); }, className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IArrow, { size: 19, color: L.ink })) : h("div", { style: { width: 40 } }),
          h("div", { className: "flex-1 text-center" },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16 } }, panelTitle),
            h("div", { style: { marginTop: 2, fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".2em", color: L.muted } }, "EDITOR'S DESK")),
          h("button", { onClick: props.onClose, className: "active:opacity-50", style: { width: 40, height: 40, fontFamily: F_BODY, fontSize: 12, color: L.muted } }, "关闭")),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "24px 22px calc(env(safe-area-inset-bottom) + 28px)" } },
          h("div", { style: { borderTop: "6px solid " + L.tint, borderBottom: "1px solid " + L.tint, padding: "16px 0 13px", marginBottom: 24 } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".26em", color: L.muted } }, "ISSUE WORKROOM · PROOF / ARCHIVE / REPAIR"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, lineHeight: 1.1, marginTop: 8 } }, mode === "menu" ? "编辑部工作台" : panelTitle)),
          h("div", { style: { position: "relative", padding: "18px 16px 22px", border: "1px solid " + L.tint + "55", boxShadow: "8px 8px 0 " + L.pale } },
            h("span", { "aria-hidden": "true", style: { position: "absolute", width: 54, height: 9, background: L.tint, right: 17, top: -5 } }),
            body))));
  }

  // 版块详情里的「重刷」行（版块名已在顶栏 Head 显示，这里不重复标题）
  function RegenRow(props) {
    return h("div", { className: "flex justify-end", style: { marginBottom: 10 } }, h(RegenBtn, { busy: props.busy, onClick: props.onRegen }));
  }

  // 头版详情
  function CoverSection(props) {
    const c = props.cover; const L = SECTION_LOOK.cover;
    return h("div", null,
      h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
      h("div", { style: { margin: "0 -10px 22px", padding: "24px 18px 22px", background: L.tint, color: "#fffaf3" } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".28em", textTransform: "uppercase", opacity: .72, marginBottom: 15 } }, "LEAD STORY · 01"),
        h("div", { style: { fontFamily: "'Songti SC',Georgia,serif", fontSize: 31, fontWeight: 600, lineHeight: 1.13, letterSpacing: "-.02em" } }, c.headline)),
      c.lead ? h("div", { style: { fontFamily: "'Songti SC',Georgia,serif", fontSize: 15.5, lineHeight: 1.95, color: L.ink, marginBottom: 20, whiteSpace: "pre-wrap", columnCount: c.lead.length > 230 ? 2 : 1, columnGap: 22 } }, c.lead) : null,
      (c.highlights || []).length ? h("div", { style: { borderTop: "5px solid " + L.tint, padding: "15px 0 4px", marginBottom: 8 } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 8.5, color: L.tint, marginBottom: 12 } }, "INSIDE THIS ISSUE · 本期看点"),
        (c.highlights || []).map(function (hl, i) {
          return h("div", { key: i, style: { display: "grid", gridTemplateColumns: "30px 1fr", gap: 10, padding: "10px 0", borderBottom: "1px solid " + L.tint + "33" } },
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 11, color: L.tint } }, String(i + 1).padStart(2, "0")),
            h("span", { style: { fontFamily: "'Songti SC',Georgia,serif", fontSize: 14, color: L.ink, lineHeight: 1.62 } }, hl));
        })) : null,
      c.editorNote ? h("div", { style: { width: "76%", margin: "20px 0 0 auto", padding: "12px 14px", background: L.tint + "12", borderLeft: "4px solid " + L.tint, fontFamily: "'STKaiti','KaiTi',serif", fontSize: 13, color: L.muted, lineHeight: 1.75 } }, "编者按 · " + c.editorNote) : null);
  }

  // 一条采访（单角色：专访 Q&A + 狗仔），Q./A. 排版 + 神态动作 + OBSERVED 印章
  function InterviewEntry(props) {
    const t = useTheme(); const e = props.entry; const L = SECTION_LOOK.interview;
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 专访回答朗读
    return h("div", { style: { position: "relative" } },
      h("div", { style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 74px", alignItems: "end", borderBottom: "7px solid " + L.tint, margin: "0 -2px 22px", paddingBottom: 13 } },
        h("div", null,
          h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.22em", textTransform: "uppercase", fontSize: 8, color: L.tint, marginBottom: 7 } }, "EXCLUSIVE INTERVIEW · 04"),
          h("div", { style: { fontFamily: "'Songti SC',Georgia,serif", fontSize: 29, fontWeight: 600, color: L.ink, lineHeight: 1.05 } }, e.charName)),
        h(RegenBtn, { busy: props.busy, onClick: props.onRegen })),
      (e.interview && e.interview.qa || []).map(function (qa, i) {
        return h("div", { key: i, style: { display: "grid", gridTemplateColumns: i % 2 ? "1fr 37px" : "37px 1fr", gap: 13, marginBottom: 24, paddingBottom: 20, borderBottom: "1px solid " + L.tint + "33" } },
          i % 2 ? null : h("span", { style: { gridColumn: 1, gridRow: "1 / 3", fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 30, color: L.tint, lineHeight: 1 } }, "Q"),
          h("div", { style: { gridColumn: i % 2 ? 1 : 2, fontFamily: "'STKaiti','KaiTi',serif", fontSize: 14, color: L.muted, lineHeight: 1.7 } }, qa.q),
          h("div", { style: { gridColumn: i % 2 ? 1 : 2, marginTop: 7, fontFamily: "'Songti SC',Georgia,serif", fontSize: 15.5, color: L.ink, lineHeight: 1.82 } },
              qa.a,
              qa.action ? h("span", { style: { fontFamily: "'STKaiti','KaiTi',serif", fontStyle: "italic", color: L.muted } }, "（" + qa.action + "）") : null,
              (tp && props.spk && typeof TtsDot === "function") ? h(TtsDot, { k: "wiv" + i, text: qa.a, spk: props.spk, tp: tp }) : null),
          i % 2 ? h("span", { style: { gridColumn: 2, gridRow: "1 / 3", fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 30, color: L.tint, lineHeight: 1, textAlign: "right" } }, "Q") : null);
      }),
      e.paparazzi && (e.paparazzi.title || e.paparazzi.body) ? h("div", { style: { margin: "26px -10px 0 36px", padding: "17px 18px", background: L.tint, color: "#fff" } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 8, opacity: .7, marginBottom: 8 } }, "GOSSIP · SIDE NOTE"),
        e.paparazzi.title ? h("div", { style: { fontFamily: "'Heiti SC','PingFang SC',sans-serif", fontSize: 18, fontWeight: 700, lineHeight: 1.28, marginBottom: 7 } }, e.paparazzi.title) : null,
        h("div", { style: { fontFamily: "'Songti SC',Georgia,serif", fontSize: 13.5, lineHeight: 1.75, opacity: .94 } }, e.paparazzi.body)) : null);
  }

  // 一个媒体腔版块详情：3~4 篇小报
  function MediaDetail(props) {
    const s = props.sec; const v = voiceOf(s.voiceId);
    const arts = s.articles || [];
    const L = lookOf(s.voiceId);
    function pullQuoteFor(a) {
      const text = String(a && a.body || "").replace(/\s+/g, " ").trim();
      const parts = text.match(/[^。！？!?]{12,70}[。！？!?]/g) || [];
      if (!parts.length) return "";
      return parts[Math.min(parts.length - 1, Math.max(0, Math.floor(parts.length / 2)))].trim();
    }
    function articleBody(a, compact) {
      const paras = (a.body || "").split(/\n+/).filter(Boolean);
      const pull = compact ? "" : pullQuoteFor(a);
      return h("div", null, paras.map(function (p, j) {
        const first = !compact && j === 0 && p.length > 6;
        return h("div", { key: j },
          h("div", { style: { fontFamily: L.bodyFace, fontSize: compact ? 12.5 : (L.face === "mono" ? 13.5 : 14.5), color: "inherit", lineHeight: compact ? 1.72 : (s.voiceId === "tabloid" ? 1.68 : 1.9), marginBottom: compact ? 8 : 10, whiteSpace: "pre-wrap", opacity: .96, textAlign: L.face === "serif" ? "justify" : "left" } },
            first ? h("span", { style: { float: "left", fontFamily: L.titleFace, fontSize: 42, fontWeight: 700, lineHeight: .88, color: L.tint, marginRight: 7, marginTop: 5 } }, p.slice(0, 1)) : null,
            first ? p.slice(1) : p),
          pull && j === 0 ? h("blockquote", { style: { margin: "18px 2px 20px", padding: "2px 0 2px 15px", borderLeft: "4px solid " + L.tint, fontFamily: L.titleFace, fontSize: 22, fontWeight: L.face === "mono" ? 700 : 600, lineHeight: 1.42, color: L.tint } }, pull) : null);
      }));
    }
    function pairedArticle(a, i, side) {
      const filled = side === "left";
      return h("article", { key: i, style: { minWidth: 0, alignSelf: "stretch", padding: filled ? "14px 13px 16px" : "14px 0 16px 13px", background: filled ? L.pale : "transparent", borderTop: "6px solid " + L.tint, color: L.ink } },
        h("div", { style: { fontFamily: L.titleFace, fontSize: 16, fontWeight: L.face === "mono" || s.voiceId === "tabloid" ? 700 : 600, color: L.ink, lineHeight: 1.24, marginBottom: 12, wordBreak: "keep-all", overflowWrap: "break-word" } }, a.title),
        articleBody(a, true));
    }
    function wideArticle(a, i) {
      const decoFirst = i % 2 === 1;
      const deco = h("div", { style: { minHeight: 154, background: L.tint, color: s.voiceId === "cyberpunk" || s.voiceId === "noir" ? L.paper : "#fffaf4", padding: "13px 9px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center" } },
        h("span", { style: { fontFamily: L.titleFace, fontSize: 25, lineHeight: 1 } }, L.deco),
        h("span", { style: { width: 1, height: 42, background: "currentColor", opacity: .42 } }));
      const copy = h("div", { style: { minWidth: 0, padding: decoFirst ? "3px 0 2px 17px" : "3px 17px 2px 0" } },
        h("div", { style: { fontFamily: L.titleFace, fontSize: s.voiceId === "tabloid" ? 25 : 21, fontWeight: L.face === "mono" || s.voiceId === "tabloid" ? 700 : 600, color: L.ink, lineHeight: 1.2, marginBottom: 13, wordBreak: "keep-all", overflowWrap: "break-word" } }, a.title),
        articleBody(a, false));
      return h("article", { key: i, style: { display: "grid", gridTemplateColumns: decoFirst ? "66px minmax(0,1fr)" : "minmax(0,1fr) 66px", alignItems: "start", margin: "0 18px 32px", paddingBottom: 24, borderBottom: "1px solid " + L.tint + "55" } }, decoFirst ? deco : copy, decoFirst ? copy : deco);
    }
    const layoutDNA = ({ tabloid: "manifesto", cyberpunk: "manifesto", tribunal: "dossier", noir: "dossier", markets: "dossier", victorian: "classic", republican: "classic", naturalist: "notes", editorial: "standard", sportsdesk: "scoreboard" })[s.voiceId] || "standard";
    const formation = arts.length <= 2 ? "one-plus-one" : arts.length === 3 ? "pyramid" : "eye-plus-columns";
    const stableVariant = String(s.id || s.voiceId).split("").reduce(function (n, ch) { return n + ch.charCodeAt(0); }, 0) % 2;
    function masthead(extra) {
      return h("div", { style: { padding: "17px 18px 15px", borderTop: "8px solid " + L.tint, borderBottom: "1px solid " + L.tint, color: L.ink, background: extra && extra.dark ? L.paper : "transparent" } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".24em", color: L.tint, textTransform: "uppercase" } }, L.eyebrow),
        h("div", { style: { fontFamily: L.titleFace, fontSize: 25, fontWeight: 700, lineHeight: 1.08, marginTop: 8 } }, v.name));
    }
    function manifestoLayout() {
      const cyber = s.voiceId === "cyberpunk";
      return h("div", { "data-layout-dna": "manifesto", "data-formation": formation, style: { color: L.ink, background: L.paper, paddingBottom: 18 } },
        h("div", { style: { padding: "18px", borderBottom: "10px solid " + L.tint, position: "relative" } },
          cyber ? h("div", { style: { fontFamily: L.bodyFace, fontSize: 10, color: L.tint, marginBottom: 10 } }, "> loading dispatch_" + String(arts.length).padStart(2, "0") + "…") : h("div", { style: { position: "absolute", right: 14, top: 12, width: 48, height: 48, borderRadius: "50%", background: L.tint, color: "#fff", display: "grid", placeItems: "center", fontFamily: L.titleFace, fontSize: 21, transform: "rotate(9deg)" } }, "独家"),
          h("div", { style: { fontFamily: L.titleFace, fontSize: cyber ? 34 : 44, fontWeight: 800, lineHeight: cyber ? 1.02 : .94, letterSpacing: cyber ? "-.03em" : "-.045em", textTransform: cyber ? "lowercase" : "uppercase", maxWidth: cyber ? "100%" : "84%" } }, arts[0] ? arts[0].title : v.name),
          arts[0] ? h("div", { style: { marginTop: 18, borderLeft: "5px solid " + L.tint, paddingLeft: 13 } }, articleBody(arts[0], false)) : null),
        h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
        h("div", { style: { margin: "0 18px", display: arts.length >= 3 ? "grid" : "block", gridTemplateColumns: arts.length === 4 ? "repeat(3,minmax(0,1fr))" : "repeat(2,minmax(0,1fr))", gap: arts.length >= 3 ? 10 : 0 } }, arts.slice(1).map(function (a, i) {
          const dense = arts.length >= 3;
          return h("article", { key: i, style: { display: dense ? "block" : "grid", gridTemplateColumns: cyber ? "42px 1fr" : (stableVariant && i % 2 ? "1fr 64px" : "64px 1fr"), gap: 13, padding: "17px 0", borderBottom: "1px solid " + L.tint + "66", alignItems: "start", minWidth: 0 } },
            cyber ? h("div", { style: { fontFamily: L.bodyFace, fontSize: 9, color: L.tint } }, "[0" + (i + 2) + "]") : null,
            h("div", { style: { gridColumn: cyber ? 2 : "auto" } },
              h("div", { style: { fontFamily: L.titleFace, fontSize: dense ? 16 : (cyber ? 19 : 25), fontWeight: 700, lineHeight: 1.05, marginBottom: 9, overflowWrap: "break-word" } }, a.title), articleBody(a, true)),
            cyber || dense ? null : h("div", { style: { minHeight: 76, background: L.tint, color: "#fff", display: "grid", placeItems: "center", fontFamily: L.titleFace, fontSize: 26 } }, "0" + (i + 2)));
        })));
    }
    function dossierLayout() {
      return h("div", { "data-layout-dna": "dossier", "data-formation": formation, style: { color: L.ink, background: L.paper, paddingBottom: 18 } }, masthead({ dark: s.voiceId === "noir" }), h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
        h("div", { style: { margin: "0 18px" } }, arts.map(function (a, i) {
          if (s.voiceId === "tribunal") return h("article", { key: i, style: { padding: "17px 0", borderBottom: "2px solid " + L.tint } },
            h("div", { style: { display: "grid", gridTemplateColumns: "34px 1fr", gap: 10 } },
              h("b", { style: { fontFamily: "Georgia,serif", fontSize: 24, color: L.tint } }, "Q"), h("div", { style: { fontFamily: L.titleFace, fontSize: 17, fontWeight: 600, lineHeight: 1.5 } }, "争点 " + String(i + 1).padStart(2, "0") + " · " + a.title),
              h("b", { style: { fontFamily: "Georgia,serif", fontSize: 24, color: L.muted } }, "A"), h("div", { style: { paddingLeft: i % 2 ? 16 : 0 } }, articleBody(a, false))));
          if (s.voiceId === "markets") return h("article", { key: i, style: { padding: "13px 0 17px", borderBottom: "1px solid " + L.tint + "66" } },
            h("div", { style: { display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 9, alignItems: "baseline", padding: "7px 9px", background: i % 2 ? "transparent" : L.pale } },
              h("b", { style: { fontFamily: L.bodyFace, color: L.tint } }, String(i + 1).padStart(2, "0")), h("div", { style: { fontFamily: L.titleFace, fontSize: 15, fontWeight: 700 } }, a.title), h("span", { style: { fontFamily: L.bodyFace, color: i % 2 ? L.muted : L.tint } }, i % 2 ? "→" : "↗")),
            h("div", { style: { padding: "11px 9px 0" } }, articleBody(a, true)));
          return h("article", { key: i, style: { marginBottom: 18, padding: "14px", border: "1px solid " + L.tint + "88", boxShadow: "5px 5px 0 " + L.tint + "22" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", fontFamily: L.bodyFace, fontSize: 9, color: L.tint, letterSpacing: ".12em", marginBottom: 12 } }, h("b", null, "EXHIBIT " + String.fromCharCode(65 + i)), h("span", null, a.date || "WEEKLY LOG")),
            h("div", { style: { fontFamily: L.titleFace, fontSize: 21, fontWeight: 700, lineHeight: 1.2, marginBottom: 10 } }, a.title), articleBody(a, false));
        })));
    }
    function classicLayout() {
      return h("div", { "data-layout-dna": "classic", "data-formation": formation, style: { color: L.ink, background: L.paper, paddingBottom: 22 } },
        h("div", { style: { width: "78%", margin: "0 auto 18px", padding: "18px 0 15px", textAlign: "center", borderTop: "3px double " + L.tint, borderBottom: "3px double " + L.tint } },
          h("div", { style: { fontFamily: L.titleFace, fontSize: 28, fontWeight: 600, lineHeight: 1.15 } }, v.name), h("div", { style: { fontFamily: L.bodyFace, fontSize: 11, color: L.muted, marginTop: 6 } }, v.en)),
        h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
        h("div", { style: { width: "78%", margin: "0 auto" } }, arts.map(function (a, i) {
          return h("article", { key: i, style: { textAlign: "center" } }, i ? h("div", { style: { color: L.tint, fontSize: 18, margin: "18px 0" } }, "❦") : null,
            h("div", { style: { borderTop: "1px solid " + L.tint + "88", borderBottom: "1px solid " + L.tint + "88", padding: "9px 4px", fontFamily: L.titleFace, fontSize: i ? 18 : 27, fontWeight: 600, lineHeight: 1.25, marginBottom: 14 } }, a.title),
            h("div", { style: { textAlign: "left" } }, articleBody(a, false)));
        })));
    }
    function notesLayout() {
      return h("div", { "data-layout-dna": "notes", "data-formation": formation, style: { color: L.ink, background: L.paper, paddingBottom: 18 } }, masthead(), h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
        h("div", { style: { margin: "0 16px" } }, arts.map(function (a, i) {
          return h("article", { key: i, style: { display: "grid", gridTemplateColumns: stableVariant ? "1fr 58px" : "58px 1fr", gap: 14, padding: "18px 0", borderBottom: "1px solid " + L.tint + "55" } },
            stableVariant ? null : h("aside", { style: { borderRight: "1px solid " + L.tint, paddingRight: 8, writingMode: "vertical-rl", fontFamily: L.bodyFace, fontSize: 9, letterSpacing: ".14em", color: L.muted } }, "FIELD NOTE · " + String(i + 1).padStart(2, "0")),
            h("div", null, h("div", { style: { fontFamily: L.titleFace, fontSize: i ? 18 : 26, fontWeight: 600, lineHeight: 1.2, marginBottom: 12 } }, a.title), articleBody(a, false)),
            stableVariant ? h("aside", { style: { borderLeft: "1px solid " + L.tint, paddingLeft: 8, writingMode: "vertical-rl", fontFamily: L.bodyFace, fontSize: 9, letterSpacing: ".14em", color: L.muted } }, "OBSERVATION · " + String(i + 1).padStart(2, "0")) : null);
        })));
    }
    function standardLayout() {
      return h("div", { "data-layout-dna": "standard", "data-formation": formation, style: { color: L.ink, background: L.paper, paddingBottom: 8 } }, masthead(), h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
        arts[0] ? h("article", { style: { margin: "0 0 32px", paddingBottom: 24, borderBottom: "1px solid " + L.tint + "55" } }, h("div", { style: { width: "88%", margin: "0 0 18px auto", padding: "18px 19px", background: L.pale, borderLeft: "8px solid " + L.tint } }, h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".22em", color: L.tint, marginBottom: 8 } }, "LEAD · 01"), h("div", { style: { fontFamily: L.titleFace, fontSize: 30, fontWeight: 600, lineHeight: 1.12 } }, arts[0].title)), h("div", { style: { margin: "0 18px" } }, articleBody(arts[0], false))) : null,
        arts.length >= 3 ? h("div", { style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, margin: "0 18px 34px" } }, pairedArticle(arts[1], 1, "left"), pairedArticle(arts[2], 2, "right")) : null,
        arts.length === 2 ? wideArticle(arts[1], 1) : null, arts.slice(3).map(function (a, offset) { return wideArticle(a, offset + 3); }));
    }
    function scoreboardLayout() {
      return h("div", { "data-layout-dna": "scoreboard", "data-formation": formation, style: { color: L.ink, background: L.paper, paddingBottom: 18 } }, masthead(), h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
        h("div", { style: { margin: "0 18px", display: "grid", gridTemplateColumns: arts.length >= 3 ? "1fr 1fr" : "1fr", gap: 12 } }, arts.map(function (a, i) { return h("article", { key: i, style: { gridColumn: i === 0 ? "1 / -1" : "auto", padding: i === 0 ? "18px" : "13px", background: i === 0 ? L.tint : L.pale, color: i === 0 ? "#fff" : L.ink } }, h("div", { style: { fontFamily: L.bodyFace, fontSize: 9, letterSpacing: ".16em", opacity: .72, marginBottom: 8 } }, "MATCH NOTE " + String(i + 1).padStart(2, "0")), h("div", { style: { fontFamily: L.titleFace, fontSize: i === 0 ? 29 : 17, fontWeight: 700, lineHeight: 1.12, marginBottom: 11 } }, a.title), articleBody(a, i > 0)); })));
    }
    const renderer = layoutDNA === "manifesto" ? manifestoLayout : layoutDNA === "dossier" ? dossierLayout : layoutDNA === "classic" ? classicLayout : layoutDNA === "notes" ? notesLayout : layoutDNA === "scoreboard" ? scoreboardLayout : standardLayout;
    return h("div", { style: { margin: "0 -10px" } }, renderer());
  }

  function IssueView(props) {
    const t = useTheme(); const issue = props.issue;
    const [busyUnit, setBusyUnit] = useState(null);
    const [sub, setSub] = useState(null);   // null=目录 | {kind:'cover'} | {kind:'interview'} | {kind:'media',id}
    const [ivSel, setIvSel] = useState(0);
    const [tools, setTools] = useState(null); // null | menu | voices | interviews
    const [turn, setTurn] = useState({ dir: "next", n: 0 });
    const cover = (issue.sections || []).find(function (s) { return s.type === "cover"; });
    const iv = (issue.sections || []).find(function (s) { return s.type === "interview"; });
    const allMedias = (issue.sections || []).filter(function (s) { return s.type === "media"; });
    // 旧刊可能留下只有 voiceId、没有正文的半成品。它不能继续冒充“已出”，否则会同时从目录和未抽中区消失。
    const medias = allMedias.filter(function (s) { return knownVoice(s.voiceId) && mediaHasContent(s); });
    const deskSec = (issue.sections || []).find(function (s) { return s.type === "desk"; });
    const lettersSec = (issue.sections || []).find(function (s) { return s.type === "letters"; });
    const win = { start: issue.weekOf.start, end: issue.weekOf.end, key: issue.key, label: issue.label };
    const num = window.Weekly.issueNo(issue, props.issues || []);
    function goSub(next, dir) {
      setTurn(function (old) { return { dir: dir || "next", n: old.n + 1 }; });
      setSub(next);
    }

    async function regenCover(sec) {
      setBusyUnit(sec.id);
      try {
        const mat = window.Weekly.weekMaterial(win, props.characters || [], props.groups || [], props.userName);
        const charsWithMat = (props.characters || []).filter(function (c) { return (mat.perChar[c.id] || []).length; });
        const personasBlock = window.Weekly.personasFor(charsWithMat, props.userName);
        const empty = mat.global.length === 0;
        const fresh = await window.Weekly.genCover(props.active, personasBlock, window.Weekly.linesToText(mat.global, 8000), empty);
        props.onPatch(issue.id, function (iss) {
          iss.sections = iss.sections.map(function (s) { return s.id === sec.id ? Object.assign({}, s, fresh) : s; });
          return iss;
        });
      } catch (e) { props.toast(String(e.message || e)); }
      setBusyUnit(null);
    }
    // 手动补一位没被抽中的:auto 留空,不占轮次,下一期照样能被抽到
    async function addInterview(char) {
      if (!char) return;
      setBusyUnit("add_" + char.id);
      try {
        const mat = window.Weekly.weekMaterial(win, [char], props.groups || [], props.userName);
        const lines = mat.perChar[char.id] || [];
        const fresh = await window.Weekly.genInterview(props.active, char, window.Weekly.linesToText(lines, 4000), props.userName, win.label);
        props.onPatch(issue.id, function (iss) {
          iss.sections = iss.sections.map(function (sec) {
            if (sec.type !== "interview") return sec;
            if ((sec.entries || []).some(function (e) { return e.charId === char.id; })) return sec;
            return Object.assign({}, sec, { entries: (sec.entries || []).concat([Object.assign({ id: "iv_" + Date.now(), charId: char.id, charName: char.name, auto: false }, fresh)]) });
          });
          return iss;
        });
      } catch (e) { props.toast(String(e.message || e)); }
      finally { setBusyUnit(null); }
    }
    async function regenInterview(entry) {
      const char = (props.characters || []).find(function (c) { return c.id === entry.charId; });
      if (!char) { props.toast("角色已不存在"); return; }
      setBusyUnit(entry.id);
      try {
        const mat = window.Weekly.weekMaterial(win, [char], props.groups || [], props.userName);
        const fresh = await window.Weekly.genInterview(props.active, char, window.Weekly.linesToText(mat.perChar[char.id], 4000), props.userName, win.label);
        props.onPatch(issue.id, function (iss) {
          iss.sections = iss.sections.map(function (s) {
            if (s.type !== "interview") return s;
            return Object.assign({}, s, { entries: s.entries.map(function (en) { return en.id === entry.id ? Object.assign({}, en, fresh) : en; }) });
          });
          return iss;
        });
      } catch (e) { props.toast(String(e.message || e)); }
      setBusyUnit(null);
    }
    async function regenMedia(sec) {
      setBusyUnit(sec.id);
      try {
        const mat = window.Weekly.weekMaterial(win, props.characters || [], props.groups || [], props.userName);
        const charsWithMat = (props.characters || []).filter(function (c) { return (mat.perChar[c.id] || []).length; });
        const personasBlock = window.Weekly.personasFor(charsWithMat, props.userName);
        const empty = mat.global.length === 0;
        // 重刷一版时，本期别的版已经报过的事要避开——否则重刷出来的还是那件最扎眼的
        const avoid = window.Weekly.claimedEvents(issue.sections, sec.id);
        const articles = await window.Weekly.genMedia(props.active, voiceOf(sec.voiceId), personasBlock, window.Weekly.linesToText(mat.global, 8000), empty, avoid,
          { blocks: window.Weekly.weekBlocks(mat.global), usedBlocks: window.Weekly.claimedBlocks(issue.sections, sec.id) });
        props.onPatch(issue.id, function (iss) {
          iss.sections = iss.sections.map(function (s) { return s.id === sec.id ? Object.assign({}, s, { articles: articles }) : s; });
          return iss;
        });
      } catch (e) { props.toast(String(e.message || e)); }
      setBusyUnit(null);
    }
    // 手动补本期没抽到的文风。auto=false 是关键：它只丰富这一本，不从轮抽袋里拿号。
    async function addMediaVoice(v) {
      if (!v || busyUnit) return;
      setBusyUnit("add_voice_" + v.id);
      try {
        const mat = window.Weekly.weekMaterial(win, props.characters || [], props.groups || [], props.userName);
        const charsWithMat = (props.characters || []).filter(function (c) { return (mat.perChar[c.id] || []).length; });
        const articles = await window.Weekly.genMedia(
          props.active, v, window.Weekly.personasFor(charsWithMat, props.userName),
          window.Weekly.linesToText(mat.global, 8000), mat.global.length === 0,
          window.Weekly.claimedEvents(issue.sections), // 手动补版同样避开已报过的事
          { blocks: window.Weekly.weekBlocks(mat.global), usedBlocks: window.Weekly.claimedBlocks(issue.sections) }
        );
        props.onPatch(issue.id, function (iss) {
          let repaired = false;
          iss.sections = (iss.sections || []).map(function (s) {
            if (s.type !== "media" || normalizeVoiceId(s.voiceId) !== v.id) return s;
            repaired = true;
            return Object.assign({}, s, { voiceId: v.id, articles: articles });
          });
          if (!repaired) iss.sections = iss.sections.concat([{ id: "md_" + Date.now(), type: "media", voiceId: v.id, auto: false, articles: articles }]);
          return iss;
        });
        props.toast(v.name + "已补进本期；手动补版不占下期轮抽");
      } catch (e) { props.toast(String(e.message || e)); }
      finally { setBusyUnit(null); }
    }

    // ---- 详情视图 ----
    let headZh = "本期", headEn = "ISSUE #" + num, detail = null;
    if (sub && sub.kind === "letters" && lettersSec) {
      headZh = "读者来信"; headEn = "LETTERS";
      const LL = SECTION_LOOK.letters;
      detail = h("div", { style: { margin: "0 -10px", color: LL.ink } },
        h("div", { style: { display: "grid", gridTemplateColumns: "82px 1fr", minHeight: 116, marginBottom: 26 } },
          h("div", { style: { background: LL.tint, color: "#fffaf5", display: "flex", alignItems: "center", justifyContent: "center" } },
            h("span", { style: { writingMode: "vertical-rl", fontFamily: "'STKaiti','KaiTi',serif", fontSize: 22, letterSpacing: ".22em" } }, "本周来信")),
          h("div", { style: { background: LL.pale, padding: "19px 18px" } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".26em", color: LL.tint } }, "LETTERS · 03"),
            h("div", { style: { fontFamily: "'Songti SC',Georgia,serif", fontSize: 17, lineHeight: 1.65, color: LL.ink, marginTop: 13 } }, "有人把这一周折好，塞进了编辑部的门缝。"))),
        (lettersSec.letters || []).map(function (letter, i) {
          const featured = i === 0;
          return h("article", { key: i, style: { width: featured ? "88%" : "calc(100% - 34px)", margin: featured ? "0 0 30px auto" : (i % 2 ? "0 34px 28px 0" : "0 0 28px 34px"), padding: featured ? "19px 18px" : "0 0 19px", background: featured ? LL.tint : "transparent", color: featured ? "#fffaf5" : LL.ink, borderBottom: featured ? "none" : "1px solid " + LL.tint + "55" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 11 } },
              h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".2em", opacity: featured ? .72 : 1, color: featured ? "inherit" : LL.tint } }, "LETTER " + String(i + 1).padStart(2, "0")),
              h("span", { style: { fontFamily: "'STKaiti','KaiTi',serif", fontSize: 13, opacity: .76 } }, "—— " + letter.from)),
            h("div", { style: { fontFamily: "'STKaiti','KaiTi',serif", fontSize: featured ? 16 : 15, lineHeight: 1.95, whiteSpace: "pre-wrap", textAlign: "justify" } }, letter.body),
            letter.reply ? h("div", { style: { width: featured ? "94%" : "86%", margin: "15px 0 0 auto", padding: "10px 12px", background: featured ? "rgba(255,255,255,.14)" : LL.pale, borderLeft: "4px solid " + (featured ? "rgba(255,255,255,.75)" : LL.tint), fontFamily: "'Songti SC',Georgia,serif", fontSize: 11.5, lineHeight: 1.72, color: "inherit" } }, "编者按 · " + letter.reply) : null);
        }));
    } else if (sub && sub.kind === "desk" && deskSec) {
      headZh = "资料室"; headEn = "THE DESK";
      const qs = deskSec.quotes || [], dk = deskSec.desk || { rows: [] };
      const DL = SECTION_LOOK.desk;
      detail = h("div", { style: { margin: "0 -10px", color: DL.ink } },
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 92px", minHeight: 112, marginBottom: 25 } },
          h("div", { style: { padding: "19px 18px", background: DL.tint, color: "#fff" } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".27em", opacity: .72 } }, "ARCHIVE · 02"),
            h("div", { style: { fontFamily: "'Heiti SC','PingFang SC',sans-serif", fontSize: 28, fontWeight: 700, marginTop: 14 } }, "资料室")),
          h("div", { style: { background: DL.pale, display: "flex", alignItems: "center", justifyContent: "center" } },
            h("span", { style: { writingMode: "vertical-rl", fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".2em", color: DL.tint } }, "FACTS / QUOTES"))),
        // 语录榜：大引号 + 悬挂式排版，一句一块，像杂志的抽言页
        qs.length ? h("div", { style: { marginBottom: 30 } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.28em", color: DL.tint, textTransform: "uppercase", margin: "0 18px 16px" } }, "QUOTED · 本周语录"),
          qs.map(function (q, i) {
            return h("div", { key: i, style: { display: "flex", gap: 12, margin: "0 18px 22px" } },
              h("div", { style: { fontFamily: "Georgia,serif", fontSize: 40, lineHeight: .8, color: DL.tint, flexShrink: 0, marginTop: 4 } }, "\u201C"),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: "'Songti SC',Georgia,serif", fontSize: 17, lineHeight: 1.75, color: DL.ink } }, q.text),
                h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 } },
                  h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, letterSpacing: .5 } }, "— " + q.who),
                  q.note ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, fontStyle: "italic" } }, q.note) : null)));
          })) : null,
        // 数据版：细横线分隔的边栏条目，数字放大、点评压小
        dk.rows && dk.rows.length ? h("div", { style: { margin: "0 18px", borderTop: "7px solid " + DL.tint, paddingTop: 14 } },
          h("div", { style: { fontFamily: "'Heiti SC','PingFang SC',sans-serif", fontSize: 20, fontWeight: 700, color: DL.ink, marginBottom: 2 } }, dk.title),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: "0.26em", color: t.fog, textTransform: "uppercase", marginBottom: 14 } }, "BY THE NUMBERS"),
          dk.rows.map(function (r, i) {
            return h("div", { key: i, style: { padding: "11px 0", borderBottom: "1px solid " + t.line } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.7 } }, r.line),
              r.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3, fontStyle: "italic" } }, r.note) : null);
          }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.line, marginTop: 12, textAlign: "right" } }, "数字由本刊自行统计，未经润色")) : null,
        // 更正启事：报纸角落里那种小字方框
        deskSec.correction ? h("div", { style: { marginTop: 26, padding: "10px 12px", border: "1px solid " + t.line, background: t.bg2 } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.24em", color: t.fog, textTransform: "uppercase", marginBottom: 5 } }, "CORRECTION · 更正"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.75, color: t.sub } }, deskSec.correction)) : null,
        // 分类广告：中缝一句话广告，竖排堆叠、字很小
        (deskSec.ads || []).length ? h("div", { style: { marginTop: 22, borderTop: "1px solid " + t.line, paddingTop: 12 } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.24em", color: t.fog, textTransform: "uppercase", marginBottom: 8 } }, "CLASSIFIEDS · 中缝"),
          deskSec.ads.map(function (adText, i) {
            return h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.9, color: t.sub, paddingLeft: 10, borderLeft: "2px solid " + t.line, marginBottom: 7 } }, adText);
          })) : null);
    } else if (sub && sub.kind === "cover" && cover) {
      headZh = "头版"; headEn = "FRONT PAGE";
      detail = h(CoverSection, { cover: cover, busy: busyUnit === cover.id, onRegen: function () { regenCover(cover); } });
    } else if (sub && sub.kind === "interview" && iv) {
      headZh = "采访版"; headEn = "THE INTERVIEWS";
      const entries = iv.entries || [];
      const sel = Math.min(ivSel, Math.max(0, entries.length - 1));
      const en = entries[sel];
      detail = entries.length ? h("div", null,
        h("div", { className: "flex overflow-x-auto", style: { margin: "0 -10px 24px", paddingBottom: 1, borderTop: "5px solid " + SECTION_LOOK.interview.tint, borderBottom: "1px solid " + SECTION_LOOK.interview.tint + "55" } },
          entries.map(function (e, i) {
            const on = i === sel;
            const char = (props.characters || []).find(function (c) { return c.id === e.charId; });
            return h("button", { key: e.id, onClick: function () { setIvSel(i); }, className: "active:opacity-70", style: { flex: "0 0 auto", width: 98, padding: "10px 8px 9px", background: on ? SECTION_LOOK.interview.tint : "transparent", color: on ? "#fff" : SECTION_LOOK.interview.ink, borderRight: "1px solid " + SECTION_LOOK.interview.tint + "44" } },
              h("div", { style: { display: "grid", gridTemplateColumns: "34px 1fr", gap: 8, alignItems: "center" } },
                h(Avatar, { character: char || { name: e.charName }, size: 34, radius: 0 }),
                h("div", { style: { minWidth: 0, textAlign: "left" } },
                  h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7, letterSpacing: ".14em", opacity: .7 } }, String(i + 1).padStart(2, "0")),
                  h("div", { style: { fontFamily: "'Songti SC',Georgia,serif", fontSize: 12.5, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, e.charName))));
          })),
        en ? h(InterviewEntry, { key: en.id, entry: en, spk: (props.characters || []).find(function (c) { return c.id === en.charId; }), busy: busyUnit === en.id, onRegen: function () { regenInterview(en); } }) : null
      ) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, lineHeight: 1.6 } }, "本周无人露面——采访版空场。");
      // 没被抽中的人:列在下面，想看谁点谁，补出来的不占轮次
      const shown = (iv.entries || []).map(function (e) { return e.charId; });
      const rest = (props.characters || []).filter(function (c) { return shown.indexOf(c.id) < 0; });
      if (rest.length) detail = h("div", null, detail,
        h("div", { style: { marginTop: 26, paddingTop: 14, borderTop: "1px solid " + t.line } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".24em", textTransform: "uppercase", color: t.fog, marginBottom: 8 } }, "NOT IN THIS ISSUE · 本期未采访"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.6, marginBottom: 9 } }, "每期至多采访三人，轮流来。想现在就看某位的，点一下单独补——补出来的不占轮次，下期照样能抽到 Ta。"),
          h("div", { className: "flex flex-wrap", style: { gap: 7 } }, rest.map(function (c) {
            const on = busyUnit === ("add_" + c.id);
            return h("button", { key: c.id, onClick: function () { if (!on) addInterview(c); }, className: "active:opacity-60",
              style: { padding: "6px 11px", borderRadius: 999, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12, color: t.ink, opacity: on ? .5 : 1 } },
              on ? "采访中…" : c.name);
          }))));
    } else if (sub && sub.kind === "media") {
      const sec = medias.find(function (s) { return s.id === sub.id; });
      if (sec) { headZh = voiceOf(sec.voiceId).name; headEn = voiceOf(sec.voiceId).en; detail = h(MediaDetail, { sec: sec, busy: busyUnit === sec.id, onRegen: function () { regenMedia(sec); } }); }
    }

    const pages = [].concat(
      cover ? [{ key: "cover", label: "头版", sub: { kind: "cover" } }] : [],
      deskSec ? [{ key: "desk", label: "资料室", sub: { kind: "desk" } }] : [],
      lettersSec ? [{ key: "letters", label: "读者来信", sub: { kind: "letters" } }] : [],
      iv ? [{ key: "interview", label: "采访版", sub: { kind: "interview" } }] : [],
      medias.map(function (sec) { return { key: "media:" + sec.id, label: voiceOf(sec.voiceId).name, sub: { kind: "media", id: sec.id } }; })
    );
    const currentPageKey = !sub ? "contents" : (sub.kind === "media" ? "media:" + sub.id : sub.kind);
    const voiceStates = window.Weekly.VOICES.map(function (v) {
      const raw = allMedias.find(function (s) { return normalizeVoiceId(s.voiceId) === v.id; });
      const ready = raw && mediaHasContent(raw);
      return { voice: v, sec: ready ? raw : null, state: ready ? "ready" : (raw ? "broken" : "missing") };
    });
    const interviewedIds = new Set(((iv && iv.entries) || []).map(function (e) { return e.charId; }));
    const missingInterviews = (props.characters || []).filter(function (c) { return !interviewedIds.has(c.id); });
    const pageIndex = pages.findIndex(function (p) { return p.key === currentPageKey; });
    if (detail && pageIndex >= 0) {
      const prev = pageIndex > 0 ? pages[pageIndex - 1] : null;
      const next = pageIndex < pages.length - 1 ? pages[pageIndex + 1] : null;
      detail = h("div", null, detail, h(PageTurnNav, {
        prev: prev ? { label: prev.label, onClick: function () { goSub(prev.sub, "prev"); } } : { label: "返回封面", onClick: function () { goSub(null, "prev"); } },
        next: next ? { label: next.label, onClick: function () { goSub(next.sub, "next"); } } : null
      }));
    }

    // 换版块必须回到顶部：不然点进采访版是停在上一版的滚动位置，还得自己往上滑（她 2026-08-18 报）
    const scrollRef = React.useRef(null);
    React.useEffect(function () { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [sub && sub.kind, sub && sub.id, ivSel]);
    const activeLook = pageLook(sub, medias);
    return h("div", { className: "h-full flex flex-col", style: Object.assign({ position: "relative" }, pageBackground(activeLook)) },
      h(WeeklyMotionStyles),
      sub ? h(WeeklyHead, { zh: headZh, en: headEn, look: activeLook, onBack: function () { goSub(null, "prev"); } }) : null,
      h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { color: activeLook.ink } },
        h("div", { className: "weekly-page-stage" },
        h("div", { key: currentPageKey + ":" + turn.n, className: turn.dir === "prev" ? "weekly-page-prev" : "weekly-page-next" },
        detail ? h("div", { style: { padding: "18px 22px 48px" } }, detail) : h("div", null,
          h(CoverPage, {
            issueKey: issue.key, num: num, label: issue.label, target: window.Weekly.nextRefreshTime(), onBack: props.onBack,
            onTools: function () { setTools("menu"); },
            items: [].concat(
              cover ? [{ en: "FRONT PAGE", title: cover.headline, meta: "头版", onOpen: function () { goSub({ kind: "cover" }, "next"); } }] : [],
              deskSec ? [{ en: "THE DESK", title: (deskSec.desk && deskSec.desk.title) || "本周数据", meta: "资料室 · " + (deskSec.quotes || []).length + " 句语录", onOpen: function () { goSub({ kind: "desk" }, "next"); } }] : [],
              lettersSec ? [{ en: "LETTERS", title: "本周来信", meta: (lettersSec.letters || []).length + " 封", onOpen: function () { goSub({ kind: "letters" }, "next"); } }] : [],
              iv ? [{ en: "INTERVIEWS", title: "本期专访", meta: (iv.entries || []).length + " 位", onOpen: function () { goSub({ kind: "interview" }, "next"); } }] : [],
              medias.map(function (sec) {
                const v = voiceOf(sec.voiceId);
                return { en: v.en, title: v.name, meta: (sec.articles || []).length + " 篇", onOpen: function () { goSub({ kind: "media", id: sec.id }, "next"); } };
              }))
          }))))),
      tools ? h(WeeklyToolsSheet, {
        mode: tools, busyUnit: busyUnit, refreshBusy: props.refreshBusy,
        voiceStates: voiceStates, missingInterviews: missingInterviews,
        onClose: function () { setTools(null); }, onMode: setTools,
        onShelf: function () { setTools(null); props.onShelf(); },
        onRefresh: function () { setTools(null); props.onRefresh(); },
        onVoice: function (item) { if (item.state === "ready") { setTools(null); goSub({ kind: "media", id: item.sec.id }, "next"); } else addMediaVoice(item.voice); },
        onInterview: addInterview
      }) : null);
  }

  // 往期书架
  function Shelf(props) {
    const t = useTheme();
    const L = SECTION_LOOK.contents;
    const visible = shelfIssues(props.issues);
    const scrollRef = useRef(null);
    useEffect(function () {
      const el = scrollRef.current;
      if (el && Number.isFinite(Shelf.scrollTop)) el.scrollTop = Shelf.scrollTop;
      return function () { if (el) Shelf.scrollTop = el.scrollTop; };
    }, []);
    const bookColors = ["#683647", "#315b5d", "#966522", "#595374", "#805044"];
    return h("div", { "data-weekly-space": "archive", className: "h-full flex flex-col", style: pageBackground(L) },
      h(WeeklyHead, { zh: "合订本", en: "THE ARCHIVE", look: L, onBack: props.onBack }),
      h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "20px 20px calc(env(safe-area-inset-bottom) + 34px)" } },
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 90px", alignItems: "end", gap: 12, marginBottom: 22 } },
          h("div", null,
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".28em", color: L.muted } }, "BOUND VOLUMES · SINCE THE FIRST ISSUE"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 34, lineHeight: 1.05, marginTop: 8, color: L.ink } }, "编辑部书架"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: L.muted, marginTop: 8 } }, visible.length + " 本合订刊 · 同一报道周只摆一本")),
          h("div", { "aria-hidden": "true", style: { height: 72, position: "relative", borderBottom: "7px solid " + L.tint } },
            [0,1,2,3].map(function (i) { return h("span", { key: i, style: { position: "absolute", bottom: 7, right: i * 19, width: 15, height: 37 + i * 8, background: bookColors[i], transform: "rotate(" + (i - 1) * 2 + "deg)", transformOrigin: "bottom" } }); }))),
        props.missed.length ? h("div", { style: { margin: "2px 0 22px", padding: "15px 14px", border: "1px solid " + t.line, borderRadius: 14, background: t.bg2 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, "漏刊可补"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, margin: "4px 0 10px" } }, "只列出有当周聊天素材、但尚未出刊的完整周；补刊严格使用那一周的记录。"),
          props.missed.map(function (win) {
            const on = props.busyKey === win.key;
            const makeupNo = window.Weekly.issueNo({ weekOf: { start: win.start } }, props.issues);
            const progressText = on && props.progress
              ? "补第 " + makeupNo + " 期 · " + props.progress.label + (props.progress.total ? " " + props.progress.done + "/" + props.progress.total : "")
              : "";
            return h("div", { key: win.key, className: "flex items-center justify-between", style: { padding: "9px 0", borderTop: "1px solid " + t.line } },
              h("div", null,
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink } }, "第 " + makeupNo + " 期 · " + win.label),
                h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".08em", color: on ? t.accent : t.fog, marginTop: 2 } }, progressText || win.key)),
              h("button", { disabled: !!props.busyKey, onClick: function () { props.onMakeup(win); }, className: "active:opacity-60",
                style: { padding: "6px 11px", borderRadius: 999, border: "1px solid " + t.accent, fontFamily: F_BODY, fontSize: 12, color: t.accent, opacity: props.busyKey ? .48 : 1 } },
                on ? "补到第 " + makeupNo + " 期…" : "补做第 " + makeupNo + " 期"));
          })) : null,
        visible.length ? h("div", { style: { borderTop: "1px solid " + L.tint + "66", paddingTop: 17 } },
          visible.map(function (iss, i) {
            const color = bookColors[i % bookColors.length];
            const num = window.Weekly.issueNo(iss, visible);
            return h("div", { key: (iss.key || iss.id), style: { position: "relative", marginBottom: 14, paddingBottom: 8, borderBottom: "8px solid " + L.tint + "30" } },
              h("button", { onClick: function () { props.onOpen(iss.id); }, className: "w-full text-left active:opacity-75",
                style: { minHeight: 104, display: "grid", gridTemplateColumns: "62px minmax(0,1fr) 34px", alignItems: "stretch", background: "rgba(255,255,255,.36)", border: "1px solid " + color + "55", boxShadow: "4px 4px 0 " + color + "22" } },
                h("div", { style: { display: "flex", flexDirection: "column", justifyContent: "space-between", background: color, color: "rgba(255,255,255,.93)", padding: "11px 9px" } },
                  h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".18em" } }, "VOL."),
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 25, lineHeight: 1 } }, String(num).padStart(2, "0"))),
                h("div", { style: { minWidth: 0, padding: "15px 13px" } },
                  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: L.ink } }, "第 " + num + " 期"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: L.muted, marginTop: 5 } }, (iss.label || "") + " · " + issueArticleCount(iss) + " 篇"),
                  h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: ".18em", color: color, marginTop: 12 } }, "OPEN THE BOUND VOLUME")),
                h("div", { style: { borderLeft: "1px solid " + color + "33", display: "flex", alignItems: "center", justifyContent: "center", color: color, fontFamily: F_DISPLAY, fontSize: 18 } }, "›")),
              h("button", { onClick: function () { props.onDelete(iss.id); }, className: "active:opacity-60", style: { position: "absolute", right: 42, top: 9, padding: "5px 7px", fontFamily: F_BODY, fontSize: 10.5, color: L.muted } }, "移出书架"));
          })) : h(Empty, { text: "书架还是空的", sub: "出刊后会装订在这里" })));
  }
  Shelf.scrollTop = 0;

  // 周刊入口不是一张说明页，而是一张正在装订的编辑部桌面。
  // 和「随身物=衣柜」「去处=门」一样，先给 app 一个可认的物件，再把动作长在物件上。
  function NewsroomHome(props) {
    const L = SECTION_LOOK.contents;
    const hasIssue = !!props.issue;
    const num = hasIssue ? window.Weekly.issueNo(props.issue, props.issues) : "—";
    return h("div", { "data-weekly-space": "newsroom", style: { minHeight: "100%", padding: "18px 20px calc(env(safe-area-inset-bottom) + 34px)", color: L.ink } },
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "end", borderBottom: "1px solid " + L.tint + "70", paddingBottom: 13 } },
        h("div", null,
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".3em", color: L.muted } }, "THE EDITORIAL ROOM · EST. ISSUE 01"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 31, lineHeight: 1.08, marginTop: 8 } }, "编辑部装帧台")),
        h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".16em", color: L.muted, textAlign: "right", lineHeight: 1.7 } }, "MON—SUN", h("br"), props.label || "")),
      h("div", { style: { position: "relative", minHeight: 410, margin: "25px 0 20px", padding: "19px 13px 24px", background: "linear-gradient(145deg," + L.pale + "aa,rgba(255,255,255,.20))", border: "1px solid " + L.tint + "35", overflow: "hidden" } },
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: -26, top: 34, width: 120, height: 18, background: L.tint, opacity: .2, transform: "rotate(-8deg)" } }),
        h("div", { "aria-hidden": "true", style: { position: "absolute", right: 24, bottom: 17, width: 84, height: 84, border: "1px solid " + L.tint + "55", borderRadius: "50%" } }),
        h("div", { style: { position: "relative", width: "86%", maxWidth: 335, margin: "0 auto", paddingTop: 14 } },
          h("div", { "aria-hidden": "true", style: { position: "absolute", inset: "24px -9px -9px 22px", background: "#d8d0c5", transform: "rotate(3deg)", boxShadow: "0 13px 26px rgba(42,34,26,.13)" } }),
          h("div", { "aria-hidden": "true", style: { position: "absolute", inset: "17px 4px -3px 12px", background: "#f3eee5", transform: "rotate(-2deg)", border: "1px solid " + L.tint + "22" } }),
          h("button", { onClick: hasIssue ? props.onRead : props.onGenerate, disabled: props.busy, className: "w-full text-left active:opacity-80", style: { position: "relative", minHeight: 320, padding: "22px 20px", background: L.paper, border: "1px solid " + L.tint + "77", color: L.ink, boxShadow: "0 15px 34px rgba(48,38,29,.17)", overflow: "hidden" } },
            h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "start", borderBottom: "5px solid " + L.tint, paddingBottom: 13 } },
              h("div", null,
                h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".3em", color: L.muted } }, "INDEPENDENT WEEKLY"),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 46, lineHeight: 1, marginTop: 8 } }, "周刊")),
              h("div", { style: { borderLeft: "1px solid " + L.tint + "66", paddingLeft: 13, fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".12em", lineHeight: 1.8, color: L.muted } }, "ISSUE ", num, h("br"), props.label || "")),
            hasIssue ? h("div", null,
              h("div", { style: { background: L.tint, color: "#fffaf3", margin: "22px -20px 0", padding: "16px 20px 18px" } },
                h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".22em", opacity: .72 } }, "THIS WEEK · NOW BOUND"),
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.25, marginTop: 8 } }, "上一周，已经装订成册。")),
              h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginTop: 18 } },
                h("div", { style: { borderTop: "1px solid " + L.tint, paddingTop: 8, fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.55, color: L.muted } }, "头版 · 来信", h("br"), "专访 · 卷宗"),
                h("div", { style: { borderTop: "1px solid " + L.tint, paddingTop: 8, fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.55, color: L.muted } }, "多种媒体腔", h("br"), "各自一副骨架"))) : h("div", { style: { paddingTop: 30 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, lineHeight: 1.4 } }, props.busy ? "印刷机正在转。" : "这一周，还在等你装订。"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: L.muted, lineHeight: 1.7, marginTop: 13 } }, props.busy ? (props.progress || "编辑部正在排版……") : "把周一到周日真正发生过的事，交给不同版面重新讲一遍。")),
            h("div", { style: { position: "absolute", right: 18, bottom: 17, fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".22em", color: L.tint } }, props.busy ? "PRINTING…" : hasIssue ? "TAP TO READ →" : "TAP TO PUBLISH →"))),
        h("div", { style: { marginTop: 28 } }, h(Countdown, { target: props.target, ink: L.muted, track: L.tint + "22", fill: L.tint }))),
      h("div", { style: { display: "grid", gridTemplateColumns: hasIssue ? "1fr auto" : "1fr", gap: 10, alignItems: "center" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: L.muted } }, hasIssue ? "第 " + num + " 期已在桌上。点封面拿起来读。" : "每周一本；素材少也可以诚实地留白。"),
        hasIssue ? h("button", { onClick: props.onRefresh, className: "active:opacity-60", style: { padding: "8px 10px", borderBottom: "1px solid " + L.tint, fontFamily: F_BODY, fontSize: 11.5, color: L.tint } }, "重新装订") : null));
  }

  function WeeklyApp(props) {
    const t = useTheme();
    const userName = (props.profile && props.profile.name) || "我";
    const [issues, setIssues] = useState(function () { return loadIssues(); });
    const [view, setView] = useState("cover"); // cover | issue | shelf
    const [openId, setOpenId] = useState(null);
    const [, force] = useState(0); // 订阅后台出刊状态用（busy/prog 变化时重渲染）
    const win = window.Weekly.reportWindow();
    // 旧版可能为同一报道周留下多份补刊/重出稿；入口与书架保持同一选择规则，
    // 只拿内容最完整、其次最新的一份，不让首页误开旧稿。
    const displayIssues = shelfIssues(issues);
    const currentIssue = displayIssues.find(function (i) { return i.key === win.key; });
    const missed = window.Weekly.missedWindows(props.characters || [], props.groups || [], issues, userName);
    // 出刊状态改读模块级——离开界面再回来，进度不丢、完成的刊自动读进来
    const gen = window.Weekly.genState();
    const busy = gen.busy && gen.key === win.key;
    const prog = busy ? gen.prog : null;
    const autoStartedRef = useRef("");
    useEffect(function () {
      return window.Weekly.genSubscribe(function () { setIssues(loadIssues()); force(function (n) { return n + 1; }); });
    }, []);
    useEffect(function () {
      // 周刊原先只有手动出刊。总闸默认关闭；用户明确开启后，进入新刊期第一次打开这里才补做，
      // 不用后台假闹钟，也不会因重渲染重复开印刷机。
      if (!props.autoEnabled || !props.active || currentIssue || gen.busy || autoStartedRef.current === win.key) return;
      const participants = props.autoCharacters || [];
      if (!participants.length) return;
      autoStartedRef.current = win.key;
      window.Weekly.startGenerate({
        active: props.active, characters: participants, groups: props.groups || [],
        userName: userName, win: win, toast: props.toast
      });
    }, [props.autoEnabled, props.active, win.key, !!currentIssue, gen.busy, (props.autoCharacters || []).map(function (c) { return c.id; }).join("|")]);

    function persist(list) { setIssues(list); saveIssues(list); }
    function patchIssue(id, fn) {
      const list = loadIssues().map(function (iss) { return iss.id === id ? fn(Object.assign({}, iss)) : iss; });
      persist(list);
    }
    function delIssue(id) {
      const list = loadIssues().filter(function (x) { return x.id !== id; });
      persist(list);
      if (openId === id) { setOpenId(null); setView("cover"); }
    }

    function doGenerate() {
      if (!props.active) { props.toast("先在设置里配置好模型再出刊"); return; }
      window.Weekly.startGenerate({
        active: props.active, characters: props.characters || [], groups: props.groups || [],
        userName: userName, win: win, toast: props.toast
      });
    }

    function doMakeup(makeupWin) {
      if (!props.active) { props.toast("先在设置里配置好模型再补刊"); return; }
      if (window.Weekly.genState().busy) { props.toast("另一本还在装订，等它出刊后再补"); return; }
      window.Weekly.startGenerate({
        active: props.active, characters: props.characters || [], groups: props.groups || [],
        userName: userName, win: makeupWin, toast: props.toast
      });
    }

    if (view === "issue" && openId) {
      const iss = issues.find(function (x) { return x.id === openId; });
      if (iss) return h(IssueView, {
        issue: iss, issues: issues, active: props.active, characters: props.characters || [], groups: props.groups || [],
        userName: userName, toast: props.toast, onPatch: patchIssue, refreshBusy: gen.busy,
        onRefresh: doGenerate, onShelf: function () { setView("shelf"); },
        onBack: function () { setView(currentIssue && currentIssue.id === openId ? "cover" : "shelf"); }
      });
      setOpenId(null); setView("cover"); return null;
    }
    if (view === "shelf") return h(Shelf, {
      issues: issues, missed: missed, busyKey: gen.busy ? gen.key : null, progress: gen.prog, onMakeup: doMakeup,
      onBack: function () { setView("cover"); }, onOpen: function (id) { setOpenId(id); setView("issue"); }, onDelete: delIssue
    });

    // cover / 编辑部装帧台
    return h("div", { className: "h-full flex flex-col", style: pageBackground(SECTION_LOOK.contents) },
      h(WeeklyHead, {
        zh: "周刊", en: "THE WEEKLY",
        look: SECTION_LOOK.contents,
        onBack: props.onBack,
        right: (issues.length || missed.length) ? h("button", { onClick: function () { setView("shelf"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "往期") : null
      }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto" },
        h(NewsroomHome, {
          issue: currentIssue, issues: displayIssues, label: win.label, busy: busy,
          progress: prog ? (prog.total ? prog.label + " · " + prog.done + "/" + prog.total : prog.label) : "生成中…",
          target: window.Weekly.nextRefreshTime(), onGenerate: doGenerate, onRefresh: doGenerate,
          onRead: function () { setOpenId(currentIssue.id); setView("issue"); }
        })));
  }

  window.WeeklyApp = WeeklyApp;
})();
