// 联机小游戏：跑团（js/netroom-trpg.js）。骰子只由庄掷、玩家行动由各自那台交且庄只认座位主人、
//   角色队友由主人那台出手只拿自己能看的、priv（分头真相／守密人的悄悄话／私念）只发给目标、大家都交了才结算、
//   进度表和钟照单机函数推进、view 白名单、stateText；单机跑团抽出来的那几样共用函数里不提房间。
// 桩照写存档那段写：团的形状照 test/trpg-pace.test.js 那份（js/trpg.js 开团那一处的字面量），落账走真的 applyTurnPayload。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), tsrc = read("js/netroom-trpg.js"), trpg = read("js/trpg.js");
globalThis.parseJSONLoose = s => { try { return JSON.parse(String(s).replace(/^[^{]*/, "").replace(/[^}]*$/, "")); } catch (e) { return null; } };
globalThis.salvageByKeys = () => null;
globalThis.narrativeCore = () => "【叙事核心】";
require("../js/trpg-core.js");
const T = require("../js/trpg.js");

const REGIONS = [{ name: "北镇", terrain: "城郭", adj: [], nodes: [{ name: "驿站", kind: "城镇" }, { name: "钟楼", kind: "地标" }], pos: null, size: 1 }];
const camp0 = () => ({ id: "rpg_1", title: "钟楼失火",
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
          { key: "c1", name: "裴照川", hp: 100, maxHp: 100, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } },
          { key: "c9", name: "没来的", hp: 100, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } }],
  items: [], clues: [], place: "驿站", pos: "驿站", visited: ["驿站"], world: "雾镇", dossier: { truth: "秘典真相", twist: "翻转", secrets: "心事", endgame: "结局", mates: [{ name: "阿B", want: "想回家", fear: "怕火", line: "不卖朋友", clash: "反对硬闯" }] },
  stageIdx: 0, stages: [{ goal: "查清失火", place: "钟楼" }, { goal: "b" }], mapRegions: REGIONS,
  clocks: [{ name: "纵火犯要跑", filled: 1, max: 6 }], pace: { stageIdx: 0, want: true }, npcs: [], quests: [], time: { day: 1, part: "晨" },
  choices: [{ text: "去钟楼查", check: { stat: "wit", who: null }, approach: "safe", risk: "", payoff: "", cost: "" }, { text: "问守夜人", check: null }],
  msgs: [{ id: "m0", role: "gm", content: "开场：钟楼起火。" }], pendingStage: false, pendingEnd: false });

function load(gmReply) {
  const calls = [], saved = [];
  const w = { TrpgShared: Object.assign({}, T.TrpgShared, { loadCamps: () => JSON.parse(JSON.stringify(saved.length ? saved[saved.length - 1] : [camp0()])), saveCamps: v => { saved.push(JSON.parse(JSON.stringify(v))); return true; } }) };
  w.callAI = async (api, sys, msgs) => {
    calls.push({ api: api.id, sys, msgs });
    if (/轮到你了|【跑团·一回合】/.test(sys)) return JSON.stringify({ say: "我去看看", do: "推开门", try: null });
    return JSON.stringify(gmReply || { scene: "大家都动了。", clue: ["灰里有火油味"], whisper: [{ to: "乙", text: "守夜人在撒谎" }], apart: { who: "乙", truth: "乙在后院看见了油罐", report: "后院什么都没有" }, choices: [{ text: "接着查" }] });
  };
  new Function("window", gsrc)(w);
  new Function("window", tsrc)(w);
  return { G: w.NetGameCore, w, calls, saved };
}
function bus(ids, mk) {
  const S = {}, log = [];
  const deliver = (from, obj, to) => { log.push({ from, obj, to }); (to ? [to] : ids.filter(x => x !== from)).forEach(id => setTimeout(() => S[id] && S[id].onMessage(JSON.parse(JSON.stringify(obj)), from), 0)); };
  ids.forEach(id => { S[id] = mk(id, (obj, to) => deliver(id, obj, to)); });
  return { S, log };
}
const tick = () => new Promise(ok => setTimeout(ok, 5));
async function until(fn, n) { for (let i = 0; i < (n || 2000); i++) { if (fn()) return true; await tick(); } return false; }
const TRPG = { key: "trpg", zh: "跑团", min: 1, max: 5 };

