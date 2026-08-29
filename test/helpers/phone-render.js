// 查手机渲染冒烟桩：真的把 renderPhoneModule / AlbumView 跑一遍。
// 起因：v57.46 给相册加转发时，改签名那一步 string.replace 没匹配上（静默失败），
// AlbumView 里就多了一个【没声明的 onPeek】——sloppy 模式下读它直接 ReferenceError，
// 点开照片当场白屏。语法检查和正则断言都拦不住这种，只有真跑一遍能。
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "phone.js"), "utf8");

function makeEnv(forceState) {
  let stateIdx = 0;
  const env = {
    // h 的参数在调用前就已全部求值，所以光是构造出这棵树就等于跑过了所有表达式
    h: (type, props, ...kids) => ({ type: typeof type === "function" ? (type.name || "fn") : type, props: props || {}, kids }),
    useState: init => {
      const i = stateIdx++;
      const v = forceState && Object.prototype.hasOwnProperty.call(forceState, i)
        ? forceState[i]
        : (typeof init === "function" ? init() : init);
      return [v, () => {}];
    },
    useEffect: () => {},
    useRef: v => ({ current: v === undefined ? null : v }),
    useMemo: f => f(),
    useCallback: f => f,
    useTheme: () => ({ ink: "#111", bg: "#fff", bg2: "#eee", line: "#ddd", fog: "#999", sub: "#555", tint: "#c90", accent: "#c90" }),
    F_DISPLAY: "D", F_BODY: "B",
    AV_COLORS: ["#a11", "#1a1", "#11a"],
    loadJSON: (_k, d) => d,
    saveJSON: () => {},
    safeTop: px => "calc(env(safe-area-inset-top, 0px) + " + px + "px)",
    COMPOSER_PAD_BOTTOM: "calc(env(safe-area-inset-bottom) * 0.4)",
    resetStateIdx: () => { stateIdx = 0; }
  };
  // 别的文件里的组件：不写死名单，直接从源码里扫出来补桩。
  // 写死名单的话，phone.js 以后引用一个新图标，这套冒烟就会以「XXX is not defined」
  // 假报错，人就会去改桩而不是看代码——那这层防线就废了。
  const defined = new Set();
  SRC.replace(/(?:^|\n)\s*(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/g,
    (_m, a, b) => { defined.add(a || b); return _m; });
  const used = new Set();
  SRC.replace(/h\(([A-Z][\w$]*)/g, (_m, n) => { used.add(n); return _m; });
  SRC.replace(/\b(I[A-Z][\w$]*)\b/g, (_m, n) => { used.add(n); return _m; });
  used.forEach(n => {
    if (defined.has(n) || env[n] !== undefined) return;
    const f = function () { return null; };
    Object.defineProperty(f, "name", { value: n });
    env[n] = f;
  });
  return env;
}

// 把 phone.js 在这套桩里跑起来，导出需要的符号
function loadPhone(forceState) {
  const env = makeEnv(forceState);
  const names = Object.keys(env);
  const fn = new Function(...names, SRC + "\n;return { PHONE_APPS, PHONE_LIVE_KEYS, PHONE_LABEL, PHONE_DESKTOP_LAYOUTS, PHONE_DOCK_KEYS, PHONE_DESKTOP_PAGES, PHONE_ANGLE, PHONE_DIGEST_PICK, phoneProbeSpec, phoneRoundDigest, phoneAvoidBlock, renderPhoneModule, AlbumView, ReadingView, ShoppingView, TakeoutView, HealthView, BiliView, LateNightView, PlazaView, CalendarView, StickyView, ClipView, STICKY_COLORS, PGlyph, HEALTH_GROUPS, WISH_COVERS, READ_PALETTES, READ_BG, READ_INK, FULL_BLEED_KEYS, readMinutes, readFmtMin, readGoalColor, resetStateIdx };");
  return fn(...names.map(n => env[n]));
}

// 每个 app 一份「模型会返回的样子」的假数据，字段照 schemaHint 来
const FIXTURES = {
  wechat: { chats: [{ type: "private", name: "老张", last: "到了说一声", time: "14:20", messages: [{ from: "老张", text: "到了说一声" }] }], userContact: { name: "Lisa", remark: "L", intro: "她" }, contacts: [{ name: "老张", remark: "张", intro: "同事" }], moments: [{ author: "老张", time: "2小时前", content: "下雨了", likes: ["A"], comments: [{ from: "B", text: "嗯" }] }], me: { wechatName: "屿", wechatId: "sy", signature: "…", accounts: [{ title: "文", source: "号", time: "昨晚", summary: "s", thought: "t" }] } },
  notes: { items: [
    { kind: "typed", title: "买猫粮", time: "昨天 21:03", body: "顺便看看猫砂", color: 0 },
    { kind: "voice", title: "算了", time: "昨天 23:40", duration: "0:37", body: "本来想说……算了，你别管。", color: 4 }
  ] },
  calls: { items: [{ name: "妈", dir: "in", time: "今天 09:12", connected: true, duration: "04:32" }] },
  browser: { items: [{ title: "失眠怎么办", url: "www.x.com", time: "13:40", content: "一堆废话" }] },
  shopping: {
    account: { name: "只买合用的", uid: "1043827", member: "黑金御令会员", style: "实用利落兼带几件扎眼红衣", monthSpend: 3260.5, monthOrders: 8, points: 18420, persona: "买东西极快但退换极少，嫌麻烦多过心疼银子" },
    shipping: [{ status: "派送中", eta: "今日 18:00 前", shop: "西市恒泰皮货行", title: "熟制牛皮马鞍垫配铜扣（深赭色/加厚骑乘款）", progress: 78, carrier: "顺丰速运", tail: "9042", amount: 340 }],
    cart: [{ shop: "江南织造局京城分号", title: "苏绣暗纹朱红广袖圆领袍", spec: "朱红配暗金云纹/尺码185", price: 680, was: 880, promo: "跨店满减", qty: 1 }],
    wish: [{ title: "纯手工织金大红妆花缎云肩", shop: "姑苏云锦织造", price: 420, why: "某人不是喜欢红的么，买来扣她脖子上" },
           { title: "榆木老料雕花围棋盘", shop: "古木清风堂", price: 890, why: "府里那张被陆闻拍裂了一条缝" }],
    orders: [{ shop: "城南老赵糕点铺", status: "已收货", time: "8月28日 14:15", title: "古法手作冰镇桂花糖糕组合",
      items: [{ name: "城南秘制桂花糖糕", spec: "八块装/油纸礼盒", qty: 2, price: 48 }, { name: "酥皮奶香酪干", spec: "原味半斤装", qty: 1, price: 32 }],
      ship: 0, paid: 128, tags: ["食品特产", "微信支付"], review: "糖糕味道没变，送过去刚好还带着井水湃过的凉气。",
      reason: "去某人院子前顺手买的，免得空手进门又被说吵", addr: "京城崇仁坊靖安王府东侧门" }],
    habit: { budget: "单笔50-800不等，看心情与用处", buys: "西北牛羊生鲜、结实马具皮件", avoids: "华而不实的宫廷摆件、甜腻花果酒", how: "多在策马回府后深夜翻看，看到合用的直接下单" },
    shops: [{ name: "陇右祁连物产馆", cat: "生鲜特产", why: "京城少有能买到正经西北滩羊的铺子，掌柜说话利索不墨迹" }],
    coupons: [{ rule: "满300减50", name: "塞外特产满减券", scope: "陇右祁连物产馆可用", until: "8月31日" }],
    viewed: [{ title: "苏绣暗纹朱红广袖圆领袍（暗金云纹）", shop: "江南织造局京城分号", price: 680, time: "今天 21:15" }],
    addrs: [{ label: "王府侧门", tail: "4819", detail: "京城崇仁坊靖安王府东侧小门（送至门房裴忠处）", isDefault: true },
            { label: "常去小院", tail: "4819", detail: "京城安民坊甜水井胡同内第三进院落（挂铜环黑漆木门，放门墩即可）", isDefault: false }],
    gifts: [{ who: "某位成天想收侧房的祖宗", title: "城南老赵家的冰镇桂花糖糕", note: "嘴上说着不喜欢我吵，接了油纸包自己一口气吃了三块" }],
    monthNote: "八月杂支开销三千余文。大半花在日常马具磨损换新、文房宣纸和西北弄来的滩羊肉上。",
    tail: "程策那马鞍垫子今天该送到了。还有那身红袍子，改天穿过去看看谁比谁好看。"
  },
  album: { items: [{ id: "p01", caption: "锁死的代码注释", date: "2026-08-28 18:42", category: "private", desc: "屏幕", thought: "别看" }] },
  settings: { screenTime: "6小时12分", apps: [{ name: "微信", time: "2小时3分" }] },
  reading: {
    shelves: [
      { name: "京华杂谈与消遣", slug: "bizarre", books: [
        { title: "东京梦华录", author: "孟元老", readAt: "卷七·饮食果子", quote: "", note: "看到里面写市井夜市的煎白肠和澄沙团子，突然觉得京城这些年也没变多少。" },
        { title: "醉翁谈录", author: "罗烨", readAt: "还没翻开", quote: "灯下一盏残茶", note: "买来压着一摞折子，一直没动。" }] },
      { name: "怎么对付某个麻烦精", slug: "managing_troublemaker", books: [
        { title: "反经", author: "赵蕤", readAt: "第 3 章", quote: "", note: "没什么用，她根本不按这里头写的来。" }] }
    ],
    archive: { name: "夜读客", uid: "7742019", favorite: { title: "东京梦华录", author: "孟元老" }, weekTime: "7小时5分", weekGoal: "5小时", plan: { title: "闲情偶寄", author: "李渔" } }
  },
  liked: {
    me: { name: "不点灯", xhsId: "159193450", bio: "", tag: "京城", posts: 2, following: 86, followers: 21, likes: 153 },
    tabs: ["附近", "野钓", "旧物"],
    items: [{ author: "阿七", title: "一个人吃饭的十种办法", excerpt: "第三种最省事。", tab: "附近", tags: ["独居"], likes: 1204, act: "收藏", time: "3天前", cover: 1 },
            { author: "老周", title: "谁懂啊这把刀磨了三个月", excerpt: "刃口终于服帖了。", tab: "旧物", tags: ["磨刀"], likes: 88, act: "赞", time: "上周", cover: 3 }],
    mine: [{ title: "夜里的城南", excerpt: "没人。", tags: ["夜路"], likes: 12, time: "上周", cover: 2 }],
    drafts: [{ title: "写给某个不看的人", excerpt: "算了。", tags: ["没发"], savedAt: "存了 11 天" }],
    follows: [{ name: "斫木记", desc: "做木工的" }]
  },
  health: {
    today: { score: 74, label: "熬了半宿，白天却跑了一整天" },
    cards: [
      { name: "睡眠质量", group: "body", wide: true, score: 68, value: "6.2", unit: "h", tag: "欠佳",
        note: "昨夜因西北旧部送来的几封暗折多看了半宿，寅时才阖眼。睡眠浅且多梦，醒来时略有头痛。",
        stats: [{ k: "入睡时刻", v: "02:15" }, { k: "深度睡眠", v: "1.1h" }, { k: "清醒次数", v: "3次" }],
        week: [62, 55, 70, 48, 66, 58, 72], quote: "十二年了，在京城这破地方就没怎么睡踏实过。" },
      { name: "步数", group: "body", wide: false, score: 85, value: "11420", unit: "步", tag: "达标",
        note: "除开骑马路程，在某人府邸里把东厢房、西厢房和后院彻底搜了个底朝天。",
        stats: [{ k: "搜查厢房", v: "3200步" }, { k: "官署穿行", v: "4100步" }, { k: "日常散步", v: "4120步" }],
        week: [40, 55, 62, 70, 58, 80, 92], quote: "把她那破院子翻了个遍，连根红线都没瞧见。" },
      { name: "运动质量", group: "body", wide: false, score: 88, value: "45", unit: "min", tag: "高强度",
        note: "申时接到某人要纳侧房的消息，自王府一路策马狂奔过朱雀街。",
        stats: [{ k: "疾驰骑行", v: "28min" }, { k: "翻墙潜入", v: "5min" }, { k: "高负荷间歇", v: "12min" }],
        week: [30, 45, 60, 55, 70, 88, 90], quote: "为了逮某个嘴里没准话的家伙，马鞍都磨坏了。" },
      { name: "情绪状态", group: "mind", wide: true, score: 80, value: "起伏", unit: "", tag: "亢奋气恼",
        note: "上午在官署应付朝臣颇感无聊厌烦；午后因对方荒唐戏言骤然动怒发酸。",
        stats: [{ k: "朝堂烦躁度", v: "60%" }, { k: "吃醋暴躁值", v: "95%" }, { k: "得逞愉悦度", v: "88%" }],
        week: [50, 44, 38, 60, 72, 66, 80], quote: "嘴上嫌我吵，我看她拿着那张纸半天没憋出屁来。" },
      { name: "社交能量", group: "mind", wide: false, score: 85, value: "极高", unit: "", tag: "过度倾注",
        note: "在朝堂与旧部间维持一贯的假笑与周旋，社交电量原本已见底。",
        stats: [{ k: "虚与委蛇", v: "15%" }, { k: "质问拆台", v: "50%" }, { k: "长篇定论", v: "35%" }],
        week: [55, 60, 48, 70, 66, 78, 85], quote: "外人面前说三分留七分，对她真是一点没藏住。" },
      { name: "玉简传信", group: "intake", wide: false, score: 65, value: "5.2", unit: "h", tag: "频繁回信",
        note: "本在琢磨西北送来的旧账，偏生你一条接一条扯谎闹腾。",
        stats: [{ k: "胡同赶路查信", v: "1.4 h" }, { k: "按要求拟长表", v: "2.1 h" }, { k: "日常闲聊拌嘴", v: "1.7 h" }],
        week: [40, 52, 60, 44, 70, 66, 65], quote: "大半时间都在盯你那些胡言乱语。" },
      { name: "饮水", group: "intake", wide: false, score: 70, value: "1800", unit: "ml", tag: "基本充足",
        note: "上午在鸿胪寺饮了两盏劣质苦茶，午后一路疾奔口干舌燥。",
        stats: [{ k: "官署苦茶", v: "600ml" }, { k: "某人案头凉茶", v: "500ml" }, { k: "日常饮水", v: "700ml" }],
        week: [60, 66, 70, 62, 74, 70, 70], quote: "她那的茶泡得跟刷锅水一样，也就我咽得下。" }
    ],
    timeline: [
      { time: "02:34", tag: "睡眠", text: "看暗折到寅时才入睡，睡眠时间被严重压缩。" },
      { time: "13:15", tag: "心率", text: "听闻某人要纳侧房，心率突增至126bpm。" }
    ],
    insights: [
      { title: "情绪与生理强关联", text: "特定亲密互动消息能瞬间打破午后的倦怠，促使心率与体温双重上升。" },
      { title: "作息弹性良好", text: "即使连续熬夜，短时间的调息也能快速恢复精力。" }
    ],
    tail: "恋爱申请表都填完了，考官人呢？我已经到老地方了。"
  },
  takeout: {
    account: { name: "夜里叫吃的", uid: "88412037", member: "常客", monthOrders: 22, monthSpend: 1180, persona: "饿到极限才想起吃，点完又嫌等得久" },
    today: { addrLabel: "家", addrDetail: "宣武坊靖安王府东路侧院书斋", date: "8月28日 周五", meal: "午餐", shop: "西市老马家·正宗西北羊肉馆", rating: "4.6", eta: "12:45送达", delivery: "跑腿专送", main: "红焖滩羊排配烤馕（小份/微辣/多蒜少盐）", amount: 68.5, status: "已送达", note: "趁热吃，烤馕另外油纸包，勿闷软" },
    shops: [{ name: "西市老马家", cat: "西北菜", times: "点过 24 次", usual: "红焖滩羊排", why: "京城里唯一一把西北羊肉火候", last: "今天中午", cover: 0 },
            { name: "城南徐记冷食铺", cat: "点心", times: "点过 18 次", usual: "老字号凉糖糕", why: "那脾气坏的老头手艺没得挑", last: "昨天", cover: 1 }],
    live: [{ status: "已送达", eta: "已于13:30送达", shop: "城南徐记冷食铺", items: "冰镇杏酪酥糕（少糖）×2、酸梅熟水×1", rider: "伙计小赵", step: 3, amount: 42, note: "" }],
    orders: [{ shop: "西市老马家·正宗西北羊肉馆", time: "今天 12:10", meal: "午餐", status: "已完成", main: "红焖滩羊排配烤馕",
      items: [{ name: "红焖滩羊排配烤馕", spec: "小份/微辣/多蒜少盐", qty: 1, price: 52 }, { name: "羊杂清汤", spec: "去香菜/加白胡椒", qty: 1, price: 14.5 }],
      pack: 0, fee: 2, amount: 68.5, stars: 5, rating: "羊肉膻味去得干净，比宫里御膳房焖得透。",
      tags: ["西北菜/羊肉", "午餐", "银票月结"], addr: "宣武坊靖安王府东路侧院书斋", note: "多放蒜头，免香菜", reason: "看了一上午西北送来的烂账，换换嘴里寡淡气" }],
    taste: { spicyTags: ["偏好微辣", "重胡椒与孜然提味", "忌死辣"], avoidTags: ["御膳房那种绵软膻气的假羊肉", "生姜丝", "过多死甜"], likeTags: ["西北风味牛羊肉", "烤得极脆的面饼", "井水镇透的凉糖糕"], budget: "单人日常30-80两文银等值铜子，宴客无上限", habit: "作息不定，午间看账必点硬菜，深夜常需热汤" },
    week: [{ day: "一", meals: [{ t: "早", text: "王记葱油千层火烧×2" }, { t: "午", text: "太白居清蒸江鲈鱼" }, { t: "晚", text: "西市老马家大盘手抓羊肉" }] },
           { day: "二", meals: [{ t: "早", text: "府内杂粮粥（未点送）" }, { t: "晚", text: "城南徐记冷糖糕（送她）" }] }],
    coupons: [{ amount: "50", unit: "元", name: "老马家熟客月俸帖", scope: "西市老马家·正宗西北羊肉馆", until: "8月31日" },
              { amount: "免跑腿脚钱2文", unit: "", name: "徐记消暑引子", scope: "城南徐记冷食铺", until: "9月5日" }],
    addrs: [{ label: "王府侧院（本人）", tail: "3391", detail: "宣武坊靖安王府东路侧院书斋（走后巷角门敲三声）", isDefault: true },
            { label: "某人的窝（投喂）", tail: "8824", detail: "柳林胡同七号院西厢房（门没锁直接推，搁石桌上）", isDefault: false }],
    wish: [{ title: "大塞外雪夜里现杀现烤的整只焦皮羊", when: "宫里宴饮喝了一肚子温吞没味的名贵御酒时" }],
    together: [{ who: "某位扬言要纳侧房的祖宗", items: "城南徐记凉糖糕（双份）+ 冰镇杏酪", story: "嘴上喊着不吃厨房做多的点心，结果一盒四个她一个人吃掉三个半，最后还嫌芝麻粘牙。" },
               { who: "陆闻那个嘴碎编修", items: "刘胡子铁板炙烤羊排 + 散装烧刀子酒", story: "两个人就着两盘焦肉吵了一整晚西北军饷到底卡在工部还是户部，谁也没说服谁。" }],
    monthNote: "本周单子多是老马家的羊肉和徐记的甜食。宫里御膳房的饭菜依然难以下咽。",
    tail: "城南老头的糖糕还是得催伙计跑快点，冰化了就腻。"
  },
  clipboard: { items: [{ text: "其实我", from: "微信", time: "昨天 02:11", sent: false }, { text: "SF1234567", from: "短信", time: "今天", sent: true }] },
  calendar: {
    monthLabel: "9月",
    items: [{ title: "去看眼睛", date: "2026-09-02", time: "14:00", kind: "提醒", done: false, postponed: 4, note: "上个月就说要去", who: "" },
            { title: "交房租", date: "2026-09-01", time: "", kind: "事件", done: true, postponed: 0, note: "", who: "" },
            { title: "跟老周吃饭", date: "2026-09-06", time: "19:00", kind: "事件", done: false, postponed: 1, note: "", who: "老周" }]
  },
  bili: {
    me: { name: "夜奔的马", uid: "3947201", level: 5, followers: 128, fans: 37, coins: 412 },
    tabs: ["推荐", "科技", "生活"],
    items: [{ title: "老木匠三天复原一张宋代圈椅，全程无钉", up: "斫木记", tab: "生活", duration: "18:24", views: "12.4万", danmaku: 320, desc: "全榫卯。", thought: "手比嘴老实。", myDanmaku: ["这一榫开得漂亮"] },
            { title: "一个人守夜的第 400 天", up: "更漏声", tab: "推荐", duration: "08:02", views: "873", danmaku: 12, desc: "夜里的城。", thought: "行吧。", myDanmaku: [] }]
  },
  latenight: {
    me: { uid: "u_7741903", lastAt: "前天 03:12", note: "看完就删，第二天照样装没事。" },
    items: [{ title: "夜", duration: "00:18:42", tags: ["旧衣", "灯下"], views: "3.2万", thought: "想到某人穿红的样子。" }]
  }
};

const LIVE = {
  forumAccounts: [
    { key: "main", label: "大号", name: "沈屿白", handle: "@shen", bio: "无", followers: 12, following: 3, joinTs: 1704067200000, posts: [{ id: "p1", board: "日常吧", title: "今天", body: "正文", ts: 1756400000000, replyCount: 2, replies: [{ name: "A", text: "嗯", mine: false, ts: 1 }] }], comments: [{ postId: "x", postTitle: "别人的帖", board: "吐槽吧", text: "我也是", ts: 2, backCount: 1 }] },
    { key: "alt", label: "小号", name: "潮汐背面", handle: "@side", bio: "b", followers: 3, following: 1, joinTs: 1704067200000, posts: [], comments: [] },
    { key: "anon", label: "匿名", name: "匿名用户", handle: "@anonymous", bio: "b", posts: [], comments: [] }
  ],
  playlist: { name: "沈屿白的歌单", songs: [{ id: "s1", title: "爱人错过", artist: "告五人", cover: null, note: "回家路上单曲循环那段" }] },
  onGenPlaylist: () => {}, playlistBusy: false, onPlaySong: () => {}, onPeek: () => {}
};

module.exports = { loadPhone, FIXTURES, LIVE, SRC };
