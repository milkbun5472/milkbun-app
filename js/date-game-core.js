"use strict";
// 独立约会棋局：裁判只认事件，AI 只决定自己的提议与配合。
(function (root) {
  const PLACES = Object.freeze([
    { id: "cafe", name: "街角小店", time: 40, cost: 55, note: "点些吃的，再接着逛", kind: "menu" },
    { id: "photo", name: "合照亭", time: 30, cost: 45, note: "一起摆动作，拍一张合照", kind: "photo" },
    { id: "arcade", name: "游乐屋", time: 45, cost: 60, note: "TA 移前后，你移左右，合力抓玩偶", kind: "claw" },
    { id: "shop", name: "小物集市", time: 35, cost: 80, note: "挑一件，或挑一对", kind: "gift" },
    { id: "river", name: "河边步道", time: 45, cost: 0, note: "免费散步；走得晚一点，风景也不同", kind: "walk" },
    { id: "book", name: "旧书摊", time: 40, cost: 0, note: "一起翻翻书，不花钱", kind: "book" }
  ]);
  const MISSIONS = Object.freeze([
    { id: "photo", title: "默契合照", text: "拍到一张两人动作相同的合照。" },
    { id: "plush", title: "合力带走", text: "在游乐屋一起抓到一个玩偶。" },
    { id: "cake", title: "留点甜的", text: "在街角小店点一份甜点。" },
    { id: "pair", title: "成双成对", text: "在小物集市挑一对纪念物。" },
    { id: "late", title: "晚一点再走", text: "把河边散步放在已经走过至少 90 分钟之后。" },
    { id: "save", title: "精打细算", text: "逛过至少三处，收工时还剩至少 100 枚游戏币。" }
  ]);
  const POSES = ["比个耶", "托着脸", "歪歪头"];
  const clone = x => JSON.parse(JSON.stringify(x));
  const pick = (a, rng) => a[Math.min(a.length - 1, Math.floor(rng() * a.length))];
  const place = id => PLACES.find(p => p.id === id);
  const mission = id => MISSIONS.find(m => m.id === id);
  function newGame(config, rng) {
    rng = rng || Math.random;
    const me = pick(MISSIONS, rng), ta = pick(MISSIONS.filter(m => m.id !== me.id), rng);
    return { v: 1, id: Date.now().toString(36) + "-" + rng().toString(36).slice(2), config: clone(config),
      missions: { user: me.id, char: ta.id }, phase: "plan", round: 1, minutes: 180, money: 200,
      visits: [], events: [], talk: [], proposal: null, prepared: null, exchanges: 0, retryUsed: false,
      toys: [0, 1, 2].map(() => Math.floor(rng() * 3)), pending: null, aiGuess: null, userGuess: null, result: null };
  }
  function legalPlaces(s) {
    return PLACES.filter(p => !s.visits.includes(p.id) && p.time <= s.minutes && p.cost <= s.money);
  }
  function progress(s, id) {
    const ev = s.events;
    const hits = ev.filter(e => id === "photo" ? e.place === "photo" && e.match
      : id === "plush" ? e.place === "arcade" && e.win
      : id === "cake" ? e.place === "cafe" && e.choice === "cake"
      : id === "pair" ? e.place === "shop" && e.choice === "pair"
      : id === "late" ? e.place === "river" && e.at >= 90 : false);
    if (id === "save") return { done: s.visits.length >= 3 && s.money >= 100,
      evidence: "逛了 " + s.visits.length + " 处 · 剩 " + s.money + " 枚游戏币" };
    return { done: !!hits.length, evidence: hits.length ? hits.map(e => e.text).join("；") : "这一局还没有完成这件事。" };
  }
  // 唯一模型投影：完整存档、用户任务、用户末轮猜测都不会进这条路。
  function aiView(s) {
    return { phase: s.phase, round: s.round, leader: s.round % 2 ? "用户" : "你", minutes: s.minutes, money: s.money,
      yourMission: mission(s.missions.char), missionPool: MISSIONS, places: legalPlaces(s),
      visits: s.visits, events: s.events, talk: s.talk, proposal: s.pending && s.pending.proposedId || s.proposal,
      exchanges: s.exchanges, toys: s.toys, poses: POSES };
  }
  function startRequest(s, kind, line, proposedId) {
    if (s.pending) throw Error("这一句还在等回复。");
    if ((kind === "plan" && s.phase !== "plan") || (kind === "guess" && s.phase !== "guess")) throw Error("现在不是这一步。");
    if (!["plan", "guess"].includes(kind)) throw Error("未知的游戏动作。");
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
    } else {
      if (reply.guess !== "unknown" && !mission(reply.guess)) throw Error("TA 的猜测没收完整。");
      n.aiGuess = reply.guess;
    }
    n.talk.push({ who: "char", text: reply.say.trim().slice(0, 1200), round: n.round });
    n.pending = null;
    return n;
  }
  function commitPlace(s, id, override) {
    if (s.phase !== "plan" || s.pending || !s.prepared || !s.proposal) throw Error("先听听 TA 的提议。");
    if (id !== s.proposal && !(override && s.round % 2 && s.exchanges >= 2)) throw Error("这一站还没商量好。");
    const p = legalPlaces(s).find(x => x.id === id); if (!p) throw Error("时间或预算不够了。");
    const n = clone(s); n.minutes -= p.time; n.money -= p.cost; n.visits.push(id);
    n.phase = "activity"; n.current = id; n.arrival = 180 - s.minutes; n.retryUsed = false;
    return n;
  }
  function resolveActivity(s, choice) {
    if (s.phase !== "activity" || s.pending) throw Error("现在不是活动时间。");
    const p = place(s.current), n = clone(s); let text, extra = {};
    if (p.id === "photo") {
      if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw Error("先摆好动作。");
      extra = { choice, match: choice === s.prepared.pose };
      text = "合照：你" + POSES[choice] + "，TA" + POSES[s.prepared.pose] + (extra.match ? "，动作对上了。" : "，各摆各的。");
    } else if (p.id === "arcade") {
      if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw Error("先移动抓钩。");
      extra = { choice, row: s.prepared.row, win: s.toys[s.prepared.row] === choice };
      text = extra.win ? "你控制左右，TA 控制前后，合力抓到一个玩偶。" : "抓钩落空，玩偶没抓到。";
    } else {
      const allowed = { cafe: ["cake", "meal", "tea"], shop: ["pair", "single"], river: ["walk"], book: ["browse"] }[p.id];
      if (!allowed.includes(choice)) throw Error("这个活动没有这项动作。");
      const names = { cake: "点了一份甜点", meal: "一起吃了热食", tea: "一起喝了茶", pair: "挑了一对纪念物", single: "挑了一件小物", walk: "沿河边散步", browse: "一起翻了旧书" };
      text = names[choice] + "。"; extra.choice = choice;
    }
    n.events.push(Object.assign({ place: p.id, at: s.arrival, text, round: s.round }, extra));
    n.phase = "after";
    return n;
  }
  function retryActivity(s) {
    const last = s.events[s.events.length - 1];
    if (s.phase !== "after" || s.retryUsed || s.minutes < 5 || !last ||
      !((s.current === "photo" && !last.match) || (s.current === "arcade" && !last.win))) throw Error("这次不能重试。");
    const n = clone(s); n.minutes -= 5; n.retryUsed = true; n.phase = "activity"; return n;
  }
  function nextStop(s) {
    if (s.phase !== "after") throw Error("先做完这一站。");
    const n = clone(s);
    if (s.visits.length >= 4 || !legalPlaces(s).length) n.phase = "guess";
    else { n.phase = "plan"; n.round++; n.proposal = null; n.prepared = null; n.exchanges = 0; }
    return n;
  }
  function closeDate(s) {
    if (!["plan", "after"].includes(s.phase) || s.pending) throw Error("先做完当前这一步。");
    const n = clone(s); n.phase = "guess"; return n;
  }
  function finish(s, guess) {
    if (s.phase !== "guess" || s.aiGuess === null || s.pending) throw Error("先等 TA 交好猜测。");
    if (guess !== "unknown" && !mission(guess)) throw Error("先选一个猜测。");
    const n = clone(s); n.userGuess = guess;
    const mine = progress(s, s.missions.user), theirs = progress(s, s.missions.char);
    n.result = { user: { mission: mine, guess: guess === s.missions.char }, char: { mission: theirs, guess: s.aiGuess === s.missions.user } };
    n.result.user.score = (mine.done ? 2 : 0) + (n.result.user.guess ? 1 : 0);
    n.result.char.score = (theirs.done ? 2 : 0) + (n.result.char.guess ? 1 : 0);
    n.phase = "finished"; return n;
  }
  const api = { PLACES, MISSIONS, POSES, newGame, legalPlaces, mission, place, progress, aiView, startRequest, receiveReply, commitPlace, resolveActivity, retryActivity, nextStop, closeDate, finish };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.DateGameCore = api;
})(typeof window !== "undefined" ? window : globalThis);
