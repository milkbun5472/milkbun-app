// 联机房间第三期·第二档：手里的牌／词／骰子只给自己看（js/netroom-cards.js）。
//   公开那份不带别人的私密东西；priv 只发给座位主人那台；角色由主人那台出手、只拿自己那份；
//   胜负走单机那份规则；斗地主、麻将人数固定、空位补 NPC；stateText 不带别人的私密
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), csrc = read("js/netroom-cards.js"), games = read("js/games.js");
const UnoCore = require("../js/uno-core.js"), MahjongCore = require("../js/mahjong-core.js");
require("../js/lingxi-core.js");
const LingxiCore = globalThis.LingxiCore || require("../js/lingxi-core.js");

// 牌桌规则：照 games.js 原样切出来（规则和本地牌手是单机那一份）
const cutr = (a, b) => { const i = games.indexOf(a), j = games.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return games.slice(i, j); };
const CARDS = new Function("UnoCore", [cutr("  const CARD_SUITS = ", "  function PlayCard(props) {"), cutr("  const LIAR_DICE = 5", "  const DIE_PIPS"), cutr("  const PK_CHIPS", "  function PokerGame(props) {"),
  cutr("  function omRanks(n)", "  function OldMaidGame(props) {"), cutr("  const BJ_CHIPS", "  function BlackjackGame(props) {"), cutr("  const DDZ_ROUNDS = 5;", "  function MjTile(props) {"), cutr("  function unoBestColor(hand)", "  function unoPublic(state) {")].join("\n")
  + "\nreturn { name: cardName, BOT_SKILL, botSlip, uno: { C: UnoCore, local: unoLocalMove }, liar: { newGame: liarNewGame, newRound: liarNewRound, act: liarAct, npc: liarNpcMove, total: liarTotal, legal: liarLegalBid, DICE: LIAR_DICE },"
  + " poker: { newGame: pkNewGame, newHand: pkNewHand, act: pkAct, npc: pkNpcMove, options: pkOptions }, oldmaid: { newGame: omNewGame, act: omAct, target: omTarget },"
  + " bj: { newGame: bjNewGame, newHand: bjNewHand, act: bjAct, npc: bjNpcMove, value: bjValue }, ddz: { newGame: ddzNewGame, newRound: ddzNewRound, bid: ddzBid, play: ddzPlay, npcBid: ddzNpcBid, npcPlay: ddzNpcPlay, hint: ddzHint, analyze: ddzAnalyze, TYPE_ZH: DDZ_TYPE_ZH } };")(UnoCore);

function load(spy) {
  const w = { MahjongCore, LingxiCore, extractJSON: s => { try { return JSON.parse(s); } catch (e) { return null; } } };
  new Function("window", gsrc)(w);
  w.GameShared = { cards: CARDS, spy: spy || null, voiceRules: () => "", call: async (api, sys) => (api.lingxi ? api.lingxi(sys) : "{}") };
  new Function("window", csrc)(w);
  return { G: w.NetGameCore, w };
}
function bus(ids, mk) {
  const S = {}, log = [];
  const deliver = (from, obj, to) => { log.push({ from, obj, to }); (to ? [to] : ids.filter(x => x !== from)).forEach(id => setTimeout(() => S[id] && S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0)); };
  ids.forEach(id => { S[id] = mk(id, (obj, to) => deliver(id, obj, to)); });
  return { S, log };
}
const tick = () => new Promise(ok => setTimeout(ok, 2));
async function until(fn, n) { for (let i = 0; i < (n || 4000); i++) { if (fn()) return true; await tick(); } return false; }
const KEYS_PRIVATE = ["hand", "hole", "dice", "cards", "deck", "wall", "words", "roles", "drawnUid", "pending", "decided", "uraInd", "illegal", "civ", "spyW"];
// 公开那份里不许有这些键（lastShow 是刚结束那一手亮出来的，reveal 是终局亮的，不算）
function privKeys(o, at) {
  if (!o || typeof o !== "object") return [];
  // last（斗地主桌上刚打出来的那手）本来就是亮着的；hand 是数字时是「第几手」
  return Object.keys(o).flatMap(k => k === "lastShow" || k === "reveal" || (k === "last" && !at) ? [] : (KEYS_PRIVATE.indexOf(k) >= 0 && typeof o[k] !== "number" ? [(at || "") + k] : []).concat(privKeys(o[k], (at || "") + k + ".")));
}
const mkInv = (G, key, n, extra) => Object.assign({ gid: "g", key, zh: key, min: n, max: n, host: "A", status: "playing", mode: "normal", npcFill: true,
  seats: Array.from({ length: n }, (_, i) => ({ kind: "npc", name: "N" + i })) }, extra || {});
