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
  assert.ok(await until(() => S.A.seen(gid).view.beat === 1), "没结算");
  const gm = calls.filter(c => c.api === "api:offline");
  assert.strictEqual(gm.length, 1, "一拍一枪守密人，走庄的线下线路");
  const hist = JSON.stringify(gm[0].msgs);
  assert.match(hist, /「头脑」检定:d100=/, "乙挑的那条要过检定，庄那台掷");
  assert.match(hist, /亲笔·阿B说:「我去看看」/); assert.match(hist, /咬耳朵·来自乙/); assert.match(hist, /分头行动/);
  assert.ok(!log.some(l => l.obj.op === "move" && /d100/.test(JSON.stringify(l.obj.move))), "骰子不从别的手机来");
  // 落账走单机那一份：线索进了团、写回房主的团（客串不进队伍，没来的那位原样在）
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
