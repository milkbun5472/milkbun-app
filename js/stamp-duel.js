// 邮票对局（她 2026-11-07 定：「先做对局，要亮出下一步，可以结束选择记不记得，先搭玩法后面再弄 UI」）
//   这一份只有规则：不碰界面、不调模型、不存档。卡从邮票册里来，数值全从卡上已有的东西算（稀有度、等级、卡种、
//   卡编号），同一张卡永远算出同一个数——以前抽的卡不用再花一次调用。
//
//   打法：双方各一个 3×3 信封。每回合 3 邮资、抽 4 张，花面值把票贴上去；贴上的票每回合自己行动。
//   五种票：锋（打同一列对面那张，列里空着就打信封）、护（厚、给自己加护）、润（回血、擦掉邮戳）、
//   引（多给邮资、多抽）、印（给对面同一列盖邮戳）。
//   连张：同一个人的两张相邻，行动时互相加力。四方连：2×2 四张同一个人（或同一卡种），觉醒一次。
//   撕下：每回合可撕一张自己的票，触发一次撕下效果。对面下一步提前亮出来（intent）。
(function (g) {
  "use strict";
  const SIZE = 3, SLOTS = SIZE * SIZE;
  const ENVELOPE_HP = 50, POSTAGE = 3, DRAW = 4, DECK_SIZE = 12, TURN_CAP = 20, POSTAGE_CAP = 6;
  const FACE = { R: 1, SR: 2, SSR: 3 };
  const BASE = { R: { pow: 3, hp: 6 }, SR: { pow: 5, hp: 9 }, SSR: { pow: 7, hp: 13 } };
  const ROLES = ["锋", "护", "润", "引", "印"];
  // 五种票的分布：锋最多，护次之——不然一场打不完
  const ROLE_WEIGHT = [34, 22, 14, 14, 16];
  const MARKS = {
    雨渍: { zh: "雨渍", foe: true, turns: 2, note: "攻击 -2" },
    退回: { zh: "退回", foe: true, turns: 1, note: "下一次行动跳过" },
    欠资: { zh: "欠资", foe: true, turns: 1, note: "对面下回合邮资 -1" },
    加急: { zh: "加急", foe: false, turns: 1, note: "下一次行动做两遍" }
  };
  const MARK_OF_INK = ["雨渍", "退回", "欠资", "加急"];

  // 卡编号 → 固定的数（同一张卡永远一样）
  function hashStr(s) { let h = 2166136261; s = String(s || ""); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pickWeighted(n, weights) { const sum = weights.reduce((a, b) => a + b, 0); let x = n % sum; for (let i = 0; i < weights.length; i++) { if (x < weights[i]) return i; x -= weights[i]; } return 0; }
  const clean = s => String(s || "").replace(/\s+/g, " ").trim();
  const firstOf = a => Array.isArray(a) ? clean(a.find(x => clean(x))) : "";

  // 一张邮票册的卡 → 一张能上场的票
  function stampOf(card) {
    const r = BASE[card && card.rarity] ? card.rarity : "R";
    const lv = Math.max(1, Number(card && card.lv) || 1), hsh = hashStr(card && card.id);
    const kind = card && card.kind ? String(card.kind) : "";
    const role = ROLES[pickWeighted(hsh, ROLE_WEIGHT)];
    const jit = (hsh >>> 8) % 3 - 1;                       // -1 / 0 / +1
    let pow = BASE[r].pow + Math.floor(lv / 10) + jit, hp = BASE[r].hp + Math.floor(lv / 5) + ((hsh >>> 12) % 3);
    if (role === "护") { pow = Math.max(1, pow - 2); hp += 4; }
    if (role === "锋") pow += 1;
    const tx = (card && card.text) || {}, pk = (card && (card.pokes || card.pokesSolo || card.pokesDuo)) || {};
    return {
      cardId: card && card.id, charId: (card && card.charId) || "", rarity: r, lv, kind, limited: !!(card && card.limited),
      name: clean(tx.name) || (r + " 票"), role, face: FACE[r], pow: Math.max(1, pow), maxHp: hp,
      ink: MARK_OF_INK[(hsh >>> 16) % MARK_OF_INK.length],
      lines: {
        enter: clean(tx.line || tx.thought || tx.narration).slice(0, 80),
        wake: clean(tx.highlight || tx.line || tx.open).slice(0, 80),
        fall: (firstOf(pk.hand) || clean(tx.real || tx.thought)).slice(0, 80),
        win: firstOf(pk.heart).slice(0, 80)
      }
    };
  }
  // 卡组不够数时补的通用票：没有人、没有台词
  function fillerCard(i, rarity) { return { id: "filler_" + i + "_" + rarity, rarity, lv: rarity === "R" ? 10 : 20, text: { name: rarity === "R" ? "普通邮票" : "纪念邮票" } }; }

  // 随机抽牌组卡组：每局从收藏里抽，谁都有机会上场
  function deckFrom(cards, seed, size) {
    const R = rng(seed), pool = (cards || []).filter(Boolean).slice(), out = [], n = size || DECK_SIZE;
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
    for (let i = 0; out.length < n; i++) out.push(fillerCard(i, i % 3 === 2 ? "SR" : "R"));
    return out.map(stampOf);
  }
  // 对面 B 的卡组：B 自己的卡在前，再拿跟 B 关系近的人的卡（close 是排好先后的 charId 列表，由调用处照关系给）
  function foeDeckFrom(cards, foeId, close, seed) {
    const all = (cards || []).filter(Boolean), own = all.filter(c => String(c.charId) === String(foeId));
    const near = (close || []).flatMap(id => all.filter(c => String(c.charId) === String(id)));
    const R = rng(seed ^ 0x9e3779b9), pick = (arr, k) => { const p = arr.slice(), o = []; while (o.length < k && p.length) o.push(p.splice(Math.floor(R() * p.length), 1)[0]); return o; };
    const mine = pick(own, DECK_SIZE), rest = pick(near.filter(c => !mine.includes(c)), DECK_SIZE - mine.length);
    return deckFrom(mine.concat(rest), seed ^ 0x51ed, DECK_SIZE);
  }

  function side(deck, seed) {
    const R = rng(seed), d = deck.slice();
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    return { hp: ENVELOPE_HP, board: new Array(SLOTS).fill(null), draw: d, discard: [], hand: [], postage: 0, bonusPostage: 0, bonusDraw: 0, owed: 0, tornThisTurn: false, woke: {}, seed: seed };
  }
  function newDuel(meDeck, foeDeck, seed) {
    const s = (seed >>> 0) || 1;
    const st = { turn: 0, me: side(meDeck, s), foe: side(foeDeck, s ^ 0xabcdef), log: [], over: null, uid: 0, seed: s };
    startTurn(st);
    return st;
  }

  const col = i => i % SIZE, row = i => Math.floor(i / SIZE);
  const adj = i => [i - SIZE, i + SIZE, col(i) > 0 ? i - 1 : -1, col(i) < SIZE - 1 ? i + 1 : -1].filter(j => j >= 0 && j < SLOTS);
  const say = (st, who, text, extra) => st.log.push(Object.assign({ turn: st.turn, who, text }, extra || {}));
  const other = who => who === "me" ? "foe" : "me";

  function drawCards(sd, n, seed) {
    for (let k = 0; k < n; k++) {
      if (!sd.draw.length) {
        if (!sd.discard.length) break;
        const R = rng(seed + k), d = sd.discard.splice(0);
        for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
        sd.draw = d;
      }
      sd.hand.push(sd.draw.shift());
    }
  }
  function startTurn(st) {
    st.turn++;
    for (const who of ["me", "foe"]) {
      const sd = st[who];
      sd.discard.push(...sd.hand.splice(0));
      sd.postage = Math.max(0, Math.min(POSTAGE_CAP, POSTAGE + sd.bonusPostage - sd.owed));
      drawCards(sd, DRAW + sd.bonusDraw, st.seed + st.turn * 31 + (who === "me" ? 0 : 7));
      sd.bonusPostage = 0; sd.bonusDraw = 0; sd.owed = 0; sd.tornThisTurn = false;
    }
    st.intent = planFoe(st);
  }

  // ── 贴 / 撕（她这一回合手上做的事）────────────────────────────────
  function place(st, who, handIdx, slot) {
    const sd = st[who], s = sd.hand[handIdx];
    if (st.over || !s) return { ok: false, why: "没有这张" };
    if (slot < 0 || slot >= SLOTS || sd.board[slot]) return { ok: false, why: "这一格已经贴了" };
    if (sd.postage < s.face) return { ok: false, why: "邮资不够" };
    sd.postage -= s.face; sd.hand.splice(handIdx, 1);
    const u = Object.assign({}, s, { uid: ++st.uid, hp: s.maxHp, shield: 0, marks: {}, first: true });
    if (u.kind === "bday") u.shield += 3;                                         // 生日卡：贴上就带一层护
    if (u.kind === "anniv" || u.kind === "mybday") sd.bonusPostage += 1;          // 纪念日、她的生日卡：下回合多 1 邮资
    if (u.role === "引") { sd.bonusDraw += 1; }
    sd.board[slot] = u;
    say(st, who, u.name + " 贴上了", { kind: "place", slot, line: u.lines.enter });
    checkSquares(st, who);
    return { ok: true };
  }
  function tear(st, who, slot) {
    const sd = st[who], u = sd.board[slot], foe = st[other(who)];
    if (st.over || !u) return { ok: false, why: "这一格是空的" };
    if (sd.tornThisTurn) return { ok: false, why: "这回合已经撕过一张了" };
    sd.board[slot] = null; sd.discard.push(stripUnit(u)); sd.tornThisTurn = true;
    const k = u.limited ? 2 : 1;
    if (u.role === "锋") hitEnvelope(st, other(who), u.pow * k, u.name + " 撕下");
    else if (u.role === "护") sd.board.forEach(x => { if (x) x.shield += 2 * k; });
    else if (u.role === "润") sd.hp = Math.min(ENVELOPE_HP, sd.hp + 4 * k);
    else if (u.role === "引") sd.postage += 2 * k;
    else if (u.role === "印") foe.board.forEach((x, i) => { if (x && col(i) === col(slot)) mark(x, u.ink); });
    say(st, who, u.name + " 被撕下", { kind: "tear", slot });
    checkOver(st);
    return { ok: true };
  }
  const stripUnit = u => { const o = Object.assign({}, u); ["uid", "hp", "shield", "marks", "first"].forEach(k => delete o[k]); return o; };
  function mark(u, m) { const M = MARKS[m]; if (M) u.marks[m] = M.turns; }

  // ── 四方连：2×2 四张同一个人（或同一卡种，普通卡不算）────────────
  function squares(board) {
    const out = [];
    for (let r = 0; r < SIZE - 1; r++) for (let c = 0; c < SIZE - 1; c++) {
      const ids = [r * SIZE + c, r * SIZE + c + 1, (r + 1) * SIZE + c, (r + 1) * SIZE + c + 1], us = ids.map(i => board[i]);
      if (us.some(u => !u)) continue;
      const sameChar = us[0].charId && us.every(u => u.charId === us[0].charId);
      const sameKind = us[0].kind && us.every(u => u.kind === us[0].kind);
      if (sameChar || sameKind) out.push({ ids, key: us.map(u => u.uid).sort().join(","), us });
    }
    return out;
  }
  function checkSquares(st, who) {
    const sd = st[who];
    for (const sq of squares(sd.board)) {
      if (sd.woke[sq.key]) continue;
      sd.woke[sq.key] = 1;
      const lead = sq.us.slice().sort((a, b) => b.pow - a.pow)[0];
      const dmg = Math.ceil(sq.us.reduce((a, u) => a + u.pow, 0) / 2);
      sq.us.forEach(u => { u.shield += 3; });
      say(st, who, "四方连觉醒：" + lead.name, { kind: "wake", line: lead.lines.wake, slots: sq.ids });
      hitEnvelope(st, other(who), dmg, lead.name);
    }
    checkOver(st);
  }

  // ── 结算：贴着的票按格子顺序行动 ─────────────────────────────────
  function powOf(u, sd, i) {
    let p = u.pow + (u.marks.雨渍 ? -2 : 0);
    if (adj(i).some(j => sd.board[j] && u.charId && sd.board[j].charId === u.charId)) p += 2;   // 连张
    if (u.first && u.kind === "if") p *= 2;                                                     // IF 卡：第一次行动做双份
    return Math.max(0, p);
  }
  function targetIn(foeSd, c) { for (let r = 0; r < SIZE; r++) { const i = r * SIZE + c; if (foeSd.board[i]) return i; } return -1; }
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
      const p = powOf(u, sd, i);
      if (u.role === "锋") { const j = targetIn(foe, col(i)); if (j >= 0) hitUnit(st, foeWho, j, p, u.name); else hitEnvelope(st, foeWho, p, u.name); }
      else if (u.role === "护") { u.shield += Math.max(1, Math.ceil(p / 2)); const j = targetIn(foe, col(i)); if (j >= 0) hitUnit(st, foeWho, j, Math.floor(p / 2), u.name); }
      else if (u.role === "润") {
        const hurt = sd.board.map((x, k) => [x, k]).filter(([x]) => x && x.hp < x.maxHp).sort((a, b) => a[0].hp / a[0].maxHp - b[0].hp / b[0].maxHp)[0];
        if (hurt) hurt[0].hp = Math.min(hurt[0].maxHp, hurt[0].hp + Math.max(2, Math.ceil(p / 2))); else sd.hp = Math.min(ENVELOPE_HP, sd.hp + 2);
        const dirty = sd.board.find(x => x && (x.marks.雨渍 || x.marks.退回)); if (dirty) { delete dirty.marks.雨渍; delete dirty.marks.退回; }
        say(st, who, u.name + " 润了一下", { kind: "heal", slot: i });
      }
      else if (u.role === "引") { sd.bonusPostage += 1; if (t === 0 && (u.rarity === "SSR")) sd.bonusDraw += 1; say(st, who, u.name + " 引来邮资", { kind: "gain", slot: i }); }
      else if (u.role === "印") {
        if (u.ink === "加急") { const j = adj(i).find(k => sd.board[k] && sd.board[k].role === "锋") ; if (j != null) mark(sd.board[j], "加急"); }
        else if (u.ink === "欠资") foe.owed = Math.min(2, foe.owed + 1);
        else { const j = targetIn(foe, col(i)); if (j >= 0) mark(foe.board[j], u.ink); else hitEnvelope(st, foeWho, Math.ceil(p / 2), u.name); }
        say(st, who, u.name + " 盖了「" + u.ink + "」", { kind: "ink", slot: i, ink: u.ink });
      }
      if (checkOver(st)) return;
    }
    u.first = false;
  }
  function tickMarks(sd) { sd.board.forEach(u => { if (!u) return; Object.keys(u.marks).forEach(m => { if (--u.marks[m] <= 0) delete u.marks[m]; }); }); }
  function resolveSide(st, who) { for (let i = 0; i < SLOTS && !st.over; i++) act(st, who, i); tickMarks(st[who]); }

  function checkOver(st) {
    if (st.over) return true;
    const a = st.me.hp <= 0, b = st.foe.hp <= 0;
    if (a || b) st.over = { winner: a && b ? "draw" : a ? "foe" : "me", turn: st.turn, me: Math.max(0, st.me.hp), foe: Math.max(0, st.foe.hp) };
    return !!st.over;
  }

  // ── 对面怎么出：代码定，不花调用；开回合就算好、亮给她看 ──────────
  function planFoe(st) {
    const sd = st.foe, me = st.me, plan = [], board = sd.board.slice();
    let money = sd.postage;
    const meThreat = c => { let n = 0; for (let r = 0; r < SIZE; r++) { const u = me.board[r * SIZE + c]; if (u && u.role === "锋") n += u.pow; } return n; };
    const hand = sd.hand.map((s, k) => ({ s, k })).sort((a, b) => b.s.face - a.s.face || b.s.pow - a.s.pow);
    for (const { s, k } of hand) {
      if (s.face > money) continue;
      const free = board.map((x, i) => x ? -1 : i).filter(i => i >= 0); if (!free.length) break;
      // 护挡在她火力最大的那一列最前面；别的票优先挨着自己人（凑连张、四方连）
      const score = i => (s.role === "护" ? meThreat(col(i)) * 3 - row(i) : 0)
        + adj(i).filter(j => board[j] && board[j].charId && board[j].charId === s.charId).length * 4
        + (s.role === "锋" && targetIn(me, col(i)) < 0 ? 3 : 0) - row(i) * 0.1;
      const slot = free.sort((a, b) => score(b) - score(a))[0];
      board[slot] = s; money -= s.face; plan.push({ handIdx: k, slot, name: s.name, role: s.role, face: s.face });
    }
    // 亮出来的：贴哪几张、这一轮大概打信封多少、要盖什么戳
    let toEnv = 0; const inks = [];
    board.forEach((u, i) => { if (!u) return; if (u.role === "锋" && targetIn(me, col(i)) < 0) toEnv += u.pow; if (u.role === "印") inks.push(u.ink); });
    return { place: plan, toEnvelope: toEnv, inks };
  }
  function runFoePlan(st) {
    const plan = (st.intent && st.intent.place) || [];
    // 手牌下标会随着贴出去变，按原来的那张找
    const picks = plan.map(p => ({ s: st.foe.hand[p.handIdx], slot: p.slot }));
    for (const p of picks) { const k = st.foe.hand.indexOf(p.s); if (k >= 0) place(st, "foe", k, p.slot); if (st.over) return; }
  }

  // 她按「寄出」：她的票先动，然后对面照亮出来的那一步贴票、行动，再开下一回合
  function endTurn(st) {
    if (st.over) return st;
    resolveSide(st, "me");
    if (!st.over) { runFoePlan(st); if (!st.over) resolveSide(st, "foe"); }
    if (!st.over && st.turn >= TURN_CAP) st.over = { winner: st.me.hp === st.foe.hp ? "draw" : st.me.hp > st.foe.hp ? "me" : "foe", turn: st.turn, me: st.me.hp, foe: st.foe.hp, byCap: true };
    if (!st.over) startTurn(st);
    return st;
  }

  // 打完以后要不要让 TA 记得（她选）：这里只给一句话，记不记、记到哪由调用处决定
  function memoryLine(st, foeName, meName) {
    const o = st && st.over; if (!o) return "";
    const who = foeName || "TA", me = meName || "她";
    const res = o.winner === "draw" ? "打平了" : o.winner === "me" ? me + "赢了" : who + "赢了";
    return who + "和" + me + "用邮票册的卡打了一局对局，" + res + "（" + o.turn + " 回合，信封剩 " + o.me + " : " + o.foe + "）。";
  }

  const API = { SIZE, SLOTS, ENVELOPE_HP, POSTAGE, DRAW, DECK_SIZE, TURN_CAP, FACE, ROLES, MARKS,
    stampOf, deckFrom, foeDeckFrom, newDuel, place, tear, endTurn, planFoe, squares, memoryLine, hashStr };
  g.StampDuel = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