// 庄一个人把一局跑完（每一手都走 npcMove → apply），每一步都查一遍公开那份
async function runHost(G, key, n, cfg, each) {
  const A = G.ADAPTERS[key], inv = mkInv(G, key, n);
  let st = await A.init(inv, { cfg: cfg || {} }), steps = 0;
  while (!A.result(st, inv) && steps++ < 6000) {
    const ti = A.turn(st); assert.ok(ti >= 0, key + " 卡住了：没轮到任何人");
    const v = A.view(st);
    assert.deepStrictEqual(privKeys(v), [], key + " 公开那份带了私密的键 " + privKeys(v));
    assert.deepStrictEqual(privKeys(A.cleanView(JSON.parse(JSON.stringify(v)))), [], key + " cleanView 之后也不许有");
    if (each) each(st, v, A, inv);
    const r = await A.apply(st, ti, await A.npcMove(st, ti, inv, {}), { inv });
    assert.ok(!r.err, key + " 本地牌手出了一手不合规的：" + r.err);
    st = r.st;
  }
  return { st, inv, A, res: A.result(st, inv) };
}

test("第二档九盒都登记了，大厅里摆得出来；斗地主、麻将人数是死的", () => {
  const { G } = load();
  ["spy", "uno", "oldmaid", "blackjack", "liar", "poker", "doudizhu", "mahjong", "lingxi"].forEach(k => assert.ok(G.supported().indexOf(k) >= 0, k));
  assert.deepStrictEqual(G.ADAPTERS.doudizhu.seatRange(), { min: 3, max: 3 });
  assert.deepStrictEqual(G.ADAPTERS.mahjong.seatRange(), { min: 4, max: 4 });
  ["uno", "oldmaid", "blackjack", "liar", "poker", "doudizhu", "mahjong"].forEach(k => assert.deepStrictEqual(G.charOptKinds(k), ["botSkill", "talk"], k + " 报名单上能调牌手水平"));
  assert.ok(!/联机|netroom/.test(cutr("  const CARD_SUITS = ", "  function MjTile(props) {")), "公共规则函数里不许写「联机」");
});

test("人数固定的两盒：NPC 凑数关着也照样补满；只坐了房主一个人也能开", () => {
  const { G } = load();
  for (const [key, n] of [["doudizhu", 3], ["mahjong", 4]]) {
    let inv = G.newInvite({ gid: "g", game: { key, zh: key, min: n, max: n }, cfg: { total: 2, npcFill: false }, host: "A", nick: "甲", picks: [{ kind: "user" }, { kind: "char", charId: "c1", name: "阿C" }] });
    assert.strictEqual(inv.seats.length, n, key + " 座位数照这一盒的死数");
    assert.ok(G.canStart(inv), key + " 真人不够也能开");
    const f = G.fillNpc(inv);
    assert.deepStrictEqual(f.seats.map(s => s.kind), ["user", "char"].concat(Array(n - 2).fill("npc")), key + " 空位补 NPC");
  }
});

