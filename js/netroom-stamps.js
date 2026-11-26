// 联机房间：邮票册集邮社那几样搬进房间（她 2026-11-22「除了不合适的都搬上去吧」）
//
// 接在 netroom-games.js 那张 ADAPTERS 表上，接口一样（文件头那一段）。一盒「集邮社」，开局页挑玩法：
//   · 对局（duel）：两个人各用自己邮票册的卡，同一回合各自贴票、盖章、撕票、挪票、留牌，两边都寄出了一起结算。
//   · 接力（relay）／积压件（raid）／护信（siege）／封缄令（edict）：大家一张信封，一人一回合轮着下；
//     卡组是每个人交的那一副轮流抽出来拼成的；封缄令开打前每人加一条难度。
//   · 死信（puzzle）：同一道题每人各解各的，比谁那一手打得最多。
// 规则全是邮票对局那一份（window.StampDuel：newDuel / applyOps / autoOps / flip / endTurn），单机、联机同一个函数；
//   这里只管谁的回合、谁的那一副、那一串动作交给庄。不调模型：角色、NPC 都由手机照单机那位陪打的思路替着下（autoOps）。
// 每个人的卡组在她自己那台从她的邮票册里抽（卡面只在自己那台看得到，别人那边只写卡名）。
//   · 邮区巡查（patrol）：同一张 5×5 地图（同一个种子），每人带自己那副各走各的，路上的仗自己打，比巡查分。
//   · 邮局值班（shift）：柜台从大家交的那几副里摆（同一轮大家柜台一样、对面审查局也一样），各自买票凑阵容，比撑到第几轮。
// 不搬的那几样（远信、剧情闯关、邮局小店、派件、小物册、每周约定）是她跟角色两个人的事，留在单机。
(function (root) {
  "use strict";
  const NC = root.NetGameCore; if (!NC) return;
  const ADAPTERS = NC.ADAPTERS, nmOf = NC.nmOf;
  const D = () => root.StampDuel || null;
  const ensure = () => D() && root.StampDuelParts ? Promise.resolve() : root.LazyMods ? root.LazyMods.load("stamps").catch(() => {}) : Promise.resolve();
  const cut = (v, n) => String(v == null ? "" : v).slice(0, n);
  const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const MODES = {
    duel: { zh: "对局", desc: "两个人各用自己的卡组对打", min: 2, max: 2 },
    relay: { zh: "接力", desc: "大家一张信封，一人一回合轮着下", min: 2, max: 4 },
    raid: { zh: "积压件", desc: "一起打打不死的总局，比打出多少伤害", min: 2, max: 4 },
    siege: { zh: "护信", desc: "一起守住信封，一波一波扛过去", min: 2, max: 4 },
    edict: { zh: "封缄令", desc: "每人给这一把加一条难度，再一起打", min: 2, max: 4 },
    puzzle: { zh: "死信", desc: "同一道题各解各的，看谁打得最多", min: 2, max: 4 },
    patrol: { zh: "邮区巡查", desc: "同一张地图各走各的，比巡查分", min: 2, max: 4 },
    shift: { zh: "邮局值班", desc: "柜台从大家的卡里摆，各自凑阵容打审查局，比撑到第几轮", min: 2, max: 4 }
  };
  // 各玩各的、最后比分的那几样：每个座位一张自己的单子（sheets），只发到自己那台
  const RACE = { puzzle: 1, patrol: 1, shift: 1 };
  const RULES = { "": "普通", quick: "快局（各 25 血、最多 7 回合）", reverse: "反着来（用对面的卡组）" };
  const COOP = { relay: 1, raid: 1, siege: 1, edict: 1 };
  const DECK_MAX = 12;

  // 一张票的白名单：数从卡上算，别的台交来的只收这些字段、夹在合理范围里
  function cleanUnit(u, seat) {
    const S = D(); if (!u || typeof u !== "object" || !S) return null;
    const role = S.ROLES.indexOf(u.role) >= 0 ? u.role : "投递", rar = ["R", "SR", "SSR"].indexOf(u.rarity) >= 0 ? u.rarity : "R";
    const skills = Object.keys(S.SKILLS[role] || {});
    return { cardId: cut(u.cardId, 60) || "x" + seat + "_" + Math.random().toString(36).slice(2, 7), charId: cut(u.charId, 60), rarity: rar, lv: int(u.lv, 1, 99, 1), kind: cut(u.kind, 12), limited: !!u.limited,
      name: cut(u.name, 30) || rar + " 票", role, trait: S.TRAITS[u.trait] ? u.trait : "", traitFrom: cut(u.traitFrom, 30), skill: skills.indexOf(u.skill) >= 0 ? u.skill : skills[0] || "",
      face: int(u.face, 1, 3, 1), pow: int(u.pow, 1, 40, 3), maxHp: int(u.maxHp, 1, 80, 6), need: int(u.need, 1, 6, 2), ink: cut(u.ink, 4),
      lines: { enter: cut(u.lines && u.lines.enter, 80), wake: cut(u.lines && u.lines.wake, 80), fall: cut(u.lines && u.lines.fall, 80), win: cut(u.lines && u.lines.win, 80) },
      owner: cut(u.owner, 30), seat };
  }
  const cleanDeck = (a, seat) => (Array.isArray(a) ? a : []).slice(0, DECK_MAX).map(u => cleanUnit(u, seat)).filter(Boolean);
  const cleanOps = a => (Array.isArray(a) ? a : []).slice(0, 40).map(o => o && typeof o === "object" ? { op: ["place", "stamp", "tear", "move", "keep"].indexOf(o.op) >= 0 ? o.op : "", cardId: cut(o.cardId, 60), slot: int(o.slot, 0, 8, 0), from: int(o.from, 0, 8, 0), to: int(o.to, 0, 8, 0) } : null).filter(o => o && o.op);
  // 在她这台从她的邮票册里抽一副（角色就先拿 TA 自己的卡）；册子是空的就用通用票
  function myDeck(charId, ownerName, nameOf) {
    const S = D(), cards = ((root.StampsCore && root.StampsCore.load && root.StampsCore.load().cards) || []).filter(c => c && !c.writing), seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const deck = charId ? S.foeDeckFrom(cards, charId, [], seed) : S.deckFrom(cards, seed, S.DECK_SIZE);
    return deck.map(u => Object.assign(u, { owner: (u.charId && nameOf && nameOf(u.charId)) ? nameOf(u.charId) + "的卡" : ownerName ? ownerName + "带的" : "" }));
  }
  const npcDeck = (seed, name) => D().edictDeck(seed >>> 0).map(u => Object.assign(u, { owner: name || "NPC" }));
  // 大家交的那几副轮流抽一张，拼成一张信封用的一副
  function mergeDecks(decks) { const out = [], seen = {}; for (let k = 0; out.length < DECK_MAX && k < DECK_MAX; k++) decks.forEach(d => { const u = d && d[k]; if (u && out.length < DECK_MAX) { let id = u.cardId; while (seen[id]) id += "'"; seen[id] = 1; out.push(Object.assign({}, u, { cardId: id })); } }); return out; }

  // 公开那份：对局把两边的手牌、牌堆收成张数；别的玩法整张信封都摆出来（大家一起下，没有要瞒的）
  function strip(ds, who) { const x = clone(ds), sd = x[who]; sd.handN = sd.hand.length; sd.drawN = sd.draw.length; sd.hand = []; sd.draw = []; sd.discard = []; x.undo = []; x.log = (x.log || []).slice(-30); return x; }
  const slim = ds => { const x = clone(ds); x.undo = []; x.log = (x.log || []).slice(-30); return x; };

  function startGame(st, inv) {
    const S = D(), n = inv.seats.length, seed = st.seed;
    if (st.mode === "puzzle") { st.puz = S.puzzleOf(int(st.cfg.lv, 1, 40, 8), seed); st.sheets = Array.from({ length: n }, () => null); st.phase = "play"; return; }
    if (st.mode === "patrol") { st.sheets = st.decks.map(d => { const p = S.patrolNew(d, new Date(), seed, false); p.deck = d; return { p, battle: null, btype: "", n: 0, done: false }; }); st.phase = "play"; return; }
    if (st.mode === "shift") { st.pool = [].concat(...st.decks); st.sheets = st.decks.map(() => { const sh = S.shiftNew(seed); shiftRoll(sh, st.pool); return { sh, battle: null, n: 0, done: false }; }); st.phase = "play"; return; }
    if (st.mode === "duel") {
      let a = st.decks[0], b = st.decks[1];
      if (st.cfg.rule === "reverse") { const t = a; a = b; b = t; }
      if (st.cfg.level) { const want = Math.max(1, Math.round((S.avgLv(a) + S.avgLv(b)) / 2)); a = S.fairDeck(a, a, 1, want); b = S.fairDeck(b, b, 1, want); }
      const hp = st.cfg.rule === "quick" ? 25 : 0;
      st.ds = S.newDuel(a, b, seed, { fair: false, pvp: true, meHp: hp || S.envFor(a), foeHp: hp || S.envFor(b), cap: st.cfg.rule === "quick" ? 7 : undefined });
      st.opsIn = {}; st.phase = "play"; return;
    }
    const me = mergeDecks(st.decks);
    if (st.mode === "relay") st.ds = S.newDuel(me, S.edictDeck(seed), seed, { foeLv: Math.max(3, Math.round(S.avgLv(me) * 1.15)), foeHp: Math.round(S.envFor(me) * 1.8), hard: true });
    else if (st.mode === "raid") st.ds = S.newDuel(me, [], seed, { raid: "normal" });
    else if (st.mode === "siege") st.ds = S.newDuel(me, [], seed, { siege: true, siegeLv: S.SIEGE_TIERS[int(st.cfg.tier, 0, 4, 1)], siegeOpt: { endless: false, week: S.siegeWeek(S.weekNo()).id, mate: "", style: "" } });
    else st.ds = S.newDuel(me, S.edictDeck(seed), seed, { edict: st.edicts.slice(), fair: false });
    st.active = 0; st.phase = "play";
  }
  const scoreOf = st => st.mode === "raid" ? ((st.ds && st.ds.raid && st.ds.raid.dealt) || 0) : st.mode === "siege" ? ((st.ds && st.ds.siege && st.ds.siege.cleared) || 0) : st.mode === "edict" ? ((st.ds && st.ds.edictPts) || 0) : 0;

  // 值班的柜台：从大家交的那几副里摆五张；同一轮、刷新同样次数的人看到的柜台一样（种子只跟轮次和刷新次数走）
  function shiftRoll(sh, pool, paid) {
    const S = D(); if (paid) { if (sh.coins < S.SHIFT.REROLL) return false; sh.coins -= S.SHIFT.REROLL; }
    let a = ((sh.seed ^ (sh.round * 7349) ^ (++sh.rolls * 104723)) >>> 0) || 1; const R = () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return a / 4294967296; };
    const list = (pool || []).filter(Boolean); sh.shop = Array.from({ length: Math.min(S.SHIFT.SHOP, list.length) }, () => Object.assign({}, list[Math.floor(R() * list.length)]));
    return true;
  }
  const slimSheet = x => x ? Object.assign({}, x, { battle: x.battle ? slim(x.battle) : null }) : x;
  // 巡查、值班：一张单子往前走一步（庄这一台跑）
  function raceStep(st, i, mv, ops) {
    const S = D(), x = st.sheets[i];
    if (x.battle) {
      S.applyOps(x.battle, "me", ops); S.endTurn(x.battle); x.battle.undo = [];
      if (x.battle.over) { const win = x.battle.over.winner === "me", hp = x.battle.me.hp;
        if (st.mode === "patrol") S.patrolAfter(x.p, x.btype, win, hp);
        else { S.shiftAfter(x.sh, win); if (!x.sh.done) shiftRoll(x.sh, st.pool); }
        x.battle = null; }
    } else if (st.mode === "patrol") {
      const p = x.p;
      if (mv && mv.end) p.done = { why: "steps" };
      else { const g = Array.isArray(mv && mv.go) ? mv.go : [], res = S.patrolMove(p, int(g[0], 0, 4, -1), int(g[1], 0, 4, -1)); if (!res) return "那一格走不过去";
        if (["fight", "elite", "boss"].indexOf(res.type) >= 0) { const b = S.patrolBattle(p, p.deck, res.type); x.battle = S.newDuel(p.deck.map(u => Object.assign({}, u)), b.foeDeck, b.seed, b.opts); x.btype = res.type; } }
    } else {
      const sh = x.sh;
      if (mv && mv.buy != null) { const r = S.shiftBuy(sh, int(mv.buy, 0, 9, 0)); if (!r.ok) return r.why; }
      else if (mv && mv.sell != null) { if (!S.shiftSell(sh, int(mv.sell, 0, 20, 0))) return "这一张不在卡组里"; }
      else if (mv && mv.roll) { if (!shiftRoll(sh, st.pool, true)) return "邮花不够刷新"; }
      else if (mv && mv.fight) { if (!sh.bench.length) return "先在柜台买几张票"; const s = ((st.seed ^ (sh.round * 7919)) >>> 0) || 1; x.battle = S.newDuel(S.shiftDeck(sh), S.edictDeck(s), s, { foeLv: S.shiftFoeLv(sh), cap: 8 }); }
      else return "这一步看不懂";
    }
    x.n++; x.done = !!(x.p ? x.p.done : x.sh.done) && !x.battle;
    if (st.sheets.every(y => y.done)) st.phase = "done";
    return "";
  }
  // 角色、NPC 替着走：仗照陪打的思路下；巡查挑最值的一格走，值班买得起就买、买不动就开打
  function raceAuto(x, mode, style) {
    const S = D(); if (!x || x.done) return { pass: true };
    if (x.battle) return { ops: S.autoOps(x.battle, style || "默契") };
    if (mode === "patrol") {
      const p = x.p, N = S.PATROL.N, low = p.hp < p.max * 0.5, best = { v: -99, go: null };
      [[-1, 0], [0, -1], [0, 1], [1, 0]].forEach(([dr, dc]) => { const r = p.pos[0] + dr, c = p.pos[1] + dc; if (!S.patrolCan(p, r, c)) return; const cl = p.cells[r * N + c];
        const v = cl.done ? 0 : !cl.open ? 6 : ({ boss: low ? -10 : 60, elite: low ? -5 : 25, chest: 15, fight: low ? 2 : 10, event: 8, rest: low ? 30 : 3 })[cl.type] || 1;
        const w = v - dr * 2 + Math.random(); if (w > best.v) { best.v = w; best.go = [r, c]; } });
      return best.go ? { go: best.go } : { end: true };
    }
    const sh = x.sh, k = sh.shop.map((u, i) => ({ u, i })).filter(o => S.shiftPrice(o.u) <= sh.coins).sort((a, b) => S.shiftPrice(b.u) - S.shiftPrice(a.u))[0];
    return k && sh.bench.length < S.SHIFT.BENCH ? { buy: k.i } : { fight: true };
  }

  const A = {
    zh: "集邮社", localTalk: true, mergeNpc: null, needPriv: true,
    seatRange: cfg => { const m = MODES[(cfg && cfg.smode) || "duel"] || MODES.duel; return { min: m.min, max: m.max }; },
    async init(inv, ctx) {
      await ensure(); if (!D()) throw new Error("邮票册还没装上，过一会儿再开一局");
      const pz = ctx.prep || {}, mode = MODES[pz.mode] ? pz.mode : "duel";
      const st = { mode, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, cfg: { rule: RULES[pz.rule] ? pz.rule : "", level: !!pz.level, wager: cut(pz.wager, 40), tier: int(pz.tier, 0, 4, 1), lv: int(pz.lv, 1, 40, 8) },
        decks: inv.seats.map(() => null), edicts: [], pick: 0, phase: mode === "puzzle" ? "play" : "deck", ds: null, opsIn: {}, active: 0 };
      if (mode === "puzzle") startGame(st, inv);
      return st;
    },
    view(st) {
      const v = { mode: st.mode, cfg: st.cfg, phase: st.phase, ready: st.decks.map(Boolean), edicts: st.edicts, pick: st.pick, active: st.active, sent: Object.keys(st.opsIn || {}).map(Number), sheets: !st.sheets ? null : st.mode === "patrol" ? st.sheets.map(x => ({ score: x.p.score, steps: x.p.steps, hp: x.p.hp, fight: !!x.battle, done: x.done, n: x.n }))
        : st.mode === "shift" ? st.sheets.map(x => ({ round: x.sh.round, lives: x.sh.lives, win: !!(x.sh.done && x.sh.done.win), fight: !!x.battle, done: x.done, n: x.n }))
        : st.sheets.map(x => x ? { dealt: x.dealt, best: x.best } : null) };
      if (st.ds) v.ds = st.mode === "duel" ? strip(strip(st.ds, "me"), "foe") : slim(st.ds);
      if (st.puz) v.puzBest = st.puz.puzzle ? st.puz.puzzle.best : 0;
      return v;
    },
    // 自己那份：对局给自己那一边（坐对面的那位看到的是换过个儿的，她那边永远在下面）；死信给那道题；组卡组时给一张「轮到你交卡组」
    priv(st, i) {
      if (st.phase === "deck") return st.decks[i] ? { phase: "deck", done: true } : { phase: "deck" };
      if (st.mode === "duel" && st.ds) return { ds: strip(i === 0 ? st.ds : D().flip(st.ds), "foe"), sent: !!(st.opsIn || {})[i] };
      if (st.mode === "puzzle" && st.puz) return { ds: slim(st.puz), sent: !!(st.sheets || [])[i] };
      if (RACE[st.mode] && st.sheets) return { sheet: slimSheet(st.sheets[i]) };
      return { phase: st.phase };
    },
    turns(v) {
      if (v.phase === "deck") return v.ready.map((r, i) => r ? -1 : i).filter(i => i >= 0);
      if (v.phase === "edict") return [v.pick];
      if (v.phase !== "play" || (v.ds && v.ds.over)) return [];
      if (v.mode === "duel") return [0, 1].filter(i => (v.sent || []).indexOf(i) < 0);
      if (v.mode === "puzzle") return (v.sheets || []).map((x, i) => x ? -1 : i).filter(i => i >= 0);
      if (RACE[v.mode]) return (v.sheets || []).map((x, i) => x && !x.done ? i : -1).filter(i => i >= 0);
      return [v.active];
    },
    turn(v) { const a = A.turns(v); return a.length ? a[0] : -1; },
    waiting(v) { return A.turns(v); },
    roundOf: v => v.phase + ":" + ((v.ds && v.ds.turn) || 0) + ":" + (v.pick || 0) + ":" + (v.active || 0) + ":" + (v.sheets || []).map(x => (x && x.n) || 0).join(","),
    apply(st0, i, mv, ctx) {
      const st = clone(st0), inv = ctx.inv, S = D(); if (!S) return { err: "邮票册还没装上" };
      const n = inv.seats.length;
      if (st.phase === "deck") {
        if (st.decks[i]) return { err: "这一副已经交过了" };
        const d = cleanDeck(mv && mv.deck, i);
        st.decks[i] = d.length >= 6 ? d : npcDeck(st.seed + i * 977, nmOf(inv, i));
        if (st.decks.every(Boolean)) { if (st.mode === "edict") { st.phase = "edict"; st.pick = 0; } else startGame(st, inv); }
        return { st };
      }
      if (st.phase === "edict") {
        if (i !== st.pick) return { err: "还没轮到这一位加" };
        const k = mv && mv.edict; if (k && S.EDICTS[k] && st.edicts.indexOf(k) < 0) st.edicts.push(k);
        st.pick++; if (st.pick >= n) startGame(st, inv);
        return { st };
      }
      if (st.phase !== "play") return { err: "这一局还没开始" };
      const ops = cleanOps(mv && mv.ops);
      if (st.mode === "patrol" || st.mode === "shift") {
        if (!st.sheets[i] || st.sheets[i].done) return { err: "这一位已经走完了" };
        const why = raceStep(st, i, mv || {}, ops); return why ? { err: why } : { st };
      }
      if (st.mode === "puzzle") {
        if ((st.sheets || [])[i]) return { err: "这一位已经交过了" };
        const x = clone(st.puz); S.applyOps(x, "me", ops); S.endTurn(x);
        st.sheets[i] = { dealt: Math.max(0, st.puz.foe.hp - Math.max(0, x.foe.hp)), best: st.puz.puzzle.best };
        if (st.sheets.every(Boolean)) st.phase = "done";
        return { st };
      }
      if (st.ds.over) return { err: "这一局已经打完了" };
      if (st.mode === "duel") {
        if (st.opsIn[i]) return { err: "这一回合已经寄出了" };
        st.opsIn[i] = ops;
        if (st.opsIn[0] && st.opsIn[1]) { S.applyOps(st.ds, "me", st.opsIn[0]); S.applyOps(st.ds, "foe", st.opsIn[1]); S.endTurn(st.ds); st.opsIn = {}; st.ds.undo = []; }
        if (st.ds.over) st.phase = "done";
        return { st };
      }
      if (i !== st.active) return { err: "还没轮到这一位" };
      S.applyOps(st.ds, "me", ops); S.endTurn(st.ds); st.ds.undo = []; st.active = (st.active + 1) % n;
      if (st.ds.over) st.phase = "done";
      return { st };
    },
    // NPC、托管：组卡组用通用票；下棋照单机陪打那位的思路
    npcMove(st, i, inv) {
      if (st.phase === "deck") return { deck: npcDeck(st.seed + i * 977, nmOf(inv, i)) };
      if (st.phase === "edict") { const left = Object.keys(D().EDICTS).filter(k => st.edicts.indexOf(k) < 0); return { edict: left[(st.seed + i) % left.length] }; }
      if (st.mode === "patrol" || st.mode === "shift") return raceAuto(st.sheets[i], st.mode, "默契");
      const ds = st.mode === "puzzle" ? st.puz : st.mode === "duel" && i === 1 ? D().flip(st.ds) : st.ds;
      return { ops: D().autoOps(ds, "默契") };
    },
    // 角色：卡组在带 TA 来的那台从那台的邮票册里抽（先拿 TA 自己的卡）；下棋照 TA 的样子（护短、好胜…没有就默契）
    async charMove(view, i, inv, ctx) {
      await ensure(); if (!D()) return { pass: true };
      const c = ctx.char || {}, nm = c.remark || c.name || "TA";
      if (view.phase === "deck") return { deck: myDeck(c.id, nm, () => nm) };
      if (view.phase === "edict") { const left = Object.keys(D().EDICTS).filter(k => (view.edicts || []).indexOf(k) < 0); return { edict: left[Math.floor(Math.random() * left.length)] }; }
      if (view.mode === "patrol" || view.mode === "shift") return raceAuto(ctx.priv && ctx.priv.sheet, view.mode, (ctx.opts && ctx.opts.style) || "默契");
      const ds = (ctx.priv && ctx.priv.ds) || view.ds; if (!ds) return { pass: true };
      return { ops: D().autoOps(ds, (ctx.opts && ctx.opts.style) || "默契") };
    },
    result(st, inv) {
      if (st.phase !== "done") return null;
      const nm = k => nmOf(inv, k), all = inv.seats.map((_, k) => k), M = MODES[st.mode].zh;
      if (st.mode === "puzzle") { const sc = st.sheets.map((x, k) => ({ k, d: (x && x.dealt) || 0 })), top = Math.max(...sc.map(x => x.d)), best = st.puz.puzzle.best;
        return { winners: sc.filter(x => x.d === top && top > 0).map(x => x.k), text: "死信第 " + st.cfg.lv + " 关（最多能打 " + best + "）：" + sc.slice().sort((a, b) => b.d - a.d).map(x => nm(x.k) + " " + x.d + (x.d >= best ? "（解开了）" : "")).join("，") + "。", replay: { mode: st.mode, lines: [] } }; }
      if (st.mode === "patrol") { const sc = st.sheets.map((x, k) => ({ k, d: x.p.score })), top = Math.max(...sc.map(x => x.d));
        return { winners: sc.filter(x => x.d === top).map(x => x.k), text: "一起巡查「" + st.sheets[0].p.theme + "」邮区：" + sc.slice().sort((a, b) => b.d - a.d).map(x => nm(x.k) + " " + x.d + " 分" + (st.sheets[x.k].p.done && st.sheets[x.k].p.done.why === "boss" ? "（打倒了巡查长）" : "")).join("，") + "。", replay: { mode: st.mode, lines: [] } }; }
      if (st.mode === "shift") { const val = x => x.sh.done && x.sh.done.win ? 100 + x.sh.lives : x.sh.round, sc = st.sheets.map((x, k) => ({ k, v: val(x), x })), top = Math.max(...sc.map(y => y.v));
        return { winners: sc.filter(y => y.v === top).map(y => y.k), text: "一起值班：" + sc.slice().sort((a, b) => b.v - a.v).map(y => nm(y.k) + (y.x.sh.done && y.x.sh.done.win ? " 值完 8 轮" : " 撑到第 " + y.x.sh.round + " 轮")).join("，") + "。", replay: { mode: st.mode, lines: [] } }; }
      const o = st.ds.over || {}, lines = (st.ds.log || []).slice(-12).map(l => cut(l.text, 80));
      if (st.mode === "duel") { const w = o.winner === "me" ? [0] : o.winner === "foe" ? [1] : [];
        return { winners: w, text: nm(0) + " 对 " + nm(1) + "，" + M + (st.cfg.rule ? "（" + RULES[st.cfg.rule].split("（")[0] + "）" : "") + "打了 " + o.turn + " 回合，" + (w.length ? nm(w[0]) + "赢了" : "打平了") + "（信封剩 " + o.me + " : " + o.foe + "）" + (st.cfg.wager && w.length ? "。彩头：" + st.cfg.wager : "") + "。", replay: { mode: st.mode, lines } }; }
      const won = o.winner === "me", sc = scoreOf(st), who = all.map(nm).join("、");
      const tail = st.mode === "raid" ? "一共打出 " + sc + " 伤害" : st.mode === "siege" ? (won ? "守住了" : "没守住") + "，扛过 " + sc + " 波" : st.mode === "edict" ? (won ? "打赢了，危险 " + sc + " 分" : "没打赢（危险 " + sc + " 分）") : won ? "把信送到了" : "没打过";
      return { winners: st.mode === "raid" || won ? all : [], text: who + " 一起打" + M + "，" + o.turn + " 回合，" + tail + "。", replay: { mode: st.mode, lines } };
    },
    cleanReplay: r => ({ mode: MODES[r && r.mode] ? r.mode : "duel", lines: (Array.isArray(r && r.lines) ? r.lines : []).slice(0, 12).map(x => cut(x, 80)) }),
    stateText(v, i, inv) {
      const M = (MODES[v.mode] || MODES.duel).zh;
      if (v.phase === "deck") return "在玩邮票册的" + M + "，大家正在从自己的邮票册里挑卡组。";
      if (v.phase === "edict") return "在玩邮票册的封缄令，正在轮流加难度：" + ((v.edicts || []).map(k => (D() && D().EDICTS[k] || {}).zh).filter(Boolean).join("、") || "还没加");
      if (v.mode === "patrol") return "在玩邮票册的邮区巡查（同一张图各走各的，比分）：" + (v.sheets || []).map((x, k) => nmOf(inv, k) + " " + x.score + " 分、还剩 " + x.steps + " 步" + (x.fight ? "（在打仗）" : "") + (x.done ? "（走完了）" : "")).join("；");
      if (v.mode === "shift") return "在玩邮票册的邮局值班（各自凑阵容打审查局，比撑到第几轮）：" + (v.sheets || []).map((x, k) => nmOf(inv, k) + " 第 " + x.round + " 轮、" + x.lives + " 条命" + (x.fight ? "（在打）" : "") + (x.done ? (x.win ? "（值完了）" : "（下班了）") : "")).join("；");
      if (v.mode === "puzzle") return "在解同一道死信（一回合打空，比谁打得最多）。" + (v.sheets || []).map((x, k) => x ? nmOf(inv, k) + " 打了 " + x.dealt : "").filter(Boolean).join("，");
      const ds = v.ds || {}, me = ds.me || {}, foe = ds.foe || {};
      const head = v.mode === "duel" ? nmOf(inv, 0) + " 的信封 " + me.hp + "，" + nmOf(inv, 1) + " 的信封 " + foe.hp : "大家的信封 " + me.hp + (v.mode === "raid" ? "，已经打出 " + ((ds.raid && ds.raid.dealt) || 0) + " 伤害" : "，对面信封 " + foe.hp);
      const recent = (ds.log || []).slice(-5).map(l => l.text).join("；");
      return "在玩邮票册的" + M + "，第 " + (ds.turn || 0) + " 回合。" + head + "。" + (recent ? "刚才：" + recent : "") + (v.mode !== "duel" && v.phase === "play" ? "这回合轮到 " + nmOf(inv, v.active) + "。" : "");
    },
    prepLine: pz => "玩法：" + ((MODES[pz && pz.mode] || MODES.duel).zh) + (pz && pz.rule ? " · " + RULES[pz.rule].split("（")[0] : ""),
    againPrep: pz => pz ? { mode: MODES[pz.mode] ? pz.mode : "duel", rule: RULES[pz.rule] ? pz.rule : "", level: !!pz.level, wager: cut(pz.wager, 40), tier: int(pz.tier, 0, 4, 1), lv: int(pz.lv, 1, 40, 8) } : null,
    roundEnd: () => ""
  };
  ADAPTERS.stamps = A;
  NC.CHAR_OPTS.stamps = [];
  A.shelf = { key: "stamps", zh: "集邮社", en: "Stamps", min: 2, max: 4, rule: "用邮票册的卡 · 对局、接力、积压件、护信、封缄令、死信、巡查、值班" };
  A.MODES = MODES;

  // ───────────── 界面 ─────────────
  if (typeof React === "undefined") return;
  const h = React.createElement, { useState, useEffect, useMemo } = React;
  const fs = px => "calc(" + px + "px * var(--app-fs, 1))";
  const btn = (t, on) => ({ minHeight: 36, padding: "0 12px", borderRadius: 8, border: "1px solid " + (on ? t.ink : t.line), background: on ? t.ink : (t.bg2 || t.bg), color: on ? t.bg : t.ink, fontFamily: F_BODY, fontSize: fs(12.5) });
  const small = t => ({ fontFamily: F_BODY, fontSize: fs(11.5), color: t.fog, lineHeight: 1.6 });
  const useStampsReady = () => { const [ok, setOk] = useState(!!(D() && root.StampDuelParts)); useEffect(() => { if (!ok) ensure().then(() => setOk(!!(D() && root.StampDuelParts))); }, []); return ok; };
  const myCards = () => ((root.StampsCore && root.StampsCore.load && root.StampsCore.load().cards) || []);

  function StampsPrep({ myChars, nick, onSend }) {
    const t = useTheme();
    const [p, setP] = useState({ mode: "duel", rule: "", level: false, wager: "", tier: 1, lv: 8, chars: {}, me: true });
    const set = o => setP(x => Object.assign({}, x, o));
    const seg = (val, list, on, wk) => h("div", { "data-wk": wk, className: "flex flex-wrap", style: { gap: 6 } }, list.map(o => h("button", { key: o.k, onClick: () => on(o.k), className: "active:opacity-70", style: btn(t, val === o.k) }, o.zh)));
    const label = s => h("div", { style: { fontFamily: F_BODY, fontSize: fs(12), color: t.fog, margin: "6px 0 2px" } }, s);
    const M = MODES[p.mode];
    const picks = (p.me ? [{ kind: "user" }] : []).concat((myChars || []).filter(c => p.chars[c.id]).map(c => ({ kind: "char", charId: c.id, name: c.remark || c.name })));
    const total = Math.max(M.min, Math.min(M.max, picks.length || M.min));
    return h("div", { "data-wk": "nrstampsprep", style: { display: "flex", flexDirection: "column", gap: 6 } },
      h("div", { style: small(t) }, "用各自邮票册里的卡玩。每个人的卡组在她自己那台抽，卡面只在自己那台看得到，别人那边写卡名。角色由带 TA 来的那台替着下，不花调用。"),
      label("玩什么"), seg(p.mode, Object.keys(MODES).map(k => ({ k, zh: MODES[k].zh })), k => set({ mode: k }), "nrstampsmode"),
      h("div", { style: small(t) }, M.desc + "，" + (M.min === M.max ? M.min + " 个人" : M.min + "~" + M.max + " 个人") + "；人不够用 NPC 补。"),
      p.mode === "duel" ? h(React.Fragment, null,
        label("规则"), seg(p.rule, Object.keys(RULES).map(k => ({ k, zh: RULES[k] })), k => set({ rule: k }), "nrstampsrule"),
        label("等级"), seg(p.level ? "1" : "0", [{ k: "0", zh: "照各自的卡" }, { k: "1", zh: "两边拉平" }], k => set({ level: k === "1" }), "nrstampslevel"),
        h("div", { style: small(t) }, p.level ? "两副卡组都换算到两边的平均等级，只比谁摆得好。" : "谁的卡练得高谁占便宜。"),
        label("彩头（可以不填，打完写在战绩上）"),
        h("input", { "data-wk": "nrstampswager", value: p.wager, onChange: e => set({ wager: e.target.value.slice(0, 40) }), placeholder: "比如：输的人回答一个真心话", style: { width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 16 } })) : null,
      p.mode === "siege" ? h(React.Fragment, null, label("难度"), seg(p.tier, [0, 1, 2, 3, 4].map(k => ({ k, zh: "第 " + (k + 1) + " 档" })), k => set({ tier: k }), "nrstampstier")) : null,
      p.mode === "puzzle" ? h(React.Fragment, null, label("第几关"), seg(p.lv, [3, 8, 15, 22, 30].map(k => ({ k, zh: "第 " + k + " 关" })), k => set({ lv: k }), "nrstampslv")) : null,
      p.mode === "edict" ? h("div", { style: small(t) }, "开打前每人轮流加一条难度（角色、NPC 由手机替着挑），加得越多危险分越高。") : null,
      label("谁上场"), seg(p.me ? "1" : "0", [{ k: "1", zh: "我上场" }, { k: "0", zh: "我不上，看着" }], k => set({ me: k === "1" }), "nrstampsme"),
      (myChars || []).length ? h("div", { className: "flex flex-wrap", style: { gap: 6 } }, myChars.map(c => h("button", { key: c.id, "data-wk": "nrstampschar", onClick: () => set({ chars: Object.assign({}, p.chars, { [c.id]: !p.chars[c.id] }) }), style: btn(t, !!p.chars[c.id]) }, (p.chars[c.id] ? "✓ " : "") + (c.remark || c.name)))) : null,
      h("button", { "data-wk": "nrstampsgo", onClick: () => onSend({ total, smode: p.mode, mode: p.me ? "normal" : "spectate", npcFill: true, picks }, { mode: p.mode, rule: p.rule, level: p.level, wager: p.wager.trim(), tier: p.tier, lv: p.lv }), style: Object.assign(btn(t, true), { marginTop: 10, minHeight: 42 }) }, "发邀请卡"));
  }

  // 一张信封＋手里那几张：她这一回合在自己那份上点着试，「寄出」才把那一串交给庄
  function Board({ ds, live, onSend, mine, waitLine, foeName, meName }) {
    const t = useTheme(), S = D(), P = root.StampDuelParts;
    const [work, setWork] = useState(() => clone(ds)), [ops, setOps] = useState([]), [hand, setHand] = useState(-1), [sel, setSel] = useState(-1), [moving, setMoving] = useState(false), [msg, setMsg] = useState("");
    const key = JSON.stringify([ds.turn, ds.me && ds.me.hp, ds.foe && ds.foe.hp, (ds.me && ds.me.hand || []).length, live]);
    useEffect(() => { setWork(clone(ds)); setOps([]); setHand(-1); setSel(-1); setMoving(false); setMsg(""); }, [key]);
    const cards = useMemo(() => { const m = {}; myCards().forEach(c => { if (c && c.id) m[c.id] = c; }); return m; }, []);
    const owners = {}; [work.me, work.foe].forEach(sd => (sd.board || []).concat(sd.hand || []).forEach(u => { if (u && u.charId && u.owner) owners[u.charId] = u.owner; }));
    const thumb = root.StampThumbnails && root.StampThumbnails.use;
    const go = (fn, op) => { const r = fn(); if (r && r.ok) { setOps(o => o.concat([op])); setWork(w => Object.assign({}, w)); setMsg(""); return true; } setMsg((r && r.why) || "这一步做不了"); return false; };
    const tapMine = i => {
      if (!live) return;
      if (hand >= 0) { const u = work.me.hand[hand]; if (u && go(() => S.place(work, "me", hand, i), { op: "place", cardId: u.cardId, slot: i })) setHand(-1); return; }
      if (moving && sel >= 0) { if (go(() => S.move(work, "me", sel, i), { op: "move", from: sel, to: i })) { setSel(-1); setMoving(false); } return; }
      setSel(work.me.board[i] ? (sel === i ? -1 : i) : -1); setMoving(false);
    };
    const acts = S.actsOf ? S.actsOf(work, "me") : {}, foeActs = S.actsOf && !work.pvp && !work.puzzle ? S.actsOf(work, "foe") : {};
    const selU = sel >= 0 ? work.me.board[sel] : null;
    const env = (sd, foe) => h(P.Envelope, { sd, foe, sel: foe ? -1 : sel, onTap: foe ? () => {} : tapMine, armed: !foe && hand >= 0, cardOf: id => cards[id] || null, ownerOf: id => owners[id] || "", useThumb: thumb, fx: null, onLong: null });
    const hpLine = (name, sd) => h("div", { style: Object.assign(small(t), { textAlign: "center", color: t.sub }) }, name + (sd.hp > 900 ? "" : "　信封 " + Math.max(0, sd.hp) + (sd.max ? " / " + sd.max : "")) + (sd.handN != null ? "　手里 " + sd.handN + " 张" : ""));
    return h("div", { "data-wk": "nrstampsboard", style: { display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 340, margin: "0 auto" } },
      hpLine(foeName, work.foe), env(work.foe, true),
      !work.pvp && Object.keys(foeActs).length ? h("div", { style: Object.assign(small(t), { textAlign: "center" }) }, "对面这回合：" + Object.keys(foeActs).map(k => foeActs[k]).filter(Boolean).slice(0, 4).join("、")) : null,
      env(work.me, false), hpLine(meName, work.me),
      selU ? h("div", { style: Object.assign(small(t), { textAlign: "center", color: t.ink }) }, "「" + selU.name + "」" + selU.role + " ⚔" + selU.pow + " ♥" + selU.hp + (acts[sel] ? " · 这回合" + acts[sel] : "")) : null,
      live ? h("div", { "data-wk": "nrstampshand", style: { display: "grid", gridTemplateColumns: "repeat(" + Math.max(4, work.me.hand.length) + ", minmax(0, 1fr))", gap: 6 } },
        work.me.hand.map((u, k) => h("div", { key: k, style: { position: "relative" } },
          h(P.Ticket, { u, card: cards[u.cardId] || null, owner: u.owner || "", useThumb: thumb, small: true, sel: hand === k, onTap: () => { setHand(hand === k ? -1 : k); setSel(-1); setMoving(false); } }),
          (work.me.kept || []).indexOf(k) >= 0 ? h("span", { style: { position: "absolute", left: 2, bottom: 2, fontSize: fs(9), background: t.ink, color: t.bg, borderRadius: 3, padding: "0 3px" } }, "留") : null))) : null,
      live ? h("div", { style: Object.assign(small(t), { textAlign: "center" }) }, "胶水 " + work.me.postage + "　第 " + work.turn + " 回合" + (work.cap ? " / " + work.cap : "") + (hand >= 0 ? "　· 点一格空位贴上去（面值 " + (work.me.hand[hand] || {}).face + "）" : moving ? "　· 点旁边一格空位" : "")) : null,
      msg ? h("div", { style: Object.assign(small(t), { textAlign: "center", color: t.tint }) }, msg) : null,
      live ? h("div", { className: "flex flex-wrap justify-center", style: { gap: 6 } },
        selU && selU.charge >= selU.need ? h("button", { "data-wk": "nrstampsstamp", onClick: () => { if (go(() => S.stamp(work, "me", sel), { op: "stamp", slot: sel })) setSel(-1); }, style: btn(t, false) }, "盖章") : null,
        selU ? h("button", { "data-wk": "nrstampsmove", onClick: () => setMoving(v => !v), style: btn(t, moving) }, "挪") : null,
        selU ? h("button", { "data-wk": "nrstampstear", onClick: () => { if (go(() => S.tear(work, "me", sel), { op: "tear", slot: sel })) setSel(-1); }, style: btn(t, false) }, "撕下") : null,
        hand >= 0 ? h("button", { "data-wk": "nrstampskeep", onClick: () => { const u = work.me.hand[hand]; if (u) go(() => S.keep(work, "me", hand), { op: "keep", cardId: u.cardId }); }, style: btn(t, false) }, "留到下回合") : null,
        ops.length ? h("button", { "data-wk": "nrstampsundo", onClick: () => { setWork(clone(ds)); setOps([]); setHand(-1); setSel(-1); setMoving(false); }, style: btn(t, false) }, "重来这回合") : null,
        h("button", { "data-wk": "nrstampssend", onClick: () => onSend(ops), style: btn(t, true) }, mine === "puzzle" ? "就这么打" : "寄出")) : h("div", { "data-wk": "nrgamestatus", style: Object.assign(small(t), { textAlign: "center" }) }, waitLine || ""),
      (work.log || []).length ? h("div", { "data-wk": "nrstampslog", style: Object.assign(small(t), { borderTop: "1px solid " + t.line, paddingTop: 6, maxHeight: 120, overflowY: "auto" }) }, (work.log || []).slice(-8).map((l, k) => h("div", { key: k }, l.text))) : null);
  }

  function StampsTable({ inv, view, priv, me, onMove, charsById }) {
    const t = useTheme(), ok = useStampsReady();
    if (!ok) return h("div", { "data-wk": "nrgamestatus", style: small(t) }, "在装邮票册…");
    const S = D(), v = view || {}, M = (MODES[v.mode] || MODES.duel).zh;
    const mySeats = inv.seats.map((s, i) => NC.actorOf(s, me, inv.host) === "mine-user" ? i : -1).filter(i => i >= 0), my = mySeats[0];
    const nm = k => nmOf(inv, k), wait = A.turns(v), myTurn = my != null && wait.indexOf(my) >= 0;
    const top = h("div", { style: { fontFamily: F_DISPLAY, fontSize: fs(14.5), color: t.ink, textAlign: "center" } }, "集邮社 · " + M + (v.cfg && v.cfg.wager ? "　彩头：" + v.cfg.wager : ""));
    if (v.phase === "deck") return h("div", { "data-wk": "nrstampsdeck", style: { display: "flex", flexDirection: "column", gap: 8 } }, top,
      h("div", { style: small(t) }, "每人从自己的邮票册里抽一副 12 张。" + inv.seats.map((s, k) => nm(k) + (v.ready[k] ? " ✓" : " 在挑")).join("　")),
      myTurn ? h("button", { "data-wk": "nrstampsdeckgo", onClick: () => onMove(my, { deck: myDeck("", "", id => { const c = (charsById || {})[id]; return c ? (c.remark || c.name) : ""; }) }), style: btn(t, true) }, "从我的邮票册里抽一副") : null,
      myTurn && !myCards().length ? h("div", { style: small(t) }, "你的邮票册还是空的，会用通用票凑一副。") : null);
    if (v.phase === "edict") { const E = S.EDICTS, left = Object.keys(E).filter(k => (v.edicts || []).indexOf(k) < 0);
      return h("div", { "data-wk": "nrstampsedict", style: { display: "flex", flexDirection: "column", gap: 8 } }, top,
        h("div", { style: small(t) }, "已经加了：" + ((v.edicts || []).map(k => E[k].zh + "（" + E[k].pt + " 分）").join("、") || "还没有") + "。轮到 " + nm(v.pick) + " 加。"),
        myTurn ? h("div", { className: "flex flex-wrap", style: { gap: 6 } }, left.map(k => h("button", { key: k, "data-wk": "nrstampsedictpick", onClick: () => onMove(my, { edict: k }), style: btn(t, false) }, E[k].zh + " +" + E[k].pt))) : null); }
    if (v.phase === "done" && v.mode === "puzzle") return h("div", { style: small(t) }, top, (v.sheets || []).map((x, k) => h("div", { key: k }, nm(k) + "：打了 " + ((x && x.dealt) || 0) + " / " + (v.puzBest || 0))));
    if (v.mode === "patrol" || v.mode === "shift") return h(RaceView, { inv, v, sheet: priv && priv.sheet, my, top, onMove, nm });
    // 对局、死信：自己那份在 priv；接力那几样大家看同一张
    const own = (v.mode === "duel" || v.mode === "puzzle") && priv && priv.ds ? priv.ds : null, ds = own || v.ds;
    if (!ds) return h("div", { "data-wk": "nrgamestatus", style: small(t) }, top, v.mode === "puzzle" ? "你没有座位，等她们解完看结果。" : "等着开局…");
    const live = myTurn && !(priv && priv.sent) && !ds.over && v.phase === "play";
    const foeName = v.mode === "duel" ? nm(my === 1 ? 0 : 1) : v.mode === "raid" ? "总局" : v.mode === "siege" ? "来闹事的" : "对面", meName = v.mode === "duel" ? (my != null ? "我" : nm(0)) : "大家";
    const waitLine = ds.over ? "" : v.mode === "duel" ? (priv && priv.sent ? "寄出了，等对面也寄出" : "等两边寄出") : v.mode === "puzzle" ? "等大家解完" : "轮到 " + nm(v.active);
    return h("div", { "data-wk": "nrstampstable", "data-mode": v.mode, style: { display: "flex", flexDirection: "column", gap: 8 } }, top,
      v.mode === "raid" && ds.raid ? h("div", { style: Object.assign(small(t), { textAlign: "center" }) }, "已经打出 " + ds.raid.dealt + " 伤害") : null,
      v.mode === "siege" && ds.siege ? h("div", { style: Object.assign(small(t), { textAlign: "center" }) }, "扛过 " + ds.siege.cleared + " / " + ds.siege.waves + " 波") : null,
      v.mode === "puzzle" && ds.puzzle ? h("div", { style: Object.assign(small(t), { textAlign: "center" }) }, "一回合打空这几张，这道题最多能打 " + ds.puzzle.best) : null,
      h(Board, { ds, live, mine: v.mode, foeName, meName, waitLine, onSend: ops => onMove(my, { ops }) }));
  }
  // 巡查、值班：自己那张单子＋大家的分
  const PICON = { fight: ["✉", "仗"], elite: ["✦", "硬仗"], boss: ["♛", "巡查长"], chest: ["宝", "宝箱"], event: ["?", "岔路"], rest: ["☕", "驿站"], empty: ["·", "空"], start: ["起", "起点"] };
  function RaceView({ inv, v, sheet, my, top, onMove, nm }) {
    const t = useTheme(), S = D(), P = root.StampDuelParts, x = sheet, mine = my != null && x && !x.done;
    const cards = useMemo(() => { const m = {}; myCards().forEach(c => { if (c && c.id) m[c.id] = c; }); return m; }, []), thumb = root.StampThumbnails && root.StampThumbnails.use;
    const [sel, setSel] = useState(-1);
    const board = h("div", { "data-wk": "nrstampsrace", style: Object.assign(small(t), { borderTop: "1px solid " + t.line, paddingTop: 6 }) }, (v.sheets || []).map((y, k) => h("div", { key: k }, nm(k) + "　" + (v.mode === "patrol" ? y.score + " 分 · 还剩 " + y.steps + " 步" : "第 " + y.round + " 轮 · " + "♥".repeat(Math.max(0, y.lives))) + (y.fight ? " · 在打" : "") + (y.done ? (v.mode === "shift" && y.win ? " · 值完了" : " · 走完了") : ""))));
    let body = null;
    if (!x) body = h("div", { style: small(t) }, "你没有座位，在旁边看大家的分。");
    else if (x.battle) body = h(Board, { ds: x.battle, live: mine, mine: v.mode, foeName: v.mode === "patrol" ? ({ boss: "巡查长", elite: "硬仗" })[x.btype] || "路上的麻烦" : "审查局", meName: "我", waitLine: "", onSend: ops => onMove(my, { ops }) });
    else if (v.mode === "patrol") { const p = x.p, N = S.PATROL.N;
      body = h("div", { style: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 340, margin: "0 auto", width: "100%" } },
        h("div", { style: Object.assign(small(t), { textAlign: "center", color: t.ink }) }, "「" + p.theme + "」邮区　步数 " + p.steps + "　信封 " + p.hp + "/" + p.max + "　巡查分 " + p.score),
        h("div", { "data-wk": "nrstampspatrol", style: { display: "grid", gridTemplateColumns: "repeat(" + N + ", minmax(0, 1fr))", gap: 5 } }, p.cells.map((cl, i) => { const here = p.pos[0] === cl.r && p.pos[1] === cl.c, can = mine && S.patrolCan(p, cl.r, cl.c), ic = PICON[cl.type] || PICON.empty;
          return h("button", { key: i, "data-wk": "nrstampscell", disabled: !can, onClick: () => onMove(my, { go: [cl.r, cl.c] }), style: { aspectRatio: "1 / 1", borderRadius: 6, border: here ? "2px solid " + t.ink : can ? "2px dashed " + t.accent : "1px solid " + t.line, background: cl.open ? (t.bg2 || t.bg) : "repeating-linear-gradient(45deg, " + t.line + " 0 4px, transparent 4px 9px)", opacity: cl.done && !here && cl.type !== "start" ? 0.5 : 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: fs(16), color: t.ink } },
            cl.open ? ic[0] : "", cl.open ? h("span", { style: { fontFamily: F_BODY, fontSize: fs(9), color: t.fog } }, here ? "你在这" : ic[1]) : null); })),
        (p.log || []).length ? h("div", { style: small(t) }, p.log.slice(-3).reverse().map((l, k) => h("div", { key: k }, l))) : null,
        mine ? h("button", { "data-wk": "nrstampspatrolend", onClick: () => onMove(my, { end: true }), style: Object.assign(btn(t, false), { alignSelf: "center" }) }, "就走到这儿") : null); }
    else { const sh = x.sh, selU = sh.bench[sel];
      body = h("div", { style: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 360, margin: "0 auto", width: "100%" } },
        h("div", { style: Object.assign(small(t), { textAlign: "center", color: t.ink }) }, "第 " + sh.round + " / " + S.SHIFT.ROUNDS + " 轮　命 " + "♥".repeat(sh.lives) + "　邮花 " + sh.coins + "　卡组 " + sh.bench.length + " / " + S.SHIFT.BENCH),
        h("div", { style: small(t) }, "柜台（点一张买；同一张再买会合成变强）"),
        h("div", { "data-wk": "nrstampsshop", style: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 5 } }, sh.shop.map((u, i) => h("div", { key: i },
          h(P.Ticket, { u, card: cards[u.cardId] || null, owner: u.owner || "", useThumb: thumb, small: true, onTap: () => mine && onMove(my, { buy: i }) }),
          h("div", { style: Object.assign(small(t), { textAlign: "center", color: sh.coins >= S.shiftPrice(u) ? t.ink : t.fog }) }, S.shiftPrice(u) + " 枚")))),
        h("div", { style: small(t) }, "值班卡组" + (selU ? "（点了「" + selU.name + "」）" : "（点一张能卖掉）")),
        sh.bench.length ? h("div", { "data-wk": "nrstampsbench", style: { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 5 } }, sh.bench.map((u, i) => h(P.Ticket, { key: i, u, card: cards[u.cardId] || null, owner: u.owner || "", useThumb: thumb, small: true, sel: sel === i, onTap: () => setSel(sel === i ? -1 : i) }))) : h("div", { style: small(t) }, "还没买票。"),
        mine ? h("div", { className: "flex flex-wrap justify-center", style: { gap: 6 } },
          selU ? h("button", { "data-wk": "nrstampssell", onClick: () => { onMove(my, { sell: sel }); setSel(-1); }, style: btn(t, false) }, "卖掉") : null,
          h("button", { "data-wk": "nrstampsroll", onClick: () => onMove(my, { roll: true }), style: btn(t, false) }, "刷新柜台（" + S.SHIFT.REROLL + " 枚）"),
          h("button", { "data-wk": "nrstampsfight", onClick: () => onMove(my, { fight: true }), style: btn(t, true) }, "就这些，开打")) : null); }
    return h("div", { "data-wk": "nrstampstable", "data-mode": v.mode, style: { display: "flex", flexDirection: "column", gap: 8 } }, top, body, board);
  }
  function StampsReplay({ rec }) {
    const t = useTheme(), r = rec.replay || {};
    return h("div", { style: small(t) }, (r.lines || []).map((x, k) => h("div", { key: k }, x)));
  }
  A.Table = StampsTable; A.Replay = StampsReplay; A.Prep = StampsPrep;
})(typeof window !== "undefined" ? window : globalThis);
