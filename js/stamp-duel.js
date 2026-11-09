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
  // 胶水随回合涨（她 2026-11-08 同意）：1–3 回合 3 点，4–6 回合 4 点，7 回合起 5 点；攒的上限 7 不动
  const postageOf = turn => POSTAGE + (turn >= 7 ? 2 : turn >= 4 ? 1 : 0);
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
    延误: { turns: 1, note: "对面下回合胶水 -1" },   // 原来叫「受潮」，跟雨渍听着像一回事（她 2026-11-08），改名
    加急: { turns: 1, note: "下一次行动做两遍" },
    // 她 2026-11-08「盖戳只有下雨的是不是不够」：再加四种
    折角: { turns: 2, note: "挨打多掉 2" },
    撕口: { turns: 2, note: "每回合开头掉 2 血（不会掉到 0）" },
    封口: { turns: 2, note: "盖不了章，章也不攒" }
  };
  const MARK_OF_INK = ["雨渍", "退回", "延误", "加急", "折角", "撕口", "封口"];
  const SELF_INK = { 加急: 1, 延误: 1 };   // 不盖在对面票上的那几种
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
    冷静: { re: /冷静|平静|淡定|镇定|冷/g, desc: "被盖的戳只挂一回合" },
    沉默: { re: /沉默|安静|不说话|不吭声|书/g, desc: "什么戳都盖不上它" },
    莽撞: { re: /冲|撞|急|莽|跑/g, desc: "攻击 +2，挨打时多掉 1" },
    守护: { re: /护|挡|守|等你|撑伞|伞/g, desc: "每回合开头给旁边的自己人加 1 层护" },
    记仇: { re: /恨|仇|怒|狠|气/g, desc: "每挨一次打攻击 +1（最多 +4）" },
    醉意: { re: /酒|醉|微醺/g, desc: "每次行动一半可能做双份，一半可能落空" },
    夜行: { re: /夜|月|影|黑暗|凌晨/g, desc: "在后排时攻击再 +2" },
    治愈: { re: /药|粥|汤|热水|包扎|医/g, desc: "每次行动完给自己回 2 血" },
    节俭: { re: /攒|钱|账|算|省/g, desc: "贴上时退回 1 胶水，SSR 退 2" },
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
    火漆: { 厚封: "给自己封两倍攻击那么多层护", 封整排: "给这一整排每张加攻击那么多层护", 加固: "全场自己人各加 2 层护，自己再加攻击那么多", 回敬: "下次挨打时，把一半伤害还给对面信封" },
    补票: { 补满: "把最残的那张补满", 群补: "全场自己人各回 4 血", 洗戳: "擦掉全场自己人身上的戳，各回 2 血", 拾回: "从用过的牌里捡回最强的一张到手里", 转寄: "把自己人身上最坏的一个戳，转盖到对面同一列最前面那张身上" },
    集邮: { 进账: "马上多 2 点胶水", 翻信箱: "马上抽 2 张", 截胶: "对面下回合少 1 胶水，自己马上多 1", 充章: "旁边的自己人各充 1 格章" },
    邮戳: { 盖一张: "给同一列对面最前面那张盖戳，再打它两倍", 盖一列: "给同一列对面每一张都盖戳", 改寄: "把同一列对面最前面那张挤到后面的空格去", 封手: "对面下回合少抽 1 张", 加盖: "同一列对面每一张身上已有的戳，全都多挂一回合" }
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
    return [fit[hashStr(String(card && card.id) + "|trait") % fit.length], ""];
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
    return best || ROLES[pickWeighted(hashStr(String(card && card.id) + "|role"), ROLE_WEIGHT)];
  }
  // 一张邮票册的卡 → 一张能上场的票
  function stampOf(card) {
    const r = BASE[card && card.rarity] ? card.rarity : "R";
    const lv = Math.max(1, Number(card && card.lv) || 1), hsh = hashStr(card && card.id);
    const kind = card && card.kind ? String(card.kind) : "";
    const role = roleOf(card, hsh);
    // 每一样各自单独哈希（她 2026-11-08「看看有没有跟盖戳一样的编号问题」）：原来都从同一个数里切几截，切出来的几样会连着偏
    const hk = k => hashStr(String(card && card.id) + "|" + k), jit = hk("jit") % 3 - 1;
    let pow = BASE[r].pow + lvPow(lv) + jit, hp = BASE[r].hp + lvHp(lv) + (hk("hp") % 3);
    if (role === "火漆") { pow = Math.max(1, pow - 2); hp += 4; }
    if (role === "投递") pow += 2;
    const [trait, traitFrom] = traitOf(card, hsh, role), skillKeys = Object.keys(SKILLS[role]), skill = skillKeys[hk("skill") % skillKeys.length];
    const tx = (card && card.text) || {}, pk = (card && (card.pokes || card.pokesSolo || card.pokesDuo)) || {};
    return {
      cardId: card && card.id, charId: (card && card.charId) || "", rarity: r, lv, kind, limited: !!(card && card.limited),
      name: clean(tx.name) || (r + " 票"), role, trait, traitFrom, skill, face: FACE[r], pow: Math.max(1, pow), maxHp: hp, need: Math.max(1, NEED[r] - (trait === "浪漫" ? 1 : 0)),
      ink: MARK_OF_INK[hashStr(String(card && card.id) + "|ink") % MARK_OF_INK.length],   // 单独再哈希一次，免得一批卡挤在同一种戳上
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
    // core 里可以夹 "card:<id>"：陪打的人点名要带的那张，一定进卡组（她 2026-11-08「TA 帮我挑卡组」）
    const must = (core || []).map(String).filter(x => x.indexOf("card:") === 0).map(x => x.slice(5));
    must.forEach(id => { const k = all.findIndex(c => String(c.id) === id); if (k >= 0 && out.length < n) out.push(all.splice(k, 1)[0]); });
    const set = new Set((core || []).map(String).filter(x => x.indexOf("card:") !== 0)), pool = all.filter(c => !set.has(String(c.charId))), corePool = all.filter(c => set.has(String(c.charId)));
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
    const st = { turn: 0, me: side(meDeck, s, o.meHp || envFor(meDeck), o.meMax), relics: o.relics || [], amulet: !!o.amulet, bossRule: o.bossRule || "", theme: o.theme || "", siege: o.siege ? { waves: SIEGE_WAVES, cleared: 0 } : null, edict: Array.isArray(o.edict) ? o.edict.filter(k => EDICTS[k]) : null, raid: o.raid ? { endless: o.raid === "endless", turns: RAID_TURNS, dealt: 0 } : null, foe: side(foeDeck, s ^ 0xabcdef, o.foeHp || envFor(meDeck)), log: [], over: null, uid: 0, seed: s, cap: o.cap || TURN_CAP, hard: !!o.hard, rule: o.rule || "", wager: o.wager || "", blind: !!(opts && opts.blind), events, bonds: (opts && opts.bonds) || {}, foeId: (opts && opts.foeId) || "", style: (opts && opts.style) || "" };
    st.keeps = (o.keeps || []).filter(k => k && KEEP_FX[k.fx]).map(k => ({ fx: k.fx, v: Math.max(1, Math.min(4, k.v | 0)), charId: k.charId || "", name: k.name || "" }));
    { const e = keepV(st, "env"); if (e) { st.me.max = (st.me.max || st.me.hp) + e * 5; st.me.hp += e * 5; } }
    st.meAvg = avgLv(meDeck); st.siegeLv = o.siegeLv || 0;
    if (st.edict) {
      const E = k => st.edict.includes(k), fix = u => u && Object.assign(u, { pow: u.pow + (E("foeAtk") ? 2 : 0), maxHp: Math.round(u.maxHp * (E("foeHp") ? 1.4 : 1)) });
      st.foe.draw.forEach(fix); st.foe.hand.forEach(fix);
      if (E("foeEnv")) { st.foe.hp += 20; st.foe.max = (st.foe.max || st.foe.hp - 20) + 20; }
      if (E("meEnv")) { st.me.hp = Math.max(10, st.me.hp - 15); st.me.max = Math.max(10, (st.me.max || st.me.hp + 15) - 15); }
      if (E("foeGlue")) st.hard = true; if (E("blind")) st.blind = true; if (E("short")) st.cap = 8;
      st.edictPts = st.edict.reduce((a, k) => a + EDICTS[k].pt, 0);
    }
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
  // ── 封缄令（她 2026-11-08「做封缄合约吧，名字不要合约两个字」；照明日方舟危机合约）──────────
  //   开局自己勾难度条，每条有分；打赢了，勾的分加起来就是这一把的「危险」。对面是代码造的「审查局」，等级固定
  const EDICTS = {
    foeAtk: { zh: "对面攻击 +2", pt: 2 }, foeHp: { zh: "对面票的血 +40%", pt: 2 }, foeGlue: { zh: "对面每回合多 1 胶水", pt: 2 },
    foeShield: { zh: "对面贴上的票自带 3 层护", pt: 1 }, foeEnv: { zh: "对面信封 +20", pt: 2 },
    meEnv: { zh: "你的信封 -15", pt: 2 }, meGlue: { zh: "你每回合少 1 胶水", pt: 3 }, meDraw: { zh: "你每回合少摸 1 张", pt: 3 },
    noTear: { zh: "不能撕票", pt: 1 }, noMove: { zh: "不能挪票", pt: 1 }, noStamp: { zh: "前两回合盖不了章", pt: 2 },
    short: { zh: "最多 8 回合，打不完算输", pt: 2 }, blind: { zh: "盲打（看不见对面下一步）", pt: 1 }
  };
  const EDICT_LV = 25;
  const edictOn = (st, k) => !!(st.edict && st.edict.includes(k));
  function edictDeck(seed) {
    const R = rng(seed ^ 0x5eed);
    return Array.from({ length: DECK_SIZE }, (_, i) => { const f = SIEGE_FOES[Math.floor(R() * SIEGE_FOES.length)], role = f[1][i % f[1].length], rar = R() < 0.15 ? "SSR" : R() < 0.4 ? "SR" : "R";
      const u = stampOf({ id: "ed_" + seed + "_" + i, rarity: rar, lv: EDICT_LV, text: { name: "审查局·" + f[0] } });
      return Object.assign(u, { role, trait: f[2], traitFrom: "", charId: "", skill: Object.keys(SKILLS[role])[i % 4] }); });
  }
  // ── 邮局值班（她 2026-11-08「继续下一个玩法」：照保全派驻那样，每轮之间用钱买票凑阵容）─────────
  //   开局没票、10 枚邮花；柜台每轮摆 5 张你邮票册里的票，买进值班卡组；同一张买两份合成「＋」；
  //   同一个人凑满 3 张，这个人的票攻击 +1；买好跟这一轮的审查局打一局，输了掉一条命；撑满 8 轮算完成
  const SHIFT = { ROUNDS: 8, LIVES: 3, START: 10, INCOME: 5, PRICE: { R: 2, SR: 3, SSR: 5 }, REROLL: 1, BENCH: 12, SHOP: 5, PLUS_MAX: 2 };
  function shiftNew(seed) { return { seed: (seed >>> 0) || 1, round: 1, lives: SHIFT.LIVES, coins: SHIFT.START, bench: [], shop: [], rolls: 0, done: null, log: [] }; }
  function shiftRoll(sh, cards, paid) {
    if (paid) { if (sh.coins < SHIFT.REROLL) return false; sh.coins -= SHIFT.REROLL; }
    const pool = (cards || []).filter(c => c && c.text), R = rng((sh.seed ^ (sh.round * 7349) ^ (++sh.rolls * 104723)) >>> 0);
    sh.shop = Array.from({ length: Math.min(SHIFT.SHOP, pool.length) }, () => stampOf(pool[Math.floor(R() * pool.length)]));
    return true;
  }
  const shiftPrice = u => SHIFT.PRICE[u.rarity] || 2;
  function shiftBuy(sh, i) {
    const u = sh.shop[i]; if (!u) return { ok: false, why: "这一格空了" };
    const cost = shiftPrice(u); if (sh.coins < cost) return { ok: false, why: "邮花不够" };
    const same = sh.bench.find(b => b.cardId && b.cardId === u.cardId && (b.plus || 0) < SHIFT.PLUS_MAX);
    if (!same && sh.bench.length >= SHIFT.BENCH) return { ok: false, why: "值班卡组满了（" + SHIFT.BENCH + " 张），先卖一张" };
    sh.coins -= cost; sh.shop.splice(i, 1);
    if (same) { same.plus = (same.plus || 0) + 1; same.pow += 2; same.maxHp += 3; same.name = same.name.replace(/＋+$/, "") + "＋".repeat(same.plus); return { ok: true, merged: same.name }; }
    sh.bench.push(Object.assign({}, u)); return { ok: true };
  }
  function shiftSell(sh, i) { const u = sh.bench[i]; if (!u) return 0; const back = Math.max(1, Math.floor(shiftPrice(u) * (1 + (u.plus || 0)) / 2)); sh.bench.splice(i, 1); sh.coins += back; return back; }
  // 这一轮带进对局的卡组：同一个人满 3 张的，攻击 +1
  function shiftDeck(sh) {
    const n = {}; sh.bench.forEach(u => { if (u.charId) n[u.charId] = (n[u.charId] || 0) + 1; });
    return sh.bench.map(u => Object.assign({}, u, n[u.charId] >= 3 ? { pow: u.pow + 1 } : {}));
  }
  const shiftBonds = sh => { const n = {}; sh.bench.forEach(u => { if (u.charId) n[u.charId] = (n[u.charId] || 0) + 1; }); return n; };
  const shiftFoeLv = sh => Math.max(3, Math.round(avgLv(sh.bench) * (0.75 + 0.06 * sh.round)));
  function shiftAfter(sh, win) {
    if (win) sh.coins += 1; else sh.lives--;
    sh.log.push({ round: sh.round, win: !!win });
    if (sh.lives <= 0) { sh.done = { win: false, round: sh.round }; return sh; }
    if (sh.round >= SHIFT.ROUNDS) { sh.done = { win: true, round: sh.round }; return sh; }
    sh.round++; sh.coins += SHIFT.INCOME + Math.min(3, Math.floor(sh.coins / 5)); sh.rolls = 0; return sh;
  }
  // ── 邮区巡查（她 2026-11-08「继续做玩法」：照赛季探索那样，大地图自己挑方向翻格子）────────────
  //   5×5，每周自动换一张、每个人各不一样（她 2026-11-08「不要每周我们自己弄，给代码每个人每周刷新出不同的」：
  //   种子＝第几周 × 这台设备自己的随机数 salt），从最下面中间出发，只能走到上下左右相邻的格子，走到哪翻开到哪；
  //   14 步；信封血一路带着；打赢、开宝箱、打倒巡查长加分；步数用完、信封空、或打倒巡查长就结束
  const PATROL = { N: 5, STEPS: 14, PTS: { fight: 10, elite: 25, chest: 15, boss: 60 }, HEAL: 15 };
  const PATROL_THEMES = ["雪国", "海边", "旧城", "夜车", "花季", "沙漠", "雨季", "山路", "梦里"];
  const weekNo = d => { const t = d || new Date(), j = new Date(t.getFullYear(), 0, 1); return t.getFullYear() * 100 + Math.ceil(((t - j) / 86400000 + j.getDay() + 1) / 7); };
  // TA 的格子（她 2026-11-08「巡查格子里出现跟陪打的人有关的东西」）：挑了陪打的人才放，一张图 3 个
  const TA_CELLS = { tparcel: "TA 的包裹", twait: "TA 在等你", tpostcard: "TA 的明信片", tscene: "小剧场", tmemory: "回忆" };
  const TA_PTS = { tpostcard: 10, tscene: 15, tmemory: 15 };
  function patrolNew(deck, now, salt, withTA) {
    const wk = weekNo(now), R = rng(((wk * 2654435761) ^ ((salt >>> 0) || 0)) >>> 0), N = PATROL.N, cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let t = R() < 0.42 ? "fight" : R() < 0.5 ? "chest" : R() < 0.35 ? "event" : R() < 0.4 ? "rest" : R() < 0.35 ? "elite" : "empty";
      cells.push({ r, c, type: t, open: false, done: false });
    }
    const at = (r, c) => cells[r * N + c];
    const start = at(N - 1, Math.floor(N / 2)); start.type = "start"; start.open = true; start.done = true;
    const bossC = Math.floor(R() * N); at(0, bossC).type = "boss";
    if (withTA) { const pool = cells.filter(x => x.type !== "start" && x.type !== "boss" && x.r > 0), keys = Object.keys(TA_CELLS);
      for (let k = 0; k < 3 && pool.length; k++) { const x = pool.splice(Math.floor(R() * pool.length), 1)[0]; x.type = keys[Math.floor(R() * keys.length)]; } }
    const env = envFor(deck), p = { week: wk, theme: PATROL_THEMES[(wk + ((salt >>> 0) || 0)) % PATROL_THEMES.length], seed: ((wk * 7919) ^ ((salt >>> 0) || 0)) >>> 0, cells, pos: [N - 1, Math.floor(N / 2)], steps: PATROL.STEPS, hp: env + 10, max: env + 10, score: 0, log: [], done: null };
    patrolPeek(p); return p;
  }
  // 站着的格子四周翻开（看得到是什么，没去过）
  function patrolPeek(p) { const N = PATROL.N, [r, c] = p.pos; [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([a, b]) => { if (a >= 0 && b >= 0 && a < N && b < N) p.cells[a * N + b].open = true; }); }
  const patrolCan = (p, r, c) => !p.done && p.steps > 0 && r >= 0 && c >= 0 && r < PATROL.N && c < PATROL.N && Math.abs(p.pos[0] - r) + Math.abs(p.pos[1] - c) === 1;
  // 走一步；返回这一格要做什么：fight/elite/boss 要打一场（界面去开），别的当场结算
  function patrolMove(p, r, c) {
    if (!patrolCan(p, r, c)) return null;
    const cell = p.cells[r * PATROL.N + c]; p.pos = [r, c]; p.steps--; cell.open = true; patrolPeek(p);
    if (cell.done) { if (p.steps <= 0) p.done = { why: "steps" }; return { type: "walk" }; }
    const R = rng((p.seed ^ (r * 131 + c * 17 + p.steps * 7)) >>> 0);
    if (cell.type === "chest") { cell.done = true; p.score += PATROL.PTS.chest; p.log.push("开了宝箱 +" + PATROL.PTS.chest); }
    else if (cell.type === "rest") { cell.done = true; p.hp = Math.min(p.max, p.hp + PATROL.HEAL); p.log.push("驿站歇脚，信封 +" + PATROL.HEAL); }
    else if (cell.type === "event") { cell.done = true; const x = R(); if (x < 0.4) { p.steps += 2; p.log.push("抄了条近路，多 2 步"); } else if (x < 0.7) { p.hp = Math.min(p.max, p.hp + 6); p.score += 5; p.log.push("捡到一封迷路的信，信封 +6、+5 分"); } else { p.hp = Math.max(1, p.hp - 6); p.score += 12; p.log.push("冒雨抄近路，信封 -6、+12 分"); } }
    else if (cell.type === "empty") { cell.done = true; p.log.push("这一格什么也没有"); }
    else if (cell.type === "tparcel") { cell.done = true; p.log.push("捡到 TA 留在这儿的一个小包裹"); }
    else if (cell.type === "twait") { cell.done = true; p.hp = Math.min(p.max, p.hp + 10); p.steps += 2; p.log.push("TA 在这儿等你：信封 +10，多 2 步"); }
    else if (TA_PTS[cell.type]) { cell.done = true; p.score += TA_PTS[cell.type]; p.log.push(TA_CELLS[cell.type] + " +" + TA_PTS[cell.type]); if (p.steps <= 0) p.done = { why: "steps" }; return { type: cell.type, ask: true }; }
    if (["fight", "elite", "boss"].includes(cell.type)) return { type: cell.type, cell };
    if (p.steps <= 0) p.done = { why: "steps" };
    return { type: cell.type };
  }
  const patrolDepth = p => PATROL.N - 1 - p.pos[0];
  // 这一格那一场怎么开（等级照你卡组、越往上越高；巡查长最硬）
  function patrolBattle(p, deck, type) {
    const mul = type === "boss" ? 1.15 : type === "elite" ? 1.0 : 0.72 + patrolDepth(p) * 0.06, s = (p.seed ^ (p.pos[0] * 97 + p.pos[1] * 13 + p.steps * 101)) >>> 0;
    return { foeDeck: edictDeck(s), seed: s || 1, opts: { foeLv: Math.max(3, Math.round(avgLv(deck) * mul)), meHp: p.hp, meMax: p.max, foeHp: Math.round(envFor(deck) * (type === "boss" ? 1.1 : type === "elite" ? 0.8 : 0.55)), cap: 10, hard: type !== "fight" } };
  }
  function patrolAfter(p, type, win, hpLeft) {
    const cell = p.cells[p.pos[0] * PATROL.N + p.pos[1]];
    // 输了不直接结束（一场没打过整趟归零太狠）：败退——信封留 1 点、扣 2 步，这一格还在，能再来
    p.hp = win ? Math.max(1, hpLeft) : Math.max(1, hpLeft);
    if (!win) { p.steps = Math.max(0, p.steps - 2); p.log.push("没打过，败退：信封剩 " + p.hp + "，少 2 步"); }
    if (win) { cell.done = true; p.score += PATROL.PTS[type] || 0; p.log.push((type === "boss" ? "打倒了巡查长" : type === "elite" ? "打赢一场硬仗" : "打赢一场") + " +" + (PATROL.PTS[type] || 0)); }
    if (win && type === "boss") p.done = { why: "boss" }; else if (p.steps <= 0) p.done = { why: "steps" };
    return p;
  }
  // ── 残局（她 2026-11-08「继续做残局吧」）：一回合内打空对面信封 ─────────────────────────
  //   题目代码生成、人人一样（第几关＝种子）；求解器把这一手所有放法试一遍，对面信封正好设成「最好的放法能打出的伤害」，
  //   所以每题都有解、而且得找到最好的那一手；随手按顺序往空格里贴就能过的题丢掉重出
  const PUZZLE_MAX = 30;
  // 同一关里每张票名字都不一样（同名的话提示说「那张」分不清，她也会混）
  const PZ_NAMES = ["信鸽", "邮差", "火漆印", "集邮簿", "邮戳", "挂钟", "纸鹤", "邮包", "旧信封", "邮筒", "明信片", "车票", "灯塔", "风铃", "墨水瓶", "木箱"];
  let pzPool = [];
  function pzUnit(R, lv, role, i, tag) {
    if (!pzPool.length) pzPool = shuffle(PZ_NAMES.slice(), R);
    const rar = R() < 0.15 ? "SSR" : R() < 0.45 ? "SR" : "R", u = stampOf({ id: "pz_" + tag + "_" + i, rarity: rar, lv, text: { name: pzPool.pop() } });
    return Object.assign(u, { role: role || u.role, charId: "pz" + (Math.floor(R() * 3)), skill: Object.keys(SKILLS[role || u.role])[Math.floor(R() * 4)] });
  }
  const pzClone = st => JSON.parse(JSON.stringify(st));
  // 照现在场上的样子寄出去，这一下能打掉对面多少（她 2026-11-09 死信想不出怎么算 → 给个「现在寄出能打多少」）
  function simSend(st0) { const st = pzClone(st0), hp0 = st.foe.hp; st.undo = []; try { resolveSide(st, "me"); } catch (e) { return 0; } return hp0 - st.foe.hp; }
  // 这一回合（只放手里的票、给攒满的票盖章）最多能打掉对面多少：遍历每张手牌放哪格或不放，再加盖不盖章
  function pzSolve(st0) {
    const me = st0.me, free = me.board.map((u, i) => !u && !blocked(me, i) ? i : -1).filter(i => i >= 0), hand = me.hand.length;
    const stamps = me.board.map((u, i) => u && u.charge >= u.need ? i : -1).filter(i => i >= 0);
    let best = 0, cnt = 0, total = 0, plan = null;
    const tryOne = (assign, stampSet) => {
      const st = pzClone(st0), hp0 = st.foe.hp; st.undo = [];
      for (const i of stampSet) if (!stampRaw(st, "me", i).ok) return;
      // 手牌下标会挪，按从后往前放
      const order = assign.map((slot, k) => [k, slot]).filter(x => x[1] >= 0).sort((a, b) => b[0] - a[0]);
      for (const [k, slot] of order) if (!placeRaw(st, "me", k, slot).ok) return;
      resolveSide(st, "me"); const d = hp0 - Math.max(0, st.foe.hp) + (st.foe.hp < 0 ? -st.foe.hp : 0);
      total++; if (d > best) { best = d; cnt = 1; plan = { stamps: stampSet.slice(), place: order.map(([k, slot]) => ({ cardId: st0.me.hand[k].cardId, slot })) }; } else if (d === best) cnt++;
    };
    const subsets = []; for (let m = 0; m < (1 << stamps.length); m++) subsets.push(stamps.filter((_, b) => m & (1 << b)));
    const rec = (k, assign, used) => {
      if (k === hand) { subsets.forEach(ss => tryOne(assign, ss)); return; }
      rec(k + 1, assign.concat(-1), used);
      free.forEach(sl => { if (!used.includes(sl)) rec(k + 1, assign.concat(sl), used.concat(sl)); });
    };
    rec(0, [], []);
    return { best, ways: cnt, total, plan };
  }
  // 随手的那一手：手牌按顺序往第一个空格贴，攒满的都盖
  function pzNaive(st0) { const st = pzClone(st0), hp0 = st.foe.hp; st.me.board.forEach((u, i) => { if (u && u.charge >= u.need) stampRaw(st, "me", i); });
    while (st.me.hand.length) { const f = st.me.board.findIndex((u, i) => !u && !blocked(st.me, i)); if (f < 0 || !placeRaw(st, "me", 0, f).ok) break; } resolveSide(st, "me"); return hp0 - st.foe.hp; }
  // 30 关以后接着出（她 2026-11-08「打完了咋办」）：难度到 30 关封顶，题照样每关不同；salt 给每日残局用（日期×各人随机数）
  function puzzleOf(lv0, salt) {
    const lv = Math.min(lv0, PUZZLE_MAX), key = ((lv0 * 7919) ^ ((salt >>> 0) || 0)) >>> 0;
    for (let t = 0; t < 40; t++) {
      const R = rng((key ^ (t * 104729) ^ 0x5a5a) >>> 0), ulv = 6 + lv * 2; pzPool = shuffle(PZ_NAMES.slice(), R);
      const st = newDuel([pzUnit(R, ulv, "", 0, lv + "m")], [pzUnit(R, ulv, "火漆", 0, lv + "f")], ((key * 31 + t) >>> 0) || 1, { fair: false, foeHp: 999, meHp: 30 });
      st.events = []; st.me.hand = []; st.me.draw = []; st.me.discard = []; st.foe.hand = []; st.foe.draw = []; st.foe.discard = []; st.foe.board = new Array(SLOTS).fill(null); st.me.board = new Array(SLOTS).fill(null); st.log = [];
      const nFoe = Math.min(4, 1 + Math.floor(lv / 4)), fslots = shuffle([0, 1, 2, 3, 4, 5], R).slice(0, nFoe);
      fslots.forEach((i, k) => { const u = pzUnit(R, ulv, R() < 0.5 ? "火漆" : "投递", k, lv + "fb" + t); st.foe.board[i] = Object.assign(u, { uid: ++st.uid, hp: u.maxHp, shield: R() < 0.3 ? 2 : 0, marks: {}, first: false, charge: 0 }); });
      const nMine = lv >= 6 ? 1 + (lv >= 14 ? 1 : 0) : 0, mslots = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !blocked(st.me, i)), R).slice(0, nMine);
      mslots.forEach((i, k) => { const u = pzUnit(R, ulv, "", k, lv + "mb" + t); st.me.board[i] = Object.assign(u, { uid: ++st.uid, hp: u.maxHp, shield: 0, marks: {}, first: false, charge: R() < 0.7 ? u.need : 0 }); });
      st.me.hand = Array.from({ length: lv < 10 ? 3 : 4 }, (_, k) => pzUnit(R, ulv, "", k, lv + "h" + t));
      st.me.postage = 3 + Math.floor(lv / 8) + (lv >= 10 ? 1 : 0); st.me.kept = []; st.me.torn = 0;
      const sol = pzSolve(st); if (sol.best < 6) continue;
      if (pzNaive(Object.assign(pzClone(st), { foe: Object.assign(pzClone(st).foe, { hp: sol.best }) })) >= sol.best && t < 39) continue;
      st.foe.hp = st.foe.max = sol.best; st.puzzle = { lv: lv0, best: sol.best, ways: sol.ways, total: sol.total, plan: sol.plan }; st.cap = 1; st.intent = planFoe(st);
      return st;
    }
    return null;
  }
  // ── 接力（她 2026-11-08「和他一起的玩法，不太一样的」→ 接力）：你和 TA 轮流下同一块棋盘 ─────────
  //   单数回合你下，双数回合 TA 下：TA 那回合照 TA 的性子（羁绊）出牌——护短先顶前排、好胜抢着贴投递、
  //   冷淡一回合最多贴两张、温柔有人受伤先上补票、偏执有章就盖；跟对面那套打法同一个想法，只是换到你这边
  function autoMe(st, style) {
    const sd = st.me, foe = st.foe, acts = [];
    const hurt = sd.board.some(u => u && u.hp < u.maxHp * 0.6);
    sd.board.forEach((u, i) => { if (u && u.charge >= u.need && sd.postage >= STAMP_COST && (style !== "冷淡" || u.role === "投递")) { if (stampRaw(st, "me", i).ok) acts.push({ stamp: i, name: u.name }); } });
    const threat = c => { let n = 0; for (let r = 0; r < SIZE; r++) { const u = foe.board[r * SIZE + c]; if (u) n += u.pow; } return n; };
    const pri = s => (style === "护短" && s.role === "火漆" ? 4 : 0) + (style === "好胜" && s.role === "投递" ? 4 : 0) + (style === "温柔" && hurt && s.role === "补票" ? 5 : 0) + s.face;
    let placed = 0;
    for (let guard = 0; guard < 6; guard++) {
      if (style === "冷淡" && placed >= 2) break;
      const k = sd.hand.map((s2, k2) => ({ s: s2, k: k2 })).filter(x => faceNow(st, x.s) <= sd.postage).sort((a, b) => pri(b.s) - pri(a.s))[0]; if (!k) break;
      const free = sd.board.map((u, i) => !u && !blocked(sd, i) ? i : -1).filter(i => i >= 0); if (!free.length) break;
      const s0 = k.s, score = i => (s0.role === "火漆" ? threat(col(i)) * 2 + (row(i) === 0 ? 6 : 0) : 0) + ((s0.role === "投递" || s0.role === "邮戳") ? (row(i) === SIZE - 1 ? 5 : 0) + (targetIn(foe, col(i)) < 0 ? 4 : 0) : 0)
        + adj(i).filter(j => sd.board[j] && sd.board[j].charId && sd.board[j].charId === s0.charId).length * 4 + (sd.terrain[i] === "邮筒" ? 2 : 0);
      const slot = free.sort((a, b) => score(b) - score(a))[0];
      if (!placeRaw(st, "me", k.k, slot).ok) break; placed++; acts.push({ place: slot, name: s0.name });
    }
    return acts;
  }
  // ── 邮局小店（她 2026-11-08「店面可以做，不进记忆」「好多角色怎么弄」）──────────────────────
  //   四个岗位排店员（一个角色也能开：一个人顶一个岗）；按人设关键词有擅长的岗位；客人多是路人，难缠的要打一局；
  //   不上班的角色会来当客人。钱买装修，装修加收入、打烊那段也会写到
  const SHOP = {
    POSTS: ["柜台", "分拣", "送信", "看店"],
    APT: { 柜台: /温柔|笑|耐心|礼貌|体贴|会说话/, 分拣: /细心|安静|书|整理|认真|一丝不苟/, 送信: /跑|运动|冲|骑|腿|活泼/, 看店: /懒|猫|睡|闲|发呆|慢/ },
    // 价钱 ×3（她 2026-11-08「打赢一个客人 75、装修 30 就能买，太快」），招待能对上需求以后再 ×1.2
    DECOR: [
      { k: "旧木招牌", price: 110, bonus: 0.05 }, { k: "一盆绿萝", price: 140, bonus: 0.05 }, { k: "暖黄的吊灯", price: 220, bonus: 0.08 }, { k: "靠窗的长凳", price: 290, bonus: 0.08 },
      { k: "铜铃门帘", price: 360, bonus: 0.1 }, { k: "整面墙的信格", price: 540, bonus: 0.12 }, { k: "会走的老座钟", price: 720, bonus: 0.12 }, { k: "二楼的小阁楼", price: 1150, bonus: 0.18 }
    ],
    // 每月限定两样（她 2026-11-08「装修只有八种弄完了咋办」）：当月才买得到，买了一直留着
    MONTHLY: { 1: [["窗花", 220], ["一碗腊八粥的香味", 290]], 2: [["春联", 220], ["一串小灯笼", 320]], 3: [["一枝早樱", 250], ["风筝挂饰", 290]], 4: [["雨伞架", 220], ["一盆铃兰", 320]], 5: [["新茶的茶罐", 250], ["竹帘", 320]],
      6: [["驱蚊香包", 220], ["玻璃风铃", 320]], 7: [["西瓜冰柜", 290], ["一把蒲扇", 220]], 8: [["萤火虫灯", 320], ["星空窗贴", 250]], 9: [["一盒月饼", 290], ["桂花枝", 250]], 10: [["南瓜灯", 290], ["一叠落叶书签", 220]],
      11: [["围巾挂钩", 220], ["热可可的小炉", 320]], 12: [["小圣诞树", 320], ["一墙贺卡", 290]] },
    NPC: [["寄信的老太太", "给孙子寄一包毛线袜", 8, "送信"], ["赶时间的学生", "加急寄一份报名表", 10, "送信"], ["沉默的画家", "寄一卷画", 12, "分拣"], ["迷路的旅人", "问路，顺手买几张明信片", 6, "卡"], ["花店老板", "寄一盒压花", 9, "分拣"], ["邻居小孩", "给笔友寄信，钱不太够", 4, "柜台"], ["退休的邮差", "来坐坐，顺便寄张贺卡", 7, "柜台"]],
    TOUGH: [["难缠的审查员", "说你家的邮戳不合规", 18], ["来砸场子的对家", "说要把客人都抢走", 22], ["吵着退款的客人", "坚持说信寄丢了", 16]]
  };
  // 橱窗、工牌（她 2026-11-08「店面经营想能联动上抽到的卡」）：橱窗每张按稀有度、等级加收入；
  //   上班的人挂一张自己的卡当工牌，这个岗再 +10%；点名要某人明信片的客人，橱窗里有那个人的卡才卖得出
  const SHOP_WIN = { R: 0.03, SR: 0.06, SSR: 0.1 };
  const shopWinSlots = shop => 3 + ((shop.decor || []).includes("整面墙的信格") ? 2 : 0);
  const shopWinBonus = (shop, cardOf) => (shop.window || []).map(cardOf).filter(Boolean).reduce((a, c) => a + (SHOP_WIN[c.rarity] || 0.03) + Math.min(0.05, (Number(c.lv) || 1) / 1000), 0);
  const shopApt = (persona, post) => SHOP.APT[post] && SHOP.APT[post].test(String(persona || "")) ? 1 : 0;
  // 今天的收入倍数：每排一个岗 +15%，排到擅长的岗再 +10%，装修各加一点
  // 装修：基础八样 + 每月限定；每样能翻新到三级（价钱翻倍，加成多一半）
  const shopDecorOf = k => SHOP.DECOR.find(d => d.k === k) || (() => { for (const m in SHOP.MONTHLY) { const x = SHOP.MONTHLY[m].find(y => y[0] === k); if (x) return { k, price: x[1], bonus: 0.06, month: +m }; } return null; })();
  const shopDecorBonus = shop => (shop.decor || []).reduce((a, k) => { const d = shopDecorOf(k); return a + (d ? d.bonus * (1 + 0.5 * (((shop.decorLv || {})[k] || 1) - 1)) : 0); }, 0);
  const shopUpPrice = (shop, k) => { const d = shopDecorOf(k), lv = (shop.decorLv || {})[k] || 1; return lv >= 3 || !d ? 0 : d.price * Math.pow(2, lv); };
  // 工牌（她 2026-11-08「工牌选哪张没作用」→ 两样都要）：按稀有度、等级加；卡的作用对上岗位再 +5%（✦）
  const SHOP_BADGE = { R: 0.06, SR: 0.1, SSR: 0.15 }, SHOP_BADGE_FIT = { 柜台: ["补票"], 分拣: ["邮戳"], 送信: ["投递"], 看店: ["火漆", "集邮"] };
  const shopBadgeFit = (post, card) => !!(card && (SHOP_BADGE_FIT[post] || []).includes(stampOf(card).role));
  const shopBadgeBonus = (post, card) => card ? (SHOP_BADGE[card.rarity] || 0.06) + Math.min(0.03, (Number(card.lv) || 1) / 1000) + (shopBadgeFit(post, card) ? 0.05 : 0) : 0;
  // 客人的需求：post＝该交给哪个岗；card＝要哪种卡（role 种类／min 稀有度／who 某人的）
  const SHOP_RANK = { R: 1, SR: 2, SSR: 3 };
  const shopNeedZh = n => !n ? "" : n.post ? (n.post === "送信" ? "要寄出去" : n.post === "分拣" ? "东西多，要人帮着理" : "要在柜台算钱") + "（该交给" + n.post + "岗）"
    : n.card && n.card.role ? "想挑一张「" + n.card.role + "」的卡" : n.card && n.card.min ? "想挑一张 " + n.card.min + " 以上的卡" : "";
  const shopCardFits = (n, card) => !!(n && n.card && card && (n.card.role ? stampOf(card).role === n.card.role : n.card.min ? (SHOP_RANK[card.rarity] || 0) >= SHOP_RANK[n.card.min] : true));
  const SHOP_THANKS = {
    送信: ["「赶得上就好，谢谢你们。」", "「那就拜托了，一定要寄到啊。」", "「比我想的快多了。」"],
    分拣: ["「这么一堆，理得真快。」", "「我自己弄了一晚上都没弄好。」", "「下回还来你们家。」"],
    柜台: ["「算得清清楚楚，放心了。」", "「零钱也帮我凑好了，谢谢。」", "「你们这儿的人真耐心。」"],
    卡: ["「就是这种！我找了好久。」", "「这张好看，送人正合适。」", "「你们橱窗里的卡挑得真好。」"]
  };
  // ── 招待那一下要动脑（她 2026-11-09，参考《Good Pizza》《Recettear》）：客人不直说要什么，只说一句；开价看人 ──
  const MOOD_RICH = /西装|教授|合同|加急|赶时间|新婚|摄影师|调音师|纪念邮票/, MOOD_POOR = /小孩|小男孩|学生|高中生|钱不够|零钱|笔友|生日卡/;
  const shopMood = (txt, urgent) => urgent || MOOD_RICH.test(txt) ? "rich" : MOOD_POOR.test(txt) ? "poor" : "normal";
  const MOOD_ZH = { rich: "看着挺急，钱包鼓鼓的", poor: "掏钱包的时候有点犹豫", normal: "" };
  const HINT_POST = {
    送信: ["这个今天能寄出去吗？那边等着呢。", "我想寄到很远的地方，越快越好。", "麻烦帮我送出去，路上别耽搁。", "要寄到外地，最好明早就到。"],
    分拣: ["东西有点多，我自己也理不清楚……", "这一摞能不能帮我分一分，有寄本市的也有外地的。", "箱子挺沉的，里面零零碎碎好多样。", "攒了半年的信，想一次寄完。"],
    柜台: ["先问问，寄这个要多少钱？", "我钱带得不太够，能不能先算一下？", "要几张邮票，怎么贴最划算？", "想买一整版，帮我挑挑面值。"]
  };
  const HINT_ROLE = { 投递: "要一张看着就很能打的卡", 火漆: "要一张看着靠得住、能护着人的卡", 补票: "要一张温柔点、会照顾人的卡", 集邮: "要一张看着会过日子、精打细算的卡", 邮戳: "要一张有点坏心眼、爱捉弄人的卡" };
  function shopHint(need, mood, R) {
    if (!need) return "";
    const say = need.post ? HINT_POST[need.post][Math.floor(R() * HINT_POST[need.post].length)] : need.card && need.card.role ? "想送人，" + HINT_ROLE[need.card.role] + "。" : need.card && need.card.min ? "想要一张稀罕点的，送人拿得出手。" : "";
    return say + (MOOD_ZH[mood] ? "（" + MOOD_ZH[mood] + "）" : "");
  }
  // 开价：便宜点 ×0.8 交情多一点；照价；收贵点 ×1.35——急的、熟客认，犹豫的会走，一般人一半一半（按客人定死，不能反复试）
  function shopPrice(c, price, bond) {
    if (price === "low") return { mul: 0.8, rep: 5, bond: 1, say: "客人笑着多说了几句谢谢" };
    if (price !== "high") return { mul: 1, rep: 0, bond: 0, say: "" };
    const ok = c.mood === "rich" || (bond || 0) >= 3 || (c.mood !== "poor" && hashStr(String(c.id) + "|price") % 2 === 0);
    return ok ? { mul: 1.35, rep: 0, bond: 0, say: "客人没还价就付了" } : c.mood === "poor" ? { mul: 0, rep: -5, bond: 0, say: "客人摇摇头，东西没寄就走了", left: true } : { mul: 1, rep: -5, bond: 0, say: "客人嘀咕了一句太贵，还是照原价付了" };
  }
  // 稀客：条件凑上时每个时段 15% 来一位（一天最多一位），招待过收进熟客簿的「稀客」
  const RARE_GUESTS = [
    { id: "ghost", name: "穿旧制服的老邮差", want: "说要来寄一封五十年前没寄出去的信", fee: 40, need: { post: "送信" }, hint: "这封信……能帮我寄出去吗？晚了好多年了。", cond: { period: "傍晚", decor: "会走的老座钟" }, tip: "傍晚、店里有老座钟" },
    { id: "rainman", name: "撑黑伞的寄信人", want: "每封信都用蜡封好", fee: 35, need: { post: "分拣" }, hint: "这几封要分开寄，一封都不能弄混。", cond: { decor: "铜铃门帘", day: 7 }, tip: "铜铃门帘挂上一周以后" },
    { id: "kid", name: "举着玻璃罐的小女孩", want: "要把攒的硬币换成邮票", fee: 30, need: { post: "柜台" }, hint: "这些……够买几张邮票呀？", cond: { period: "上午", rep: 5 }, tip: "口碑 5 级以后的上午" },
    { id: "collector", name: "戴单片眼镜的集邮家", want: "来看看橱窗里有没有好东西", fee: 60, need: { card: { min: "SSR" } }, hint: "听说你们橱窗里有好货？我只要最稀罕的。", cond: { rep: 10, windowSSR: true }, tip: "口碑 10 级、橱窗里摆着 SSR" },
    { id: "snow", name: "满头是雪的旅人", want: "从很北的地方来，想寄一张明信片回家", fee: 45, need: { post: "送信" }, hint: "能寄到最北边吗？那边快过年了。", cond: { month: [12, 1, 2] }, tip: "冬天（12 到 2 月）" },
    { id: "cat", name: "蹲在门口的三花猫", want: "叼来一片叶子放在柜台上", fee: 20, need: null, hint: "喵。", cond: { decor: "靠窗的长凳" }, tip: "店里有靠窗的长凳" },
    { id: "author", name: "抱着稿子的作家", want: "要把新书稿寄给编辑", fee: 50, need: { post: "分拣" }, hint: "这摞稿子要按章节分好再寄……我自己都乱了。", cond: { period: "下午", decor: "整面墙的信格" }, tip: "下午、店里有整面墙的信格" },
    { id: "bride", name: "穿婚纱跑进来的新娘", want: "要在婚礼开始前寄出一封信", fee: 70, need: { post: "送信" }, hint: "快快快！这封信一定要今天到！", cond: { rep: 15 }, tip: "口碑 15 级以后" }
  ];
  function shopRareFor(shop, period, R) {
    const seen = (shop.rareDay && shop.rareDay === shop.date), lv = shopRepLv(shop), m = new Date().getMonth() + 1, decor = shop.decor || [];
    if (seen || R() > 0.15) return null;
    const ok = RARE_GUESTS.filter(g => { const c = g.cond; if (c.period && c.period !== period) return false; if (c.decor && !decor.includes(c.decor)) return false; if (c.rep && lv < c.rep) return false; if (c.month && !c.month.includes(m)) return false; if (c.day && (shop.day || 1) < c.day) return false; if (c.windowSSR && !(shop.windowRar || []).includes("SSR")) return false; return true; });
    return ok.length ? ok[Math.floor(R() * ok.length)] : null;
  }
  // ── 小店一直玩下去（她 2026-11-09「能一直玩下去不会结束」）：口碑、每周大单、熟客、店员熟练度，都不封顶 ──
  //   口碑只让店变大（客人、单子、收入），不碰战斗：难缠客人始终照她卡组的平均等级来（她：卡等级有上限）
  const shopRepNeed = lv => 60 + 20 * lv;
  const shopRepLv = shop => { let xp = Math.max(0, Number(shop && shop.rep) || 0), lv = 0; while (xp >= shopRepNeed(lv + 1)) { xp -= shopRepNeed(lv + 1); lv++; } return lv; };
  const shopRepLeft = shop => { let xp = Math.max(0, Number(shop && shop.rep) || 0), lv = 0; while (xp >= shopRepNeed(lv + 1)) { xp -= shopRepNeed(lv + 1); lv++; } return { lv, xp, need: shopRepNeed(lv + 1) }; };
  const shopRepBonus = lv => 0.12 * Math.log2(1 + lv / 4);           // 越往后涨得越慢，永远在涨
  const shopRepCrowd = lv => Math.floor(Math.log2(1 + lv / 6));
  // 熟练度：同一个人在同一个岗上开过几天门；称号一直往上，加成越往后越慢
  const SKILL_TITLES = [[0, "见习"], [3, "上手"], [8, "熟手"], [15, "老手"], [30, "一把手"]];
  const shopSkillTitle = (post, days) => { const d = Math.max(0, days || 0); if (d >= 30) { const n = 1 + Math.floor((d - 30) / 20); return post + "一把手" + (n > 1 ? "·" + n + "段" : ""); } let t = "见习"; SKILL_TITLES.forEach(([k, v]) => { if (d >= k) t = v; }); return post + t; };
  const shopSkillBonus = days => 0.05 * Math.log2(1 + Math.max(0, days || 0) / 4);
  const shopSkillOf = (shop, id, post) => ((shop && shop.skill) || {})[id + "|" + post] || 0;
  // 新面孔：几个词库拼出来，够多就不会撞
  // One vocabulary supplies both the name generator and the 3D wardrobe.
  const FACE_FEATURES = Object.freeze([['戴草帽的','strawHat'],['穿雨靴的','rainBoots'],['总迟到的','late'],['背画板的','drawingBoard'],['拎鸟笼的','birdcage'],['说方言的','clothBag'],['戴圆眼镜的','glasses'],['骑旧单车的','bicycle'],['围红围巾的','scarf'],['牵柴犬的','shiba'],['抱着猫的','heldCat'],['穿制服的','uniform'],['拄拐杖的','cane'],['扎双马尾的','pigtails'],['提着保温桶的','thermos'],['满身面粉的','flour'],['拿着地图的','map'],['戴耳机的','headphones'],['穿西装的','suit'],['晒得很黑的','sun']].map(([word,id])=>Object.freeze({word,id})));
  const FACE_IDENTITIES = Object.freeze([['老太太','granny'],['高中生','student'],['画家','painter'],['花匠','florist'],['面包师','baker'],['退休邮差','postman'],['小学老师','teacher'],['调音师','tuner'],['夜班护士','nurse'],['书店店员','bookseller'],['渔夫','fisher'],['修表匠','watchmaker'],['摄影师','photographer'],['教授','professor'],['快递员','courier'],['厨子','chef'],['邻居大叔','neighbor'],['留学生','international'],['新婚的姑娘','newlywed'],['小男孩','child']].map(([word,style])=>Object.freeze({word,style})));
  const FACE_ADJ = FACE_FEATURES.map(x=>x.word), FACE_WHO = FACE_IDENTITIES.map(x=>x.word);
  const SHOP_NPC_STYLES = ['granny','student','painter','traveler','florist','child','postman'], SHOP_TOUGH_STYLES = ['inspector','rival','refund'];
  function shopAppearance(customer) {
    const c=customer||{},name=String(c.name||''),rare=RARE_GUESTS.find(r=>r.id===c.rareId);
    if(rare)return {style:'rare_'+rare.id,feature:null,rareId:rare.id,species:rare.id==='cat'?'cat':'person'};
    const who=FACE_IDENTITIES.find(w=>name.endsWith(w.word)),feature=FACE_FEATURES.find(f=>name.startsWith(f.word));
    const fixed=SHOP.NPC.findIndex(n=>n[0]===name),tough=SHOP.TOUGH.findIndex(n=>n[0]===name);
    return {style:who?.style||(fixed>=0?SHOP_NPC_STYLES[fixed]:tough>=0?SHOP_TOUGH_STYLES[tough]:'postcard'),feature:feature?.id||null,rareId:null,species:'person'};
  }
  const FACE_WANT = [["寄一包家乡的特产", 9, "送信"], ["加急寄一份合同", 12, "送信"], ["给远方的笔友寄信", 6, "送信"], ["寄一大箱旧书", 11, "分拣"], ["理一摞攒了半年的信", 8, "分拣"], ["寄一卷画和几封信", 10, "分拣"], ["问寄到国外要多少钱", 7, "柜台"], ["零钱不够，想先寄一半", 5, "柜台"], ["买一整版纪念邮票", 9, "柜台"], ["想挑一张好看的卡送人", 8, "卡"], ["给孩子挑一张生日卡", 7, "卡"]];
  // 客人的小短句（她 2026-11-09「每个组合会说的小短句也要写」）：特征给一个小动作，身份给道谢的口气，拼起来 20×20 都成立
  const FACE_ACT = { 戴草帽的: "摘下草帽扇了扇风", 穿雨靴的: "在门口跺了跺雨靴上的水", 总迟到的: "一进门先看了眼表", 背画板的: "把画板往身后挪了挪", 拎鸟笼的: "把鸟笼轻轻放在柜台边", 说方言的: "带着口音开口", 戴圆眼镜的: "推了推圆眼镜", 骑旧单车的: "把车铃挂件塞进口袋", 围红围巾的: "把红围巾往下拉了拉", 牵柴犬的: "柴犬在脚边转了一圈", 抱着猫的: "怀里的猫打了个哈欠", 穿制服的: "理了理制服的领口", 拄拐杖的: "拄着拐杖慢慢走到柜台前", 扎双马尾的: "双马尾一甩一甩地跑过来", 提着保温桶的: "把保温桶换到另一只手", 满身面粉的: "拍了拍袖子上的面粉", 拿着地图的: "把地图折了两折", 戴耳机的: "摘下一边耳机", 穿西装的: "边走边松了松领带", 晒得很黑的: "抹了把额头的汗" };
  const WHO_THANKS = { 老太太: ["「好孩子，辛苦你们啦。」", "「下回给你们带点自己腌的咸菜。」"], 高中生: ["「谢谢！赶上了赶上了！」", "「下次还来！」"], 画家: ["「……谢谢。」他点了点头。", "「画寄到了，我会再来。」"], 花匠: ["「回头给你们带一盆。」", "「花等不起，谢谢你们这么快。」"], 面包师: ["「明早给你们留两个刚出炉的。」", "「麻烦啦，我得赶回去看炉子。」"], 退休邮差: ["「这活儿干得地道。」", "「跟我当年一个样，好好干。」"], 小学老师: ["「谢谢，孩子们会很开心的。」", "「你们真细心，跟我班上的班长似的。」"], 调音师: ["「准了，谢谢。」", "「你们这铃铛的音挺正。」"], 夜班护士: ["「谢谢，我得回去补个觉了。」", "「下了夜班还能赶上，真好。」"], 书店店员: ["「回头给你们推荐几本书。」", "「包得比我们店还整齐。」"], 渔夫: ["「改天给你们带条鱼。」", "「行，靠谱。」"], 修表匠: ["「分秒不差，好。」", "「你们这钟走得准，我放心。」"], 摄影师: ["「等等，这光好，让我拍一张店里。」", "「谢啦，下回来给你们拍张合影。」"], 教授: ["「效率不错。」", "「谢谢，帮了大忙。」"], 快递员: ["「同行，懂的，谢了。」", "「你们比我们站点还快。」"], 厨子: ["「下回来店里吃饭，算我的。」", "「火候正好，谢了。」"], 邻居大叔: ["「好嘞，回头请你们喝茶。」", "「这条街就数你们店实在。」"], 留学生: ["「谢谢你们，家里人会收到的。」", "「Thank you——我是说，谢谢！」"], 新婚的姑娘: ["「谢谢！这封对我们很重要。」", "「回头给你们送喜糖。」"], 小男孩: ["「谢谢哥哥姐姐！」", "「我下回还来！」"] };
  const faceAct = name => { const k = Object.keys(FACE_ACT).find(x => String(name || "").indexOf(x) === 0); return k ? FACE_ACT[k] : ""; };
  const faceThanks = (name, n) => { const k = Object.keys(WHO_THANKS).find(x => String(name || "").indexOf(x) >= 0); return k ? WHO_THANKS[k][(n || 0) % WHO_THANKS[k].length] : ""; };
  // 特征跟身份要合得上（她 2026-11-09「满身面粉的摄影师吗」）：有讲究的特征只配这几种身份，没写的谁都能配
  const FACE_FIT = {
    满身面粉的: ["面包师", "厨子", "老太太"], 穿制服的: ["快递员", "夜班护士", "退休邮差", "高中生", "小学老师"], 穿西装的: ["教授", "调音师", "修表匠", "摄影师", "邻居大叔", "留学生"],
    晒得很黑的: ["渔夫", "快递员", "花匠", "邻居大叔", "小男孩", "摄影师"], 拄拐杖的: ["老太太", "退休邮差", "教授", "修表匠", "邻居大叔"], 扎双马尾的: ["高中生", "留学生", "新婚的姑娘", "书店店员", "小学老师"],
    背画板的: ["画家", "高中生", "留学生", "小学老师", "小男孩"], 骑旧单车的: ["快递员", "高中生", "邻居大叔", "面包师", "书店店员", "花匠", "退休邮差", "留学生"], 拎鸟笼的: ["老太太", "邻居大叔", "退休邮差", "修表匠"],
    戴耳机的: ["高中生", "留学生", "快递员", "摄影师", "调音师", "书店店员"], 提着保温桶的: ["夜班护士", "老太太", "厨子", "邻居大叔", "快递员", "小学老师"], 总迟到的: ["高中生", "留学生", "教授", "快递员", "小男孩", "画家"],
    戴草帽的: ["花匠", "渔夫", "邻居大叔", "老太太", "小男孩", "画家", "摄影师"], 穿雨靴的: ["渔夫", "花匠", "小男孩", "快递员", "老太太", "邻居大叔"], 牵柴犬的: ["老太太", "邻居大叔", "高中生", "新婚的姑娘", "书店店员", "教授", "小男孩"]
  };
  // 已经拼成怪组合的老熟客（改之前来的）不再来，等于搬走了
  const faceSane = name => { const n = String(name || ""), adj = FACE_ADJ.find(a => n.indexOf(a) === 0), who = adj && n.slice(adj.length); return !adj || !FACE_WHO.includes(who) || faceFits(adj, who); };
  const faceFits = (adj, who) => !FACE_FIT[adj] || FACE_FIT[adj].includes(who);
  const shopNewFace = R => { const w = FACE_WANT[Math.floor(R() * FACE_WANT.length)], who = FACE_WHO[Math.floor(R() * FACE_WHO.length)], ok = FACE_ADJ.filter(a => faceFits(a, who)); return [ok[Math.floor(R() * ok.length)] + who, w[0], w[1], w[2]]; };
  // 熟客的小事：交情每到一档冒一件，用完从头再来（换着人来，读着不重复）
  const REG_STORIES = ["第一次跟店员聊起了家里的事", "说下回带点自己做的东西来", "寄出去的那封终于有了回信，特地来说一声", "带了一小盒点心，放在柜台上就走了", "说起年轻时也在邮局排过很长的队", "托店里帮忙保管一封信，说过几天来拿", "说最近忙，可能要隔一阵才来", "隔了一阵又来了，说还是这家店顺手", "给店员带了一句家乡的问候", "说这条街越来越热闹，多亏这家店", "问店员最近累不累", "把自家孩子的画夹在信里给店员看"];
  const shopRegStory = n => REG_STORIES[(Math.max(1, n) - 1) % REG_STORIES.length];
  // 每周三张大单：按口碑等级和这周的日子拼，做完下一周更大
  const ORDER_KINDS = [
    { k: "serve", zh: n => "这周招待 " + n + " 位客人", n: lv => 10 + lv * 2, pay: n => n * 6 },
    { k: "match", zh: n => "这周对上客人需求 " + n + " 次", n: lv => 5 + lv, pay: n => n * 12 },
    { k: "win", zh: n => "这周打赢 " + n + " 个难缠客人", n: lv => 1 + Math.floor(lv / 4), pay: n => n * 60 },
    { k: "urgent", zh: n => "这周招待 " + n + " 位急件客人", n: lv => 2 + Math.floor(lv / 3), pay: n => n * 25 },
    { k: "earn", zh: n => "这周收进 " + n + " 枚邮花", n: lv => 400 + lv * 80, pay: n => Math.round(n * 0.3) },
    { k: "regular", zh: n => "这周招待熟客 " + n + " 次", n: lv => 3 + Math.floor(lv / 2), pay: n => n * 20 },
    { k: "days", zh: n => "这周开门 " + n + " 天", n: lv => Math.min(7, 3 + Math.floor(lv / 5)), pay: n => n * 30 }
  ];
  function shopOrders(lv, week, salt) {
    const R = rng((hashStr(String(week) + "|" + (salt || "")) ^ (lv * 2654435761)) >>> 0), ks = shuffle(ORDER_KINDS.slice(), R).slice(0, 3);
    return ks.map((o, i) => { const n = o.n(lv); return { id: week + "_" + o.k, k: o.k, n, prog: 0, done: false, pay: o.pay(n), rep: 40 + lv * 5 }; });
  }
  const shopOrderZh = o => { const t = ORDER_KINDS.find(x => x.k === o.k); return t ? t.zh(o.n) : ""; };
  const shopMul = (shop, roster, personaOf, cardOf) => 1 + shopRepBonus(shopRepLv(shop)) + Object.keys(roster || {}).filter(p => roster[p]).reduce((a, p) => { const bid = (shop.badge || {})[p], bc = bid && cardOf ? cardOf(bid) : null; return a + 0.15 + 0.1 * shopApt(personaOf(roster[p]), p) + shopSkillBonus(shopSkillOf(shop, roster[p], p)) + (bc ? shopBadgeBonus(p, bc) : bid ? 0.06 : 0); }, 0) + shopDecorBonus(shop) + (cardOf ? shopWinBonus(shop, cardOf) : 0);
  // 按现实时间开店（她 2026-11-08「按现实时间来吧」）：上午 6–12、下午 12–18、傍晚 18–24，半夜关门；
  //   每个时段一批客人：上午多寄信的路人、下午难缠的多、傍晚来坐坐的角色多；有的是急件（给双倍）；过了这个时段没招待的就走了
  const SHOP_PERIODS = [["上午", 6, 12], ["下午", 12, 18], ["傍晚", 18, 24]];
  const shopPeriod = d => { const hr = (d || new Date()).getHours(); const p = SHOP_PERIODS.find(x => hr >= x[1] && hr < x[2]); return p ? p[0] : "半夜"; };
  function shopCustomers(shop, offDuty, seed, allChars, period) {
    const pi = Math.max(0, SHOP_PERIODS.findIndex(x => x[0] === period)), R = rng(((seed >>> 0) ^ (shop.day * 2654435761) ^ ((pi + 1) * 40503)) >>> 0);
    const n = 2 + Math.floor((shop.decor || []).length / 3) + (pi === 0 ? 1 : 0) + shopRepCrowd(shopRepLv(shop)), toughP = [0.1, 0.35, 0.15][pi], out = [];
    const npc = shuffle(SHOP.NPC.slice(), R), tgh = shuffle(SHOP.TOUGH.slice(), R);   // 同一时段不重样
    // 熟客（她 2026-11-09「一直玩下去」）：一半的路人是来过的熟客；剩下的是代码拼出来的新面孔，招待过就成熟客
    const regs = shuffle(Object.values(shop.regulars || {}).filter(r => r && !r.gone && faceSane(r.name)), R);
    for (let k = 0; k < n; k++) { const tough = R() < toughP && tgh.length, reg = !tough && regs.length && R() < 0.5 ? regs.pop() : null;
      const x = tough ? tgh.pop() : reg ? [reg.name, reg.want, reg.fee, reg.need] : R() < 0.35 ? (npc.pop() || SHOP.NPC[0]) : shopNewFace(R), urgent = !tough && R() < 0.2;
      // 招待要对上需求（她 2026-11-08）：交给对的岗位，或者从橱窗挑一张对的卡
      const need = tough ? null : x[3] === "卡" ? (R() < 0.5 ? { card: { role: ROLES[Math.floor(R() * ROLES.length)] } } : { card: { min: "SR" } }) : x[3] ? { post: x[3] } : null;
      const mood = tough ? "" : shopMood(x[0] + x[1], urgent);
      out.push({ id: period + "c" + k, name: x[0], want: x[1], fee: x[2] * (urgent ? 2 : 1), tough, urgent, need, mood, hint: tough ? "" : (faceAct(x[0]) ? "（" + faceAct(x[0]) + "）" : "") + shopHint(need, mood, R), ...(reg ? { regularId: reg.id, bond: reg.bond || 0 } : tough ? {} : { regularId: "r_" + hashStr(x[0]).toString(36) }) }); }
    // 稀客（她 2026-11-09，参考《猫咪后院》）：凑上条件才偶尔来，一天最多来一位
    const rare = shopRareFor(shop, period, R); if (rare) out.splice(Math.floor(R() * (out.length + 1)), 0, { id: period + "x_" + rare.id, name: rare.name, want: rare.want, fee: rare.fee, need: rare.need, mood: "rich", hint: rare.hint, rareId: rare.id });
    if ((allChars || []).length && R() < 0.6) out.splice(1, 0, { id: period + "p0", wantChar: allChars[Math.floor(R() * allChars.length)], fee: 15, want: "想要一张明信片" });
    const vMax = [0, 1, 2][pi];
    shuffle((offDuty || []).slice(), R).slice(0, Math.min(vMax, (offDuty || []).length)).forEach((id, k) => { if (R() < (pi === 2 ? 0.85 : 0.5)) out.splice(1 + k * 2, 0, { id: period + "v" + k, charId: id, fee: 12, visitor: true }); });
    if (pi === 0 && (offDuty || []).length && R() < 0.3) out.push({ id: period + "v9", charId: offDuty[Math.floor(R() * offDuty.length)], fee: 12, visitor: true });
    return out;
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
      sd.postage = Math.max(0, Math.max(0, Math.min(POSTAGE_CAP, postageOf(st.turn) + box + sd.bonusPostage - sd.owed + (st.hard && who === "foe" ? 1 : 0) + (has(st, who, "胶水罐") ? 1 : 0) + (st.turn === 1 && has(st, who, "哨子") ? 2 : 0))) - (who === "me" && edictOn(st, "meGlue") ? 1 : 0));
      drawCards(sd, Math.max(1, DRAW - (who === "me" && edictOn(st, "meDraw") ? 1 : 0) + sd.bonusDraw + (eventNow(st) === "加班" ? 1 : 0) + (has(st, who, "快手") ? 1 : 0)), st.seed + st.turn * 31 + (who === "me" ? 0 : 7));
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
    if (who === "foe" && edictOn(st, "foeShield")) u.shield += 3;
    if (who === "me" && st.keeps && st.keeps.length) {
      const d = keepV(st, "def"), c = keepV(st, "stamp"), b = keepV(st, "bond", u);
      if (d) u.shield += d * 2; if (c) u.charge = Math.min(u.need, Math.max(u.charge, c)); if (b) { u.maxHp += b * 2; u.hp += b * 2; }
    }
    u.side = who;
    if (u.kind === "bday") u.shield += 3;
    if (u.kind === "anniv" || u.kind === "mybday") sd.bonusPostage += 1;
    if (u.role === "集邮") sd.bonusDraw += 1;
    if (u.trait === "节俭") sd.postage += u.rarity === "SSR" ? 2 : 1;
    if (u.trait === "机灵") drawCards(sd, 1, st.seed + st.turn * 17 + slot);
    sd.board[slot] = u;
    say(st, who, u.name + " 贴上了", { kind: "place", slot, char: u.charId, line: u.lines.enter });
    checkCombos(st, who);
    return { ok: true };
  }
  function tearRaw(st, who, slot) { return withActor(st, who, slot, () => tearRaw0(st, who, slot)); }
  function tearRaw0(st, who, slot) {
    if (who === "me" && edictOn(st, "noTear")) return { ok: false, why: "封缄令：这一把不能撕票" };
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
    if (who === "me" && edictOn(st, "noMove")) return { ok: false, why: "封缄令：这一把不能挪票" };
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
    if (who === "me" && edictOn(st, "noStamp") && st.turn <= 2) return { ok: false, why: "封缄令：前两回合盖不了章" };
    if (u.charge < u.need) return { ok: false, why: "章还没攒满" };
    if (sd.postage < STAMP_COST) return { ok: false, why: "胶水不够" };
    sd.postage -= STAMP_COST; u.charge = 0; st.stamping = true;
    try { return stampBody(st, who, slot, sd, foeWho, foe, u); } finally { st.stamping = false; }
  }
  function stampBody(st, who, slot, sd, foeWho, foe, u) {
    const p0 = powOf(st, u, sd, slot), big = u.rarity === "SSR", p = big ? Math.ceil(p0 * 1.5) : p0, x = big ? 1.5 : 1;
    say(st, who, "盖章：" + (big ? u.name : u.skill), { kind: "stamp", slot, char: u.charId, line: big ? u.lines.wake : "", skill: u.skill, rarity: u.rarity, name: u.name, cardId: u.cardId, cutLine: u.lines.wake || u.lines.enter || "" });
    const c = col(slot), foeCol = [0, 1, 2].map(r => r * SIZE + c).filter(i => foe.board[i]), j = targetIn(foe, c);
    const k = u.skill;
    if (k === "重击") { if (j >= 0) hitUnit(st, foeWho, j, p * 2, u.name, u); else hitEnvelope(st, foeWho, p + 2, u.name); }
    else if (k === "贯穿") foeCol.forEach(i => hitUnit(st, foeWho, i, p, u.name, u));
    else if (k === "直达") hitEnvelope(st, foeWho, p + 3, u.name);
    else if (k === "连打") { for (let t = 0; t < 2; t++) { const jj = targetIn(foe, c); if (jj >= 0) hitUnit(st, foeWho, jj, Math.ceil(p * 0.6), u.name, u); else hitEnvelope(st, foeWho, Math.ceil(p * 0.6), u.name); } }
    else if (k === "厚封" || k === "封口") u.shield += p * 2;   // 原叫「封口」，跟戳重名（她 2026-11-08）改名
    else if (k === "封整排") [0, 1, 2].forEach(q => { const v = sd.board[row(slot) * SIZE + q]; if (v) v.shield += p; });
    else if (k === "加固") { sd.board.forEach(v => { if (v) v.shield += Math.round(2 * x); }); u.shield += p; }
    else if (k === "回敬") { u.reflect = 1; u.shield += Math.ceil(p / 2); }
    else if (k === "补满") { const w = sd.board.filter(Boolean).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (w) w.hp = w.maxHp; if (big) sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + 4); }
    else if (k === "群补") healUnits(sd, sd.board, Math.round(4 * x));
    else if (k === "洗戳") { sd.board.forEach(v => { if (v) v.marks = {}; }); healUnits(sd, sd.board, Math.round(2 * x)); }
    else if (k === "拾回") { const pile = sd.discard.slice().sort((a, b) => b.pow + b.maxHp - a.pow - a.maxHp); const n = big ? 2 : 1; pile.slice(0, n).forEach(v => { sd.discard.splice(sd.discard.indexOf(v), 1); sd.hand.push(v); }); }
    else if (k === "进账") sd.postage += Math.round(2 * x * (eventNow(st) === "集邮节" ? 2 : 1));
    else if (k === "翻信箱") drawCards(sd, Math.round(2 * x * (eventNow(st) === "集邮节" ? 2 : 1)), st.seed + st.turn * 13 + slot);
    else if (k === "截胶") { foe.owed = Math.min(3, foe.owed + (big ? 2 : 1)); sd.postage += 1; }
    else if (k === "充章") adj(slot).forEach(i => { const v = sd.board[i]; if (v) v.charge = Math.min(v.need, v.charge + (big ? 2 : 1)); });
    else if (k === "盖一张") { if (j >= 0) { mark(foe, j, SELF_INK[u.ink] ? "退回" : u.ink, st); hitUnit(st, foeWho, j, p * 2, u.name, u); } else hitEnvelope(st, foeWho, p, u.name); }
    else if (k === "加盖") foeCol.forEach(i => { const v = foe.board[i]; if (v) Object.keys(v.marks || {}).forEach(m => { v.marks[m] += big ? 2 : 1; }); });
    else if (k === "转寄") {
      const BAD = ["退回", "封口", "撕口", "折角", "雨渍"], from = sd.board.map((v, ii) => v && BAD.find(m => v.marks && v.marks[m]) ? ii : -1).filter(ii => ii >= 0)[0];
      if (from != null) { const v = sd.board[from], m = BAD.find(mm => v.marks[mm]); delete v.marks[m]; if (j >= 0) mark(foe, j, m, st); say(st, who, "把「" + m + "」从「" + v.name + "」身上转寄给了对面", { kind: "ink", slot: from }); }
      else if (j >= 0) hitUnit(st, foeWho, j, p, u.name, u);
    }
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
      if (sd.terrain[i] === "护封" || sd.terrain[i] === "雨棚" || u.trait === "沉默" || false) return;
      if (st && bondOn(st, sd, u) === "冷淡") return;
      if (st && sd === st.foe && st.bossRule === "冷淡") return;
    }
    if (m === "雨渍" && sd === (st && st.me) && has(st, "me", "雨衣")) return;
    u.marks[m] = u.trait === "冷静" && m !== "加急" ? 1 : MARKS[m].turns + (st && sd === st.foe && has(st, "me", "锐利的戳") ? 1 : 0);   // 冷静：被盖的戳只挂一回合
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
      say(st, who, cb.type + "觉醒：" + lead.name, { kind: "wake", char: lead.charId, combo: cb.type, line: lead.lines.wake, slots: cb.ids, rarity: lead.rarity, name: lead.name, cardId: lead.cardId, cutLine: lead.lines.wake || lead.lines.enter || "" });
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
  // 回血溢出（她 2026-11-09「回血溢出也弄一下」）：补满了还多出来的，一半补到自家信封；只算主动的补（补票、群补、洗戳）
  function healUnits(sd, list, n) {
    let over = 0;
    list.forEach(v => { if (!v) return; const got = Math.min(n, Math.max(0, v.maxHp - v.hp)); v.hp += got; over += n - got; });
    const env = Math.floor(over / 2); if (env > 0) sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + env);
    return env;
  }
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
    const blocked = att && att.trait === "锋利" ? 0 : Math.min(u.shield, n), hp0 = u.hp; u.shield -= blocked; u.hp -= (n - blocked);
    if (u.trait === "记仇") u.grudge = (u.grudge || 0) + 1;
    say(st, other(who), "「" + by + "」打「" + u.name + "」 -" + n, { kind: "hit", slot: i, n, blocked });
    if (u.reflect) { u.reflect = 0; hitEnvelope(st, other(who), Math.ceil(n / 2), u.name + " 回敬"); }
    if (u.hp <= 0 && u.trait === "倔强" && !u.stood) { u.hp = 1; u.stood = 1; say(st, who, u.name + " 硬撑着没倒", { kind: "heal", slot: i }); return; }
    if (u.hp <= 0) {
      if (has(st, who, "旧照片")) sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + 1);
      sd.board[i] = null; sd.discard.push(stripUnit(u)); say(st, who, u.name + " 掉了", { kind: "fall", slot: i, char: u.charId, line: u.lines.fall });
      if (u.trait === "余温") adj(i).forEach(j => { const v = sd.board[j]; if (v && v.charge < v.need) v.charge++; });
      if (att && att.trait === "热烈") hitEnvelope(st, who, 3, att.name);
      // 溢出一半（她 2026-11-09）：打死以后多出来的伤害，一半落到同一列下一张，这一列没票了就落到信封
      const spill = Math.floor(Math.max(0, n - blocked - hp0) / 2);
      if (spill > 0) { const j = targetIn(sd, col(i)); if (j >= 0) hitUnit(st, who, j, spill, by + " 余劲", att); else hitEnvelope(st, who, spill, by + " 余劲"); }
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
    // SR／SSR 每局第一次出手：给界面一条「出手」，扫一道带卡面的横幅（她 2026-11-08「SR 和 SSR 都加吧」）
    if ((u.rarity === "SR" || u.rarity === "SSR") && !u.cutDone && u.cardId) { u.cutDone = 1; say(st, who, u.name + " 出手", { kind: "attack", slot: i, char: u.charId, rarity: u.rarity, name: u.name, cardId: u.cardId, cutLine: u.lines.enter || u.lines.wake || "" }); }
    for (let t = 0; t < times && sd.board[i] === u; t++) {
      const p = powOf(st, u, sd, i), j = targetIn(foe, col(i));
      // 每种票都打人（她 2026-11-08「每种卡都可以攻击吧不然太慢了」）：投递打满，别的打几成、再加自己的本事
      const side = n => { if (n <= 0 || sd.board[i] !== u) return; const jj = targetIn(foe, col(i)); if (jj >= 0) hitUnit(st, foeWho, jj, n, u.name, u); else hitEnvelope(st, foeWho, n, u.name); };
      if (u.role === "投递") { if (j >= 0) hitUnit(st, foeWho, j, p, u.name, u); else hitEnvelope(st, foeWho, p, u.name); }
      else if (u.role === "火漆") { u.shield += Math.max(1, Math.ceil(p / 2)); side(Math.ceil(p * ROLE_HIT.火漆)); }
      else if (u.role === "补票") {
        const hurt = sd.board.filter(x => x && x.hp < x.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (hurt) healUnits(sd, [hurt], Math.max(2, Math.ceil(p / 2))); else sd.hp = Math.min(sd.max || ENVELOPE_HP, sd.hp + 2);
        const dirty = sd.board.find(x => x && (x.marks.雨渍 || x.marks.退回)); if (dirty) { delete dirty.marks.雨渍; delete dirty.marks.退回; }
        say(st, who, u.name + " 补了一下", { kind: "heal", slot: i }); side(Math.ceil(p * ROLE_HIT.补票));
      }
      else if (u.role === "集邮") { sd.bonusPostage += eventNow(st) === "集邮节" ? 2 : 1; say(st, who, u.name + " 攒了胶水", { kind: "gain", slot: i }); side(Math.ceil(p * ROLE_HIT.集邮)); }
      else if (u.role === "邮戳") {
        if (u.ink === "加急") { const k = adj(i).find(x => sd.board[x] && sd.board[x].role === "投递"); if (k != null) sd.board[k].marks.加急 = 1; }
        else if (u.ink === "延误") foe.owed = Math.min(2, foe.owed + 1);
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
      else if (u.role === "邮戳") out[i] = u.ink === "加急" ? "给旁边加急" : u.ink === "延误" ? "让对面延误" : "";
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
    if (!st.over && st.puzzle) st.over = { winner: "foe", turn: st.turn, me: st.me.hp, foe: st.foe.hp, puzzle: true };
    if (!st.over && st.edict && st.edict.includes("short") && st.turn >= st.cap) st.over = { winner: "foe", turn: st.turn, me: st.me.hp, foe: st.foe.hp, byCap: true };
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
    stampOf, deckFrom, foeDeckFrom, shopDecorOf, shopUpPrice, SHOP, SHOP_PERIODS, shopPeriod, SHOP_WIN, shopWinSlots, shopWinBonus, shopApt, shopMul, SHOP_BADGE, SHOP_BADGE_FIT, shopBadgeFit, shopBadgeBonus, shopNeedZh, shopCardFits, SHOP_THANKS, hitUnit, healUnits, simSend, shopRepLv, shopRepLeft, shopRepBonus, shopSkillTitle, shopSkillOf, shopSkillBonus, shopOrders, shopOrderZh, shopRegStory, shopNewFace, shopPrice, shopHint, FACE_FEATURES,FACE_IDENTITIES,shopAppearance, RARE_GUESTS, faceAct, faceThanks, FACE_ADJ, FACE_WHO, faceFits, shopCustomers, autoMe, PUZZLE_MAX, puzzleOf, pzSolve, PATROL, TA_CELLS, TA_PTS, patrolNew, patrolCan, patrolMove, patrolBattle, patrolAfter, weekNo, SHIFT, shiftNew, shiftRoll, shiftPrice, shiftBuy, shiftSell, shiftDeck, shiftBonds, shiftFoeLv, shiftAfter, EDICTS, EDICT_LV, edictDeck, RAID_TURNS, MATS, BASE_MATS, THEME_MAT, KEEP_FX, KEEP_MAX_SLOTS, keepFxOf, keepTier, matDrop, SIEGE_TIERS, newDuel, envFor, avgLv, fairDeck, aims, actsOf, previewPlace, place, tear, move, keep, stamp, undo, canUndo, endTurn, planFoe, combos, newSeries, addGame, memoryLine, hashStr };
  g.StampDuel = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