test("登记进联机小游戏：架子上一盒、开局页是它自己的；守密人走线下那条；加载顺序在 netroom.js 之前", () => {
  const { G } = load();
  const A = G.ADAPTERS.trpg;
  ["seatRange", "init", "view", "priv", "turn", "apply", "npcMove", "charMove", "result", "cleanView", "cleanReplay", "stateText", "waiting", "slow"].forEach(k => assert.strictEqual(typeof A[k], "function", k));
  assert.strictEqual(A.hostRoute, "offline");
  assert.strictEqual(A.shelf.key, "trpg");
  const html = read("index.html"), gi = html.indexOf("js/netroom-games.js"), ti = html.indexOf("js/netroom-trpg.js"), ni = html.indexOf("js/netroom.js");
  assert.ok(gi > 0 && ti > gi && ni > ti);
  assert.match(gsrc, /hostRoute/); assert.match(read("js/netroom.js"), /route === "offline" && propsRef\.current\.offlineApi/);
  assert.match(read("js/app.js"), /offlineApi: \(\) => offlineActive/);
});

test("一整拍：客串先在自己那台掷数值；大家都交了才结算；骰子只在庄那台掷；角色由主人那台出手只拿自己能看的；priv 只发给目标；写回房主的团", async () => {
  const { G, w, calls, saved } = load();
  const mk = (id, send) => w.NetGameSession({ me: () => id, nick: () => id === "A" ? "Lisa" : "乙", nickOf: x => x === "A" ? "Lisa" : "乙", send, fast: true,
    post: () => {}, patchCard: () => {},
    hostApi: route => id === "A" ? { id: "api:" + (route || "game") } : null,
    charOf: cid => id === "B" && cid === "b1" ? { id: "b1", name: "阿B", persona: "B手机上的人设" } : null,
    apiFor: cid => ({ id: id + ":" + cid }), myChars: () => id === "B" ? ["b1"] : [], presence: () => ({ A: "on", B: "on" }) });
  const { S, log } = bus(["A", "B"], mk);
  const gid = S.A.invite(TRPG, { total: 3, npcFill: false }, [{ kind: "user" }], { campId: "rpg_1", personas: {} });
  S.B.join(gid, [{ kind: "user" }, { kind: "char", charId: "b1", name: "阿B" }], "A");
  assert.ok(await until(() => log.some(l => l.obj.op === "card" && l.obj.x.seats.filter(s => s.kind !== "open").length === 3)));
  assert.ok(await S.A.start(gid));
  // 数值：阿B 由 B 那台掷；乙在自己那台掷了交上来
  assert.ok(await until(() => S.B.seen(gid) && S.B.seen(gid).view.done[2]));
  assert.strictEqual(S.A.seen(gid).view.phase, "roll");
  S.B.move(gid, 1, { stats: { phy: 999, agi: 40, wit: 60, cha: 50, luck: 70 } });
  assert.ok(await until(() => S.A.seen(gid).view.phase === "act"));
  assert.strictEqual(S.A.seen(gid).view.party[1].stats.phy, 90, "数值夹在单机那一档里");
  // 私念只发给阿B 的主人
  const privs = log.filter(l => l.obj.op === "priv");
  assert.ok(privs.length && privs.every(l => l.to === "B"));
  assert.ok(privs.some(l => l.obj.seat === 2 && l.obj.data.mate && l.obj.data.mate.want === "想回家"));
  // 阿B 由 B 那台交亲笔；它看到的不带秘典
  assert.ok(await until(() => S.A.seen(gid).view.done[2]));
  const seatCall = calls.find(c => c.api === "B:b1" && /轮到你了/.test(c.sys));
  assert.ok(seatCall && /B手机上的人设/.test(seatCall.sys) && /想回家/.test(seatCall.sys) && !/秘典真相/.test(seatCall.sys + JSON.stringify(seatCall.msgs)));
  // 谁还没交：甲、乙
  assert.deepStrictEqual(G.ADAPTERS.trpg.waiting(S.A.seen(gid).view), [0, 1]);
  assert.ok(G.myTurn(S.B.seen(gid).inv, S.B.seen(gid).view, "B"), "乙在自己那台随时能交");
  // B 冒充甲的座位：庄不认
  S.B.move(gid, 0, { pick: 1 });
  S.B.move(gid, 1, { pick: 0, whisper: "我怀疑守夜人", apart: true });
  await until(() => S.A.seen(gid).view.done[1]);
  assert.ok(!S.A.seen(gid).view.done[0], "庄只认座位主人");
  assert.ok(!calls.some(c => c.api === "api:offline"), "还有人没交，不结算");
  S.A.move(gid, 0, { say: "我守在门口" });
  // 乙挑的那条要过检定：先开台面，「这一下要过什么检定」只发给乙那一座；乙在自己那台按「掷」，骰子在庄那台掷
  assert.ok(await until(() => S.A.seen(gid).view.phase === "check"), "先过检定仪式");
  assert.ok(!calls.some(c => c.api === "api:offline"), "检定没掷完，不请守密人");
  const asks = log.filter(l => l.obj.op === "priv" && l.obj.data && l.obj.data.ckAsk);
  assert.ok(asks.length && asks.every(l => l.to === "B" && l.obj.seat === 1), "台面只发给该掷的那一座");
  assert.ok(await until(() => S.B.seen(gid).priv && S.B.seen(gid).priv.ckAsk && S.B.seen(gid).view.phase === "check"));
  S.B.move(gid, 1, { ck: "roll", assist: -1, bargain: false });
  // 失手了、手上有命运点：再问乙一句花不花（这里认了）
  assert.ok(await until(() => { const k = S.B.seen(gid).view.ck; return k && (k.stage === "shown" || (k.stage === "fate" && S.B.seen(gid).priv && S.B.seen(gid).priv.ckAsk && S.B.seen(gid).priv.ckAsk.stage === "fate")); }));
  if (S.B.seen(gid).view.ck.stage === "fate") S.B.move(gid, 1, { ck: "fate", use: "no" });
  assert.ok(await until(() => S.B.seen(gid).view.ck && S.B.seen(gid).view.ck.stage === "shown"), "骰子落定，大家同时看到");
  assert.ok(S.B.seen(gid).view.ck.c.roll >= 1 && S.B.seen(gid).view.ck.rolledAt > 0);
  S.A.tick(Date.now() + 5000);   // 大家看过了，庄接着请守密人
  assert.ok(await until(() => S.A.seen(gid).view.beat === 1), "没结算");
  const gm = calls.filter(c => c.api === "api:offline");
  assert.strictEqual(gm.length, 1, "一拍一枪守密人，走庄的线下线路");
  const hist = JSON.stringify(gm[0].msgs);
  assert.match(hist, /「头脑」检定:d100=/, "乙挑的那条要过检定，庄那台掷");
  assert.match(hist, /亲笔·阿B说:「我去看看」/); assert.match(hist, /咬耳朵·来自乙/); assert.match(hist, /分头行动/);
  assert.ok(!log.some(l => l.obj.op === "move" && /d100/.test(JSON.stringify(l.obj.move))), "骰子不从别的手机来");
  // 落账走单机那一份：线索进了团、写回房主的团（客串不进队伍，没来的那位原样在）
  assert.ok(await until(() => S.B.seen(gid).view.beat === 1), "乙那台跟上这一拍");
  const v = S.B.seen(gid).view;
  assert.strictEqual(v.clues, 1);
  const last = saved[saved.length - 1][0];
  assert.deepStrictEqual(last.party.map(m => m.key), ["user", "c1", "c9"]);
  assert.ok(last.msgs.some(m => m.role === "gm" && m.content === "大家都动了。"));
  // 悄悄话、另一路真相只发给乙那台；公开的只有回来的说法
  assert.ok(await until(() => S.B.seen(gid).priv && S.B.seen(gid).priv.truth));
  assert.deepStrictEqual(S.B.seen(gid).priv.whisper, ["守夜人在撒谎"]);
  const states = JSON.stringify(log.filter(l => l.obj.op === "state").map(l => l.obj.view));
  assert.ok(!states.includes("油罐") && !states.includes("守夜人在撒谎") && !states.includes("秘典真相") && states.includes("后院什么都没有"));
  assert.ok(log.filter(l => l.obj.op === "priv" && /油罐|撒谎/.test(JSON.stringify(l.obj.data))).every(l => l.to === "B" && l.obj.seat === 1));
});

