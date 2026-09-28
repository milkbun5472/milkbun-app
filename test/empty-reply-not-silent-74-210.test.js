// 2026-09-28 群里报：「收不到回复 orz，在 api 站显示已经反馈了」——那条日志写着
// 输入 29,296 / 输出 1,103 / 非流 / 15.0s，也就是【上游真出了东西、也照样计了费】，
// 可屏幕上一个字都没有。病根：发气泡那一步是 for (i < words.length)，
// 空数组就是一次都不跑——没报错、没提示、连要不要重发都判断不了。
// ⚠️根因多半在中转站，但这一条和谁的锅无关：只有 app 这头能告诉她这一轮没回上来；
//   不说的话她会读成「app 不回我」，手上也没有能拿去索赔的东西。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const i = app.indexOf("const _nothingShown = !words.length");
assert.ok(i > 0, "空回兜底没了");
const seg = app.slice(i - 200, i + 1400);

test("空回要说话，而且说在发气泡【之前】", () => {
  assert.match(seg, /toast\("这一轮没回上来/);
  const guard = app.indexOf("const _nothingShown");
  const loop = app.indexOf("for (let i = 0; i < words.length; i++)", guard - 2000);
  assert.ok(guard < app.indexOf("for (let i = 0; i < words.length; i++)", guard), "判断要排在发气泡那个循环前面");
});

test("原文要跟着留下来（翻成人话，但别把原文丢了）", () => {
  assert.match(seg, /〔它这回答的是〕/);
  assert.match(seg, /String\(raw == null \? "" : raw\)/);
  assert.match(seg, /slice\(0, 400\)/, "留一段就够，别把整包塞进聊天");
  assert.match(seg, /window\.errLog && window\.errLog\("chat"/, "诊断那头也留一份");
});

test("只有动作描写、没有台词是合法的一轮，不许误报", () => {
  assert.match(seg, /!rescuedActLines\.length/);
  assert.match(seg, /!\(_actDesc && onlineAction && String\(onlineAction\)\.trim\(\)\)/);
});

test("不自动重发（那是悄悄再花一次钱）", () => {
  assert.ok(!/_nothingShown[\s\S]{0,600}(retry|重发一次|sendAgain\()/.test(seg.replace("直接把上一句重发一次通常就好了", "")),
    "只许提示她自己重发，不许代她再打一枪");
});
