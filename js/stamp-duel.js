// 邮票对局（她 2026-11-07 定：「先做对局，要亮出下一步，可以结束选择记不记得，先搭玩法后面再弄 UI」；
//   同日扩了一轮：盖章、挪票、留牌、前后排、整版、特殊格子、邮局公告、票的作用跟卡的内容走，外加盲打）
//   这一份只有规则：不碰界面、不调模型、不存档。卡从邮票册里来，数值全从卡上已有的东西算（稀有度、等级、卡种、
//   卡编号、卡上的字），同一张卡永远算出同一个数——以前抽的卡不用再花一次调用。
//
//   胶水（她 2026-11-07：「邮资是抽卡用的道具」，对局里另起名）：每回合的行动点，贴票、挪票、盖章都花它。
//   代码里的变量名还叫 postage，界面和日志里一律叫胶水。
//   打法：双方各一个 3×3 信封，第一排是前排（挨打），第三排是后排。每回合 3 胶水、抽 4 张，
//   花面值把票贴上去；贴上的票每回合自己行动，攒满章就能花 1 胶水「盖章」放技能。
//   五种票：投递（打同一列对面最前面那张，列里空着就打信封）、火漆（厚、给自己封一层）、补票（回血、擦邮戳）、
//   集邮（攒胶水、多抽）、邮戳（给对面盖戳）。
//   连张：同一个人两张相邻，行动时加力。整版：同一个人一整行或一整列。四方连：2×2 同一个人（或同一卡种）。
//   撕下、挪票、留牌；每局几格地形；每隔几回合一条邮局公告（提前一回合预告）。对面下一步开回合亮出来（盲打时不给看）。
(function (g) {
  "use strict";
  const SIZE = 3, SLOTS = SIZE * SIZE;
  const ENVELOPE_HP = 70, POSTAGE = 3, DRAW = 4, DECK_SIZE = 12, TURN_CAP = 20, POSTAGE_CAP = 7, KEEP_MAX = 2, MOVE_COST = 1, STAMP_COST = 1;
  const FACE = { R: 1, SR: 2, SSR: 3 };
  const BASE = { R: { pow: 3, hp: 6 }, SR: { pow: 5, hp: 9 }, SSR: { pow: 7, hp: 13 } };
  const NEED = { R: 2, SR: 3, SSR: 3 };                       // 攒几回合能盖一次章
  const ROLES = ["投递", "火漆", "补票", "集邮", "邮戳"];
  const ROLE_WEIGHT = [34, 22, 14, 14, 16];                   // 认不出字时按编号分：投递最多，火漆次之
  // 卡上的字 → 偏向哪种票（只是偏向：几样都沾上时数哪样多）
  const ROLE_WORDS = {
    投递: /拔刀|刀|剑|枪|拳|揍|打架|打|踹|吵|冲|撞|咬|怒|狠|杀|战|赢|比赛|球|跑|追/g,
    火漆: /抱|护|挡|守|撑伞|伞|外套|披|陪|等你|不走|靠|肩|背着|牵/g,
    补票: /药|伤|包扎|粥|汤|煮|喂|擦|哄|睡|休息|医|疼|热水|毯/g,
    集邮: /钱|买|攒|礼物|收藏|书|学|算|账|赚|工作|笔记|整理|信|邮票|相册/g,
    邮戳: /雨|泪|哭|夜|梦|雾|雪|冷|影|醉|酒|烟|月/g
  };
  const MARKS = {
    雨渍: { turns: 2, note: "攻击 -2" },
    退回: { turns: 1, note: "下一次行动跳过" },
    受潮: { turns: 1, note: "对面下回合胶水 -1" },
    加急: { turns: 1, note: "下一次行动做两遍" }
  };
  const MARK_OF_INK = ["雨渍", "退回", "受潮", "加急"];
  const TERRAIN = { 邮筒: "贴着票时每回合多 1 胶水", 雨棚: "上面的票不会被盖邮戳", 破损: "这一格不能贴" };
  const EVENTS = {
    涨价: "这回合贴票面值都 +1",
    大雨: "这回合所有攻击 -1",
    集邮节: "这回合集邮票效果翻倍",
    加班: "这回合多抽 1 张",
    清仓: "这回合可以撕两张"
  };
  const EVENT_KEYS = Object.keys(EVENTS), EVENT_EVERY = 3;

  function hashStr(s) { let h = 2166136261; s = String(s || ""); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pickWeighted(n, weights) { const sum = weights.reduce((a, b) => a + b, 0); let x = n % sum; for (let i = 0; i < weights.length; i++) { if (x < weights[i]) return i; x -= weights[i]; } return 0; }
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const firstOf = a => Array.isArray(a) ? clean(a.find(x => clean(x))) : "";
  const shuffle = (arr, R) => { const d = arr.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; };

  // 卡上的字认出这张票是哪种；一个都认不出就按编号
  function roleOf(card, hsh) {
    const tx = (card && card.text) || {};
    const words = [tx.name, tx.gist, tx.line, tx.narration, tx.thought, tx.highlight, tx.open].map(clean).join(" ");
    let best = "", n = 0;
    for (const r of ROLES) { const k = (words.match(ROLE_WORDS[r]) || []).length; if (k > n) { n = k; best = r; } }
    return best || ROLES[pickWeighted(hsh, ROLE_WEIGHT)];
  }
  // 一张邮票册的卡 → 一张能上场的票
  function stampOf(card) {
    const r = BASE[card && card.rarity] ? card.rarity : "R";
    const lv = Math.max(1, Number(card && card.lv) || 1), hsh = hashStr(card && card.id);
    const kind = card && card.kind ? String(card.kind) : "";
    const role = roleOf(card, hsh);
    const jit = (hsh >>> 8) % 3 - 1;
    let pow = BASE[r].pow + Math.floor(lv / 10) + jit, hp = BASE[r].hp + Math.floor(lv / 5) + ((hsh >>> 12) % 3);
    if (role === "火漆") { pow = Math.max(1, pow - 2); hp += 4; }
    if (role === "投递") pow += 1;
    const tx = (card && card.text) || {}, pk = (card && (card.pokes || card.pokesSolo || card.pokesDuo)) || {};
    return {
      cardId: card && card.id, charId: (card && card.charId) || "", rarity: r, lv, kind, limited: !!(card && card.limited),
      name: clean(tx.name) || (r + " 票"), role, face: FACE[r], pow: Math.max(1, pow), maxHp: hp, need: NEED[r],
      ink: MARK_OF_INK[(hsh >>> 16) % MARK_OF_INK.length],
      lines: {
        enter: clean(tx.line || tx.thought || tx.narration).slice(0, 80),
        wake: clean(tx.highlight || tx.line || tx.open).slice(0, 80),
        fall: (firstOf(pk.hand) || clean(tx.real || tx.thought)).slice(0, 80),
        win: firstOf(pk.heart).slice(0, 80)
      }
    };
  }
  function fillerCard(i, rarity) { return { id: "filler_" + i + "_" + rarity, rarity, lv: rarity === "R" ? 10 : 20, text: { name: rarity === "R" ? "普通邮票" : "纪念邮票" } }; }
  function deckFrom(cards, seed, size) {
    const R = rng(seed), pool = (cards || []).filter(Boolean).slice(), out = [], n = size || DECK_SIZE;
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    for (let i = 0; out.length < n; i++) out.push(fillerCard(i, i % 3 === 2 ? "SR" : "R"));
    return out.map(stampOf);
  }
  // 对面 B：B 自己的卡在前，再拿跟 B 关系近的人的卡（close 由调用处照关系排好）
  function foeDeckFrom(cards, foeId, close, seed) {
    const all = (cards || []).filter(Boolean), own = all.filter(c => String(c.charId) === String(foeId));
    const near = (close || []).flatMap(id => all.filter(c => String(c.charId) === String(id)));
    const R = rng(seed ^ 0x9e3779b9), pick = (arr, k) => { const p = arr.slice(), o = []; while (o.length < k && p.length) o.push(p.splice(Math.floor(R() * p.length), 1)[0]); return o; };
    const mine = pick(own, DECK_SIZE), rest = pick(near.filter(c => !mine.includes(c)), DECK_SIZE - mine.length);
    return deckFrom(mine.concat(rest), seed ^ 0x51ed, DECK_SIZE);
  }

  const col = i => i % SIZE, row = i => Math.floor(i / SIZE);
  const adj = i => [i - SIZE, i + SIZE, col(i) > 0 ? i - 1 : -1, col(i) < SIZE - 1 ? i + 1 : -1].filter(j => j >= 0 && j < SLOTS);
  const other = who => who === "me" ? "foe" : "me";
  const say = (st, who, text, extra) => st.log.push(Object.assign({ turn: st.turn, who, text }, extra || {}));

  function terrainFor(seed) {
    const R = rng(seed), cells = shuffle([...Array(SLOTS).keys()], R), t = new Array(SLOTS).fill("");
    t[cells[0]] = "邮筒"; t[cells[1]] = "雨棚"; if (R() < 0.6) t[cells[2]] = "破损";
    return t;
  }
  function side(deck, seed) {
    return { hp: ENVELOPE_HP, board: new Array(SLOTS).fill(null), terrain: terrainFor(seed ^ 0x7777), draw: shuffle(deck, rng(seed)), discard: [], hand: [], kept: [],
      postage: 0, bonusPostage: 0, bonusDraw: 0, owed: 0, torn: 0, woke: {} };
  }
  // opts.blind：盲打——对面照样提前算好下一步，只是界面不给看（这一层照常算 intent，给不给看是界面的事）
  function newDuel(meDeck, foeDeck, seed, opts) {
    const s = (seed >>> 0) || 1, R = rng(s ^ 0x2468);
    const events = []; for (let t = EVENT_EVERY; t <= TURN_CAP; t += EVENT_EVERY) events[t] = EVENT_KEYS[Math.floor(R() * EVENT_KEYS.length)];
    const st = { turn: 0, me: side(meDeck, s), foe: side(foeDeck, s ^ 0xabcdef), log: [], over: null, uid: 0, seed: s, blind: !!(opts && opts.blind), events };
    startTurn(st);
    return st;
  }
  const eventNow = st => st.events[st.turn] || "";
  const eventNext = st => st.events[st.turn + 1] || "";
  const faceNow = (st, s) => s.face + (eventNow(st) === "涨价" ? 1 : 0);
  const tearCap = st => eventNow(st) === "清仓" ? 2 : 1;

  function drawCards(sd, n, seed) {
    for (let k = 0; k < n; k++) {
      if (!sd.draw.length) { if (!sd.discard.length) break; sd.draw = shuffle(sd.discard.splice(0), rng(seed + k)); }
      sd.hand.push(sd.draw.shift());
    }
  }
  function startTurn(st) {
    st.turn++;
    for (const who of ["me", "foe"]) {
      const sd = st[who];
      // 留牌：勾了的留在手里，别的进弃牌堆
      const keep = new Set(sd.kept), stay = [];
      sd.hand.forEach((s, k) => (keep.has(k) && stay.length < KEEP_MAX ? stay : sd.discard).push(s));
      sd.hand = stay; sd.kept = [];
      const box = sd.board.some((u, i) => u && sd.terrain[i] === "邮筒") ? 1 : 0;
      sd.postage = Math.max(0, Math.min(POSTAGE_CAP, POSTAGE + box + sd.bonusPostage - sd.owed));
      drawCards(sd, DRAW + sd.bonusDraw + (eventNow(st) === "加班" ? 1 : 0), st.seed + st.turn * 31 + (who === "me" ? 0 : 7));
      sd.bonusPostage = 0; sd.bonusDraw = 0; sd.owed = 0; sd.torn = 0;
    }
    if (eventNow(st)) say(st, "", "邮局公告：" + eventNow(st) + "——" + EVENTS[eventNow(st)], { kind: "event", ev: eventNow(st) });
    st.intent = planFoe(st);
  }

  // 放错了能退（她 2026-11-07：「回合结束前放错了可以取消不扣胶水」）：她每做一步之前存一份，
  //   「撤回」退回上一步（胶水、手牌、信封、对面挨的打都一起回去）；按「寄出」就清掉，寄出去的退不回来
  const SNAP_KEYS = ["me", "foe", "log", "uid", "over"];
  function snap(st) { st.undo = st.undo || []; st.undo.push(JSON.stringify(SNAP_KEYS.reduce((o, k) => (o[k] = st[k], o), {}))); }
  function undo(st) {
    if (!st.undo || !st.undo.length) return { ok: false, why: "没有可以撤回的" };
    const o = JSON.parse(st.undo.pop()); SNAP_KEYS.forEach(k => { st[k] = o[k]; });
    return { ok: true };
  }
  const canUndo = st => !!(st && st.undo && st.undo.length);
  // ── 她手上能做的事：贴、撕、挪、盖章、留牌 ─────────────────────────
  function placeRaw(st, who, handIdx, slot) {
    const sd = st[who], s = sd.hand[handIdx];
    if (st.over || !s) return { ok: false, why: "没有这张" };
    if (slot < 0 || slot >= SLOTS || sd.board[slot]) return { ok: false, why: "这一格已经贴了" };
    if (sd.terrain[slot] === "破损") return { ok: false, why: "这一格破了，贴不上" };
    const cost = faceNow(st, s); if (sd.postage < cost) return { ok: false, why: "胶水不够" };
    sd.postage -= cost; sd.hand.splice(handIdx, 1); sd.kept = sd.kept.filter(k => k !== handIdx).map(k => k > handIdx ? k - 1 : k);
    const u = Object.assign({}, s, { uid: ++st.uid, hp: s.maxHp, shield: 0, marks: {}, first: true, charge: 0 });
    if (u.kind === "bday") u.shield += 3;
    if (u.kind === "anniv" || u.kind === "mybday") sd.bonusPostage += 1;
    if (u.role === "集邮") sd.bonusDraw += 1;
    sd.board[slot] = u;
    say(st, who, u.name + " 贴上了", { kind: "place", slot, line: u.lines.enter });
    checkCombos(st, who);
    return { ok: true };
  }
  function tearRaw(st, who, slot) {
    const sd = st[who], u = sd.board[slot], foe = st[other(who)];
    if (st.over || !u) return { ok: false, why: "这一格是空的" };
    if (sd.torn >= tearCap(st)) return { ok: false, why: "这回合撕够了" };
    sd.board[slot] = null; sd.discard.push(stripUnit(u)); sd.torn++;
    const k = u.limited ? 2 : 1;
    if (u.role === "投递") hitEnvelope(st, other(who), u.pow * k, u.name + " 撕下");
    else if (u.role === "火漆") sd.board.forEach(x => { if (x) x.shield += 2 * k; });
    else if (u.role === "补票") sd.hp = Math.min(ENVELOPE_HP, sd.hp + 4 * k);
    else if (u.role === "集邮") sd.postage += 2 * k;
    else if (u.role === "邮戳") foe.board.forEach((x, i) => { if (x && col(i) === col(slot)) mark(foe, i, u.ink); });
    say(st, who, u.name + " 被撕下", { kind: "tear", slot });
    checkOver(st);
    return { ok: true };
  }
  function moveRaw(st, who, from, to) {
    const sd = st[who], u = sd.board[from];
    if (st.over || !u) return { ok: false, why: "这一格是空的" };
    if (!adj(from).includes(to) || sd.board[to]) return { ok: false, why: "只能挪到旁边的空格" };
    if (sd.terrain[to] === "破损") return { ok: false, why: "那一格破了" };
    if (sd.postage < MOVE_COST) return { ok: false, why: "胶水不够" };
    sd.postage -= MOVE_COST; sd.board[to] = u; sd.board[from] = null;
    say(st, who, u.name + " 挪了位置", { kind: "move", from, to });
    checkCombos(st, who);
    return { ok: true };
  }
  function keepRaw(st, who, handIdx) {
    const sd = st[who]; if (!sd.hand[handIdx]) return { ok: false, why: "没有这张" };
    if (sd.kept.includes(handIdx)) { sd.kept = sd.kept.filter(k => k !== handIdx); return { ok: true, kept: false }; }
    if (sd.kept.length >= KEEP_MAX) return { ok: false, why: "最多留 " + KEEP_MAX + " 张" };
    sd.kept.push(handIdx); return { ok: true, kept: true };
  }
  // 盖章：章攒满了，花 1 胶水放这张票的技能；R 简单、SR 强一点、SSR 是专属大招（名字就是卡名）
  function stampRaw(st, who, slot) {
    const sd = st[who], foeWho = other(who), foe = st[foeWho], u = sd.board[slot];
    if (st.over || !u) return { ok: false, why: "这一格是空的" };
    if (u.charge < u.need) return { ok: false, why: "章还没攒满" };
    if (sd.postage < STAMP_COST) return { ok: false, why: "胶水不够" };
    sd.postage -= STAMP_COST; u.charge = 0;
    const p = powOf(st, u, sd, slot), tier = u.rarity;
    say(st, who, "盖章：" + u.name, { kind: "stamp", slot, line: tier === "SSR" ? u.lines.wake : "" });
    const c = col(slot), foeCol = [0, 1, 2].map(r => r * SIZE + c).filter(i => foe.board[i]);
    if (u.role === "投递") {
      if (tier === "SSR") hitEnvelope(st, foeWho, p + 4, u.name);
      else if (tier === "SR") foeCol.forEach(i => hitUnit(st, foeWho, i, p, u.name));
      else { const j = targetIn(foe, c); if (j >= 0) hitUnit(st, foeWho, j, p * 2, u.name); else hitEnvelope(st, foeWho, p + 2, u.name); }
    } else if (u.role === "火漆") {
      const who2 = tier === "SSR" ? sd.board.map((x, i) => i) : tier === "SR" ? [0, 1, 2].map(k => row(slot) * SIZE + k) : [slot];
      who2.forEach(i => { if (sd.board[i]) sd.board[i].shield += tier === "R" ? p * 2 : p; });
    } else if (u.role === "补票") {
      const all = sd.board.filter(Boolean);
      if (tier === "SSR") all.forEach(x => { x.hp = x.maxHp; x.marks = {}; });
      else if (tier === "SR") all.forEach(x => { x.hp = Math.min(x.maxHp, x.hp + 4); });
      else { const w = all.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (w) w.hp = w.maxHp; }
    } else if (u.role === "集邮") {
      const k = eventNow(st) === "集邮节" ? 2 : 1;
      if (tier !== "SR") sd.postage += 2 * k;
      if (tier !== "R") drawCards(sd, 2 * k, st.seed + st.turn * 13 + slot);
      if (tier === "SSR") adj(slot).forEach(i => { if (sd.board[i]) sd.board[i].charge++; });
    } else if (u.role === "邮戳") {
      const ts = tier === "SSR" ? foe.board.map((x, i) => i) : tier === "SR" ? foeCol : [targetIn(foe, c)];
      ts.forEach(i => { if (i >= 0 && foe.board[i]) mark(foe, i, u.ink === "加急" ? "退回" : u.ink); });
    }
    checkOver(st);
    return { ok: true };
  }
  const stripUnit = u => { const o = Object.assign({}, u); ["uid", "hp", "shield", "marks", "first", "charge"].forEach(k => delete o[k]); return o; };
  function mark(sd, i, m) { const u = sd.board[i]; if (!u || !MARKS[m]) return; if (MARKS[m] !== MARKS.加急 && sd.terrain[i] === "雨棚") return; u.marks[m] = MARKS[m].turns; }

  // ── 连招：四方连（2×2）、整版（一整行/列），各觉醒一次 ────────────
  function combos(board) {
    const out = [], same = us => us.every(u => u) && ((us[0].charId && us.every(u => u.charId === us[0].charId)) || (us[0].kind && us.every(u => u.kind === us[0].kind)));
    for (let r = 0; r < SIZE - 1; r++) for (let c = 0; c < SIZE - 1; c++) {
      const ids = [r * SIZE + c, r * SIZE + c + 1, (r + 1) * SIZE + c, (r + 1) * SIZE + c + 1], us = ids.map(i => board[i]);
      if (same(us)) out.push({ type: "四方连", ids, us });
    }
    for (let k = 0; k < SIZE; k++) {
      const rowIds = [0, 1, 2].map(c => k * SIZE + c), colIds = [0, 1, 2].map(r => r * SIZE + k);
      for (const ids of [rowIds, colIds]) { const us = ids.map(i => board[i]); if (us.every(u => u) && us[0].charId && us.every(u => u.charId === us[0].charId)) out.push({ type: "整版", ids, us }); }
    }
    // 同一个人（或同一卡种）的同一种连招，一局只觉醒一次——不然掉一张补一张就能反复刷
    return out.map(x => Object.assign(x, { key: x.type + ":" + (x.us[0].charId && x.us.every(u => u.charId === x.us[0].charId) ? "c" + x.us[0].charId : "k" + x.us[0].kind) }));
  }
  function checkCombos(st, who) {
    const sd = st[who];
    for (const cb of combos(sd.board)) {
      if (sd.woke[cb.key]) continue;
      sd.woke[cb.key] = 1;
      const lead = cb.us.slice().sort((a, b) => b.pow - a.pow)[0], sum = cb.us.reduce((a, u) => a + u.pow, 0);
      if (cb.type === "四方连") { cb.us.forEach(u => { u.shield += 3; }); hitEnvelope(st, other(who), Math.ceil(sum / 3), lead.name); }
      else { cb.us.forEach(u => { u.charge++; }); hitEnvelope(st, other(who), Math.ceil(sum / 4), lead.name); }
      say(st, who, cb.type + "觉醒：" + lead.name, { kind: "wake", combo: cb.type, line: lead.lines.wake, slots: cb.ids });
      if (checkOver(st)) return;
    }
  }

  // ── 结算 ───────────────────────────────────────────────────────
  function powOf(st, u, sd, i) {
    let p = u.pow + (u.marks.雨渍 ? -2 : 0) + (eventNow(st) === "大雨" ? -1 : 0);
    if (adj(i).some(j => sd.board[j] && u.charId && sd.board[j].charId === u.charId)) p += 2;          // 连张
    if (row(i) === SIZE - 1 && (u.role === "投递" || u.role === "邮戳")) p += 2;                          // 后排输出
    if (u.first && u.kind === "if") p *= 2;                                                              // IF 卡第一次做双份
    return Math.max(0, p);
  }
  // 打同一列：从前排往后找第一张——后排只要前面有人就挨不着
  function targetIn(sd, c) { for (let r = 0; r < SIZE; r++) { const i = r * SIZE + c; if (sd.board[i]) return i; } return -1; }
  function hitEnvelope(st, who, n, by) { if (n <= 0) return; st[who].hp -= n; say(st, other(who), (by || "") + " 打到信封 " + n, { kind: "hitEnv", n }); }
  function hitUnit(st, who, i, n, by) {
    const sd = st[who], u = sd.board[i]; if (!u || n <= 0) return;
    const blocked = Math.min(u.shield, n); u.shield -= blocked; u.hp -= (n - blocked);
    say(st, other(who), by + " 打 " + u.name + " " + n, { kind: "hit", slot: i, n, blocked });
    if (u.hp <= 0) { sd.board[i] = null; sd.discard.push(stripUnit(u)); say(st, who, u.name + " 掉了", { kind: "fall", slot: i, line: u.lines.fall }); }
  }
  function act(st, who, i) {
    const sd = st[who], foeWho = other(who), foe = st[foeWho], u = sd.board[i]; if (!u) return;
    if (u.marks.退回) { say(st, who, u.name + " 被退回，这回合不动", { kind: "skip", slot: i }); return; }
    const times = u.marks.加急 ? 2 : 1;
    for (let t = 0; t < times && sd.board[i] === u; t++) {
      const p = powOf(st, u, sd, i), j = targetIn(foe, col(i));
      if (u.role === "投递") { if (j >= 0) hitUnit(st, foeWho, j, p, u.name); else hitEnvelope(st, foeWho, p, u.name); }
      else if (u.role === "火漆") { u.shield += Math.max(1, Math.ceil(p / 2)); if (j >= 0) hitUnit(st, foeWho, j, Math.floor(p / 2), u.name); }
      else if (u.role === "补票") {
        const hurt = sd.board.filter(x => x && x.hp < x.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (hurt) hurt.hp = Math.min(hurt.maxHp, hurt.hp + Math.max(2, Math.ceil(p / 2))); else sd.hp = Math.min(ENVELOPE_HP, sd.hp + 2);
        const dirty = sd.board.find(x => x && (x.marks.雨渍 || x.marks.退回)); if (dirty) { delete dirty.marks.雨渍; delete dirty.marks.退回; }
        say(st, who, u.name + " 补了一下", { kind: "heal", slot: i });
      }
      else if (u.role === "集邮") { sd.bonusPostage += eventNow(st) === "集邮节" ? 2 : 1; say(st, who, u.name + " 攒了胶水", { kind: "gain", slot: i }); }
      else if (u.role === "邮戳") {
        if (u.ink === "加急") { const k = adj(i).find(x => sd.board[x] && sd.board[x].role === "投递"); if (k != null) sd.board[k].marks.加急 = 1; }
        else if (u.ink === "受潮") foe.owed = Math.min(2, foe.owed + 1);
        else if (j >= 0) mark(foe, j, u.ink); else hitEnvelope(st, foeWho, Math.ceil(p / 2), u.name);
        say(st, who, u.name + " 盖了「" + u.ink + "」", { kind: "ink", slot: i, ink: u.ink });
      }
      if (checkOver(st)) return;
    }
    u.first = false;
    if (u.charge < u.need) u.charge++;
  }
  function tickMarks(sd) { sd.board.forEach(u => { if (!u) return; Object.keys(u.marks).forEach(m => { if (--u.marks[m] <= 0) delete u.marks[m]; }); }); }
  function resolveSide(st, who) { for (let i = 0; i < SLOTS && !st.over; i++) act(st, who, i); tickMarks(st[who]); }
  function checkOver(st) {
    if (st.over) return true;
    const a = st.me.hp <= 0, b = st.foe.hp <= 0;
    if (a || b) st.over = { winner: a && b ? "draw" : a ? "foe" : "me", turn: st.turn, me: Math.max(0, st.me.hp), foe: Math.max(0, st.foe.hp) };
    return !!st.over;
  }

  // ── 对面怎么出：代码定，不花调用；开回合就算好（盲打时界面不给看）──────
  function planFoe(st) {
    const sd = st.foe, me = st.me, plan = [], stamps = [], board = sd.board.slice();
    let money = sd.postage;
    const meThreat = c => { let n = 0; for (let r = 0; r < SIZE; r++) { const u = me.board[r * SIZE + c]; if (u && (u.role === "投递" || u.role === "邮戳")) n += u.pow; } return n; };
    // 先盖攒满的章（投递、邮戳的大招最值）
    sd.board.forEach((u, i) => { if (u && u.charge >= u.need && money >= STAMP_COST && (u.role === "投递" || u.role === "邮戳" || u.rarity === "SSR")) { money -= STAMP_COST; stamps.push({ slot: i, name: u.name, role: u.role }); } });
    const hand = sd.hand.map((s, k) => ({ s, k })).sort((a, b) => b.s.face - a.s.face || b.s.pow - a.s.pow);
    for (const { s, k } of hand) {
      const cost = faceNow(st, s); if (cost > money) continue;
      const free = board.map((x, i) => x || sd.terrain[i] === "破损" ? -1 : i).filter(i => i >= 0); if (!free.length) break;
      const score = i => (s.role === "火漆" ? meThreat(col(i)) * 3 + (row(i) === 0 ? 6 : 0) : 0)
        + ((s.role === "投递" || s.role === "邮戳") ? (row(i) === SIZE - 1 && board[col(i)] ? 5 : 0) + (targetIn(me, col(i)) < 0 ? 3 : 0) : 0)
        + adj(i).filter(j => board[j] && board[j].charId && board[j].charId === s.charId).length * 4
        + (sd.terrain[i] === "邮筒" ? 2 : 0) - row(i) * 0.1;
      const slot = free.sort((a, b) => score(b) - score(a))[0];
      board[slot] = s; money -= cost; plan.push({ handIdx: k, slot, name: s.name, role: s.role, face: cost, cardId: s.cardId, charId: s.charId });
    }
    let toEnv = 0; const inks = [];
    board.forEach((u, i) => { if (!u) return; if (u.role === "投递" && targetIn(me, col(i)) < 0) toEnv += u.pow; if (u.role === "邮戳") inks.push(u.ink); });
    return { place: plan, stamp: stamps, toEnvelope: toEnv, inks, nextEvent: eventNext(st) };
  }
  function runFoePlan(st) {
    const it = st.intent || {};
    for (const s of it.stamp || []) { stamp(st, "foe", s.slot); if (st.over) return; }
    // 按卡认（她撤回过的话手牌是存档里还原的新对象，认不得原来那个）
    for (const p of it.place || []) { const k = st.foe.hand.findIndex(x => x && x.cardId === p.cardId); if (k >= 0) place(st, "foe", k, p.slot); if (st.over) return; }
  }

  // 她按「寄出」：她的票先动，然后对面照亮出来的那一步盖章、贴票、行动，再开下一回合
  function endTurn(st) {
    if (st.over) return st;
    st.undo = [];
    resolveSide(st, "me");
    if (!st.over) { runFoePlan(st); if (!st.over) resolveSide(st, "foe"); }
    if (!st.over && st.turn >= TURN_CAP) st.over = { winner: st.me.hp === st.foe.hp ? "draw" : st.me.hp > st.foe.hp ? "me" : "foe", turn: st.turn, me: st.me.hp, foe: st.foe.hp, byCap: true };
    if (!st.over) startTurn(st);
    return st;
  }

  // 连打几把（她 2026-11-07：「打完一把选结束还是继续下一把，结束了才选进不进聊天，玩三把再全部进记忆」）：
  //   一把打完记进这一串；她点「结束」时才拿 memoryLine 出一句总的，记不记、记到哪由调用处决定
  function newSeries() { return { games: [] }; }
  function addGame(series, st) {
    const o = st && st.over; if (!series || !o) return series;
    series.games.push({ winner: o.winner, turn: o.turn, me: o.me, foe: o.foe, byCap: !!o.byCap });
    return series;
  }
  // 给一串（或单独一把）出一句话
  function memoryLine(x, foeName, meName) {
    const games = x && Array.isArray(x.games) ? x.games : x && x.over ? [x.over] : [];
    if (!games.length) return "";
    const who = foeName || "TA", me = meName || "她";
    const win = games.filter(o => o.winner === "me").length, lose = games.filter(o => o.winner === "foe").length, draw = games.length - win - lose;
    if (games.length === 1) {
      const o = games[0], res = o.winner === "draw" ? "打平了" : o.winner === "me" ? me + "赢了" : who + "赢了";
      return who + "和" + me + "用邮票册的卡打了一局对局，" + res + "（" + o.turn + " 回合，信封剩 " + o.me + " : " + o.foe + "）。";
    }
    const last = games[games.length - 1], lastRes = last.winner === "draw" ? "打平" : last.winner === "me" ? me + "赢" : who + "赢";
    return who + "和" + me + "用邮票册的卡连打了 " + games.length + " 局对局，" + me + " " + win + " 胜 " + lose + " 负" + (draw ? " " + draw + " 平" : "") + "，最后一局" + lastRes + "。";
  }

  // 她那边的动作先存一份再做；做不成就把那份扔掉（不留空撤回）
  const mine = raw => (st, who, a, b) => { if (who !== "me") return raw(st, who, a, b); snap(st); const r = raw(st, who, a, b); if (!r || !r.ok) st.undo.pop(); return r; };
  const place = mine(placeRaw), tear = mine(tearRaw), move = mine(moveRaw), keep = mine(keepRaw), stamp = mine(stampRaw);
  const API = { SIZE, SLOTS, ENVELOPE_HP, POSTAGE, DRAW, DECK_SIZE, TURN_CAP, KEEP_MAX, FACE, NEED, ROLES, MARKS, TERRAIN, EVENTS,
    stampOf, deckFrom, foeDeckFrom, newDuel, place, tear, move, keep, stamp, undo, canUndo, endTurn, planFoe, combos, newSeries, addGame, memoryLine, hashStr };
  g.StampDuel = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
