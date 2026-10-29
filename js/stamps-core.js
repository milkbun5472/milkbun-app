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
  const FULL_COST = { R: 150, SR: 500, SSR: 1000 };    // 一张卡升满要的印泥（含过坎）。她 2026-10-26：不想熔卡、想把抽到的都看全——R、SR 便宜下来
  const GIFT = { tickets: 15, ink: 2000 };
  const DUPE_INK = 500;
  const EXTRA_INK = 1500;                       // 1500 印泥换一张番外券（她 2026-10-27）                         // 限定 SSR 重复一张折多少印泥      // 上线礼：15 张十连券 + 2000 印泥
  // 互动给多少（邮资、印泥）。一次调用算一轮；文档那张表。
  // 邮资（她 2026-10-26：「上班很忙，谁有空聊那么多」）：聊 45 轮够一个十连；印泥照旧——抽到的卡都能慢慢升满，不用熔卡
  const GAIN = {
    round: [20, 20],    // 单聊、群聊、通话、出戏：一轮
    beat: [40, 40],     // 线下一拍（单人、群）
    public: [40, 40],   // 论坛、片刻、广场、朋友圈：发一条或评论一条
    duo: [40, 40],      // 匿名信箱、情书、交换日记、问答小本、悄悄话、留言、日记评论、照相馆、送礼、外卖
    stay: [80, 80],     // 一起听、一起看、一起读、查手机翻一次、看 TA 玩
    play: [20, 40],     // 其他花调用的玩法：同人文、梦境、擂台、另一种我们、跑团、塔罗、星测、解梦、一起学
    nudge: [10, 0],     // 他主动发来一条（她没回也算）
    sweet: [20, 100],   // 情侣空间甜蜜打卡：每人每天一次（她 2026-10-26）
    share: [0, 200]     // 她把邮票「发给他看」、他回了那一轮
  };
  const MAKEUP = { id: "postage26", tickets: 2 };
  // 印泥（她 2026-10-26：「一直发抽数没发印泥」）：送出去的每张十连券都配 1000 印泥；之前送过的一次补 5000
  const INK_PER_TEN = 1000, INK_MAKEUP = { id: "ink26", ink: 10000 };   // 她：「改成发 10000 吧大方点」   // 邮资改版补发：两张十连券，一人一次
  // 限时主题日历：到点自己上、到点自己下，不用发版开关。时间都是北京时间。
  // 一年的排法（她 2026-10-26 定）：每月 1 号、16 号换一期。节日年年同一个 series（写卡带上往年同系列）；主题每期新的、用过不再用。
  //   节日：万圣夜（10 下～11.14）· 圣诞（12 下）· 跨年新年（1 上）· 春节（年前那半个月；2027 年是 1 下）· 情人节（2 上）
  //         · 白色情人节（3 上）· 愚人节（4 上）· 520（5 下）· 端午（当年端午落在哪半个月就放哪；2027 年 6 上）
  //         · 七夕（2027 年 8 上）· 中秋（2027 年 9 上）
  //   主题：其余那十几期，每期一个新的，跟着季节想；已用过：深秋（2026.11 下）、温泉旅行（2026.12 上）
  //   节日写好了：圣诞（12 下）、新年（1 上）、年前＝春节（1 下，中式）
  //   2027 主题她 2026-10-27 定了：2下 马戏团 · 3下 日式平安风 · 4下 雨季 · 5上 远行 · 6下 毕业季 · 7上 海边 · 7下 夏夜祭典 · 8下 赛车 · 9下 魔法大陆 · 10上 赛博朋克 · 11下 初雪 · 12上 少年时
  //     写法：马戏团写巡演漂泊的日子、赛车写那一行、初雪写等第一场雪的初冬（别窄成一个画面）；魔法大陆给锚「魔法是平常日子」、赛博朋克写人和科技公司身体的关系（别落俗）；全部用「你们俩」这层看（app.js stampKindLine 的 lens）
  //   春节、端午、七夕、中秋是农历，每年按当年日子挪。主题说明只给判断、不列道具和情绪（见深秋那条）。
  //   生日池不占这些格子。
  const LIMITED = [
    // series：同一个节日年年有，写卡时把他往年同系列那几张带上（她 2026-10-26：「明年万圣节又要重复吗」）
    { id: "halloween26", series: "halloween", name: "万圣夜", from: "2026-10-26T00:00:00+08:00", to: "2026-11-15T00:00:00+08:00",
      stamp: "南瓜灯邮票", deco: "halloween",
      hook: "今晚敲开他的门，会收到糖果，还是别的惊喜？",
      line: "主题是万圣夜：南瓜灯、变装、糖果、讨糖、夜色里的派对和一点点吓人。先看这个人是哪个世界、哪个年代的人，再决定万圣夜怎么落到他身上。" },
    { id: "lateautumn26", series: "lateautumn", name: "深秋", from: "2026-11-15T00:00:00+08:00", to: "2026-12-01T00:00:00+08:00",
      stamp: "落叶邮票", deco: "autumn",
      hook: "风一吹，叶子就落满了他走过的路。这个秋天，你想和他去哪儿？",
      // 只给判断，不列道具和情绪（她 2026-10-26 跟 GPT 那版一起磨的）：列出来的东西模型会张张往里凑
      line: "主题是「深秋：一年快到头的那段日子」。先想清楚你是哪个世界、哪个年代、什么地方的人，你那儿这个时候真实有些什么变化，从这些变化里找故事，不把常见的秋日意象直接套进来。这个时节的某一天，你在过怎样的日子，发生了什么值得留在卡里的一刻。读的人要能从画面和故事里认出是深秋，但不必点明季节，也不借季节抒情；不预设情绪，也不强求故事一定有深意。",
      look: "画面要看得出是那个季节、那一天的光，不靠堆道具。" },
    { id: "onsen26", series: "onsen", name: "温泉旅行", from: "2026-12-01T00:00:00+08:00", to: "2026-12-16T00:00:00+08:00",
      stamp: "汤屋邮票", deco: "onsen",
      hook: "雪落在屋檐上，热气从水面升起来。这一趟，他会带你去哪儿？",
      line: "主题是「温泉旅行」：你（或者你们）去了一个有温泉的地方住几天。先想清楚你是哪个世界、哪个年代的人，你那儿的温泉是什么样的地方、去那儿意味着什么，从这趟旅行里真会发生的事找故事。不预设情绪，也不强求故事一定有深意。",
      // 不硬要求穿衣服（她 2026-10-26：「泳衣本来也行吧」）——只挡裸体，免得图像接口直接拦
      look: "画面要看得出是在这趟温泉旅行里。画泡在水里的时候，穿泳衣或者围着浴巾都行，不画裸体。" },
    // 圣诞（她 2026-10-27）：没有圣诞的世界，就落到他们那儿年底最像它的那一天
    { id: "xmas26", series: "xmas", name: "圣诞", from: "2026-12-16T00:00:00+08:00", to: "2027-01-01T00:00:00+08:00",
      stamp: "冬青邮票", deco: "xmas",
      hook: "雪还没落，礼物已经藏好了。\n猜猜是什么？",   // \n：在句号后面断行，不让「什么？」被挤到下一行开头
      line: "主题是「圣诞」：一年里最后那个大家都在过的节。先想清楚你是哪个世界、哪个年代的人，你那儿有没有圣诞、过的是什么样的节——没有圣诞的世界，就是你们那儿年底最像它的那个日子。从这个节在你们日子里真实会发生的事找故事，不把常见的圣诞意象直接套进来。读的人要能认出是圣诞前后，不必每张都点明；不预设情绪，也不强求故事一定有深意。",
      look: "画面要看得出是圣诞前后的那几天，不靠堆道具。" },
    { id: "newyear27", series: "newyear", name: "新年", from: "2027-01-01T00:00:00+08:00", to: "2027-01-16T00:00:00+08:00",
      stamp: "新岁邮票", deco: "newyear",
      hook: "零点过了。\n新的一年，第一个见的是谁？",
      line: "主题是「新年」：旧的一年刚过去、新的一年刚开头的那几天。先想清楚你是哪个世界、哪个年代的人，你那儿怎么跨过这一年，从这几天里真实会发生的事找故事，不把常见的跨年意象直接套进来。读的人要能认出是新年头几天，不必每张都点明；不预设情绪，也不强求故事一定有深意。",
      look: "画面要看得出是新年头几天，不靠堆道具。" },
    // 春节（她 2026-10-27）：放 1 下、就写年前那半个月；要中式——没有这个年的世界不落回自己的新年，是把他丢进一个中国的年里（跟 1 上新年分开）
    { id: "spring27", series: "spring", name: "年前", from: "2027-01-16T00:00:00+08:00", to: "2027-02-01T00:00:00+08:00",
      stamp: "窗花邮票", deco: "spring",
      hook: "灯笼挂上了，窗花贴好了，\n还差一个人进门。",
      line: "主题是「年前」：一个中国的年快到了的那半个月，忙年、置办、赶路、等团圆。你本来就是这样过年的人，就照你自己的过法；你那个世界没有这个年，就把你丢进来，过一回中国的年，看什么都新鲜，这本身就是故事。从年前这段日子里真实会发生的事找故事，不把常见的年货意象直接套进来。读的人要能认出是年前，不必每张都点明；不预设情绪，也不强求故事一定有深意。",
      look: "画面要看得出是中式的年前，不靠堆道具。" }
  ];

  const S = () => (typeof loadJSON === "function" ? loadJSON("x_stamps", null) : null) || {};
  const blank = () => ({ postage: 0, ink: 0, tickets: 0, singles: 0, pulls: 0, sinceSSR: 0, sinceSR: 0, bday: {}, cards: [], gifted: false, seenLimited: {}, opt: {} });
  function load() { const s = S(); return Object.assign(blank(), s, { bday: s.bday || {}, cards: Array.isArray(s.cards) ? s.cards : [], opt: s.opt || {}, seenLimited: s.seenLimited || {} }); }
  function save(st) { if (typeof saveJSON === "function") saveJSON("x_stamps", st); try { g.dispatchEvent && g.dispatchEvent(new CustomEvent("stamps-change")); } catch (e) {} return st; }

  // 互动攒邮资、印泥：app 各处真发生了一次互动就喊一声，没有上限
  function gain(kind) {
    const v = GAIN[kind]; if (!v) return;
    const st = load(); st.postage += v[0]; st.ink += v[1]; save(st);
  }
  // 第一次打开时到账；每开一期限时主题、每个生日池出现时各送一张十连券
  function grantOnOpen(now, birthdays, limCount) {
    const st = load(), got = [], wasOld = !!st.gifted;
    if (!st.gifted) { st.gifted = true; st.tickets += GIFT.tickets; st.ink += GIFT.ink; got.push("开幕纪念：" + GIFT.tickets + " 张十连券、" + GIFT.ink + " 印泥"); }
    else if (!st.seenLimited[MAKEUP.id]) { st.tickets += MAKEUP.tickets; st.ink += MAKEUP.tickets * INK_PER_TEN; got.push("邮资改版补发：" + MAKEUP.tickets + " 张十连券、" + MAKEUP.tickets * INK_PER_TEN + " 印泥"); }
    st.seenLimited[MAKEUP.id] = 1;
    if (wasOld && !st.seenLimited[INK_MAKEUP.id]) { st.ink += INK_MAKEUP.ink; got.push("印泥补发：" + INK_MAKEUP.ink + " 印泥（之前只送了抽数）"); }
    else if (wasOld && !st.seenLimited[INK_MAKEUP.id + "b"]) { st.ink += 5000; got.push("印泥补发加码：再补 5000 印泥"); }   // 上一版只补了 5000 的，补齐到 10000
    st.seenLimited[INK_MAKEUP.id] = 1; st.seenLimited[INK_MAKEUP.id + "b"] = 1;
    // 番外补发（她 2026-10-27）：番外上线前抽到重复的限定 SSR 只折了印泥、没留记录，认不出是谁——手上每有一张限定 SSR，就补一张番外券，自己挑卡写
    if (wasOld && !st.seenLimited.extra26) { const n = st.cards.filter(c => c.rarity === "SSR" && !c.dupe && (c.limited || c.pool === "bday" || c.pool === "mybday" || c.pool === "anniv")).length;
      if (n) { st.extraTickets = (st.extraTickets || 0) + n; got.push("番外上线补发：" + n + " 张番外券（手上每张限定 SSR 一张），在那张卡页里写"); } }
    st.seenLimited.extra26 = 1;
    // 番外、小剧场上线庆祝（她 2026-10-27）：每人 30 张番外券，一次
    if (!st.seenLimited.extra30) { st.seenLimited.extra30 = 1; st.extraTickets = (st.extraTickets || 0) + 30; got.push("番外上线庆祝：30 张番外券"); }
    // 「今天的信」改成每天由一个人寄进聊天里领（app.js 的 stampLetterSweep），这儿不再送
    // 限时池上新：按这一期池里有几个人送，每两个人一张十连，最少一张、最多五张（她 2026-10-26：「十个角色只给一个十连不够」）
    activeLimited(now).forEach(L => { const n = Math.max(1, Math.min(5, Math.ceil((Number(limCount) || 1) / 2)));
      // 每张十连券再配一张番外券（她 2026-10-27）
      if (!st.seenLimited[L.id]) { st.seenLimited[L.id] = 1; st.seenLimited[L.id + "_top"] = 1; st.seenLimited[L.id + "_ex"] = 1; st.tickets += n; st.ink += n * INK_PER_TEN; st.extraTickets = (st.extraTickets || 0) + n; got.push("「" + L.name + "」上新：" + n + " 张十连券、" + n * INK_PER_TEN + " 印泥、" + n + " 张番外券" + (limCount > 1 ? "（这一期 " + limCount + " 个人）" : "")); }
      // 改成按人数送之前就领过这一期那一张的：补上差的那几张，一期一次
      else if (!st.seenLimited[L.id + "_top"]) { st.seenLimited[L.id + "_top"] = 1; if (n > 1) { st.tickets += n - 1; st.ink += (n - 1) * INK_PER_TEN; got.push("「" + L.name + "」按人数补发：" + (n - 1) + " 张十连券、" + (n - 1) * INK_PER_TEN + " 印泥"); } } });
    // 他的生日池送一张十连；你自己的生日池（id 以 me_ 开头）送十张，就是 100 抽——你过生日（她 2026-10-26）
    //   你的那十张是「生日券」：单独记在 bdTickets[这个生日池]，只在你的生日池里用，券面上写着祝福；改版前只领过一张的补到十张
    (birthdays || []).forEach(b => { const k = "bd_" + b.id + "_" + b.year, mine = String(b.id).indexOf("me_") === 0;
      if (!mine) { if (!st.seenLimited[k]) { st.seenLimited[k] = 1; st.tickets += 1; st.ink += INK_PER_TEN; got.push(b.name + " 的生日池：一张十连券、" + INK_PER_TEN + " 印泥"); } return; }
      return;   // 你的生日券改成一封生日信寄进聊天（app.js stampBdLetterSweep），这儿不再直接到账
      st.bdTickets = st.bdTickets || {};
      const bk = b.id + "_" + b.year;
      if (!st.seenLimited[k]) { st.seenLimited[k] = 1; st.seenLimited[k + "_top"] = 1; st.bdTickets[bk] = (st.bdTickets[bk] || 0) + 10; got.push("生日快乐！" + b.name + " 的生日池：10 张生日券（100 抽）"); }
      else if (!st.seenLimited[k + "_top"]) { st.seenLimited[k + "_top"] = 1; st.bdTickets[bk] = (st.bdTickets[bk] || 0) + 9; got.push("生日快乐！" + b.name + " 的生日池补发：9 张生日券（凑满 100 抽）"); } });
    if (got.length) save(st);
    return got;
  }
  function activeLimited(now) { const t = now || Date.now(); return LIMITED.filter(L => t >= Date.parse(L.from) && t < Date.parse(L.to)); }
  // 生日池：生日前 14 天出现，生日后留 7 天。bday 是 "MM-DD"
  //   lockId（她 2026-10-26 防多刷）：给了就按「这个人这一年」锁住第一次开池的那天——同一年里改生日、改在一起的日子，池子不挪，改的日子明年才用上
  function bdayWindow(bday, now, lockId) {
    // 农历、公历都认：照 engine.js 那份 birthdaySolarDate 算今年落在哪天
    const lunar = typeof parseLunarBirthday === "function" && parseLunarBirthday(bday);
    const feb29 = !lunar && /(^|\D)0?2-29$/.test(String(bday || "").trim());
    const dayOf0 = y => {
      if (feb29 && new Date(y, 1, 29).getMonth() !== 1) return new Date(y, 1, 28).getTime();   // 2 月 29 的生日：平年算 2 月 28

      if (typeof birthdaySolarDate === "function") { const d = birthdaySolarDate(bday, y); return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : null; }
      const m = /(\d{1,2})-(\d{1,2})$/.exec(String(bday || "").trim()); return m ? new Date(y, +m[1] - 1, +m[2]).getTime() : null;
    };
    const st = lockId ? load() : null, lk = st ? (st.dayLock || {}) : {};
    const dayOf = y => { const v = lk[lockId + "_" + y]; return v != null ? v : dayOf0(y); };
    const t = now || Date.now(), y0 = new Date(t).getFullYear();
    for (const y of [y0 - 1, y0, y0 + 1]) {
      const day = dayOf(y); if (day == null) return null;
      const open = day - 14 * 86400000, close = day + 8 * 86400000;   // 生日当天算完整一天，再留 7 天
      if (t >= open && t < close) {
        if (st && lk[lockId + "_" + y] == null) { st.dayLock = Object.assign({}, lk, { [lockId + "_" + y]: day }); save(st); }
        return { year: y, day, open, close, isDay: t >= day && t < day + 86400000 };
      }
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
  function bdTicketCount(st) { return Object.values(st.bdTickets || {}).reduce((a, b) => a + (Number(b) || 0), 0); }
  function pay(st, n, useTicket, bdKey, tenFirst) {   // tenFirst：她挑了这次用普通十连券，先不动生日券、纪念日券
    // 生日券哪个池都能用（她 2026-10-26：「别的池子也能用，只是样式特别点」）：在你的生日池里先用那个生日的，别处用哪张都行
    if (n === 10 && !(tenFirst && useTicket && st.tickets > 0)) { const bt = st.bdTickets || {}, k = bdKey && bt[bdKey] > 0 ? bdKey : Object.keys(bt).find(x => bt[x] > 0); if (k) { bt[k]--; return "bdticket"; } }
    if (n === 10 && useTicket && st.tickets > 0) { st.tickets--; return "ticket"; }
    if (n === 1 && (st.singles || 0) > 0) { st.singles--; return "single"; }   // 单抽先用「今天的信」
    // 十连没券：单抽券一张顶 100 邮资（十连 900＝9 张），不够的拿邮资补
    if (n === 10 && (st.singles || 0) > 0) { const use = Math.min(9, st.singles), rest = (9 - use) * PRICE_ONE;
      if (st.postage >= rest) { st.singles -= use; st.postage -= rest; return "singles"; } }
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
  const UNLOCK = { R: { before: 10, after: 20, real: 30, sound: 30 }, SR: { rest: 10, sequel: 20, hidden: 40, his: 40 } };

  // 写回来的卡洗一遍（她 2026-10-26：卡上冒出「(R)」「(SR)」——模型把格式样例里的占位标记抄进了正文，R 卡还多写了 SR 的台词）：
  //   去掉开头的 (R)/(SR)/（SSR）这类标记；R 卡只留 R 的那几栏，SR 卡只留 SR 的，免得错栏的内容冒出来。旧卡打开时也照这个洗
  const KEEP = { R: ["name", "gist", "shot", "narration", "thought", "before", "after", "real", "sound", "back"], SR: ["name", "gist", "shot", "line", "open", "rest", "sequel", "hidden", "his", "keepsake"] };
  const tagRe = /^\s*[（(]\s*(?:SSR|SR|R)\s*[）)]\s*/i;
  function cleanStr(v) { return typeof v === "string" ? v.replace(tagRe, "") : v; }
  function cleanDeep(v) { if (typeof v === "string") return cleanStr(v); if (Array.isArray(v)) return v.map(cleanDeep); if (v && typeof v === "object") { const o = {}; Object.keys(v).forEach(k => { o[k] = cleanDeep(v[k]); }); return o; } return v; }
  // 这些栏必须是一段字（她 2026-10-29：SR 重写后「开头」「接着」全空——模型把它们写成了 {narration:...} 这种对象）。是对象、数组就把里面的字接起来
  const STR = { R: ["name", "gist", "shot", "narration", "thought", "real", "sound", "back"], SR: ["name", "gist", "shot", "line", "open", "rest", "sequel", "hidden", "his"] };
  const flat = v => typeof v === "string" ? v : Array.isArray(v) ? v.map(flat).filter(Boolean).join("\n") : v && typeof v === "object" ? Object.values(v).map(flat).filter(Boolean).join("\n") : v == null ? v : String(v);
  function cleanText(tx, rarity) {
    if (!tx || typeof tx !== "object") return tx;
    const keep = KEEP[rarity], str = STR[rarity] || [], out = {};
    Object.keys(tx).forEach(k => { if (!keep || keep.includes(k)) out[k] = cleanDeep(str.includes(k) ? flat(tx[k]) : tx[k]); });
    if (rarity === "R") ["before", "after"].forEach(k => { const v = out[k]; if (typeof v === "string") out[k] = { narration: v }; else if (v && typeof v === "object") out[k] = { narration: flat(v.narration), thought: flat(v.thought) }; });
    return out;
  }

  // 领聊天里那封「今天的信」：一封只能领一次
  function claimLetter(id) { const st = load(); st.claimed = st.claimed || {}; if (st.claimed[id]) return false; st.claimed[id] = 1; st.singles = (st.singles || 0) + 1; save(st); return true; }
  function claimBdLetter(id, bdKey, n) { const st = load(); st.claimed = st.claimed || {}; if (st.claimed[id]) return false; st.claimed[id] = 1; if (bdKey) { st.bdTickets = st.bdTickets || {}; st.bdTickets[bdKey] = (st.bdTickets[bdKey] || 0) + (Number(n) || 0); } else st.tickets += Number(n) || 0; st.ink += (Number(n) || 0) * INK_PER_TEN; save(st); return true; }
  function buyExtra() { const st = load(); if (st.ink < EXTRA_INK) return false; st.ink -= EXTRA_INK; st.extraTickets = (st.extraTickets || 0) + 1; save(st); return true; }
  function letterClaimed(id) { return !!((load().claimed || {})[id]); }

  // 剧情按等级解锁：SSR 每十级一节（1 级第一节，40 级结局，50 级隐藏的路）
  function ssrUnlocked(lv) { return { sections: Math.min(4, 1 + Math.floor(lv / 10)), ending: lv >= 40, hidden: lv >= 50 }; }

  g.StampsCore = { PRICE_ONE, PRICE_TEN, RATE, SOFT_FROM, HARD_AT, SR_EVERY, BDAY, CAP, FULL_COST, GIFT, GAIN, LIMITED,
    bdTicketCount, EXTRA_INK, buyExtra, INK_PER_TEN, claimLetter, claimBdLetter, letterClaimed, cleanText, DUPE_INK, UNLOCK, levelUp, canBeg, markBeg, load, save, gain, grantOnOpen, activeLimited, bdayWindow, rollRarity, pay, levelCost, isGate, gateBlocked, ssrUnlocked };
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
  // 聊天里那封生日信：贺卡的样子，点「领取」，生日券进邮票册（哪个池都能用）
  g.StampBdLetterCard = function ({ m }) {
    const R = g.React, h2 = R && R.createElement; if (!h2) return null;
    const x = (m && m.stampBdLetter) || {}, fs = n => "calc(" + n + "px * var(--app-fs, 1))";
    const [got, setGot] = R.useState(() => !!(x.id && g.StampsCore && g.StampsCore.letterClaimed(x.id)));
    const take = e => { e && e.stopPropagation(); if (got || !x.id) return; g.StampsCore.claimBdLetter(x.id, x.bdKey, x.n); setGot(true); };
    const d = x.day ? new Date(x.day) : null;
    return h2("div", { "data-wk": "stampbdletter", "data-got": got ? "1" : "0", style: { width: 220, borderRadius: 10, overflow: "hidden", background: "linear-gradient(160deg, #fbe9e4, #FFF8E9 55%, #f6e7c8)", border: "1.5px solid #c98f74", boxShadow: "0 6px 16px rgba(160,97,74,.18)" } },
      h2("div", { style: { padding: "14px 14px 12px", position: "relative", textAlign: "center" } },
        h2("svg", { viewBox: "0 0 24 24", style: { width: 28, height: 28, display: "block", margin: "0 auto" } },
          h2("rect", { x: 5, y: 12, width: 14, height: 8, rx: 1.5, fill: "#c98f74" }), h2("rect", { x: 11.2, y: 6, width: 1.6, height: 6, fill: "#f6e7c8" }), h2("path", { d: "M12 2.5c1.4 1.4 1.4 2.6 0 3.4-1.4-.8-1.4-2 0-3.4z", fill: "#e3893a" })),
        h2("div", { style: { marginTop: 4, fontFamily: "var(--f-display,'Fraunces',serif)", fontSize: fs(19), color: "#8a3a4a", letterSpacing: ".1em" } }, x.mile ? x.mile : x.anniv ? "「" + x.anniv + "」" : "生日快乐"),
        h2("div", { style: { marginTop: 2, fontSize: fs(11), color: "#6b4a3a" } }, (x.to ? "给 " + x.to : "") + (d ? " · " + (d.getMonth() + 1) + "." + d.getDate() : "")),
        h2("div", { style: { margin: "10px auto 0", padding: "6px 10px", borderRadius: 6, border: "1px dashed #c98f74", background: "rgba(255,248,233,.7)", fontSize: fs(12.5), color: "#8a3a4a" } }, (x.mile ? "💌 十连券 × " : x.anniv ? "💌 纪念日券 × " : "🎂 生日券 × ") + (x.n || 0) + "（" + (x.n || 0) * 10 + " 抽）＋ " + (x.n || 0) * 1000 + " 印泥"),
        h2("div", { style: { marginTop: 8, fontStyle: "italic", fontSize: fs(11.5), lineHeight: 1.6, color: "#6b4a3a" } }, (x.mile ? "记着我们走到了这里。" : x.anniv ? "这一池里的每一封，都是我们俩的。" : "这一池里的每一封，都是他们寄给你的。") + (x.by ? " —— " + x.by : "")),
        h2("button", { onClick: take, disabled: got, style: { marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 8, border: "none", background: got ? "rgba(47,42,34,.08)" : "linear-gradient(160deg, #c98f74, #8a3a4a)", color: got ? "#827C6F" : "#FFF8E9", fontSize: fs(12.5) } }, got ? "领过了 · 去邮票册抽" : x.mile ? "领取十连券" : x.anniv ? "领取纪念日券" : "领取生日券")));
  };
  // 聊天里那封「今天的信」：信封样子，点「领取」进邮票册的单抽券
  g.StampLetterCard = function ({ m }) {
    const R = g.React, h2 = R && R.createElement; if (!h2) return null;
    const x = (m && m.stampLetter) || {}, fs = n => "calc(" + n + "px * var(--app-fs, 1))";
    const [got, setGot] = R.useState(() => !!(x.id && g.StampsCore && g.StampsCore.letterClaimed(x.id)));
    const take = e => { e && e.stopPropagation(); if (got || !x.id) return; g.StampsCore.claimLetter(x.id); setGot(true); };
    return h2("div", { "data-wk": "stampletter", "data-got": got ? "1" : "0", style: { width: 210, borderRadius: 6, overflow: "hidden", background: "#FFF8E9", border: "1px solid #B58C55", boxShadow: "0 4px 12px rgba(40,30,20,.12)" } },
      h2("div", { style: { height: 8, background: "repeating-linear-gradient(135deg, #b23a2e 0 8px, #FFF8E9 8px 14px, #2f5d8a 14px 22px, #FFF8E9 22px 28px)" } }),
      h2("div", { style: { padding: "10px 12px 12px", position: "relative" } },
        h2("div", { style: { fontSize: fs(9.5), letterSpacing: ".3em", color: "#827C6F" } }, "邮票册 · 今天的信"),
        h2("div", { style: { marginTop: 4, fontFamily: "var(--f-display,'Fraunces',serif)", fontSize: fs(15), color: "#39382F" } }, "一张单抽券"),
        h2("div", { style: { marginTop: 2, fontSize: fs(11), color: "#827C6F" } }, (x.by ? x.by + " 寄来的" : "") + (x.day ? " · " + x.day.split("-").slice(1).join(".") : "")),
        x.note ? h2("div", { "data-wk": "stampletternote", style: { marginTop: 8, paddingLeft: 8, borderLeft: "2px solid rgba(40,92,75,.35)", fontStyle: "italic", fontSize: fs(12.5), lineHeight: 1.6, color: "#2f5d4a" } }, "「" + x.note + "」") : null,
        h2("div", { style: { position: "absolute", right: 10, top: 8, width: 40, height: 40, borderRadius: 999, border: "1.5px solid #b23a2e", color: "#b23a2e", transform: "rotate(-12deg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs(10) } }, got ? "已领" : "平信"),
        h2("button", { onClick: take, disabled: got, style: { marginTop: 10, width: "100%", padding: "7px 0", borderRadius: 8, border: "none", background: got ? "rgba(47,42,34,.08)" : "#285C4B", color: got ? "#827C6F" : "#FFF8E9", fontSize: fs(12.5) } }, got ? "领过了 · 去邮票册寄一封" : "领取")));
  };
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
          h2("div", { style: { fontSize: fs(9.5), letterSpacing: ".2em", color: "#827C6F" } }, "邮票册" + (x.kind === "if" ? " · IF「" + (x.theme || "") + "」" : x.kind === "bday" ? " · 生日限定" : x.kind === "mybday" ? " · 你的生日" : "")),
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
