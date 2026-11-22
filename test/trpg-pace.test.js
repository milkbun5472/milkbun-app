// 跑团节奏(2026-11-22 改法单第一批):进度表、程序的钟、压力拍/爆发拍、线索落在地图上、选项底下那一排。
// 桩照写存档那段写:新团的字面量在 js/trpg.js 开团那一处(clocks: [], pace: { stageIdx: 0, want: true }),
//   pace 的形状照 normPacePlan 交出来的那份。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../js/trpg.js"), "utf8");
require("../js/trpg-core.js");
const T = require("../js/trpg.js");
const { applyTurnPayload, normPacePlan, paceTurnLines, paceView, paceNextStage, burstCost, sideActions, travelHops, PACE_IDLE_MAX, stageAdvance } = T;

test("桩跟着写入方:开团那一处真的挂着「待排」的进度表", () => {
  assert.match(src, /clocks: \[\], pace: \{ stageIdx: 0, want: true \}/);
});

const REGIONS = [
  { name: "北镇", terrain: "城郭", adj: ["南林"], nodes: [{ name: "驿站", kind: "城镇" }, { name: "钟楼", kind: "地标" }], pos: null, size: 1 },
  { name: "南林", terrain: "森林", adj: ["北镇"], nodes: [{ name: "猎屋", kind: "住处" }, { name: "古井", kind: "遗迹" }], pos: null, size: 1 }
];
const nodes = REGIONS.flatMap(r => r.nodes);
const edges = [["驿站", "钟楼"], ["钟楼", "猎屋"], ["猎屋", "古井"]];
const camp0 = extra => Object.assign({
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
          { key: "c1", name: "裴照川", hp: 100, maxHp: 100, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } }],
  items: [{ name: "火漆信", holder: "队伍", n: 1 }], clues: [], place: "驿站", pos: "驿站", visited: ["驿站"],
  stageIdx: 0, stages: [{ goal: "查清失火", place: "钟楼" }, { goal: "b" }], mapRegions: REGIONS,
  clocks: [], pace: { stageIdx: 0, want: true }, npcs: [], quests: [], time: { day: 1, part: "晨" },
  choices: [], msgs: [], pendingStage: false, pendingEnd: false
}, extra || {});
const PLAN = {
  beats: [{ text: "发现火是人放的", need: [{ type: "clue", id: "c1" }] }, { text: "顺藤摸到猎屋", need: [{ type: "clue", id: "c2" }] }, { text: "要不要供出守夜人", need: [{ type: "decide", id: "d1" }] }],
  clues: [{ id: "c1", text: "灰里有火油味", at: "驿站", how: "翻灶灰", rumor: "" }, { id: "c2", text: "猎屋有同样的油罐", at: "猎屋", how: "问猎户", rumor: "南边猎屋最近买过油" }, { id: "c3", text: "井边脚印", at: "不存在的地方", how: "" }],
  decisions: [{ id: "d1", text: "供出守夜人还是替他瞒" }],
  stash: [{ at: "古井", kind: "物品", text: "一把旧钥匙" }],
  clock: { name: "纵火犯要跑", max: 6 }
};
const planned = extra => applyTurnPayload(camp0(extra), { scene: "开场", pace: PLAN }, { nodes }).camp;

test("钟由程序开:这一章的表一交上来,程序自己开这一场的钟,对不上地图的线索落回章目标那处", () => {
  const c = planned();
  assert.equal(c.pace.want, undefined);
  assert.equal(c.pace.beats.length, 3);
  assert.deepEqual(c.clocks, [{ name: "纵火犯要跑", filled: 0, max: 6, pace: true }]);
  assert.equal(c.pace.clues.find(x => x.id === "c3").at, "钟楼");
  assert.deepEqual(paceView(c.pace), { beat: 1, done: 0, total: 3, got: 0, clues: 3 });
  // 表没交上来(或交了一张一拍都对不上的)就还是待排,下一拍再要
  const bad = applyTurnPayload(camp0(), { scene: "x", pace: { beats: [{ text: "x", need: [{ type: "clue", id: "c9" }] }] } }, { nodes }).camp;
  assert.equal(bad.pace.want, true);
  assert.equal(bad.clocks.length, 0);
});

test("钟由程序走:失败+1、大失败+2、休整+1、远行+1;守密人退不了、拆不了这一座", () => {
  let c = planned();
  c = applyTurnPayload(c, { scene: "x" }, { nodes, roll: { tier: "fail", statKey: "wit", who: "Lisa" } }).camp;
  assert.equal(c.clocks[0].filled, 1);
  c = applyTurnPayload(c, { scene: "x", clock: [{ name: "纵火犯要跑", delta: -2 }, { name: "纵火犯要跑", done: true }] }, { nodes, roll: { tier: "fumble", statKey: "wit", who: "Lisa" } }).camp;
  assert.equal(c.clocks.length, 1, "守密人拆不了程序的钟");
  assert.equal(c.clocks[0].filled, 3);
  c = applyTurnPayload(c, { scene: "x" }, { nodes, rest: true }).camp;
  assert.equal(c.clocks[0].filled, 4);
  assert.deepEqual(c.time, { day: 1, part: "午" }, "歇一阵程序推一段时辰");
  c = applyTurnPayload(c, { scene: "x" }, { nodes, travelTo: "猎屋", travelHops: 2 }).camp;
  assert.equal(c.clocks[0].filled, 5);
  assert.deepEqual(c.time, { day: 1, part: "夜" }, "走两段路至少花两段时辰");
  // 什么都没发生的一拍,钟不动
  c = applyTurnPayload(c, { scene: "x" }, { nodes }).camp;
  assert.equal(c.clocks[0].filled, 5);
});

