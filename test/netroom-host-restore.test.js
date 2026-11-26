// 开局的人重进房间／刷新以后，正在打的局接着打（她 2026-11-22）：
//   庄那台每推进一步把整局存进自己这台（x_netGameHost，按房间 id＋gid）；新开的 Session 从存档接回来、resend，
//   公开那份广播、各座位那份只发给座位主人；正在判的那一手重新发起；打完只留战绩卡、状态清掉；删房间一起删；
//   存档不上云、不进导出、不往房里发。跑团的团照旧一拍一拍写回房主的团，接回来不多落一份账。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), games = read("js/games.js"), nsrc = read("js/netroom.js");
const tick = () => new Promise(ok => setTimeout(ok, 2));
async function until(fn, n) { for (let i = 0; i < (n || 6000); i++) { if (fn()) return true; await tick(); } return false; }
const KEY = "x_netGameHost", ROOM = "nr_1";
const cutr = (a, b) => { const i = games.indexOf(a), j = games.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return games.slice(i, j); };

// 存档桩：照写入方 saveJSON(x_netGameHost, …) 的形状（netroom-games.js 的 persist），一台手机一份
function mem() { const box = {}; let saves = 0; return { box, load: () => (KEY in box ? JSON.parse(box[KEY]) : {}), save: v => { saves++; box[KEY] = JSON.stringify(v); }, saves: () => saves }; }

// 两台手机：A 开局（庄），B 带一个角色来；swapWhen(那条 state) 为真时，A 那份 Session 整个丢掉、用存档新开一份
function rig(w, opt) {
  const stores = { A: mem(), B: mem() }, posts = [], log = [], S = {};
  let mark = -1, swaps = 0;
  const mk = id => w.NetGameSession(Object.assign({ me: () => id, nick: () => id === "A" ? "甲" : "乙", nickOf: x => x === "A" ? "甲" : "乙", fast: true, endWait: 0,
    send: (o, to) => deliver(id, o, to), post: (type, x) => posts.push({ by: id, type, x }), patchCard: () => {},
    roomId: () => ROOM, store: stores[id], presence: () => ({ A: "on", B: "on" }),
    charOf: cid => id === "B" && cid === "b1" ? { id: "b1", name: "阿B", persona: "只在 B 手机上" } : null,
    apiFor: cid => ({ id: id + ":" + cid }), myChars: () => [] }, opt.mkx ? opt.mkx(id) : {}));
  function deliver(from, obj, to) {
    log.push({ from, obj, to });
    if (from === "A" && obj.op === "state" && mark < 0 && !process.env.NO_SWAP && opt.swapWhen(obj)) {
      // 开局的人这台：内存里那份没了（重进房间／刷新），从存档新开一份；有人进来报到 → resend
      mark = log.length; swaps++;
      S.A = mk("A"); S.A.resend();
    }
    (to ? [to] : ["A", "B"].filter(x => x !== from)).forEach(id => setTimeout(() => S[id] && S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0));
  }
  S.A = mk("A"); S.B = mk("B");
  return { S, log, posts, stores, swapped: () => mark >= 0, after: () => log.slice(mark) };
}
async function play(w, o) {
  const r = rig(w, o), { S, log } = r;
  const gid = S.A.invite(o.game, Object.assign({ autoNext: "auto" }, o.cfg), o.hostPicks || [], o.prep || null, o.setter || null);
  S.B.join(gid, o.bPicks || [{ kind: "char", charId: "b1", name: "阿B" }], "A");
  assert.ok(await until(() => log.some(l => l.obj.op === "card" && l.obj.x.seats.some(s => s.peer === "B"))), "B 没坐上");
  assert.ok(await S.A.start(gid), "没开起来");
  if (o.drive) o.drive(r, gid);
  const ended = await until(() => r.posts.some(p => p.type === "gamerec"));
  if (!ended && process.env.NR_DEBUG) console.log(log.slice(-12).map(l => l.from + ">" + (l.to || "*") + " " + l.obj.op + " " + JSON.stringify(l.obj.view || l.obj.move || l.obj.data || l.obj.text || "").slice(0, 300)).join("\n"));
  assert.ok(ended, o.game.key + " 没打完");
  assert.ok(r.swapped(), o.game.key + " 中途没换过庄那份 Session（swapWhen 一直没成立）");
  return Object.assign(r, { gid });
}
// 每一盒都要过的几条
function checks(r, key) {
  const { S, gid, stores, log } = r;
  const inv = S.A.seen(gid).inv, after = r.after();
  assert.ok(after.some(l => l.from === "A" && l.obj.op === "state" && !l.to), key + "：接回来以后公开那份重新广播了");
  assert.ok(!after.some(l => l.obj.op === "gone"), key + "：接得回来的局不许再说作废");
  // priv：只发给座位主人、从不广播；庄自己那几座不走网络
  after.filter(l => l.obj.op === "priv").forEach(l => {
    assert.ok(l.to, key + "：priv 进了广播");
    assert.strictEqual(l.to, inv.seats[l.obj.seat].peer, key + "：priv 发给了不是座位主人的那台");
    assert.notStrictEqual(l.to, "A");
  });
  if (r.expectPriv) assert.ok(after.some(l => l.obj.op === "priv" && l.to === "B"), key + "：接回来以后 B 的那份重新发了");
  // 存档：只在 A 这台，打完清掉；从不往房里发
  assert.strictEqual(stores.B.saves(), 0, key + "：不是庄的那台不写对局存档");
  assert.ok(!(ROOM in stores.A.load()), key + "：打完了状态还留在存档里");
  assert.ok(!log.some(l => /inflight|x_netGameHost/.test(JSON.stringify(l.obj))), key + "：存档内容跑进了房里");
  const recs = r.posts.filter(p => p.type === "gamerec");
  assert.strictEqual(recs.length, 1, key + "：战绩卡只发一张"); assert.strictEqual(recs[0].by, "A");
}

