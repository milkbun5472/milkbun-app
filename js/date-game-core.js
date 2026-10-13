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
    { id: "observatory", name: "城郊观星台", time: 50, cost: 30, note: "等星星出来，聊点平时不聊的", kind: "talk" }
  ]);
  // 旧存档没有 s.places：退回最早那六处
  const LEGACY_PLACES = ["cafe", "photo", "arcade", "shop", "river", "book"];
  const PLACES = PLACE_POOL;
  // 路上的小意外：到达时掷一个，时间和钱当场结算，TA 在这一站会接这件事
  const EVENTS = Object.freeze([
    { id: "none", text: "", minutes: 0, money: 0 },
    { id: "none2", text: "", minutes: 0, money: 0 },
    { id: "rain", text: "突然下起雨，躲了一会儿", minutes: -10, money: 0 },
    { id: "sale", text: "正好赶上限时打折，省了一点", minutes: 0, money: 15 },
    { id: "queue", text: "排了好长的队", minutes: -15, money: 0 },
    { id: "lastone", text: "店里只剩最后一份/一件", minutes: 0, money: 0 },
    { id: "busker", text: "门口有人在街头弹唱，停下来听了一首", minutes: -5, money: -5 },
    { id: "cat", text: "路边一只猫跟了你们好一段", minutes: -5, money: 0 },
    { id: "wallet", text: "差点把钱包落在上一站，折回去拿了一趟", minutes: -10, money: 0 },
    { id: "friend", text: "撞见了一个认识的人", minutes: -5, money: 0 },
    { id: "coupon", text: "捡到一张别人不要的优惠券", minutes: 0, money: 10 },
    { id: "lost", text: "走错了一个路口，绕了一圈", minutes: -10, money: 0 }
  ]);
  // 话题签：talk / walk 那几处抽一张，你俩就着它聊
  const TOPICS = Object.freeze(["小时候最怕的东西", "最近一次偷偷开心的事", "如果明天不用上班上学想干嘛", "一个没跟别人说过的小习惯", "最想再去一次的地方", "第一次见面时对对方的印象",
    "最近在循环的一首歌", "一件后悔没做的小事", "理想中的周末", "最近被谁/什么安慰到了", "自己身上最像小孩的地方", "十年后想住在什么样的地方"]);
  // 任务：一半看真事件（代码判），一半看你俩说了什么（翻牌前由裁判读一遍聊天判）
  const MISSIONS = Object.freeze([
    { id: "photo", title: "默契合照", text: "拍到一张两人动作相同的合照。", needs: "photo" },
    { id: "plush", title: "合力带走", text: "一起抓到一个玩偶或扭到一个蛋。", needs: "claw" },
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
  const POSES = ["比个耶", "托着脸", "歪歪头"];
  const clone = x => JSON.parse(JSON.stringify(x));
  const pick = (a, rng) => a[Math.min(a.length - 1, Math.floor(rng() * a.length))];
  const place = id => PLACE_POOL.find(p => p.id === id);
  const placesOf = s => (Array.isArray(s.places) && s.places.length ? s.places : LEGACY_PLACES);
  const optionOf = (p, id) => (p && p.options || []).find(o => o[0] === id);
  const mission = id => MISSIONS.find(m => m.id === id);
  function newGame(config, rng, opts) {
    rng = rng || Math.random;
    opts = opts || {};
    // 这一局的六处：每种玩法先各抽一处，再从剩下的里补满，顺序打乱
    let places = opts.places;
    if (!places) {
      const kinds = ["menu", "photo", "claw", "gift", "walk", "book", "talk"], picked = [];
      kinds.forEach(k => { const c = PLACE_POOL.filter(p => p.kind === k); picked.push(pick(c, rng).id); });
      while (picked.length > 6) picked.splice(Math.floor(rng() * picked.length), 1);
      places = picked;
    }
    const has = k => places.some(id => (place(id) || {}).kind === k);
    const pool = MISSIONS.filter(m => !m.needs || has(m.needs));
    const me = pick(pool, rng), ta = pick(pool.filter(m => m.id !== me.id), rng);
    return { v: 2, places: places, noEvents: opts.events === false, id: Date.now().toString(36) + "-" + rng().toString(36).slice(2), config: clone(config),
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
      yourMission: mission(s.missions.char), missionPool: MISSIONS.filter(m => !m.needs || placesOf(s).some(id => (place(id) || {}).kind === m.needs)), places: legalPlaces(s),
      current: s.current || null, lastEvent: s.events.length ? s.events[s.events.length - 1] : null,
      visits: s.visits, events: s.events, talk: s.talk, proposal: s.pending && s.pending.proposedId || s.proposal,
      exchanges: s.exchanges, toys: s.toys, poses: POSES };
  }
  function startRequest(s, kind, line, proposedId) {
    if (s.pending) throw Error("这一句还在等回复。");
    if ((kind === "plan" && s.phase !== "plan") || (kind === "guess" && s.phase !== "guess") || (kind === "react" && s.phase !== "after")) throw Error("现在不是这一步。");
    if (!["plan", "guess", "react"].includes(kind)) throw Error("未知的游戏动作。");
    if (kind === "guess" && s.aiGuess !== null) throw Error("TA 已经交好猜测了。");
    if (proposedId && !legalPlaces(s).some(p => p.id === proposedId)) throw Error("这处现在去不了。");
    const n = clone(s);
    if (line) n.talk.push({ who: "user", text: String(line).slice(0, 600), round: n.round });
    n.pending = { kind, proposedId: proposedId || null };
    return n;
  }
  function receiveReply(s, reply) {
    if (!s.pending) throw Error("没有待收的回复。");
    if (!reply || typeof reply !== "object" || typeof reply.say !== "string" || !reply.say.trim()) throw Error("没有收到 TA 的台词。");
    const n = clone(s);
    if (s.pending.kind === "plan") {
      if (!legalPlaces(s).some(p => p.id === reply.place)) throw Error("TA 提议了当前去不了的地方。");
      if (typeof reply.accept !== "boolean" || !Number.isInteger(reply.pose) || reply.pose < 0 || reply.pose > 2
        || !Number.isInteger(reply.row) || reply.row < 0 || reply.row > 2 || typeof reply.hint !== "string") throw Error("TA 的配合动作没收完整。");
      if (reply.accept && s.pending.proposedId && reply.place !== s.pending.proposedId) throw Error("答应的地方和提议对不上。");
      n.proposal = reply.place; n.prepared = { pose: reply.pose, row: reply.row, hint: reply.hint.slice(0, 300) };
      n.exchanges++;
    } else if (s.pending.kind === "react") {
      // 到了现场 TA 的那一句；点单／挑礼物那几处 TA 也替你挑一样（pick 是选项 id，挑不中就当没挑）
      const last = n.events[n.events.length - 1], p = place(s.current);
      if (last && p && p.options && typeof reply.pick === "string" && optionOf(p, reply.pick)) {
        last.taChoice = reply.pick;
        last.text += "TA 替你挑了「" + optionOf(p, reply.pick)[1] + "」。";
      }
    } else {
      if (reply.guess !== "unknown" && !mission(reply.guess)) throw Error("TA 的猜测没收完整。");
      n.aiGuess = reply.guess;
    }
    n.talk.push({ who: "char", text: reply.say.trim().slice(0, 1200), round: n.round });
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
    const ev = s.noEvents ? EVENTS[0] : rng ? pick(EVENTS, rng) : EVENTS[Math.floor(Math.random() * EVENTS.length)];
    n.minutes = Math.max(0, n.minutes + ev.minutes); n.money = Math.max(0, n.money + ev.money);
    n.incident = ev.text ? { id: ev.id, text: ev.text, minutes: ev.minutes, money: ev.money } : null;
    // 聊天签：talk / walk 那几处抽一张
    n.topic = (p.kind === "talk" || p.kind === "walk") ? TOPICS[Math.min(TOPICS.length - 1, Math.floor((rng ? rng() : Math.random()) * TOPICS.length))] : null;
    return n;
  }
  function resolveActivity(s, choice) {
    if (s.phase !== "activity" || s.pending) throw Error("现在不是活动时间。");
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
    if (s.incident) { text = "（" + s.incident.text + "）" + text; extra.incident = s.incident.id; }
    n.events.push(Object.assign({ place: p.id, at: s.arrival, text, round: s.round }, extra));
    n.phase = "after";
    return n;
  }
  function retryActivity(s) {
    const last = s.events[s.events.length - 1];
    if (s.phase !== "after" || s.retryUsed || s.minutes < 5 || !last ||
      !(((place(s.current) || {}).kind === "photo" && !last.match) || ((place(s.current) || {}).kind === "claw" && !last.win))) throw Error("这次不能重试。");
    const n = clone(s); n.minutes -= 5; n.retryUsed = true; n.phase = "activity"; return n;
  }
  function nextStop(s) {
    if (s.phase !== "after") throw Error("先做完这一站。");
    const n = clone(s);
    if (s.visits.length >= 4 || !legalPlaces(s).length) n.phase = "guess";
    else { n.phase = "plan"; n.round++; n.proposal = null; n.prepared = null; n.exchanges = 0; n.incident = null; n.topic = null; }
    return n;
  }
  function closeDate(s) {
    if (!["plan", "after"].includes(s.phase) || s.pending) throw Error("先做完当前这一步。");
    const n = clone(s); n.phase = "guess"; return n;
  }
  function finish(s, guess, judged) {
    if (s.phase !== "guess" || s.aiGuess === null || s.pending) throw Error("先等 TA 交好猜测。");
    if (guess !== "unknown" && !mission(guess)) throw Error("先选一个猜测。");
    const n = clone(s); n.userGuess = guess;
    judged = judged || {};
    const mine = progress(s, s.missions.user, judged.user), theirs = progress(s, s.missions.char, judged.char);
    n.result = { user: { mission: mine, guess: guess === s.missions.char }, char: { mission: theirs, guess: s.aiGuess === s.missions.user } };
    n.result.user.score = (mine.done ? 2 : 0) + (n.result.user.guess ? 1 : 0);
    n.result.char.score = (theirs.done ? 2 : 0) + (n.result.char.guess ? 1 : 0);
    n.phase = "finished"; return n;
  }
  // 翻牌前要不要请裁判读聊天：两人里有一张是看人的任务才要
  const needsJudge = s => [s.missions.user, s.missions.char].some(id => (mission(id) || {}).social);
  const api = { PLACES, PLACE_POOL, EVENTS, TOPICS, needsJudge, placesOf, optionOf, MISSIONS, POSES, newGame, legalPlaces, mission, place, progress, aiView, startRequest, receiveReply, commitPlace, resolveActivity, retryActivity, nextStop, closeDate, finish };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DateGameCore = api;
})(typeof window !== "undefined" ? window : globalThis);