test("走满出爆发拍:下一拍程序下硬指令,后果程序掷定、当场落账、拆钟", () => {
  let c = planned();
  c.clocks[0].filled = 5;
  c = applyTurnPayload(c, { scene: "x" }, { nodes, roll: { tier: "fail", statKey: "agi", who: "Lisa" } }).camp;
  assert.deepEqual(c.burst, { clock: "纵火犯要跑" });
  const b = burstCost(c, c.burst.clock, () => 0);
  assert.equal(b.kind, "hp");
  assert.equal(b.who, "Lisa");
  const lines = paceTurnLines(c, { burst: b });
  assert.match(lines, /〔爆发拍〕威胁钟「纵火犯要跑」走满了/);
  assert.match(lines, /Lisa 受伤\(HP-15\)/);
  const before = c.party[0].hp;
  const after = applyTurnPayload(c, { scene: "火又烧起来了" }, { nodes, burst: b }).camp;
  assert.equal(after.party[0].hp, before - 15);
  assert.equal(after.clocks.length, 0);
  assert.equal(after.burst, null);
  // 丢东西那一种也真的扣
  const bi = burstCost(c, c.burst.clock, (() => { const seq = [0.5, 0]; return () => seq.shift() || 0; })());
  assert.equal(bi.kind, "item");
  assert.equal(applyTurnPayload(c, { scene: "x" }, { nodes, burst: bi }).camp.items.length, 0);
  // turn 里:钟挂着 burst 就先掷后果
  assert.match(src, /const burstNow = camp\.burst && !\(mode && mode\.away\) \? burstCost\(camp, camp\.burst\.clock\)/);
});

test("进度表不让跳拍:一拍最多过一拍,守密人只看得到当前这一拍", () => {
  let c = planned();
  const lines = paceTurnLines(c, { hasMap: true });
  assert.match(lines, /第1拍\/共3拍】发现火是人放的/);
  assert.doesNotMatch(lines, /顺藤摸到猎屋|供出守夜人/, "后面那几拍不该给它看");
  c.pace.got = ["c2"];          // 第二拍的条件早就齐了
  c = applyTurnPayload(c, { scene: "x", hit: ["c1"] }, { nodes }).camp;
  assert.equal(c.pace.beatIdx, 1, "这一拍只过第一拍");
  c = applyTurnPayload(c, { scene: "x" }, { nodes }).camp;
  assert.equal(c.pace.beatIdx, 2, "下一拍才轮到第二拍");
  // 守密人自己报 stageDone 不算数
  c = applyTurnPayload(c, { scene: "x", stageDone: true }, { nodes, roll: { tier: "ok", statKey: "wit", who: "Lisa" } }).camp;
  assert.equal(c.pendingStage, false);
});

test("决定只认她点的那条带记号的选项,或她自己打字做的行动", () => {
  let c = planned();
  c.pace.beatIdx = 2; c.pace.beats[0].done = c.pace.beats[1].done = true;
  c = applyTurnPayload(c, { scene: "x", hit: ["d1"] }, { nodes }).camp;
  assert.equal(c.pace.decided.length, 0, "守密人说她决定了不算");
  const viaChoice = applyTurnPayload(c, { scene: "x" }, { nodes, decide: "d1" }).camp;
  assert.deepEqual(viaChoice.pace.decided, ["d1"]);
  assert.equal(viaChoice.pace.done, true);
  assert.equal(viaChoice.pendingStage, "这一场的3拍都走完了", "三拍走完程序自己请她翻章");
  const typed = applyTurnPayload(c, { scene: "x", hit: ["d1"] }, { nodes, typed: true }).camp;
  assert.deepEqual(typed.pace.decided, ["d1"]);
});

test("线索只在对应地点给:人不在那儿报了也不算;拿到一条,下一条的地点亮「?」", () => {
  let c = planned();
  c = applyTurnPayload(c, { scene: "x", hit: ["c2"] }, { nodes }).camp;
  assert.deepEqual(c.pace.got, [], "在驿站报猎屋的线索,不算");
  assert.match(paceTurnLines(c, {}), /这儿藏着:c1「灰里有火油味」/);
  assert.doesNotMatch(paceTurnLines(c, {}), /油罐/, "别处的线索不给它看");
  c = applyTurnPayload(c, { scene: "x", hit: ["c1"] }, { nodes }).camp;
  assert.deepEqual(c.pace.got, ["c1"]);
  assert.ok(c.clues.indexOf("灰里有火油味") >= 0);
  assert.equal(c.pace.rumors["猎屋"] || c.pace.rumors["钟楼"], c.pace.rumors["猎屋"] ? "南边猎屋最近买过油" : "有人提过这儿");
  // 守密人报的传闻:地图上真有、还没去过才亮
  const r = applyTurnPayload(c, { scene: "x", rumor: [{ at: "古井", text: "井里夜里有光" }, { at: "瞎编的", text: "x" }, { at: "驿站", text: "x" }] }, { nodes }).camp;
  assert.equal(r.pace.rumors["古井"], "井里夜里有光");
  assert.equal(r.pace.rumors["驿站"], undefined);
  // 到了那儿才算
  const there = applyTurnPayload(c, { scene: "x", hit: ["c2"] }, { nodes, travelTo: "猎屋", travelHops: 2 }).camp;
  assert.deepEqual(there.pace.got, ["c1", "c2"]);
});

