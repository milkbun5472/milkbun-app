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
  const GIFT = { tickets: 15, ink: 2000 };
  const DUPE_INK = 500;                         // 限定 SSR 重复一张折多少印泥      // 上线礼：15 张十连券 + 2000 印泥
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
      stamp: "南瓜灯邮票", deco: "halloween",
      hook: "今晚敲开他的门，会收到糖果，还是别的惊喜？",
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
      if (b.force) { b.force = false; b.since = 0; b.got = true; return "SSR"; }   // 求过情了：下一张一定是他
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
  // 求情：生日池抽到第 20 次还没出他的 SSR，可以去跟他求一次；求了下一张一定出。每个生日一次
  function canBeg(st, key) { const b = st.bday[key]; return !!b && !b.got && !b.begged && b.since >= BDAY.beg; }
  function markBeg(key) { const st = load(), b = st.bday[key]; if (!b) return; b.begged = true; b.force = true; save(st); }
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

  // 盖印升级：一级一级扣印泥，steps 是最多升几级；碰到要先发给他的坎、或者印泥不够就停
  function levelUp(cardId, steps) {
    const st = load(), card = st.cards.find(c => c.id === cardId);
    if (!card) return { n: 0, msg: "找不到这张" };
    const cap = CAP[card.rarity] || 30; let n = 0, msg = "";
    card.lv = card.lv || 1;
    while (n < steps && card.lv < cap) {
      const block = gateBlocked(card, card.lv); if (block) { msg = block; break; }
      const cost = levelCost(card.rarity, card.lv);
      const free = !!(st.opt && st.opt.testInf);   // 测试券开着时印泥也不扣，方便她试剧情和卡面
      if (!free && st.ink < cost) { msg = "印泥不够：下一级要 " + cost; break; }
      if (!free) st.ink -= cost; card.lv++; n++;
    }
    if (n) save(st);
    return { n, msg, lv: card.lv };
  }
  // 卡里哪几段几级开（SSR 的节在剧情里按节标的 lv 开）
  const UNLOCK = { R: { before: 10, after: 20, real: 30 }, SR: { rest: 10, sequel: 20, hidden: 40 } };

  // 剧情按等级解锁：SSR 每十级一节（1 级第一节，40 级结局，50 级隐藏的路）
  function ssrUnlocked(lv) { return { sections: Math.min(4, 1 + Math.floor(lv / 10)), ending: lv >= 40, hidden: lv >= 50 }; }

  g.StampsCore = { PRICE_ONE, PRICE_TEN, RATE, SOFT_FROM, HARD_AT, SR_EVERY, BDAY, CAP, FULL_COST, GIFT, GAIN, LIMITED,
    DUPE_INK, UNLOCK, levelUp, canBeg, markBeg, load, save, gain, grantOnOpen, activeLimited, bdayWindow, rollRarity, pay, levelCost, isGate, gateBlocked, ssrUnlocked };
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
  // 聊天里那枚邮票小卡：齿孔边、卡面（画了的话）、稀有度、卡名、一句台词。开机就要（聊天里会出现），所以放这份
  g.StampShareCard = function ({ m }) {
    const R = g.React, h2 = R && R.createElement; if (!h2) return null;
    const x = (m && m.stamp) || {}, col = x.rarity === "SSR" ? "#B58C55" : x.rarity === "SR" ? "#4a68b8" : "#577767";
    const url = typeof g.useIdbImgUrl === "function" ? g.useIdbImgUrl(x.face || null) : null;
    const fs = n => "calc(" + n + "px * var(--app-fs, 1))";
    return h2("div", { "data-wk": "stampshare", "data-rarity": x.rarity || "", style: { width: 196, alignSelf: "flex-start", height: "fit-content", padding: 6, background: "radial-gradient(circle at 5px 5px, transparent 3.6px, #fbf6ea 4px) -5px -5px / 10px 10px", filter: "drop-shadow(0 4px 10px rgba(40,30,20,.18))" } },
      h2("div", { style: { border: "1px solid " + col, borderRadius: 2, background: "#FFF8E9", overflow: "hidden" } },
        h2("div", { style: { position: "relative", height: 150, background: url ? "#222 center/cover no-repeat url(" + url + ")" : "repeating-linear-gradient(135deg, rgba(122,106,82,.06) 0 2px, transparent 2px 9px), #f3ead6", display: "flex", alignItems: "center", justifyContent: "center" } },
          !url ? h2("div", { style: { fontFamily: "var(--f-display,'Fraunces',serif)", fontSize: fs(18), color: "#5a4a32", letterSpacing: ".1em", padding: "0 10px", textAlign: "center" } }, x.name || "一枚邮票") : null,
          h2("span", { style: { position: "absolute", left: 6, top: 6, padding: "1px 7px", borderRadius: 3, background: col, color: "#FFF8E9", fontSize: fs(10), fontWeight: 700 } }, x.rarity || ""),
          x.canon ? h2("span", { style: { position: "absolute", right: 6, bottom: 6, padding: "2px 8px", border: "1.5px solid #b23a2e", color: "#b23a2e", borderRadius: 3, transform: "rotate(-8deg)", fontSize: fs(11), background: "rgba(255,248,233,.85)" } }, "当真") : null),
        h2("div", { style: { padding: "8px 10px 9px" } },
          h2("div", { style: { fontSize: fs(9.5), letterSpacing: ".2em", color: "#827C6F" } }, "邮票册" + (x.kind === "if" ? " · IF「" + (x.theme || "") + "」" : x.kind === "bday" ? " · 生日" : "")),
          h2("div", { style: { marginTop: 2, fontFamily: "var(--f-display,'Fraunces',serif)", fontSize: fs(15), color: "#39382F" } }, "「" + (x.name || "") + "」"),
          x.line ? h2("div", { style: { marginTop: 4, fontSize: fs(11.5), lineHeight: 1.6, color: "#827C6F", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } }, x.line) : null)));
  };
  // 主屏图标：一枚齿孔边的邮票
  g.GStamps = function (p) {
    const h = g.React && g.React.createElement; if (!h) return null;
    const kids = [h("path", { key: 1, d: "M6 3.5h12v17H6z", strokeDasharray: "1.6 1.4" }), h("rect", { key: 2, x: 8.5, y: 6.5, width: 7, height: 8, rx: 0.6 }), h("path", { key: 3, d: "M8.5 17.5h7" })];
    if (typeof g.Svg === "function") return h(g.Svg, p, kids);
    return h("svg", { width: (p && p.size) || 24, height: (p && p.size) || 24, viewBox: "0 0 24 24", fill: "none", stroke: (p && p.color) || "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }, kids);
  };
})(typeof window !== "undefined" ? window : globalThis);