// ── 五子棋、海龟汤（netroom-games.js 自带的几盒）──
const GMK = new Function(cutr("  const GMK_N = 15;", "  function GomokuBoard(props) {") + "\nreturn { N: GMK_N, empty: gmkEmpty, place: gmkPlace, replay: gmkReplay, wins: gmkWins, bestMove: gmkBestMove, threat: gmkThreat, coord: gmkCoord };")();
function loadBase(guess) { const w = {}; new Function("window", gsrc)(w); w.GameShared = { gomoku: GMK, guess: guess || null }; return w; }

test("五子棋：下到一半庄那份丢了，从存档接回来接着下完；打完存档清掉", async () => {
  const w = loadBase();
  const r = await play(w, { game: { key: "gomoku", zh: "五子棋", min: 2, max: 2 }, cfg: { total: 2, npcFill: true }, swapWhen: o => o.seq === 5 });
  checks(r, "五子棋");
  assert.ok(await until(() => r.S.B.seen(r.gid).inv.status === "done"), "B 那边也看到打完了");
});

test("海龟汤：庄正在判（等模型回话）那一下断了——接回来重新判那一问；汤底只给出题那座", async () => {
  let n = 0;
  const guess = { KINDS: { haigui: { verdicts: "是 / 不是 / 不重要" } }, hit: () => false,
    answerOne: async () => { n++; await new Promise(ok => setTimeout(ok, 5)); return n >= 6 ? { verdict: "是", note: "", solved: true, reveal: "真相" } : { verdict: "不是", note: "" }; },
    askOne: async () => "是自杀吗", judge: async () => ({ correct: false }), newPuzzle: async () => ({ surface: "汤面", truth: "真相" }) };
  const w = loadBase(guess);
  // 出题的是 B 那座（汤底只给 TA）；庄正在判时那条 state 带着 busy
  const r = await play(w, { game: { key: "haigui", zh: "海龟汤", min: 2, max: 8 }, cfg: { total: 3, npcFill: true }, hostPicks: [],
    bPicks: [{ kind: "user" }, { kind: "char", charId: "b1", name: "阿B" }], setter: { mode: "seat", peer: "B" },
    mkx: id => ({ hostApi: () => id === "A" ? { id: "host" } : null }),
    drive: (r, gid) => { (async () => { for (let k = 0; k < 400; k++) { const sv = r.S.B.seen(gid); if (sv && sv.view && sv.view.phase === "set" && sv.view.turn === 0) { r.S.B.move(gid, 0, { puzzle: { surface: "汤面", truth: "真相" } }); return; } await tick(); } })(); },
    swapWhen: o => o.view && o.view.busy === true && o.view.log.length >= 2 });
  r.expectPriv = true;
  checks(r, "海龟汤");
  const rec = r.posts.find(p => p.type === "gamerec");
  assert.match(rec.x.text, /破了题/);
  const privs = r.log.filter(l => l.obj.op === "priv");
  assert.ok(privs.every(l => l.obj.seat === 0 && l.to === "B"), "汤底只给出题那座的主人");
  assert.ok(!r.log.filter(l => !l.to).some(l => l.obj.op === "state" && !l.obj.view.done && JSON.stringify(l.obj.view).includes("真相")), "揭晓前广播里没有汤底");
});

