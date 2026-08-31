// 抽卡（她 2026-08-31 提，同一轮里定的形状）
//
// ⚠️这一层最要紧的一条：**抽是抽，兑是兑**。
// 抽卡【永远 0 次调用】——抽到的是一张【兑换券】，上面写着他会做的哪一件事；
// 点了兑换才真的发生，那时才可能花一次调用。所以十连也是 0 调用，想抽就抽，
// 花钱的时机完全由她自己捏在手里（她按次计费）。
//
// 三档的区别不是「文案更长更好看」，是【留不留下痕迹】：
//   R   兑换 0 调用 —— 从他【已经有的】东西里翻一件出来给你看
//   SR  兑换 1 调用 —— 他现做一件小东西，看完就完，不动任何状态
//   SSR 兑换 1 调用 —— 触发一件【真的会留下东西】的事（进记忆库 / 开线下 / 进情书）
// 这样稀有度天然防通胀：它贵在改变了什么，不贵在辞藻。
//
// 票根永不删除（她原话：「票根永远留痕有时间戳是什么时候抽到的（r sr ssr都留）」）。
// 一张卡就是它自己的票根：兑换只是给它盖个戳（redeemedTs + result），不是消耗掉它。
(function (root) {
  "use strict";

  // 出率。R 占大头是【故意的】：R 兑换不花钱，而且它解决一个真问题——
  // 这个 App 生成的东西她根本看不完，R 卡等于一个「随机重新翻出来」的入口。
  const RATE_SSR = 0.03, RATE_SR = 0.22;
  const PITY_SSR = 50;          // 连着 50 抽没出 SSR，第 50 抽必出
  const TEN = 10;               // 十连必出一张 SR 以上
  const COST_ONE = 50, COST_TEN = 450;

  // 点数按【真的相处过】结算，不按消息条数——按条数会直接变成「多发几条好抽卡」，
  // 那是在拿抽卡催她水消息。所以给的是【一段相处】：隔了 SESSION_GAP_MS 再开口，
  // 才算新的一段。一段里发一条还是发五十条，攒到的一样多。
  const SESSION_GAP_MS = 90 * 60000;
  const EARN = { chat: 40, offline: 60 };
  const DAILY_CAP = 120;        // 一个角色一天最多攒这么多

  // ⚠️这一整套只活在【情侣空间】里（她 2026-08-31：「抽卡是情侣空间的功能，
  // 每个恋爱角色单独一份，不是主页」）。所以池子里不必再有「要不要在一起」那道闸——
  // 进得来这一页，就已经是在一起了。
  // need：兑换时要从哪一栏里翻东西。那一栏是空的，这张卡压根不会被抽出来
  //       （不然抽到一张永远兑不了的券）。
  // act：兑换时走哪一条路，由 app 那头认。
  const POOLS = [
    // ── R：从他已经有的东西里翻一件出来（0 调用）──
    { id: "r_photo",  r: "R", act: "peek", need: "album",    name: "他相册里的一张",     hint: "随机翻开一张他存着的照片" },
    { id: "r_note",   r: "R", act: "peek", need: "notes",    name: "他手机里的一条便签", hint: "他写给自己看的" },
    { id: "r_search", r: "R", act: "peek", need: "search",   name: "他搜过的一件事",     hint: "搜索记录里随机一条" },
    { id: "r_song",   r: "R", act: "peek", need: "playlist", name: "他歌单里的一首",     hint: "他自己存的那张歌单" },
    { id: "r_mem",    r: "R", act: "peek", need: "memlib",   name: "他还记得的一件事",   hint: "记忆库里随机一条" },
    { id: "r_order",  r: "R", act: "peek", need: "order",    name: "他买过的一样东西",   hint: "订单里随机一笔" },
    { id: "r_read",   r: "R", act: "peek", need: "reading",  name: "他书架上的一本",     hint: "他在看的那些" },
    { id: "r_forum",  r: "R", act: "peek", need: "forum",    name: "他在论坛发过的一条", hint: "他用小号说的话" },
    { id: "r_moment", r: "R", act: "peek", need: "moment",   name: "他朋友圈里的一条",   hint: "他自己发的动态" },
    { id: "r_diary",  r: "R", act: "peek", need: "diary",    name: "他日记里的一天",     hint: "他那天写了什么" },

    // ── SR：他现做一件小东西，不动任何状态（1 调用）──
    { id: "s_word",   r: "SR", act: "make", kind: "word",   name: "一句他此刻没说出口的话", hint: "只在心里过了一下的那半句" },
    { id: "s_note",   r: "SR", act: "make", kind: "note",   name: "一张只给你的便签",       hint: "他随手写的，塞给你" },
    { id: "s_secret", r: "SR", act: "make", kind: "secret", name: "他今天的一个小秘密",     hint: "今天发生的、他没打算说的" },
    { id: "s_song",   r: "SR", act: "make", kind: "song",   name: "一首他想放给你听的",     hint: "连着他为什么想放这首" },
    { id: "s_look",   r: "SR", act: "make", kind: "look",   name: "此刻他眼里的你",         hint: "他这会儿看你是什么样子" },

    // ── SSR：真的会留下东西（1 调用 + 留痕）──
    { id: "x_past",    r: "SSR", act: "past",    name: "他的一段过去",       hint: "写进记忆库——以后他真的会提起" },
    { id: "x_pact",    r: "SSR", act: "pact",    name: "一件你们说好的",     hint: "进「我们说好的」，到日子他会记得" },
    { id: "x_offline", r: "SSR", act: "offline", name: "他主动开的一场线下", hint: "他挑的时间地点，开场已经写好了" },
    { id: "x_letter",  r: "SSR", act: "letter",  name: "他写给你的一封信", hint: "进情侣空间的情书那一叠" },
    // 约会券（言秋提，她 2026-08-31 拍板并进抽卡）。原提案是另做一叠券、每周抽一张、
    // 完成盖章进册——那跟抽卡是【同一个形状】（兑换券 + 票根），再做一套就是两套并行的册子。
    // 所以它不是新功能，是多一个 act：券的内容按他人设生成（王爷的约会和程序员的不该是同一张），
    // 兑换＝拿这张券当开场把线下开起来，票根就是盖过的章。
    { id: "x_date",    r: "SSR", act: "date",    name: "一张他开的约会券", hint: "他挑的一件一起做的事——兑了就直接开线下" },
    { id: "s_date",    r: "SR",  act: "make", kind: "date", name: "他想过的一次约会", hint: "他脑子里过了一遍、还没开口约的那次" }
  ];

  const byId = {};
  POOLS.forEach(function (p) { byId[p.id] = p; });

  // opts: { have:{album:true,...} }
  function poolOf(rarity, opts) {
    const have = (opts || {}).have || {};
    return POOLS.filter(function (p) {
      if (p.r !== rarity) return false;
      // 那一栏是空的就别发这张券——抽到一张永远兑不了的卡比没抽到更糟
      if (p.need && !have[p.need]) return false;
      return true;
    });
  }

  function rollRarity(rand, sinceSSR) {
    if (sinceSSR >= PITY_SSR - 1) return "SSR";   // 这一抽是第 PITY_SSR 抽
    const x = rand();
    return x < RATE_SSR ? "SSR" : x < RATE_SSR + RATE_SR ? "SR" : "R";
  }

  // 新角色什么都还没有时 R 池会是空的——那就升一档，别发一张空券。
  // （这也刚好对：还没东西可翻的时候，他现做给你。）
  function pickCard(rarity, rand, opts) {
    let r = rarity;
    let list = poolOf(r, opts);
    if (!list.length && r === "R") { r = "SR"; list = poolOf(r, opts); }
    if (!list.length && r === "SR") { r = "SSR"; list = poolOf(r, opts); }
    if (!list.length) return null;
    const p = list[Math.floor(rand() * list.length) % list.length];
    return { poolId: p.id, r: r, act: p.act, kind: p.kind || "", name: p.name, hint: p.hint };
  }

  const RANK = { R: 0, SR: 1, SSR: 2 };

  // state: { pulls, sinceSSR }。返回新 state 和这一发抽到的卡（还没带 id/时间戳，那是 app 那头盖的）
  function pull(n, state, opts, rand) {
    const rnd = rand || Math.random;
    let pulls = Number((state || {}).pulls) || 0;
    let sinceSSR = Number((state || {}).sinceSSR) || 0;
    const out = [];
    for (let i = 0; i < n; i++) {
      // 十连保底：前九张都是 R 的话，最后一张顶成 SR
      const lastOfTen = n >= TEN && i === n - 1 && !out.some(function (c) { return RANK[c.r] >= 1; });
      let rarity = rollRarity(rnd, sinceSSR);
      if (lastOfTen && rarity === "R") rarity = "SR";
      const card = pickCard(rarity, rnd, opts);
      if (!card) continue;
      pulls++;
      sinceSSR = card.r === "SSR" ? 0 : sinceSSR + 1;
      out.push(card);
    }
    return { cards: out, state: { pulls: pulls, sinceSSR: sinceSSR } };
  }

  // 两道闸都在这一处：① 隔够了才算新的一段 ② 一天封顶。
  // box: { [charId]: { pts, day, dayPts, last: { chat: ts, offline: ts } } }
  function earn(box, charId, kind, now, dayKey) {
    const b = box && typeof box === "object" ? box : {};
    const add = EARN[kind] || 0;
    const t = Number(now) || 0;
    if (!add || !charId || !t) return { box: b, got: 0 };
    const cur = (b[charId] && typeof b[charId] === "object") ? b[charId] : {};
    const last = (cur.last && typeof cur.last === "object") ? cur.last : {};
    // 记的是【上次真给了点数】的时刻，不是上次说话的时刻。
    // 记上次说话的话，聊一下午反而一分不给（得先安静 90 分钟才算新的一段）——
    // 那就成了「聊得越久越吃亏」。现在是：陪着的时间越长，每 90 分钟结一次，日封顶兜住上限。
    const fresh = !last[kind] || (t - Number(last[kind]) >= SESSION_GAP_MS);
    const dayPts = cur.day === dayKey ? (Number(cur.dayPts) || 0) : 0;
    const got = fresh ? Math.max(0, Math.min(add, DAILY_CAP - dayPts)) : 0;
    const n = {};
    Object.keys(b).forEach(function (k) { n[k] = b[k]; });
    const nlast = {};
    Object.keys(last).forEach(function (k) { nlast[k] = last[k]; });
    if (got) nlast[kind] = t;   // 没给成就别推——封顶那天推了，第二天头一句就白等 90 分钟
    n[charId] = { pts: (Number(cur.pts) || 0) + got, day: dayKey, dayPts: dayPts + got, last: nlast };
    return { box: n, got: got };
  }

  // 抽卡扣点。点数不够就一点都不扣——半途扣掉一半是最恶心的那种 bug。
  function spend(box, charId, cost) {
    const have = ptsOf(box, charId);
    if (have < cost) return null;
    const cur = box[charId] || {};
    const n = {};
    Object.keys(box).forEach(function (k) { n[k] = box[k]; });
    n[charId] = Object.assign({}, cur, { pts: have - cost });
    return n;
  }

  function ptsOf(box, charId) {
    const c = box && box[charId];
    return c && typeof c === "object" ? (Number(c.pts) || 0) : 0;
  }

  const api = {
    RATE_SSR: RATE_SSR, RATE_SR: RATE_SR, PITY_SSR: PITY_SSR, TEN: TEN,
    COST_ONE: COST_ONE, COST_TEN: COST_TEN, EARN: EARN, DAILY_CAP: DAILY_CAP,
    POOLS: POOLS, byId: byId, RANK: RANK,
    SESSION_GAP_MS: SESSION_GAP_MS,
    poolOf: poolOf, rollRarity: rollRarity, pickCard: pickCard, pull: pull,
    earn: earn, spend: spend, ptsOf: ptsOf
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.GachaKit = api;
})(typeof window !== "undefined" ? window : globalThis);
