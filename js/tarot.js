// ============================================================
// 塔罗（tarot）—— 抽牌 + 角色声音解牌，独立小 app
// 四种玩法（都靠全局 callAI + ANTI_CLICHE，存 localStorage x_tarot_saves 随云同步）：
//   · reading  角色为你解牌：你问一件事，选一个角色，Ta 用自己的口吻按牌面为你解读
//   · relation 关系占卜：为「你和某角色」抽牌，牌面暗暗被真实好感/关系上色，不露数字
//   · daily    每日一牌：一天只【一张】牌（全体共用，当天固定），各角色解读同一张给你当日签（可一次生成全部角色）
//   · forchar  给角色算一卦：替某角色抽 Ta 此刻的近况/心结/走向，旁白式解读，可转发给 Ta
// 78 张莱德-韦特牌（22 大阿卡纳 + 56 小阿卡纳），每张牌都是【本地随机】抽出，模型只解读不挑牌。
// ============================================================
(function () {
  const ACCENT = "#4a3f6b";      // 塔罗主色（深紫）
  const GOLD = "#b89150";        // 烫金点缀
  const AC = () => (typeof ANTI_CLICHE !== "undefined" ? ANTI_CLICHE + "\n\n" : "");
  const NAC = () => (typeof NARRATIVE_ANTI_CLICHE !== "undefined" ? NARRATIVE_ANTI_CLICHE + "\n\n" : "");
  // 忠于牌面、别为讨好而美化
  const HONEST = "【忠于牌面】牌是随机抽出的、无法更改。别为了讨好或安慰就把凶牌、逆位往好里圆——该警示就警示、该沉就沉，正位逆位要解出真差别，像一次正经的占卜，不是心灵鸡汤。";
  // 换个角色只换语气、结构一模一样，是塔罗显得单薄的一个来源：让人设决定 Ta 跟这副牌的关系。
  const STANCE = "【你自己对占卜这件事的态度，由你的人设决定】你可以是真信的、半信半疑的、嘴上不信却认真解的、觉得这是无聊游戏但还是陪着的、甚至对某张牌有私人忌讳。这个态度要渗进你怎么说话——理性的人会先说明这只是概率与投射再照解不误，信的人翻到凶牌会真的皱眉。但不管什么态度，都不许因此敷衍牌面或拒绝解读：忠于牌面的要求高于你的态度。";

  // ---- 牌堆 ----
  const MAJORS = ["愚者", "魔术师", "女祭司", "皇后", "皇帝", "教皇", "恋人", "战车", "力量", "隐者", "命运之轮", "正义", "倒吊人", "死神", "节制", "恶魔", "高塔", "星星", "月亮", "太阳", "审判", "世界"];
  const SUITS = ["权杖", "圣杯", "宝剑", "星币"];
  const RANKS = ["王牌", "二", "三", "四", "五", "六", "七", "八", "九", "十", "侍从", "骑士", "王后", "国王"];
  function buildDeck() {
    const d = MAJORS.map(n => ({ name: n, major: true }));
    SUITS.forEach(s => RANKS.forEach(r => d.push({ name: s + r, major: false })));
    return d; // 78 张
  }
  const DECK = buildDeck();
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 抽 n 张互不相同的牌，各自随机正/逆位（纯本地随机，模型完全不参与选牌）
  function draw(n) {
    return shuffle(DECK).slice(0, n).map(c => ({ name: c.name, major: c.major, rev: Math.random() < 0.34 }));
  }
  const cardLabel = c => c.name + "（" + (c.rev ? "逆位" : "正位") + "）";
  const MAJOR_KEYS = {
    "愚者":"启程、自由、未知", "魔术师":"行动、资源、创造", "女祭司":"直觉、沉默、隐情", "皇后":"滋养、丰盛、感受",
    "皇帝":"秩序、边界、掌控", "教皇":"传统、承诺、教导", "恋人":"选择、联结、价值", "战车":"推进、意志、方向",
    "力量":"温柔的勇气、自持", "隐者":"独处、寻找、内省", "命运之轮":"转折、周期、机会", "正义":"因果、判断、平衡",
    "倒吊人":"停顿、换角度、让渡", "死神":"结束、蜕变、更新", "节制":"调和、耐心、疗愈", "恶魔":"执念、诱惑、束缚",
    "高塔":"突变、真相、瓦解", "星星":"希望、修复、指引", "月亮":"迷雾、潜意识、不安", "太阳":"明朗、生命力、喜悦",
    "审判":"召唤、醒悟、复盘", "世界":"完成、整合、新阶段"
  };
  const SUIT_KEYS = { "权杖":"行动与欲望", "圣杯":"情感与关系", "宝剑":"思想与冲突", "星币":"现实、身体与资源" };
  const RANK_KEYS = { "王牌":"一颗种子", "二":"权衡与两端", "三":"生长与协作", "四":"稳定与停驻", "五":"摩擦与缺口", "六":"过渡与回馈", "七":"考验与坚持", "八":"推进与束缚", "九":"临界与守成", "十":"抵达与负担", "侍从":"消息与初学", "骑士":"追逐与执行", "王后":"内在成熟", "国王":"外在掌控" };
  function cardReference(c) {
    let core = MAJOR_KEYS[c.name] || "";
    if (!core) {
      const suit = SUITS.find(s => c.name.indexOf(s) === 0) || "";
      const rank = RANKS.find(r => c.name === suit + r) || "";
      core = (SUIT_KEYS[suit] || "当下经验") + "；" + (RANK_KEYS[rank] || "变化中的阶段");
    }
    return { keywords: core, text: c.rev ? "逆位提醒：这股力量可能受阻、过量或转向内在；先看哪里失衡，不急着把它圆成好事。" : "正位提示：这股力量正在较直接地显现；结合牌位，看它邀请你承认、推进或守住什么。" };
  }
  function fmtDate(ts) { const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  // 一次占卜里可被搜索命中的所有文字（角色名/问题/牌名/每日各角色/收束）
  function sessionText(s) {
    const parts = [s.charName || "", s.question || "", s.summary || ""];
    if (s.card) parts.push(s.card.name);
    (s.cards || []).forEach(c => c && parts.push(c.name));
    (s.entries || []).forEach(e => e && parts.push(e.charName || ""));
    return parts.join(" ").toLowerCase();
  }

  // ---- 好感度 → 语气档（不给模型数字，只给氛围词，占卜结果暗暗被它上色）----
  function affBand(a) {
    if (a == null || isNaN(a)) return "";
    if (a >= 80) return "极亲密、几乎交付了真心";
    if (a >= 60) return "亲近、信任在生长";
    if (a >= 40) return "有好感但仍有分寸";
    if (a >= 22) return "还疏淡、在观望";
    return "冷淡、甚至带着戒备";
  }

  // 角色最近聊天一小段，作近况/语气参考
  function recentChat(charId, uName, charName) {
    const msgs = loadJSON("x_chat:" + charId, []);
    if (!msgs.length) return "";
    return msgs.slice(-10)
      .filter(m => m && (m.content || "").trim() && (m.role === "user" || m.role === "assistant") && !isOocMsg(m))
      .map(m => (m.role === "user" ? uName : charName) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 70))
      .join("\n");
  }

  // ---- 四种玩法 ----
  const MODES = {
    reading: {
      zh: "角色为你解牌", en: "A Reading For You", icon: "✦",
      blurb: "问一件心里的事，让一个角色为你摊开三张牌、以 Ta 的口吻解读",
      spread: ["此刻的处境", "眼前的阻碍", "给你的指引"],
      needChar: true, needQ: true, qHint: "你想问的事（如：这段关系会往哪走 / 该不该辞职…）"
    },
    relation: {
      zh: "关系占卜", en: "You & Them", icon: "♡",
      blurb: "为「你和 Ta」抽牌——牌面会照着你们此刻真实的远近显影",
      spread: ["你眼中的 Ta", "Ta 眼中的你", "你们的走向"],
      needChar: true
    },
    daily: {
      zh: "每日一牌", en: "Card of the Day", icon: "☀",
      blurb: "今天翻【一张】牌，各角色都解读这同一张、给你当日签（可一次生成全部角色，同一天固定不变）",
      spread: ["今日"],
      needChar: true, daily: true
    },
    forchar: {
      zh: "给角色算一卦", en: "A Reading For Them", icon: "◈",
      blurb: "替某个角色抽 Ta 此刻的近况与心结，旁白替 Ta 摊开命运，可转发给 Ta",
      spread: ["Ta 的近况", "藏在心里的结", "接下来"],
      needChar: true
    }
  };

  // 牌阵和玩法分开：入口决定“为谁/为什么算”，牌阵只决定桌上怎么摊牌。
  // 保留原来的三张指引，同时加入更适合不同问题的五种牌阵。
  const SPREADS = {
    guide: { zh: "三张指引", hint: "处境 · 阻碍 · 指引", positions: ["此刻的处境", "眼前的阻碍", "给你的指引"] },
    single: { zh: "单张直觉", hint: "只看此刻最重要的一件事", positions: ["此刻最重要的讯息"] },
    timeline: { zh: "过去 / 现在 / 未来", hint: "看一件事怎样走到这里", positions: ["过去留下的影响", "现在的处境", "接下来的走向"] },
    love: { zh: "感情三角", hint: "你 · Ta · 关系本身", positions: ["你的状态", "Ta 的状态", "关系本身"] },
    relation5: { zh: "五张关系牌阵", hint: "把关系里明暗两面摊开", positions: ["你的状态", "Ta 的状态", "关系的核心", "藏着的问题", "接下来的建议"] },
    choice: { zh: "A / B 选择", hint: "不替你决定，只照见两条路", positions: ["选择 A 的代价与走向", "选择 B 的代价与走向"] }
  };
  const DEFAULT_SPREAD = { reading: "guide", relation: "love", forchar: "timeline" };
  const CUSTOM_SPREAD_KEY = "x_tarot_custom_spreads";
  function loadCustomSpreads() { return loadJSON(CUSTOM_SPREAD_KEY, []).filter(x => x && x.id && Array.isArray(x.positions)); }
  function saveCustomSpreads(list) { saveJSON(CUSTOM_SPREAD_KEY, list); }
  const SHOP_MOMENTS = [
    "店主把洗好的牌放回深色绒布上，没催你开口。",
    "窗边的风铃轻轻碰了一声，桌上的灯只照亮牌面。",
    "茶已经温了。店主退到书架后面，把这张小桌留给你们。",
    "门外有人走过，影子从磨砂玻璃上一晃而过，店里仍很安静。",
    "店主用指节把歪掉的一摞牌轻轻推齐，又低头去看自己的书。"
  ];
  const pickShopMoment = () => SHOP_MOMENTS[Math.floor(Math.random() * SHOP_MOMENTS.length)];

  // 让角色自己决定“今天想不想坐上牌桌、想问什么”。只用于开局前，
  // 不把一次犹豫或拒绝写成人格，也不替角色硬答应。
  async function askReadingIntent(active, ctx) {
    const forSelf = ctx.mode === "forchar";
    const sys = AC() + "你就是「" + ctx.charName + "」本人。" +
      "现在 " + ctx.uName + (forSelf ? "提出替你算一卦。" : "请你自己挑一个此刻真正想拿来问牌的问题。") +
      "按你的人设、此刻心情和最近相处自然反应，不必配合演出。" +
      (forSelf ? "你可以接受、带着一点犹豫接受，或明确拒绝。拒绝时说人话，不要讲规则。犹豫仍代表愿意继续，但问题可以保守些。" : "挑真实、具体、此刻会在意的问题；不要替自己制造重大危机。") +
      "\n\n【角色资料】" + String(ctx.charPersona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 700) +
      (ctx.mood ? "\n【此刻心情】" + ctx.mood : "") +
      (ctx.voiceRef ? "\n【最近的说话与近况】\n" + ctx.voiceRef : "") +
      "\n\n只输出 JSON：{\"decision\":\"accept|hesitate|refuse\",\"line\":\"你当面说的一句自然回应\",\"question\":\"真正拿来问牌的问题\"}。" +
      (forSelf ? "若拒绝，question 留空。" : "decision 固定为 accept。");
    const raw = await callAI(active, sys, [{ role: "user", content: forSelf ? "你愿意让我替你算吗？" : "这次你想问牌什么？" }], { maxTokens: 900 });
    const p = extractJSON(raw) || {};
    const decision = ["accept", "hesitate", "refuse"].includes(p.decision) ? p.decision : "accept";
    return { decision: decision, line: String(p.line || raw || "").trim().slice(0, 240), question: String(p.question || "").trim().slice(0, 240) };
  }

  function loadSaves() { return loadJSON("x_tarot_saves", []); }
  function saveSaves(l) { saveJSON("x_tarot_saves", l); }
  const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  // 今天的那一张牌：一天只抽一张，全体角色共用；当天固定不变（存 x_tarot_dayCard）
  function todayCard() {
    const tk = todayKey();
    const stored = loadJSON("x_tarot_dayCard", null);
    if (stored && stored.dayKey === tk && stored.card) return stored.card;
    const card = draw(1)[0];
    saveJSON("x_tarot_dayCard", { dayKey: tk, card: card });
    return card;
  }

  // ============================================================
  // 模型：解一副牌（reading / relation / forchar）
  // 返回 {reads:[{pos,text}], summary, charThought}
  // ============================================================
  async function readSpread(active, ctx) {
    const { mode, cards, spread, charName, charPersona, uName, question, relText, band, voiceRef, mood, worldbook } = ctx;
    const cardList = cards.map((c, i) => (i + 1) + "、【" + spread[i] + "】" + cardLabel(c)).join("\n");
    let voice, view, thoughtAsk;
    if (mode === "reading") {
      voice = "你就是「" + charName + "」本人，正坐在 " + uName + " 对面替 Ta 摊牌解读。全程用第一人称、你自己的口吻和性格说话，像真的在跟 " + uName + " 讲，别当中立的解牌机器。你对 " + uName + " 的态度（" + (band || "说不清的距离") + "）会自然渗进你怎么解、语气软还是硬、点到为止还是掏心窝。";
      view = "这是 " + uName + " 问的事：「" + (question || "我最近该注意什么") + "」。顺着这个问题解。";
      thoughtAsk = "charThought：抛开解牌的口吻，说一句你（" + charName + "）此刻【私心里】对这几张牌的真实反应（第一人称，如替 Ta 捏把汗／松口气／不是滋味／想多留 Ta 一会儿）。";
    } else if (mode === "relation") {
      voice = "你是替 " + uName + " 与「" + charName + "」摊牌的占者，声音安静、有点神秘，不代入角色本人。";
      view = "这一卦是关于 " + uName + " 和 " + charName + " 之间的关系。" +
        (relText ? "已知的关系：" + relText + "。" : "") +
        (question ? "这次具体想照见的是：「" + question + "」。" : "") +
        "他们此刻真实的远近是：" + (band || "尚未明朗") + "——【不要】把这句话或任何分数直接说出来，而是让它悄悄决定牌面的暖度、亲疏和走向的明暗。";
      thoughtAsk = "charThought：切换成「" + charName + "」本人的口吻，说一句 Ta 看到这几张关于自己和 " + uName + " 的牌时、心里真实的一句反应（第一人称）。";
    } else { // forchar
      voice = "你是替「" + charName + "」摊牌的旁白/占者，用第三人称讲 Ta，声音冷静、有洞察，不代入 Ta 本人也不对 " + uName + " 说话。";
      view = "这一卦算的是 " + charName + " 自己。Ta 愿意拿来问牌的是：「" + (question || "我此刻最该看清什么") + "」。照着 Ta 的人设与近况来解，别擅自把主题改成 " + uName + "。";
      thoughtAsk = "charThought：切换成「" + charName + "」本人的口吻，说一句 Ta 若看到替自己算的这一卦、心里真实的一句反应（第一人称）。";
    }

    const sys = AC() + NAC() + HONEST + "\n\n" + STANCE + "\n\n" + voice + "\n\n" +
      "【角色资料】「" + charName + "」：" + (charPersona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 800) +
      (mood ? "\n\n【Ta 此刻的心情：" + mood + "】顺带透一点即可，别喧宾夺主、牌义才是主角。" : "") +
      (voiceRef ? "\n\n【Ta 近期的语气 / 近况，仅参考】\n" + voiceRef : "") +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim().slice(0, 500) : "") +
      "\n\n" + view +
      "\n\n【摊开的牌】\n" + cardList +
      "\n\n【怎么解】\n· 逐张解：每张牌结合它所在的位置、正位或逆位的含义来讲，别背牌义词典，要落到具体的处境/情绪/建议上，每张 40~90 字。\n" +
      "· 正位、逆位要真的解出差别，别把逆位也当正位讲。\n" +
      "· summary（40~110 字）：把几张牌连成一句话的走向或一句真心的提醒。\n" +
      "· " + thoughtAsk + "（20~50 字）。\n" +
      "【输出】只输出 JSON：{\"reads\":[{\"pos\":\"位置名\",\"text\":\"这张牌的解读\"}...],\"summary\":\"收束\",\"charThought\":\"角色本人的一句反应\"}。别加解释、别加代码块。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始解牌。" }], { maxTokens: 3500 });
    const p = extractJSON(raw) || {};
    let reads = Array.isArray(p.reads) ? p.reads.filter(r => r && r.text).map((r, i) => ({ pos: r.pos || spread[i] || "", text: String(r.text).trim() })) : [];
    if (!reads.length) reads = [{ pos: spread[0] || "", text: String(raw || "牌面模糊，重试。").trim() }];
    return { reads: reads, summary: String(p.summary || "").trim(), charThought: String(p.charThought || "").trim() };
  }

  async function readSupplement(active, session, char, uName, pos, card) {
    const ref = cardReference(card);
    const sys = AC() + HONEST + "\n\n你就是「" + session.charName + "」本人，仍坐在 " + uName + " 对面。" +
      "刚才的整副牌已经解完；现在只为【" + pos + "】补了一张牌。用你自己的口吻补充 50~130 字：说明它澄清了什么、推翻了什么或加重了什么。不要重做整副解牌，不要报幕。" +
      "\n【人设】" + String(char && char.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 700) +
      "\n【原问题】" + (session.question || "未明说") + "\n【原收束】" + String(session.summary || "").slice(0, 500) +
      "\n【补牌】" + cardLabel(card) + "\n【本地牌义锚点】" + ref.keywords + "；" + ref.text;
    return String(await callAI(active, sys, [{ role: "user", content: "把这张补牌接到刚才的牌位上。" }], { maxTokens: 1000 }) || "").trim();
  }

  // ============================================================
  // 模型：每日一牌 —— 今天【同一张牌】，多个角色各自解读；一次调用返回每人一句当日签
  // 注入很克制（只给此刻心情一词 + 很短的近况），避免喧宾夺主把解读搞乱。返回按传入顺序对齐 [{text}]
  // ============================================================
  async function readDailyForCard(active, card, list, uName, worldbook) {
    const block = list.map((it, i) => (i + 1) + "、「" + it.name + "」\n  人设：" + (it.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 260) + (it.mood ? "\n  此刻心情：" + it.mood : "") + (it.voiceRef ? "\n  近况一瞥：" + it.voiceRef.replace(/\n/g, "；").slice(0, 90) : "")).join("\n\n");
    const sys = AC() + NAC() + HONEST + "\n\n" + STANCE + "\n\n" +
      "今天的塔罗牌是【同一张】：" + cardLabel(card) + "。请【分别以下面每位角色本人的口吻】，就【这同一张牌】给 " + uName + " 递一句今天的当日签——短，像随口说的一两句，结合这张牌（含正/逆位）与各自人设" + (list.some(it => it.mood) ? "（有此刻心情就顺带透一点，但别喧宾夺主，牌义才是主角）" : "") + "，别混淆、别串味、别把几个人写成同一个腔调、也别千篇一律。\n\n" +
      "【要解读这张牌的角色】\n" + block +
      "\n\n【输出】只输出 JSON，readings 数组和上面角色顺序【一一对应、数量一致】：{\"readings\":[{\"name\":\"角色名\",\"text\":\"这位角色对今天这张牌的当日签\"}...]}。别加解释、别加代码块。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始发签。" }], { maxTokens: 4000 });
    const p = extractJSON(raw) || {};
    const arr = Array.isArray(p.readings) ? p.readings : [];
    // 优先按 name 对齐，兜底按顺序
    return list.map((it, i) => {
      const byName = arr.find(r => r && r.name && String(r.name).trim() === it.name);
      const r = byName || arr[i];
      return { text: r && r.text ? String(r.text).trim() : "今天的牌一时看不真切，改天再抽。" };
    });
  }

  // ============================================================
  // 主组件
  // ============================================================
  function Tarot(props) {
    const t = useTheme();
    const [saves, setSaves] = useState(loadSaves);
    const [view, setView] = useState("home"); // home | mode:<key> | s:<id>
    const [histQ, setHistQ] = useState("");       // 历史搜索
    const [histType, setHistType] = useState("all"); // 历史类型筛选
    const [histExp, setHistExp] = useState({});   // 各类别是否已展开全部
    const homeScrollRef = useRef(null);
    const homeScrollTop = useRef(0);
    const lpTimer = useRef(null), lpFired = useRef(false);
    const [confirmDel, setConfirmDel] = useState(null); // 待确认删除的占卜 id

    const persist = list => { setSaves(list); saveSaves(list); };
    const doDel = id => { persist(loadSaves().filter(s => s.id !== id)); if (view === "s:" + id) setView("home"); setConfirmDel(null); };
    const delSession = id => setConfirmDel(id);   // 长按/右键 → 弹风格统一的确认框
    const startLP = id => { lpFired.current = false; lpTimer.current = setTimeout(() => { lpFired.current = true; delSession(id); }, 550); };
    const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
    const confirmNode = confirmDel ? h(ConfirmDialog, { title: "撕掉这次占卜？", body: "删掉后就找不回来了。", confirmLabel: "撕掉", danger: true, onConfirm: () => doDel(confirmDel), onCancel: () => setConfirmDel(null) }) : null;
    const openSession = id => {
      if (homeScrollRef.current) homeScrollTop.current = homeScrollRef.current.scrollTop;
      setView("s:" + id);
    };
    React.useEffect(() => {
      if (view !== "home" || !homeScrollRef.current) return;
      const top = homeScrollTop.current;
      requestAnimationFrame(() => { if (homeScrollRef.current) homeScrollRef.current.scrollTop = top; });
    }, [view]);

    if (view.indexOf("mode:") === 0) {
      return h(Setup, {
        modeKey: view.slice(5), characters: props.characters, profile: props.profile, rels: props.rels,
        affinities: props.affinities, moods: props.moods, worldbook: props.worldbook, active: props.active, toast: props.toast,
        onCancel: () => setView("home"),
        onDone: (session, skipHook) => {
          persist([session].concat(loadSaves().filter(s => s.id !== session.id)));
          // 只更新既有的角色印象回调；塔罗本身不自动写正式记忆。
          try {
            if (props.onReadingDone && !skipHook) {
              const cardsOf = x => (x.cards || []).map(c => c.name).join("、") || (x.card ? x.card.name : "");
              if (session.mode === "daily") (session.entries || []).forEach(e => e && e.charId && props.onReadingDone(e.charId, { mode: "daily", summary: e.summary || e.text || "", charThought: e.charThought || "", cards: session.card ? session.card.name : "", question: "" }));
              else if (session.charId) props.onReadingDone(session.charId, { mode: session.mode, summary: session.summary || "", charThought: session.charThought || "", cards: cardsOf(session), question: session.question || "" });
            }
          } catch (e) {}
          setView("s:" + session.id);
        }
      });
    }
    if (view.indexOf("s:") === 0) {
      const s = saves.find(x => x.id === view.slice(2));
      if (!s) { setView("home"); return null; }
      return h(SessionView, {
        session: s, characters: props.characters, profile: props.profile, active: props.active,
        onForwardToChat: props.onForwardToChat, toast: props.toast,
        onUpdate: updated => persist(loadSaves().map(x => x.id === updated.id ? updated : x)),
        onBack: () => { setSaves(loadSaves()); setView("home"); }
      });
    }

    // ---- 落地页：四个玩法 + 历史（按类别收纳 + 日期）----
    const sorted = saves.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const byMode = {}; sorted.forEach(s => { (byMode[s.mode] = byMode[s.mode] || []).push(s); });

    const histLine = s => {
      const m = MODES[s.mode] || {};
      const subt = s.mode === "daily"
        ? (s.card ? s.card.name : "每日一牌") + " · " + ((s.entries || []).length) + " 人解读"
        : (s.mode === "reading" && s.question ? "问：" + s.question : s.charName);
      return h("div", {
        key: s.id,
        onClick: () => { if (lpFired.current) { lpFired.current = false; return; } openSession(s.id); },
        onContextMenu: e => { e.preventDefault(); delSession(s.id); },
        onTouchStart: () => startLP(s.id), onTouchEnd: cancelLP, onTouchMove: cancelLP, onTouchCancel: cancelLP,
        onMouseDown: () => startLP(s.id), onMouseUp: cancelLP, onMouseLeave: cancelLP,
        className: "active:opacity-70",
        style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 14px", cursor: "pointer" }
      },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, subt),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, flexShrink: 0 } }, fmtDate(s.ts))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          (s.mode === "daily" ? (s.card ? [cardLabel(s.card)] : []) : (s.cards || []).map(c => c.name)).join(" · ")));
    };

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: "塔罗", en: "Tarot", onBack: props.onBack }),
      h("div", { ref: homeScrollRef, className: "flex-1 overflow-y-auto px-5 pb-8" },
        h("div", { style: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 } },
          Object.keys(MODES).map(k => {
            const m = MODES[k];
            return h("button", {
              key: k, onClick: () => { if (!props.characters.length) { props.toast && props.toast("先去『名录』建个角色"); return; } setView("mode:" + k); },
              className: "w-full active:opacity-80", style: { textAlign: "left", background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 13 }
            },
              h("div", { style: { width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: ACCENT, color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, m.icon),
              h("div", { style: { minWidth: 0 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink } }, m.zh),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3, lineHeight: 1.5 } }, m.blurb)));
          })),
        // ---- 历史：搜索 + 类型筛选 + 折叠（条数多也随时找得到）----
        saves.length ? (function () {
          const qlc = histQ.trim().toLowerCase();
          const active = !!qlc || histType !== "all";              // 有搜索或选了具体类型 → 平铺筛选结果
          const matchSess = s => (histType === "all" || s.mode === histType) && (!qlc || sessionText(s).indexOf(qlc) >= 0);
          const chip = (k, label, cnt) => { const on = histType === k; return h("button", { key: k, onClick: () => setHistType(k), className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 12, color: on ? "#fff" : t.sub, background: on ? ACCENT : t.bg2, border: "1px solid " + (on ? ACCENT : t.line), borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" } }, label + (cnt != null ? " " + cnt : "")); };
          return h("div", null,
            // 搜索框
            h("div", { style: { position: "relative", marginBottom: 10 } },
              h("span", { style: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: t.fog } }, "🔍"),
              h("input", { value: histQ, onChange: e => setHistQ(e.target.value), placeholder: "搜角色 / 问题 / 牌名…",
                style: { width: "100%", fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "9px 32px 9px 32px", outline: "none" } }),
              qlc ? h("button", { onClick: () => setHistQ(""), className: "active:opacity-60", style: { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: t.fog, lineHeight: 1 } }, "×") : null),
            // 类型筛选 chips（横滑）
            h("div", { style: { display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, marginBottom: 14 } },
              [chip("all", "全部", saves.length)].concat(Object.keys(MODES).filter(k => (byMode[k] || []).length).map(k => chip(k, MODES[k].icon + " " + MODES[k].zh, byMode[k].length)))),
            // 列表
            active
              ? (function () { const list = sorted.filter(matchSess);
                  return list.length
                    ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, list.map(histLine))
                    : h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "24px 0" } }, "没找到相关占卜"); })()
              : Object.keys(MODES).filter(k => (byMode[k] || []).length).map(k => {
                  const arr = byMode[k], exp = !!histExp[k], shown = exp ? arr : arr.slice(0, 3);
                  return h("div", { key: "h" + k, style: { marginBottom: 18 } },
                    h("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 9 } },
                      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: GOLD } }, MODES[k].icon),
                      h("span", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: t.sub, letterSpacing: .3 } }, MODES[k].zh),
                      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "· " + arr.length)),
                    h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, shown.map(histLine)),
                    arr.length > 3 ? h("button", { onClick: () => setHistExp(p => ({ ...p, [k]: !exp })), className: "active:opacity-60",
                      style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11.5, color: ACCENT } }, exp ? "收起" : "展开全部 " + arr.length + " 条 ▾") : null);
                }),
            h("div", { style: { marginTop: 10, textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, "长按一条可撕掉"));
        })() : null
      ),
      confirmNode);
  }

  // ============================================================
  // 发起：选角色（+问题）→ 抽牌 → 解牌
  // ============================================================
  function Setup(props) {
    const t = useTheme();
    const m = MODES[props.modeKey];
    const [charId, setCharId] = useState("");
    const [dailyAll, setDailyAll] = useState(false); // 每日一牌：一次抽全部角色
    const [q, setQ] = useState("");
    const [spreadKey, setSpreadKey] = useState(DEFAULT_SPREAD[props.modeKey] || "guide");
    const [questionOwner, setQuestionOwner] = useState("user");
    const [gate, setGate] = useState(null); // 角色接受/犹豫/拒绝的当面回应
    const [customSpreads, setCustomSpreads] = useState(loadCustomSpreads);
    const [spreadEditor, setSpreadEditor] = useState(false);
    const [spreadName, setSpreadName] = useState("");
    const [spreadPositions, setSpreadPositions] = useState("");
    const [deal, setDeal] = useState(null); // 先在本地选牌，选完才调用模型解牌
    const [shopMoment] = useState(pickShopMoment);
    const bgKey = "tarot:active";
    const bg = window.BackgroundGeneration;
    const initialTask = bg ? bg.state(bgKey) : null;
    const [busy, setBusy] = useState(!!(initialTask && initialTask.busy));
    const [phase, setPhase] = useState((initialTask && initialTask.label) || "");

    React.useEffect(() => {
      if (!bg) return;
      const sync = s => { setBusy(!!s.busy); setPhase(s.busy ? (s.label || "生成中…") : ""); };
      sync(bg.state(bgKey));
      return bg.subscribe(bgKey, sync);
    }, []);

    const uName = (props.profile && props.profile.name) || "我";
    const isDailyAll = m.daily && dailyAll;
    const supportsQuestionOwner = props.modeKey === "reading" || props.modeKey === "forchar";
    const allSpreads = Object.assign({}, SPREADS);
    customSpreads.forEach(x => { allSpreads["custom:" + x.id] = { zh: x.name, hint: x.positions.join(" · "), positions: x.positions, custom: true, id: x.id }; });
    const spread = m.daily ? m.spread : ((allSpreads[spreadKey] && allSpreads[spreadKey].positions) || m.spread);

    const moodOf = id => { const mo = props.moods && props.moods[id]; return mo && mo.label ? String(mo.label) : ""; };

    const go = async () => {
      if (!isDailyAll && !charId) { props.toast && props.toast("先选一个角色"); return; }
      if (supportsQuestionOwner && questionOwner === "user" && !q.trim()) { props.toast && props.toast(props.modeKey === "forchar" ? "写下你想替 Ta 问的事" : "写下你想问的事"); return; }
      if (!supportsQuestionOwner && spreadKey === "choice" && !q.trim()) { props.toast && props.toast("把选择 A 和选择 B 写清楚"); return; }
      const rels = props.rels || {};

      // 每日一牌：一天只抽【一张】牌（全体共用），各角色解读【同一张】。
      // 同一天已抽的角色直接取旧解读；新角色（含点「全部角色」补齐没解过的人）追加进同一天的会话。
      if (m.daily) {
        const tk = todayKey();
        const card = todayCard(); // 今天这张牌，抽一次后当天固定
        const existing = loadSaves().find(s => s.mode === "daily" && s.dayKey === tk);
        const c0 = props.characters.find(x => x.id === charId);
        const wantChars = isDailyAll ? props.characters : (c0 ? [c0] : []);
        if (!wantChars.length) { props.toast && props.toast("先去『名录』建个角色"); return; }
        const have = {}; (existing && existing.entries || []).forEach(e => { have[e.charId] = true; });
        const toGen = wantChars.filter(x => !have[x.id]);
        if (!toGen.length && existing) { props.onDone(existing, true); return; } // 想看的人都解过了 → 直接看(纯回看,不再回流一次)
        setBusy(true); setPhase(existing ? "解读今天这张牌…" : "正在翻开今天的牌…");
        try {
          const run = async update => {
            update(null, existing ? "解读今天这张牌…" : "正在翻开今天的牌…");
            const list = toGen.map(x => ({ id: x.id, name: x.name, persona: x.persona || "", mood: moodOf(x.id), voiceRef: recentChat(x.id, uName, x.name) }));
            const outs = await readDailyForCard(props.active, card, list, uName, props.worldbook);
            const newEntries = toGen.map((x, i) => ({ charId: x.id, charName: x.name, text: outs[i] ? outs[i].text : "" }));
            const merged = (existing && existing.entries || []).concat(newEntries);
            const session = { id: "tr_daily_" + tk, mode: "daily", dayKey: tk, card: card, entries: merged, all: isDailyAll || !!(existing && existing.all), ts: Date.now() };
            props.onDone(session);
            return session;
          };
          if (bg) await bg.start(bgKey, { label: phase || "正在翻开今天的牌…" }, run); else await run(() => {});
        } catch (e) { props.toast && props.toast("牌没摊开：" + (e.message || "重试")); setBusy(false); setPhase(""); }
        return;
      }

      const c = props.characters.find(x => x.id === charId);
      setBusy(true); setPhase("正在洗牌…");
      try {
        const prepare = async update => {
          let finalQuestion = q.trim();
          let intent = null;
          if (props.modeKey === "forchar" || (props.modeKey === "reading" && questionOwner === "character")) {
            update(null, props.modeKey === "forchar" ? "先问问 " + c.name + " 愿不愿意…" : c.name + " 正在想要问什么…");
            intent = await askReadingIntent(props.active, {
              mode: props.modeKey, charName: c.name, charPersona: c.persona || "", uName: uName,
              mood: moodOf(c.id), voiceRef: recentChat(c.id, uName, c.name)
            });
            setGate(intent);
            if (props.modeKey === "forchar" && intent.decision === "refuse") {
              update(null, "");
              return { refused: true, intent: intent };
            }
            if (questionOwner === "character" || !finalQuestion) finalQuestion = intent.question || (props.modeKey === "forchar" ? "我此刻最该看清什么" : "我最近最该留意什么");
          }
          update(null, "正在洗牌…");
          return { finalQuestion: finalQuestion, intent: intent };
        };
        const prepared = bg ? await bg.start(bgKey, { label: "正在洗牌…" }, prepare) : await prepare(() => {});
        if (prepared && prepared.refused) { setBusy(false); setPhase(""); return; }
        const poolSize = Math.max(12, Math.min(24, spread.length * 3));
        setDeal({
          pool: shuffle(DECK).slice(0, poolSize).map(c0 => ({ name: c0.name, major: c0.major, rev: Math.random() < 0.34 })),
          chosen: [], finalQuestion: prepared.finalQuestion, intent: prepared.intent
        });
        setBusy(false); setPhase("");
      } catch (e) { props.toast && props.toast("牌没摊开：" + (e.message || "重试")); setBusy(false); setPhase(""); }
    };

    const finishDeal = async () => {
      if (!deal || deal.chosen.length !== spread.length) { props.toast && props.toast("还要选满 " + spread.length + " 张牌"); return; }
      const c = props.characters.find(x => x.id === charId);
      const rels = props.rels || {};
      setBusy(true); setPhase("牌已选好，" + c.name + "正在解读…");
      try {
        const run = async update => {
          const cards = deal.chosen.map(i => deal.pool[i]);
          update(null, "牌已摊开，" + c.name + "正在解读…");
          const r1 = rels[c.id + "->me"], r2 = rels["me->" + c.id];
          const relText = [r2 && r2.label ? "你把 Ta 当作：" + r2.label : "", r1 && r1.label ? "Ta 把你当作：" + r1.label : ""].filter(Boolean).join("；");
          const aff = props.affinities ? props.affinities[c.id] : null;
          const out = await readSpread(props.active, {
            mode: props.modeKey, cards: cards, spread: spread,
            charName: c.name, charPersona: c.persona || "", uName: uName,
            question: deal.finalQuestion, relText: relText,
            band: (props.modeKey === "relation" || props.modeKey === "reading") ? affBand(aff) : "",
            voiceRef: recentChat(c.id, uName, c.name), mood: moodOf(c.id), worldbook: props.worldbook
          });
          const session = { id: "tr_" + Date.now(), mode: props.modeKey, charId: c.id, charName: c.name,
            question: deal.finalQuestion, questionOwner: questionOwner, spreadKey: spreadKey, spread: spread,
            cards: cards, reads: out.reads, summary: out.summary, charThought: out.charThought,
            consent: deal.intent ? { decision: deal.intent.decision, line: deal.intent.line } : null,
            shopMoment: shopMoment, revealed: [], supplements: [], followups: [], ts: Date.now() };
          props.onDone(session);
          return session;
        };
        if (bg) await bg.start(bgKey, { label: phase || "正在解读…" }, run); else await run(() => {});
      } catch (e) { props.toast && props.toast("牌没摊开：" + (e.message || "重试")); setBusy(false); setPhase(""); }
    };

    const saveSpread = () => {
      const name = spreadName.trim();
      const positions = spreadPositions.split(/\n|，|,/).map(x => x.trim()).filter(Boolean);
      if (!name) { props.toast && props.toast("给牌阵起个名字"); return; }
      if (positions.length < 1 || positions.length > 8) { props.toast && props.toast("牌位请写 1～8 个"); return; }
      const item = { id: "cs_" + Date.now(), name: name.slice(0, 18), positions: positions.map(x => x.slice(0, 30)) };
      const next = customSpreads.concat(item);
      setCustomSpreads(next); saveCustomSpreads(next); setSpreadKey("custom:" + item.id);
      setSpreadEditor(false); setSpreadName(""); setSpreadPositions("");
    };

    const label = { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: t.sub, marginBottom: 8, letterSpacing: .3 };

    if (busy) return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: m.zh, en: m.en, onBack: props.onCancel }),
      h("div", { className: "flex-1 flex flex-col items-center justify-center px-8" },
        h("div", { style: { fontSize: 40, color: ACCENT, marginBottom: 18 } }, m.icon),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: t.ink, textAlign: "center" } }, phase || "…")));

    if (deal) {
      const chosen = deal.chosen || [];
      const toggleCard = i => setDeal(prev => {
        const has = prev.chosen.indexOf(i) >= 0;
        const next = has ? prev.chosen.filter(x => x !== i) : (prev.chosen.length < spread.length ? prev.chosen.concat(i) : prev.chosen);
        return { ...prev, chosen: next };
      });
      return h("div", { className: "h-full flex flex-col" },
        h(Head, { zh: "亲手选牌", en: "Choose Your Cards", onBack: () => setDeal(null) }),
        h("div", { className: "flex-1 overflow-y-auto px-5 pb-32" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, lineHeight: 1.7, marginBottom: 15 } }, "凭第一眼选 " + spread.length + " 张。模型看不到没选中的牌，也不会替你挑。"),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + Math.min(4, spread.length) + ",minmax(0,1fr))", gap: 7, marginBottom: 18 } },
            spread.map((pos, i) => h("div", { key: pos + i, style: { minHeight: 54, padding: "7px 5px", borderRadius: 9, border: "1px solid " + (chosen[i] != null ? GOLD : t.line), background: chosen[i] != null ? "rgba(184,145,80,.08)" : t.bg2, textAlign: "center" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog, marginBottom: 4 } }, "第 " + (i + 1) + " 张"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.ink, lineHeight: 1.3 } }, pos)))),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 9 } }, deal.pool.map((c0, i) => {
            const selectedAt = chosen.indexOf(i), on = selectedAt >= 0;
            return h("button", { key: "back" + i, onClick: () => toggleCard(i), className: "active:opacity-70",
              style: { position: "relative", aspectRatio: "2/3.25", borderRadius: 9, border: "1px solid " + (on ? GOLD : "rgba(184,145,80,.38)"), background: "linear-gradient(145deg,#241f38," + ACCENT + ")", boxShadow: on ? "0 0 0 2px rgba(184,145,80,.22)" : "none", color: GOLD } },
              h("div", { style: { position: "absolute", inset: 5, border: "1px solid rgba(184,145,80,.32)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 } }, on ? String(selectedAt + 1) : "✦"));
          })),
          h("div", { style: { textAlign: "center", marginTop: 14, fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "已选 " + chosen.length + " / " + spread.length)),
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 20px calc(10px + env(safe-area-inset-bottom) * 0.4)", background: "linear-gradient(to top," + t.bg + " 78%,transparent)" } },
          h("button", { onClick: finishDeal, disabled: chosen.length !== spread.length, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#fff", background: chosen.length === spread.length ? ACCENT : t.fog, borderRadius: 12, padding: "13px 0" } }, "请 " + ((props.characters.find(x => x.id === charId) || {}).name || "Ta") + " 解牌")));
    }

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: m.zh, en: m.en, onBack: props.onCancel }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-32" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.7, marginBottom: 20 } }, m.blurb + "。"),
        h("div", { style: { marginBottom: 18, padding: "10px 12px", borderLeft: "2px solid " + GOLD, background: "rgba(184,145,80,0.06)", fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.65, color: t.sub } }, shopMoment),
        // 每日一牌：一次抽全部角色
        m.daily ? h("button", { onClick: () => setDailyAll(v => !v), className: "w-full active:opacity-80",
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", background: isDailyAll ? "rgba(74,63,107,0.08)" : t.bg2, border: "1px solid " + (isDailyAll ? ACCENT : t.line), borderRadius: 11, marginBottom: 16 } },
          h("div", { style: { textAlign: "left" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink } }, "让全部角色都解读"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, "所有人解读今天【同一张】牌，一次生成全部（省次数），进去挨个看")),
          h("div", { style: { width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: "1px solid " + (isDailyAll ? ACCENT : t.line), background: isDailyAll ? ACCENT : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 } }, isDailyAll ? "✓" : "")) : null,
        isDailyAll ? null : h("div", { style: label }, props.modeKey === "forchar" ? "替谁算" : props.modeKey === "relation" ? "算你和谁" : "请谁替你解牌"),
        isDailyAll ? null : h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 } },
          props.characters.map(c => {
            const on = charId === c.id;
            return h("button", { key: c.id, onClick: () => { setCharId(prev => prev === c.id ? "" : c.id); setGate(null); }, className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : t.ink, background: on ? ACCENT : t.bg2, border: "1px solid " + (on ? ACCENT : t.line), borderRadius: 999, padding: "8px 15px" } }, c.name);
          })),
        !m.daily ? h("div", { style: label }, "怎么摊牌") : null,
        !m.daily ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 20 } },
          Object.keys(allSpreads).map(k => {
            const sp = allSpreads[k], on = spreadKey === k;
            return h("button", { key: k, onClick: () => setSpreadKey(k), className: "active:opacity-70",
              style: { minHeight: 62, padding: "9px 10px", textAlign: "left", background: on ? "rgba(74,63,107,0.1)" : t.bg2, border: "1px solid " + (on ? ACCENT : t.line), borderRadius: 11 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, fontWeight: on ? 700 : 500 } }, sp.zh),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3, lineHeight: 1.4 } }, sp.hint));
          }),
          h("button", { onClick: () => setSpreadEditor(v => !v), className: "active:opacity-70", style: { minHeight: 62, padding: "9px 10px", textAlign: "left", background: t.bg2, border: "1px dashed " + ACCENT, borderRadius: 11 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACCENT, fontWeight: 700 } }, "＋ 自定义牌阵"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: t.fog, marginTop: 3 } }, "自己写 1～8 个牌位"))) : null,
        spreadEditor ? h("div", { style: { margin: "-10px 0 20px", padding: 12, background: "rgba(74,63,107,.05)", border: "1px solid rgba(74,63,107,.18)", borderRadius: 12 } },
          h("input", { value: spreadName, onChange: e => setSpreadName(e.target.value), placeholder: "牌阵名字", style: { width: "100%", marginBottom: 8, padding: "9px 10px", borderRadius: 9, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none", fontFamily: F_BODY, fontSize: 13 } }),
          h("textarea", { value: spreadPositions, onChange: e => setSpreadPositions(e.target.value), rows: 4, placeholder: "每行一个牌位\n如：我真正想要的\n我没看见的阻碍\n下一步", style: { width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid " + t.line, background: t.bg2, color: t.ink, outline: "none", resize: "none", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55 } }),
          h("button", { onClick: saveSpread, className: "w-full active:opacity-75", style: { marginTop: 8, padding: "9px 0", borderRadius: 9, color: "#fff", background: ACCENT, fontFamily: F_BODY, fontSize: 12.5 } }, "保存并选中")) : null,
        supportsQuestionOwner ? h("div", { style: label }, "谁来定这次的问题") : null,
        supportsQuestionOwner ? h("div", { style: { display: "flex", gap: 8, marginBottom: 14 } },
          [["user", props.modeKey === "forchar" ? "我替 Ta 问" : "我来问"], ["character", "让 Ta 自己问"]].map(it => h("button", {
            key: it[0], onClick: () => { setQuestionOwner(it[0]); setGate(null); }, className: "active:opacity-70",
            style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, color: questionOwner === it[0] ? "#fff" : t.ink, background: questionOwner === it[0] ? ACCENT : t.bg2, border: "1px solid " + (questionOwner === it[0] ? ACCENT : t.line), borderRadius: 999, padding: "9px 10px" }
          }, it[1]))) : null,
        supportsQuestionOwner && questionOwner === "user" ? h("div", { style: label }, props.modeKey === "forchar" ? "你想替 Ta 问的事" : "你想问的事") : null,
        supportsQuestionOwner && questionOwner === "user" ? h("textarea", { value: q, onChange: e => setQ(e.target.value), rows: 3, placeholder: props.modeKey === "forchar" ? "如：Ta 最近真正放不下的是什么？" : m.qHint,
          style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, padding: "11px 13px", width: "100%", outline: "none", resize: "none", marginBottom: 8 } }) : null,
        supportsQuestionOwner && questionOwner === "character" ? h("div", { style: { marginBottom: 14, padding: "10px 12px", borderRadius: 11, border: "1px dashed " + t.line, fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: t.fog } }, "洗牌前会先问 Ta。Ta 会按自己的近况挑问题，不会由系统硬塞一个秘密。") : null,
        !supportsQuestionOwner && !m.daily && spreadKey === "choice" ? h("div", { style: label }, "把两个选择写清楚") : null,
        !supportsQuestionOwner && !m.daily && spreadKey === "choice" ? h("textarea", { value: q, onChange: e => setQ(e.target.value), rows: 3, placeholder: "A：……\nB：……",
          style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 11, padding: "11px 13px", width: "100%", outline: "none", resize: "none", marginBottom: 8 } }) : null,
        gate ? h("div", { style: { marginBottom: 14, padding: "11px 13px", borderRadius: 11, background: gate.decision === "refuse" ? "rgba(170,80,80,.07)" : "rgba(74,63,107,.07)", border: "1px solid " + (gate.decision === "refuse" ? "rgba(170,80,80,.25)" : "rgba(74,63,107,.2)") } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: gate.decision === "refuse" ? "#a85b5b" : GOLD, marginBottom: 4 } }, gate.decision === "refuse" ? "Ta 这次不想算" : gate.decision === "hesitate" ? "Ta 犹豫了一下，还是坐下了" : "Ta 答应了"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, lineHeight: 1.65 } }, gate.line)) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.7 } },
          m.daily ? "今天只有【一张】牌，所有人解读同一张。" : "会摊开 " + spread.length + " 张牌：" + spread.join(" · ") + "。",
          h("br"), "牌是随机抽出的，模型只解读、不挑牌。")
      ),
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 20px calc(10px + env(safe-area-inset-bottom) * 0.4)", background: "linear-gradient(to top," + t.bg + " 78%,transparent)" } },
        h("button", { onClick: go, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#fff", background: ACCENT, borderRadius: 12, padding: "13px 0" } }, m.daily ? "翻开今日牌" : "洗牌 · 去选牌")));
  }

  // ============================================================
  // 一次占卜的正文
  // ============================================================
  async function continueAtTable(active, session, char, uName, history, question) {
    const cards = (session.cards || []).map((c, i) => "【" + ((session.spread || [])[i] || "第" + (i + 1) + "张") + "】" + cardLabel(c)).join("；");
    const reads = (session.reads || []).map(r => (r.pos || "") + "：" + r.text).join("\n");
    const sys = AC() + "你就是「" + session.charName + "」本人。占卜已经结束，但你和 " + uName + " 还坐在店里的小桌边。" +
      "现在是围绕刚才这副牌自然说话，不是重新生成一份解牌报告，也不是客服答疑。你可以赞同、保留、调侃、追问，或者承认自己也没想明白；保持你自己对占卜的态度和人设。" +
      "不要声称牌能证明事实，不要每次都总结人生。用第一人称，通常一两段就够。" +
      "\n\n【你的人设】" + String(char && char.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 850) +
      "\n【原问题】" + (session.question || "未明说") +
      "\n【牌面】" + cards +
      "\n【刚才的解读】\n" + reads.slice(0, 1800) +
      "\n【收束】" + String(session.summary || "").slice(0, 600);
    const msgs = (history || []).slice(-10).map(x => ({ role: x.role === "assistant" ? "assistant" : "user", content: x.content }));
    msgs.push({ role: "user", content: question });
    return String(await callAI(active, sys, msgs, { maxTokens: 1400 }) || "").trim();
  }

  function SessionView(props) {
    const t = useTheme();
    const s = props.session;
    const m = MODES[s.mode] || {};
    const [fwd, setFwd] = useState(false);
    const [forwarded, setForwarded] = useState(false);
    const [followups, setFollowups] = useState(Array.isArray(s.followups) ? s.followups : []);
    const [followText, setFollowText] = useState("");
    const [followBusy, setFollowBusy] = useState(false);
    const oldSession = !Array.isArray(s.revealed);
    const [revealed, setRevealed] = useState(oldSession ? (s.cards || []).map((_, i) => i) : s.revealed);
    const [supplements, setSupplements] = useState(Array.isArray(s.supplements) ? s.supplements : []);
    const [suppBusy, setSuppBusy] = useState(null);
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 解牌朗读（懒合成，重听免费）
    const chOf = function (id) { return (props.characters || []).find(function (c) { return c.id === id; }); };
    const char = chOf(s.charId);
    const dot = function (k, text, spk) { return (tp && spk && typeof TtsDot === "function") ? h(TtsDot, { k: k, text: text, spk: spk, tp: tp }) : null; };

    // 一张牌片
    const cardTile = (c, pos, i, small, faceUp, onFlip) => h("div", { key: "c" + i, style: { flex: small ? "0 0 auto" : "1 1 0", width: small ? 74 : "auto", minWidth: small ? 74 : 88, maxWidth: small ? 74 : 130 } },
      h("button", { onClick: onFlip || null, disabled: !onFlip, className: onFlip ? "active:opacity-80" : "", style: { width: "100%", position: "relative", aspectRatio: "2/3.4", borderRadius: 11, background: "linear-gradient(160deg," + ACCENT + ",#241f38)", border: "1px solid rgba(184,145,80,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 8, overflow: "hidden", transition: "transform .35s ease", transform: faceUp === false ? "rotateY(180deg)" : "rotateY(0deg)" } },
        faceUp === false ? h("div", { style: { position: "absolute", inset: 7, border: "1px solid rgba(184,145,80,.5)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: small ? 17 : 24, transform: "rotateY(180deg)" } }, "✦") : null,
        faceUp === false ? null : [
        h("div", { style: { position: "absolute", top: 6, left: 8, fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: 1, color: "rgba(184,145,80,0.85)" } }, c.major ? "ARCANA" : ""),
        h("div", { style: { fontSize: small ? 17 : 22, color: GOLD, marginBottom: 8, transform: c.rev ? "rotate(180deg)" : "none" } }, m.icon || "✦"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: small ? 13 : 15, color: "#f4efe4", textAlign: "center", lineHeight: 1.25 } }, c.name),
        h("div", { style: { marginTop: 6, fontFamily: F_BODY, fontSize: small ? 9 : 10, color: c.rev ? "#e0a3a3" : "rgba(244,239,228,0.7)", border: "1px solid rgba(184,145,80,0.4)", borderRadius: 999, padding: "1px 8px" } }, c.rev ? "逆位" : "正位")]),
      pos ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, textAlign: "center", marginTop: 6 } }, pos) : null);

    // ---- 每日一牌：今天【一张】牌，各角色解读同一张 ----
    if (s.mode === "daily") {
      const entries = s.entries || [];
      const dc = s.card || (entries[0] && entries[0].card); // 兼容旧数据（旧版每人各一张时取第一张）
      return h("div", { className: "h-full flex flex-col" },
        h(Head, { zh: m.zh, en: m.en, onBack: props.onBack }),
        h("div", { className: "flex-1 overflow-y-auto px-5 pb-10" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginBottom: 14, textAlign: "center" } }, fmtDate(s.ts) + " · 今天的牌"),
          // 今天这一张牌（全体共用）
          dc ? h("div", { style: { display: "flex", justifyContent: "center", marginBottom: 8 } }, cardTile(dc, "", 0, false, true)) : null,
          dc ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: t.sub, marginBottom: 22 } }, cardLabel(dc)) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, fontWeight: 700, color: t.sub, marginBottom: 12, letterSpacing: .3 } }, "各人怎么看这张牌"),
          entries.map((e, i) => h("div", { key: i, style: { marginBottom: 15, paddingBottom: 15, borderBottom: i < entries.length - 1 ? "1px solid " + t.line : "none" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 5, marginBottom: 3 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, e.charName),
              dot("td" + i, e.text, chOf(e.charId))),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: t.ink } }, e.text)))));
    }

    // ---- reading / relation / forchar ----
    const cards = s.cards || [];
    const subject = s.mode === "forchar" ? "为 " + s.charName + " 而算" : s.mode === "relation" ? "你 与 " + s.charName : s.charName + " 为你解牌";
    const doForward = async () => {
      if (fwd || !props.onForwardToChat) return;
      setFwd(true);
      try {
        await props.onForwardToChat(s);
        setForwarded(true);
      } finally { setFwd(false); }
    };
    const sendFollowup = async () => {
      const text = followText.trim();
      if (!text || followBusy || !char) return;
      const mine = { id: "tfu_" + Date.now(), role: "user", content: text, ts: Date.now() };
      const next = followups.concat(mine);
      setFollowups(next); setFollowText(""); setFollowBusy(true);
      try {
        const answer = await continueAtTable(props.active, s, char, (props.profile && props.profile.name) || "Lisa", followups, text);
        const done = next.concat({ id: "tfa_" + Date.now(), role: "assistant", content: answer || "……", ts: Date.now() });
        setFollowups(done);
        props.onUpdate && props.onUpdate({ ...s, followups: done });
      } catch (e) {
        props.toast && props.toast("桌边的话没接上：" + (e.message || "重试"));
      } finally { setFollowBusy(false); }
    };
    const revealCard = i => {
      if (revealed.indexOf(i) >= 0) return;
      const next = revealed.concat(i);
      setRevealed(next);
      props.onUpdate && props.onUpdate({ ...s, revealed: next, supplements: supplements });
    };
    const allRevealed = cards.every((_, i) => revealed.indexOf(i) >= 0);
    const addSupplement = async (i, pos) => {
      if (suppBusy != null) return;
      if (supplements.length >= 3) { props.toast && props.toast("一副牌最多补 3 张"); return; }
      const card = draw(1)[0];
      setSuppBusy(i);
      let text = "";
      try {
        text = await readSupplement(props.active, s, char, (props.profile && props.profile.name) || "Lisa", pos, card);
      } catch (e) {
        text = cardReference(card).text;
        props.toast && props.toast("补牌解读没接上，先保留了牌面");
      }
      const item = { id: "tsp_" + Date.now(), posIndex: i, pos: pos, card: card, text: text, ts: Date.now() };
      const next = supplements.concat(item);
      setSupplements(next);
      props.onUpdate && props.onUpdate({ ...s, revealed: revealed, supplements: next });
      setSuppBusy(null);
    };

    return h("div", { className: "h-full flex flex-col" },
      h(Head, { zh: m.zh || "占卜", en: m.en, onBack: props.onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-10" },
        // 抬头
        h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: GOLD, fontWeight: 700 } }, m.icon),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, subject)),
        s.shopMoment ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.6, margin: "5px 0 12px", paddingLeft: 9, borderLeft: "2px solid " + GOLD } }, s.shopMoment) : null,
        s.consent && s.consent.line ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginBottom: 10 } }, s.charName + "入座前说：『" + s.consent.line + "』") : null,
        s.mode !== "daily" && s.question ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.sub, fontStyle: "italic", marginBottom: 16 } }, "「" + s.question + "」") : h("div", { style: { height: 12 } }),
        // 「给角色算一卦」的主动作必须在牌面之前看得见，不能埋到整篇解读和追问区之后。
        s.mode === "forchar" && props.onForwardToChat ? h("button", {
          onClick: doForward, disabled: fwd || forwarded, className: "w-full active:opacity-80",
          style: { margin: "0 0 18px", fontFamily: F_BODY, fontSize: 13.5, fontWeight: 700,
            color: forwarded ? ACCENT : "#fff", background: forwarded ? "rgba(74,63,107,.08)" : (fwd ? t.fog : ACCENT),
            border: forwarded ? "1px solid rgba(74,63,107,.22)" : "1px solid transparent", borderRadius: 12, padding: "12px 0" }
        }, fwd ? "正在转发…" : (forwarded ? "✓ 已转发给 " + s.charName : "把这一卦转发给 " + s.charName)) : null,
        // 牌阵
        h("div", { style: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 } },
          cards.map((c, i) => cardTile(c, (s.spread || [])[i] || "", i, false, revealed.indexOf(i) >= 0, () => revealCard(i)))),
        h("div", { style: { margin: "-6px 0 18px", fontFamily: F_BODY, fontSize: 11, color: t.fog, textAlign: "center" } },
          allRevealed ? "牌已全部翻开 · 可按牌位补牌（全局最多 3 张）" : "逐张点牌翻开；全部翻完才揭示完整解读"),
        cards.map((c, i) => revealed.indexOf(i) < 0 ? null : h("div", { key: "ref" + i, style: { marginBottom: 9, padding: "9px 11px", borderRadius: 10, background: t.bg2, border: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, color: GOLD, marginBottom: 3 } }, ((s.spread || [])[i] || "第 " + (i + 1) + " 张") + " · " + cardReference(c).keywords),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, lineHeight: 1.6 } }, cardReference(c).text))),
        // 逐张解读
        allRevealed ? (s.reads || []).map((r, i) => h("div", { key: "r" + i, style: { marginBottom: 16 } },
          h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, color: ACCENT, background: "rgba(74,63,107,0.1)", borderRadius: 6, padding: "1px 8px" } }, r.pos || (s.spread || [])[i] || ("第" + (i + 1) + "张")),
            cards[i] ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, cardLabel(cards[i])) : null,
            dot("tr" + i, r.text, char)),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: t.ink, whiteSpace: "pre-wrap" } }, r.text),
          supplements.filter(x => x.posIndex === i).map((x, j) => h("div", { key: x.id || ("sp" + i + j), style: { display: "flex", gap: 10, marginTop: 10, padding: 10, borderRadius: 11, background: "rgba(184,145,80,.07)", border: "1px solid rgba(184,145,80,.24)" } },
            cardTile(x.card, "补牌", 100 + i * 10 + j, true, true),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: GOLD, fontWeight: 700, marginBottom: 4 } }, cardLabel(x.card) + " · " + cardReference(x.card).keywords),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.ink, lineHeight: 1.65 } }, x.text)))),
          supplements.length < 3 ? h("button", { onClick: () => addSupplement(i, r.pos || (s.spread || [])[i] || "这个牌位"), disabled: suppBusy != null, className: "active:opacity-70", style: { marginTop: 9, fontFamily: F_BODY, fontSize: 11.5, color: ACCENT, border: "1px dashed rgba(74,63,107,.35)", borderRadius: 999, padding: "5px 10px" } }, suppBusy === i ? "正在补牌…" : "＋ 为这个牌位补一张") : null)) : null,
        // 收束
        allRevealed && s.summary ? h("div", { style: { marginTop: 8, padding: "14px 16px", background: "rgba(74,63,107,0.06)", border: "1px solid rgba(74,63,107,0.22)", borderRadius: 13 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, letterSpacing: .5, color: ACCENT, marginBottom: 6 } }, "牌面的话"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: t.ink } }, s.summary)) : null,
        // 角色本人对这几张牌的想法
        allRevealed && s.charThought ? h("div", { style: { marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", background: t.bg2, border: "1px solid " + t.line, borderRadius: 13 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: GOLD, flexShrink: 0 } }, s.charName + "："),
          h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.75, color: t.ink, fontStyle: "italic" } }, s.charThought),
          dot("tct", s.charThought, char)) : null,
        allRevealed && char ? h("div", { style: { marginTop: 20, paddingTop: 17, borderTop: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink, marginBottom: 3 } }, "小桌边继续聊"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.5, marginBottom: 11 } }, "追问只留在这次占卜里；转发进聊天后，才会进入聊天上下文。"),
          followups.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 } }, followups.map(x => h("div", {
            key: x.id, style: { alignSelf: x.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "9px 11px", borderRadius: 12, background: x.role === "user" ? "rgba(74,63,107,.1)" : t.bg2, border: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.65, color: t.ink, whiteSpace: "pre-wrap" }
          }, x.content))) : null,
          h("div", { style: { display: "flex", gap: 8, alignItems: "flex-end" } },
            h("textarea", { value: followText, onChange: e => setFollowText(e.target.value), rows: 2, placeholder: "再问一句，或只是和 Ta 聊聊这副牌…", disabled: followBusy,
              style: { flex: 1, minWidth: 0, resize: "none", outline: "none", borderRadius: 11, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "9px 10px", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.5 } }),
            h("button", { onClick: sendFollowup, disabled: followBusy || !followText.trim(), className: "active:opacity-70",
              style: { flexShrink: 0, width: 48, height: 48, borderRadius: 12, color: "#fff", background: followBusy || !followText.trim() ? t.fog : ACCENT, fontFamily: F_BODY, fontSize: 12 } }, followBusy ? "…" : "说"))) : null,
        null));
  }

  window.Tarot = Tarot;
})();