// ── UNO、斗地主、谁是卧底（netroom-cards.js）──
const UnoCore = require("../js/uno-core.js"), MahjongCore = require("../js/mahjong-core.js");
require("../js/lingxi-core.js");
const LingxiCore = globalThis.LingxiCore || require("../js/lingxi-core.js");
const CARDS = new Function("UnoCore", [cutr("  const CARD_SUITS = ", "  function PlayCard(props) {"), cutr("  const LIAR_DICE = 5", "  const DIE_PIPS"), cutr("  const PK_CHIPS", "  function PokerGame(props) {"),
  cutr("  function omRanks(n)", "  function OldMaidGame(props) {"), cutr("  const BJ_CHIPS", "  function BlackjackGame(props) {"), cutr("  const DDZ_ROUNDS = 5;", "  function MjTile(props) {"), cutr("  function unoBestColor(hand)", "  function unoPublic(state) {")].join("\n")
  + "\nreturn { name: cardName, BOT_SKILL, botSlip, uno: { C: UnoCore, local: unoLocalMove }, liar: { newGame: liarNewGame, newRound: liarNewRound, act: liarAct, npc: liarNpcMove, total: liarTotal, legal: liarLegalBid, DICE: LIAR_DICE },"
  + " poker: { newGame: pkNewGame, newHand: pkNewHand, act: pkAct, npc: pkNpcMove, options: pkOptions }, oldmaid: { newGame: omNewGame, act: omAct, target: omTarget },"
  + " bj: { newGame: bjNewGame, newHand: bjNewHand, act: bjAct, npc: bjNpcMove, value: bjValue }, ddz: { newGame: ddzNewGame, newRound: ddzNewRound, bid: ddzBid, play: ddzPlay, npcBid: ddzNpcBid, npcPlay: ddzNpcPlay, hint: ddzHint, analyze: ddzAnalyze, TYPE_ZH: DDZ_TYPE_ZH } };")(UnoCore);
function loadCards(spy) {
  const w = { MahjongCore, LingxiCore, extractJSON: s => { try { return JSON.parse(s); } catch (e) { return null; } } };
  new Function("window", gsrc)(w);
  w.GameShared = { cards: CARDS, spy: spy || null, voiceRules: () => "", call: async () => "{}" };
  new Function("window", read("js/netroom-cards.js"))(w);
  return w;
}

test("UNO、斗地主：打到一半庄那份丢了，接回来手牌照旧只发给座位主人，打到结束", async () => {
  for (const [key, zh, total, at] of [["uno", "UNO", 3, 6], ["doudizhu", "斗地主", 3, 8]]) {
    const w = loadCards();
    const r = await play(w, { game: { key, zh, min: 2, max: 6 }, cfg: { total, npcFill: true, rounds: 1 }, prep: null, swapWhen: o => o.seq === at,
      mkx: () => ({ charOpts: () => ({ botSkill: "normal" }) }) });
    r.expectPriv = true;
    checks(r, zh);
    // 接回来以后 B 那台手里那份跟庄那份对得上（不是旧的那一份）
    const bSeat = r.S.A.seen(r.gid).inv.seats.findIndex(s => s.peer === "B");
    const last = r.after().filter(l => l.obj.op === "priv" && l.obj.seat === bSeat).pop();
    assert.ok(last, zh + "：B 那座接回来以后收到过自己那份");
  }
});

test("谁是卧底：词只在各人自己那份；中途换掉庄那份，接回来照样投完票出结果", async () => {
  const spy = { setup: async () => ({ pair: { civ: "苹果", spy: "梨" } }), hits: (g, x) => g === x,
    clues: async (api, ps) => ps.map(p => ({ name: p.name, text: "圆的" })),
    votes: async (api, ps, clues, names) => ps.map(p => ({ name: p.name, target: names.find(x => x !== p.name) })),
    guess: async () => ({ guess: "苹果" }) };
  const w = loadCards(spy);
  const r = await play(w, { game: { key: "spy", zh: "谁是卧底", min: 4, max: 8 }, cfg: { total: 4, npcFill: true }, swapWhen: o => o.seq === 4,
    mkx: id => ({ hostApi: () => id === "A" ? { id: "host" } : null }) });
  r.expectPriv = true;
  checks(r, "谁是卧底");
  assert.ok(!r.log.filter(l => !l.to).some(l => l.obj.op === "state" && !l.obj.view.reveal && /苹果|梨/.test(JSON.stringify(l.obj.view))), "揭晓前广播里没有词");
});

