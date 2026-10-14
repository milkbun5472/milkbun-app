"use strict";
// 独立约会棋局：裁判只认事件，AI 只决定自己的提议与配合。
(function (root) {
  // 地点池（她 2026-10-12：「一直只有这六站也很无聊」）：每局从池里抽六处，玩法按 kind 走同一套。
  //   options 是到了现场能选的几样；tags 给任务认（sweet 甜的、pair 成对）。
  const PLACE_POOL = Object.freeze([
    { id: "cafe", name: "街角小店", time: 40, cost: 55, note: "点些吃的，再接着逛", kind: "menu", options: [["cake", "点一份甜点", ["sweet"]], ["meal", "来份热食", []], ["tea", "喝点茶", []]] },
    { id: "noodle", name: "深夜面馆", time: 35, cost: 40, note: "一人一碗，或者分着吃", kind: "menu", options: [["bowl", "两碗不同的换着吃", []], ["spicy", "挑战最辣那一档", []], ["sugar", "饭后加一碗糖水", ["sweet"]]] },
    { id: "dessert", name: "甜品站", time: 25, cost: 50, note: "排队、挑口味、分一勺", kind: "menu", options: [["icecream", "双球冰淇淋", ["sweet"]], ["crepe", "可丽饼", ["sweet"]], ["lemon", "一杯柠檬水", []]] },
    { id: "bbq", name: "路边烧烤摊", time: 45, cost: 60, note: "烟火气，边吃边聊", kind: "menu", options: [["skewer", "一大把串", []], ["corn", "烤玉米", []], ["marsh", "烤棉花糖", ["sweet"]]] },
    { id: "photo", name: "合照亭", time: 30, cost: 45, note: "一起摆动作，拍一张合照", kind: "photo" },
    { id: "studio", name: "复古照相馆", time: 40, cost: 70, note: "换个布景，正经拍一张", kind: "photo" },
    { id: "arcade", name: "游乐屋", time: 45, cost: 60, note: "TA 移前后，你移左右，合力抓玩偶", kind: "claw" },
    { id: "capsule", name: "扭蛋机长廊", time: 30, cost: 40, note: "TA 挑哪一排，你挑哪一格", kind: "claw" },
    { id: "shop", name: "小物集市", time: 35, cost: 80, note: "挑一件，或挑一对", kind: "gift", options: [["pair", "挑一对纪念物", ["pair"]], ["single", "挑一件小物送对方", []]] },
    { id: "flower", name: "花店", time: 25, cost: 45, note: "给对方挑一枝", kind: "gift", options: [["one", "挑一枝送对方", []], ["two", "一人一枝，配成一对", ["pair"]]] },
    { id: "record", name: "二手唱片店", time: 40, cost: 50, note: "互相挑一张对方会喜欢的", kind: "gift", options: [["forta", "给对方挑一张", []], ["same", "挑同一张买两份", ["pair"]]] },
    { id: "river", name: "河边步道", time: 45, cost: 0, note: "免费散步；走得晚一点，风景也不同", kind: "walk" },
    { id: "rooftop", name: "天台", time: 35, cost: 0, note: "吹吹风，看看楼下的灯", kind: "walk" },
    { id: "park", name: "公园长椅", time: 30, cost: 0, note: "坐一会儿，什么也不干", kind: "walk" },
    { id: "book", name: "旧书摊", time: 40, cost: 0, note: "一起翻翻书，不花钱", kind: "book", options: [["browse", "一起翻翻", []], ["recommend", "互相推荐一本", []]] },
    { id: "library", name: "社区图书馆", time: 35, cost: 0, note: "安静地坐一会儿，小声说话", kind: "book", options: [["browse", "各看各的", []], ["recommend", "互相推荐一本", []]] },
    { id: "cinema", name: "电影院", time: 60, cost: 70, note: "看一场，出来聊聊", kind: "talk" },
    { id: "observatory", name: "城郊观星台", time: 50, cost: 30, note: "等星星出来，聊点平时不聊的", kind: "talk" },
    // 合力玩法多两处（她 2026-10-14：「地点任务多加点」）——跟游乐屋同一套：TA 管前后，你管左右
    { id: "rings", name: "套圈摊", time: 25, cost: 30, note: "TA 看准哪一排，你瞄哪一格", kind: "claw" },
    { id: "balloon", name: "打气球摊", time: 25, cost: 35, note: "TA 报哪一排，你扣扳机", kind: "claw" },
    { id: "ktv", name: "小包厢唱歌", time: 50, cost: 60, note: "点一首，唱着唱着就聊起来了", kind: "talk" },
    // 按现实钟点才开的（她 2026-10-14 挑的第 7 条）：hours＝[开, 关)，关比开小就是跨过半夜
    { id: "breakfast", name: "早餐铺", time: 25, cost: 20, note: "趁热，豆浆油条或者小笼包", kind: "menu", hours: [6, 11], options: [["fritter", "豆浆油条", []], ["bun", "一笼小笼包", []], ["sweetsoy", "甜豆花", ["sweet"]]] },
    { id: "nightmarket", name: "夜市小吃街", time: 45, cost: 55, note: "一路走一路吃，灯一盏一盏亮着", kind: "menu", hours: [18, 2], options: [["skewers", "边走边吃一路小串", []], ["tanghulu", "一人一串糖葫芦", ["sweet"]], ["stall", "挑一家坐下慢慢吃", []]] },
    { id: "sunset", name: "江堤看日落", time: 35, cost: 0, note: "赶在天黑前，看太阳掉进水里", kind: "walk", hours: [16, 19] }
  ]);
  const openAt = (p, hour) => !p.hours || (p.hours[0] < p.hours[1] ? hour >= p.hours[0] && hour < p.hours[1] : hour >= p.hours[0] || hour < p.hours[1]);
  // 旧存档没有 s.places：退回最早那六处
  const LEGACY_PLACES = ["cafe", "photo", "arcade", "shop", "river", "book"];
  const PLACES = PLACE_POOL;
  // 路上的小意外：到达时掷一个，时间和钱当场结算，TA 在这一站会接这件事
  const EVENTS = Object.freeze([
    { id: "none", text: "", minutes: 0, money: 0 },
    { id: "none2", text: "", minutes: 0, money: 0 },
    { id: "rain", text: "突然下起雨", minutes: 0, money: 0, choices: [["umbrella", "一起冲进便利店买一把伞，挤着撑", -5, -15, 4], ["eaves", "躲在屋檐下等雨停，顺便聊会儿", -15, 0, 2]] },
    { id: "sale", text: "正好赶上限时打折，省了一点", minutes: 0, money: 15 },
    { id: "queue", text: "门口排着好长的队", minutes: 0, money: 0, choices: [["wait", "排着，边等边聊", -15, 0, 2], ["skip", "加钱买快速通道", 0, -20, 0]] },
    { id: "lastone", text: "店里只剩最后一份/一件", minutes: 0, money: 0, choices: [["give", "让给对方", 0, 0, 4], ["share", "分着来，一人一半", 0, 0, 3]] },
    { id: "busker", text: "门口有人在街头弹唱", minutes: 0, money: 0, choices: [["listen", "停下来听一首，往琴盒里放点钱", -5, -5, 3], ["pass", "拉着对方接着走", 0, 0, -1]] },
    { id: "cat", text: "路边一只猫跟上了你们", minutes: 0, money: 0, choices: [["pet", "蹲下来一起逗猫", -10, 0, 3], ["feed", "去小卖部买根火腿肠喂它", -5, -5, 4]] },
    { id: "wallet", text: "差点把钱包落在上一站，折回去拿了一趟", minutes: -10, money: 0 },
    { id: "friend", text: "撞见了一个认识的人", minutes: 0, money: 0, choices: [["introduce", "大大方方介绍身边这位", -5, 0, 4], ["dodge", "拉着对方躲开", 0, 0, -2]] },
    { id: "coupon", text: "捡到一张别人不要的优惠券", minutes: 0, money: 10 },
    { id: "lost", text: "走错了一个路口，绕了一圈", minutes: -10, money: 0 }
  ]);
  // 话题签：talk / walk 那几处抽一张，你俩就着它聊
  const TOPICS = Object.freeze(["小时候最怕的东西", "最近一次偷偷开心的事", "如果明天不用上班上学想干嘛", "一个没跟别人说过的小习惯", "最想再去一次的地方", "第一次见面时对对方的印象",
    "最近在循环的一首歌", "一件后悔没做的小事", "理想中的周末", "最近被谁/什么安慰到了", "自己身上最像小孩的地方", "十年后想住在什么样的地方"]);
  // 任务：一半看真事件（代码判），一半看你俩说了什么（翻牌前由裁判读一遍聊天判）
  const MISSIONS = Object.freeze([
    { id: "photo", title: "默契合照", text: "拍到一张两人动作相同的合照。", needs: "photo" },
    { id: "plush", title: "合力带走", text: "在一处两人合力的小游戏里，一起赢到点什么。", needs: "claw" },
    { id: "cake", title: "留点甜的", text: "吃到一样甜的东西（谁点的都算）。", needs: "menu" },
    { id: "pair", title: "成双成对", text: "买到一对东西。", needs: "gift" },
    { id: "late", title: "晚一点再走", text: "把一处散步的地方放在已经走过至少 90 分钟之后。", needs: "walk" },
    { id: "save", title: "精打细算", text: "逛过至少三处，收工时还剩至少 100 枚游戏币。" },
    { id: "praise", title: "讨一句夸", text: "让对方真心夸你一次。", social: true },
    { id: "childhood", title: "翻旧账", text: "让对方主动讲一件小时候的事。", social: true },
    { id: "treat", title: "被请客", text: "让对方说出「这次我请」或者主动替你付。", social: true },
    { id: "laugh", title: "逗笑", text: "把对方逗笑一次。", social: true },
    { id: "next", title: "约下一次", text: "让对方先提出下次还要一起出来。", social: true },
    { id: "secret", title: "交换秘密", text: "让对方说一件没跟别人说过的事。", social: true }
  ]);
  // 主题局（第 8 条）：开局页挑。TA 的态度跟着变，任务池多一张这个主题专属的
  const THEMES = Object.freeze({
    plain: { zh: "随便逛逛", prompt: "" },
    first: { zh: "第一次约会", prompt: "这是你们第一次单独出来约会：有点拘谨、互相试探，想给对方留个好印象，话不会说得太满。" },
    anniv: { zh: "纪念日", prompt: "今天是你们的纪念日：想起以前的事会更多，也更想把今天过得特别一点。" },
    makeup: { zh: "吵架之后和好", prompt: "你们前几天刚闹过别扭，今天出来算是和好：一开始有点别扭、嘴硬，慢慢才软下来。" }
  });
  const THEME_MISSIONS = Object.freeze([
    { id: "askme", theme: "first", title: "被好奇", text: "让对方主动问你一个关于你自己的问题。", social: true },
    { id: "oldday", theme: "anniv", title: "提起从前", text: "让对方先说起你们以前一起做过的一件事。", social: true },
    { id: "softword", theme: "makeup", title: "先服软", text: "让对方先说一句软话（道歉、认错或者「我也有不对」）。", social: true }
  ]);
  // 追加任务（第 4 条）：走完第二站各抽一张小的，完成多 1 分；都是看聊天的，翻牌前裁判一起判
  const BONUS = Object.freeze([
    { id: "hand", title: "牵手", text: "回家前牵到对方的手（谁先伸手都算，聊天里要说到）。", social: true },
    { id: "fav", title: "最喜欢哪站", text: "让对方说出今天最喜欢哪一站。", social: true },
    { id: "nick", title: "叫个昵称", text: "让对方用昵称叫你一次。", social: true },
    { id: "nexttime", title: "下次去哪", text: "让对方说出下次想一起去的一个地方。", social: true },
    { id: "photoask", title: "要合照", text: "让对方主动说想和你拍一张。", social: true }
  ]);
  const POSES = ["比个耶", "托着脸", "歪歪头"];
  const clone = x => JSON.parse(JSON.stringify(x));
  const pick = (a, rng) => a[Math.min(a.length - 1, Math.floor(rng() * a.length))];
  // 这一局模型配的料（她 2026-10-14：「放开让模型想」）：地点的名字、样子、能挑的东西，路上的小意外，专属任务。
  //   玩法种类和判分规则不变，只盖在默认那份上面；读哪一局就先 bind 哪一局（所有收存档的函数进门先 bind）。
  let CUR = null;
  const bind = s => { CUR = (s && s.custom) || null; return s; };
  const place = id => { const b = PLACE_POOL.find(p => p.id === id); const c = CUR && CUR.places && CUR.places[id]; return b && c ? Object.assign({}, b, c) : b; };
  const placesOf = s => (Array.isArray(s.places) && s.places.length ? s.places : LEGACY_PLACES);
  const optionOf = (p, id) => (p && p.options || []).find(o => o[0] === id);
  const mission = id => MISSIONS.find(m => m.id === id) || THEME_MISSIONS.find(m => m.id === id) || BONUS.find(m => m.id === id) || ((CUR && CUR.missions) || []).find(m => m.id === id);
  function newGame(config, rng, opts) {
    rng = rng || Math.random;
    opts = opts || {};
    // 这一局的六处：每种玩法先各抽一处，再从剩下的里补满，顺序打乱
    let places = opts.places;
    if (!places) {
      const kinds = ["menu", "photo", "claw", "gift", "walk", "book", "talk"], picked = [];
      const hour = opts.hour != null ? opts.hour : new Date().getHours();
      // 这个钟点开着的地方优先：限时段的那几处一开门就排在前面抽
      kinds.forEach(k => { const c = PLACE_POOL.filter(p => p.kind === k && openAt(p, hour)), timed = c.filter(p => p.hours); picked.push(pick(timed.length && rng() < .7 ? timed : c, rng).id); });
      while (picked.length > 6) picked.splice(Math.floor(rng() * picked.length), 1);
      places = picked;
    }
    const has = k => places.some(id => (place(id) || {}).kind === k);
    const pool = MISSIONS.filter(m => !m.needs || has(m.needs)).concat(THEME_MISSIONS.filter(m => m.theme === (config && config.dateTheme)));
    const me = pick(pool, rng), ta = pick(pool.filter(m => m.id !== me.id), rng);
    return { v: 2, places: places, noEvents: opts.events === false, id: Date.now().toString(36) + "-" + rng().toString(36).slice(2), config: clone(config),
      theme: THEMES[config && config.dateTheme] ? config.dateTheme : "plain", bonus: null,
      missions: { user: me.id, char: ta.id }, phase: "plan", round: 1, minutes: 180, money: 200,
      visits: [], events: [], talk: [], proposal: null, prepared: null, exchanges: 0, retryUsed: false,
      toys: [0, 1, 2].map(() => Math.floor(rng() * 3)), pending: null, aiGuess: null, userGuess: null, result: null };
  }
  function legalPlaces(s) {
    return placesOf(s).map(place).filter(p => p && !s.visits.includes(p.id) && p.time <= s.minutes && p.cost <= s.money);
  }
  function progress(s, id, judged) {
    const ev = s.events;
    const kindOf = e => (place(e.place) || {}).kind;
    const tagged = (e, tag) => [e.choice, e.taChoice].some(c => { const o = optionOf(place(e.place), c); return o && o[2].indexOf(tag) >= 0; });
    const hits = ev.filter(e => id === "photo" ? kindOf(e) === "photo" && e.match
      : id === "plush" ? kindOf(e) === "claw" && e.win
      : id === "cake" ? kindOf(e) === "menu" && tagged(e, "sweet")
      : id === "pair" ? kindOf(e) === "gift" && tagged(e, "pair")
      : id === "late" ? kindOf(e) === "walk" && e.at >= 90 : false);
    if (id === "save") return { done: s.visits.length >= 3 && s.money >= 100,
      evidence: "逛了 " + s.visits.length + " 处 · 剩 " + s.money + " 枚游戏币" };
    // 看人的任务：只认裁判读完聊天给的结论（没判过就是没完成）
    if ((mission(id) || {}).social) return judged ? { done: !!judged.done, evidence: String(judged.evidence || "").slice(0, 200) || (judged.done ? "裁判认了" : "聊天里没出现") } : { done: false, evidence: "还没翻牌，裁判还没读聊天。" };
    return { done: !!hits.length, evidence: hits.length ? hits.map(e => e.text).join("；") : "这一局还没有完成这件事。" };
  }
  // 唯一模型投影：完整存档、用户任务、用户末轮猜测都不会进这条路。
  function aiView(s) {
    return { phase: s.phase, round: s.round, leader: s.round % 2 ? "用户" : "你", minutes: s.minutes, money: s.money,
      yourMission: mission(s.missions.char), missionPool: MISSIONS.filter(m => !m.needs || placesOf(s).some(id => (place(id) || {}).kind === m.needs)).concat(THEME_MISSIONS.filter(m => m.theme === s.theme)).concat((s.custom && s.custom.missions) || []), places: legalPlaces(s),
      current: s.current || null, lastEvent: s.events.length ? s.events[s.events.length - 1] : null,
      visits: s.visits, events: s.events, talk: s.talk, proposal: s.pending && s.pending.proposedId || s.proposal,
      exchanges: s.exchanges, toys: s.toys, poses: POSES, mood: moodOf(s), challenge: s.challenge || null,
      theme: (THEMES[s.theme] || THEMES.plain).zh, yourBonus: s.bonus ? mission(s.bonus.char) : null };
  }
  function startRequest(s, kind, line, proposedId) {
    if (s.pending) throw Error("这一句还在等回复。");
    // chat：路上随便说一句，哪一步都能说，不改地点、不动进度（她 2026-10-14：「每次说完一轮话就不给我说了」）
    if ((kind === "plan" && s.phase !== "plan") || (kind === "guess" && s.phase !== "guess") || (kind === "react" && s.phase !== "after") || (kind === "chat" && s.phase === "finished")
      || (kind === "dare" && !(s.challenge && s.challenge.kind === "dare" && !s.challenge.done))) throw Error("现在不是这一步。");
    if (!["plan", "guess", "react", "chat", "dare"].includes(kind)) throw Error("未知的游戏动作。");
    if (kind === "dare" && !String(line || "").trim()) throw Error("先回一句。");
    if (kind === "chat" && !String(line || "").trim()) throw Error("先说一句。");
    if (kind === "guess" && s.aiGuess !== null) throw Error("TA 已经交好猜测了。");
    if (proposedId && !legalPlaces(s).some(p => p.id === proposedId)) throw Error("这处现在去不了。");
    const n = clone(s);
    if (line) n.talk.push({ who: "user", text: String(line).slice(0, 600), round: n.round, n: (n.seq = (n.seq || 0) + 1) });
    n.pending = { kind, proposedId: proposedId || null };
    return n;
  }
  function receiveReply(s, reply) {
    if (!s.pending) throw Error("没有待收的回复。");
    if (!reply || typeof reply !== "object" || typeof reply.say !== "string" || !reply.say.trim()) throw Error("没有收到 TA 的台词。");
    const n = clone(s);
    if (s.pending.kind === "plan") {
      if (!legalPlaces(s).some(p => p.id === reply.place)) throw Error("TA 提议了当前去不了的地方。");
      // 配合动作缺了就补默认值，不为它把整句作废——作废了输入框就一直锁着（她 2026-10-14）
      const idx = v => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 2 ? Number(v) : 0;
      n.proposal = reply.place; n.prepared = { pose: idx(reply.pose), row: idx(reply.row), hint: String(reply.hint || "").slice(0, 300) };
      n.exchanges++;
    } else if (s.pending.kind === "chat") {
      // 只接话，不动地点和进度；心情可以小动一下
      bumpMood(n, Math.max(-3, Math.min(3, Number(reply.mood) || 0)), "路上聊天");
    } else if (s.pending.kind === "dare") {
      settleChallenge(n, reply.pass === true, reply.pass === true ? "TA 认了" : "TA 不认");
    } else if (s.pending.kind === "react") {
      bumpMood(n, reply.mood, "这一站");
      // TA 顺手出的题（只在 wantsChallenge 那几站问）：格式不全就当没出，不作废这一句
      const ch = reply.challenge;
      if (wantsChallenge(s) && ch && typeof ch === "object") {
        const lines = Array.isArray(ch.lines) ? ch.lines.map(x => String(x || "").trim()).filter(Boolean).slice(0, 3) : [];
        if (ch.kind === "lie" && lines.length === 3 && Number.isInteger(Number(ch.fake)) && Number(ch.fake) >= 0 && Number(ch.fake) <= 2)
          n.challenge = { kind: "lie", text: "我说三件关于我的事，有一件是假的，你猜哪句", options: lines, answer: Number(ch.fake), done: false };
        else if (ch.kind === "dare" && String(ch.text || "").trim())
          n.challenge = { kind: "dare", text: String(ch.text).trim().slice(0, 120), done: false };
      }
      // 到了现场 TA 的那一句；点单／挑礼物那几处 TA 也替你挑一样（pick 是选项 id，挑不中就当没挑）
      const last = n.events[n.events.length - 1], p = place(s.current);
      if (last && p && p.options && typeof reply.pick === "string" && optionOf(p, reply.pick)) {
        last.taChoice = reply.pick;
        last.text += "TA 替你挑了「" + optionOf(p, reply.pick)[1] + "」。";
      }
    } else {
      if (reply.guess !== "unknown" && !mission(reply.guess)) throw Error("TA 的猜测没收完整。");
      n.aiGuess = reply.guess;
      // 这次约会 TA 打几分、一句心里话（翻牌后跟心情条一起摊开）
      const r = Math.round(Number(reply.rate));
      n.rating = { score: r >= 1 && r <= 10 ? r : null, heart: String(reply.heart || "").trim().slice(0, 200), title: String(reply.title || "").trim().slice(0, 16) };
    }
    n.talk.push(Object.assign({ who: "char", text: reply.say.trim().slice(0, 1200), round: n.round, n: (n.seq = (n.seq || 0) + 1) }, reply.scheme === true ? { scheme: true } : {}));
    n.pending = null;
    return n;
  }
  function commitPlace(s, id, override, rng) {
    if (s.phase !== "plan" || s.pending || !s.prepared || !s.proposal) throw Error("先听听 TA 的提议。");
    if (id !== s.proposal && !(override && s.round % 2 && s.exchanges >= 2)) throw Error("这一站还没商量好。");
    const p = legalPlaces(s).find(x => x.id === id); if (!p) throw Error("时间或预算不够了。");
    const n = clone(s); n.minutes -= p.time; n.money -= p.cost; n.visits.push(id);
    n.phase = "activity"; n.current = id; n.arrival = 180 - s.minutes; n.retryUsed = false;
    // 路上的小意外：掷一个，当场结算（不扣成负数）
    const r0 = rng || Math.random, used = n.usedIncidents || [];
    const fresh = ((s.custom && s.custom.incidents) || []).filter(e => used.indexOf(e.id) < 0);
    // 这一局配好的小意外先用（六成），用过的不再掷；没有就回默认那几件
    const ev = s.noEvents ? EVENTS[0] : fresh.length && r0() < .6 ? fresh[0] : rng ? pick(EVENTS, rng) : EVENTS[Math.floor(Math.random() * EVENTS.length)];
    if (fresh.length && ev === fresh[0]) n.usedIncidents = used.concat([ev.id]);
    n.minutes = Math.max(0, n.minutes + ev.minutes); n.money = Math.max(0, n.money + ev.money);
    // 有两条路的小意外先不结算，摆给她挑（她 2026-10-14：「小意外有选择」）
    n.incident = ev.text ? { id: ev.id, text: ev.text, minutes: ev.minutes, money: ev.money, choices: ev.choices ? ev.choices.map(c => ({ id: c[0], label: c[1] })) : null, picked: null } : null;
    // 聊天签：talk / walk 那几处抽一张
    n.topic = (p.kind === "talk" || p.kind === "walk") ? TOPICS[Math.min(TOPICS.length - 1, Math.floor((rng ? rng() : Math.random()) * TOPICS.length))] : null;
    return n;
  }
  function resolveActivity(s, choice) {
    if (s.phase !== "activity" || s.pending) throw Error("现在不是活动时间。");
    if (s.incident && s.incident.choices && !s.incident.picked) throw Error("先决定路上那件事怎么办。");
    const p = place(s.current), n = clone(s); let text, extra = {};
    if (p.kind === "photo") {
      if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw Error("先摆好动作。");
      extra = { choice, match: choice === s.prepared.pose };
      text = p.name + "：你" + POSES[choice] + "，TA" + POSES[s.prepared.pose] + (extra.match ? "，动作对上了。" : "，各摆各的。");
    } else if (p.kind === "claw") {
      if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw Error("先移动抓钩。");
      extra = { choice, row: s.prepared.row, win: s.toys[s.prepared.row] === choice };
      text = extra.win ? p.name + "：你俩一个管排一个管格，真弄到了一个。" : p.name + "：落空了，什么也没弄到。";
    } else if (p.kind === "walk" || p.kind === "talk") {
      const line = String(choice || "").trim();
      extra = { choice: "talk", line: line.slice(0, 300), topic: s.topic || "" };
      text = p.name + (s.topic ? "：聊到「" + s.topic + "」" : "：走了走") + (line ? "，你说「" + line.slice(0, 60) + "」" : "") + "。";
    } else {
      const o = optionOf(p, choice);
      if (!o) throw Error("这个活动没有这项动作。");
      text = p.name + "：你" + o[1] + "。"; extra.choice = choice;
    }
    if (s.incident) { text = "（" + s.incident.text + (s.incident.picked ? "，" + s.incident.pickedLabel : "") + "）" + text; extra.incident = s.incident.id; if (s.incident.picked) extra.incidentChoice = s.incident.picked; }
    n.events.push(Object.assign({ place: p.id, at: s.arrival, text, round: s.round, n: (n.seq = (n.seq || 0) + 1) }, extra));
    n.phase = "after";
    return n;
  }
  // 收模型配的料：一样一样验，不合格的那一样就用默认的，不为一处坏了作废整份
  const EMOJI_RE = /^\p{Extended_Pictographic}/u;
  function applyCustom(s, raw) {
    const n = clone(s), out = { places: {}, incidents: [], missions: [] }, src = raw && typeof raw === "object" ? raw : {};
    placesOf(s).forEach(id => {
      const b = PLACE_POOL.find(p => p.id === id), c = (src.places || {})[id]; if (!b || !c || typeof c !== "object") return;
      const o = {};
      if (String(c.name || "").trim()) o.name = String(c.name).trim().slice(0, 10);
      if (String(c.note || "").trim()) o.note = String(c.note).trim().slice(0, 28);
      if (EMOJI_RE.test(String(c.icon || ""))) o.icon = Array.from(String(c.icon))[0];
      if (b.options && Array.isArray(c.options)) {
        const need = b.kind === "menu" ? "sweet" : b.kind === "gift" ? "pair" : "";
        const opts = c.options.filter(x => x && String(x.label || "").trim()).slice(0, 3).map((x, i) => {
          const tags = (Array.isArray(x.tags) ? x.tags : []).filter(t => t === need);
          return ["o" + (i + 1), String(x.label).trim().slice(0, 16), tags];
        });
        // 任务认「甜的」「成对」：配的东西里没有这一样，就不收这份选项，照用默认的
        if (opts.length >= 2 && (!need || opts.some(x => x[2].length))) o.options = opts;
      }
      if (Object.keys(o).length) out.places[id] = o;
    });
    const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
    (Array.isArray(src.incidents) ? src.incidents : []).slice(0, 6).forEach((e, i) => {
      const cs = (Array.isArray(e && e.choices) ? e.choices : []).filter(c => c && String(c.label || "").trim()).slice(0, 2);
      if (!String((e && e.text) || "").trim() || cs.length < 2) return;
      out.incidents.push({ id: "cx" + (i + 1), text: String(e.text).trim().slice(0, 40), minutes: 0, money: 0,
        choices: cs.map((c, j) => ["c" + (j + 1), String(c.label).trim().slice(0, 24), num(c.minutes, -20, 0), num(c.money, -30, 15), num(c.mood, -3, 5)]) });
    });
    (Array.isArray(src.missions) ? src.missions : []).slice(0, 3).forEach((m, i) => {
      if (!String((m && m.text) || "").trim()) return;
      out.missions.push({ id: "cm" + (i + 1), title: String(m.title || "专属任务").trim().slice(0, 8), text: String(m.text).trim().slice(0, 50), social: true, custom: true });
    });
    n.custom = out; n.prepped = true;
    return n;
  }
  function skipPrep(s) { const n = clone(s); n.prepped = true; return n; }
  // ---- 心情条（她 2026-10-14 挑的第 2 条）：TA 这一路过得怎么样，0~100，从 60 起 ----
  const MOOD0 = 60;
  const moodOf = s => s.mood == null ? MOOD0 : s.mood;
  function bumpMood(n, d, why) {
    const v = Math.max(-10, Math.min(10, Math.round(Number(d) || 0)));
    if (!v) return n;
    n.mood = Math.max(0, Math.min(100, moodOf(n) + v));
    (n.moodLog = n.moodLog || []).push({ d: v, why: String(why || "").slice(0, 60), round: n.round });
    return n;
  }
  // 路上的小意外挑一条路（第 3 条）：时间、钱当场结算，心情跟着挑的那条走
  function chooseIncident(s, id) {
    if (s.phase !== "activity" || s.pending || !s.incident || !s.incident.choices || s.incident.picked) throw Error("现在不用选。");
    const ev = EVENTS.find(e => e.id === s.incident.id) || ((s.custom && s.custom.incidents) || []).find(e => e.id === s.incident.id), c = ev && (ev.choices || []).find(x => x[0] === id);
    if (!c) throw Error("没有这个选项。");
    const n = clone(s);
    n.minutes = Math.max(0, n.minutes + c[2]); n.money = Math.max(0, n.money + c[3]);
    n.incident.picked = c[0]; n.incident.pickedLabel = c[1]; n.incident.minutes = c[2]; n.incident.money = c[3];
    return bumpMood(n, c[4], s.incident.text + "，" + c[1]);
  }
  // ---- TA 出的小题（第 1 条）：到站接话时，有时 TA 顺手出一道。
  //   lie＝三句里一句是假的，她猜哪句（代码判）；dare＝开放的小要求（逗我笑、猜我喜欢什么…），她回一句，TA 自己判过没过。
  //   过了：多 10 分钟、TA 心情 +5；没过：TA 笑一笑，不扣东西。
  const CHALLENGE_STOPS = [2, 3];
  const wantsChallenge = s => CHALLENGE_STOPS.indexOf(s.visits.length) >= 0 && (s.challenges || 0) < 2 && !s.challenge;
  function settleChallenge(n, pass, note) {
    const c = n.challenge; c.done = true; c.pass = !!pass; c.note = String(note || "").slice(0, 120);
    n.challenges = (n.challenges || 0) + 1;
    if (pass) { n.minutes += 10; bumpMood(n, 5, "答上了 TA 出的题"); }
    (n.events[n.events.length - 1] || {}).challenge = { text: c.text, pass: c.pass };
    return n;
  }
  function answerLie(s, idx) {
    if (!s.challenge || s.challenge.done || s.challenge.kind !== "lie" || s.pending) throw Error("现在没有要猜的题。");
    const n = clone(s); n.challenge.picked = idx;
    return settleChallenge(n, idx === s.challenge.answer, idx === s.challenge.answer ? "猜中了哪句是假的" : "没猜中");
  }
  function skipChallenge(s) {
    if (!s.challenge || s.challenge.done || s.pending) throw Error("现在没有题。");
    const n = clone(s); n.challenge.done = true; n.challenge.skipped = true; n.challenges = (n.challenges || 0) + 1; return n;
  }
  function retryActivity(s) {
    const last = s.events[s.events.length - 1];
    if (s.phase !== "after" || s.retryUsed || s.minutes < 5 || !last ||
      !(((place(s.current) || {}).kind === "photo" && !last.match) || ((place(s.current) || {}).kind === "claw" && !last.win))) throw Error("这次不能重试。");
    const n = clone(s); n.minutes -= 5; n.retryUsed = true; n.phase = "activity"; return n;
  }
  function nextStop(s) {
    if (s.phase !== "after") throw Error("先做完这一站。");
    if (s.challenge && !s.challenge.done) throw Error("TA 出的题还没答。");
    const n = clone(s); n.challenge = null;
    if (!n.bonus && n.visits.length === 2) {
      const pool = BONUS.concat((s.custom && s.custom.missions) || []).filter(b => b.id !== s.missions.user && b.id !== s.missions.char);
      const r = Math.random, a = pool[Math.floor(r() * pool.length)], rest = pool.filter(b => b.id !== a.id);
      n.bonus = { user: a.id, char: rest[Math.floor(r() * rest.length)].id };
    }
    if (s.visits.length >= 4 || !legalPlaces(s).length) n.phase = "guess";
    else { n.phase = "plan"; n.round++; n.proposal = null; n.prepared = null; n.exchanges = 0; n.incident = null; n.topic = null; }
    return n;
  }
  function closeDate(s) {
    if (!["plan", "after"].includes(s.phase) || s.pending) throw Error("先做完当前这一步。");
    const n = clone(s); if (n.challenge && !n.challenge.done) { n.challenge.done = true; n.challenge.skipped = true; } n.phase = "guess"; return n;
  }
  function finish(s, guess, judged, accuse) {
    if (s.phase !== "guess" || s.aiGuess === null || s.pending) throw Error("先等 TA 交好猜测。");
    if (guess !== "unknown" && !mission(guess)) throw Error("先选一个猜测。");
    const n = clone(s); n.userGuess = guess;
    judged = judged || {};
    const mine = progress(s, s.missions.user, judged.user), theirs = progress(s, s.missions.char, judged.char);
    n.result = { user: { mission: mine, guess: guess === s.missions.char }, char: { mission: theirs, guess: s.aiGuess === s.missions.user } };
    // 追加任务各 +1（第 4 条）；指认 TA 哪句在演，指对 +1（第 5 条）
    if (s.bonus) {
      n.result.user.bonus = progress(s, s.bonus.user, judged.userBonus);
      n.result.char.bonus = progress(s, s.bonus.char, judged.charBonus);
    }
    const tl = (s.talk || [])[accuse];
    if (accuse != null && tl && tl.who === "char") n.result.user.accuse = { text: tl.text.slice(0, 80), hit: !!tl.scheme };
    n.result.user.score = (mine.done ? 2 : 0) + (n.result.user.guess ? 1 : 0) + (n.result.user.bonus && n.result.user.bonus.done ? 1 : 0) + (n.result.user.accuse && n.result.user.accuse.hit ? 1 : 0);
    n.result.char.score = (theirs.done ? 2 : 0) + (n.result.char.guess ? 1 : 0) + (n.result.char.bonus && n.result.char.bonus.done ? 1 : 0);
    n.phase = "finished"; return n;
  }
  // 翻牌前要不要请裁判读聊天：两人里有一张是看人的任务才要
  const needsJudge = s => [s.missions.user, s.missions.char].concat(s.bonus ? [s.bonus.user, s.bonus.char] : []).some(id => (mission(id) || {}).social);
  // 路上的一条时间线（她 2026-10-14：「节奏和气泡显示有点不对」）：说过的话和每站的小票按发生的先后排在一起，
  //   原来话在上、小票在下，TA 对这一站的反应排在「发生了什么」前面。旧存档没有先后号：同一站里话在前、小票在后。
  function feed(s) {
    const key = (x, kind, i) => x.n != null ? x.n : (Number(x.round) || 0) * 10000 + (kind === "event" ? 9000 : 0) + i;
    return (s.talk || []).map((x, i) => ({ kind: "talk", item: x, k: key(x, "talk", i) }))
      .concat((s.events || []).map((x, i) => ({ kind: "event", item: x, k: key(x, "event", i) })))
      .sort((a, b) => a.k - b.k);
  }
  const api0 = { applyCustom, skipPrep, THEMES, THEME_MISSIONS, BONUS, openAt, feed, moodOf, chooseIncident, answerLie, skipChallenge, wantsChallenge, PLACES, PLACE_POOL, EVENTS, TOPICS, needsJudge, placesOf, optionOf, MISSIONS, POSES, newGame, legalPlaces, mission, place, progress, aiView, startRequest, receiveReply, commitPlace, resolveActivity, retryActivity, nextStop, closeDate, finish };
  // 收存档的函数进门先 bind 这一局的料；place／mission 这种按 id 查的，跟着最近一次 bind 走
  const TAKES_STATE = ["feed", "moodOf", "chooseIncident", "answerLie", "skipChallenge", "wantsChallenge", "needsJudge", "placesOf", "legalPlaces", "progress", "aiView", "startRequest", "receiveReply", "commitPlace", "resolveActivity", "retryActivity", "nextStop", "closeDate", "finish", "applyCustom", "skipPrep"];
  const api = Object.assign({}, api0, { bind });
  TAKES_STATE.forEach(k => { const f = api0[k]; if (typeof f === "function") api[k] = function (s) { bind(s); return f.apply(null, arguments); }; });
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DateGameCore = api;
})(typeof window !== "undefined" ? window : globalThis);
