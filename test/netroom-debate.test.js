// 联机小游戏：辩论擂台（js/netroom-debate.js）。辩手座位由主人那台出手、观众弹幕只走房间广播且角色弹幕由主人那台生成、
//   判定走单机擂台那一份 genResult、view 白名单、stateText、单机擂台的提示词抽成共用以后 genRound 照旧用它们
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), dsrc = read("js/netroom-debate.js"), deb = read("js/debate.js"), nsrc = read("js/netroom.js");

// DebateShared 的桩：照 debate.js 末尾 window.DebateShared 那一行导出的名字和各自的回包形状
function load() {
  const calls = [];
  const w = {};
  new Function("window", gsrc)(w);
  w.DebateShared = {
    genTurn: async (api, o) => { calls.push(["turn", api.id, o.who.name]); return { say: o.who.name + "的一段", at: "" }; },
    pickSide: async (api, topic, who) => { calls.push(["side", api.id, who.name]); return { side: "con", stance: "不认" }; },
    genSideLine: async (api, o) => { calls.push(["dm", api.id, o.who.name]); return { at: "", text: o.who.name + "起哄" }; },
    genAfterword: async (api, o) => { calls.push(["aw", api.id, o.who.name]); return o.who.name + "不服"; },
    genResult: async (api, session, uName) => { calls.push(["judge", api.id, session.parts.map(p => p.name + ":" + p.kind).join(","), uName]); return { winner: "甲", reason: "说得实", crux: "两把尺子", closings: [] }; },
    drawTopics: async () => ["现出的题"]
  };
  new Function("window", dsrc)(w);
  return { G: w.NetGameCore, w, calls };
}
function bus(ids, mk) {
  const S = {}, log = [];
  const deliver = (from, obj, to) => {
    log.push({ from, obj, to });
    (to ? [to] : ids.filter(x => x !== from)).forEach(id => setTimeout(() => S[id] && S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0));
  };
  ids.forEach(id => { S[id] = mk(id, (obj, to) => deliver(id, obj, to)); });
  return { S, log };
}
const tick = () => new Promise(ok => setTimeout(ok, 5));
async function until(fn, n) { for (let i = 0; i < (n || 2000); i++) { if (fn()) return true; await tick(); } return false; }
const DEBATE = { key: "debate", zh: "辩论擂台", min: 2, max: 6 };

test("登记进联机小游戏：在 netroom-games.js 之后加载、往 ADAPTERS 里挂；架子上多摆一盒，开局页是它自己的", () => {
  const { G } = load();
  assert.ok(G.supported().indexOf("debate") >= 0);
  const A = G.ADAPTERS.debate;
  ["seatRange", "init", "view", "priv", "turn", "apply", "npcMove", "charMove", "result", "cleanView", "cleanReplay", "stateText", "cleanSide", "watch"].forEach(k => assert.strictEqual(typeof A[k], "function", k));
  assert.deepStrictEqual(G.charOptKinds("debate"), ["side", "recent"]);
  assert.strictEqual(A.shelf.key, "debate");
  const html = read("index.html"), gi = html.indexOf("js/netroom-games.js"), di = html.indexOf("js/netroom-debate.js"), ni = html.indexOf("js/netroom.js");
  assert.ok(gi > 0 && di > gi && ni > di, "加载顺序：games → debate → netroom");
  assert.match(nsrc, /\.ADAPTERS\[k\]\.shelf/);
  assert.match(nsrc, /prepA && prepA\.Prep/);
  assert.match(read("js/games.js"), /concat\(props\.extra \|\| \[\]\)/);
});

test("报名时挑的那一边跟着座位走（广播出去的报名也带着），别的字段照旧不收", () => {
  const { G } = load();
  let inv = G.newInvite({ gid: "g", game: DEBATE, cfg: { total: 2, npcFill: true }, host: "A", nick: "甲", picks: [{ kind: "user", side: "pro" }] });
  assert.strictEqual(inv.seats[0].side, "pro");
  inv = G.joinSeats(inv, "B", "乙", [{ kind: "char", charId: "b1", name: "阿B", side: "con", persona: "不该出门" }]).inv;
  assert.deepStrictEqual(inv.seats[1], { kind: "char", name: "阿B", peer: "B", charId: "b1", side: "con" });
  assert.ok(!("side" in G.cleanSeat({ kind: "user", peer: "A", name: "甲", side: "hack" })));
});