// ── 狼人杀（netroom-social.js）──
const PURE = new Function([
  "function shuffle(a){ return a.slice().sort(() => Math.random() - .5); }",
  cutr("  function wolfCount(n)", "  // 战术参考"), cutr("  function wolfWinner(list, winMode)", "  function validWolfTarget("),
  cutr("  function boardState(list, dayNum)", "  // 白天发言：存活"),
  cutr("  const AV_QUEST = ", "  // 湖中仙女")].join("\n")
  + "\nreturn { wolf: { GODS, WOLF_SPECIALS, roleName, isWolfRole, isGodRole, wolfCount, standardBoard, boardLine, boardState, winner: wolfWinner, privText: wolfPrivText },"
  + " avalon: { QUEST: AV_QUEST, EVIL: AV_EVIL, ROLE_ZH: AV_ROLE_ZH, side: avSide, failsReq: avFailsReq, board: avalonBoard, secretFor: avSecretFor, revealFor: avRevealFor } };")();

test("狼人杀：夜里断了庄那份，接回来身份照旧只给本人，打到分出胜负", async () => {
  const w = {}; new Function("window", gsrc)(w); w.GameShared = { wolf: PURE.wolf, avalon: PURE.avalon }; new Function("window", read("js/netroom-social.js"))(w);
  const r = await play(w, { game: { key: "werewolf", zh: "狼人杀", min: 5, max: 12 }, cfg: { total: 6, npcFill: true }, swapWhen: o => o.seq === 6,
    mkx: () => ({ hostApi: () => null, apiFor: () => null }) });
  r.expectPriv = true;
  checks(r, "狼人杀");
});

// ── 擂台（netroom-debate.js）──
test("擂台：辩到一半庄那份丢了，接回来接着辩、庄照旧用自己的线路判", async () => {
  const judged = [];
  const w = {}; new Function("window", gsrc)(w);
  w.DebateShared = { genTurn: async (api, o) => ({ say: o.who.name + "的一段", at: "" }), pickSide: async () => ({ side: "con", stance: "不认" }),
    genSideLine: async () => ({ at: "", text: "起哄" }), genAfterword: async (api, o) => o.who.name + "不服",
    genResult: async api => { judged.push(api.id); return { winner: "阿B", reason: "说得实", crux: "", closings: [] }; }, drawTopics: async () => ["题"] };
  new Function("window", read("js/netroom-debate.js"))(w);
  const r = await play(w, { game: { key: "debate", zh: "辩论擂台", min: 2, max: 6 }, cfg: { total: 2, npcFill: true }, prep: { topic: "早起比熬夜好", rounds: 2, mode: "serious" },
    mkx: id => ({ hostApi: () => id === "A" ? { id: "apiA" } : null }), swapWhen: o => o.view && o.view.phase === "talk" && (o.view.parts || o.view.turns || []).length >= 1 && o.seq >= 4 });
  checks(r, "擂台");
  assert.deepStrictEqual(judged, ["apiA"], "只判了一次，用的是庄的线路");
});

// ── 跑团（netroom-trpg.js）──
globalThis.parseJSONLoose = s => { try { return JSON.parse(String(s).replace(/^[^{]*/, "").replace(/[^}]*$/, "")); } catch (e) { return null; } };
globalThis.salvageByKeys = () => null;
globalThis.narrativeCore = () => "【叙事核心】";
require("../js/trpg-core.js");
const T = require("../js/trpg.js");
const REGIONS = [{ name: "北镇", terrain: "城郭", adj: [], nodes: [{ name: "驿站", kind: "城镇" }, { name: "钟楼", kind: "地标" }], pos: null, size: 1 }];
// 团的形状照 test/netroom-trpg.test.js 那份（js/trpg.js 开团那一处的字面量）
const camp0 = () => ({ id: "rpg_1", title: "钟楼失火",
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
          { key: "c1", name: "裴照川", hp: 100, maxHp: 100, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } }],
  items: [], clues: [], place: "驿站", pos: "驿站", visited: ["驿站"], world: "雾镇", dossier: { truth: "秘典真相", twist: "翻转", secrets: "心事", endgame: "结局", mates: [] },
  stageIdx: 0, stages: [{ goal: "查清失火", place: "钟楼" }, { goal: "b" }], mapRegions: REGIONS,
  clocks: [{ name: "纵火犯要跑", filled: 1, max: 6 }], pace: { stageIdx: 0, want: true }, npcs: [], quests: [], time: { day: 1, part: "晨" },
  choices: [{ text: "问守夜人", check: null }, { text: "接着等", check: null }],
  msgs: [{ id: "m0", role: "gm", content: "开场：钟楼起火。" }], pendingStage: false, pendingEnd: false });