test("无推进出压力拍:连着几拍什么都没碰到,下一拍程序下令,钟跟着走一格", () => {
  let c = planned();
  for (let i = 0; i < PACE_IDLE_MAX; i++) c = applyTurnPayload(c, { scene: "x" }, { nodes }).camp;
  assert.equal(c.pace.idle, PACE_IDLE_MAX);
  const lines = paceTurnLines(c, { pressure: true });
  assert.match(lines, /〔压力拍〕队伍已经连着 3 拍没往前走了/);
  c = applyTurnPayload(c, { scene: "有人敲门" }, { nodes, pressure: true }).camp;
  assert.equal(c.pace.idle, 0);
  assert.equal(c.clocks[0].filled, 1);
  // 夜谈/换视角/离线那几拍不算拖
  const skip = applyTurnPayload(planned(), { scene: "x" }, { nodes, paceSkip: true }).camp;
  assert.equal(skip.pace.idle, 0);
  assert.match(src, /const pressNow = !burstNow && paceOn\(camp\) && \(camp\.pace\.idle \|\| 0\) >= PACE_IDLE_MAX/);
});

test("选项底下那一排由程序拼:在场的人、这一幕点到的东西、地图上的「?」", () => {
  const c = Object.assign(planned({ npcs: [{ name: "老板娘", alive: true, met: "驿站" }, { name: "远处的人", alive: true, met: "古井" }, { name: "死人", alive: false, met: "驿站" }] }),
    { sceneMeta: { type: "investigate", objective: "x", stakes: "", look: ["烧焦的账本"] }, siteActions: { 驿站: ["翻灶灰"] }, siteDone: { 驿站: ["翻灶灰"] } });
  c.pace.rumors = { 猎屋: "南边猎屋最近买过油", 驿站: "这里" };
  const s = sideActions(c, edges);
  assert.deepEqual(s.talk, ["裴照川", "老板娘"]);
  assert.deepEqual(s.look, ["烧焦的账本"]);
  assert.deepEqual(s.site, [], "点过的地点动作不再摆");
  assert.deepEqual(s.go, [{ name: "猎屋", rumor: "南边猎屋最近买过油", hops: 2 }]);
  assert.equal(travelHops(edges, "驿站", "古井"), 3);
  // 界面那一排走现成的攀谈/探索/赶路
  const i = src.indexOf("const sideRow = "), j = src.indexOf("const pv = paceView(", i);
  assert.ok(i > 0 && j > i, "抠不出 sideRow");
  const row = src.slice(i, j);
  assert.match(row, /setTalkNpc\(nm\)/);
  assert.match(row, /sideMove\(camp, \{ kind: "look", arg: x \}\)/);
  assert.match(row, /goTo\(g\.name\)/);
});

test("旧存档补排:没有进度表的团照旧跑,翻章那一刻挂上待排", () => {
  const old = camp0({ pace: undefined, clocks: [{ name: "旧钟", filled: 2, max: 6 }], stageIdx: 0 });
  delete old.pace;
  const r = applyTurnPayload(old, { scene: "x", pace: PLAN, hit: ["c1"] }, { nodes }).camp;
  assert.equal(r.pace, undefined, "中途的老团不在半道上塞表");
  assert.equal(paceTurnLines(old, { hasMap: true }), "");
  const nx = paceNextStage(Object.assign({}, old, { clocks: [{ name: "旧钟", filled: 2, max: 6 }, { name: "这一场的", filled: 1, max: 6, pace: true }] }));
  assert.deepEqual(nx.pace, { stageIdx: 1, want: true });
  assert.deepEqual(nx.clocks, [{ name: "旧钟", filled: 2, max: 6 }], "上一场的钟跟着散,老钟留着");
  assert.match(paceTurnLines(Object.assign({}, old, { stageIdx: 1 }, nx), { hasMap: true }), /〔暗排这一场〕/);
  assert.equal(paceNextStage(Object.assign({}, old, { stageIdx: 1 })).pace, null, "最后一章翻完不再排");
  const adv = stageAdvance(Object.assign({}, old, { pendingStage: "到了", msgs: [], stages: old.stages || [{ goal: "一" }, { goal: "二" }] }));
  assert.deepEqual(adv.pace, { stageIdx: 1, want: true }, "翻章走 stageAdvance,下一章挂待排");
});
