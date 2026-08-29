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
  const fn = new Function(...names, SRC + "\n;return { PHONE_APPS, PHONE_LIVE_KEYS, PHONE_LABEL, PHONE_DESKTOP_LAYOUTS, PHONE_DOCK_KEYS, PHONE_DESKTOP_PAGES, PHONE_ANGLE, PHONE_DIGEST_PICK, phoneProbeSpec, phoneRoundDigest, phoneAvoidBlock, renderPhoneModule, AlbumView, ReadingView, PGlyph, READ_PALETTES, FULL_BLEED_KEYS, resetStateIdx };");
  return fn(...names.map(n => env[n]));
}

// 每个 app 一份「模型会返回的样子」的假数据，字段照 schemaHint 来
const FIXTURES = {
  wechat: { chats: [{ type: "private", name: "老张", last: "到了说一声", time: "14:20", messages: [{ from: "老张", text: "到了说一声" }] }], userContact: { name: "Lisa", remark: "L", intro: "她" }, contacts: [{ name: "老张", remark: "张", intro: "同事" }], moments: [{ author: "老张", time: "2小时前", content: "下雨了", likes: ["A"], comments: [{ from: "B", text: "嗯" }] }], me: { wechatName: "屿", wechatId: "sy", signature: "…", accounts: [{ title: "文", source: "号", time: "昨晚", summary: "s", thought: "t" }] } },
  notes: { items: [{ title: "买猫粮", time: "昨天 21:03", detail: "顺便看看猫砂" }] },
  calls: { items: [{ name: "妈", dir: "in", time: "今天 09:12", connected: true, duration: "04:32" }] },
  browser: { items: [{ title: "失眠怎么办", url: "www.x.com", time: "13:40", content: "一堆废话" }] },
  shopping: { items: [{ name: "台灯", price: "¥128", time: "3天前", thought: "夜里看书不刺眼" }] },
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
    archive: { favorite: { title: "东京梦华录", author: "孟元老" }, weekTime: "7小时5分", plan: { title: "闲情偶寄", author: "李渔" } }
  },
  liked: { follows: [{ name: "猫猫日报", desc: "撸猫" }], items: [{ author: "阿七", kind: "图文", content: "一个人吃饭的十种办法", tag: "生活", time: "3天前", act: "收藏" }] },
  orders: { items: [{ type: "外卖", title: "馄饨", amount: 24, time: "昨天 23:41", addr: "家", note: "麻烦轻一点敲门" }, { type: "打车", title: "公司→家", amount: 38, time: "前天 01:10" }] },
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
