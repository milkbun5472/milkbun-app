// 邮票册（2026-10-26 她定的方案，文档「邮票册 · 抽卡方案」）——不带界面的那一层：
//   价格、概率、保底、点数、等级、限时主题日历。界面在 js/stamps.js，写卡和画卡面在 app.js。
//   存档只有一把键 x_stamps，走 loadJSON / saveJSON（进 IDB，施工规则/no-small-warehouse.md）。
(function (g) {
  "use strict";
  const PRICE_ONE = 100, PRICE_TEN = 900;
  const RATE = { SSR: 0.05, SR: 0.25 };          // 其余是 R
  const SOFT_FROM = 50, HARD_AT = 60;           // 第 50 抽起 SSR 概率往上加，第 60 抽必出
  const SR_EVERY = 10;                          // 每十抽至少一张 SR 以上
  const BDAY = { rate: 0.10, dayRate: 0.25, hard: 40, beg: 20 };   // 生日池：平时 10%、当天 25%、40 抽保底、20 抽起能求情
  const CAP = { R: 30, SR: 40, SSR: 50 };
  const FULL_COST = { R: 400, SR: 1000, SSR: 2000 };   // 一张卡升满要的印泥（含过坎）
  const GIFT = { tickets: 15, ink: 2000 };      // 上线礼：15 张十连券 + 2000 印泥
  // 互动给多少（邮资、印泥）。一次调用算一轮；文档那张表。
  const GAIN = {
    round: [5, 5],      // 单聊、群聊、通话、出戏：一轮
    beat: [10, 10],     // 线下一拍（单人、群）
    public: [10, 10],   // 论坛、片刻、广场、朋友圈：发一条或评论一条
    duo: [10, 10],      // 匿名信箱、情书、交换日记、问答小本、悄悄话、留言、日记评论、照相馆、送礼、外卖
    stay: [20, 20],     // 一起听、一起看、一起读、查手机翻一次、看 TA 玩
    play: [5, 10]       // 其他花调用的玩法：同人文、梦境、擂台、另一种我们、跑团、塔罗、星测、解梦、一起学
  };
  // 限时主题日历：到点自己上、到点自己下，不用发版开关。时间都是北京时间。
  const LIMITED = [
    { id: "halloween26", name: "万圣夜", from: "2026-10-26T00:00:00+08:00", to: "2026-11-15T00:00:00+08:00",
      stamp: "南瓜灯邮票",
      line: "主题是万圣夜：南瓜灯、变装、糖果、讨糖、夜色里的派对和一点点吓人。先看这个人是哪个世界、哪个年代的人，再决定万圣夜怎么落到他身上。" }
  ];

  const S = () => (typeof loadJSON === "function" ? loadJSON("x_stamps", null) : null) || {};
  const blank = () => ({ postage: 0, ink: 0, tickets: 0, pulls: 0, sinceSSR: 0, sinceSR: 0, bday: {}, cards: [], gifted: false, seenLimited: {}, opt: {} });
  function load() { const s = S(); return Object.assign(blank(), s, { bday: s.bday || {}, cards: Array.isArray(s.cards) ? s.cards : [], opt: s.opt || {}, seenLimited: s.seenLimited || {} }); }
  function save(st) { if (typeof saveJSON === "function") saveJSON("x_stamps", st); try { g.dispatchEvent && g.dispatchEvent(new CustomEvent("stamps-change")); } catch (e) {} return st; }

  // 互动攒邮资、印泥：app 各处真发生了一次互动就喊一声，没有上限
  function gain(kind) {
    const v = GAIN[kind]; if (!v) return;
    const st = load(); st.postage += v[0]; st.ink += v[1]; save(st);
  }
  // 第一次打开时到账；每开一期限时主题、每个生日池出现时各送一张十连券
  function grantOnOpen(now, birthdays) {
    const st = load(), got = [];
    if (!st.gifted) { st.gifted = true; st.tickets += GIFT.tickets; st.ink += GIFT.ink; got.push("开幕纪念：" + GIFT.tickets + " 张十连券、" + GIFT.ink + " 印泥"); }
    activeLimited(now).forEach(L => { if (!st.seenLimited[L.id]) { st.seenLimited[L.id] = 1; st.tickets += 1; got.push("「" + L.name + "」上新：一张十连券"); } });
    (birthdays || []).forEach(b => { const k = "bd_" + b.id + "_" + b.year; if (!st.seenLimited[k]) { st.seenLimited[k] = 1; st.tickets += 1; got.push(b.name + " 的生日池：一张十连券"); } });
    if (got.length) save(st);
    return got;
  }
  function activeLimited(now) { const t = now || Date.now(); return LIMITED.filter(L => t >= Date.parse(L.from) && t < Date.parse(L.to)); }
  // 生日池：生日前 14 天出现，生日后留 7 天。bday 是 "MM-DD"
  function bdayWindow(bday, now) {
    // 农历、公历都认：照 engine.js 那份 birthdaySolarDate 算今年落在哪天
    const dayOf = y => {
      if (typeof birthdaySolarDate === "function") { const d = birthdaySolarDate(bday, y); return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : null; }
      const m = /(\d{1,2})-(\d{1,2})$/.exec(String(bday || "").trim()); return m ? new Date(y, +m[1] - 1, +m[2]).getTime() : null;
    };
    const t = now || Date.now(), y0 = new Date(t).getFullYear();
    for (const y of [y0 - 1, y0, y0 + 1]) {
      const day = dayOf(y); if (day == null) return null;
      const open = day - 14 * 86400000, close = day + 8 * 86400000;   // 生日当天算完整一天，再留 7 天
      if (t >= open && t < close) return { year: y, day, open, close, isDay: t >= day && t < day + 86400000 };
    }
    return null;
  }
  // 掷一张的稀有度。共用保底（sinceSSR/sinceSR）在 st 上，生日池另记在 st.bday[charId]
  function rollRarity(st, opts, rnd) {
    const r = rnd || Math.random;
    if (opts && opts.bday) {
      const b = st.bday[opts.bday] || (st.bday[opts.bday] = { since: 0, pulls: 0, got: false, begged: false });
      b.pulls++; b.since++;
      const p = opts.isDay ? BDAY.dayRate : BDAY.rate;
      const hit = b.since >= BDAY.hard || r() < p;
      if (hit) { b.since = 0; b.got = true; return "SSR"; }
      return r() < RATE.SR / (1 - p) ? "SR" : "R";
    }
    st.pulls++; st.sinceSSR++; st.sinceSR++;
    let pSSR = RATE.SSR;
    if (st.sinceSSR >= SOFT_FROM) pSSR += (st.sinceSSR - SOFT_FROM + 1) * 0.06;   // 第 50 抽起每抽多 6%
    if (st.sinceSSR >= HARD_AT || r() < pSSR) { st.sinceSSR = 0; st.sinceSR = 0; return "SSR"; }
    if (st.sinceSR >= SR_EVERY || r() < RATE.SR / (1 - RATE.SSR)) { st.sinceSR = 0; return "SR"; }
    return "R";
  }
  // 付钱：用券或者邮资。n = 1 或 10
  function pay(st, n, useTicket) {
    if (n === 10 && useTicket && st.tickets > 0) { st.tickets--; return "ticket"; }
    const cost = n === 10 ? PRICE_TEN : PRICE_ONE;
    if (st.postage < cost) return null;
    st.postage -= cost; return "postage";
  }

  // 等级：每一级比上一级贵一点，过坎（10/20/30/40）另付一块。整张升满正好等于 FULL_COST
  function levelCost(rarity, lv) {   // 从 lv 升到 lv+1 要多少
    const cap = CAP[rarity] || 30; if (lv >= cap) return 0;
    const full = FULL_COST[rarity] || 400, gates = Math.floor((cap - 1) / 10);
    const gatePart = full * 0.2, perGate = gates ? gatePart / gates : 0, base = full - (gates ? gatePart : 0);
    const n = cap - 1, w = lv / n;                     // 越往后越贵：权重 0.6～1.4
    const step = base / n * (0.6 + 0.8 * w) ;
    return Math.max(1, Math.round(step + (lv % 10 === 0 && lv > 0 ? perGate : 0)));
  }
  function isGate(lv) { return lv > 0 && lv % 10 === 0; }
  // 过坎的额外条件：30 级以后的坎要这张卡发给他看过
  function gateBlocked(card, lv) { return isGate(lv) && lv >= 30 && !card.sentTs ? "这一坎要先把这张卡发给他看一次" : ""; }

  // 剧情按等级解锁：SSR 每十级一节（1 级第一节，40 级结局，50 级隐藏的路）
  function ssrUnlocked(lv) { return { sections: Math.min(4, 1 + Math.floor(lv / 10)), ending: lv >= 40, hidden: lv >= 50 }; }

  g.StampsCore = { PRICE_ONE, PRICE_TEN, RATE, SOFT_FROM, HARD_AT, SR_EVERY, BDAY, CAP, FULL_COST, GIFT, GAIN, LIMITED,
    load, save, gain, grantOnOpen, activeLimited, bdayWindow, rollRarity, pay, levelCost, isGate, gateBlocked, ssrUnlocked };
  // 各处喊一声就记上
  g.stampGain = gain;
  // 别的玩法不一处处去挂：callAI 成功一枪（她按下去的、不是后台）会广播 ai-ok，这儿按它是干嘛的分进几档。
  //   单聊、群聊、线下在 app.js 里自己记（要排掉主动消息和重 roll），这儿跳过 use=chat/offline。
  const SORT = [
    [/邮票册|幸运字符|群头衔|起名/, ""],
    [/论坛|片刻|广场|朋友圈|刷刷|shua|forum|moment/i, "public"],
    [/一起听|一起看|一起读|共读|查手机|看TA玩|phoneWatch|peek|listen|watch|read/i, "stay"],
    [/匿名|情书|交换日记|问答|悄悄话|留言|日记评论|照相馆|合照|礼物|外卖|anon|letter|studio/i, "duo"],
    [/同人|梦境|擂台|另一种我们|如果馆|跑团|塔罗|星测|解梦|一起学|照影|fanfic|dream|debate|trpg|tarot|astro|study|zhaoying/i, "play"]
  ];
  if (g.addEventListener) g.addEventListener("ai-ok", e => {
    const d = (e && e.detail) || {};
    if (d.use === "chat" || d.use === "offline") return;
    if (d.use === "call") { gain("round"); return; }
    const s = d.label + " " + d.tag;
    for (const [re, k] of SORT) if (re.test(s)) { if (k) gain(k); return; }
  });
  // 主屏图标：一枚齿孔边的邮票
  g.GStamps = function (p) {
    const h = g.React && g.React.createElement; if (!h) return null;
    const kids = [h("path", { key: 1, d: "M6 3.5h12v17H6z", strokeDasharray: "1.6 1.4" }), h("rect", { key: 2, x: 8.5, y: 6.5, width: 7, height: 8, rx: 0.6 }), h("path", { key: 3, d: "M8.5 17.5h7" })];
    if (typeof g.Svg === "function") return h(g.Svg, p, kids);
    return h("svg", { width: (p && p.size) || 24, height: (p && p.size) || 24, viewBox: "0 0 24 24", fill: "none", stroke: (p && p.color) || "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }, kids);
  };
})(typeof window !== "undefined" ? window : globalThis);
