// 跑团节奏第二批(2026-11-22 改法单):NPC 自己的盘算由程序按拍推进;场终结算卡(得到/失去/关系/钩子),高光喂进落幕成长骰。
// 桩照写存档那段写:团的形状照 js/trpg.js 开团那一处的字面量,pace 照 normPacePlan 交出来的那份(applyTurnPayload 收表)。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "../js/trpg.js"), "utf8");
require("../js/trpg-core.js");
const T = require("../js/trpg.js");
const { applyTurnPayload, paceTurnLines, stageAdvance, sceneCard, growthRolls, NPC_GOAL_EVERY } = T;

const camp0 = extra => Object.assign({
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
          { key: "c1", name: "裴照川", hp: 100, maxHp: 100, bond: 50, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } }],
  items: [{ name: "火漆信", holder: "队伍", n: 1 }], clues: [], place: "驿站", pos: "驿站", visited: ["驿站"],
  stageIdx: 0, stages: [{ goal: "查清失火" }, { goal: "追到渡口" }], mapRegions: null,
  clocks: [], pace: { stageIdx: 0, want: true }, npcs: [{ name: "掌柜", role: "驿站掌柜", stance: "未明", alive: true }], quests: [], time: { day: 1, part: "晨" },
  choices: [], msgs: [], pendingStage: false, pendingEnd: false
}, extra || {});
const PLAN = {
  beats: [{ text: "发现火是人放的", need: [{ type: "clue", id: "c1" }] }, { text: "做个决定", need: [{ type: "decide", id: "d1" }] }],
  clues: [{ id: "c1", text: "灰里有火油味", how: "翻灶灰" }],
  decisions: [{ id: "d1", text: "供出守夜人还是替他瞒" }],
  clock: { name: "纵火犯要跑", max: 6 },
  agendas: [{ npc: "掌柜", goal: "把账本烧掉", steps: 3 }, { npc: "黑衣人", goal: "赶在天亮前出城", steps: 9 }, { npc: "掌柜", goal: "重复的不收" }]
};
const planned = () => applyTurnPayload(camp0(), { scene: "开场", pace: PLAN }, { nodes: [] }).camp;

test("NPC 的盘算:暗排时收下,步数夹在 3-5,同一人只收一条", () => {
  const c = planned();
  assert.deepEqual(c.pace.agendas.map(x => [x.npc, x.max, x.at]), [["掌柜", 3, 0], ["黑衣人", 5, 0]]);
  assert.match(paceTurnLines(camp0(), {}), /agendas/, "暗排那张表要 agendas");
});

test("NPC 的盘算:程序每几拍推一格,不等队伍;死了的不动;走满就办成", () => {
  let c = planned();
  for (let i = 0; i < NPC_GOAL_EVERY; i++) c = applyTurnPayload(c, { scene: "x" }, { nodes: [] }).camp;
  assert.deepEqual(c.pace.agendas.map(x => x.at), [1, 1]);
  assert.equal(c.pace.moved.length, 2);
  assert.match(paceTurnLines(c, {}), /〔世界在动〕掌柜的盘算往前走了一格/, "下一拍守密人看得到,只管写");
  c = applyTurnPayload(c, { scene: "x" }, { nodes: [] }).camp;
  assert.equal(c.pace.moved.length, 0, "不到拍不推");
  c = Object.assign({}, c, { npcs: [{ name: "掌柜", alive: false, stance: "未明" }] });
  c = applyTurnPayload(c, { scene: "x" }, { nodes: [] }).camp;
  assert.deepEqual(c.pace.agendas.map(x => x.at), [1, 2], "死了的掌柜不动");
  let d = planned();
  for (let i = 0; i < NPC_GOAL_EVERY * 3; i++) d = applyTurnPayload(d, { scene: "x" }, { nodes: [] }).camp;
  assert.equal(d.pace.agendas[0].done, true);
  assert.match(paceTurnLines(d, {}), /已办成/);
});