test("一整场：真人在自己那台说、角色由主人那台挑边和发言、庄用自己的线路判；弹幕只走广播，角色弹幕和感言由主人那台写", async () => {
  const { G, w, calls } = load();
  const posts = [];
  const rnd = Math.random; Math.random = () => 0;
  try {
    const mk = (id, send) => w.NetGameSession({ me: () => id, nick: () => id === "A" ? "甲" : "乙", nickOf: x => x === "A" ? "甲" : "乙", send, fast: true,
      post: (type, x) => posts.push({ by: id, type, x }), patchCard: () => {},
      hostApi: () => id === "A" ? { id: "apiA" } : null,
      charOf: cid => id === "B" && (cid === "b1" || cid === "b2") ? { id: cid, name: cid === "b1" ? "阿B" : "小二", persona: "（只在 B 手机上）" } : null,
      apiFor: cid => ({ id: id + ":" + cid }),
      myChars: () => id === "B" ? ["b1", "b2"] : [],
      presence: () => ({ A: "on", B: "on" }) });
    const { S, log } = bus(["A", "B"], mk);
    const gid = S.A.invite(DEBATE, { total: 2, npcFill: true }, [{ kind: "user", side: "pro" }], { topic: "早起比熬夜好", rounds: 1, mode: "serious" });
    S.B.join(gid, [{ kind: "char", charId: "b1", name: "阿B", side: "" }], "A");   // 随人设
    assert.ok(await until(() => log.some(l => l.obj.op === "card" && l.obj.x.seats[1].kind === "char")));
    assert.ok(await S.A.start(gid));
    // 挑边：B 那台用 b1 自己的线路
    assert.ok(await until(() => S.A.seen(gid).view.phase === "talk"));
    assert.deepStrictEqual(calls.filter(c => c[0] === "side"), [["side", "B:b1", "阿B"]]);
    assert.deepStrictEqual(S.A.seen(gid).view.sides, ["pro", "con"]);
    // 真人甲在自己那台说
    assert.ok(G.myTurn(S.A.seen(gid).inv, S.A.seen(gid).view, "A"));
    S.A.move(gid, 0, { say: "早起的人一天多出两小时" });
    // 观众席：甲发一条弹幕
    S.A.side(gid, { kind: "dm", name: "甲", text: "加油" });
    assert.ok(await until(() => posts.some(p => p.type === "gamerec"), 4000), "没判完");
    // 阿B 的发言只由 B 那台交给庄
    const moves = log.filter(l => l.obj.op === "move");
    assert.ok(moves.length >= 2 && moves.every(l => l.from === "B" && l.to === "A" && l.obj.seat === 1));
    assert.deepStrictEqual(calls.filter(c => c[0] === "turn"), [["turn", "B:b1", "阿B"]]);
    // 判定：庄 A 的线路、单机那一份 genResult；真人当玩家
    assert.deepStrictEqual(calls.filter(c => c[0] === "judge"), [["judge", "apiA", "甲:me,阿B:char", "甲"]]);
    const rec = posts.find(p => p.type === "gamerec");
    assert.strictEqual(rec.by, "A"); assert.deepStrictEqual(rec.x.winners, [0]);
    assert.match(rec.x.text, /甲（正方）胜/);
    // 弹幕、感言：都是不带 to 的广播，谁写的就从谁那台出
    assert.ok(await until(() => S.A.seen(gid).side && S.A.seen(gid).side.some(x => x.kind === "aw")), "感言没到庄那边");
    const sides = log.filter(l => l.obj.op === "side");
    assert.ok(sides.length >= 3 && sides.every(l => !l.to), "弹幕不走点对点、不经庄");
    assert.ok(sides.some(l => l.from === "A" && l.obj.x.text === "加油"));
    const dmB = sides.find(l => l.obj.x.kind === "dm" && l.obj.x.char);
    assert.ok(dmB && dmB.from === "B" && dmB.obj.x.name === "小二", "没上台的角色弹幕由主人那台写");
    assert.deepStrictEqual(calls.filter(c => c[0] === "dm").map(c => c[1]), ["B:b2"]);
    assert.deepStrictEqual(calls.filter(c => c[0] === "aw"), [["aw", "B:b1", "阿B"]], "感言由阿B 主人那台写");
    assert.ok(S.B.seen(gid).side.some(x => x.text === "加油"), "甲的弹幕 B 也看得到");
    // 对局状态里没有弹幕
    assert.ok(!JSON.stringify(log.filter(l => l.obj.op === "state").map(l => l.obj.view)).includes("加油"));
  } finally { Math.random = rnd; }
});