for (const [key, n, cfg] of [["uno", 4], ["liar", 3], ["poker", 3], ["oldmaid", 4], ["blackjack", 3], ["doudizhu", 3], ["mahjong", 4, { mjVariant: "canton", mjHands: 1 }]]) {
  test(key + "：公开那份不带任何人的手牌，一局走完，胜负是单机那份规则判的", async () => {
    const { G } = load();
    const { st, res } = await runHost(G, key, n, cfg, (s, v, A) => {
      // 每个座位自己那份 priv 里的东西，别人那份公开 view 里一样都找不到
      const pub = JSON.stringify(Object.assign({}, v, { lastShow: null, log: null, out: null, last: null, board: null, top: null, river: null, bottom: null }));
      s.players.forEach((p, i) => {
        const pv = A.priv(s, i); assert.ok(pv, "每个座位都有自己那一份");
        (pv.hand || pv.hole || pv.cards || []).forEach(c => { if (c && c.uid) assert.ok(pub.indexOf('"' + c.uid + '"') < 0, key + " 公开那份里出现了座位 " + i + " 手里的 " + c.uid); });
        const txt = A.stateText(A.cleanView(JSON.parse(JSON.stringify(v))), (i + 1) % n, { seats: s.players.map(q => ({ name: q.name })) }, A.priv(s, (i + 1) % n));
        (pv.hand || []).filter(c => c && c.uid && typeof c.uid === "string" && c.uid.length > 3).forEach(c => assert.ok(txt.indexOf(c.uid) < 0));
      });
    });
    assert.ok(res, key + " 没打完");
    assert.ok(Array.isArray(res.winners) && typeof res.text === "string" && res.text.length > 4);
    // 赢家就是单机那份规则记下的那一位
    if (key === "oldmaid") assert.ok(res.winners.indexOf(+String(st.loser).slice(1)) < 0, "捏着鬼牌的人不算赢");
    else assert.deepStrictEqual(res.winners, [+String(st.winner).slice(1)]);
  });
}

test("UNO 走一圈：A 和 B 各一台，B 还带一个角色——priv 只发到座位主人那台；角色只拿自己那份，用 B 那台出手", async () => {
  const { G, w } = load();
  const asked = [];
  const mk = (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true, post: () => {}, patchCard: () => {},
    charOf: cid => id === "B" && cid === "b1" ? { id: "b1", name: "阿B", persona: "只在 B 手机上" } : null, apiFor: cid => { asked.push(id + ":" + cid); return {}; },
    charOpts: () => ({ botSkill: "pro" }), presence: () => ({ A: "on", B: "on" }) });
  const { S, log } = bus(["A", "B"], mk);
  const gid = S.A.invite({ key: "uno", zh: "UNO", min: 2, max: 6 }, { total: 3, npcFill: true }, [{ kind: "user" }]);
  S.B.join(gid, [{ kind: "user" }, { kind: "char", charId: "b1", name: "阿B" }], "A");
  assert.ok(await until(() => log.some(l => l.obj.op === "card" && l.obj.x.seats[2] && l.obj.x.seats[2].kind === "char")));
  assert.ok(await S.A.start(gid));
  assert.ok(await until(() => S.B.privOf(gid, 1) && S.B.privOf(gid, 2)), "B 那台拿到自己和角色两份");
  const privs = log.filter(l => l.obj.op === "priv");
  assert.ok(privs.length >= 2 && privs.every(l => l.to === "B" && l.from === "A"), "priv 只从庄发给 B");
  assert.ok(log.filter(l => !l.to).every(l => l.obj.op !== "priv"), "priv 不进广播");
  // A 自己那份在 A 手里、没发出去；B 那台看不到 A 的牌
  const aHand = S.A.privOf(gid, 0).hand.map(c => c.uid);
  assert.ok(aHand.length === 7);
  assert.strictEqual(S.B.privOf(gid, 0), null, "B 那台没有 A 那一份");
  log.forEach(l => { if (l.to !== "A" && l.from === "A") aHand.forEach(u => assert.ok(JSON.stringify(l.obj).indexOf('"' + u + '"') < 0 || l.obj.op === "state" && JSON.stringify(l.obj.view.log).indexOf(u) >= 0, "A 的牌 " + u + " 发出去了")); });
  // 推进到角色那一手：A、B 真人照本地牌手替自己点
  const A = G.ADAPTERS.uno;
  for (let k = 0; k < 40; k++) {
    const sv = S.A.seen(gid); if (sv.inv.status !== "playing") break;
    const ti = A.turn(sv.view); if (ti === 2) break;
    const who = ti === 0 ? "A" : "B", pv = S[who].privOf(gid, ti);
    if (!pv || S[who].seen(gid).seq !== sv.seq) { await tick(); continue; }
    const before = sv.seq;
    // 真人那一手：照本地牌手、只用 TA 自己那份（跟角色同一条路）
    S[who].move(gid, ti, A.charMove(sv.view, ti, sv.inv, { priv: pv, opts: {} }));
    await until(() => S.A.seen(gid).seq > before);
  }
  if (S.A.seen(gid).inv.status === "playing") {
    const before = log.filter(l => l.obj.op === "move" && l.obj.seat === 2).length;
    assert.ok(await until(() => log.filter(l => l.obj.op === "move" && l.obj.seat === 2).length > before), "角色那一手由 B 那台发出");
    assert.ok(log.filter(l => l.obj.op === "move" && l.obj.seat === 2).every(l => l.from === "B" && l.to === "A"));
  }
  assert.ok(asked.length && asked.every(x => x === "B:b1"), "只在 B 那台取角色");
  // 房里开口的角色拿到的局面：自己那份手牌在，别人的不在
  const sv = S.B.seen(gid), txt = G.stateText(sv.inv, sv.view, 2, S.B.privOf(gid, 2));
  assert.match(txt, /你手里：/);
  assert.ok(G.stateText(sv.inv, sv.view, -1, null).indexOf("你手里") < 0, "旁观的拿不到任何人的牌");
});