test("NPC 的盘算:队伍搅了谁的事(foil),那人退一格;没动过的不退", () => {
  let c = planned();
  for (let i = 0; i < NPC_GOAL_EVERY; i++) c = applyTurnPayload(c, { scene: "x" }, { nodes: [] }).camp;
  c = applyTurnPayload(c, { scene: "x", foil: ["掌柜"] }, { nodes: [] }).camp;
  assert.equal(c.pace.agendas[0].at, 0);
  c = applyTurnPayload(c, { scene: "x", foil: "掌柜" }, { nodes: [] }).camp;
  assert.equal(c.pace.agendas[0].at, 1, "退到 0 不再退;这一拍又轮到推进");
});

test("场终结算卡:得到/失去/关系变化/各方盘算/高光/钩子", () => {
  let c = planned();
  c = applyTurnPayload(c, { scene: "x", hit: ["c1"], hook: "渡口的船只等到子时" }, { nodes: [] }).camp;
  c = Object.assign({}, c, {
    items: [{ name: "铜钥匙", holder: "队伍", n: 1 }],
    party: c.party.map(m => m.key === "user" ? Object.assign({}, m, { hp: 60 }) : Object.assign({}, m, { bond: 52 })),
    npcs: [{ name: "掌柜", stance: "敌", alive: true }, { name: "船夫", stance: "友", alive: true }],
    msgs: c.msgs.concat([{ role: "roll", who: "裴照川", statKey: "wit", tier: "hard", content: "x" }, { role: "roll", who: "Lisa", statKey: "agi", tier: "fail", content: "x" }])
  });
  const k = sceneCard(c);
  assert.equal(k.stage, 1);
  assert.ok(k.gain.includes("「铜钥匙」") && k.gain.some(x => /火油味/.test(x)));
  assert.ok(k.lose.includes("「火漆信」") && k.lose.includes("Lisa HP-20"));
  assert.ok(k.rel.some(x => /裴照川 羁绊\+2/.test(x)) && k.rel.includes("「掌柜」未明→敌") && k.rel.some(x => /结识「船夫」/.test(x)));
  assert.ok(k.npcs.some(x => /掌柜/.test(x)));
  assert.deepEqual(k.lit, [{ who: "裴照川", stat: "wit" }], "困难成功以上才算高光,失败不算");
  assert.equal(k.hook, "渡口的船只等到子时");
  const nh = sceneCard(Object.assign({}, c, { pace: Object.assign({}, c.pace, { hook: undefined }) }));
  assert.equal(nh.hook, "下一章:追到渡口", "守密人没给钩子就用下一章的目标");
});

test("翻章出卡:卡进史(sys 带 card)、进 cards,下一章挂待排", () => {
  const c = Object.assign(planned(), { pendingStage: "到了" });
  const n = stageAdvance(c);
  assert.equal(n.stageIdx, 1);
  const last = n.msgs[n.msgs.length - 1];
  assert.equal(last.role, "sys");
  assert.match(last.content, /第1章结算 · 得到/);
  assert.equal(n.cards.length, 1);
  assert.deepEqual(n.pace, { stageIdx: 1, want: true });
  assert.match(src, /\? stageAdvance\(c\)/, "单机「翻过这一章」走这一份");
});

test("高光喂进成长:被点了高光的那一项掷两颗取高的", () => {
  const party = [{ key: "c1", name: "裴照川", stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } }];
  const recs = [{ who: "裴照川", statKey: "wit", tier: "ok" }];
  const seq = [0.1, 0.95]; let i = 0; const rand = () => seq[i++ % seq.length];
  const plain = growthRolls(party, recs, () => 0.1);
  assert.equal(plain[0].to, 70, "一颗 11 过不了 70");
  const g = growthRolls(party, recs, rand, [{ who: "裴照川", stat: "wit" }]);
  assert.equal(g[0].lit, true);
  assert.equal(g[0].to, 75, "两颗取高的 96 过了");
  assert.match(src, /growthRolls\(camp\.party, rollRecs, Math\.random, \(camp\.cards \|\| \[\]\)\.flatMap\(k => k\.lit \|\| \[\]\)\)/);
});
