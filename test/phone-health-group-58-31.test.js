const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const grab = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + a); return src.slice(i, j); };
const { healthGroupOf, HEALTH_GROUPS } =
  new Function(grab("const HEALTH_GROUPS = [", "function HealthView") + "\nreturn { healthGroupOf, HEALTH_GROUPS };")();
const KEYS = HEALTH_GROUPS.map(g => g.key);
// 界面就是这么分档的：卡按 group 分到各个 tab，分不到任何一档＝这张卡永远翻不到
const visible = cards => KEYS.flatMap(k => cards.filter(c => healthGroupOf(c) === k));

// 她 2026-08-30：「我怎么记得我们有一个私密生理状态没了，明明之前刷新还看到了的」
// 分组从来只有 体征/心神/摄入 三档（私密的身体反应写在【心神】那一档里），
// 但模型不一定按 key 回——回中文、回近义词、或者照着提示词那句直接回「私密」，
// 旧写法就把整张卡默默吞掉：数据里有、花了一次调用、每个 tab 都翻不到。
test("group 写成什么样都不许让整张卡消失", () => {
  const cards = [
    { name: "睡眠", group: "body" }, { name: "情绪", group: "mind" }, { name: "喝水", group: "intake" },
    { name: "私密的身体反应", group: "私密" }, { name: "欲望", group: "private" }, { name: "亲密", group: "intimacy" },
    { name: "心神那档", group: "心神" }, { name: "摄入那档", group: "摄入" }, { name: "体征那档", group: "体征" },
    { name: "大小写", group: "Mind" }, { name: "带空格", group: " intake " },
    { name: "没写 group" }, { name: "空的", group: "" }, { name: "谁也不认识", group: "zzz-unknown" }
  ];
  const shown = visible(cards).map(c => c.name);
  const lost = cards.map(c => c.name).filter(n => shown.indexOf(n) < 0);
  assert.deepEqual(lost, [], "这些卡一个 tab 都翻不到：" + lost.join("、"));
  assert.equal(shown.length, cards.length, "有卡被分进了两档，会重复出现");
});

test("认得出来的要归对档，不是一股脑倒进第一个 tab", () => {
  [["私密", "mind"], ["private", "mind"], ["intimate", "mind"], ["欲望", "mind"], ["情绪", "mind"], ["心神", "mind"],
   ["摄入", "intake"], ["diet", "intake"], ["饮食", "intake"], ["消耗", "intake"],
   ["体征", "body"], ["身体", "body"], ["vitals", "body"],
   // 大小写和多余空格也得认——模型回 "Mind" / " intake " 是常事，
   // 不归一化的话它们会掉进兜底档，看着像没消失、其实摆错了地方
   ["Mind", "mind"], ["MIND", "mind"], [" intake ", "intake"], ["Private", "mind"], ["  body", "body"]]
    .forEach(([raw, want]) => assert.equal(healthGroupOf({ group: raw }), want, "「" + raw + "」该归到 " + want));
});

test("认不出来的回落到第一个 tab——宁可摆错一档，也不许消失", () => {
  ["zzz", "随便写的", "42", "null"].forEach(raw =>
    assert.equal(healthGroupOf({ group: raw }), KEYS[0], "「" + raw + "」没有回落"));
  assert.equal(healthGroupOf({}), KEYS[0]);
  assert.equal(healthGroupOf(null), KEYS[0]);
});

test("界面真的走这个归位函数，不是又在别处自己判一遍", () => {
  const view = grab("function HealthView(", "\nfunction ");
  assert.match(view, /const byGroup = g => cards\.filter\(c => healthGroupOf\(c\) === g\);/,
    "分档没走 healthGroupOf，别处再判一次就又会吞卡");
  assert.ok(!/\(c\.group \|\| "body"\) === g/.test(view), "旧的那句只认三个 key 的写法还留着");
});

// 提示词里「私密的身体反应」是写在 mind 那一档里的，不是第四档——
// 哪天真要单开一档，这条测试会提醒同时改提示词和 HEALTH_GROUPS
test("私密这类归在心神档里，提示词和分档说的是同一件事", () => {
  assert.deepEqual(KEYS, ["body", "mind", "intake"], "分档变了，提示词那句得跟着改");
  const spec = grab("  health: ", "\n      schemaHint");
  const mindLine = src.slice(src.indexOf("cards **12-14 张指标卡**"), src.indexOf("cards **12-14 张指标卡**") + 300);
  assert.match(mindLine, /mind（心神：[^）]*私密的身体反应/, "提示词里没再让他写私密那类，界面上自然就没有了");
});
