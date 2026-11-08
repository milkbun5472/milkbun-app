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
  const ENVELOPE_HP = 40, POSTAGE = 3, DRAW = 4, DECK_SIZE = 12, TURN_CAP = 12, POSTAGE_CAP = 7, KEEP_MAX = 2, MOVE_COST = 1, STAMP_COST = 1;
  const FACE = { R: 1, SR: 2, SSR: 3 };
  const BASE = { R: { pow: 3, hp: 6 }, SR: { pow: 5, hp: 9 }, SSR: { pow: 7, hp: 13 } };
  const ROLE_HIT = { 火漆: 0.5, 补票: 0.4, 集邮: 0.4, 邮戳: 0.5 };
  // 等级给的数值（她 2026-11-08「升级数值也要提升才有爽感」）：原来十级才 +1 攻，现在六级 +1 攻、三级 +1 血
  const lvPow = lv => Math.floor(lv / 6), lvHp = lv => Math.floor(lv / 3);
  const avgLv = deck => { const d = (deck || []).filter(Boolean); return d.length ? d.reduce((a, u) => a + (Number(u.lv) || 1), 0) / d.length : 1; };
  // 信封跟着卡组等级变厚（等级高了一下打得多，信封不变厚几下就没了）
  const envFor = deck => ENVELOPE_HP + Math.round(avgLv(deck) * 0.6);
  // 对面的等级照你的来（她 2026-11-08「参考我的牌面平均等级调整他们数值，不然我拿 1 级卡打 50 级」）：
  //   对面整副按比例换到你的平均等级 × mul，每张之间的高低照旧
  //   want 直接给数字＝换到那个等级（守城、远信的固定难度档用）
  function fairDeck(foeDeck, meDeck, mul, want0) {
    const fa = avgLv(foeDeck), want = want0 || avgLv(meDeck) * (mul || 1); if (!fa) return foeDeck;
    return foeDeck.map(u => { if (!u) return u; const l0 = Number(u.lv) || 1, l1 = Math.max(1, Math.round(l0 * want / fa));
      return Object.assign({}, u, { lv: l1, pow: Math.max(1, u.pow + lvPow(l1) - lvPow(l0)), maxHp: Math.max(1, u.maxHp + lvHp(l1) - lvHp(l0)) }); });
  }
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
    加急: { turns: 1, note: "下一次行动做两遍" },
    // 她 2026-11-08「盖戳只有下雨的是不是不够」：再加四种
    折角: { turns: 2, note: "挨打多掉 2" },
    撕口: { turns: 2, note: "每回合开头掉 2 血（不会掉到 0）" },
    封口: { turns: 2, note: "盖不了章，章也不攒" },
    挂号: { turns: 0, note: "给旁边一张自己的票加 3 层护（盖在自己人身上）" }
  };
  const MARK_OF_INK = ["雨渍", "退回", "受潮", "加急", "折角", "撕口", "封口", "挂号"];
  const SELF_INK = { 加急: 1, 受潮: 1, 挂号: 1 };   // 不盖在对面票上的那几种
  // 原来的「雨棚」改成通用的「护封」：上面的票什么戳都盖不上
  const TERRAIN = { 邮筒: "贴着票时每回合多 1 胶水", 护封: "上面的票不会被盖邮戳（什么戳都不行）", 破损: "这一格不能贴" };
  const EVENTS = {
    涨价: "这回合贴票面值都 +1",
    大雨: "这回合所有攻击 -1",
    集邮节: "这回合集邮票效果翻倍",
    加班: "这回合多抽 1 张",
    清仓: "这回合可以撕两张"
  };
  const EVENT_KEYS = Object.keys(EVENTS), EVENT_EVERY = 3;

  // ── 技能组（她 2026-11-08「技能组也做，现在只是点点点有点无聊」）────────────────
  //   每张票：一个被动「特质」（看卡上的字，认不出按编号）＋ 一个主动「章」（同一种票有四种，按编号分；SSR 效果加一半）。
  //   每个人：一个「羁绊」（看人设里的字），同一个人的票在自己信封上有两张以上就生效。
  const TRAITS = {
    冷静: { re: /冷静|平静|淡定|镇定|冷/g, desc: "不会被盖「退回」" },
    沉默: { re: /沉默|安静|不说话|不吭声|书/g, desc: "什么戳都盖不上它" },
    莽撞: { re: /冲|撞|急|莽|跑/g, desc: "攻击 +2，挨打时多掉 1" },
    守护: { re: /护|挡|守|等你|撑伞|伞/g, desc: "每回合开头给旁边的自己人加 1 层护" },
    记仇: { re: /恨|仇|怒|狠|气/g, desc: "每挨一次打攻击 +1（最多 +4）" },
    醉意: { re: /酒|醉|微醺/g, desc: "每次行动一半可能做双份，一半可能落空" },
    夜行: { re: /夜|月|影|黑暗|凌晨/g, desc: "在后排时攻击再 +2" },
    治愈: { re: /药|粥|汤|热水|包扎|医/g, desc: "每次行动完给自己回 2 血" },
    节俭: { re: /攒|钱|账|算|省/g, desc: "贴上时退回 1 胶水" },
    热烈: { re: /火|热|阳光|太阳|夏/g, desc: "打掉对面一张票时，对面信封再 -3" },
    黏人: { re: /抱|靠|牵|黏|蹭/g, desc: "旁边有同一个人的票时，每回合多 2 层护" },
    浪漫: { re: /花|星|雪|海|月光/g, desc: "盖章少攒一格" },
    倔强: { re: /不肯|倔|硬撑|偏要|不认输/g, desc: "第一次被打到 0 血时留 1 血" },
    机灵: { re: /笑|玩|逗|猫|狗|游戏/g, desc: "贴上时多抽 1 张" },
    余温: { re: /回忆|旧|曾经|以前|照片/g, desc: "被打掉时，给旁边的自己人各充 1 格章" },
    锋利: { re: /刀|剑|针|刺|锋/g, desc: "打票时无视护盾" }
  };
  const TRAIT_KEYS = Object.keys(TRAITS);
  const SKILLS = {
    投递: { 重击: "打同一列最前面那张两倍；列里空着就打信封", 贯穿: "同一列对面每一张都打一下", 直达: "越过所有票，直接打对面信封", 连打: "打同一列最前面那张两下（每下六成）" },
    火漆: { 封口: "给自己封两倍攻击那么多层护", 封整排: "给这一整排每张加攻击那么多层护", 加固: "全场自己人各加 2 层护，自己再加攻击那么多", 回敬: "下次挨打时，把一半伤害还给对面信封" },
    补票: { 补满: "把最残的那张补满", 群补: "全场自己人各回 4 血", 洗戳: "擦掉全场自己人身上的戳，各回 2 血", 拾回: "从用过的牌里捡回最强的一张到手里" },
    集邮: { 进账: "马上多 2 点胶水", 翻信箱: "马上抽 2 张", 截胶: "对面下回合少 1 胶水，自己马上多 1", 充章: "旁边的自己人各充 1 格章" },
    邮戳: { 盖一张: "给同一列对面最前面那张盖戳", 盖一列: "给同一列对面每一张都盖戳", 改寄: "把同一列对面最前面那张挤到后面的空格去", 封手: "对面下回合少抽 1 张" }
  };
  const BONDS = {
    护短: { re: /护短|保护欲|占有|吃醋|不许别人/g, desc: "这个人的票每回合各加 1 层护" },
    好胜: { re: /好胜|骄傲|不服|要强|争/g, desc: "这个人的票攻击各 +1" },
    温柔: { re: /温柔|体贴|细心|照顾/g, desc: "这个人的票每回合各回 1 血" },
    冷淡: { re: /冷淡|高冷|疏离|面无表情|话少/g, desc: "这个人的票不会被盖戳" },
    偏执: { re: /偏执|病娇|疯|执念|控制/g, desc: "这个人的票攻击各 +2，但每回合各掉 1 血" },
    默契: { re: /./g, desc: "这个人的票每回合各多充 1 格章" }
  };
  // 人设里的字 → 这个人的羁绊（几样都沾上数哪样多；都沾不上就是「默契」）
  function bondOf(text) {
    const t = String(text || ""); let best = "默契", n = 0;
    for (const k of Object.keys(BONDS)) { if (k === "默契") continue; const m = (t.match(BONDS[k].re) || []).length; if (m > n) { n = m; best = k; } }
    return best;
  }
  // 卡上没认出字的，不再满池子乱发（她 2026-11-08：很温柔的卡拿到「记仇」）：从跟这种票合得来的几样里挑
  const TRAIT_FIT = { 投递: ["莽撞", "锋利", "热烈", "记仇"], 火漆: ["守护", "倔强", "冷静", "黏人"], 补票: ["治愈", "余温", "守护", "浪漫"], 集邮: ["节俭", "机灵", "浪漫", "余温"], 邮戳: ["夜行", "沉默", "醉意", "冷静"] };
  // 返回 [特质, 从卡上哪几个字来的]（认不出就是空）
  function traitOf(card, hsh, role) {
    const tx = (card && card.text) || {};
    const words = [tx.name, tx.gist, tx.line, tx.narration, tx.thought, tx.highlight, tx.open, tx.real].map(clean).join(" ");
    let best = "", n = 0, from = [];
    for (const k of TRAIT_KEYS) { const m = words.match(TRAITS[k].re) || []; if (m.length > n) { n = m.length; best = k; from = m; } }
    if (best) return [best, Array.from(new Set(from)).slice(0, 3).join("、")];
    const fit = TRAIT_FIT[role] || TRAIT_KEYS;
    return [fit[(hsh >>> 4) % fit.length], ""];
  }
  // 给界面看的：这张票的特质、章、羁绊都是什么
  function unitInfo(u, bonds) {
    const sk = SKILLS[u.role] || {}, b = bonds && u.charId ? bonds[u.charId] : "";
    return { trait: { zh: u.trait, desc: (TRAITS[u.trait] || {}).desc || "", from: u.traitFrom ? "从卡上的「" + u.traitFrom + "」来的" : "卡上没认出特别的字，照它是" + u.role + "票配的" },
      skill: { zh: u.rarity === "SSR" ? u.name : u.skill, base: u.skill, desc: (sk[u.skill] || "") + (u.rarity === "SSR" ? "（SSR：效果加一半）" : "") },
      bond: b ? { zh: b, desc: BONDS[b].desc } : null };
  }

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
    let pow = BASE[r].pow + lvPow(lv) + jit, hp = BASE[r].hp + lvHp(lv) + ((hsh >>> 12) % 3);
    if (role === "火漆") { pow = Math.max(1, pow - 2); hp += 4; }
    if (role === "投递") pow += 2;
    const [trait, traitFrom] = traitOf(card, hsh, role), skillKeys = Object.keys(SKILLS[role]), skill = skillKeys[(hsh >>> 20) % skillKeys.length];
    const tx = (card && card.text) || {}, pk = (card && (card.pokes || card.pokesSolo || card.pokesDuo)) || {};
    return {
      cardId: card && card.id, charId: (card && card.charId) || "", rarity: r, lv, kind, limited: !!(card && card.limited),
      name: clean(tx.name) || (r + " 票"), role, trait, traitFrom, skill, face: FACE[r], pow: Math.max(1, pow), maxHp: hp, need: Math.max(1, NEED[r] - (trait === "浪漫" ? 1 : 0)),
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
  // core：她挑的「带谁」（她 2026-11-08：随机抽到四五个人凑不出组合技）——三分之二从这几个人的卡里抽，剩下随机
  function deckFrom(cards, seed, size, core) {
    const R = rng(seed), all = (cards || []).filter(Boolean), out = [], n = size || DECK_SIZE;
    const set = new Set((core || []).map(String)), pool = all.filter(c => !set.has(String(c.charId))), corePool = all.filter(c => set.has(String(c.charId)));
    const want = set.size ? Math.ceil(n * 2 / 3) : 0;
    while (out.length < want && corePool.length) out.push(corePool.splice(Math.floor(R() * corePool.length), 1)[0]);
    pool.push(...corePool);
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
  // 记下这一下是哪张票动的手（她 2026-11-08「结算时把卡拿起来，看得到是哪张打了哪张」）
  const say = (st, who, text, extra) => st.log.push(Object.assign({ turn: st.turn, who, text }, st.actor ? { from: { who: st.actor.who, slot: st.actor.slot, name: st.actor.name } } : {}, extra || {}));
  const withActor = (st, who, slot, fn) => { const sv = st.actor, u = st[who].board[slot]; st.actor = { who, slot, name: u ? u.name : "" }; try { return fn(); } finally { st.actor = sv; } };

  function terrainFor(seed) {
    const R = rng(seed), cells = shuffle([...Array(SLOTS).keys()], R), t = new Array(SLOTS).fill("");
    t[cells[0]] = "邮筒"; t[cells[1]] = "护封"; if (R() < 0.6) t[cells[2]] = "破损";
    return t;
  }
  function side(deck, seed, hp, max) {
    return { hp: hp || ENVELOPE_HP, max: max || hp || ENVELOPE_HP, board: new Array(SLOTS).fill(null), terrain: terrainFor(seed ^ 0x7777), draw: shuffle(deck, rng(seed)), discard: [], hand: [], kept: [],
      postage: 0, bonusPostage: 0, bonusDraw: 0, owed: 0, torn: 0, woke: {} };
  }
  // opts.blind：盲打——对面照样提前算好下一步，只是界面不给看（这一层照常算 intent，给不给看是界面的事）
  function newDuel(meDeck, foeDeck, seed, opts) {
    const s = (seed >>> 0) || 1, R = rng(s ^ 0x2468);
    const events = []; for (let t = EVENT_EVERY; t <= ((opts && opts.cap) || TURN_CAP); t += EVENT_EVERY) events[t] = EVENT_KEYS[Math.floor(R() * EVENT_KEYS.length)];
    // 让子、认真模式、快局（她 2026-11-08）：opts.meHp / opts.foeHp 改两边血，opts.cap 改最多几回合，opts.hard 对面每回合多 1 胶水
    const o = opts || {};
    // 对局：对面照你的平均等级；守城、远信：照难度档定的等级（o.foeLv），练强了才打得过高档
    if (o.fair !== false && (foeDeck || []).length && (meDeck || []).length) foeDeck = fairDeck(foeDeck, meDeck, o.fairMul, o.foeLv);
    const st = { turn: 0, me: side(meDeck, s, o.meHp || envFor(meDeck), o.meMax), relics: o.relics || [], amulet: !!o.amulet, bossRule: o.bossRule || "", theme: o.theme || "", siege: o.siege ? { waves: SIEGE_WAVES, cleared: 0 } : null, raid: o.raid ? { endless: o.raid === "endless", turns: RAID_TURNS, dealt: 0 } : null, foe: side(foeDeck, s ^ 0xabcdef, o.foeHp || envFor(meDeck)), log: [], over: null, uid: 0, seed: s, cap: o.cap || TURN_CAP, hard: !!o.hard, rule: o.rule || "", wager: o.wager || "", blind: !!(opts && opts.blind), events, bonds: (opts && opts.bonds) || {}, foeId: (opts && opts.foeId) || "", style: (opts && opts.style) || "" };
    st.keeps = (o.keeps || []).filter(k => k && KEEP_FX[k.fx]).map(k => ({ fx: k.fx, v: Math.max(1, Math.min(4, k.v | 0)), charId: k.charId || "", name: k.name || "" }));
    { const e = keepV(st, "env"); if (e) { st.me.max = (st.me.max || st.me.hp) + e * 5; st.me.hp += e * 5; } }
    st.meAvg = avgLv(meDeck); st.siegeLv = o.siegeLv || 0;
    if (st.raid) { st.foe.terrain = new Array(SLOTS).fill(""); st.foe.hp = st.foe.max = 99999; st.cap = st.raid.endless ? 99 : RAID_TURNS; st.raidLv = o.raidLv || Math.max(5, Math.round(st.meAvg || 10)); }
    if (st.siege) { st.foe.terrain = new Array(SLOTS).fill(""); st.foe.hp = st.foe.max = 999; st.cap = SIEGE_WAVES + 3; }
    startTurn(st);
    return st;
  }
  // 这一边信封上某个人的票有几张；两张以上羁绊生效
  const bondOn = (st, sd, u) => { const b = u && u.charId ? (st.bonds || {})[u.charId] : ""; return b && sd.board.filter(x => x && x.charId === u.charId).length >= 2 ? b : ""; };
  // 回合开头：守护、黏人、羁绊这些每回合一次的
  // 远信主题路线的规则（她 2026-11-08「四条都要」）：雪国冻住一格、海边潮汐换列；旧城在 powOf 里
  const blocked = (sd, i) => sd.terrain[i] === "破损" || sd.terrain[i] === "冰封";
  function themeEffects(st) {
    if (st.theme === "雪国") {
      const sd = st.me; sd.terrain = sd.terrain.map(t => t === "冰封" ? "" : t);
      const free = sd.board.map((u, i) => !u && !sd.terrain[i] ? i : -1).filter(i => i >= 0);
      if (free.length) { const i = free[Math.floor(rng(st.seed + st.turn * 977)() * free.length)]; sd.terrain[i] = "冰封"; say(st, "me", "一格结冰了，这回合贴不上", { kind: "ink", slot: i }); }
    }
    const mine = st.me.board.map((u, i) => u ? i : -1).filter(i => i >= 0), roll = rng(st.seed + st.turn * 131)();
    if (st.theme === "花季" && mine.length) { const i = mine[Math.floor(roll * mine.length)], u = st.me.board[i]; u.hp = Math.min(u.maxHp, u.hp + 2); say(st, "me", "花落在「" + u.name + "」上，回了 2 血", { kind: "heal", slot: i }); }
    if (st.theme === "雨季" && mine.length && st.turn > 1) { const i = mine[Math.floor(roll * mine.length)], u = st.me.board[i]; if (!(st.relics || []).includes("雨衣")) { u.marks.雨渍 = 1; say(st, "me", "雨打湿了「" + u.name + "」，这回合攻击 -2", { kind: "ink", slot: i }); } }
    if (st.theme === "TA 的城市" && st.me.board.some((u, i) => u && st.me.terrain[i] === "邮筒")) st.me.postage += 1;
    if (st.theme === "梦里" && st.turn === 1) {
      const R2 = rng(st.seed ^ 0x5151); for (let k = 0; k < 2; k++) { const a = st.me.draw, b = st.foe.draw; if (!a.length || !b.length) break; const i = Math.floor(R2() * a.length), j = Math.floor(R2() * b.length), t = a[i]; a[i] = b[j]; b[j] = t; }
      say(st, "me", "梦里两边的牌组换了两张");
    }
    if (st.theme === "海边" && st.turn > 1 && st.turn % 2 === 1) {
      ["me", "foe"].forEach(w => { const b = st[w].board; for (let r = 0; r < SIZE; r++) { const a = r * SIZE, c = a + SIZE - 1, t = b[a]; b[a] = b[c]; b[c] = t; } });
      say(st, "me", "涨潮了：两边的左右两列换了位置");
    }
  }
  function turnStartEffects(st, sd, who) {
    if (who === "me" && st.theme) themeEffects(st);
    if (who === "me" && st.keeps) { const hv = keepV(st, "heal"); if (hv && st.turn > 1) sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + hv); if (st.turn === 1) { const g = keepV(st, "glue"); if (g) sd.postage += g + 1; } }
    // 远信终点 TA 的特别规则（只管对面那一边）
    if (who === "foe" && st.bossRule) {
      const br = st.bossRule;
      if (br === "护短") sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + 2);
      if (br === "好胜") sd.postage += 1;
      if (br === "偏执") st.rage = (st.rage || 0) + 1;
      if (br === "温柔") sd.board.forEach(u => { if (u) u.hp = Math.min(u.maxHp, u.hp + 2); });
      if (br === "默契") sd.board.forEach(u => { if (u && u.charge < u.need) u.charge++; });
    }
    sd.board.forEach(u => { if (u && u.marks && u.marks.撕口) u.hp = Math.max(1, u.hp - 2); });
    // 护会散（她 2026-11-08「为啥他一直打掉我但是我打不掉他」：火漆每回合加护、从不掉，几回合就叠到十层，
    //   前排成了打不动的墙）：每回合开头先掉一半，再加这回合的
    sd.board.forEach(u => { if (u && u.shield && !(u.role === "火漆" && has(st, who, "不散的火漆"))) u.shield = Math.floor(u.shield / 2); });
    sd.board.forEach((u, i) => {
      if (!u) return;
      if (u.trait === "守护") adj(i).forEach(j => { if (sd.board[j]) sd.board[j].shield += 1; });
      if (u.trait === "黏人" && adj(i).some(j => sd.board[j] && u.charId && sd.board[j].charId === u.charId)) u.shield += 2;
      const b = bondOn(st, sd, u);
      if (b === "护短") u.shield += 1;
      if (b === "温柔") u.hp = Math.min(u.maxHp, u.hp + 1);
      if (b === "偏执") u.hp = Math.max(1, u.hp - 1);
      if (b === "默契" && u.charge < u.need) u.charge++;
    });
  }
  const eventNow = st => st.events[st.turn] || "";
  const eventNext = st => st.events[st.turn + 1] || "";
  const faceNow = (st, s) => s.face + (eventNow(st) === "涨价" ? 1 : 0);
  const tearCap = st => (eventNow(st) === "清仓" ? 2 : 1) + (has(st, "me", "撕票袋") ? 1 : 0);
  // 远信（肉鸽）的信物：只在她这一边生效（她 2026-11-08「做吧」）。界面上的名字和说明在 RELICS
  const has = (st, who, k) => who === "me" && !!(st.relics && st.relics.indexOf(k) >= 0);
  const RELICS = {
    胶水罐: "每回合多 1 点胶水", 快手: "每回合多抽 1 张", 不散的火漆: "你的火漆票，护不会散", 望远镜: "你后排的投递、邮戳攻击再 +2",
    双面胶: "你贴上的票血 +2", 封蜡: "你贴上的票自带 2 层护", 连号: "连张的加成再 +2", 雨衣: "你的票不会被盖「雨渍」",
    加急包: "你的投递每场第一次行动做两遍", 哨子: "每场第一回合多 2 点胶水", 撕票袋: "每回合能多撕一张", 预热: "你贴上的票先带 1 格章",
    护身符: "这一趟信封第一次被打空时，留 1 点", 旧照片: "你的票被打掉时，信封回 1", 锐利的戳: "你盖的戳多留一回合",
    厚信封: "信封耐久上限 +10", 回执: "每打完一场，信封回 4", 存钱罐: "每打完一场多 15 枚邮花", 优惠券: "邮局里东西便宜四分之一", 旅伴的伞: "驿站多回 10"
  };

  // ── 守城（她 2026-11-08「先做守城」）：对面不是人，是一波一波压过来的麻烦 ──────────────
  //   敌人贴在对面后排，每回合往前走一格，走到前排才动手；守过第 10 波、场上清空就赢，信封打空就输。
  //   每守住三波，信封回 5、下回合多摸一张。规则跟对局是同一套（贴票、胶水、盖章、组合都照旧）
  // 守城难度档：建议等级（她 2026-11-08「后面难度比我的卡都高我怎么赢」→ 固定档，卡练强了去打下一档）
  const SIEGE_TIERS = [5, 15, 25, 35, 50];
  const SIEGE_WAVES = 10, SIEGE_GROW = 0.1, SIEGE_HP = 1.5, SIEGE_POW = 0.4, SIEGE_BREACH = 0;
  const SIEGE_FOES = [
    ["野猫", ["投递", "投递", "投递"], "莽撞"], ["暴雨", ["邮戳", "投递", "邮戳"], "夜行"], ["罢工的邮差", ["火漆", "投递", "火漆"], "倔强"],
    ["审查员", ["邮戳", "火漆", "邮戳"], "冷静"], ["大风", ["投递", "邮戳", "投递"], "锋利"], ["迷路的信", ["集邮", "投递", "补票"], "余温"]
  ];
  function siegeWave(st, n) {
    const R = rng((st.seed ^ (n * 7919)) >>> 0), boss = n === SIEGE_WAVES, count = boss ? 3 : n <= 2 ? 1 : n <= 5 ? 2 : 3;
    return Array.from({ length: Math.min(3, count) }, (_, k) => {
      const f = boss && k === 0 ? ["稽查队长", ["火漆"], "倔强"] : SIEGE_FOES[Math.floor(R() * SIEGE_FOES.length)], role = f[1][Math.floor(R() * f[1].length)];
      const rar = boss && k === 0 ? "SSR" : n >= 7 && R() < 0.4 ? "SR" : "R";
      const u = stampOf({ id: "sg_" + n + "_" + k, rarity: rar, lv: Math.max(1, Math.round((st.siegeLv || st.meAvg || 10) * (0.5 + n * SIEGE_GROW))), text: { name: f[0] } });
      return Object.assign(u, { role, trait: f[2], traitFrom: "", charId: "", name: f[0], face: 0, skill: Object.keys(SKILLS[role])[k % 4], pow: Math.max(1, u.pow + Math.floor(n * SIEGE_POW) - (n <= 2 ? 1 : 0)), maxHp: Math.round(u.maxHp * SIEGE_HP) });
    });
  }
  function siegeTurn(st) {
    const sg = st.siege, foe = st.foe;
    foe.hand = []; foe.draw = []; foe.discard = []; foe.postage = 99;
    if (st.turn <= sg.waves) { foe.hand = siegeWave(st, st.turn); say(st, "foe", "第 " + st.turn + " 波来了：" + foe.hand.map(u => u.name).join("、"), { kind: "event", ev: "" }); }
    if (st.turn > 1 && (st.turn - 1) % 3 === 0 && st.turn - 1 <= sg.waves) { st.me.hp = Math.min(st.me.max || ENVELOPE_HP, st.me.hp + 5); st.me.bonusDraw += 1; say(st, "me", "守住了第 " + (st.turn - 1) + " 波：信封 +5，下回合多摸一张", { kind: "heal" }); }
  }
  // ── 讨伐（她 2026-11-08「做吧」：无期迷途的极限挑战 + 无尽试炼，加破核）──────────────
  //   对面是打不死的「邮政总局」：信封是无底的，比的是你打出多少伤害。每回合总局派几个人顶在前排，
  //   一部分身上贴着「封条」：封着的时候不管多疼都只掉 1；被邮戳打到、或被盖章打到，封条就撕开，
  //   接下来两回合它「虚弱」，挨的打翻倍。总局每回合还会盖一记大章砸你的信封，越往后越重。
  //   讨伐打满 8 回合算分；无尽一直打到你的信封空。三个阶段：1～3 回合、4～6 回合、7 回合以后
  const RAID_TURNS = 8, RAID_SLAM = 0.35, RAID_LV0 = 0.5;
  const RAID_FOES = [["总局稽查员", "火漆"], ["分拣员", "投递"], ["盖章机", "邮戳"], ["仓库管理员", "火漆"], ["退信科", "邮戳"], ["加急专员", "投递"]];
  const raidPhase = st => st.turn <= 3 ? 1 : st.turn <= 6 ? 2 : 3;
  const raidSlam = st => Math.round((1 + st.turn * (st.turn > RAID_TURNS ? 0.9 : RAID_SLAM)) * (1 + (st.raidLv || 10) / 60));
  function raidTurn(st) {
    const foe = st.foe, ph = raidPhase(st), R = rng((st.seed ^ (st.turn * 104729)) >>> 0);
    foe.hand = []; foe.draw = []; foe.discard = []; foe.postage = 99;
    foe.board.forEach(u => { if (u && u.weak) u.weak--; });
    const n = Math.min(3, ph + (st.raid.endless && st.turn > RAID_TURNS + 3 ? 1 : 0)) - (st.turn === 1 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const f = RAID_FOES[Math.floor(R() * RAID_FOES.length)], rar = ph === 3 && R() < 0.4 ? "SSR" : ph >= 2 && R() < 0.5 ? "SR" : "R";
      const lv = Math.max(1, Math.round(st.raidLv * (RAID_LV0 + st.turn * 0.05)));
      const u = stampOf({ id: "rd_" + st.turn + "_" + k, rarity: rar, lv, text: { name: f[0] } });
      foe.hand.push(Object.assign(u, { role: f[1], trait: "冷静", traitFrom: "", charId: "", name: f[0], face: 0, skill: Object.keys(SKILLS[f[1]])[k % 4], seal: ph >= 2 ? R() < 0.5 : R() < 0.3 }));
    }
    if (st.turn === 4 || st.turn === 7) say(st, "foe", st.turn === 4 ? "总局换了一批人：第二阶段，封条更多了" : "总局拿出了大章：第三阶段", { kind: "event", ev: "" });
  }
  const siegeIdle = (st, sd, i) => !!(st.siege && sd === st.foe && row(i) > 0);   // 守城：对面还没走到前排的不动手

  // ── 材料和专属信物（她 2026-11-08「打完或者某些路线掉落材料……花调用生成角色专属信物，从人设和我们聊天里来」）──
  //   材料是通用的，各有一个偏向；三样混着交给 TA，TA 照自己的人设和你们聊过的事做一件信物、写来历和一句话，
  //   效果从下面这张表里挑（只能挑三样材料偏向里有的），强弱由代码按材料定，模型不编数字
  const MATS = {
    旧邮票: "atk", 火漆块: "def", 信纸: "env", 邮戳墨: "stamp", 丝带: "bond", 干花: "heal", 胶水瓶: "glue",
    冻住的信: "def", 漂流瓶: "heal", 老照片: "bond", 车票根: "atk", 花瓣: "heal", 沙漏: "glue", 雨伞骨: "def", 山石: "env", 灯笼: "stamp", 梦的碎片: "stamp", 门牌: "bond",
    "TA 的东西": ""
  };
  const BASE_MATS = ["旧邮票", "火漆块", "信纸", "邮戳墨", "丝带", "干花", "胶水瓶"];
  const THEME_MAT = { 雪国: "冻住的信", 海边: "漂流瓶", 旧城: "老照片", 夜车: "车票根", 花季: "花瓣", 沙漠: "沙漏", 雨季: "雨伞骨", 山路: "山石", 节日: "灯笼", 梦里: "梦的碎片", "TA 的城市": "门牌" };
  const KEEP_FX = {
    atk: { zh: "锋", say: v => "你的票攻击 +" + v },
    def: { zh: "护", say: v => "你贴上的票自带 " + v * 2 + " 层护" },
    heal: { zh: "愈", say: v => "每回合开头信封回 " + v },
    glue: { zh: "裕", say: v => "第一回合多 " + (v + 1) + " 点胶水" },
    stamp: { zh: "印", say: v => "你贴上的票先带 " + v + " 格章" },
    env: { zh: "厚", say: v => "信封上限 +" + v * 5 },
    bond: { zh: "念", say: v => "这个人的票攻击 +" + (v + 1) + "、血 +" + v * 2 }
  };
  const KEEP_MAX_SLOTS = 3;
  // 三样材料能挑哪些效果、挑了某个效果有几档：同偏向的越多越强，「TA 的东西」再加一档，最多三档
  const keepFxOf = mats => Array.from(new Set((mats || []).map(m => MATS[m]).filter(Boolean)));
  const keepTier = (mats, fx) => Math.min(3, Math.max(1, (mats || []).filter(m => MATS[m] === fx).length) + ((mats || []).includes("TA 的东西") ? 1 : 0));
  // 这一局带着的信物：[{ fx, v, charId }]；跟这个人打、或这个人陪你走，再加一档（调用的那层算好传进来）
  const keepV = (st, fx, u) => (st.keeps || []).reduce((a, k) => a + (k.fx === fx && (fx !== "bond" || (u && u.charId === k.charId)) ? k.v : 0), 0);
  // 掉材料：kind=win/elite/boss/siege；theme 给主题材料
  function matDrop(seed, kind, theme, n) {
    const R = rng(seed >>> 0), out = [], k = n || (kind === "elite" ? 2 : kind === "boss" ? 2 : 1);
    for (let i = 0; i < k; i++) out.push(BASE_MATS[Math.floor(R() * BASE_MATS.length)]);
    if (theme && THEME_MAT[theme] && R() < 0.5) out.push(THEME_MAT[theme]);
    if (kind === "boss") out.push("TA 的东西");
    return out;
  }

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
      sd.postage = Math.max(0, Math.min(POSTAGE_CAP, POSTAGE + box + sd.bonusPostage - sd.owed + (st.hard && who === "foe" ? 1 : 0) + (has(st, who, "胶水罐") ? 1 : 0) + (st.turn === 1 && has(st, who, "哨子") ? 2 : 0)));
      drawCards(sd, Math.max(1, DRAW + sd.bonusDraw + (eventNow(st) === "加班" ? 1 : 0) + (has(st, who, "快手") ? 1 : 0)), st.seed + st.turn * 31 + (who === "me" ? 0 : 7));
      sd.bonusPostage = 0; sd.bonusDraw = 0; sd.owed = 0; sd.torn = 0;
      turnStartEffects(st, sd, who);
    }
    if (st.siege) siegeTurn(st);
    if (st.raid) raidTurn(st);
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
    if (blocked(sd, slot)) return { ok: false, why: sd.terrain[slot] === "冰封" ? "这一格结冰了，贴不上" : "这一格破了，贴不上" };
    const cost = faceNow(st, s); if (sd.postage < cost) return { ok: false, why: "胶水不够" };
    sd.postage -= cost; sd.hand.splice(handIdx, 1); sd.kept = sd.kept.filter(k => k !== handIdx).map(k => k > handIdx ? k - 1 : k);
    const u = Object.assign({}, s, { uid: ++st.uid, hp: s.maxHp, shield: 0, marks: {}, first: true, charge: 0 });
    if (has(st, who, "双面胶")) { u.maxHp += 2; u.hp += 2; }
    if (has(st, who, "封蜡")) u.shield += 2;
    if (has(st, who, "预热")) u.charge = 1;
    if (who === "me" && st.keeps && st.keeps.length) {
      const d = keepV(st, "def"), c = keepV(st, "stamp"), b = keepV(st, "bond", u);
      if (d) u.shield += d * 2; if (c) u.charge = Math.min(u.need, Math.max(u.charge, c)); if (b) { u.maxHp += b * 2; u.hp += b * 2; }
    }
    u.side = who;
    if (u.kind === "bday") u.shield += 3;
    if (u.kind === "anniv" || u.kind === "mybday") sd.bonusPostage += 1;
    if (u.role === "集邮") sd.bonusDraw += 1;
    if (u.trait === "节俭") sd.postage += 1;
    if (u.trait === "机灵") drawCards(sd, 1, st.seed + st.turn * 17 + slot);
    sd.board[slot] = u;
    say(st, who, u.name + " 贴上了", { kind: "place", slot, char: u.charId, line: u.lines.enter });
    checkCombos(st, who);
    return { ok: true };
  }
  function tearRaw(st, who, slot) { return withActor(st, who, slot, () => tearRaw0(st, who, slot)); }
  function tearRaw0(st, who, slot) {
    const sd = st[who], u = sd.board[slot], foe = st[other(who)];
    if (st.over || !u) return { ok: false, why: "这一格是空的" };
    if (sd.torn >= tearCap(st)) return { ok: false, why: "这回合撕够了" };
    sd.board[slot] = null; sd.discard.push(stripUnit(u)); sd.torn++;
    const k = u.limited ? 2 : 1;
    if (u.role === "投递") hitEnvelope(st, other(who), u.pow * k, u.name + " 撕下");
    else if (u.role === "火漆") sd.board.forEach(x => { if (x) x.shield += 2 * k; });
    else if (u.role === "补票") sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + 4 * k);
    else if (u.role === "集邮") sd.postage += 2 * k;
    else if (u.role === "邮戳") foe.board.forEach((x, i) => { if (x && col(i) === col(slot)) mark(foe, i, u.ink, st); });
    say(st, who, u.name + " 被撕下", { kind: "tear", slot });
    checkOver(st);
    return { ok: true };
  }
  function moveRaw(st, who, from, to) {
    const sd = st[who], u = sd.board[from];
    if (st.over || !u) return { ok: false, why: "这一格是空的" };
    if (!adj(from).includes(to) || sd.board[to]) return { ok: false, why: "只能挪到旁边的空格" };
    if (blocked(sd, to)) return { ok: false, why: "那一格贴不上" };
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
  function stampRaw(st, who, slot) { return withActor(st, who, slot, () => stampRaw0(st, who, slot)); }
  function stampRaw0(st, who, slot) {
    const sd = st[who], foeWho = other(who), foe = st[foeWho], u = sd.board[slot];
    if (st.over || !u) return { ok: false, why: "这一格是空的" };
    if (u.marks && u.marks.封口) return { ok: false, why: "被盖了「封口」，这两回合盖不了章" };
    if (u.charge < u.need) return { ok: false, why: "章还没攒满" };
    if (sd.postage < STAMP_COST) return { ok: false, why: "胶水不够" };
    sd.postage -= STAMP_COST; u.charge = 0; st.stamping = true;
    try { return stampBody(st, who, slot, sd, foeWho, foe, u); } finally { st.stamping = false; }
  }
  function stampBody(st, who, slot, sd, foeWho, foe, u) {
    const p0 = powOf(st, u, sd, slot), big = u.rarity === "SSR", p = big ? Math.ceil(p0 * 1.5) : p0, x = big ? 1.5 : 1;
    say(st, who, "盖章：" + (big ? u.name : u.skill), { kind: "stamp", slot, char: u.charId, line: big ? u.lines.wake : "", skill: u.skill });
    const c = col(slot), foeCol = [0, 1, 2].map(r => r * SIZE + c).filter(i => foe.board[i]), j = targetIn(foe, c);
    const k = u.skill;
    if (k === "重击") { if (j >= 0) hitUnit(st, foeWho, j, p * 2, u.name, u); else hitEnvelope(st, foeWho, p + 2, u.name); }
    else if (k === "贯穿") foeCol.forEach(i => hitUnit(st, foeWho, i, p, u.name, u));
    else if (k === "直达") hitEnvelope(st, foeWho, p + 3, u.name);
    else if (k === "连打") { for (let t = 0; t < 2; t++) { const jj = targetIn(foe, c); if (jj >= 0) hitUnit(st, foeWho, jj, Math.ceil(p * 0.6), u.name, u); else hitEnvelope(st, foeWho, Math.ceil(p * 0.6), u.name); } }
    else if (k === "封口") u.shield += p * 2;
    else if (k === "封整排") [0, 1, 2].forEach(q => { const v = sd.board[row(slot) * SIZE + q]; if (v) v.shield += p; });
    else if (k === "加固") { sd.board.forEach(v => { if (v) v.shield += Math.round(2 * x); }); u.shield += p; }
    else if (k === "回敬") { u.reflect = 1; u.shield += Math.ceil(p / 2); }
    else if (k === "补满") { const w = sd.board.filter(Boolean).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (w) w.hp = w.maxHp; if (big) sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + 4); }
    else if (k === "群补") sd.board.forEach(v => { if (v) v.hp = Math.min(v.maxHp, v.hp + Math.round(4 * x)); });
    else if (k === "洗戳") sd.board.forEach(v => { if (v) { v.marks = {}; v.hp = Math.min(v.maxHp, v.hp + Math.round(2 * x)); } });
    else if (k === "拾回") { const pile = sd.discard.slice().sort((a, b) => b.pow + b.maxHp - a.pow - a.maxHp); const n = big ? 2 : 1; pile.slice(0, n).forEach(v => { sd.discard.splice(sd.discard.indexOf(v), 1); sd.hand.push(v); }); }
    else if (k === "进账") sd.postage += Math.round(2 * x * (eventNow(st) === "集邮节" ? 2 : 1));
    else if (k === "翻信箱") drawCards(sd, Math.round(2 * x * (eventNow(st) === "集邮节" ? 2 : 1)), st.seed + st.turn * 13 + slot);
    else if (k === "截胶") { foe.owed = Math.min(3, foe.owed + (big ? 2 : 1)); sd.postage += 1; }
    else if (k === "充章") adj(slot).forEach(i => { const v = sd.board[i]; if (v) v.charge = Math.min(v.need, v.charge + (big ? 2 : 1)); });
    else if (k === "盖一张") { if (j >= 0) mark(foe, j, SELF_INK[u.ink] ? "退回" : u.ink, st); }
    else if (k === "盖一列") foeCol.forEach(i => mark(foe, i, SELF_INK[u.ink] ? "退回" : u.ink, st));
    else if (k === "改寄") { if (j >= 0) { const back = [SIZE - 1, 1].map(r => r * SIZE + c).find(i => i > j && !foe.board[i] && foe.terrain[i] !== "破损"); if (back != null) { foe.board[back] = foe.board[j]; foe.board[j] = null; say(st, who, "把对面的「" + foe.board[back].name + "」挤到后面去了", { kind: "ink", slot: back, ink: "改寄" }); } else hitUnit(st, foeWho, j, p, u.name, u); } }
    else if (k === "封手") foe.bonusDraw -= big ? 2 : 1;
    checkOver(st);
    return { ok: true };
  }
  const stripUnit = u => { const o = Object.assign({}, u); ["uid", "hp", "shield", "marks", "first", "charge", "grudge", "reflect", "stood"].forEach(k => delete o[k]); return o; };
  function mark(sd, i, m, st) {
    const u = sd.board[i]; if (!u || !MARKS[m]) return;
    if (m !== "加急") {
      if (sd.terrain[i] === "护封" || sd.terrain[i] === "雨棚" || u.trait === "沉默" || (m === "退回" && u.trait === "冷静")) return;
      if (st && bondOn(st, sd, u) === "冷淡") return;
      if (st && sd === st.foe && st.bossRule === "冷淡") return;
    }
    if (m === "雨渍" && sd === (st && st.me) && has(st, "me", "雨衣")) return;
    u.marks[m] = MARKS[m].turns + (st && sd === st.foe && has(st, "me", "锐利的戳") ? 1 : 0);
  }

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
      say(st, who, cb.type + "觉醒：" + lead.name, { kind: "wake", char: lead.charId, combo: cb.type, line: lead.lines.wake, slots: cb.ids });
      if (checkOver(st)) return;
    }
  }

  // ── 结算 ───────────────────────────────────────────────────────
  function powOf(st, u, sd, i) {
    let p = u.pow + (u.marks.雨渍 ? -2 : 0) + (eventNow(st) === "大雨" ? -1 : 0);
    const who0 = u.side || (sd === st.me ? "me" : "foe");
    if (who0 === "foe" && st.bossRule === "偏执") p += st.rage || 0;
    if (who0 === "me" && st.theme === "旧城" && u.old) p += 2;
    if (who0 === "me" && st.keeps) { p += keepV(st, "atk"); const b = keepV(st, "bond", u); if (b) p += b + 1; }                                    // 旧城：起手那几张老票更有劲
    if (adj(i).some(j => sd.board[j] && u.charId && sd.board[j].charId === u.charId)) p += 2 + (has(st, who0, "连号") ? 2 : 0);          // 连张
    if (row(i) === SIZE - 1 && (u.role === "投递" || u.role === "邮戳") && has(st, who0, "望远镜")) p += 2;
    if (row(i) === SIZE - 1 && (u.role === "投递" || u.role === "邮戳")) p += 2;                          // 后排输出
    if (u.trait === "莽撞") p += 2;
    if (u.trait === "记仇") p += Math.min(4, u.grudge || 0);
    if (u.trait === "夜行" && row(i) === SIZE - 1) p += 2;
    const b = bondOn(st, sd, u); if (b === "好胜") p += 1; else if (b === "偏执") p += 2;
    if (u.first && u.kind === "if") p *= 2;                                                              // IF 卡第一次做双份
    return Math.max(0, p);
  }
  // 打同一列：从前排往后找第一张——后排只要前面有人就挨不着
  function targetIn(sd, c) { for (let r = 0; r < SIZE; r++) { const i = r * SIZE + c; if (sd.board[i]) return i; } return -1; }
  function hitEnvelope(st, who, n, by) { if (n <= 0) return; if (st.raid && who === "foe") st.raid.dealt += n; st[who].hp -= n; say(st, other(who), (by ? "「" + by + "」" : "") + "打到信封 -" + n, { kind: "hitEnv", n }); }
  function hitUnit(st, who, i, n, by, att) {
    const sd = st[who], u = sd.board[i]; if (!u || n <= 0) return;
    if (u.trait === "莽撞") n += 1;
    if (u.marks && u.marks.折角) n += 2;
    // 讨伐的封条：封着只掉 1；邮戳或盖章打到就撕开，接下来两回合虚弱、挨打翻倍
    if (st.raid && sd === st.foe) {
      if (u.seal) { if ((att && att.role === "邮戳") || st.stamping) { u.seal = false; u.weak = 2; say(st, other(who), "「" + u.name + "」的封条撕开了，虚弱两回合", { kind: "ink", slot: i }); } else n = 1; }
      if (u.weak) n *= 2;
      st.raid.dealt += Math.max(0, Math.min(n, u.hp + u.shield));
    }
    const blocked = att && att.trait === "锋利" ? 0 : Math.min(u.shield, n); u.shield -= blocked; u.hp -= (n - blocked);
    if (u.trait === "记仇") u.grudge = (u.grudge || 0) + 1;
    say(st, other(who), "「" + by + "」打「" + u.name + "」 -" + n, { kind: "hit", slot: i, n, blocked });
    if (u.reflect) { u.reflect = 0; hitEnvelope(st, other(who), Math.ceil(n / 2), u.name + " 回敬"); }
    if (u.hp <= 0 && u.trait === "倔强" && !u.stood) { u.hp = 1; u.stood = 1; say(st, who, u.name + " 硬撑着没倒", { kind: "heal", slot: i }); return; }
    if (u.hp <= 0) {
      if (has(st, who, "旧照片")) sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + 1);
      sd.board[i] = null; sd.discard.push(stripUnit(u)); say(st, who, u.name + " 掉了", { kind: "fall", slot: i, char: u.charId, line: u.lines.fall });
      if (u.trait === "余温") adj(i).forEach(j => { const v = sd.board[j]; if (v && v.charge < v.need) v.charge++; });
      if (att && att.trait === "热烈") hitEnvelope(st, who, 3, att.name);
    }
  }
  function act(st, who, i) {
    const sd = st[who], foeWho = other(who), foe = st[foeWho], u = sd.board[i]; if (!u) return;
    if (siegeIdle(st, sd, i)) { const j = i - SIZE; if (j >= 0 && !sd.board[j]) { sd.board[j] = u; sd.board[i] = null; say(st, who, u.name + " 往前走了一格", { kind: "skip", slot: j }); } return; }
    // 守城：在前排站过一回合还没被打掉的，下一回合就闯过去，撞你的信封
    if (st.siege && sd === st.foe) { if (u.atGate) { hitEnvelope(st, "me", u.pow + SIEGE_BREACH, u.name + " 闯过去了"); sd.board[i] = null; checkOver(st); return; } u.atGate = 1; }
    if (u.marks.退回) { say(st, who, u.name + " 被退回，这回合不动", { kind: "skip", slot: i }); return; }
    let times = u.marks.加急 ? 2 : 1;
    if (u.role === "投递" && u.first && has(st, who, "加急包")) times *= 2;
    if (u.trait === "醉意") { const r = rng((st.seed ^ (st.turn * 2654435761) ^ (u.uid * 40503)) >>> 0)(); if (r < 0.5) times *= 2; else { say(st, who, u.name + " 醉得没打着", { kind: "skip", slot: i }); u.first = false; if (u.charge < u.need) u.charge++; return; } }
    for (let t = 0; t < times && sd.board[i] === u; t++) {
      const p = powOf(st, u, sd, i), j = targetIn(foe, col(i));
      // 每种票都打人（她 2026-11-08「每种卡都可以攻击吧不然太慢了」）：投递打满，别的打几成、再加自己的本事
      const side = n => { if (n <= 0 || sd.board[i] !== u) return; const jj = targetIn(foe, col(i)); if (jj >= 0) hitUnit(st, foeWho, jj, n, u.name, u); else hitEnvelope(st, foeWho, n, u.name); };
      if (u.role === "投递") { if (j >= 0) hitUnit(st, foeWho, j, p, u.name, u); else hitEnvelope(st, foeWho, p, u.name); }
      else if (u.role === "火漆") { u.shield += Math.max(1, Math.ceil(p / 2)); side(Math.ceil(p * ROLE_HIT.火漆)); }
      else if (u.role === "补票") {
        const hurt = sd.board.filter(x => x && x.hp < x.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (hurt) hurt.hp = Math.min(hurt.maxHp, hurt.hp + Math.max(2, Math.ceil(p / 2))); else sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + 2);
        const dirty = sd.board.find(x => x && (x.marks.雨渍 || x.marks.退回)); if (dirty) { delete dirty.marks.雨渍; delete dirty.marks.退回; }
        say(st, who, u.name + " 补了一下", { kind: "heal", slot: i }); side(Math.ceil(p * ROLE_HIT.补票));
      }
      else if (u.role === "集邮") { sd.bonusPostage += eventNow(st) === "集邮节" ? 2 : 1; say(st, who, u.name + " 攒了胶水", { kind: "gain", slot: i }); side(Math.ceil(p * ROLE_HIT.集邮)); }
      else if (u.role === "邮戳") {
        if (u.ink === "加急") { const k = adj(i).find(x => sd.board[x] && sd.board[x].role === "投递"); if (k != null) sd.board[k].marks.加急 = 1; }
        else if (u.ink === "受潮") foe.owed = Math.min(2, foe.owed + 1);
        else if (u.ink === "挂号") { const k = adj(i).filter(x => sd.board[x]).sort((a, b) => sd.board[a].hp - sd.board[b].hp)[0]; if (k != null) sd.board[k].shield += 3; }
        else if (j >= 0) mark(foe, j, u.ink, st);
        side(Math.ceil(p * ROLE_HIT.邮戳));
        say(st, who, u.name + " 盖了「" + u.ink + "」", { kind: "ink", slot: i, ink: u.ink });
      }
      if (checkOver(st)) return;
    }
    u.first = false;
    if (u.trait === "治愈" && sd.board[i] === u) u.hp = Math.min(u.maxHp, u.hp + 2);
    if (u.charge < u.need && !u.marks.封口) u.charge++;
  }
  function tickMarks(sd) { sd.board.forEach(u => { if (!u) return; Object.keys(u.marks).forEach(m => { if (--u.marks[m] <= 0) delete u.marks[m]; }); }); }
  function resolveSide(st, who) { for (let i = 0; i < SLOTS && !st.over; i++) withActor(st, who, i, () => act(st, who, i)); tickMarks(st[who]); }
  function checkOver(st) {
    if (st.over) return true;
    if (st.me.hp <= 0 && st.amulet && !st.amuletUsed) { st.amuletUsed = true; st.me.hp = 1; say(st, "me", "护身符替你挡了一下，信封留了 1 点", { kind: "heal" }); }
    const a = st.me.hp <= 0, b = st.foe.hp <= 0;
    if (a || b) st.over = { winner: a && b ? "draw" : a ? "foe" : "me", turn: st.turn, me: Math.max(0, st.me.hp), foe: Math.max(0, st.foe.hp) };
    return !!st.over;
  }

  // ── 对面怎么出：代码定，不花调用；开回合就算好（盲打时界面不给看）──────
  // 对面的出牌性格（她 2026-11-08 同意：出牌也要像他）：照他的羁绊定——
  //   护短先把前排顶满、好胜抢着往空列塞投递、偏执有章就盖不留后手、冷淡一回合最多贴两张慢慢攒、温柔自己人受伤先上补票
  const STYLE_ZH = { 护短: "先护着自己人", 好胜: "一上来就抢攻", 偏执: "有章就盖，不留后手", 冷淡: "慢慢攒，不急", 温柔: "先照顾受伤的", 默契: "稳扎稳打" };
  function planFoe(st) {
    const sd = st.foe, me = st.me, plan = [], stamps = [], board = sd.board.slice();
    let money = sd.postage;
    const style = st.style || (st.bonds || {})[st.foeId] || "默契";
    const hurt = sd.board.some(u => u && u.hp < u.maxHp * 0.6);
    const meThreat = c => { let n = 0; for (let r = 0; r < SIZE; r++) { const u = me.board[r * SIZE + c]; if (u && (u.role === "投递" || u.role === "邮戳")) n += u.pow; } return n; };
    // 先盖攒满的章（投递、邮戳的大招最值）
    const wantStamp = u => style === "偏执" || u.role === "投递" || u.role === "邮戳" || u.rarity === "SSR" || (style === "温柔" && u.role === "补票" && hurt) || (style === "护短" && u.role === "火漆");
    sd.board.forEach((u, i) => { if (u && u.charge >= u.need && money >= STAMP_COST && wantStamp(u)) { money -= STAMP_COST; stamps.push({ slot: i, name: u.name, role: u.role }); } });
    const pri = s => (style === "护短" && s.role === "火漆" ? 3 : 0) + (style === "好胜" && s.role === "投递" ? 3 : 0) + (style === "温柔" && hurt && s.role === "补票" ? 4 : 0) + (style === "冷淡" && s.role === "集邮" ? 3 : 0);
    const hand = sd.hand.map((s, k) => ({ s, k })).sort((a, b) => pri(b.s) - pri(a.s) || b.s.face - a.s.face || b.s.pow - a.s.pow);
    let placed = 0;
    for (const { s, k } of hand) {
      if (style === "冷淡" && placed >= 2) break;
      const cost = faceNow(st, s); if (cost > money) continue;
      const free = board.map((x, i) => x || blocked(sd, i) ? -1 : i).filter(i => i >= 0); if (!free.length) break;
      const score = i => (s.role === "火漆" ? meThreat(col(i)) * 3 + (row(i) === 0 ? (style === "护短" ? 12 : 6) : 0) : 0)
        + (style === "好胜" && s.role === "投递" && targetIn(me, col(i)) < 0 ? 8 : 0)
        + ((s.role === "投递" || s.role === "邮戳") ? (row(i) === SIZE - 1 && board[col(i)] ? 5 : 0) + (targetIn(me, col(i)) < 0 ? 3 : 0) : 0)
        + adj(i).filter(j => board[j] && board[j].charId && board[j].charId === s.charId).length * 4
        + (sd.terrain[i] === "邮筒" ? 2 : 0) - row(i) * 0.1;
      const slot = st.raid ? (free.filter(i => row(i) === 0)[0] ?? free.sort((a, b) => row(a) - row(b))[0]) : st.siege ? (free.filter(i => row(i) === 1)[0] ?? free.sort((a, b) => row(b) - row(a))[0]) : free.sort((a, b) => score(b) - score(a))[0];
      board[slot] = s; money -= cost; placed++; plan.push({ handIdx: k, slot, name: s.name, role: s.role, face: cost, cardId: s.cardId, charId: s.charId });
    }
    let toEnv = 0; const inks = [];
    board.forEach((u, i) => { if (!u) return; if (u.role === "投递" && targetIn(me, col(i)) < 0) toEnv += u.pow; if (u.role === "邮戳") inks.push(u.ink); });
    return { place: plan, stamp: stamps, toEnvelope: toEnv, inks: inks.filter(x => x !== "加急"), nextEvent: eventNext(st), style, styleZh: STYLE_ZH[style] || "" };
  }
  // 谁会打谁（她 2026-11-08「明牌的时候能不能也用虚线显示他要干啥」）：只算不动手，给界面画线
  //   to=-1 是打信封；kind: hit 打票／env 打信封／ink 盖戳；planned=这张还在手里、下回合才贴上
  function aimOf(st, sd, foe, i, u) {
    if (siegeIdle(st, sd, i)) return null;
    if (st.siege && sd === st.foe && u.atGate) return { from: i, to: -1, dmg: u.pow + SIEGE_BREACH, kind: "env", breach: true };
    const p = powOf(st, u, sd, i), j = targetIn(foe, col(i));
    if (u.role === "投递") return { from: i, to: j, dmg: p, kind: j >= 0 ? "hit" : "env" };
    const d = Math.ceil(p * (ROLE_HIT[u.role] || 0)); if (d <= 0) return null;
    if (u.role === "邮戳" && j >= 0 && !SELF_INK[u.ink]) return { from: i, to: j, dmg: d, kind: "ink", ink: u.ink };
    return { from: i, to: j, dmg: d, kind: j >= 0 ? "hit" : "env" };
  }
  function aims(st, who) {
    if (who === "foe" && st.raid && !st.over) return aims0(st, who).concat([{ from: -1, to: -1, dmg: raidSlam(st), kind: "env", slam: true }]);
    return aims0(st, who);
  }
  function aims0(st, who) {
    const sd = st[who], foe = st[other(who)], keep = sd.board, board = keep.slice(), planned = {};
    if (who === "foe") ((st.intent || {}).place || []).forEach(pl => { const s = sd.hand.find(x => x && x.cardId === pl.cardId); if (s && !board[pl.slot]) { board[pl.slot] = Object.assign({}, s, { marks: {}, hp: s.maxHp, shield: 0, charge: 0 }); planned[pl.slot] = 1; } });
    sd.board = board; const out = [];
    try { board.forEach((u, i) => { if (!u || (u.marks && u.marks.退回)) return; const a = aimOf(st, sd, foe, i, u); if (a) out.push(Object.assign(a, planned[i] ? { planned: true } : {})); }); }
    finally { sd.board = keep; }
    return out;
  }
  // 每张票这回合干什么，一句话（她 2026-11-08「看不到他另外两张卡打多少，或者我能打他多少」）
  function actsOf(st, who) {
    const sd = st[who], al = aims(st, who), out = {};
    const pre = { 补票: "补血·", 集邮: "攒胶水·", 火漆: "加护·" };
    const tag = u => !u ? "" : u.seal ? "封条·" : u.weak ? "虚弱·" : "";
    al.forEach(a => { const u = sd.board[a.from], p0 = (u && pre[u.role]) || ""; if (a.from < 0) return; out[a.from] = a.breach ? "要闯过去 " + a.dmg : tag(u) + p0 + (a.kind === "ink" ? "盖" + a.ink + "·打 " + a.dmg : a.kind === "env" ? "打信封 " + a.dmg : "打 " + a.dmg); });
    sd.board.forEach((u, i) => { if (!u || out[i]) return;
      if (siegeIdle(st, sd, i)) out[i] = "往前走";
      else if (u.marks && u.marks.退回) out[i] = "这回合不动";
      else if (u.role === "集邮") out[i] = "攒胶水";
      else if (u.role === "补票") out[i] = "补血";
      else if (u.role === "火漆") out[i] = "加护";
      else if (u.role === "邮戳") out[i] = u.ink === "加急" ? "给旁边加急" : u.ink === "受潮" ? "让对面受潮" : u.ink === "挂号" ? "给旁边挂号" : "";
    });
    return out;
  }
  // 手里这张要是贴在 slot：会打谁、打多少、凑不凑得成组合
  function previewPlace(st, who, handIdx, slot) {
    const sd = st[who], s = sd.hand[handIdx]; if (!s || sd.board[slot] || blocked(sd, slot)) return null;
    const u = Object.assign({}, s, { marks: {}, hp: s.maxHp, shield: 0, charge: 0 }), keep = sd.board, board = keep.slice(); board[slot] = u; sd.board = board;
    try {
      const a = aimOf(st, sd, st[other(who)], slot, u), combo = [];
      if (u.charId && adj(slot).some(j => board[j] && board[j].charId === u.charId)) combo.push("连张");
      if (u.charId) { const r = row(slot), c = col(slot), same = k => board[k] && board[k].charId === u.charId;
        if ([0, 1, 2].every(x => same(r * SIZE + x)) || [0, 1, 2].every(x => same(x * SIZE + c))) combo.push("整版"); }
      return { aim: a, combo, cost: faceNow(st, s), afford: sd.postage >= faceNow(st, s) };
    } finally { sd.board = keep; }
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
    if (!st.over && st.raid) { const n = raidSlam(st); hitEnvelope(st, "me", n, "总局盖章"); checkOver(st);
      if (st.over) st.over.raid = true; else if (!st.raid.endless && st.turn >= RAID_TURNS) st.over = { winner: "me", turn: st.turn, me: st.me.hp, foe: 0, raid: true }; }
    if (st.over && st.raid) st.over.raid = true;
    if (!st.over && st.siege) { const left = st.foe.board.some(Boolean); st.siege.cleared = Math.min(st.siege.waves, Math.max(st.siege.cleared, left ? st.turn - 1 : st.turn));
      if ((st.turn >= st.siege.waves && !left) || st.turn >= st.cap) st.over = { winner: "me", turn: st.turn, me: st.me.hp, foe: 0, siege: true }; }
    if (!st.over && st.turn >= (st.cap || TURN_CAP)) st.over = { winner: st.me.hp === st.foe.hp ? "draw" : st.me.hp > st.foe.hp ? "me" : "foe", turn: st.turn, me: st.me.hp, foe: st.foe.hp, byCap: true };
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
  const API = { RELICS, STYLE_ZH, TRAIT_FIT, TRAITS, SKILLS, BONDS, bondOf, unitInfo, SIZE, SLOTS, ENVELOPE_HP, POSTAGE, DRAW, DECK_SIZE, TURN_CAP, KEEP_MAX, FACE, NEED, ROLES, MARKS, TERRAIN, EVENTS,
    stampOf, deckFrom, foeDeckFrom, RAID_TURNS, MATS, BASE_MATS, THEME_MAT, KEEP_FX, KEEP_MAX_SLOTS, keepFxOf, keepTier, matDrop, SIEGE_TIERS, newDuel, envFor, avgLv, fairDeck, aims, actsOf, previewPlace, place, tear, move, keep, stamp, undo, canUndo, endTurn, planFoe, combos, newSeries, addGame, memoryLine, hashStr };
  g.StampDuel = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
