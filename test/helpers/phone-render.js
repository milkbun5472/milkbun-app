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
  const fn = new Function(...names, SRC + "\n;return { PHONE_APPS, PHONE_LIVE_KEYS, PHONE_LABEL, PHONE_DESKTOP_LAYOUTS, PHONE_DOCK_KEYS, PHONE_DESKTOP_PAGES, PHONE_ANGLE, PHONE_DIGEST_PICK, phoneProbeSpec, phoneRoundDigest, phoneAvoidBlock, renderPhoneModule, AlbumView, ReadingView, ShoppingView, PGlyph, READ_PALETTES, READ_BG, READ_INK, FULL_BLEED_KEYS, readMinutes, readFmtMin, readGoalColor, resetStateIdx };");
  return fn(...names.map(n => env[n]));
}

// 每个 app 一份「模型会返回的样子」的假数据，字段照 schemaHint 来
const FIXTURES = {
  wechat: { chats: [{ type: "private", name: "老张", last: "到了说一声", time: "14:20", messages: [{ from: "老张", text: "到了说一声" }] }], userContact: { name: "Lisa", remark: "L", intro: "她" }, contacts: [{ name: "老张", remark: "张", intro: "同事" }], moments: [{ author: "老张", time: "2小时前", content: "下雨了", likes: ["A"], comments: [{ from: "B", text: "嗯" }] }], me: { wechatName: "屿", wechatId: "sy", signature: "…", accounts: [{ title: "文", source: "号", time: "昨晚", summary: "s", thought: "t" }] } },
  notes: { items: [{ title: "买猫粮", time: "昨天 21:03", detail: "顺便看看猫砂" }] },
  calls: { items: [{ name: "妈", dir: "in", time: "今天 09:12", connected: true, duration: "04:32" }] },
  browser: { items: [{ title: "失眠怎么办", url: "www.x.com", time: "13:40", content: "一堆废话" }] },
  shopping: {
    account: { member: "黑金御令会员", style: "实用利落兼带几件扎眼红衣", monthSpend: 3260.5, monthOrders: 8, points: 18420, persona: "买东西极快但退换极少，嫌麻烦多过心疼银子" },
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
  recordings: { items: [{ name: "凌晨三点", time: "昨天 23:40", transcript: "……算了", thought: "说不出口" }] },
  video_day: { items: [{ title: "修表", up: "老李", tag: "手工", duration: "08:24" }] },
  video_night: { items: [{ title: "夜", duration: "00:18:42", tags: ["a", "b"], thought: "…" }] },
  reading: {
    shelves: [
      { name: "京华杂谈与消遣", slug: "bizarre", books: [
        { title: "东京梦华录", author: "孟元老", readAt: "卷七·饮食果子", quote: "", note: "看到里面写市井夜市的煎白肠和澄沙团子，突然觉得京城这些年也没变多少。" },
        { title: "醉翁谈录", author: "罗烨", readAt: "还没翻开", quote: "灯下一盏残茶", note: "买来压着一摞折子，一直没动。" }] },
      { name: "怎么对付某个麻烦精", slug: "managing_troublemaker", books: [
        { title: "反经", author: "赵蕤", readAt: "第 3 章", quote: "", note: "没什么用，她根本不按这里头写的来。" }] }
    ],
    archive: { favorite: { title: "东京梦华录", author: "孟元老" }, weekTime: "7小时5分", weekGoal: "5小时", plan: { title: "闲情偶寄", author: "李渔" } }
  },
  liked: { follows: [{ name: "猫猫日报", desc: "撸猫" }], items: [{ author: "阿七", kind: "图文", content: "一个人吃饭的十种办法", tag: "生活", time: "3天前", act: "收藏" }] },
  health: { restingHr: 62, weekNote: "本周平均睡眠 5.9 小时。", week: [{ day: "周一", date: "8月24日", sleepStart: "01:20", sleepEnd: "07:05", hours: 5.8, steps: 4200 }, { day: "周二", date: "8月25日", sleepStart: "03:10", sleepEnd: "08:00", hours: 4.8, steps: 900 }] },
  clipboard: { items: [{ text: "其实我", from: "微信", time: "昨天 02:11", sent: false }, { text: "SF1234567", from: "短信", time: "今天", sent: true }] },
  calendar: { items: [{ title: "体检", when: "9月2日 14:00", kind: "提醒", done: false, postponed: 4, note: "" }, { title: "交房租", when: "每月1号", kind: "事件", done: true, postponed: 0 }] }
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