test("角色出手：等到这一手的 priv 才动；本地牌手只看到自己的牌（别人的是空牌）", async () => {
  const { G } = load();
  const A = G.ADAPTERS.doudizhu, inv = mkInv(G, "doudizhu", 3);
  const st = A.init(inv, { cfg: {} });
  assert.ok(A.needPriv);
  assert.deepStrictEqual(await A.charMove(A.view(st), st.bidTurn, inv, { priv: null }), { pass: true }, "没有自己那份就不出");
  const mv = A.charMove(A.cleanView(JSON.parse(JSON.stringify(A.view(st)))), st.bidTurn, inv, { priv: A.priv(st, st.bidTurn), opts: { botSkill: "pro" } });
  assert.ok(typeof mv.n === "number");
  const r = A.apply(st, st.bidTurn, mv, { inv }); assert.ok(!r.err);
  // 看 local 那份：别人的手牌只是同样张数的空牌
  const ls = A.cleanView(JSON.parse(JSON.stringify(A.view(st))));
  assert.ok(ls.players.every(p => p.n === 17 && !("hand" in p)));
});

test("21 点：要牌那一行日志不写拿到哪张、几点；庄家只亮一张", async () => {
  const { G } = load();
  await runHost(G, "blackjack", 3, {}, (s, v) => {
    v.log.forEach(x => { if (/：(要牌|停牌|加倍)/.test(x.text)) assert.ok(!/拿到|\d+ 点/.test(x.text), "日志泄了牌：" + x.text); });
    if (v.phase === "play") { assert.ok(v.dealerUp && !("dealer" in v)); }
  });
});

test("麻将：别家要不要那一张一家一家问；能干什么只在自己那份 priv 里", async () => {
  const { G } = load();
  let sawClaim = false;
  await runHost(G, "mahjong", 4, { mjVariant: "canton", mjHands: 1 }, (s, v, A) => {
    if (s.phase === "claim") { sawClaim = true; assert.ok(v.claim && !("pending" in v.claim)); const ti = A.turn(s); assert.ok(A.priv(s, ti).claim.length > 0, "轮到的这家自己那份里有能选的"); }
  });
  assert.ok(sawClaim, "一盘下来总该有人能碰／吃");
});