function loadTrpg() {
  const saved = [], gm = [];
  const w = { TrpgShared: Object.assign({}, T.TrpgShared, { loadCamps: () => JSON.parse(JSON.stringify(saved.length ? saved[saved.length - 1] : [camp0()])), saveCamps: v => { saved.push(JSON.parse(JSON.stringify(v))); return true; } }) };
  w.callAI = async (api, sys) => {
    if (/轮到你了|【跑团·一回合】/.test(sys)) return JSON.stringify({ say: "我去看看", do: "推开门", try: null });
    gm.push(api.id); await new Promise(ok => setTimeout(ok, 5));
    return JSON.stringify({ scene: "大家都动了。", clue: [], choices: [{ text: "接着查" }], paras: ["钟楼重建了。"], closing: "雾散了", untold: [] });
  };
  new Function("window", gsrc)(w); new Function("window", read("js/netroom-trpg.js"))(w);
  return { w, saved, gm };
}

test("跑团：守密人正在写这一拍时庄那份丢了——接回来重新请一次，团里只落一份；落幕写回一次", async () => {
  const { w, saved, gm } = loadTrpg();
  let swappedAt = -1;
  const r = await play(w, { game: { key: "trpg", zh: "跑团", min: 1, max: 5 }, cfg: { total: 2, npcFill: false }, hostPicks: [{ kind: "user" }], prep: { campId: "rpg_1", personas: {}, timeout: 0 },
    mkx: id => ({ hostApi: route => id === "A" ? { id: "gm:" + (route || "game") } : null }),
    // 房主（座位 0）自己交；第一拍交完庄去请守密人（busy）那一下断；接回来写完这一拍，房主点落幕
    drive: (r, gid) => { (async () => {
      assert.ok(await until(() => { const v = r.S.A.seen(gid) && r.S.A.seen(gid).view; return v && v.phase === "act" && v.done && v.done[1]; }), "角色那座没交");
      r.S.A.move(gid, 0, { pick: 0 });
      assert.ok(await until(() => r.swapped() && r.S.A.seen(gid) && r.S.A.seen(gid).view.beat === 1 && r.S.A.seen(gid).view.phase === "act"), "接回来以后这一拍没写完");
      swappedAt = gm.length;
      r.S.A.move(gid, -1, { op: "finale", finalAct: "把钥匙还了" });
    })(); },
    swapWhen: o => o.view && o.view.busy === true && o.view.beat === 0 && o.view.phase === "act" });
  checks(r, "跑团");
  const camp = saved[saved.length - 1].find(c => c.id === "rpg_1");
  assert.ok(camp.ended, "团写成落幕了");
  const beats = camp.msgs.filter(m => m.role === "user" && /^〔这一拍大家的行动〕/.test(m.content));
  assert.strictEqual(beats.length, 1, "第一拍的行动只落了一份（重新请守密人是整份换上，不是追加）");
  assert.strictEqual(camp.msgs.filter(m => m.content === "大家都动了。" || (m.role === "gm" && /大家都动了/.test(m.content))).length, 1, "守密人那一拍只进史一次");
  assert.ok(swappedAt >= 0 && gm.length - swappedAt === 1, "终章只请了一次");
});

test("跑团接回来：终章已经写进团里（落幕了）就不再重写一遍", async () => {
  const { w, saved } = loadTrpg();
  const A = w.NetGameCore.ADAPTERS.trpg;
  const inv = { host: "A", seats: [{ kind: "user", peer: "A", name: "Lisa" }] };
  const st = await A.init(inv, { prep: { campId: "rpg_1", timeout: 0 } });
  saved.push([Object.assign(camp0(), { ended: true, epilogue: { paras: ["x"] } })]);
  const back = await A.restore(st, [-1, { op: "finale" }, "A"]);
  assert.strictEqual(back.st.phase, "done"); assert.strictEqual(back.inflight, null);
  const keep = await A.restore(Object.assign({}, st, { camp: Object.assign({}, st.camp, { id: "rpg_x" }) }), [0, { pick: 0 }, "A"]);
  assert.deepStrictEqual(keep.inflight, [0, { pick: 0 }, "A"], "没落幕的照常重新判那一手");
});

