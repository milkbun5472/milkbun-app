const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const { applyTurnPayload, normSteps, stageOf, matchStep, stageBeats, STAGE_MIN_BEATS } = require("../js/trpg.js");

// ============================================================
// 章里的坎(她 2026-09-04 报:守密人节奏很赶,经常一两拍就让她过了下一章)
// 病根两条:章目标本身是一个动作,和闸太松(两拍+一次骰)。
// 每章两道坎——要达成这章目标必须先过的两件具体、能失败的事。
// 坎在戏里真过了守密人才报 stepDone;两道坎都过、至少四拍、掷过骰,stageDone 才放行。
// ============================================================

const camp = (over) => Object.assign({
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } }],
  items: [], clues: [], place: "驿站", stageIdx: 0, stageAt: 0,
  stages: [{ goal: "拿到名册", hint: "", place: "驿站", steps: [{ text: "让管家开口", done: false }, { text: "翻过后院那堵墙", done: false }], done: false, note: null },
           { goal: "b", done: false }],
  choices: [], pendingStage: false, pendingEnd: false,
  msgs: [{ role: "gm" }, { role: "roll", tier: "ok" }, { role: "gm" }, { role: "gm" }, { role: "gm" }, { role: "gm" }]
}, over || {});

test("开团的形状里每章带 steps,两条提示词都说清坎是什么、不许把 goal 拆两半", () => {
  assert.equal((src.match(/\\"steps\\":\[\\"要达成这章目标必须先过的第一道坎/g) || []).length, 2, "SHAPE_A 和 SHAPE_W 都要有 steps");
  assert.match(src, /每章再写两道坎\(steps\)/);
  assert.match(src, /不许只是把 goal 拆两半复述/);
  assert.match(src, /每章两道坎\(steps\)/, "同世界另起一局那条也要写坎");
  // 占位值是说明不是样例(prompt-no-content-samples)
  assert.doesNotMatch(src, /\\"steps\\":\[\\"[^\\]*(管家|名册)/);
});

test("stageOf:开团落地把 steps 规整成 {text,done},最多三道,老存档没坎也不炸", () => {
  const s = stageOf({ goal: " 拿到名册 ", hint: "x", place: "驿站", steps: ["让管家开口", { text: "翻墙" }, "", "第三", "第四"] });
  assert.equal(s.goal, "拿到名册");
  assert.deepEqual(s.steps.map(x => x.text), ["让管家开口", "翻墙", "第三"]);
  assert.ok(s.steps.every(x => x.done === false));
  assert.deepEqual(stageOf({ goal: "a" }).steps, []);
  assert.deepEqual(normSteps(null), []);
  assert.match(src, /stages: stages\.map\(stageOf\)/, "两条开团路都走 stageOf");
  assert.equal((src.match(/stages\.map\(stageOf\)/g) || []).length, 3, "开团×2 + 模组导入");
});

test("matchStep:认序号、原文、和改了几个字的复述", () => {
  const steps = normSteps(["让管家开口", "翻过后院那堵墙"]);
  assert.equal(matchStep(steps, "2"), 1);
  assert.equal(matchStep(steps, "让管家开口"), 0);
  assert.equal(matchStep(steps, "翻过后院那堵墙,落进菜地"), 1);
  assert.equal(matchStep(steps, "翻墙"), -1, "太短的碎片不乱认");
  assert.equal(matchStep(steps, ""), -1);
});

test("stepDone:对上的坎划掉、钉一枚角标、一拍最多一道;划过的不重复", () => {
  const c0 = camp();
  const r = applyTurnPayload(c0, { stepDone: "让管家开口" });
  assert.equal(r.camp.stages[0].steps[0].done, true);
  assert.equal(c0.stages[0].steps[0].done, false, "不改传进来的那份");
  assert.equal(r.camp.stages[0].steps[1].done, false);
  assert.ok(r.chips.some(ch => ch.k === "clue" && ch.txt === "⛰ 让管家开口"));
  const again = applyTurnPayload(r.camp, { stepDone: ["让管家开口", "翻过后院那堵墙"] });
  assert.equal(again.camp.stages[0].steps[1].done, false, "数组只认第一个,而且已划的不再动");
  assert.ok(!again.chips.some(ch => /⛰/.test(ch.txt)));
  const none = applyTurnPayload(camp(), { stepDone: "不存在的坎" });
  assert.equal(none.camp.stages[0].steps.some(x => x.done), false);
  // 不动别的章
  assert.equal(r.camp.stages[1], c0.stages[1]);
});

test("章节闸:还有坎没过就报 stageDone,丢掉并点名那道坎;两道都过了才放行", () => {
  const c = camp();
  const r0 = applyTurnPayload(c, { stageDone: true, stageNote: "拿到了" });
  assert.equal(r0.camp.pendingStage, false);
  assert.match(r0.gate, /还有坎没过:让管家开口、翻过后院那堵墙/);
  const c1 = applyTurnPayload(c, { stepDone: "让管家开口" }).camp;
  const r1 = applyTurnPayload(c1, { stageDone: true });
  assert.match(r1.gate, /还有坎没过:翻过后院那堵墙$|还有坎没过:翻过后院那堵墙\)/);
  // 最后一道坎可以和 stageDone 同拍
  const r2 = applyTurnPayload(c1, { stepDone: "翻过后院那堵墙", stageDone: true, stageNote: "拿到了名册" });
  assert.equal(r2.gate, null);
  assert.equal(r2.camp.pendingStage, "拿到了名册");
  assert.equal(r2.camp.stageIdx, 0, "还是只挂待确认,由玩家点头");
});

test("章节闸:至少四拍——坎都过了、拍数不够也不放", () => {
  const c = camp({ msgs: [{ role: "gm" }, { role: "roll", tier: "ok" }, { role: "gm" }] });
  const c1 = applyTurnPayload(applyTurnPayload(c, { stepDone: "1" }).camp, { stepDone: "2" }).camp;
  const r = applyTurnPayload(c1, { stageDone: true });
  assert.match(r.gate, /才开章,不到四拍/);
  assert.equal(STAGE_MIN_BEATS, 4);
  assert.equal(stageBeats([{ role: "gm" }, { role: "gm", sceneType: "interlude" }, { role: "gm", sceneType: "explore" }, { role: "gm", lull: true }, { role: "roll" }]), 1);
});

test("老存档:章上没写坎,只看拍数和骰(不然旧团永远翻不了章)", () => {
  const c = camp({ stages: [{ goal: "拿到名册", done: false }, { goal: "b", done: false }] });
  assert.equal(applyTurnPayload(c, { stageDone: true }).gate, null);
});

test("提示词:当前章亮出坎的进度,输出里有 stepDone,休整和幕间不许过坎", () => {
  assert.match(src, /"〔这章的坎:" \+ normSteps\(s\.steps\)\.map\(\(st, j\) => \(st\.done \? "✓" : "·"\)/);
  assert.match(src, /坎在剧情里【真实过了】才报 stepDone\(写那道坎的原文,一拍最多过一道/);
  assert.match(src, /两道坎都过了、开章后至少四拍、且本章掷过骰,才报 stageDone\(可与最后一道坎同拍\)/);
  assert.match(src, /\\"stepDone\\":null,\\"stageDone\\":false/);
  assert.equal((src.match(/也不报 stepDone/g) || []).length, 2, "休整拍和幕间都不许过坎");
  assert.doesNotMatch(src, /开章后的前两拍不报 stageDone/, "旧的两拍说法要删干净");
});

test("面板:当前章底下列坎,划掉的带删除线;修正模式点一下划掉/撤回", () => {
  assert.match(src, /"坎" \+ \(j \+ 1\) \+ ":" \+ st\.text/);
  assert.match(src, /textDecoration: st\.done \? "line-through" : "none"/);
  assert.match(src, /applyFix\(\(st\.done \? "撤回" : "划掉"\) \+ "第" \+ \(i \+ 1\) \+ "章的坎「"/);
  assert.match(src, /"主线" \+ \(fixMode \? "\(点一道坎划掉\/撤回\)" : ""\)/);
});

test("模组导出带坎、回溯快照把重开那几章的坎撤回", () => {
  assert.match(src, /steps: normSteps\(x\.steps\)\.map\(st => st\.text\)/, "导出模组时坎只留文字");
  assert.match(src, /done: false, note: null, steps: normSteps\(s\.steps\)\.map\(st => Object\.assign\(\{\}, st, \{ done: false \}\)\)/);
});