test("进度表和钟照单机函数推进：联机这一拍的落账与单机 applyTurnPayload 一样", async () => {
  const { G } = load({ scene: "钟在响。", clock: [{ name: "纵火犯要跑", delta: 1 }], choices: [] });
  const A = G.ADAPTERS.trpg;
  const inv = { host: "A", seats: [{ kind: "user", peer: "A", name: "Lisa" }] };
  let st = await A.init(inv, { prep: { campId: "rpg_1" } });
  assert.strictEqual(st.phase, "act");
  const r = await A.apply(st, 0, { pick: 1 }, { inv, hostApi: { id: "x" }, prep: {} });
  const solo = T.applyTurnPayload(Object.assign(camp0(), { party: [camp0().party[0]] }), { scene: "钟在响。", clock: [{ name: "纵火犯要跑", delta: 1 }], choices: [] }, { nodes: T.TrpgShared.nodesOfCamp(camp0()) }).camp;
  assert.deepStrictEqual(r.st.camp.clocks, solo.clocks);
  assert.deepStrictEqual(r.st.camp.pace, solo.pace);
  // 没线路：卡在这一拍，行动已记下，房主「继续这一拍」重试
  st = await A.init(inv, { prep: { campId: "rpg_1" } });
  const r2 = await A.apply(st, 0, { pick: 1 }, { inv, hostApi: null, prep: {} });
  assert.strictEqual(r2.st.phase, "stuck");
  assert.ok((await A.apply(r2.st, 0, { pick: 1 }, { inv, hostApi: null })).err);
});

