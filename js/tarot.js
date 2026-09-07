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
  // 禁烟这一层（她 2026-09-05：「你看看还有哪儿没禁烟的」）。
  // ⚠️它是【世界事实】，不是文风：这个 app 里没人抽烟，那在哪一处都得成立。
  //   原来它只挂在 buildBundle / groupBans 上，于是【凡是自己拼 sys 的地方一律没有】。
  //   不许塞进 ANTI_CLICHE 搭便车（v55.90 那条：能独立成立的规则就让它独立成立，
  //   挂在别人身上，别人不发的那一轮它就跟着消失）。
  const CB = () => (typeof ContentBoundaries !== "undefined" && ContentBoundaries.prompt ? ContentBoundaries.prompt + "\n\n" : "");

  const NAC = () => (typeof NARRATIVE_ANTI_CLICHE !== "undefined" ? NARRATIVE_ANTI_CLICHE + "\n\n" : "");
  // 忠于牌面、别为讨好而美化
  const HONEST = "【忠于牌面】牌是随机抽出的、无法更改。别为了讨好或安慰就把凶牌、逆位往好里圆——该警示就警示、该沉就沉，正位逆位要解出真差别，像一次正经的占卜，不是心灵鸡汤。";
  // 换个角色只换语气、结构一模一样，是塔罗显得单薄的一个来源：让人设决定 Ta 跟这副牌的关系。
  const STANCE = "【你自己对占卜这件事的态度，由你的人设决定】你可以是真信的、半信半疑的、嘴上不信却认真解的、觉得这是无聊游戏但还是陪着的、甚至对某张牌有私人忌讳。这个态度要渗进你怎么说话——理性的人会先说明这只是概率与投射再照解不误，信的人翻到凶牌会真的皱眉。但不管什么态度，都不许因此敷衍牌面或拒绝解读：忠于牌面的要求高于你的态度。";

  // ---- 牌堆 ----
  const MAJORS = ["愚者", "魔术师", "女祭司", "皇后", "皇帝", "教皇", "恋人", "战车", "力量", "隐者", "命运之轮", "正义", "倒吊人", "死神", "节制", "恶魔", "高塔", "星星", "月亮", "太阳", "审判", "世界"];
  const SUITS = ["权杖", "圣杯", "宝剑", "星币"];
  const RANKS = ["王牌", "二", "三", "四", "五", "六", "七", "八", "九", "十", "侍从", "骑士", "王后", "国王"];
  const MAJOR_FILES = ["00-TheFool", "01-TheMagician", "02-TheHighPriestess", "03-TheEmpress", "04-TheEmperor", "05-TheHierophant", "06-TheLovers", "07-TheChariot", "08-Strength", "09-TheHermit", "10-WheelOfFortune", "11-Justice", "12-TheHangedMan", "13-Death", "14-Temperance", "15-TheDevil", "16-TheTower", "17-TheStar", "18-TheMoon", "19-TheSun", "20-Judgement", "21-TheWorld"];
  const SUIT_FILES = { "权杖": "Wands", "圣杯": "Cups", "宝剑": "Swords", "星币": "Pentacles" };
  const cardAsset = file => "assets/tarot-rws/" + file + ".jpg";
  function buildDeck() {
    const d = MAJORS.map((n, i) => ({ name: n, major: true, image: cardAsset(MAJOR_FILES[i]) }));
    SUITS.forEach(s => RANKS.forEach((r, i) => d.push({ name: s + r, major: false, image: cardAsset(SUIT_FILES[s] + String(i + 1).padStart(2, "0")) })));
    return d; // 78 张
  }
  const DECK = buildDeck();
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // 抽 n 张互不相同的牌，各自随机正/逆位（纯本地随机；模型看不到没选中的牌，也完全不参与选牌）
  function draw(n) {
    return shuffle(DECK).slice(0, n).map(c => ({ name: c.name, major: c.major, image: c.image, rev: Math.random() < 0.34 }));
  }
  function cardImage(c) {
    if (!c) return "";
    if (c.image) return c.image;
    const found = DECK.find(x => x.name === c.name);
    return found ? found.image : "";
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
    const parts = [s.charName || "", s.question || "", s.summary || "", s.readerSummary || ""];
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
  // ⚠️取材的过滤条件必须和别处一致（engine.js 那句「所有角色视角的取材都用它过滤」）：
  // 撤回的那句角色本来就不该记得，被上下文开关排除的那些也是。原来这里只挡了 OOC。
  // ⚠️还要【先过滤再取尾】：先 slice 的话，一段撤回的能把真正有用的几句挤没。
  function recentChat(charId, uName, charName) {
    const msgs = loadJSON("x_chat:" + charId, []);
    if (!msgs.length) return "";
    return msgs
      .filter(m => m && (m.content || "").trim() && (m.role === "user" || m.role === "assistant") && !isOocMsg(m)
        && !m.recalled && (typeof contextAllowsMessage !== "function" || contextAllowsMessage(m)))
      .slice(-10)
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

  // ---- 落地页的夜空（她 2026-09-03：「不用一个一个框，可以做个星空主题，
  // 每一颗星都是不同的占卜方向」）----
  //
  // 原来是四个并排的框：色块图标 + 名字 + 一行说明。那个形状换个 app 照样成立，
  // 所以它没长在塔罗上（tabs-not-plain-pills 那把尺子）。
  // 现在四种问法是天上的四颗星，一条虚线把它们连成一个星座。
  // 而且【谁亮谁暗由她自己的历史决定】：某一种算得越多，那颗星越大越亮——
  // 抬头就看得见自己常问的是什么。这一层换个 app 不成立，因为它照的是她的存档。
  const SKY_W = 360, SKY_H = 296;
  const STAR_AT = { reading: [66, 96], relation: [236, 62], daily: [292, 176], forchar: [92, 226] };
  const SKY_CHAIN = ["forchar", "reading", "relation", "daily"];
  // 背景碎星：种子写死，所以星图每次渲染一模一样，不会自己跳来跳去
  const SKY_DUST = (function () {
    let seed = 20260903 >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const near = (x, y) => Object.keys(STAR_AT).some(k => Math.hypot(STAR_AT[k][0] - x, STAR_AT[k][1] - y) < 40);
    const out = [];
    let guard = 0;
    while (out.length < 78 && guard++ < 4000) {
      const x = rnd() * SKY_W, y = rnd() * SKY_H;
      if (near(x, y)) continue;
      out.push({ x: +x.toFixed(1), y: +y.toFixed(1), r: +(0.5 + rnd() * 1.1).toFixed(2),
        o: +(0.16 + rnd() * 0.5).toFixed(2), tw: rnd() < 0.2 ? +(2.6 + rnd() * 3.4).toFixed(1) : 0 });
    }
    return out;
  })();
  // 整页都是这片夜空（她 2026-09-03 补的：「历史记录的收纳这一块能不能也有星空背景全屏，
  // 因为下面现在也很空」）。天幕不是只铺在星座那一截：往下滚，碎星跟着一起走，
  // 底下那一截是同一片天，历史就写在天上。
  const NIGHT = "#14112a";
  const SKY_INK = "#efe9dc";                       // 天上的字
  const SKY_DIM = "rgba(239,233,220,.55)";         // 天上的小字
  const SKY_LINE = "rgba(239,233,220,.13)";        // 天上的发丝线
  const SKY_MUTE = "rgba(239,233,220,.38)";        // 天上最轻的那一档字
  const SKY_PANEL = "rgba(255,255,255,.05)";       // 天上的浅色面（原来纸上的 bg2）
  // 塔罗这一整个 app 都在夜里：落地页、入座页、结果页共用这一条紧凑标题栏。
  // ⚠️注释里原来写着「公共 Head 是 30px 大标题，所以这儿自己写一条」——那是 v61.27
  //   之前的 Head。它早就是紧凑栏了，理由过期了，这一条也就没有存在的必要
  //（施工规则/mobile-ui-layout.md §1）。v65.14 换回共用的：字色传夜里那档，
  //   底透明让天透上来，分隔线撤掉——长相照旧写在天上，但挂点有了。
  const NightHead = ({ title, onBack, right }) => h(Head, {
    zh: title, onBack: onBack, right: right, ink: SKY_INK, bg: "transparent", noLine: true });
  // 每一页都是同一片天：底色 + 会滚那一层的碎星贴图，三处共用这两个盒子
  const nightPage = { background: NIGHT };
  const nightBody = { backgroundImage: null, backgroundSize: "360px 420px", backgroundRepeat: "repeat" };
  // 往下滚那一截的碎星：拿同一颗种子摊成一张 360×420 的贴图，CSS 平铺。
  // 用背景图而不是再画一屏 SVG——历史可以很长，节点数不能跟着长。
  const SKY_TILE = (function () {
    let seed = 907120260903 % 4294967291 >>> 0;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const dots = [];
    for (let i = 0; i < 34; i++) {
      const x = (rnd() * 360).toFixed(1), y = (rnd() * 420).toFixed(1);
      const r = (0.6 + rnd() * 1.05).toFixed(2), o = (0.1 + rnd() * 0.34).toFixed(2);
      dots.push("radial-gradient(circle " + r + "px at " + x + "px " + y + "px, rgba(255,255,255," + o + ") 0, rgba(255,255,255,0) 100%)");
    }
    return dots.join(",");
  })();
  nightBody.backgroundImage = SKY_TILE;
  // 四芒星：一笔画完的星芒，不是一个圆点——圆点是「标记」，星芒才是「星」
  const sparkle = (cx, cy, R) => {
    const w = R * 0.16;
    return "M" + cx + " " + (cy - R) + "Q" + (cx + w) + " " + (cy - w) + " " + (cx + R) + " " + cy
      + "Q" + (cx + w) + " " + (cy + w) + " " + cx + " " + (cy + R)
      + "Q" + (cx - w) + " " + (cy + w) + " " + (cx - R) + " " + cy
      + "Q" + (cx - w) + " " + (cy - w) + " " + cx + " " + (cy - R) + "z";
  };
  // 星等：这一种算过几次。0 次也看得见（1 等），算得多的最大到 2 等出头
  const magOf = n => 1 + Math.min(1.15, (n || 0) * 0.17);

  // 牌阵和玩法分开：入口决定“为谁/为什么算”，牌阵只决定桌上怎么摊牌。
  // 基础牌阵 + 主题牌阵册。主题只决定桌面位置，不预设答案，也不替牌面写剧情。
  const SPREADS = {
    guide: { group: "basic", zh: "三张指引", hint: "处境 · 阻碍 · 指引", positions: ["此刻的处境", "眼前的阻碍", "给你的指引"] },
    single: { group: "basic", zh: "单张直觉", hint: "只看此刻最重要的一件事", positions: ["此刻最重要的讯息"] },
    timeline: { group: "basic", zh: "过去 / 现在 / 未来", hint: "看一件事怎样走到这里", positions: ["过去留下的影响", "现在的处境", "接下来的走向"] },
    choice: { group: "basic", zh: "A / B 选择", hint: "不替你决定，只照见两条路", positions: ["选择 A 的代价与走向", "选择 B 的代价与走向"] },
    love: { group: "relation", zh: "感情三角", hint: "你 · Ta · 关系本身", positions: ["你的状态", "Ta 的状态", "关系本身"] },
    relation5: { group: "relation", zh: "关系显影", hint: "把关系里明暗两面摊开", positions: ["你的状态", "Ta 的状态", "关系的核心", "藏着的问题", "接下来的建议"] },
    unsaid: { group: "relation", zh: "没说出口的话", hint: "表面 · 压住的 · 真正想传达的 · 如何听见", positions: ["Ta 表面给你看的", "Ta 压住没说的", "Ta 真正想让你明白的", "你该怎样理解这份沉默"] },
    story: { group: "relation", zh: "我们的故事线", hint: "来处 · 此刻章节 · 伏笔 · 转折 · 下一页", positions: ["这段关系从哪里长出来", "你们正写到哪一章", "尚未被看见的伏笔", "下一次关键转折", "故事接着写的方向"] },
    closeness: { group: "relation", zh: "靠近与边界", hint: "想靠近的 · 会退开的 · 安全边界 · 合适一步", positions: ["Ta 此刻想怎样靠近", "什么会让 Ta 退开", "这段关系需要守住的边界", "现在最合适的一步"] },
    shortterm: { group: "relation", zh: "近期关系天气", hint: "现在 · 两周内 · 变数 · 建议", positions: ["关系此刻的天气", "未来两周容易发生的变化", "最大的变量", "你可以怎样回应"] },
    blindspot: { group: "inner", zh: "我的盲点", hint: "以为 · 没看见 · 害怕承认 · 可以练习", positions: ["我以为问题是什么", "我还没看见的部分", "我害怕承认的真相", "现在可以练习的一件事"] },
    healing: { group: "inner", zh: "伤口与修复", hint: "伤口 · 保护壳 · 真正需要 · 修复资源 · 下一步", positions: ["这处伤口正在说什么", "我用什么保护自己", "保护壳下面真正的需要", "身边可用的修复资源", "温和但真实的下一步"] },
    desire: { group: "inner", zh: "愿望的根", hint: "想要 · 为什么 · 代价 · 滋养 · 行动", positions: ["我嘴上说想要的", "愿望真正从哪里来", "追逐它可能付出的代价", "什么能真正滋养我", "最诚实的一步行动"] }
  };
  const SPREAD_GROUPS = {
    basic: { zh: "基础", hint: "通用问题与快速决策" },
    relation: { zh: "关系", hint: "不预设甜或坏，只看牌面" },
    inner: { zh: "自我", hint: "愿望、盲点与修复" },
    custom: { zh: "我的", hint: "自己保存的牌阵" }
  };
  // 每一组用【它自己的摊牌形状】当图标（她 2026-09-03 那条：tab 不许只是基础款）。
  // 一排药丸换个 app 照样成立；这几个点是牌摆在桌上的样子，换个 app 就不成立了。
  const SPREAD_GLYPH = {
    basic: [[3, 6], [6, 6], [9, 6]],                    // 一字排开的三张
    relation: [[3.4, 4.4], [8.6, 4.4], [6, 8.6]],       // 你、Ta，和你们之间那一张
    inner: [[6, 6], [6, 2.6], [3.1, 8], [8.9, 8]],      // 一张在中间，其余围着它
    custom: [[4, 6], [8, 6]]                            // 自己写的，先摆两张占位
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
    const sys = AC() + CB() + "你就是「" + ctx.charName + "」本人。" +
      "现在 " + ctx.uName + (forSelf ? "提出替你算一卦。" : "请你自己挑一个此刻真正想拿来问牌的问题。") +
      "按你的人设、此刻心情和最近相处自然反应，不必配合演出。" +
      (forSelf ? "你可以接受、带着一点犹豫接受，或明确拒绝。拒绝时说人话，不要讲规则。犹豫仍代表愿意继续，但问题可以保守些。" : "挑真实、具体、此刻会在意的问题；不要替自己制造重大危机。") +
      "\n\n【角色资料】" + String(ctx.charPersona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 700) +
      (ctx.mood ? "\n【此刻心情】" + ctx.mood : "") +
      (ctx.voiceRef ? "\n【最近的说话与近况】\n" + ctx.voiceRef : "") +
      "\n\n只输出 JSON：{\"decision\":\"accept|hesitate|refuse\",\"line\":\"你当面说的一句自然回应\",\"question\":\"真正拿来问牌的问题\"}。" +
      (forSelf ? "若拒绝，question 留空。" : "decision 固定为 accept。");
    const raw = await callAI(active, sys, [{ role: "user", content: forSelf ? "你愿意让我替你算吗？" : "这次你想问牌什么？" }], { maxTokens: 8900 });
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
    const cardList = cards.map((c, i) => {
      const ref = cardReference(c);
      return (i + 1) + "、【" + spread[i] + "】" + cardLabel(c) + "\n本地牌义锚点：" + ref.keywords + "；" + ref.text;
    }).join("\n\n");
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

    const sys = AC() + CB() + NAC() + HONEST + "\n\n" + STANCE + "\n\n" + voice + "\n\n" +
      "【角色资料】「" + charName + "」：" + (charPersona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 800) +
      (mood ? "\n\n【Ta 此刻的心情：" + mood + "】顺带透一点即可，别喧宾夺主、牌义才是主角。" : "") +
      (voiceRef ? "\n\n【Ta 近期的语气 / 近况，仅参考】\n" + voiceRef : "") +
      (worldbook && worldbook.trim() ? "\n\n【世界书】\n" + worldbook.trim().slice(0, 500) : "") +
      "\n\n" + view +
      "\n\n【摊开的牌】\n" + cardList +
      "\n\n【怎么解】\n· 逐张解：每张牌结合它所在的位置、正位或逆位的含义来讲，别背牌义词典，要落到具体的处境/情绪/建议上，每张 80~180 字。\n" +
      "· 正位、逆位要真的解出差别，别把逆位也当正位讲。\n" +
      "· summary（50~120 字）：把几张牌连成一句话的走向或一句真心的提醒。\n" +
      "· readerSummary（220~520 字）：最后以占卜师视角重新综合全副牌。必须明确牌与牌之间怎样互相加强、抵消或转折，结合问题给出当下判断、风险和可执行建议；忠于以上本地牌义锚点，不要写成空泛心灵鸡汤，也不要复述逐张解读。\n" +
      "· " + thoughtAsk + "（20~50 字）。\n" +
      "· moment（16~34 字）：这副牌落桌的【那一刻】，桌边或店里的一个具体动静——光、声音、手上的一个动作、茶、窗外走过的人。要贴这一次的场合和解牌的人，别写心理活动、别点评牌面、别提问题内容。\n" +
      "【输出】只输出 JSON：{\"reads\":[{\"pos\":\"位置名\",\"text\":\"这张牌的解读\"}...],\"summary\":\"短收束\",\"readerSummary\":\"占卜师综合总结\",\"charThought\":\"角色本人的一句反应\",\"moment\":\"落桌那一刻的一句动静\"}。别加解释、别加代码块。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始解牌。" }], { maxTokens: (window.StylePresets && window.StylePresets.OUT_CEILING) || 65535 });
    const p = extractJSON(raw) || {};
    let reads = Array.isArray(p.reads) ? p.reads.filter(r => r && r.text).map((r, i) => ({ pos: r.pos || spread[i] || "", text: String(r.text).trim() })) : [];
    if (!reads.length) reads = [{ pos: spread[0] || "", text: String(raw || "牌面模糊，重试。").trim() }];
    return { reads: reads, summary: String(p.summary || "").trim(), readerSummary: String(p.readerSummary || p.summary || "").trim(), charThought: String(p.charThought || "").trim(),
      // 「店主把洗好的牌放回深色绒布上」那句原来是本地五选一，一轮一轮转下来就眼熟了。
      // 现在解牌时顺手生成一句贴着这一卦的（模型没给才回落到本地那五句）。
      moment: String(p.moment || "").trim().slice(0, 40) };
  }

  async function readSupplement(active, session, char, uName, pos, card) {
    const ref = cardReference(card);
    const sys = AC() + CB() + HONEST + "\n\n你就是「" + session.charName + "」本人，仍坐在 " + uName + " 对面。" +
      "刚才的整副牌已经解完；现在只为【" + pos + "】补了一张牌。用你自己的口吻补充 50~130 字：说明它澄清了什么、推翻了什么或加重了什么。不要重做整副解牌，不要报幕。" +
      "\n【人设】" + String(char && char.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 700) +
      "\n【原问题】" + (session.question || "未明说") + "\n【原收束】" + String(session.summary || "").slice(0, 500) +
      "\n【补牌】" + cardLabel(card) + "\n【本地牌义锚点】" + ref.keywords + "；" + ref.text;
    return String(await callAI(active, sys, [{ role: "user", content: "把这张补牌接到刚才的牌位上。" }], { maxTokens: 9000 }) || "").trim();
  }

  // ============================================================
  // 模型：每日一牌 —— 今天【同一张牌】，多个角色各自解读；一次调用返回每人一句当日签
  // 注入很克制（只给此刻心情一词 + 很短的近况），避免喧宾夺主把解读搞乱。返回按传入顺序对齐 [{text}]
  // ============================================================
  async function readDailyForCard(active, card, list, uName, worldbook) {
    const block = list.map((it, i) => (i + 1) + "、「" + it.name + "」\n  人设：" + (it.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 260) + (it.mood ? "\n  此刻心情：" + it.mood : "") + (it.voiceRef ? "\n  近况一瞥：" + it.voiceRef.replace(/\n/g, "；").slice(0, 90) : "")).join("\n\n");
    const sys = AC() + CB() + NAC() + HONEST + "\n\n" + STANCE + "\n\n" +
      "今天的塔罗牌是【同一张】：" + cardLabel(card) + "。请【分别以下面每位角色本人的口吻】，就【这同一张牌】给 " + uName + " 递一句今天的当日签——短，像随口说的一两句，结合这张牌（含正/逆位）与各自人设" + (list.some(it => it.mood) ? "（有此刻心情就顺带透一点，但别喧宾夺主，牌义才是主角）" : "") + "，别混淆、别串味、别把几个人写成同一个腔调、也别千篇一律。\n\n" +
      "【要解读这张牌的角色】\n" + block +
      "\n\n【输出】只输出 JSON，readings 数组和上面角色顺序【一一对应、数量一致】：{\"readings\":[{\"name\":\"角色名\",\"text\":\"这位角色对今天这张牌的当日签\"}...]}。别加解释、别加代码块。";
    const raw = await callAI(active, sys, [{ role: "user", content: "开始发签。" }], { maxTokens: 12000 });
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
        affinities: props.affinities, moods: props.moods, worldbook: props.worldbook, worldbookFor: props.worldbookFor, active: props.active, toast: props.toast,
        onCancel: () => setView("home"),
        onDone: (session, skipHook) => {
          persist([session].concat(loadSaves().filter(s => s.id !== session.id)));
          // 只更新既有的角色印象回调；塔罗本身不自动写正式记忆。
          try {
            if (props.onReadingDone && !skipHook) {
              const cardsOf = x => (x.cards || []).map(c => c.name).join("、") || (x.card ? x.card.name : "");
              if (session.mode === "daily") (session.entries || []).forEach(e => e && e.charId && props.onReadingDone(e.charId, { mode: "daily", summary: e.summary || e.text || "", charThought: e.charThought || "", cards: session.card ? session.card.name : "", question: "" }));
              else if (session.charId) props.onReadingDone(session.charId, { mode: session.mode, summary: session.readerSummary || session.summary || "", charThought: session.charThought || "", cards: cardsOf(session), question: session.question || "" });
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
        // 不再一条一个框（她 2026-09-03 那句「不用一个一个框」也管这一截）：
        // 一条就是一行，靠一道发丝线分开，左边一颗小星标出它是哪一种问法
        style: { padding: "9px 2px 9px 0", borderBottom: "1px solid " + SKY_LINE, cursor: "pointer",
          display: "flex", alignItems: "flex-start", gap: 9 }
      },
        h("svg", { width: 11, height: 11, viewBox: "0 0 12 12", style: { flexShrink: 0, marginTop: 3 } },
          h("path", { d: sparkle(6, 6, 5), fill: GOLD, opacity: 0.75 })),
        h("div", { style: { minWidth: 0, flex: 1 } },
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 3 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: SKY_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, subt),
          h("span", { style: { fontFamily: F_BODY, fontSize: 10, color: SKY_DIM, flexShrink: 0 } }, fmtDate(s.ts))),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: SKY_DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          (s.mode === "daily" ? (s.card ? [cardLabel(s.card)] : []) : (s.cards || []).map(c => c.name)).join(" · "))));
    };

    // ⚠这一页不走公共 Head（她 2026-09-03：「那一大块塔罗标题你没弄」）：
    // 那是 30px 大标题 + 一整块留白，仓库铁律里普通子页面本来就该用紧凑标题栏
    //（mobile-ui-layout 第 1 条）。这儿更进一步——标题就写在天上，返回键压在星星上。
    return h("div", { className: "h-full flex flex-col", style: nightPage },
      h("style", null, "@keyframes tarot-tw{0%,100%{opacity:1}50%{opacity:.28}}"),
      h(NightHead, { title: "塔罗", onBack: props.onBack }),
      // 底下那一截也是天：同一片碎星跟着内容一起往上走
      h("div", { ref: homeScrollRef, className: "flex-1 min-h-0 overflow-y-auto px-5 pb-8", style: nightBody },
        // ---- 夜空：四种问法是四颗星，亮度照她自己的存档来 ----
        h("div", { style: { margin: "0 -20px 6px", position: "relative" } },
          h("svg", { viewBox: "0 0 " + SKY_W + " " + SKY_H, style: { width: "100%", height: "auto", display: "block" } },
            h("defs", null,
              h("radialGradient", { id: "tarotHalo" },
                h("stop", { offset: "0%", stopColor: "#fff", stopOpacity: 0.5 }),
                h("stop", { offset: "45%", stopColor: GOLD, stopOpacity: 0.22 }),
                h("stop", { offset: "100%", stopColor: GOLD, stopOpacity: 0 })),
              h("radialGradient", { id: "tarotSkyGlow", cx: "72%", cy: "16%", r: "78%" },
                h("stop", { offset: "0%", stopColor: ACCENT, stopOpacity: 0.85 }),
                h("stop", { offset: "100%", stopColor: ACCENT, stopOpacity: 0 })),
              h("linearGradient", { id: "tarotMilky", x1: "0", y1: "0", x2: "1", y2: "1" },
                h("stop", { offset: "0%", stopColor: "#fff", stopOpacity: 0 }),
                h("stop", { offset: "50%", stopColor: "#cdc6ef", stopOpacity: 0.09 }),
                h("stop", { offset: "100%", stopColor: "#fff", stopOpacity: 0 }))),
            h("rect", { x: 0, y: 0, width: SKY_W, height: SKY_H, fill: NIGHT }),
            h("rect", { x: 0, y: 0, width: SKY_W, height: SKY_H, fill: "url(#tarotSkyGlow)" }),
            // 一条斜着的银河，只是极淡的一带，用来把四颗星托住
            h("ellipse", { cx: 186, cy: 140, rx: 250, ry: 62, fill: "url(#tarotMilky)", transform: "rotate(-24 186 140)" }),
            SKY_DUST.map((d, i) => h("circle", { key: "d" + i, cx: d.x, cy: d.y, r: d.r, fill: "#fff", opacity: d.o,
              style: d.tw ? { animation: "tarot-tw " + d.tw + "s ease-in-out infinite", animationDelay: (i % 7) * 0.4 + "s" } : null })),
            // 星座连线：虚的、细的、金的——是把它们认成一组的那条线，不是边框
            h("path", { d: "M" + SKY_CHAIN.map(k => STAR_AT[k].join(" ")).join("L"), fill: "none",
              stroke: GOLD, strokeWidth: 0.7, strokeDasharray: "1.6 3.6", opacity: 0.42 }),
            Object.keys(MODES).map(k => {
              const m = MODES[k], at = STAR_AT[k] || [180, 148], n = (byMode[k] || []).length, mag = magOf(n);
              const R = 6.6 * mag;
              return h("g", { key: k, onClick: () => { if (!props.characters.length) { props.toast && props.toast("先去『人格档案馆』建个角色"); return; } setView("mode:" + k); }, style: { cursor: "pointer" } },
                h("circle", { cx: at[0], cy: at[1], r: 13 + R * 1.9, fill: "url(#tarotHalo)" }),
                h("path", { d: sparkle(at[0], at[1], R), fill: "#fff8ea" }),
                h("path", { d: sparkle(at[0], at[1], R * 2.05), fill: "#fff", opacity: 0.16 }),
                h("text", { x: at[0], y: at[1] + R + 21, textAnchor: "middle", fontFamily: F_DISPLAY, fontSize: 13.5, fill: "#efe9dc" }, m.zh),
                h("text", { x: at[0], y: at[1] + R + 33, textAnchor: "middle", fontFamily: F_BODY, fontSize: 7.4, letterSpacing: 1.5, fill: GOLD, opacity: 0.9 }, m.en.toUpperCase()),
                n ? h("text", { x: at[0], y: at[1] + R + 44, textAnchor: "middle", fontFamily: F_BODY, fontSize: 7.4, fill: "#efe9dc", opacity: 0.42 }, "算过 " + n + " 次") : null,
                // 手指点得着：视觉上是一颗小星，热区是一整片天（mobile-ui-layout 那条 40px 手感线）
                h("circle", { cx: at[0], cy: at[1], r: 24, fill: "transparent" }));
            })),
          // ⚠这一行别压在星图上：最底下那颗星的名字＋英文＋「算过 N 次」已经排到 285，
          // 绝对定位一压就撞上。放在流里，顺便把天和底下的搜索框隔开一点
          h("div", { style: { textAlign: "center", padding: "2px 0 10px", fontFamily: F_BODY, fontSize: 9.5, letterSpacing: 1.2, color: SKY_INK, opacity: 0.42 } },
            "点一颗星 · 你问得越多，那颗星越亮")),
        // ---- 历史：搜索 + 类型筛选 + 折叠（条数多也随时找得到）----
        saves.length ? (function () {
          const qlc = histQ.trim().toLowerCase();
          const active = !!qlc || histType !== "all";              // 有搜索或选了具体类型 → 平铺筛选结果
          const matchSess = s => (histType === "all" || s.mode === histType) && (!qlc || sessionText(s).indexOf(qlc) >= 0);
          // 筛选也照着天上那套来：选中的是一颗亮着的星（实心星芒 + 底下一道金线），
          // 没选的是一个暗点。形状、明暗、底下那道线一起变，不是只换个填色
          //（tabs-not-plain-pills：不许直接摆一排药丸）
          const chip = (k, label, cnt) => { const on = histType === k; return h("button", { key: k, onClick: () => setHistType(k), className: "active:opacity-70",
            style: { display: "flex", alignItems: "center", gap: 4, padding: "6px 3px 5px", background: "none", border: "none",
              borderBottom: "1.5px solid " + (on ? GOLD : "transparent"), whiteSpace: "nowrap" } },
            h("svg", { width: on ? 12 : 8, height: on ? 12 : 8, viewBox: "0 0 12 12", style: { flexShrink: 0 } },
              on ? h("path", { d: sparkle(6, 6, 5.6), fill: GOLD })
                 : h("circle", { cx: 6, cy: 6, r: 2, fill: SKY_DIM })),
            h("span", { style: { fontFamily: F_BODY, fontSize: on ? 12.5 : 12, color: on ? SKY_INK : SKY_DIM } }, label + (cnt != null ? " " + cnt : ""))); };
          return h("div", null,
            // 搜索框
            h("div", { style: { position: "relative", marginBottom: 10 } },
              h("svg", { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke: SKY_DIM, strokeWidth: 1.8, style: { position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)" } },
                h("circle", { cx: 10.8, cy: 10.8, r: 6.4 }), h("path", { d: "M15.4 15.4L20.5 20.5" })),
              h("input", { value: histQ, onChange: e => setHistQ(e.target.value), placeholder: "搜角色 / 问题 / 牌名…",
                style: { width: "100%", fontFamily: F_BODY, fontSize: 13.5, color: SKY_INK, background: "rgba(255,255,255,.045)", border: "1px solid " + SKY_LINE, borderRadius: 999, padding: "9px 32px 9px 34px", outline: "none" } }),
              qlc ? h("button", { onClick: () => setHistQ(""), className: "active:opacity-60", style: { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 15, color: SKY_DIM, lineHeight: 1 } }, "×") : null),
            // 类型筛选 chips（横滑）
            h("div", { style: { display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, marginBottom: 14 } },
              [chip("all", "全部", saves.length)].concat(Object.keys(MODES).filter(k => (byMode[k] || []).length).map(k => chip(k, MODES[k].zh, byMode[k].length)))),
            // 列表
            active
              ? (function () { const list = sorted.filter(matchSess);
                  return list.length
                    ? h("div", null, list.map(histLine))
                    : h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: SKY_DIM, padding: "24px 0" } }, "没找到相关占卜"); })()
              : Object.keys(MODES).filter(k => (byMode[k] || []).length).map(k => {
                  const arr = byMode[k], exp = !!histExp[k], shown = exp ? arr : arr.slice(0, 3);
                  return h("div", { key: "h" + k, style: { marginBottom: 18 } },
                    h("div", { style: { display: "flex", alignItems: "center", gap: 7, marginBottom: 9 } },
                      h("svg", { width: 10, height: 10, viewBox: "0 0 12 12" }, h("path", { d: sparkle(6, 6, 5), fill: GOLD })),
                      h("span", { style: { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: SKY_INK, letterSpacing: .3 } }, MODES[k].zh),
                      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: SKY_DIM } }, "· " + arr.length)),
                    h("div", null, shown.map(histLine)),
                    arr.length > 3 ? h("button", { onClick: () => setHistExp(p => ({ ...p, [k]: !exp })), className: "active:opacity-60",
                      style: { marginTop: 8, fontFamily: F_BODY, fontSize: 11.5, color: GOLD } }, exp ? "收起" : "展开全部 " + arr.length + " 条 ▾") : null);
                }),
            h("div", { style: { marginTop: 12, textAlign: "center", fontFamily: F_BODY, fontSize: 10.5, color: SKY_DIM, opacity: .8 } }, "长按一条可撕掉"));
        })()
        // 一卦都还没算过时别留一屏空白：说清这底下会长出什么
        : h("div", { style: { textAlign: "center", padding: "34px 0 10px" } },
          // ⚠tailwind 的 preflight 把 svg 设成了 display:block——不写 inline-block
          // 这颗星会自己贴到左边去，居中的只有它下面那两行字
          h("svg", { width: 15, height: 15, viewBox: "0 0 12 12", style: { opacity: .5, display: "inline-block" } }, h("path", { d: sparkle(6, 6, 5.4), fill: GOLD })),
          h("div", { style: { marginTop: 9, fontFamily: F_DISPLAY, fontSize: 14, color: SKY_INK } }, "这片天还是空的"),
          h("div", { style: { marginTop: 5, fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.7, color: SKY_DIM } }, "点上面一颗星摊开第一卦。算过的都留在这儿，按问法各归各的星座。"))
      ),
      confirmNode);
  }

  // ============================================================
  // 发起：选角色（+问题）→ 抽牌 → 解牌
  // ============================================================
  function Setup(props) {
    const m = MODES[props.modeKey];
    const [charId, setCharId] = useState("");
    const [dailyAll, setDailyAll] = useState(false); // 每日一牌：一次抽全部角色
    const [q, setQ] = useState("");
    const [spreadKey, setSpreadKey] = useState(DEFAULT_SPREAD[props.modeKey] || "guide");
    const [spreadGroup, setSpreadGroup] = useState(props.modeKey === "relation" ? "relation" : "basic");
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
    customSpreads.forEach(x => { allSpreads["custom:" + x.id] = { group: "custom", zh: x.name, hint: x.positions.join(" · "), positions: x.positions, custom: true, id: x.id }; });
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
        if (!wantChars.length) { props.toast && props.toast("先去『人格档案馆』建个角色"); return; }
        const have = {}; (existing && existing.entries || []).forEach(e => { have[e.charId] = true; });
        const toGen = wantChars.filter(x => !have[x.id]);
        if (!toGen.length && existing) { props.onDone(existing, true); return; } // 想看的人都解过了 → 直接看(纯回看,不再回流一次)
        setBusy(true); setPhase(existing ? "解读今天这张牌…" : "正在翻开今天的牌…");
        try {
          const run = async update => {
            update(null, existing ? "解读今天这张牌…" : "正在翻开今天的牌…");
            const list = toGen.map(function (x) {
              const ownLore = props.worldbookFor ? props.worldbookFor(x.id, card.name + "\n每日一牌") : "";
              return { id: x.id, name: x.name, persona: (x.persona || "") + (ownLore ? "\n\n【只给你的世界设定】\n" + ownLore : ""), mood: moodOf(x.id), voiceRef: recentChat(x.id, uName, x.name) };
            });
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
        setDeal({
          pool: shuffle(DECK).map(c0 => ({ name: c0.name, major: c0.major, image: c0.image, rev: Math.random() < 0.34 })),
          chosen: [], pending: null, shuffleNo: 1, finalQuestion: prepared.finalQuestion, intent: prepared.intent
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
            voiceRef: recentChat(c.id, uName, c.name), mood: moodOf(c.id), worldbook: props.worldbookFor ? props.worldbookFor(c.id, [deal.finalQuestion, cards.map(function (x) { return x.name; }).join("、")].filter(Boolean).join("\n")) : props.worldbook
          });
          const session = { id: "tr_" + Date.now(), mode: props.modeKey, charId: c.id, charName: c.name,
            question: deal.finalQuestion, questionOwner: questionOwner, spreadKey: spreadKey, spread: spread,
            cards: cards, reads: out.reads, summary: out.summary, readerSummary: out.readerSummary, charThought: out.charThought,
            consent: deal.intent ? { decision: deal.intent.decision, line: deal.intenSKY_LINE } : null,
            shopMoment: out.moment || shopMoment, revealed: [], supplements: [], followups: [], ts: Date.now() };
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
      setSpreadGroup("custom");
      setSpreadEditor(false); setSpreadName(""); setSpreadPositions("");
    };

    const label = { fontFamily: F_BODY, fontSize: 12, fontWeight: 700, color: SKY_DIM, marginBottom: 8, letterSpacing: .3 };

    if (busy) return h("div", { className: "h-full flex flex-col", style: nightPage },
      h(NightHead, { title: m.zh, onBack: props.onCancel }),
      h("div", { className: "flex-1 min-h-0 flex flex-col items-center justify-center px-8", style: nightBody },
        h("div", { style: { fontSize: 40, color: ACCENT, marginBottom: 18 } }, m.icon),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: SKY_INK, textAlign: "center" } }, phase || "…")));

    if (deal) {
      const chosen = deal.chosen || [];
      const pickCard = i => setDeal(prev => prev.chosen.indexOf(i) >= 0 || prev.chosen.length >= spread.length ? prev : { ...prev, pending: prev.pending === i ? null : i });
      const confirmCard = () => setDeal(prev => prev.pending == null || prev.chosen.indexOf(prev.pending) >= 0 || prev.chosen.length >= spread.length ? prev : { ...prev, chosen: prev.chosen.concat(prev.pending), pending: null });
      const reshuffle = () => setDeal(prev => ({ ...prev, pool: shuffle(DECK).map(c0 => ({ name: c0.name, major: c0.major, image: c0.image, rev: Math.random() < 0.34 })), chosen: [], pending: null, shuffleNo: (prev.shuffleNo || 1) + 1 }));
      return h("div", { className: "h-full flex flex-col", style: nightPage },
        h(NightHead, { title: "亲手选牌", onBack: () => setDeal(null) }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-40", style: nightBody },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: SKY_DIM, lineHeight: 1.7, marginBottom: 13 } }, "先洗牌，再凭第一眼点一张。牌会抬起；按确认后才算抽到。牌背不会提前泄露牌面。"),
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 13 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: SKY_MUTE } }, "完整 78 张 · 第 " + (deal.shuffleNo || 1) + " 次洗牌"),
            h("button", { onClick: reshuffle, className: "active:opacity-70", style: { flexShrink: 0, padding: "7px 11px", borderRadius: 999, border: "1px solid " + SKY_LINE, color: GOLD, background: SKY_PANEL, fontFamily: F_BODY, fontSize: 11.5 } }, chosen.length ? "重新洗牌（清空已选）" : "↻ 洗牌")),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + Math.min(4, spread.length) + ",minmax(0,1fr))", gap: 7, marginBottom: 18 } },
            spread.map((pos, i) => h("div", { key: pos + i, style: { minHeight: 54, padding: "7px 5px", borderRadius: 9, border: "1px solid " + (chosen[i] != null ? GOLD : SKY_LINE), background: chosen[i] != null ? "rgba(184,145,80,.08)" : SKY_PANEL, textAlign: "center" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: SKY_MUTE, marginBottom: 4 } }, "第 " + (i + 1) + " 张"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: SKY_INK, lineHeight: 1.3 } }, pos)))),
          h("div", { style: { overflowX: "auto", WebkitOverflowScrolling: "touch", margin: "0 -20px", padding: "8px 20px 12px" } },
            h("div", { style: { position: "relative", width: 630, height: 244, margin: "0 auto" } }, deal.pool.map((c0, i) => {
              const row = i < 39 ? 0 : 1, col = i % 39, selectedAt = chosen.indexOf(i), committed = selectedAt >= 0, pending = deal.pending === i;
              const curve = Math.abs(col - 19) * .16;
              return h("button", { key: "back" + i, onClick: () => pickCard(i), disabled: committed, "aria-label": committed ? "第 " + (selectedAt + 1) + " 张已选" : "牌背 " + (i + 1), className: "active:opacity-80",
                style: { position: "absolute", left: col * 14.6, top: row * 112 + curve + (pending ? -20 : committed ? -10 : 0), width: 62, height: 100, zIndex: pending ? 300 : committed ? 220 + selectedAt : i + 1, borderRadius: 8, border: "1px solid " + (pending || committed ? GOLD : "rgba(184,145,80,.42)"), background: "linear-gradient(145deg,#211c34," + ACCENT + ")", boxShadow: pending ? "0 10px 20px rgba(35,28,58,.28),0 0 0 2px rgba(184,145,80,.22)" : "0 2px 4px rgba(25,20,40,.16)", color: GOLD, transition: "top .18s ease,box-shadow .18s ease", transform: "rotate(" + ((col - 19) * .18) + "deg)" } },
                h("div", { style: { position: "absolute", inset: 5, border: "1px solid rgba(184,145,80,.4)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, background: "radial-gradient(circle,rgba(184,145,80,.1),transparent 62%)" } }, committed ? String(selectedAt + 1) : "✦"));
            }))),
          h("div", { style: { minHeight: 45, textAlign: "center", fontFamily: F_BODY, fontSize: 11.5, color: deal.pending == null ? SKY_MUTE : ACCENT, lineHeight: 1.6 } }, deal.pending == null ? (chosen.length === spread.length ? "牌已选齐，可以摆上桌了。" : "点一张牌，它会从牌阵里抬起来。") : "这张还没有翻开。确认后，它会成为第 " + (chosen.length + 1) + " 张。"),
          h("div", { style: { textAlign: "center", marginTop: 5, fontFamily: F_BODY, fontSize: 11, color: SKY_MUTE } }, "已选 " + chosen.length + " / " + spread.length)),
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 20px calc(10px + env(safe-area-inset-bottom) * 0.4)", background: "linear-gradient(to top," + NIGHT + " 82%,transparent)" } },
          deal.pending != null ? h("button", { onClick: confirmCard, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#fff", background: ACCENT, borderRadius: 12, padding: "13px 0" } }, "确认选择第 " + (chosen.length + 1) + " 张") :
            h("button", { onClick: finishDeal, disabled: chosen.length !== spread.length, className: "w-full active:opacity-80", style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#fff", background: chosen.length === spread.length ? ACCENT : SKY_MUTE, borderRadius: 12, padding: "13px 0" } }, chosen.length === spread.length ? "把 " + spread.length + " 张牌摆上桌" : "先选满 " + spread.length + " 张")));
    }

    return h("div", { className: "h-full flex flex-col", style: nightPage },
      h(NightHead, { title: m.zh, onBack: props.onCancel }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-32", style: nightBody },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SKY_MUTE, lineHeight: 1.7, marginBottom: 20 } }, m.blurb + "。"),
        h("div", { style: { marginBottom: 18, padding: "10px 12px", borderLeft: "2px solid " + GOLD, background: "rgba(184,145,80,0.06)", fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.65, color: SKY_DIM } }, shopMoment),
        // 每日一牌：一次抽全部角色
        m.daily ? h("button", { onClick: () => setDailyAll(v => !v), className: "w-full active:opacity-80",
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", background: isDailyAll ? "rgba(74,63,107,0.08)" : SKY_PANEL, border: "1px solid " + (isDailyAll ? ACCENT : SKY_LINE), borderRadius: 11, marginBottom: 16 } },
          h("div", { style: { textAlign: "left" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: SKY_INK } }, "让全部角色都解读"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: SKY_MUTE, marginTop: 2, lineHeight: 1.5 } }, "所有人解读今天【同一张】牌，一次生成全部（省次数），进去挨个看")),
          h("div", { style: { width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: "1px solid " + (isDailyAll ? ACCENT : SKY_LINE), background: isDailyAll ? ACCENT : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 } }, isDailyAll ? "✓" : "")) : null,
        isDailyAll ? null : h("div", { style: label }, props.modeKey === "forchar" ? "替谁算" : props.modeKey === "relation" ? "算你和谁" : "请谁替你解牌"),
        isDailyAll ? null : h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 } },
          props.characters.map(c => {
            const on = charId === c.id;
            return h("button", { key: c.id, onClick: () => { setCharId(prev => prev === c.id ? "" : c.id); setGate(null); }, className: "active:opacity-70",
              style: { fontFamily: F_BODY, fontSize: 13, color: on ? "#fff" : SKY_INK, background: on ? ACCENT : SKY_PANEL, border: "1px solid " + (on ? ACCENT : SKY_LINE), borderRadius: 999, padding: "8px 15px" } }, c.name);
          })),
        !m.daily ? h("div", { style: label }, "怎么摊牌") : null,
        !m.daily ? h("div", { style: { display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4, marginBottom: 12, WebkitOverflowScrolling: "touch" } },
          Object.keys(SPREAD_GROUPS).filter(g => g !== "custom" || customSpreads.length).map(g => {
            const on = spreadGroup === g, meta = SPREAD_GROUPS[g];
            // 选中：点亮、点变大、底下一道金线；没选：暗点、小、没有线。
            // 形状/大小/那道线一起变，不是只换个填色
            return h("button", { key: g, onClick: () => setSpreadGroup(g), className: "active:opacity-70",
              style: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 2px 5px", background: "none", border: "none", borderBottom: "1.5px solid " + (on ? GOLD : "transparent") } },
              h("svg", { width: 22, height: 22, viewBox: "0 0 12 12" },
                (SPREAD_GLYPH[g] || SPREAD_GLYPH.basic).map((pt, ix) => h("circle", { key: ix, cx: pt[0], cy: pt[1], r: on ? 1.5 : 1.05, fill: on ? GOLD : SKY_MUTE })),
                g === "custom" ? h("rect", { x: 1.6, y: 2.4, width: 8.8, height: 7.2, rx: 1.4, fill: "none", stroke: on ? GOLD : SKY_MUTE, strokeWidth: 0.7, strokeDasharray: "1.4 1.4" }) : null),
              h("span", { style: { fontFamily: F_BODY, fontSize: on ? 12 : 11.5, color: on ? SKY_INK : SKY_MUTE } }, meta.zh));
          })) : null,
        !m.daily ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 20 } },
          Object.keys(allSpreads).filter(k => (allSpreads[k].group || "basic") === spreadGroup).map(k => {
            const sp = allSpreads[k], on = spreadKey === k;
            return h("button", { key: k, onClick: () => setSpreadKey(k), className: "active:opacity-70",
              style: { minHeight: 62, padding: "9px 10px", textAlign: "left", background: on ? "rgba(74,63,107,0.1)" : SKY_PANEL, border: "1px solid " + (on ? ACCENT : SKY_LINE), borderRadius: 11 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: SKY_INK, fontWeight: on ? 700 : 500 } }, sp.zh),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: SKY_MUTE, marginTop: 3, lineHeight: 1.4 } }, sp.hint));
          }),
          h("button", { onClick: () => setSpreadEditor(v => !v), className: "active:opacity-70", style: { minHeight: 62, padding: "9px 10px", textAlign: "left", background: SKY_PANEL, border: "1px dashed " + ACCENT, borderRadius: 11 } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: ACCENT, fontWeight: 700 } }, "＋ 自定义牌阵"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: SKY_MUTE, marginTop: 3 } }, "自己写 1～8 个牌位"))) : null,
        spreadEditor ? h("div", { style: { margin: "-10px 0 20px", padding: 12, background: "rgba(74,63,107,.05)", border: "1px solid rgba(74,63,107,.18)", borderRadius: 12 } },
          h("input", { value: spreadName, onChange: e => setSpreadName(e.target.value), placeholder: "牌阵名字", style: { width: "100%", marginBottom: 8, padding: "9px 10px", borderRadius: 9, border: "1px solid " + SKY_LINE, background: SKY_PANEL, color: SKY_INK, outline: "none", fontFamily: F_BODY, fontSize: 13 } }),
          h("textarea", { value: spreadPositions, onChange: e => setSpreadPositions(e.target.value), rows: 4, placeholder: "每行一个牌位\n如：我真正想要的\n我没看见的阻碍\n下一步", style: { width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid " + SKY_LINE, background: SKY_PANEL, color: SKY_INK, outline: "none", resize: "none", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55 } }),
          h("button", { onClick: saveSpread, className: "w-full active:opacity-75", style: { marginTop: 8, padding: "9px 0", borderRadius: 9, color: "#fff", background: ACCENT, fontFamily: F_BODY, fontSize: 12.5 } }, "保存并选中")) : null,
        supportsQuestionOwner ? h("div", { style: label }, "谁来定这次的问题") : null,
        supportsQuestionOwner ? h("div", { style: { display: "flex", gap: 8, marginBottom: 14 } },
          [["user", props.modeKey === "forchar" ? "我替 Ta 问" : "我来问"], ["character", "让 Ta 自己问"]].map(it => h("button", {
            key: it[0], onClick: () => { setQuestionOwner(it[0]); setGate(null); }, className: "active:opacity-70",
            style: { flex: 1, fontFamily: F_BODY, fontSize: 12.5, color: questionOwner === it[0] ? "#fff" : SKY_INK, background: questionOwner === it[0] ? ACCENT : SKY_PANEL, border: "1px solid " + (questionOwner === it[0] ? ACCENT : SKY_LINE), borderRadius: 999, padding: "9px 10px" }
          }, it[1]))) : null,
        supportsQuestionOwner && questionOwner === "user" ? h("div", { style: label }, props.modeKey === "forchar" ? "你想替 Ta 问的事" : "你想问的事") : null,
        supportsQuestionOwner && questionOwner === "user" ? h("textarea", { value: q, onChange: e => setQ(e.target.value), rows: 3, placeholder: props.modeKey === "forchar" ? "如：Ta 最近真正放不下的是什么？" : m.qHint,
          style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: SKY_INK, background: SKY_PANEL, border: "1px solid " + SKY_LINE, borderRadius: 11, padding: "11px 13px", width: "100%", outline: "none", resize: "none", marginBottom: 8 } }) : null,
        supportsQuestionOwner && questionOwner === "character" ? h("div", { style: { marginBottom: 14, padding: "10px 12px", borderRadius: 11, border: "1px dashed " + SKY_LINE, fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.6, color: SKY_MUTE } }, "洗牌前会先问 Ta。Ta 会按自己的近况挑问题，不会由系统硬塞一个秘密。") : null,
        !supportsQuestionOwner && !m.daily && spreadKey === "choice" ? h("div", { style: label }, "把两个选择写清楚") : null,
        !supportsQuestionOwner && !m.daily && spreadKey === "choice" ? h("textarea", { value: q, onChange: e => setQ(e.target.value), rows: 3, placeholder: "A：……\nB：……",
          style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: SKY_INK, background: SKY_PANEL, border: "1px solid " + SKY_LINE, borderRadius: 11, padding: "11px 13px", width: "100%", outline: "none", resize: "none", marginBottom: 8 } }) : null,
        gate ? h("div", { style: { marginBottom: 14, padding: "11px 13px", borderRadius: 11, background: gate.decision === "refuse" ? "rgba(170,80,80,.07)" : "rgba(74,63,107,.07)", border: "1px solid " + (gate.decision === "refuse" ? "rgba(170,80,80,.25)" : "rgba(74,63,107,.2)") } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: gate.decision === "refuse" ? "#a85b5b" : GOLD, marginBottom: 4 } }, gate.decision === "refuse" ? "Ta 这次不想算" : gate.decision === "hesitate" ? "Ta 犹豫了一下，还是坐下了" : "Ta 答应了"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: SKY_INK, lineHeight: 1.65 } }, gate.line)) : null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: SKY_MUTE, lineHeight: 1.7 } },
          m.daily ? "今天只有【一张】牌，所有人解读同一张。" : "会摊开 " + spread.length + " 张牌：" + spread.join(" · ") + "。",
          h("br"), "牌是随机抽出的，模型只解读、不挑牌。")
      ),
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 20px calc(10px + env(safe-area-inset-bottom) * 0.4)", background: "linear-gradient(to top," + NIGHT + " 78%,transparent)" } },
        h("button", { onClick: go, className: "w-full active:opacity-80",
          style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 700, color: "#fff", background: ACCENT, borderRadius: 12, padding: "13px 0" } }, m.daily ? "翻开今日牌" : "洗牌 · 去选牌")));
  }

  // ============================================================
  // 一次占卜的正文
  // ============================================================
  async function continueAtTable(active, session, char, uName, history, question) {
    const cards = (session.cards || []).map((c, i) => "【" + ((session.spread || [])[i] || "第" + (i + 1) + "张") + "】" + cardLabel(c)).join("；");
    const reads = (session.reads || []).map(r => (r.pos || "") + "：" + r.text).join("\n");
    const sys = AC() + CB() + "你就是「" + session.charName + "」本人。占卜已经结束，但你和 " + uName + " 还坐在店里的小桌边。" +
      "现在是围绕刚才这副牌自然说话，不是重新生成一份解牌报告，也不是客服答疑。你可以赞同、保留、调侃、追问，或者承认自己也没想明白；保持你自己对占卜的态度和人设。" +
      "不要声称牌能证明事实，不要每次都总结人生。用第一人称，通常一两段就够。" +
      "\n\n【你的人设】" + String(char && char.persona || "（暂无设定）").replace(/\s+/g, " ").slice(0, 850) +
      "\n【原问题】" + (session.question || "未明说") +
      "\n【牌面】" + cards +
      "\n【刚才的解读】\n" + reads.slice(0, 1800) +
      "\n【占卜师总结】" + String(session.readerSummary || session.summary || "").slice(0, 1800);
    const msgs = (history || []).slice(-10).map(x => ({ role: x.role === "assistant" ? "assistant" : "user", content: x.content }));
    msgs.push({ role: "user", content: question });
    return String(await callAI(active, sys, msgs, { maxTokens: 9400 }) || "").trim();
  }

  function SessionView(props) {
    const s = props.session;
    const m = MODES[s.mode] || {};
    const [fwd, setFwd] = useState(false);
    const [forwarded, setForwarded] = useState(false);
    const [followups, setFollowups] = useState(Array.isArray(s.followups) ? s.followups : []);
    const [followText, setFollowText] = useState("");
    const [followBusy, setFollowBusy] = useState(false);
    const oldSession = !Array.isArray(s.revealed);
    const [revealed, setRevealed] = useState(oldSession ? (s.cards || []).map((_, i) => i) : s.revealed);
    const [flipped, setFlipped] = useState([]);   // 这一屏翻到牌义那一面的有哪几张（可以同时好几张）
    const [supplements, setSupplements] = useState(Array.isArray(s.supplements) ? s.supplements : []);
    const [suppBusy, setSuppBusy] = useState(null);
    const tp = typeof useTtsPlayer === "function" ? useTtsPlayer() : null; // 解牌朗读（懒合成，重听免费）
    const chOf = function (id) { return (props.characters || []).find(function (c) { return c.id === id; }); };
    const char = chOf(s.charId);
    const dot = function (k, text, spk) { return (tp && spk && typeof TtsDot === "function") ? h(TtsDot, { k: k, text: text, spk: spk, tp: tp }) : null; };

    // 一张牌片
    // 一张牌有三面（她 2026-09-03 点的：「每张牌的解释放在牌后面点开可以看到，
    // 每次可以显示超过一张的背面」）：
    //   没翻开＝牌背 ✦ → 点一下翻开＝牌面 → 再点一下翻过去＝这张牌的牌义
    // 牌义原来是牌阵底下另起的一列小卡，跟牌隔着半屏；现在它就在这张牌的背面。
    // 想同时看几张就翻几张——flipped 是一个数组，不是一次只能有一张。
    // 翻到背面那一张【占满一行】：110px 宽的一列里塞 80~180 字，一行只有八个字，
    // 读起来像挤在书脊上。摊开占一整行，正好是一段话该有的宽度；没翻的还是并排的小牌
    const cardTile = (c, pos, i, small, faceUp, onFlip, meaning) => h("div", { key: "c" + i, style: (meaning && faceUp !== false)
      ? { flex: "1 1 100%", width: "100%", maxWidth: "100%" }
      : { flex: small ? "0 0 auto" : "1 1 0", width: small ? 74 : "auto", minWidth: small ? 74 : 88, maxWidth: small ? 74 : 130 } },
      // ⚠翻到背面那一档不锁死长宽比：背面写的是这张牌【真正的分析】(80~180 字)，
      // 钉着 2:3.4 只有两条路——要么裁字要么塞进一个滚动条，两条都不像一张牌。
      // 让它长多少就长多高，短的那张有 minHeight 兜着，还是一张牌的样子
      h("button", { onClick: onFlip || null, disabled: !onFlip, className: onFlip ? "active:opacity-80" : "", style: { width: "100%", position: "relative", aspectRatio: (meaning && faceUp !== false) ? "auto" : "2/3.4", minHeight: 0, borderRadius: 11, background: "linear-gradient(160deg," + ACCENT + ",#241f38)", border: "1px solid rgba(184,145,80,0.5)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 8, overflow: "hidden", transition: "transform .35s ease", transform: faceUp === false ? "rotateY(180deg)" : "rotateY(0deg)" } },
        faceUp === false ? h("div", { style: { position: "absolute", inset: 7, border: "1px solid rgba(184,145,80,.5)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD, fontSize: small ? 17 : 24, transform: "rotateY(180deg)" } }, "✦") : null,
        // 牌义那一面：还是这张牌的形状与底色，只是翻过去写着字
        faceUp !== false && meaning ? h("div", { style: { position: "relative", width: "100%", border: "1px solid rgba(184,145,80,.42)", borderRadius: 8, padding: "11px 13px 13px", textAlign: "left" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: small ? 8 : 10, letterSpacing: 1, color: GOLD, opacity: .9, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, pos || "牌义"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: small ? 10.5 : 15, color: "#f4efe4", marginBottom: 2 } }, c.name + (c.rev ? "·逆" : "·正")),
          h("div", { style: { fontFamily: F_BODY, fontSize: small ? 8.5 : 10.5, lineHeight: 1.45, color: GOLD, marginBottom: 7 } }, cardReference(c).keywords),
          // 这张牌真正的那段分析。没有（还没解完 / 旧存档）才退回本地那句正逆提示
          h("div", { style: { fontFamily: F_BODY, fontSize: small ? 8 : 13, lineHeight: 1.75, color: "rgba(244,239,228,.86)", whiteSpace: "pre-wrap" } }, meaning === true ? cardReference(c).text : meaning)) : null,
        faceUp === false || meaning ? null : [
        h("img", { src: cardImage(c), alt: c.name, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: c.rev ? "rotate(180deg) scale(1.02)" : "scale(1.02)", transformOrigin: "center", background: "#e8dfcf" } }),
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, height: "42%", background: "linear-gradient(transparent,rgba(20,15,28,.88))" } }),
        h("div", { style: { position: "absolute", left: 5, right: 5, bottom: 6, fontFamily: F_DISPLAY, fontSize: small ? 11.5 : 13.5, color: "#fff", textAlign: "center", lineHeight: 1.2, textShadow: "0 1px 2px #000" } }, c.name),
        h("div", { style: { position: "absolute", right: 5, top: 5, fontFamily: F_BODY, fontSize: small ? 8 : 9, color: "#fff", background: c.rev ? "rgba(137,64,77,.86)" : "rgba(42,74,58,.82)", borderRadius: 999, padding: "2px 6px" } }, c.rev ? "逆" : "正")]),
      // 摊开的那一张自己头上已经写着牌位了，底下不用再写一遍
      (pos && !(meaning && faceUp !== false)) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: SKY_MUTE, textAlign: "center", marginTop: 6 } }, pos) : null);

    // ---- 每日一牌：今天【一张】牌，各角色解读同一张 ----
    if (s.mode === "daily") {
      const entries = s.entries || [];
      const dc = s.card || (entries[0] && entries[0].card); // 兼容旧数据（旧版每人各一张时取第一张）
      return h("div", { className: "h-full flex flex-col", style: nightPage },
        h(NightHead, { title: m.zh, onBack: props.onBack }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10", style: nightBody },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: SKY_MUTE, marginBottom: 14, textAlign: "center" } }, fmtDate(s.ts) + " · 今天的牌"),
          // 今天这一张牌（全体共用）
          dc ? h("div", { style: { display: "flex", justifyContent: "center", marginBottom: 8 } }, cardTile(dc, "", 0, false, true)) : null,
          dc ? h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: SKY_DIM, marginBottom: 22 } }, cardLabel(dc)) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, fontWeight: 700, color: SKY_DIM, marginBottom: 12, letterSpacing: .3 } }, "各人怎么看这张牌"),
          entries.map((e, i) => h("div", { key: i, style: { marginBottom: 15, paddingBottom: 15, borderBottom: i < entries.length - 1 ? "1px solid " + SKY_LINE : "none" } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 5, marginBottom: 3 } },
              h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: SKY_INK } }, e.charName),
              dot("td" + i, e.text, chOf(e.charId))),
            h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: SKY_INK } }, e.text)))));
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
        const answer = await continueAtTable(props.active, s, char, userName(props.profile), followups, text);
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
    // 翻到牌义那一面 / 翻回牌面。可以同时翻着好几张——只留在这一屏，不写进存档
    const tapCard = i => revealed.indexOf(i) < 0 ? revealCard(i)
      : setFlipped(p => p.indexOf(i) >= 0 ? p.filter(x => x !== i) : p.concat(i));
    const allRevealed = cards.every((_, i) => revealed.indexOf(i) >= 0);
    const addSupplement = async (i, pos) => {
      if (suppBusy != null) return;
      if (supplements.length >= 3) { props.toast && props.toast("一副牌最多补 3 张"); return; }
      const card = draw(1)[0];
      setSuppBusy(i);
      let text = "";
      try {
        text = await readSupplement(props.active, s, char, userName(props.profile), pos, card);
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

    return h("div", { className: "h-full flex flex-col", style: nightPage },
      h(NightHead, { title: m.zh || "占卜", onBack: props.onBack }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10", style: nightBody },
        // 抬头
        h("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: GOLD, fontWeight: 700 } }, m.icon),
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: SKY_INK } }, subject)),
        s.shopMoment ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: SKY_MUTE, lineHeight: 1.6, margin: "5px 0 12px", paddingLeft: 9, borderLeft: "2px solid " + GOLD } }, s.shopMoment) : null,
        s.consent && s.consenSKY_LINE ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: SKY_DIM, marginBottom: 10 } }, s.charName + "入座前说：『" + s.consenSKY_LINE + "』") : null,
        s.mode !== "daily" && s.question ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: SKY_DIM, fontStyle: "italic", marginBottom: 16 } }, "「" + s.question + "」") : h("div", { style: { height: 12 } }),
        // 「给角色算一卦」的主动作必须在牌面之前看得见，不能埋到整篇解读和追问区之后。
        s.mode === "forchar" && props.onForwardToChat ? h("button", {
          onClick: doForward, disabled: fwd || forwarded, className: "w-full active:opacity-80",
          style: { margin: "0 0 18px", fontFamily: F_BODY, fontSize: 13.5, fontWeight: 700,
            color: forwarded ? GOLD : "#fff", background: forwarded ? "rgba(184,145,80,.12)" : (fwd ? SKY_MUTE : ACCENT),
            border: forwarded ? "1px solid rgba(184,145,80,.3)" : "1px solid transparent", borderRadius: 12, padding: "12px 0" }
        }, fwd ? "正在转发…" : (forwarded ? "✓ 已转发给 " + s.charName : "把这一卦转发给 " + s.charName)) : null,
        // 牌阵
        h("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap", marginBottom: 22 } },
          cards.map((c, i) => cardTile(c, (s.spread || [])[i] || "", i, false, revealed.indexOf(i) >= 0, () => tapCard(i),
            flipped.indexOf(i) < 0 ? false : (((s.reads || [])[i] || {}).text || true)))),
        h("div", { style: { margin: "-6px 0 18px", fontFamily: F_BODY, fontSize: 11, color: SKY_MUTE, textAlign: "center" } },
          allRevealed ? "点一张牌翻过去，背面写的就是这一张的分析 · 可以同时翻好几张" : "逐张点牌翻开；全部翻完才揭示完整解读"),
        // 逐张解读
        // 逐张的分析已经写在各自的牌背上（她 2026-09-03 点的），这儿不再重复一遍——
        // 同一段话读两遍。留下的是这一张的名头、朗读，和「给这个牌位补一张」
        allRevealed ? (s.reads || []).map((r, i) => h("div", { key: "r" + i, style: { marginBottom: 14 } },
          h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, color: GOLD, background: "rgba(184,145,80,.13)", borderRadius: 6, padding: "1px 8px" } }, r.pos || (s.spread || [])[i] || ("第" + (i + 1) + "张")),
            cards[i] ? h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: SKY_MUTE } }, cardLabel(cards[i])) : null,
            dot("tr" + i, r.text, char)),
          supplements.filter(x => x.posIndex === i).map((x, j) => h("div", { key: x.id || ("sp" + i + j), style: { display: "flex", gap: 10, marginTop: 10, padding: 10, borderRadius: 11, background: "rgba(184,145,80,.07)", border: "1px solid rgba(184,145,80,.24)" } },
            cardTile(x.card, "补牌", 100 + i * 10 + j, true, true),
            h("div", { style: { flex: 1, minWidth: 0 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: GOLD, fontWeight: 700, marginBottom: 4 } }, cardLabel(x.card) + " · " + cardReference(x.card).keywords),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: SKY_INK, lineHeight: 1.65 } }, x.text)))),
          supplements.length < 3 ? h("button", { onClick: () => addSupplement(i, r.pos || (s.spread || [])[i] || "这个牌位"), disabled: suppBusy != null, className: "active:opacity-70", style: { marginTop: 9, fontFamily: F_BODY, fontSize: 11.5, color: GOLD, border: "1px dashed rgba(184,145,80,.42)", borderRadius: 999, padding: "5px 10px" } }, suppBusy === i ? "正在补牌…" : "＋ 为这个牌位补一张") : null)) : null,
        // 占卜师综合收束：旧存档没有 readerSummary 时回退到原 summary。
        allRevealed && (s.readerSummary || s.summary) ? h("div", { style: { marginTop: 8, padding: "16px 17px", background: "linear-gradient(145deg,rgba(122,104,176,.14),rgba(184,145,80,.10))", border: "1px solid rgba(184,145,80,.26)", borderRadius: 13 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, fontWeight: 700, letterSpacing: 1, color: GOLD, marginBottom: 7 } }, "占卜师总结"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: SKY_INK, whiteSpace: "pre-wrap" } }, s.readerSummary || s.summary)) : null,
        // 角色本人对这几张牌的想法
        allRevealed && s.charThought ? h("div", { style: { marginTop: 12, display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", background: SKY_PANEL, border: "1px solid " + SKY_LINE, borderRadius: 13 } },
          h("span", { style: { fontFamily: F_DISPLAY, fontSize: 13, color: GOLD, flexShrink: 0 } }, s.charName + "："),
          h("div", { style: { flex: 1, fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.75, color: SKY_INK, fontStyle: "italic" } }, s.charThought),
          dot("tct", s.charThought, char)) : null,
        allRevealed && char ? h("div", { style: { marginTop: 20, paddingTop: 17, borderTop: "1px solid " + SKY_LINE } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: SKY_INK, marginBottom: 3 } }, "小桌边继续聊"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: SKY_MUTE, lineHeight: 1.5, marginBottom: 11 } }, "追问只留在这次占卜里；转发进聊天后，才会进入聊天上下文。"),
          followups.length ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 } }, followups.map(x => h("div", {
            key: x.id, style: { alignSelf: x.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "9px 11px", borderRadius: 12, background: x.role === "user" ? "rgba(184,145,80,.13)" : SKY_PANEL, border: "1px solid " + SKY_LINE, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.65, color: SKY_INK, whiteSpace: "pre-wrap" }
          }, x.content))) : null,
          h("div", { style: { display: "flex", gap: 8, alignItems: "flex-end" } },
            h("textarea", { value: followText, onChange: e => setFollowText(e.target.value), rows: 2, placeholder: "再问一句，或只是和 Ta 聊聊这副牌…", disabled: followBusy,
              style: { flex: 1, minWidth: 0, resize: "none", outline: "none", borderRadius: 11, border: "1px solid " + SKY_LINE, background: SKY_PANEL, color: SKY_INK, padding: "9px 10px", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.5 } }),
            h("button", { onClick: sendFollowup, disabled: followBusy || !followText.trim(), className: "active:opacity-70",
              style: { flexShrink: 0, width: 48, height: 48, borderRadius: 12, color: "#fff", background: followBusy || !followText.trim() ? SKY_MUTE : ACCENT, fontFamily: F_BODY, fontSize: 12 } }, followBusy ? "…" : "说"))) : null,
        null));
  }

  window.Tarot = Tarot;
})();
