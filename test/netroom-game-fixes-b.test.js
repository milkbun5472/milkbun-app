// 联机小游戏这一批小毛病（终局台词进回看、合并调用的 NPC 带台词、故事接龙旧局、擂台弹幕感言存档＋再来一局带辩题、真心话尺度、心有灵犀同时写）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), dsrc = read("js/netroom-debate.js"), csrc = read("js/netroom-cards.js"), nsrc = read("js/netroom.js"), games = read("js/games.js");
const LingxiCore = require("../js/lingxi-core.js");
const tick = () => new Promise(ok => setTimeout(ok, 3));
async function until(fn, n) { for (let i = 0; i < (n || 3000); i++) { if (fn()) return true; await tick(); } return false; }
function bus(ids, mk) {
  const S = {}, log = [];
  const deliver = (from, obj, to) => { log.push({ from, obj, to }); (to ? [to] : ids.filter(x => x !== from)).forEach(id => setTimeout(() => S[id] && S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0)); };
  ids.forEach(id => { S[id] = mk(id, (obj, to) => deliver(id, obj, to)); });
  return { S, log };
}
// DebateShared 桩：照 debate.js 导出的那几样回包形状；感言故意慢一拍（判完以后才到）
function loadDebate() {
  const w = {};
  new Function("window", gsrc)(w);
  w.DebateShared = {
    genTurn: async (api, o) => ({ say: o.who.name + "的一段" }), pickSide: async () => ({ side: "con", stance: "" }),
    genSideLine: async (api, o) => ({ text: o.who.name + "起哄" }),
    genAfterword: async (api, o) => { await new Promise(ok => setTimeout(ok, 60)); return o.who.name + "不服"; },
    genResult: async () => ({ winner: "甲", reason: "说得实", crux: "" }), drawTopics: async () => ["现出的题"]
  };
  new Function("window", dsrc)(w);
  return w;
}

test("终局：庄等桌边台词停一阵再发战绩卡，判完才到的赛后感言进回看；擂台弹幕、感言存进战绩卡（cleanReplay 留着）", async () => {
  const w = loadDebate(), posts = [];
  const rnd = Math.random; Math.random = () => 0;
  try {
    const mk = (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true, endWait: 400,
      post: (type, x) => posts.push({ type, x }), patchCard: () => {}, hostApi: () => id === "A" ? { id: "apiA" } : null,
      charOf: cid => id === "B" ? { id: cid, name: "阿B", persona: "" } : null, apiFor: cid => ({ id: id + cid }), myChars: () => id === "B" ? ["b1"] : [], presence: () => ({ A: "on", B: "on" }) });
    const { S } = bus(["A", "B"], mk);
    const gid = S.A.invite({ key: "debate", zh: "辩论擂台", min: 2, max: 6 }, { total: 2, npcFill: true }, [{ kind: "user", side: "pro" }], { topic: "早起比熬夜好", rounds: 1, mode: "free" });
    S.B.join(gid, [{ kind: "char", charId: "b1", name: "阿B", side: "con" }], "A");
    await until(() => false, 20);
    assert.ok(await S.A.start(gid));
    assert.ok(await until(() => S.A.seen(gid) && S.A.seen(gid).view.phase === "talk"));
    S.A.side(gid, { kind: "dm", name: "A", text: "加油" });
    S.A.move(gid, 0, { say: "早起好" });
    assert.ok(await until(() => posts.some(p => p.type === "gamerec"), 5000));
    const rec = w.NetGameCore.cleanRecord(JSON.parse(JSON.stringify(posts.find(p => p.type === "gamerec").x)));
    assert.ok(rec.replay.side.some(x => x.kind === "aw" && x.text === "阿B不服"), "判完才到的感言要进回看");
    assert.ok(rec.replay.side.some(x => x.kind === "dm" && x.text === "加油"), "弹幕存进战绩卡");
    // 再来一局：辩题、轮数、怎么吵带过去，卡上还能改
    const ngid = S.A.again(gid);
    assert.deepStrictEqual(S.A.prepOf(ngid), { topic: "早起比熬夜好", rounds: 1, mode: "free" });
    S.A.setPrep(ngid, { topic: "换一道", rounds: 5, mode: "serious" });
    assert.strictEqual(S.A.prepOf(ngid).topic, "换一道");
  } finally { Math.random = rnd; }
});

test("海龟汤：并进庄那次调用的 NPC 带上台词（同一次 round，withSay），走桌边那一路", async () => {
  const w = {};
  new Function("window", gsrc)(w);
  let speakers = null;
  w.GameShared = { guess: { KINDS: { haigui: { verdicts: "是 / 不是 / 不重要" } }, hit: () => false,
    round: async (api, kind, sec, q, sp) => { speakers = sp; return { userAnswer: { verdict: "不是", note: "" }, ai: [{ name: "路人甲", question: "他是自杀吗", verdict: "不是", note: "", say: "我猜猜看" }] }; } } };
  const A = w.NetGameCore.ADAPTERS.haigui;
  const inv = { key: "haigui", mode: "normal", seats: [{ kind: "user", name: "甲", peer: "A" }, { kind: "npc", name: "路人甲" }] };
  const st = { phase: "play", setter: -1, log: [], turn: 0, done: false, solvedBy: -1, surface: "汤面", truth: "汤底", busy: false };
  const r = await A.apply(st, 0, { ask: "他死了吗" }, { inv, hostApi: { id: "h" } });
  assert.ok(speakers.every(s => s.withSay));
  assert.deepStrictEqual(r.talk, [{ name: "路人甲", text: "我猜猜看", npc: true, seat: 1 }]);
  assert.ok(!("_talk" in r.st));
  // 单机那份提示词：只有带 withSay 的才要 say
  assert.match(games, /const talky = aiSpeakers\.some/);
  assert.match(gsrc, /Array\.isArray\(r\.talk\)/);
});