test("view 白名单、stateText", () => {
  const { G } = load();
  const A = G.ADAPTERS.trpg;
  const v = A.cleanView({ title: "钟楼失火", place: "驿站", beat: 2, phase: "act", party: [{ name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 }, persona: "x" }], done: [false],
    clocks: [{ name: "纵火犯要跑", filled: 2, max: 6 }], clues: 1, clueList: ["灰"], choices: [{ text: "去", stat: "wit" }], log: [{ role: "gm", text: "开场" }], dossier: { truth: "秘" }, camp: {} });
  assert.ok(!("dossier" in v) && !("camp" in v) && !("persona" in v.party[0]));
  const inv = { key: "trpg", zh: "跑团", status: "playing", seats: [{ kind: "user", name: "Lisa" }] };
  const s = G.stateText(inv, v, 0);
  assert.match(s, /钟楼失火/); assert.match(s, /驿站/); assert.match(s, /纵火犯要跑」2\/6/); assert.match(s, /线索 1 条/); assert.match(s, /还没交这一拍的:Lisa/);
});

test("单机跑团抽出来的共用函数：单机整页改用它们；里面不提房间", () => {
  assert.match(trpg, /const gmSys = c => buildGmSys\(c, \{ uName, personas: personaBlocks\(c\) \}\);/);
  assert.match(trpg, /const ccSys = seatDeclareSys\(c, eng\.name\);/);
  assert.match(trpg, /return declareLineOf\(eng\.name, p\);/);
  assert.match(trpg, /const beat = beatMsgsOf\(nc, p, r\);/);
  const i = trpg.indexOf("const buildGmSys = (c, o) =>"), j = trpg.indexOf("function TrpgApp(", i);
  assert.ok(i > 0 && j > i);
  assert.ok(!/联机|netroom|NetRoom/.test(trpg), "公共版摘掉联机后，跑团里不该留着联机的字");
});

// ── 第二版接上的那几样 ──
const inv2 = { host: "A", seats: [{ kind: "user", peer: "A", name: "Lisa" }, { kind: "user", peer: "B", name: "乙" }] };
const camp2 = () => { const c = camp0(); c.choices = []; c.mapRegions = [{ name: "北镇", terrain: "城郭", adj: ["南野"], nodes: [{ name: "驿站", kind: "城镇" }, { name: "钟楼", kind: "地标" }] }, { name: "南野", terrain: "平原", adj: ["北镇"], nodes: [{ name: "猎屋", kind: "野外" }] }]; c.npcs = [{ name: "守夜人", alive: true, met: "驿站", stance: "未明" }]; return c; };
function load2(reply) {
  const L = load(reply);
  L.w.TrpgShared.loadCamps = () => [camp2()];
  return L;
}
async function seated(A) {
  let st = await A.init(inv2, { prep: { campId: "rpg_1", timeout: 3 } });
  st = (await A.apply(st, 1, { stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } }, { inv: inv2 })).st;
  return st;
}

