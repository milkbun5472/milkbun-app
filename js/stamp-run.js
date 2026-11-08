// 远信：邮票对局的肉鸽（她 2026-11-08 拍板：敌人混着来、信封血带着走、终点要回信、先不给印泥；「路途也可以聊天」）。
//   这一份只有规则：路线图、节点、敌人、岔路、邮局、驿站、信物、奖励。打仗照旧交给 js/stamp-duel.js。
//   一趟：给某个角色寄一封信，信要走一段邮路（六站）；终点就是 TA，打赢了信送到，TA 写回信。
//   不碰界面、不调模型；存档由界面那一层管（x_stampRun）。
(function (g) {
  "use strict";
  const D = () => g.StampDuel;
  const ROWS = 6;                       // 一段路几站（最后一站是 TA）
  const START_HP = 60, START_PICK = 6;  // 起手卡组几张
  const NODE = {
    fight: { zh: "普通站", icon: "✉" }, elite: { zh: "难站", icon: "✦" }, event: { zh: "岔路", icon: "?" },
    shop: { zh: "邮局", icon: "邮" }, rest: { zh: "驿站", icon: "☕" }, boss: { zh: "终点", icon: "♥" }
  };
  // 路上的麻烦（普通站）：代码写好的敌人，跟角色无关；每种一套卡组的样子
  const TROUBLES = [
    { key: "rain", zh: "一场暴雨", say: "雨下得信纸都卷了边。", roles: ["邮戳", "邮戳", "投递", "火漆"], trait: "夜行" },
    { key: "strike", zh: "罢工的邮差", say: "邮差们堵在路口，谁也不让过。", roles: ["火漆", "火漆", "投递", "补票"], trait: "倔强" },
    { key: "censor", zh: "审查局", say: "每封信都要盖章才能过。", roles: ["邮戳", "火漆", "邮戳", "集邮"], trait: "冷静" },
    { key: "cats", zh: "抢信的野猫", say: "一群猫扑上来叼信。", roles: ["投递", "投递", "投递", "补票"], trait: "莽撞" },
    { key: "lost", zh: "迷路的信", say: "一叠寄错地址的信缠住了你。", roles: ["集邮", "投递", "火漆", "邮戳"], trait: "余温" },
    { key: "wind", zh: "一阵大风", say: "风把信往回吹。", roles: ["投递", "邮戳", "投递", "火漆"], trait: "锋利" }
  ];
  const EVENTS = [
    { key: "wet", zh: "一张被雨打湿的票", say: "路边躺着一张泡了水的邮票，还认得出是谁。", opts: [{ zh: "花点力气修好它（信封 -6，随机一张票升阶）", fx: "wet" }, { zh: "不管它", fx: "none" }] },
    { key: "box", zh: "路边的旧邮筒", say: "一个掉漆的邮筒，投币口还亮着。", opts: [{ zh: "投 30 枚邮花（换一件信物）", fx: "box", cost: 30 }, { zh: "走开", fx: "none" }] },
    { key: "stranger", zh: "陌生人的信", say: "有封信掉在路上，寄信人写着你认识的名字。", opts: [{ zh: "替 TA 带上（多一张票）", fx: "card" }, { zh: "送回邮局（+30 邮花）", fx: "coins30" }] },
    { key: "pause", zh: "同行的人想歇一会儿", say: "TA 在路边坐下了，说就歇五分钟。", opts: [{ zh: "陪 TA 歇（信封 +12）", fx: "heal12" }, { zh: "拉着 TA 赶路（随机一张票升阶）", fx: "up" }] },
    { key: "bet", zh: "邮差的赌局", say: "一个邮差拦住你：「赌一把？赢了这个归你。」", opts: [{ zh: "赌（一半拿信物，一半信封 -10）", fx: "bet" }, { zh: "不赌", fx: "none" }] },
    { key: "trade", zh: "换票的人", say: "有人想拿两张旧票换你一张。", opts: [{ zh: "换（删一张最弱的，拿两张新的）", fx: "trade" }, { zh: "不换", fx: "none" }] }
  ];
  const PRICE = { card: 40, relic: 80, remove: 50, heal: 30 };

  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const pick = (arr, R) => arr[Math.floor(R() * arr.length)];
  const R0 = run => rng((run.seed ^ (run.step * 2654435761)) >>> 0);

  // 路线图：每排两三个站，连到下一排相邻的站；第一排都是普通站，最后一排是终点
  function makeMap(seed) {
    const R = rng(seed), rows = [];
    for (let r = 0; r < ROWS; r++) {
      const n = r === ROWS - 1 ? 1 : 2 + (R() < 0.5 ? 1 : 0), row = [];
      for (let k = 0; k < n; k++) {
        let t = r === 0 ? "fight" : r === ROWS - 1 ? "boss" : null;
        if (!t) { const x = R(); t = x < 0.42 ? "fight" : x < 0.56 ? "elite" : x < 0.74 ? "event" : x < 0.86 ? "shop" : "rest"; }
        if (r === ROWS - 2 && k === 0) t = "rest";      // 终点前一站一定有一个驿站
        row.push({ r, k, type: t });
      }
      rows.push(row);
    }
    // 连线：上一排第 k 个连到下一排位置相近的一两个
    for (let r = 0; r < ROWS - 1; r++) rows[r].forEach(nd => {
      const nx = rows[r + 1], f = nd.k / Math.max(1, rows[r].length - 1), c = Math.round(f * (nx.length - 1));
      nd.to = Array.from(new Set([c, Math.max(0, c - 1), Math.min(nx.length - 1, c + 1)])).filter(j => Math.abs(j - c) <= (R() < 0.5 ? 1 : 0) || j === c).sort();
    });
    return rows;
  }

  // 开一趟：toId 寄给谁（终点）、cards 收藏、core 她挑的「带谁」
  function newRun(o) {
    const seed = (o.seed >>> 0) || (Date.now() >>> 0), cards = (o.cards || []).filter(c => c && c.text);
    const offer = D().deckFrom(cards, seed ^ 0x77, 8, o.core || []);
    return { seed, toId: o.toId, step: 0, hp: START_HP, max: START_HP, deck: [], offer, relics: [], coins: 40, map: makeMap(seed), pos: null, picked: false, log: [], done: null, letter: "", seen: {} };
  }
  // 起手：从发的 8 张里挑 6 张
  function takeStart(run, idxs) {
    const set = new Set(idxs); run.deck = run.offer.filter((_, i) => set.has(i)).slice(0, START_PICK);
    if (run.deck.length < 4) run.deck = run.offer.slice(0, START_PICK);
    run.offer = null; run.picked = true; return run;
  }
  const reachable = run => !run.pos ? run.map[0].map(n => n.k) : (run.map[run.pos.r].find(n => n.k === run.pos.k).to || []);
  function enter(run, k) {
    const r = run.pos ? run.pos.r + 1 : 0;
    if (!reachable(run).includes(k)) return null;
    run.pos = { r, k }; run.step++;
    const nd = run.map[r][k]; run.seen[r + ":" + k] = 1;
    run.log.push({ step: run.step, r, type: nd.type });
    return nd;
  }

  // 敌人：麻烦（普通站）是造出来的票；难站是她别的角色；终点是 TA
  function troubleDeck(run, tr) {
    const R = R0(run), tier = (run.pos ? run.pos.r : 0);
    return Array.from({ length: 12 }, (_, i) => {
      const role = tr.roles[i % tr.roles.length], rar = R() < 0.1 + tier * 0.05 ? "SR" : "R";
      const s = D().stampOf({ id: "tr_" + tr.key + "_" + run.step + "_" + i, rarity: rar, lv: 5 + tier * 6, text: { name: tr.zh } });
      return Object.assign(s, { role, trait: tr.trait, traitFrom: "", charId: "", skill: Object.keys(D().SKILLS[role])[i % 4] });
    });
  }
  // 这一站要打的那一场怎么开：给界面一份 newDuel 要的料
  function battleFor(run, nd, cards, closeOf, others) {
    const R = R0(run), seed = (run.seed ^ (run.step * 40503)) >>> 0;
    const base = { meHp: run.hp, meMax: run.max, relics: run.relics.slice(), amulet: run.relics.includes("护身符") && !run.amuletUsed };
    if (nd.type === "fight") {
      const tr = pick(TROUBLES, R), hp = 22 + nd.r * 6;
      return Object.assign(base, { foeName: tr.zh, say: tr.say, foeDeck: troubleDeck(run, tr), foeHp: hp, seed, foeId: "" });
    }
    if (nd.type === "elite") {
      const pool = (others || []).filter(id => id !== run.toId && (cards || []).some(c => c.charId === id));
      const who = pool.length ? pick(pool, R) : "";
      const deck = who ? D().foeDeckFrom(cards, who, closeOf ? closeOf(who) : [], seed) : troubleDeck(run, pick(TROUBLES, R));
      return Object.assign(base, { foeId: who, foeDeck: deck, foeHp: 36 + nd.r * 4, seed, hard: true, elite: true });
    }
    // 终点：TA 本人，用 TA 的卡，认真模式
    return Object.assign(base, { foeId: run.toId, foeDeck: D().foeDeckFrom(cards, run.toId, closeOf ? closeOf(run.toId) : [], seed), foeHp: 55, seed, hard: true, boss: true });
  }
  // 打完一场：血带着走、给邮花、给三张挑一张（难站另给一件信物）
  function afterBattle(run, st, nd, cards) {
    run.hp = Math.max(0, st.me.hp); if (st.amuletUsed) run.amuletUsed = true;
    if (st.over && st.over.winner !== "me") { run.done = { win: false, at: run.pos.r, by: nd.type }; return { lost: true }; }
    if (run.relics.includes("回执")) run.hp = Math.min(run.max, run.hp + 4);
    if (nd.type === "boss") { run.done = { win: true, at: run.pos.r }; return { won: true }; }
    const R = R0(run), coins = (nd.type === "elite" ? 50 : 25) + Math.floor(R() * 10) + (run.relics.includes("存钱罐") ? 15 : 0);
    run.coins += coins;
    const offer = cardOffer(run, cards, 3);
    const relic = nd.type === "elite" ? relicOffer(run, 1)[0] : null;
    if (relic) run.relics.push(relic);
    return { coins, offer, relic };
  }
  function cardOffer(run, cards, n) {
    const have = new Set(run.deck.map(s => s.cardId)), pool = (cards || []).filter(c => c && c.text && !have.has(c.id));
    return D().deckFrom(pool.length ? pool : cards, (run.seed ^ (run.step * 7919)) >>> 0, n);
  }
  function relicOffer(run, n) {
    const all = Object.keys(D().RELICS).filter(k => !run.relics.includes(k)), R = R0(run), out = [];
    while (out.length < n && all.length) out.push(all.splice(Math.floor(R() * all.length), 1)[0]);
    return out;
  }
  function addRelic(run, k) {
    if (!k || run.relics.includes(k)) return;
    run.relics.push(k);
    if (k === "厚信封") { run.max += 10; run.hp += 10; }
  }
  // 升阶：这一趟里这张票更强（攻击 +2、血 +3，章少攒一格）
  function upgrade(run, i) {
    const s = run.deck[i]; if (!s) return;
    run.deck[i] = Object.assign({}, s, { pow: s.pow + 2, maxHp: s.maxHp + 3, need: Math.max(1, s.need - 1), up: (s.up || 0) + 1, name: s.name.replace(/＋+$/, "") + "＋".repeat((s.up || 0) + 1) });
  }
  // 岔路：选了哪一项、发生什么
  function eventFor(run) { return EVENTS[Math.floor(R0(run)() * EVENTS.length)]; }
  function doEvent(run, ev, oi, cards) {
    const op = ev.opts[oi]; if (!op) return "";
    const R = R0(run), upRand = () => { const i = Math.floor(R() * run.deck.length); upgrade(run, i); return run.deck[i] ? run.deck[i].name : ""; };
    switch (op.fx) {
      case "wet": run.hp = Math.max(1, run.hp - 6); return "「" + upRand() + "」修好了，还更结实了。";
      case "box": if (run.coins < op.cost) return "邮花不够。"; run.coins -= op.cost; { const k = relicOffer(run, 1)[0]; addRelic(run, k); return k ? "邮筒吐出来一件「" + k + "」。" : "邮筒什么也没吐。"; }
      case "card": { const c = cardOffer(run, cards, 1)[0]; if (c) run.deck.push(c); return c ? "多了一张「" + c.name + "」。" : ""; }
      case "coins30": run.coins += 30; return "邮局给了 30 枚邮花。";
      case "heal12": run.hp = Math.min(run.max, run.hp + 12); return "歇完了，信封回了 12。";
      case "up": return "「" + upRand() + "」升阶了。";
      case "bet": if (R() < 0.5) { const k = relicOffer(run, 1)[0]; addRelic(run, k); return "赢了，拿到「" + k + "」。"; } run.hp = Math.max(1, run.hp - 10); return "输了，信封 -10。";
      case "trade": { if (run.deck.length > 4) { const w = run.deck.reduce((a, s, i) => s.pow + s.maxHp < run.deck[a].pow + run.deck[a].maxHp ? i : a, 0); run.deck.splice(w, 1); } cardOffer(run, cards, 2).forEach(c => run.deck.push(c)); return "换来了两张新票。"; }
      default: return "你接着赶路。";
    }
  }
  // 邮局：三张票、两件信物、删一张、回血
  function shopFor(run, cards) { return { cards: cardOffer(run, cards, 3), relics: relicOffer(run, 2), sold: {} }; }
  const priceOf = (run, k) => Math.round(PRICE[k] * (run.relics.includes("优惠券") ? 0.75 : 1));
  function buy(run, shop, what, i) {
    const cost = priceOf(run, what === "card" ? "card" : what === "relic" ? "relic" : what === "remove" ? "remove" : "heal");
    if (run.coins < cost) return { ok: false, why: "邮花不够" };
    if (shop.sold[what + i]) return { ok: false, why: "已经买过了" };
    if (what === "card") run.deck.push(shop.cards[i]);
    else if (what === "relic") addRelic(run, shop.relics[i]);
    else if (what === "remove") { if (run.deck.length <= 4) return { ok: false, why: "卡组最少留 4 张" }; run.deck.splice(i, 1); }
    else if (what === "heal") run.hp = Math.min(run.max, run.hp + 15);
    run.coins -= cost; if (what !== "remove" && what !== "heal") shop.sold[what + i] = 1;
    return { ok: true };
  }
  // 驿站：回三成血，或者升阶一张
  function rest(run, choice, i) {
    if (choice === "heal") { run.hp = Math.min(run.max, run.hp + Math.round(run.max * 0.3) + (run.relics.includes("旅伴的伞") ? 10 : 0)); return "歇了一会儿，信封回来了些。"; }
    upgrade(run, i); return "「" + (run.deck[i] || {}).name + "」升阶了。";
  }
  // 给 TA 写回信、给路上聊天用的：这一趟的样子
  function summary(run, nameOf) {
    const nm = id => (nameOf && nameOf(id)) || "";
    const types = run.log.map(l => NODE[l.type] ? NODE[l.type].zh : l.type);
    return "一路走了 " + run.log.length + " 站（" + types.join("→") + "），信封还剩 " + run.hp + "/" + run.max
      + "；带着的票：" + run.deck.map(s => "「" + s.name + "」" + (s.charId && nm(s.charId) ? "（" + nm(s.charId) + "的卡）" : "")).join("、")
      + (run.relics.length ? "；路上捡到的信物：" + run.relics.join("、") : "");
  }

  const API = { ROWS, NODE, TROUBLES, EVENTS, PRICE, newRun, takeStart, reachable, enter, battleFor, afterBattle, addRelic, upgrade, eventFor, doEvent, shopFor, priceOf, buy, rest, summary, cardOffer };
  g.StampRun = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