function loadCards() {
  const w = { LingxiCore, extractJSON: s => { try { return JSON.parse(s); } catch (e) { return null; } } };
  new Function("window", gsrc)(w);
  w.GameShared = { voiceRules: () => "", sayFree: "想说就说", sayList: v => (Array.isArray(v) ? v : [v]).filter(Boolean), call: async (api, sys) => api.lingxi(sys) };
  new Function("window", csrc)(w);
  return w;
}
test("心有灵犀：两边同时写（turns 给两座、交一个剩一个、roundOf 跟轮次），NPC 那一手顺带台词由庄走桌边那一路", async () => {
  const w = loadCards(), A = w.NetGameCore.ADAPTERS.lingxi;
  const inv = { key: "lingxi", mode: "normal", seats: [{ kind: "user", name: "甲", peer: "A" }, { kind: "npc", name: "路人甲" }] };
  let st = A.init(inv);
  assert.deepStrictEqual(A.turns(A.view(st)), [0, 1]);
  assert.deepStrictEqual(A.turns(st), [0, 1]);
  st = A.apply(st, 1, { word: "月亮" }, { inv }).st;
  assert.deepStrictEqual(A.turns(A.view(st)), [0]);
  assert.strictEqual(A.roundOf(A.view(st)), "start:0");
  let sys = "";
  const mv = await A.npcMove(st, 1, inv, { hostApi: { lingxi: s => { sys = s; return JSON.stringify({ word: "夜晚", say: "这个简单" }); } } });
  assert.deepStrictEqual(mv, { word: "夜晚", say: "这个简单" });
  assert.match(sys, /想说就说/);
  assert.match(gsrc, /ad\.npcMove\(g\.st, ti, g\.inv, ctxOf\(g\)\)[\s\S]{0,300}kind: "talk"/);
  // 同时写：真人还没交，NPC 那座不用等她、庄那台先交上；她交了才一起亮
  const posts = [];
  const S = w.NetGameSession({ me: () => "A", nick: () => "A", nickOf: x => x, fast: true, endWait: 0, send: () => {}, post: (t, x) => posts.push({ t, x }), patchCard: () => {},
    hostApi: () => ({ lingxi: () => JSON.stringify({ word: "同" }) }), apiFor: () => null, charOf: () => null, presence: () => ({}) });
  const gid = S.invite({ key: "lingxi", zh: "心有灵犀", min: 2, max: 2 }, { total: 2, npcFill: true }, [{ kind: "user" }], null);
  assert.ok(await S.start(gid));
  assert.ok(await until(() => S.seen(gid).view.sent[1]), "NPC 不等第一座先交");
  assert.strictEqual(S.seen(gid).view.sent[0], false);
  assert.ok(w.NetGameCore.myTurn(S.seen(gid).inv, S.seen(gid).view, "A"));
  S.move(gid, 0, { word: "同" });
  assert.ok(await until(() => S.seen(gid).view.phase === "round"), "两边都交了才亮");
});

test("故事接龙旧局没有 nextWord：view / cleanView / 接一句都不报错", () => {
  const w = {};
  new Function("window", gsrc)(w);
  w.GameShared = { story: { act: (st, key, line) => Object.assign({}, st, { lines: st.lines.concat([{ key, text: line }]), turn: (st.turn + 1) % st.players.length, word: "新词" }) } };
  const A = w.NetGameCore.ADAPTERS.story;
  const old = { players: [{ key: "s0", name: "甲" }, { key: "s1", name: "乙" }], laps: 3, turn: 0, opener: "从前", word: "雨", status: "playing", lines: [], say: [] };
  const v = A.view(old);
  assert.strictEqual(v.nextWord, "");
  assert.strictEqual(A.cleanView(JSON.parse(JSON.stringify(v))).nextWord, "");
  assert.doesNotThrow(() => A.apply(old, 0, { line: "下雨了" }, { inv: { seats: [{ kind: "user", name: "甲" }, { kind: "user", name: "乙" }] } }));
});

test("真心话：开局页有单机那个「尺度」，选了放开点出题和回应都照它", async () => {
  assert.match(nsrc, /key: "todHot"/);
  const w = {};
  new Function("window", gsrc)(w);
  const seen = [];
  w.GameShared = { tod: { plan: () => ({ choice: "真心话" }), ask: async (api, c, who, hot) => { seen.push(["ask", hot]); return { prompt: "题" }; }, answer: async (api, who, c, p, hot) => { seen.push(["answer", hot]); return "答"; } } };
  const A = w.NetGameCore.ADAPTERS.tod;
  const inv = { key: "tod", mode: "normal", seats: [{ kind: "npc", name: "甲" }, { kind: "npc", name: "乙" }] };
  const st = A.init(inv, { cfg: { todHot: "hot" } });
  assert.strictEqual(st.hot, true);
  assert.strictEqual(A.cleanView(JSON.parse(JSON.stringify(A.view(st)))).hot, true);
  await A.npcMove(Object.assign({}, st, { phase: "ask", target: 1, asker: 0, choice: "真心话" }), 0, inv, { hostApi: {} });
  await A.npcMove(Object.assign({}, st, { phase: "answer", target: 1, asker: 0, choice: "真心话", prompt: "题" }), 1, inv, { hostApi: {} });
  assert.deepStrictEqual(seen, [["ask", true], ["answer", true]]);
  assert.strictEqual(A.init(inv, { cfg: {} }).hot, false);
});