test("选项下那一排走单机那张单：整桌都挑「去钟楼」就是一拍赶路——花团内时辰、守密人拿到单机那段〔赶路〕守则", async () => {
  const { G, calls } = load2({ scene: "到了钟楼。", place: "钟楼", choices: [] });
  const A = G.ADAPTERS.trpg;
  let st = await seated(A);
  const v = A.view(st);
  const go = v.side.find(x => x.kind === "go" && x.arg === "钟楼");
  assert.ok(go, "地图上挨着的地点在单上");
  assert.ok(v.side.some(x => x.kind === "talk" && x.arg === "守夜人") && !v.side.some(x => x.arg === "乙"), "真人不是攀谈对象");
  assert.ok((await A.apply(st, 0, { side: { kind: "go", arg: "没这地方" } }, { inv: inv2 })).err, "单上没有的不收");
  st = (await A.apply(st, 0, { side: { kind: "go", arg: "钟楼" } }, { inv: inv2 })).st;
  st = (await A.apply(st, 1, { side: { kind: "go", arg: "钟楼" } }, { inv: inv2, hostApi: { id: "gm" }, prep: {} })).st;
  assert.strictEqual(st.camp.pos, "钟楼");
  assert.notDeepStrictEqual(st.camp.time, { day: 1, part: "晨" }, "赶路花了时辰");
  const tail = JSON.stringify(calls.find(c => c.api === "gm").msgs);
  assert.match(tail, /〔赶路〕sceneMeta\.type 固定 travel/);
  assert.match(tsrc, /T\.sideMenu\(/); assert.match(tsrc, /T\.sideMove\(/); assert.match(tsrc, /T\.beatGate\(/); assert.match(tsrc, /T\.modeTail\(/); assert.match(tsrc, /T\.landOpts\(/);
  assert.match(trpg, /const tail = modeTail\(camp, mode, \{/); assert.match(trpg, /landOpts\(c, mode, \{/); assert.match(trpg, /const gate = beatGate\(camp, mode,/);
});

test("没成整桌的「跟谁说话」是私下攀谈：守密人只回给 Ta，走 priv", async () => {
  const { G, calls } = load2({ scene: "大家在驿站里。", whisper: [{ to: "乙", text: "守夜人压低声音说钥匙在井里" }], choices: [{ text: "接着查" }] });
  const A = G.ADAPTERS.trpg;
  let st = await seated(A);
  st = (await A.apply(st, 0, { say: "我翻账本" }, { inv: inv2 })).st;
  assert.ok((await A.apply(st, 1, { side: { kind: "talk", arg: "守夜人" } }, { inv: inv2 })).err, "找人说话要写说什么");
  st = (await A.apply(st, 1, { side: { kind: "talk", arg: "守夜人" }, say: "钥匙呢" }, { inv: inv2, hostApi: { id: "gm" }, prep: {} })).st;
  const hist = JSON.stringify(calls.find(c => c.api === "gm").msgs);
  assert.match(hist, /私下攀谈·乙 找 守夜人/);
  assert.doesNotMatch(hist, /〔攀谈拍·对象/, "一个人私下说，不是整桌攀谈拍");
  assert.deepStrictEqual(A.priv(st, 1).whisper, ["守夜人压低声音说钥匙在井里"]);
  assert.ok(!A.priv(st, 0) || !A.priv(st, 0).whisper);
  assert.ok(!JSON.stringify(A.view(st)).includes("钥匙在井里"));
});

test("真人一直不交：到点庄按「稳妥」那条替她交，桌上写明；没到点、关掉了都不动", async () => {
  const { G, calls } = load2({ scene: "x", choices: [] });
  const A = G.ADAPTERS.trpg;
  let st = await seated(A);
  st = Object.assign({}, st, { camp: Object.assign({}, st.camp, { choices: [{ text: "硬闯", approach: "bold", check: { stat: "phy" } }, { text: "绕后门", approach: "safe", check: null }] }) });
  st = (await A.apply(st, 0, { say: "我守门" }, { inv: inv2 })).st;
  assert.deepStrictEqual(A.onTick(st, st.actAt + 60000), [], "没到点");
  assert.deepStrictEqual(A.onTick(Object.assign({}, st, { timeout: 0 }), st.actAt + 9e6), [], "开局关掉了");
  const due = A.onTick(st, st.actAt + 3 * 60000 + 1);
  assert.deepStrictEqual(due, [{ seat: 1, mv: { pick: 1, auto: true } }]);
  st = (await A.apply(st, 1, due[0].mv, { inv: inv2, hostApi: { id: "gm" }, prep: {} })).st;
  assert.match(JSON.stringify(calls.find(c => c.api === "gm").msgs), /乙 选了「绕后门」\(到点没交,庄按稳妥那条替她交的\)/);
  assert.deepStrictEqual(A.view(st).autoed, ["乙"]);
  assert.match(gsrc, /ad\.onTick\(g\.st, now\)/);
});

test("角色队友同时想：两位角色在主人那台一起出手，庄收齐才结算", async () => {
  const { w, calls } = load();
  let live = 0, peak = 0;
  const base = w.callAI;
  w.callAI = async (api, sys, msgs, o) => { if (/轮到你了/.test(sys)) { live++; peak = Math.max(peak, live); await new Promise(ok => setTimeout(ok, 30)); live--; } return base(api, sys, msgs, o); };
  const mk = (id, send) => w.NetGameSession({ me: () => id, nick: () => id, nickOf: x => x, send, fast: true, post: () => {}, patchCard: () => {},
    hostApi: route => id === "A" ? { id: "api:" + (route || "game") } : null,
    charOf: cid => id === "B" ? { id: cid, name: cid, persona: "人设" + cid } : null, apiFor: cid => ({ id: id + ":" + cid }), myChars: () => id === "B" ? ["b1", "b2"] : [], presence: () => ({ A: "on", B: "on" }) });
  const { S } = bus(["A", "B"], mk);
  const gid = S.A.invite(TRPG, { total: 3, npcFill: false }, [{ kind: "user" }], { campId: "rpg_1", personas: {} });
  S.B.join(gid, [{ kind: "char", charId: "b1", name: "阿B" }, { kind: "char", charId: "b2", name: "阿C" }], "A");
  await until(() => false, 20);
  assert.ok(await S.A.start(gid));
  assert.ok(await until(() => S.A.seen(gid) && S.A.seen(gid).view.phase === "act" && S.A.seen(gid).view.done[1] && S.A.seen(gid).view.done[2]));
  assert.ok(peak >= 2, "两位一起想，不是一位一位跟");
  S.A.move(gid, 0, { pick: 1 });
  assert.ok(await until(() => S.A.seen(gid).view.beat === 1));
  const hist = JSON.stringify(calls.find(c => c.api === "api:offline").msgs);
  assert.match(hist, /亲笔·阿B/); assert.match(hist, /亲笔·阿C/);
  assert.match(gsrc, /turns\(view\) \/ roundOf\(view\)/);
});

test("客串这一晚做了什么写进战绩卡那段话（进房间记录）；落幕写终章、秘典揭开", async () => {
  const { G } = load2({ scene: "x", choices: [{ text: "接着查" }] });
  const A = G.ADAPTERS.trpg;
  let st = await seated(A);
  st = (await A.apply(st, 0, { pass: true }, { inv: inv2 })).st;
  st = (await A.apply(st, 1, { say: "我去翻井口" }, { inv: inv2, hostApi: { id: "gm" }, prep: {} })).st;
  assert.ok(!("epi" in A.view(st)) || A.view(st).epi === null, "没落幕前秘典不露");
  const w2 = load2({ paras: ["钟楼重建了。"], closing: "雾散了", untold: ["井底的信"] });
  const A2 = w2.G.ADAPTERS.trpg;
  const r = await A2.apply(st, -1, { op: "finale", finalAct: "我们把钥匙还了" }, { inv: inv2, hostApi: { id: "gm" }, prep: {} });
  assert.strictEqual(r.st.phase, "done");
  const v = A2.view(r.st);
  assert.strictEqual(v.epi.truth, "秘典真相"); assert.deepStrictEqual(v.epi.untold, ["井底的信"]);
  const res = A2.result(r.st, inv2);
  assert.match(res.text, /客串:乙——第1拍:我去翻井口/);
  const rec = w2.G.cleanRecord({ key: "trpg", zh: "跑团", text: res.text, replay: res.replay, seats: [] });
  assert.match(w2.G.recordLine(rec), /客串:乙/);
  assert.strictEqual(rec.replay.guests[0].name, "乙");
  assert.match(tsrc, /T\.epilogueAsk\(/); assert.match(tsrc, /T\.summaryJob/); assert.match(trpg, /const \{ sys, user \} = epilogueAsk\(camp, uName, forced, finalAct\);/);
});

// ── 第三版：检定仪式、落幕成长、翻章结算卡 ──
// 三座：房主自己（团里的 user）、房主带来的裴照川（团里的 c1）、B 那台的乙（客串）
const inv3 = { host: "A", seats: [{ kind: "user", peer: "A", name: "Lisa" }, { kind: "char", peer: "A", charId: "c1", name: "裴照川" }, { kind: "user", peer: "B", name: "乙" }] };
async function seated3(A, choices) {
  let st = await A.init(inv3, { prep: { campId: "rpg_1", timeout: 3 } });
  st = (await A.apply(st, 2, { stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } }, { inv: inv3 })).st;
  if (choices) st = Object.assign({}, st, { camp: Object.assign({}, st.camp, { choices }) });
  return st;
}
const withRand = async (seq, fn) => { const r0 = Math.random; let i = 0; Math.random = () => seq[Math.min(i++, seq.length - 1)]; try { return await fn(); } finally { Math.random = r0; } };
const CK = [{ text: "撬锁", check: { stat: "agi", who: null, bargain: "惊动巡夜的" }, approach: "bold" }, { text: "等着", check: null }];

test("检定仪式：挑了带检定那条路就先开台面；选择只由该掷那一座的主人交；台面只进那一座的 priv", async () => {
  const { G, calls } = load2({ scene: "锁开了。", choices: [] });
  const A = G.ADAPTERS.trpg;
  let st = await seated3(A, CK);
  st = (await A.apply(st, 0, { pick: 1 }, { inv: inv3 })).st;
  st = (await A.apply(st, 1, { decl: { say: "我放风", do: "", try: "" } }, { inv: inv3 })).st;
  assert.strictEqual(A.slow(st, 2, { pick: 0 }), false, "要开台面，不先亮「守密人在写」");
  st = (await A.apply(st, 2, { pick: 0 }, { inv: inv3, hostApi: { id: "gm" }, prep: {} })).st;
  assert.strictEqual(st.phase, "check");
  assert.ok(!calls.some(c => c.api === "gm"), "检定没掷完，不请守密人");
  assert.deepStrictEqual(A.waiting(A.view(st)), [2]);
  assert.ok(A.priv(st, 2).ckAsk && A.priv(st, 2).ckAsk.bargain === "惊动巡夜的");
  assert.ok(!(A.priv(st, 0) || {}).ckAsk && !(A.priv(st, 1) || {}).ckAsk, "别的座位收不到台面");
  assert.ok((await A.apply(st, 0, { ck: "roll" }, { inv: inv3 })).err, "别人替不了这一下");
  assert.ok((await A.apply(st, 2, { pick: 0 }, { inv: inv3 })).err, "台面上只认台面上的那几下");
});

test("检定仪式：最终掷骰只在庄；交易与协力照单机加成；「自己掷」的数字从庄那台来，交上来的点数不认", async () => {
  const { G, calls } = load2({ scene: "锁开了。", choices: [] });
  const A = G.ADAPTERS.trpg;
  let st = await seated3(A, CK);
  st = (await A.apply(st, 0, { pick: 1 }, { inv: inv3 })).st;
  st = (await A.apply(st, 1, { pass: true }, { inv: inv3 })).st;
  st = (await A.apply(st, 2, { pick: 0 }, { inv: inv3 })).st;
  // 乙请房主带来的裴照川协力：那是别人（房主）那台的座位，先问一句
  st = (await A.apply(st, 2, { ck: "roll", assist: 1, bargain: true, roll: 1 }, { inv: inv3 })).st;
  assert.strictEqual(st.ck.stage, "ask");
  assert.deepStrictEqual(A.waiting(A.view(st)), [1]);
  assert.ok(A.priv(st, 1).ckHelp && A.priv(st, 1).ckHelp.who === "乙");
  assert.ok((await A.apply(st, 2, { ck: "assist", ok: true }, { inv: inv3 })).err, "同意得那一位自己来");
  st = await withRand([0.5], async () => (await A.apply(st, 1, { ck: "assist", ok: true }, { inv: inv3 })).st);
  assert.strictEqual(st.ck.stage, "shown");
  assert.strictEqual(st.ck.c.roll, 51, "数字是庄这台掷的，不是交上来的 1");
  assert.strictEqual(T.TrpgShared.ceremonyEff(st.ck.c), 50 + 10 + 15, "协力+10、交易+15");
  assert.deepStrictEqual(A.onTick(st, st.ck.at + 100), [], "大家先看一会儿骰子");
  assert.deepStrictEqual(A.onTick(st, st.ck.at + 5000), [{ seat: -1, mv: { op: "go" } }]);
  st = (await A.apply(st, -1, { op: "go" }, { inv: inv3, hostApi: { id: "gm" }, prep: {} })).st;
  const hist = JSON.stringify(calls.find(c => c.api === "gm").msgs);
  assert.match(hist, /乙 的「身手」检定:d100=51 \/ 75\(裴照川协力\+10,魔鬼交易\+15\)/);
  assert.match(hist, /魔鬼交易成立,代价必兑现:惊动巡夜的/);
  assert.strictEqual(st.beat, 1);
});

test("检定仪式：协力被拒就不加；托管和超时按不花资源的默认（不请人、不接交易、不花命运点）", async () => {
  const { G } = load2({ scene: "x", choices: [] });
  const A = G.ADAPTERS.trpg;
  let st = await seated3(A, CK);
  st = (await A.apply(st, 0, { pick: 1 }, { inv: inv3 })).st;
  st = (await A.apply(st, 1, { pass: true }, { inv: inv3 })).st;
  st = (await A.apply(st, 2, { pick: 0 }, { inv: inv3 })).st;
  const due = A.onTick(st, st.ck.at + 3 * 60000 + 1);
  assert.deepStrictEqual(due, [{ seat: 2, mv: { ck: "roll", assist: -1, bargain: false, auto: true } }]);
  assert.deepStrictEqual(await A.npcMove(st, 2), due[0].mv, "掉线托管同一份默认");
  st = (await A.apply(st, 2, { ck: "roll", assist: 1 }, { inv: inv3 })).st;
  st = await withRand([0.3], async () => (await A.apply(st, 1, { ck: "assist", ok: false }, { inv: inv3 })).st);
  assert.strictEqual(st.ck.c.assist, null);
  assert.strictEqual(st.ck.c.declined, "裴照川");
});

test("检定仪式：命运点按单机规则——失手后才可花、只一次、扣在掷骰那位身上；客串的记在这一晚的客串卡上，不进房主队伍", async () => {
  const { G, saved } = load2({ scene: "x", choices: [] });
  const A = G.ADAPTERS.trpg;
  let st = await seated3(A, CK);
  st = (await A.apply(st, 0, { pick: 1 }, { inv: inv3 })).st;
  st = (await A.apply(st, 1, { pass: true }, { inv: inv3 })).st;
  st = (await A.apply(st, 2, { pick: 0 }, { inv: inv3 })).st;
  const fate0 = st.members[2].fate;
  assert.ok(fate0 > 0);
  st = await withRand([0.97], async () => (await A.apply(st, 2, { ck: "roll", assist: -1 }, { inv: inv3 })).st);
  assert.strictEqual(st.ck.stage, "fate", "大失败、手上有点：问 Ta 花不花");
  assert.strictEqual(A.priv(st, 2).ckAsk.stage, "fate");
  st = await withRand([0.97], async () => (await A.apply(st, 2, { ck: "fate", use: "reroll" }, { inv: inv3 })).st);
  assert.strictEqual(st.ck.stage, "shown", "重掷过不给再花");
  assert.deepStrictEqual(st.ck.c.rolls, [98, 98]);
  assert.strictEqual(st.members[2].fate, fate0 - 1, "花掉立扣");
  assert.match(T.TrpgShared.rollLine("", st.members[2], CK[0].check, st.ckRes[2].res), /花1枚命运点:重掷/);
  st = (await A.apply(st, -1, { op: "go" }, { inv: inv3, hostApi: { id: "gm" }, prep: {} })).st;
  const last = saved[saved.length - 1][0];
  assert.deepStrictEqual(last.party.map(m => m.key), ["user", "c1", "c9"], "客串不进房主的队伍");
  assert.strictEqual(st.members[2].fate, fate0 - 1, "客串卡上留着这一晚花过的");
});

test("落幕成长：房主原队伍里上桌的照单机掷成长并写回房主那支小分队；客串的也掷，只写进战绩卡", async () => {
  const L = load2({ paras: ["尘埃落定。"], closing: "完" });
  const A = L.G.ADAPTERS.trpg, wrote = [];
  L.w.TrpgShared.squadWriteBack = (camp, members, growth) => { wrote.push({ keys: members.map(m => m.key), growth }); return true; };
  let st = await seated3(A);
  const rolls = [{ role: "roll", who: "Lisa", statKey: "wit", tier: "ok", content: "x" }, { role: "roll", who: "乙", statKey: "cha", tier: "hard", content: "x" }];
  st = Object.assign({}, st, { camp: Object.assign({}, st.camp, { msgs: st.camp.msgs.concat(rolls) }) });
  const r = await withRand([0.99], async () => A.apply(st, -1, { op: "finale", finalAct: "" }, { inv: inv3, hostApi: { id: "gm" }, prep: {} }));
  st = r.st;
  assert.strictEqual(wrote.length, 1);
  assert.deepStrictEqual(wrote[0].keys, ["user", "c1"], "只写房主原队伍里上了桌的");
  assert.ok(wrote[0].growth.every(g => g.name !== "乙"), "客串的成长不进队伍");
  assert.deepStrictEqual(st.camp.epilogue.growth.map(g => g.name), ["Lisa"]);
  assert.deepStrictEqual(st.guestGrowth.map(g => [g.name, g.stat, g.to]), [["乙", "cha", 55]]);
  const res = A.result(st, inv3);
  assert.match(res.text, /成长\(写回房主的小分队\):Lisa的头脑50→55/);
  assert.match(res.text, /客串这一晚的成长\(只记在这里,不进谁的队伍\):乙的谈吐50→55/);
});

test("翻章：房主点「翻过这一章」出结算卡（单机那一份 stageAdvance），写回房主的团", async () => {
  const { G, saved } = load2();
  const A = G.ADAPTERS.trpg;
  let st = await seated3(A);
  st = Object.assign({}, st, { camp: Object.assign({}, st.camp, { pendingStage: "这一场的3拍都走完了" }) });
  assert.match(A.view(st).pendingStage, /3拍都走完了/);
  assert.ok((await A.apply(st, 2, { op: "stage", ok: true }, { inv: inv3 })).err, "只有房主能翻章");
  st = (await A.apply(st, -1, { op: "stage", ok: true }, { inv: inv3 })).st;
  assert.strictEqual(st.camp.stageIdx, 1);
  const card = st.camp.msgs[st.camp.msgs.length - 1];
  assert.ok(card.card && /第1章结算/.test(card.content));
  assert.ok(A.view(st).log.some(x => /第1章结算/.test(x.text)), "桌上看得到那张卡");
  assert.strictEqual(saved[saved.length - 1][0].stageIdx, 1);
});

test("台面公开那一份白名单：view 里没有可请的人、没有被藏起来的东西；cleanView 认 check 那一相", async () => {
  const { G } = load2({ scene: "x", choices: [] });
  const A = G.ADAPTERS.trpg;
  let st = await seated3(A, CK);
  st = (await A.apply(st, 0, { pick: 1 }, { inv: inv3 })).st;
  st = (await A.apply(st, 1, { pass: true }, { inv: inv3 })).st;
  st = (await A.apply(st, 2, { pick: 0 }, { inv: inv3 })).st;
  const v = A.cleanView(JSON.parse(JSON.stringify(A.view(st))));
  assert.strictEqual(v.phase, "check");
  assert.strictEqual(v.ck.stage, "pre");
  assert.deepStrictEqual(v.ck.c.mates, []);
  assert.ok(!("resolve" in v.ck.c));
  assert.match(tsrc, /T\.ceremonyPanel\(c, \{/, "台面画法用单机那一份");
});