// ── 框架这几条 ──
test("恢复不了的才作废：存档里有的接回来、没有的照旧广播 gone；横幅照常列接回来的局", async () => {
  const w = loadBase();
  const store = mem(), sent = [];
  const mk = () => w.NetGameSession({ me: () => "A", nick: () => "甲", nickOf: x => x, fast: true, roomId: () => ROOM, store, send: (o, to) => sent.push({ o, to }), post: () => {}, patchCard: () => {},
    myCards: () => [{ gid: keep, host: "A", status: "open" }, { gid: "g_old", host: "A", status: "playing" }], presence: () => ({}) });
  const s1 = mk(); const keep = s1.invite({ key: "gomoku", zh: "五子棋", min: 2, max: 2 }, { total: 2 }, [{ kind: "user" }]);
  assert.ok(store.load()[ROOM].games[keep], "报名中的局也存");
  const s2 = mk();
  assert.ok(s2.isHost(keep), "新开的一份认得存档里那一局");
  s2.resend();
  assert.ok(sent.some(x => x.o.op === "gone" && x.o.gid === "g_old"), "存档里没有的照旧作废");
  assert.ok(!sent.some(x => x.o.op === "gone" && x.o.gid === keep));
  // 旧的那份退下：不再发、不再写
  const n0 = sent.length, k0 = store.saves(); s1.cancel(keep);
  assert.strictEqual(sent.length, n0); assert.strictEqual(store.saves(), k0);
  // 取消 → 存档里那一局清掉
  s2.cancel(keep);
  assert.ok(!(ROOM in store.load()), "取消的局状态不留");
  // 横幅：我开的局按 isHost 列（接回来的就列），开局的人不在时别人那边不列
  assert.ok(/r\.x\.host === meId\.current \? !!\(gs && gs\.isHost\(r\.x\.gid\)\)/.test(nsrc));
});

test("上限：一个房间只留最近几局、只留最近几个房间", async () => {
  const w = loadBase(), store = mem();
  for (let k = 0; k < 14; k++) {
    const s = w.NetGameSession({ me: () => "A", nick: () => "甲", nickOf: x => x, roomId: () => "nr_" + k, store, send: () => {}, post: () => {}, patchCard: () => {} });
    for (let j = 0; j < (k === 13 ? 9 : 1); j++) s.invite({ key: "gomoku", zh: "五子棋", min: 2, max: 2 }, { total: 2 }, [{ kind: "user" }]);
    await tick();
  }
  const all = store.load();
  assert.ok(Object.keys(all).length <= 12, "房间数有上限");
  assert.ok(Object.keys(all.nr_13.games).length <= 6, "一个房间里的局数有上限");
});

test("删房间一起删；存档不上云、不进导出", () => {
  const box = { x_netGameHost: JSON.stringify({ nr_1: { ts: 1, games: { g: {} } }, nr_2: { ts: 1, games: { g: {} } } }), x_netroom: "[]" };
  const w = {}, loadJSON = (k, d) => (k in box ? JSON.parse(box[k]) : d), saveJSON = (k, v) => { box[k] = JSON.stringify(v); };
  new Function("window", "loadJSON", "saveJSON", nsrc)(w, loadJSON, saveJSON);
  assert.strictEqual(w.NetRoomCore.hostGamesIn("nr_1"), 1);
  w.NetRoomCore.removeRoom("nr_1");
  assert.deepStrictEqual(Object.keys(JSON.parse(box.x_netGameHost)), ["nr_2"]);
  assert.match(read("js/cloud.js"), /const LOCAL_ONLY = \{[^}]*x_netGameHost: 1/);
  assert.match(read("js/backup-pack.js"), /const DEVICE_ONLY = \{[^}]*x_netGameHost: 1/);
  // 回原来的房间：存档里有我当庄的局，就把小游戏装上、接回来
  assert.match(nsrc, /Core\.hostGamesIn\(resume\.id\)/);
  assert.match(nsrc, /roomId: \(\) => rid \|\|/);
});