test("谁是卧底：词只在各人自己那份；角色不知道自己是不是卧底；票投完才亮；卧底被投出能猜词", async () => {
  const seen = [];
  const spy = { setup: async () => ({ pair: { civ: "苹果", spy: "梨" } }), hits: (g, w) => g === w,
    clues: async (api, ps) => { seen.push({ k: "clue", p: ps[0] }); return [{ name: ps[0].name, text: "圆的" }]; },
    votes: async (api, ps, clues, names) => { seen.push({ k: "vote", p: ps[0] }); return [{ name: ps[0].name, target: names[0] }]; },
    guess: async (api, p) => { seen.push({ k: "guess", p }); return { guess: "苹果" }; } };
  const { G } = load(spy);
  const A = G.ADAPTERS.spy, inv = mkInv(G, "spy", 4, { seats: [{ kind: "user", peer: "A", name: "甲" }, { kind: "char", peer: "B", charId: "b1", name: "阿B" }, { kind: "npc", name: "丙" }, { kind: "npc", name: "丁" }] });
  await assert.rejects(A.init(inv, {}), /线路/);
  let st = await A.init(inv, { hostApi: {} });
  const v0 = A.view(st);
  assert.ok(JSON.stringify(v0).indexOf("苹果") < 0 && JSON.stringify(v0).indexOf("梨") < 0, "公开那份没有词");
  assert.deepStrictEqual(privKeys(v0), []);
  assert.ok(["苹果", "梨"].indexOf(A.priv(st, 1).word) >= 0);
  // 角色那一手：只拿自己那份 priv，role 是 unknown
  const mv = await A.charMove(A.cleanView(JSON.parse(JSON.stringify(v0))), 1, inv, { api: {}, char: { name: "阿B", persona: "p" }, opts: {}, priv: A.priv(st, 1) });
  assert.ok(seen.some(x => x.k === "clue" && x.p.role === "unknown" && x.p.word === A.priv(st, 1).word));
  assert.ok(mv.text);
  // 全场描述一圈 → 投票：投完之前公开那份只有谁投了
  for (let k = 0; k < 4; k++) st = (await A.apply(st, A.turn(st), { text: "圆的" }, { inv })).st;
  assert.strictEqual(st.phase, "vote");
  const spyIdx = st.roles.indexOf("spy"), others = [0, 1, 2, 3].filter(i => i !== spyIdx);
  st = (await A.apply(st, A.turn(st), { target: A.turn(st) === spyIdx ? others[0] : spyIdx }, { inv })).st;
  const vv = A.view(st);
  assert.strictEqual(vv.voted.length, 1); assert.ok(!("votes" in vv), "票在投完之前不公开投给谁");
  while (st.phase === "vote") { const ti = A.turn(st); st = (await A.apply(st, ti, { target: ti === spyIdx ? others[0] : spyIdx }, { inv })).st; }
  assert.strictEqual(st.phase, "guess"); assert.strictEqual(A.turn(st), spyIdx);
  st = (await A.apply(st, spyIdx, { guess: "苹果" }, { inv })).st;
  const res = A.result(st, inv);
  assert.ok(res && res.winners.indexOf(spyIdx) >= 0, "猜中翻盘");
  assert.ok(A.view(st).reveal.civ === "苹果", "终局才亮词");
});

test("心有灵犀：两人各写各的，两边都交了才亮；没亮之前公开那份只说谁交了", async () => {
  const { G } = load();
  const A = G.ADAPTERS.lingxi, inv = mkInv(G, "lingxi", 2, { seats: [{ kind: "user", peer: "A", name: "甲" }, { kind: "char", peer: "B", charId: "b1", name: "阿B" }] });
  let st = A.init(inv);
  st = A.apply(st, 0, { word: "月亮" }, { inv }).st;
  const v = A.view(st);
  assert.deepStrictEqual(v.sent, [true, false]);
  assert.ok(JSON.stringify(v).indexOf("月亮") < 0, "没亮之前别人看不到");
  assert.deepStrictEqual(A.priv(st, 0), { mine: "月亮" });
  assert.strictEqual(A.turn(st), 1);
  // 角色那台：从它那边看，桌上「对面的词」在前——用的是单机那两段提示词
  let sys = "";
  const mv = await A.charMove(A.cleanView(JSON.parse(JSON.stringify(v))), 1, inv, { api: { lingxi: s => { sys = s; return JSON.stringify({ word: "夜晚" }); } }, char: { name: "阿B" }, opts: {}, priv: A.priv(st, 1) });
  assert.deepStrictEqual(mv, { word: "夜晚" });
  assert.ok(sys.indexOf("月亮") < 0, "对面这一轮写的词不进角色的提示词");
  st = A.apply(st, 1, mv, { inv }).st;
  assert.deepStrictEqual(A.view(st).pair, ["月亮", "夜晚"]);
  st = A.apply(st, 0, { word: "星星" }, { inv }).st; st = A.apply(st, 1, { word: "星星" }, { inv }).st;
  assert.ok(st.rounds[0].hit, "一样就对上");
  st = A.apply(st, -1, { end: true }, { inv }).st;
  assert.match(A.result(st, inv).text, /对上 1 次/);
});
