// 她 2026-09-22：「没开互通的时候感觉人物表现很刻板印象还很油腻」，
// 又追问「新卡单聊也没聊过天，为啥不刻板？是不是单纯群聊会这样」—— 选了「闭群也写心声」。
//
// 互通群一直要求每人写一句心声：等于逼模型先想清楚【这个人此刻心里真在想什么】再开口。
// 闭群因为状态卡不回流主线，这一栏整个关了 —— 模型就直接从人设标签开口，刻板、油腻都从这儿来。
// 现在闭群也要心声，但【只挂在群里这条气泡上】，往主线状态卡写的那一步照旧只认互通群和配角。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const bare = s => s.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

const hintAt = app.indexOf("const thoughtHint = gs.memoryInterop ?");
const hint = app.slice(hintAt, app.indexOf("\n      const ", hintAt + 20));
const fieldAt = app.indexOf("const thoughtField = gs.memoryInterop");
const field = app.slice(fieldAt, app.indexOf("\n      const ", fieldAt + 20));

test("闭群也要心声：先想后说", () => {
  assert.ok(hintAt > 0 && hint.length > 200, "抠不出 thoughtHint");
  assert.doesNotMatch(hint, /MOOD_TURN_RULE : "";/, "闭群那一支还是空串");
  assert.match(hint, /先把这一句想清楚，再写 TA 说出口的那句/);
  assert.match(hint, /不从「这种人设一般怎么说话」里长出来/, "没说清心声是拿来干嘛的");
  assert.match(hint, /第一人称『我』必须就是该对象 name 指定的成员本人/, "视角那道闸没跟过来");
  assert.match(hint, /心声只留在这个群里，不会带回别处/);
});

test("输出栏：闭群人人可写 thought；mood／wearing 仍只给配角", () => {
  assert.ok(fieldAt > 0, "抠不出 thoughtField");
  const closed = bare(field.slice(field.indexOf(": \",\\\"thought\\\"")));
  assert.match(closed, /\\"thought\\":\\"（可选）没说出口的心声\\"/, "闭群的 thought 还写着「只有配角填」");
  assert.match(closed, /\\"mood\\":\\"（只有配角填）/, "mood 也放给主角色了 —— 那是往主线状态卡写的");
  assert.match(closed, /\\"wearing\\":\\"（只有配角填）/);
});

test("心声挂在气泡上，但不回流主线", () => {
  assert.match(app, /const gThought = item\.thought && String\(item\.thought\)\.toLowerCase\(\) !== "null"/, "闭群的心声还是不显示");
  assert.doesNotMatch(bare(app), /const gThought = gs\.memoryInterop &&/);
  // 写主线状态卡的那一步：照旧只认互通群和配角
  assert.match(app, /if \(gs\.memoryInterop \|\| _npcSpk\) \{\s*\n\s*const moodLabel/, "闭群开始往主线状态卡里写了");
});