test("没人挑边：真人、NPC 补到人少的一边，两边都得有人；正反交替发言", async () => {
  const { G } = load();
  const A = G.ADAPTERS.debate;
  const inv = { seats: [{ kind: "user", name: "甲", peer: "A" }, { kind: "user", name: "乙", peer: "B" }, { kind: "npc", name: "路人甲" }] };
  const st = await A.init(inv, { prep: { topic: "题", rounds: 2 }, hostApi: null });
  assert.strictEqual(st.phase, "talk");
  assert.ok(st.sides.indexOf("pro") >= 0 && st.sides.indexOf("con") >= 0);
  assert.deepStrictEqual(st.order.map(i => st.sides[i]).slice(0, 2), ["pro", "con"]);
  const same = await A.init({ seats: [{ kind: "user", name: "甲", peer: "A", side: "pro" }, { kind: "user", name: "乙", peer: "B", side: "pro" }] }, { prep: { topic: "题" } });
  assert.ok(same.sides.indexOf("con") >= 0, "都挑了正方也得挪一个过去");
  await assert.rejects(() => A.init(inv, { prep: {}, hostApi: null }), /辩题/);
});

test("view 白名单：多塞的字段不收；stateText 写辩题、双方、最近几段", () => {
  const { G } = load();
  const A = G.ADAPTERS.debate;
  const v = A.cleanView({ topic: "早起比熬夜好", mode: "free", rounds: 2, round: 1, pos: 1, order: [0, 1], sides: ["pro", "con", "hack"], pickBy: [false, false], stances: ["", ""], phase: "talk",
    turns: [{ seat: 0, name: "甲", side: "pro", round: 0, text: "第一段", persona: "x" }], verdict: null, persona: "人设全文", apiKey: "k" });
  assert.deepStrictEqual(Object.keys(v).sort(), ["busy", "mode", "order", "pickBy", "phase", "pos", "round", "rounds", "sides", "stances", "topic", "turns", "verdict"].sort());
  assert.strictEqual(v.sides[2], "");
  assert.ok(!("persona" in v.turns[0]));
  const inv = { zh: "辩论擂台", key: "debate", status: "playing", seats: [{ kind: "user", name: "甲" }, { kind: "char", name: "阿B" }] };
  const s = G.stateText(inv, v, 1);
  assert.match(s, /早起比熬夜好/); assert.match(s, /正方：甲；反方：阿B/); assert.match(s, /你在反方/); assert.match(s, /甲（正方）：第一段/); assert.match(s, /轮到 阿B/);
  assert.strictEqual(A.cleanSide({ kind: "dm", name: "甲", text: "   " }), null, "空弹幕不收");
});

test("单机擂台：辩手提示词抽成共用函数，genRound 照旧用同一份；共用的那几样里不提房间", () => {
  const i = deb.indexOf("function modeRules("), j = deb.indexOf("async function genRound(");
  assert.ok(i > 0 && j > i, "抠不出共用那几样");
  const k = deb.indexOf("  // 别处（", j), round = deb.slice(j, deb.indexOf("async function genResult(", j));
  assert.match(round, /modeRules\(casual\)/); assert.match(round, /debaterCard\(c, i, chars\.length, uName\)/); assert.match(round, /PLAIN_TALK/);
  assert.match(deb, /window\.DebateShared = \{ modeRules: modeRules, debaterCard: debaterCard, genTurn: genTurn, pickSide: pickSide, genSideLine: genSideLine, genAfterword: genAfterword, genResult: genResult/);
  assert.ok(!/联机|netroom/i.test(deb), "debate.js 里不许出现联机/netroom");
  assert.ok(k > 0);
  // 新开的几处调用：料在 system，user 只一句；maxTokens 不低于 8000
  const shared = deb.slice(deb.indexOf("async function genTurn("), deb.indexOf("window.DebateShared"));
  (shared.match(/maxTokens: (\d+)/g) || []).forEach(m => assert.ok(Number(m.split(": ")[1]) >= 8000, m));
  assert.strictEqual((shared.match(/callAI\(/g) || []).length, 4);
});

test("轮数可以选「不限」：rounds=0 时说不完不自动判，房主收台才停", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/netroom-debate.js"), "utf8");
  assert.ok(/if \(n\.rounds && n\.round >= n\.rounds\)/.test(src));
  assert.ok(/int\(pz\.rounds, 0, 30, 3\)/.test(src) && /\{ k: 0, zh: "不限" \}/.test(src));
});
