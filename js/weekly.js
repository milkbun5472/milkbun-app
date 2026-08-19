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
  const useState = React.useState, useEffect = React.useEffect;

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
  function loadIssues() { return orderedIssues(loadJSON(K_ISSUES, [])); }
  function saveIssues(list) {
    const ordered = orderedIssues(list);
    saveJSON(K_ISSUES, ordered.slice(Math.max(0, ordered.length - MAX_ISSUES)));
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
      if (!m || !m.ts || !cleanMsg(m) || m.ts >= current.start) return;
      const shifted = new Date(m.ts);
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
  function inWin(ts, win) { return ts != null && ts >= win.start && ts <= win.end; }
  // 返回 { perChar:{charId:[{ts,line}]}, global:[{ts,line}] }
  function weekMaterial(win, characters, groups, userName) {
    const uName = userName || "我";
    const perChar = {}, global = [];
    const gset = loadJSON("x_groupSettings", {}); // 群设置：判断哪些群是封闭空间（未开记忆互通）
    const pushPC = function (id, ts, line) { (perChar[id] = perChar[id] || []).push({ ts: ts, line: line }); };
    (characters || []).forEach(function (c) {
      loadJSON("x_chat:" + c.id, []).forEach(function (m) {
        if (!inWin(m.ts, win)) return;
        const txt = cleanMsg(m); if (!txt) return;
        const who = m.role === "user" ? uName : c.name;
        const line = who + "：" + txt;
        pushPC(c.id, m.ts, line);       // 单聊两边都算这个角色的素材（含上下文）
        global.push({ ts: m.ts, line: line });
      });
    });
    (groups || []).forEach(function (g) {
      // 封闭群（未开记忆互通）＝记忆不进也不出，绝不喂进周刊的任何版块（她点名）
      if (!(gset[g.id] && gset[g.id].memoryInterop)) return;
      loadJSON("x_gchat:" + g.id, []).forEach(function (m) {
        if (!inWin(m.ts, win)) return;
        const txt = cleanMsg(m); if (!txt) return;
        let who;
        if (m.role === "user") who = uName;
        else if (m.role === "narration") who = "旁白";
        else who = m.senderName || "某人";
        global.push({ ts: m.ts, line: "【" + g.name + "】" + who + "：" + txt });
        if (m.senderId && m.role !== "user" && m.role !== "narration") pushPC(m.senderId, m.ts, who + "：" + txt);
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
  async function genInterview(active, char, material, userName) {
    const ownLines = ownVoiceLines(material, char.name);
    const uName = userName || "我";
    const persona = (char.persona || "（暂无设定，据名字合理发挥其性格）").trim();
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
      "\n\n【本周 " + char.name + " 与「" + uName + "」及旁人相处的真实记录（采访与花边都只能就这里发生过的事来问、来爆，不得凭空捏造情节）】\n" +
      (material && material.trim() ? material : "（本周几乎没有 " + char.name + " 的记录。）") +
      "\n\n【任务 · 产出两块】\n" +
      "① 专访：你作为一个真的想问出东西的记者，就本周记录做一段 4~6 轮 Q&A。采访必须像现场交锋，不是拿现成答案倒推一道送分题。\n" +
      "· 先找记录里尚有解释空间的矛盾、代价、动机或关系变化再发问；问题只给必要背景，不许把答案、结论或角色原话先塞进题干。\n" +
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
  async function genDeskPage(active, globalText, stats, uName) {
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
      "\n\n【五、读者来信】写 3~4 封短信(每封 40~90 字),写信人就是下面这些当事人本人:" +
      "\n· 每封一个不同的署名者(用「" + uName + "」或角色本名),同一个人不写两封。" +
      "\n· 必须是【这个人自己的立场和口气】:他在意什么、替谁说话、嘴硬还是直说,全照他的人设与本周表现。" +
      "\n· 允许互相抬杠、纠正、阴阳怪气、替自己辩解,也允许有人完全跑题;不许写成千篇一律的读后感。" +
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
    const letters = (d && Array.isArray(d.letters) ? d.letters : []).map(function (x) {
      return { from: String((x && x.from) || "").trim(), body: String((x && x.body) || "").trim(), reply: String((x && x.reply) || "").trim() };
    }).filter(function (x) { return x.from && x.body; }).slice(0, 4);
    return { quotes: quotes, correction: String((d && d.correction) || "").trim(), ads: ads, letters: letters,
      desk: { title: String(desk.title || "本周数据").trim(), rows: statLines.map(function (line, i) { return { line: line, note: notes[i] || "" }; }) } };
  }

  // 读者来信：让角色互相对本周的事发言。四个媒体腔换的是口音，这里换的是【立场】，
  // 同一件事在不同人嘴里长得不一样，这才是真正的多视角。
  async function genLetters(active, personasBlock, globalText, uName, empty) {
    const sys = ANTI_CLICHE + "\n\n" + CHARCARD_RULE +
      "\n\n你是周刊「读者来信」版的编辑。本周有几位读者写信来谈论刊登过的事——他们本人就是当事人或旁观者。" +
      "\n\n【写信人声纹（严格贴合，各写各的）】\n" + personasBlock +
      "\n\n【本周真实发生的事（只能就这里的事写，不许编新情节）】\n" + String(globalText || "").slice(-5000) +
      (empty ? "\n\n【空周处理】本周几乎没有素材：那就写成抱怨没什么可写、或纯粹跑题的闲话，不要硬编剧情。" : "") +
      "\n\n【任务】写 3~4 封短信，每封 40~90 字：" +
      "\n· 每封一个不同的署名者，署名用「" + uName + "」或角色本名；同一个人不写两封。" +
      "\n· 信里必须是【这个人自己的立场和口气】：他在意的点、他会替谁说话、他嘴硬还是直说，全照他的人设与本周表现。" +
      "\n· 允许互相抬杠、纠正、阴阳怪气，允许有人替自己辩解，允许有人完全跑题去说别的事。" +
      "\n· 不许写成千篇一律的读后感，也不许几封都在夸同一件事。" +
      "\n· 编辑可以给其中至多一封加一句极短的编者按（reply，≤18 字），其余留空。" +
      "\n\n【输出】只输出一个 JSON，不要代码块：\n" +
      '{"letters":[{"from":"署名","body":"信的正文","reply":"编者按或空字符串"}]}';
    const d = await genJSON(active, sys, "开始整理本周来信。", 2600);
    const list = (d && Array.isArray(d.letters)) ? d.letters : [];
    return list.map(function (x) {
      return { from: String((x && x.from) || "").trim(), body: String((x && x.body) || "").trim(), reply: String((x && x.reply) || "").trim() };
    }).filter(function (x) { return x.from && x.body; }).slice(0, 4);
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
  async function genMedia(active, voice, personasBlock, material, empty, avoid) {
    const sys =
      ANTI_CLICHE +
      "\n\n【媒体腔 · " + voice.name + "（本版块叙述者的世界观与声纹，是最高创作框架，全程严格遵守）】\n" + voice.world +
      "\n\n" + CHARCARD_RULE +
      "\n【本周出场人物（当你在报道里引用他们说话或反应时，必须守住各自这份声纹，别被媒体腔同化成同一个调子）】\n" + personasBlock + NAME_GUARD +
      "\n\n【本周 RP 聊天记录（把这些真实发生过的事，用上面的媒体腔重新叙事化、报道出来；不得虚构没发生的事）】\n" +
      (empty ? "（本周素材几乎为空。）" : material) +
      (empty ? "\n\n【空周处理】本周几乎没有素材。不要报错、也不要硬编剧情。请按你这种腔调，把「无人可报／集体缺席」本身写成一两篇像模像样的报道。参考方向：" + voice.absent : "") +
      avoidBlock(avoid) +
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
      '{"articles":[{"event":"大白话说清这篇报的是哪件事","title":"这篇的标题","body":"这篇正文（严格遵守上面的声纹与禁止项；只用该腔调，别串味）"},{"event":"第二件事","title":"第二篇标题","body":"第二篇正文"}]}';
    for (let i = 0; i < 2; i++) {
      try {
        const d = await genJSON(active, sys + (i ? "\n\n（上次解析失败，请严格只输出合法 JSON。）" : ""), "写本版 3~4 篇小报。", 7000);
        const arr = d && Array.isArray(d.articles) ? d.articles : (d && (d.title || d.body) ? [d] : null);
        if (arr && arr.length) {
          const out = arr.filter(function (a) { return a && (a.title || a.body); })
            .map(function (a) { return { title: String(a.title || voice.name).trim(), body: String(a.body || "").trim(), event: String(a.event || "").trim() }; });
          if (out.length) return out;
        }
      } catch (e) { if (i) throw e; }
    }
    throw new Error(voice.name + " 生成失败，可单独重刷");
  }

  // 当期抽中的媒体腔共享同一份周素材：正常路径一次批量生成；整批失败或缺版时，
  // 只对缺失项调用原来的 genMedia 单项补洞，保留隔离声纹与可重试性。
  async function genMediaBatch(active, voices, personasBlock, material, empty) {
    const specs = voices.map(function (v) {
      return "【" + v.id + "｜" + v.name + "】\n" + v.world + (empty ? "\n空周写法：" + v.absent : "");
    }).join("\n\n");
    const sys = ANTI_CLICHE + "\n\n你是周刊里几个彼此隔离的媒体编辑部。每个版块只能使用自己的世界观和声纹，绝不串味。\n\n" + specs +
      "\n\n" + CHARCARD_RULE + "\n【本周出场人物】\n" + personasBlock + NAME_GUARD +
      "\n\n【本周 RP 聊天记录】\n" + (empty ? "（本周素材几乎为空。）" : material) +
      // 一次调用同时写所有版面，是【唯一能真正做到互不撞车】的时机——模型此刻同时看得见
      // 所有版面。以前没说这句，于是每个版都各自去挑本周最扎眼的那件事，换的只是腔调，
      // 事件永远是同一件（她 2026-08-19 报：几种风格生成的都是同样的事件）。
      "\n\n【最高优先 · 先分事，再写稿】\n" +
      "① 先把本周素材拆成【互不重叠的若干件事】，每件事用一句不带腔调的大白话记下来（如「早餐做了两份吐司起了争执」）。\n" +
      "② 再把这些事【分配】给各个版面：**同一件事只许给一个版面**。谁的腔调最适合报哪件，就分给谁。\n" +
      "③ 分完才动笔。换个说法、换个角度、只换主角都算同一件事，一律不许两个版都写。\n" +
      "④ 如果事情不够分：宁可让某些版少写一篇、或去挑更小更边角的事，也绝不许两个版报同一件。\n" +
      "⑤ 每篇都要带上它对应的那句大白话，填进 event 字段（不出现在页面上，只用来查重）。\n" +
      "\n每个媒体版写 3~4 篇不同小事。每篇都不是聊天摘要：先选冲突／反差／失控瞬间／意外后果／代价之一作为报道角度；标题具体短促且有判断，首句先抛最炸的画面或后果。允许在各自媒体腔里放大反差、制造悬念、下判断，但只能夸张表达，绝不捏造事实、假引语或关系。正文要说清这件小事为什么值得刊登，不要按聊天时间线平铺。只输出 JSON：{\"media\":[{\"voiceId\":\"上面列出的id之一\",\"articles\":[{\"event\":\"大白话说清这篇报的是哪件事\",\"title\":\"\",\"body\":\"\"}]}]}";
    const d = await genJSON(active, sys, "一次写完这些互不串味的媒体版。", 16000);
    const rows = d && Array.isArray(d.media) ? d.media : [];
    const byId = {};
    // 提示词只是要求，不是保证。这里再用代码硬查一遍：同一件事在本期只许出现一次，
    // 撞车的后来者直接丢掉——宁可某版少一篇（外面会按 avoid 补写），也不让她翻两页看到同一件事。
    const claimed = new Set();
    rows.forEach(function (row) {
      const rowVoiceId = normalizeVoiceId(row && row.voiceId);
      if (!row || !voices.some(function (v) { return v.id === rowVoiceId; }) || !Array.isArray(row.articles)) return;
      const articles = [];
      row.articles.forEach(function (a) {
        if (!a || !(a.title || a.body)) return;
        const ev = String(a.event || "").trim(), k = eventKey(ev || a.title);
        if (k && claimed.has(k)) return; // 这件事已经被别的版占了
        if (k) claimed.add(k);
        articles.push({ title: String(a.title || "").trim(), body: String(a.body || "").trim(), event: ev });
      });
      if (articles.length) byId[rowVoiceId] = articles;
    });
    return byId;
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
    const weekVoices = voicesForWeek(win.key, loadIssues(), win.start); // 每期三块，整池轮抽
    const interviewPool = charsWithMat.concat((characters || []).filter(function (c) { return !charsWithMat.some(function (x) { return x.id === c.id; }); }));
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
    // 有至少 3 个角色时固定采访 3 人；本周没发言的人也可被抽中，缺席本身就是可问的新闻。
    // 洗牌袋轮换；没抽中的仍可手动补，且不占轮次。
    const pickIds = interviewPickFor(win.key, interviewPool.map(function (c) { return c.id; }), loadIssues(), win.start);
    const picked = pickIds.map(function (id) { return interviewPool.find(function (c) { return c.id === id; }); }).filter(Boolean);
    for (const c of picked) {
      tick("采访 " + c.name);
      try {
        const iv = await genInterview(active, c, linesToText(mat.perChar[c.id] || [], 4000), userName);
        entries.push(Object.assign({ id: uid("iv"), charId: c.id, charName: c.name, auto: true }, iv));
      } catch (e) { /* 单角色硬失败就跳过，不拖垮整期 */ }
      done++;
    }
    // 媒体腔（全局，每版 3~4 篇）
    const media = [];
    let batch = {};
    try { batch = await genMediaBatch(active, weekVoices, personasFor(charsWithMat, userName), globalText, empty); } catch (e) { batch = {}; }
    // 批量那次已经在一个上下文里把事分完了；补洞的单版调用看不见别的版，
    // 所以必须把已被占掉的事显式喂给它，否则补出来的又是最扎眼的那件。
    const taken = [];
    Object.keys(batch).forEach(function (k) { (batch[k] || []).forEach(function (a) { if (a && (a.event || a.title)) taken.push(a.event || a.title); }); });
    for (const v of weekVoices) {
      tick(v.name);
      try {
        const articles = batch[v.id] || await genMedia(active, v, personasFor(charsWithMat, userName), globalText, empty, taken.slice());
        if (!batch[v.id]) articles.forEach(function (a) { if (a && (a.event || a.title)) taken.push(a.event || a.title); });
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
      desk = await genDeskPage(active, globalText, stats, userName, personasFor(charsWithMat, userName), empty);
    } catch (e) { desk = null; }
    done++;
    const letters = (desk && desk.letters) || [];
    // 批量那次万一没给出来信,单独补一次,不让整块消失
    if (!letters.length && !empty) {
      try { const L = await genLetters(active, personasFor(charsWithMat, userName), globalText, userName, empty); L.forEach(function (x) { letters.push(x); }); } catch (e) {}
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
    loadIssues: loadIssues, saveIssues: saveIssues, orderedIssues: orderedIssues, reportWindow: reportWindow, nextRefreshTime: nextRefreshTime, issueNo: issueNo,
    missedWindows: missedWindows,
    weekMaterial: weekMaterial, linesToText: linesToText, personasFor: personasFor,
    genCover: genCover, genInterview: genInterview, genMedia: genMedia, generateIssue: generateIssue,
    claimedEvents: claimedEvents, eventKey: eventKey,
    weeklyStats: weeklyStats, genDeskPage: genDeskPage, genLetters: genLetters, voicesForWeek: voicesForWeek, interviewPickFor: interviewPickFor
  };

  // ============================================================
  // UI
  // ============================================================
  // 每个媒体腔一套自己的视觉:同样的字排成一样的样子，那还是四篇一样的东西。
  // tint=版块主色 / rule=分隔线画法 / face=正文字体取向 / deco=版头装饰字符
  const VOICE_LOOK = {
    victorian:  { tint: "#7a5c3e", rule: "double", face: "serif",  deco: "❦", eyebrow: "letterpress" },
    cyberpunk:  { tint: "#2f6b6e", rule: "dashed", face: "mono",   deco: "▮▮▯", eyebrow: "datastream" },
    republican: { tint: "#8a4a52", rule: "solid",  face: "serif",  deco: "❁", eyebrow: "old shanghai" },
    editorial:  { tint: "#3a3a3a", rule: "thick",  face: "serif",  deco: "—", eyebrow: "editorial" },
    naturalist: { tint: "#4f6b45", rule: "dotted", face: "mono",   deco: "✿", eyebrow: "field notes" },
    noir:       { tint: "#4a4550", rule: "solid",  face: "mono",   deco: "▲", eyebrow: "case file" },
    tabloid:    { tint: "#b23830", rule: "thick",  face: "sans",   deco: "★", eyebrow: "exclusive" },
    markets:    { tint: "#24605a", rule: "dashed", face: "mono",   deco: "↗", eyebrow: "closing bell" },
    tribunal:   { tint: "#614a3b", rule: "double", face: "serif",  deco: "§", eyebrow: "hearing record" },
    sportsdesk: { tint: "#285e8a", rule: "thick",  face: "sans",   deco: "●", eyebrow: "match report" }
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
  // 封面底:四种花样,按期抽。都不是纯色,但都压得很淡,保证压在上面的字读得清
  const COVER_SKINS = [
    { id: "halftone", dark: false, ink: ["#2a2622", "#7a3b2e", "#3d5a4a", "#5a4a72"],
      css: function (c) { return { backgroundColor: c, backgroundImage: "radial-gradient(rgba(0,0,0,.10) 1px, transparent 1.2px)", backgroundSize: "9px 9px" }; } },
    { id: "grid", dark: false, ink: ["#22303a", "#7c4a24", "#3f4a2c", "#6a2f43"],
      css: function (c) { return { backgroundColor: c, backgroundImage: "linear-gradient(rgba(0,0,0,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.055) 1px, transparent 1px)", backgroundSize: "22px 22px" }; } },
    { id: "stripe", dark: false, ink: ["#2b2b2b", "#6d3a52", "#2f5560", "#6b5220"],
      css: function (c) { return { backgroundColor: c, backgroundImage: "repeating-linear-gradient(58deg, rgba(0,0,0,.05) 0 2px, transparent 2px 13px)" }; } },
    { id: "night", dark: true, ink: ["#f2ece2", "#e8c9a0", "#bcd6cf", "#d9c3e6"],
      css: function () { return { backgroundColor: "#1d1b1a", backgroundImage: "radial-gradient(120% 90% at 30% 10%, rgba(255,255,255,.10), transparent 55%), repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 6px)" }; } }
  ];
  const COVER_TINTS = ["#efe9dd", "#e9eae4", "#f0e6e2", "#e6ebee"];
  function coverSkin(key) {
    const r = seeded("skin" + key);
    const sk = COVER_SKINS[Math.floor(r() * COVER_SKINS.length)];
    const tint = COVER_TINTS[Math.floor(r() * COVER_TINTS.length)];
    return { skin: sk, style: sk.css(tint), inks: sk.ink, dark: sk.dark };
  }
  // 标题散落在互不相交的固定行带里。行带可以左右错落、旋转，但高度不会互相侵入；
  // 不能再用百分比 top + 任意换行，否则两条长标题会在小屏上叠住。
  const COVER_SLOTS = [
    { top: 8, left: 4, w: 62, h: 72 }, { top: 84, left: 34, w: 61, h: 76 },
    { top: 164, left: 4, w: 57, h: 72 }, { top: 240, left: 31, w: 64, h: 76 },
    { top: 320, left: 5, w: 61, h: 72 }, { top: 396, left: 27, w: 68, h: 72 }
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
    const t = useTheme();
    const [now, setNow] = useState(Date.now());
    useEffect(function () { const id = setInterval(function () { setNow(Date.now()); }, 60000); return function () { clearInterval(id); }; }, []);
    const ms = Math.max(0, props.target - now);
    const d = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000), mm = Math.floor((ms % 3600000) / 60000);
    const txt = ms <= 0 ? "新一期已可刷新" : ("距下一刊 " + (d > 0 ? d + " 天 " : "") + hh + " 时 " + mm + " 分");
    return h("div", { style: { textAlign: "center", fontFamily: "'Archivo',sans-serif", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 10, color: t.fog, marginBottom: 18 } }, txt);
  }

  // 目录一行（点进去看单个版块）
  // 封面:每期的版块标题散落在封面上,点哪块进哪块。
  // 随机的只有位置/字号/颜色/倾角,且全部限制在读得清的范围内——
  // 深底只用浅墨、浅底只用深墨,字号下限 15px,倾角不超过 ±7°。
  function CoverPage(props) {
    const t = useTheme();
    const items = props.items || [];
    const ck = coverSkin(props.issueKey);
    const r = seeded("lay" + props.issueKey);
    const laid = items.slice(0, COVER_SLOTS.length).map(function (it, i) {
      const slot = COVER_SLOTS[i];
      return {
        it: it,
        top: slot.top + (r() * 5 - 2.5),
        left: Math.max(2, Math.min(38, slot.left + (r() * 6 - 3))),
        w: slot.w,
        h: slot.h,
        size: Math.max(17, (String(it.title || "").length > 16 ? 18 : 19 + Math.round(r() * 7))),
        rot: (r() * 8 - 4).toFixed(1),            // ±4°，留足旋转后的安全边界
        ink: ck.inks[Math.floor(r() * ck.inks.length)],
        face: r() < .5 ? F_DISPLAY : F_BODY,
        weight: r() < .35 ? 600 : 400
      };
    });
    const sub = ck.dark ? "rgba(255,255,255,.62)" : "rgba(0,0,0,.45)";
    return h("div", { style: Object.assign({ position: "relative", borderRadius: 4, overflow: "hidden", minHeight: 560, padding: "16px 14px", boxShadow: "0 10px 30px rgba(0,0,0,.13)", border: "1px solid " + (ck.dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.10)") }, ck.style) },
      h("div", { style: { position: "absolute", width: 108, height: 108, borderRadius: "50%", right: -52, top: 128, border: "18px solid " + ck.inks[1], opacity: .16, pointerEvents: "none" } }),
      h("div", { style: { position: "absolute", width: 52, height: 9, left: -9, bottom: 122, background: ck.inks[2], transform: "rotate(-9deg)", opacity: .55, pointerEvents: "none" } }),
      h("div", { style: { position: "absolute", right: 10, top: 78, width: 43, height: 43, borderRadius: "50%", background: ck.inks[3], color: ck.dark ? "#171515" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Archivo',sans-serif", fontSize: 8, lineHeight: 1.15, textAlign: "center", letterSpacing: ".08em", transform: "rotate(8deg)", boxShadow: "0 3px 12px rgba(0,0,0,.12)", whiteSpace: "pre-line", pointerEvents: "none" } }, "ISSUE\n" + (props.num || "—")),
      // 封面报头
      h("div", { style: { textAlign: "center", paddingBottom: 10, borderBottom: "1.5px solid " + (ck.dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)") } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.4em", fontSize: 8, color: sub, textTransform: "uppercase" } }, "THE WEEKLY"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 38, letterSpacing: "0.14em", textIndent: "0.14em", color: ck.dark ? "#f4efe6" : "#232019", lineHeight: 1.1 } }, "周刊"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: sub, marginTop: 2 } }, "第 " + (props.num || "—") + " 期　·　" + (props.label || ""))),
      // 散落的标题
      h("div", { style: { position: "relative", height: 474, marginTop: 6 } },
        laid.map(function (L, i) {
          return h("button", { key: i, onClick: L.it.onOpen, className: "text-left active:opacity-60",
            style: { position: "absolute", top: L.top, left: L.left + "%", width: L.w + "%", height: L.h, overflow: "hidden", transform: "rotate(" + L.rot + "deg)", transformOrigin: "left top" } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 7.5, letterSpacing: "0.26em", textTransform: "uppercase", color: sub, marginBottom: 2 } }, L.it.en),
            h("div", { style: { fontFamily: L.face, fontWeight: L.weight, fontSize: L.size, lineHeight: 1.2, color: L.ink, textShadow: ck.dark ? "0 1px 2px rgba(0,0,0,.5)" : "0 1px 0 rgba(255,255,255,.55)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, L.it.title),
            L.it.meta ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: sub, marginTop: 2 } }, L.it.meta) : null);
        })),
      h("div", { style: { position: "absolute", right: 12, bottom: 10, fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: ".2em", color: sub } }, "TAP A HEADLINE"));
  }

  // 版块详情里的「重刷」行（版块名已在顶栏 Head 显示，这里不重复标题）
  function RegenRow(props) {
    return h("div", { className: "flex justify-end", style: { marginBottom: 10 } }, h(RegenBtn, { busy: props.busy, onClick: props.onRegen }));
  }

  // 头版详情
  function CoverSection(props) {
    const t = useTheme(); const c = props.cover;
    return h("div", null,
      h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 27, fontWeight: 500, lineHeight: 1.16, color: t.ink, marginBottom: 12 } }, c.headline),
      c.lead ? h("div", { style: { fontFamily: F_BODY, fontSize: 15, lineHeight: 1.8, color: t.ink, marginBottom: 14, whiteSpace: "pre-wrap" } }, c.lead) : null,
      (c.highlights || []).length ? h("div", { style: { borderTop: "1px solid " + t.line, borderBottom: "1px solid " + t.line, padding: "12px 0", marginBottom: 6 } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 9, color: t.fog, marginBottom: 8 } }, "本期看点"),
        (c.highlights || []).map(function (hl, i) {
          return h("div", { key: i, className: "flex gap-2", style: { marginBottom: 6 } },
            h("span", { style: { flex: "0 0 auto", fontFamily: F_DISPLAY, fontSize: 13, color: t.accent } }, "0" + (i + 1)),
            h("span", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.55 } }, hl));
        })) : null,
      c.editorNote ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, fontStyle: "italic", color: t.fog, lineHeight: 1.6, marginTop: 12 } }, "编者按 · " + c.editorNote) : null);
  }

  // 一条采访（单角色：专访 Q&A + 狗仔），Q./A. 排版 + 神态动作 + OBSERVED 印章
  function InterviewEntry(props) {
    const t = useTheme(); const e = props.entry;
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 专访回答朗读
    return h("div", { style: { position: "relative" } },
      h("div", { style: { position: "absolute", top: 30, right: -2, transform: "rotate(6deg)", border: "1.5px solid " + t.accent, color: t.accent, borderRadius: 4, padding: "2px 7px", fontFamily: "'Archivo',sans-serif", letterSpacing: "0.16em", fontSize: 9, opacity: 0.85, pointerEvents: "none" } }, "OBSERVED"),
      h("div", { className: "flex items-baseline justify-between", style: { marginBottom: 3 } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, e.charName),
        h(RegenBtn, { busy: props.busy, onClick: props.onRegen })),
      h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 9, color: t.fog, margin: "2px 0 14px" } }, "EXCLUSIVE INTERVIEW"),
      (e.interview && e.interview.qa || []).map(function (qa, i) {
        return h("div", { key: i, style: { marginBottom: 15 } },
          h("div", { className: "flex gap-2.5" },
            h("span", { style: { flex: "0 0 auto", fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 14, color: t.fog, width: 16 } }, "Q."),
            h("span", { style: { fontFamily: F_BODY, fontSize: 14, color: t.fog, lineHeight: 1.6 } }, qa.q)),
          h("div", { className: "flex gap-2.5", style: { marginTop: 4 } },
            h("span", { style: { flex: "0 0 auto", fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 14, color: t.accent, width: 16 } }, "A."),
            h("span", { style: { fontFamily: F_BODY, fontSize: 15, color: t.ink, lineHeight: 1.62 } },
              qa.a,
              qa.action ? h("span", { style: { fontStyle: "italic", color: t.fog } }, "（" + qa.action + "）") : null,
              (tp && props.spk && typeof TtsDot === "function") ? h(TtsDot, { k: "wiv" + i, text: qa.a, spk: props.spk, tp: tp }) : null)));
      }),
      e.paparazzi && (e.paparazzi.title || e.paparazzi.body) ? h("div", { style: { marginTop: 16, padding: "13px 15px", background: t.bg2, borderRadius: 10, border: "1px solid " + t.line } },
        h("div", { style: { fontFamily: "'Archivo',sans-serif", letterSpacing: "0.18em", textTransform: "uppercase", fontSize: 9, color: t.accent, marginBottom: 6 } }, "GOSSIP · 狗仔"),
        e.paparazzi.title ? h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, lineHeight: 1.3, marginBottom: 5 } }, e.paparazzi.title) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.68 } }, e.paparazzi.body)) : null);
  }

  // 一个媒体腔版块详情：3~4 篇小报
  function MediaDetail(props) {
    const t = useTheme(); const s = props.sec; const v = voiceOf(s.voiceId);
    const arts = s.articles || [];
    const L = lookOf(s.voiceId);
    // 每块的分隔线按自己的性格画：双线 / 虚线 / 点线 / 粗线
    const sep = L.rule === "double" ? { borderBottom: "3px double " + L.tint }
      : L.rule === "dashed" ? { borderBottom: "1px dashed " + L.tint }
      : L.rule === "dotted" ? { borderBottom: "1.5px dotted " + L.tint }
      : L.rule === "thick" ? { borderBottom: "2px solid " + L.tint } : { borderBottom: "1px solid " + L.tint };
    return h("div", null,
      // 版头：装饰字符 + 刊名条，颜色是这块自己的
      h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 } },
        h("span", { style: { fontSize: 13, color: L.tint, opacity: .7 } }, L.deco),
        h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: "0.3em", textTransform: "uppercase", color: L.tint } }, L.eyebrow),
        h("span", { style: { flex: 1, height: 1, background: L.tint, opacity: .35 } })),
      h(RegenRow, { busy: props.busy, onRegen: props.onRegen }),
      arts.map(function (a, i) {
        const paras = (a.body || "").split(/\n+/).filter(Boolean);
        return h("article", { key: i, style: Object.assign({ marginBottom: 24, paddingBottom: 20 }, i < arts.length - 1 ? sep : { }) },
          h("div", { style: { fontFamily: faceOf(L.face), fontSize: 21, fontWeight: L.face === "mono" ? 600 : 400, color: t.ink, lineHeight: 1.28, marginBottom: 4, letterSpacing: L.face === "mono" ? ".02em" : "0" } }, a.title),
          // 标题底下一道短色条，长度固定，像栏目章
          h("div", { style: { width: 34, height: 2, background: L.tint, opacity: .6, marginBottom: 10 } }),
          paras.map(function (p, j) {
            const first = j === 0 && p.length > 6;
            return h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 14.5, color: t.ink, lineHeight: 1.85, marginBottom: 9, whiteSpace: "pre-wrap" } },
              // 首段首字放大成落款字，只在第一段做一次
              first ? h("span", { style: { float: "left", fontFamily: F_DISPLAY, fontSize: 40, lineHeight: .92, color: L.tint, marginRight: 6, marginTop: 2 } }, p.slice(0, 1)) : null,
              first ? p.slice(1) : p);
          }));
      }));
  }

  function IssueView(props) {
    const t = useTheme(); const issue = props.issue;
    const [busyUnit, setBusyUnit] = useState(null);
    const [sub, setSub] = useState(null);   // null=目录 | {kind:'cover'} | {kind:'interview'} | {kind:'media',id}
    const [ivSel, setIvSel] = useState(0);
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
        if (!lines.length) { props.toast(char.name + " 本周没有记录，采访不出来"); return; }
        const fresh = await window.Weekly.genInterview(props.active, char, window.Weekly.linesToText(lines, 4000), props.userName);
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
        const fresh = await window.Weekly.genInterview(props.active, char, window.Weekly.linesToText(mat.perChar[char.id], 4000), props.userName);
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
        const articles = await window.Weekly.genMedia(props.active, voiceOf(sec.voiceId), personasBlock, window.Weekly.linesToText(mat.global, 8000), empty, avoid);
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
          window.Weekly.claimedEvents(issue.sections) // 手动补版同样避开已报过的事
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
      detail = h("div", null, (lettersSec.letters || []).map(function (L, i) {
        return h("div", { key: i, style: { marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.95, color: t.ink, whiteSpace: "pre-wrap" } }, L.body),
          h("div", { style: { fontFamily: F_DISPLAY, fontStyle: "italic", fontSize: 14, color: t.sub, textAlign: "right", marginTop: 8 } }, "—— " + L.from),
          L.reply ? h("div", { style: { marginTop: 10, padding: "8px 11px", background: t.bg2, borderLeft: "2px solid " + t.ink, fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "编者按：" + L.reply) : null);
      }));
    } else if (sub && sub.kind === "desk" && deskSec) {
      headZh = "资料室"; headEn = "THE DESK";
      const qs = deskSec.quotes || [], dk = deskSec.desk || { rows: [] };
      detail = h("div", null,
        // 语录榜：大引号 + 悬挂式排版，一句一块，像杂志的抽言页
        qs.length ? h("div", { style: { marginBottom: 30 } },
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9.5, letterSpacing: "0.28em", color: t.fog, textTransform: "uppercase", marginBottom: 16 } }, "QUOTED · 本周语录"),
          qs.map(function (q, i) {
            return h("div", { key: i, style: { display: "flex", gap: 12, marginBottom: 22 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 34, lineHeight: .8, color: t.line, flexShrink: 0, marginTop: 4 } }, "\u201C"),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.75, color: t.ink } }, q.text),
                h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 } },
                  h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, letterSpacing: .5 } }, "— " + q.who),
                  q.note ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, fontStyle: "italic" } }, q.note) : null)));
          })) : null,
        // 数据版：细横线分隔的边栏条目，数字放大、点评压小
        dk.rows && dk.rows.length ? h("div", { style: { borderTop: "2px solid " + t.ink, paddingTop: 14 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: t.ink, marginBottom: 2 } }, dk.title),
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
        h("div", { className: "flex gap-3 overflow-x-auto", style: { marginBottom: 20, paddingBottom: 4 } },
          entries.map(function (e, i) {
            const on = i === sel;
            const char = (props.characters || []).find(function (c) { return c.id === e.charId; });
            return h("button", { key: e.id, onClick: function () { setIvSel(i); }, className: "active:opacity-70", style: { flex: "0 0 auto", width: 76, padding: 6, borderRadius: 10, background: t.bg2, border: "1.5px solid " + (on ? t.accent : t.line), boxShadow: on ? "0 2px 8px rgba(0,0,0,0.08)" : "none" } },
              h(Avatar, { character: char || { name: e.charName }, size: 62, radius: 7 }),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: on ? t.ink : t.fog, textAlign: "center", marginTop: 5, fontWeight: on ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, e.charName));
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
    return h("div", { className: "h-full flex flex-col", style: paperStyle(t) },
      h(WeeklyMotionStyles),
      h(Head, { zh: headZh, en: headEn, onBack: sub ? function () { goSub(null, "prev"); } : props.onBack }),
      h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto px-10 pb-16" },
        h("div", { className: "weekly-page-stage" },
        h("div", { key: currentPageKey + ":" + turn.n, className: turn.dir === "prev" ? "weekly-page-prev" : "weekly-page-next" },
        detail ? detail : h("div", null,
          h(Countdown, { target: window.Weekly.nextRefreshTime() }),
          h(CoverPage, {
            issueKey: issue.key, num: num, label: issue.label,
            items: [].concat(
              cover ? [{ en: "FRONT PAGE", title: cover.headline, meta: "头版", onOpen: function () { goSub({ kind: "cover" }, "next"); } }] : [],
              deskSec ? [{ en: "THE DESK", title: (deskSec.desk && deskSec.desk.title) || "本周数据", meta: "资料室 · " + (deskSec.quotes || []).length + " 句语录", onOpen: function () { goSub({ kind: "desk" }, "next"); } }] : [],
              lettersSec ? [{ en: "LETTERS", title: "本周来信", meta: (lettersSec.letters || []).length + " 封", onOpen: function () { goSub({ kind: "letters" }, "next"); } }] : [],
              iv ? [{ en: "INTERVIEWS", title: "本期专访", meta: (iv.entries || []).length + " 位", onOpen: function () { goSub({ kind: "interview" }, "next"); } }] : [],
              medias.map(function (sec) {
                const v = voiceOf(sec.voiceId);
                return { en: v.en, title: v.name, meta: (sec.articles || []).length + " 篇", onOpen: function () { goSub({ kind: "media", id: sec.id }, "next"); } };
              }))
          }),
          h("div", { style: { marginTop: 18, padding: "13px 14px", border: "1px solid " + t.line, borderRadius: 12, background: t.bg2 } },
            h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 8.5, letterSpacing: ".22em", color: t.fog, marginBottom: 5 } }, "ALL EDITIONS · 全部文风状态"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, lineHeight: 1.6, color: t.fog, marginBottom: 9 } }, "每期从完整文风池轮抽三种。已出可直接翻阅；未抽中可补版；旧刊半成品会标为待修复，不再无声消失。"),
            h("div", { className: "flex flex-wrap", style: { gap: 7 } }, voiceStates.map(function (item) {
              const v = item.voice, on = busyUnit === ("add_voice_" + v.id);
              const label = item.state === "ready" ? (v.name + " · 已出") : item.state === "broken" ? (on ? "修复中…" : v.name + " · 待修复") : (on ? "补版中…" : v.name + " · 未抽中");
              return h("button", { key: v.id, disabled: !!busyUnit && !on,
                onClick: function () { if (item.state === "ready") goSub({ kind: "media", id: item.sec.id }, "next"); else addMediaVoice(v); },
                className: "active:opacity-60", style: { padding: "6px 10px", borderRadius: 999, border: "1px solid " + (item.state === "broken" ? t.accent : t.line), color: item.state === "ready" ? t.sub : t.ink, fontFamily: F_BODY, fontSize: 11.5, opacity: busyUnit && !on ? .55 : 1 } }, label);
            }))),
          h("div", { style: { textAlign: "center", fontFamily: "'Archivo',sans-serif", letterSpacing: "0.2em", fontSize: 9, color: t.line, marginTop: 26 } }, "— 点 版 块 进 入 阅 读 —"))))));
  }

  // 往期书架
  function Shelf(props) {
    const t = useTheme();
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "往期", en: "BACK ISSUES", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-16" },
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
        props.issues.length ? props.issues.map(function (iss) {
          return h("div", { key: iss.id, className: "flex items-center justify-between active:opacity-70", style: { padding: "14px 0", borderBottom: "1px solid " + t.line } },
            h("button", { onClick: function () { props.onOpen(iss.id); }, className: "flex-1 text-left" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, "第 " + window.Weekly.issueNo(iss, props.issues) + " 期"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2 } }, (iss.label || "") + " · " + ((iss.sections || []).reduce(function (n, s) { return n + (s.type === "interview" ? (s.entries || []).length : 1); }, 0)) + " 篇")),
            h("button", { onClick: function () { props.onDelete(iss.id); }, className: "active:opacity-60 ml-3", style: { fontFamily: F_BODY, fontSize: 12, color: t.accent } }, "删除"));
        }) : h(Empty, { text: "还没有往期", sub: "出刊后会归档在这里" })));
  }

  function WeeklyApp(props) {
    const t = useTheme();
    const userName = (props.profile && props.profile.name) || "我";
    const [issues, setIssues] = useState(function () { return loadIssues(); });
    const [view, setView] = useState("cover"); // cover | issue | shelf
    const [openId, setOpenId] = useState(null);
    const [, force] = useState(0); // 订阅后台出刊状态用（busy/prog 变化时重渲染）
    const win = window.Weekly.reportWindow();
    const currentIssue = issues.find(function (i) { return i.key === win.key; });
    const missed = window.Weekly.missedWindows(props.characters || [], props.groups || [], issues, userName);
    // 出刊状态改读模块级——离开界面再回来，进度不丢、完成的刊自动读进来
    const gen = window.Weekly.genState();
    const busy = gen.busy && gen.key === win.key;
    const prog = busy ? gen.prog : null;
    useEffect(function () {
      return window.Weekly.genSubscribe(function () { setIssues(loadIssues()); force(function (n) { return n + 1; }); });
    }, []);

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
        userName: userName, toast: props.toast, onPatch: patchIssue, onBack: function () { setView(currentIssue && currentIssue.id === openId ? "cover" : "shelf"); }
      });
      setOpenId(null); setView("cover"); return null;
    }
    if (view === "shelf") return h(Shelf, {
      issues: issues, missed: missed, busyKey: gen.busy ? gen.key : null, progress: gen.prog, onMakeup: doMakeup,
      onBack: function () { setView("cover"); }, onOpen: function (id) { setOpenId(id); setView("issue"); }, onDelete: delIssue
    });

    // cover
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, {
        zh: "周刊", en: "THE WEEKLY",
        onBack: props.onBack,
        right: (issues.length || missed.length) ? h("button", { onClick: function () { setView("shelf"); }, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, "往期") : null
      }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-6 pb-16" },
        busy ? h("div", null,
          h(Spinner, { label: prog ? (prog.total ? prog.label + " · " + prog.done + "/" + prog.total : prog.label) : "生成中…" }),
          h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11.5, color: t.fog, lineHeight: 1.6, marginTop: 4 } }, "把上一周的相处，重新写成 5 个版块。稍等片刻——")
        ) : h("div", null,
          h(Masthead, { num: currentIssue ? window.Weekly.issueNo(currentIssue, issues) : "—", label: win.label }),
          currentIssue
            ? h("div", null,
                h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.7, marginBottom: 16 } }, "本期已出刊。头版头条 + 采访版 + 维多利亚小报 + 赛博快讯 + 鸳鸯蝴蝶派 + 大报社论，各表上一周的你们。"),
                h("button", { onClick: function () { setOpenId(currentIssue.id); setView("issue"); }, className: "w-full active:opacity-80", style: { padding: "13px", borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 16 } }, "阅读第 " + window.Weekly.issueNo(currentIssue, issues) + " 期"),
                h("div", { style: { textAlign: "center", marginTop: 14 } },
                  h("button", { onClick: doGenerate, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.accent } }, "重出本期（覆盖当前这一期）")))
            : h("div", null,
                h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.7, marginBottom: 8 } }, "把 " + win.label + " 这一周（周一~周日）的聊天记录，重新叙事化成一期周刊："),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.7, marginBottom: 18, whiteSpace: "pre-wrap" } }, "· 头版头条：主编把这一周最大的事做成封面\n· 采访版：每个角色一篇 in-character 专访 + 一段狗仔花边\n· 维多利亚社交小报 / 赛博朋克数据快讯 / 民国鸳鸯蝴蝶派 / 严肃大报社论 —— 同一周素材，四种腔调"),
                h("button", { onClick: doGenerate, className: "w-full active:opacity-80", style: { padding: "14px", borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 17 } }, "出这期周刊"),
                h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 11, color: t.line, marginTop: 10 } }, "每周日半夜起，可出刚过去那一整周 · 素材少也能出（缺席自成一景）"))
        )));
  }

  window.WeeklyApp = WeeklyApp;
})();
