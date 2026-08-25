const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 她 2026-08-25：「为啥塔罗也进记忆库了，不要这个！」
// 记忆库是给「你俩之间真的发生过什么」用的，一卦牌不是那种东西，
// 攒多了还会把真正的事挤出召回名额。
test("塔罗不写记忆库", () => {
  const i = app.indexOf("onReadingDone: (charId, info) =>");
  assert.ok(i > 0);
  const fn = app.slice(i, i + 1800);
  assert.doesNotMatch(fn, /addMemEntry\(/, "占卜不许再往记忆库塞");
  assert.equal(app.indexOf('source: "tarot"'), -1);
  // 但 charThought 仍旧进「Ta 眼里」——那是他私心里对牌的反应，属于印象不属于事实
  assert.match(fn, /window\.Gaze\.applyParsed\(charId, \{ side: "me", block: "recent"/);
});

// 「我在群里聊了会没看到群里的东西进他记忆库啊」——两种原因，之前一个字都没说。
test("说清楚群聊为什么还没进记忆库", () => {
  const i = comp.indexOf("还差 " + '" + left + "');
  assert.ok(comp.indexOf("还差 ") > 0, "开着互通时要告诉她还差几条");
  assert.match(comp, /现在 " \+ n \+ " 条，还差 " \+ left \+ " 条才会自动总结进记忆库/);
  assert.match(comp, /这个群没开【记忆互通】：群里发生的事一个字都不会进记忆库/,
    "封闭群要点破，别让她以为是坏了");
  assert.match(comp, /你定的「封闭群只进不出」/);
  // 手动那一枪在封闭群里是破例，按钮要说实话
  assert.match(comp, /仍要立刻存进记忆库（破例一次）/);
  assert.match(comp, /msgCount: \(messages \|\| \[\]\)\.length,/);
});

// v56.03 把群侧写记忆的归属改成只给真角色，但手动总结那一处的 tag 形状不一样，
// 当时没被那次批量替换扫到——配角会被算成记忆的归属人。
test("手动总结那一枪也要归属真角色", () => {
  const i = app.indexOf("const summarizeGroupToMem");
  const fn = app.slice(i, app.indexOf("const createGroup"));
  assert.match(fn, /charIds: memOwners\(group\.memberIds\)/);
  assert.match(fn, /tags: gTags\(group\)/, "tag 形状要和自动那六处对齐");
  assert.match(fn, /groupId: group\.id/, "清群记录·同步忘却要认得出是哪个群的");
  assert.match(fn, /knownBy: group\.memberIds\.slice\(\)/, "在场的都算知道，含配角");
});
