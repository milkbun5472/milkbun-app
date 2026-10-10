(function (root) {
  "use strict";
  const KEY = "x_autoRefreshPolicy_v1";
  const FEATURES = [
    { id: "phone", group: "content", title: "查手机", sub: "每周补刷角色手机内容", globalDefault: true, charDefault: false },
    { id: "weekly", group: "content", title: "周刊", sub: "进入新刊期后自动装订", globalDefault: true, charDefault: true },
    { id: "diary", group: "content", title: "日记", sub: "每天补写前一天日记", globalDefault: true, charDefault: true },
    // 每周一次（她 2026-10-06：「一周一次就是为了省调用次数」）：周日过完，一枪把那一周七天的日常消费推演完
    { id: "wallet", group: "content", title: "钱包", sub: "跨天补齐日常收支", globalDefault: true, charDefault: true,
      rates: [{ id: "day", zh: "每天一次", x: 1, note: "每天过完补前一天，一个人一天调用一次" },
        { id: "week", zh: "每周一次", x: 1, note: "周日过完，下次打开时一枪把周一到周日七天一起补上，一个人一周只调用一次；这周你在钱包里自己生成过的那天会跳过" }],
      rateDefault: "day" },
    { id: "schedule", group: "content", title: "角色日程", sub: "每周补排与白天临时改计划", globalDefault: true, charDefault: true },
    // 走哪条线路（群友 2026-10-09）：发呆、盘一盘这两枪原来写死走专线→线上；观察和性格那两样本来就走后台
    { id: "desire", group: "content", title: "心上", sub: "每日灵光与周期整理", globalDefault: true, charDefault: true,
      rates: [{ id: "online", zh: "走线上", note: "发呆和盘一盘照 TA 本人说话那条走：挑过专线走专线，没挑走线上。旁观的那几样本来就走后台" },
        { id: "bg", zh: "走后台", note: "发呆和盘一盘也走你配的后台线路，省钱；没配后台就照旧落回线上" }],
      rateDefault: "online" },
    { id: "impression", group: "content", title: "月度印象", sub: "每月 1 号后自动写上个月的印象卡", globalDefault: true, charDefault: true },
    { id: "moments", group: "social", title: "朋友圈", sub: "低频主动发动态", globalDefault: true, charDefault: true },
    { id: "forum", group: "social", title: "论坛", sub: "低频主动发帖", globalDefault: true, charDefault: true },
    { id: "whisper", group: "social", title: "悄悄话", sub: "关系内低频留言", globalDefault: true, charDefault: true },
    { id: "capsule", group: "social", title: "时光胶囊", sub: "低频主动埋下胶囊", globalDefault: true, charDefault: true },
    { id: "gaze", group: "content", title: "Ta 眼里", sub: "聊够了自动建卡、隔一阵自动复看", globalDefault: true, charDefault: true },
    // ⚠️主动私聊的每人开关原来在聊天设置里另存一份（s.proactive，默认关），两边各显示各的。
    //   现在两边都读写这一份；旧存档开机时由 app.js 把 s.proactive 搬进来（默认关照旧）。
    { id: "proactive", group: "social", title: "主动私聊", sub: "生日、提醒、想念与主动找你", globalDefault: true, charDefault: false,
      // 中频＝原来那套算法本身；低频、高频是把整套【时间】乘一个倍数——想念攒得慢一些（×0.75）／快一倍，冷却跟着拉长／缩短
      rates: [{ id: "low", zh: "低频", x: 0.75 }, { id: "mid", zh: "中频", x: 1 }, { id: "high", zh: "高频", x: 2 },
        // 很高频（她 2026-10-11 转群友「开了高频还是要等很久」）：快四倍，聊停了一两个小时就来找
        { id: "max", zh: "很高频", x: 4, note: "想念攒得快四倍，聊停了一两个小时就会来找你；刚找过你之后再找的间隔也缩到四分之一" }] },
    { id: "letter", group: "social", title: "情书", sub: "恋人按你定的频率自己提笔", globalDefault: true, charDefault: true },
    // 今日签（她 2026-10-05）：TA 每天早上按你的星座替你抽一张签发到私聊。默认关，想要的自己开、自己挑谁
    { id: "astroSign", group: "social", title: "今日签", sub: "TA 每天替你抽一张签发到私聊（按你的星座和当天）", globalDefault: false, charDefault: false },
    { id: "react", group: "social", title: "顺手点评", sub: "你记完一笔账、勾掉一条提醒时TA搭一句", globalDefault: true, charDefault: true },
    // 下面两样是按「群」「这一场」开的，不按人：设置里只有总闸，细的开关留在各自页面里
    { id: "groupChat", group: "social", title: "群里自己聊", sub: "群成员在你不说话时自己接着聊", globalDefault: true, charDefault: true, noChars: true },
    { id: "listen", group: "social", title: "一起听时开口", sub: "一起听歌时TA一首歌最多自己说一句", globalDefault: true, charDefault: true, noChars: true },
    { id: "watch", group: "social", title: "一起看时开口", sub: "一起看剧时TA隔一阵自己说一句", globalDefault: true, charDefault: true, noChars: true }
  ];
  const byId = Object.fromEntries(FEATURES.map(x => [x.id, x]));
  function normalize(raw, legacyPhoneOn) {
    const src = raw && typeof raw === "object" ? raw : {};
    const old = src.features && typeof src.features === "object" ? src.features : {};
    const features = {};
    FEATURES.forEach(f => {
      const v = old[f.id] && typeof old[f.id] === "object" ? old[f.id] : {};
      let chars = v.chars && typeof v.chars === "object" ? { ...v.chars } : {};
      if (f.id === "phone" && !Object.keys(chars).length && legacyPhoneOn) chars = { ...legacyPhoneOn };
      const migrateWeeklyOn = f.id === "weekly" && src.version === 1;
      features[f.id] = { global: migrateWeeklyOn ? true : (typeof v.global === "boolean" ? v.global : f.globalDefault), chars,
        // 频率档（她 2026-10-03：「整套乘以几倍速」）：只有带 rates 的那几样有，缺省就是中频＝原来那套
        ...(f.rates ? { rate: f.rates.some(r => r.id === v.rate) ? v.rate : (f.rateDefault || "mid") } : {}) };
    });
    return { version: 2, features, legacyMerged: !!src.legacyMerged };
  }
  // 旧的「页面里自己那份开关」一次性搬进来（她 2026-09-29：「在 app 里关了设置也显示关了」）——
  //   搬完以后两边都读写这一份，不再各存各的。只搬一次（legacyMerged），之后旧键只是历史。
  //   legacy：{ chatSettings, forumOff, letterCfg, watchAuto }
  function absorbLegacy(policy, legacy) {
    const n = normalize(policy);
    if (n.legacyMerged) return n;
    const L = legacy || {};
    const pro = n.features.proactive.chars;
    Object.keys(L.chatSettings || {}).forEach(id => {
      const s = L.chatSettings[id] || {};
      // 旧口径：每人开关（默认关）× 旧的每人允许（默认开）同时开着才会主动
      pro[id] = !!s.proactive && pro[id] !== false;
    });
    (Array.isArray(L.forumOff) ? L.forumOff : []).forEach(id => { n.features.forum.chars[id] = false; });
    Object.keys(L.letterCfg || {}).forEach(id => { n.features.letter.chars[id] = !!(L.letterCfg[id] && L.letterCfg[id].auto); });
    if (L.watchAuto === false) n.features.watch.global = false;
    n.legacyMerged = true;
    return n;
  }
  // 页面里那颗开关打开【这一个】时：总闸要是关着，一起打开（她按的就是「要」）
  function turnOnFor(policy, id, charId) {
    let n = normalize(policy);
    if (charId) n = setChar(n, id, charId, true);
    if (!n.features[id].global) n = setGlobal(n, id, true);
    return n;
  }
  // 只看这个人自己那一格、不看总闸——「这个人逛不逛论坛」这种页面里的名单用它
  function charOn(policy, id, charId) {
    const f = byId[id]; if (!f) return false;
    const c = normalize(policy).features[id].chars;
    return Object.prototype.hasOwnProperty.call(c, charId) ? c[charId] !== false : f.charDefault;
  }
  function enabled(policy, id, charId) {
    const f = byId[id]; if (!f) return false;
    const p = normalize(policy).features[id];
    if (!p.global) return false;
    if (!charId) return true;
    return Object.prototype.hasOwnProperty.call(p.chars, charId) ? p.chars[charId] !== false : f.charDefault;
  }
  function setGlobal(policy, id, on) {
    const n = normalize(policy); n.features[id] = { ...n.features[id], global: !!on }; return n;
  }
  function setRate(policy, id, rate) {
    const n = normalize(policy), f = byId[id];
    if (!f || !f.rates || !f.rates.some(r => r.id === rate)) return n;
    n.features[id] = { ...n.features[id], rate }; return n;
  }
  // 这一样此刻的倍数（没有档位的一律 1）
  function rateX(policy, id) {
    const f = byId[id]; if (!f || !f.rates) return 1;
    const cur = normalize(policy).features[id].rate;
    return (f.rates.find(r => r.id === cur) || { x: 1 }).x;
  }
  function setChar(policy, id, charId, on) {
    const n = normalize(policy), cur = n.features[id];
    n.features[id] = { ...cur, chars: { ...cur.chars, [charId]: !!on } }; return n;
  }
  root.AutoRefreshPolicy = { KEY, FEATURES, normalize, enabled, setGlobal, setRate, rateX, setChar, absorbLegacy, turnOnFor, charOn };
  if (typeof module !== "undefined" && module.exports) module.exports = root.AutoRefreshPolicy;
})(typeof window !== "undefined" ? window : globalThis);
