// 动作不许写进 word（她 2026-09-22 报：公共版有人的动作变成了气泡，家里从来没有）
//
// 病根是单聊那一行里的一个【或】：
//   `action: string，每轮回复完成后${ACT_MEANING}或在 word 中报备。`
// 一句话给了两条一样合法的路——填进 action 那一格，或者写进 word。
// 她家里的模型走第一条；公共版用户各带各的模型，弱一点的走第二条，
// 而 word 里的每一条就是一个气泡。代码两边一模一样，差的是模型。
//
// 她当场补的判据比「显示不显示」更本质：**「报备」本身就不是人话**——
// 真人说完一段不会再补一句交代自己在干嘛。所以不分动描开关，两种情况都不许报。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

// 只看会发出去的字符串，不看注释（engine.js 那段注释留着这条的来历，是有意保留的）
const stripComments = src => src.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

test("提示词里不再有「在 word 中报备」这条路", () => {
  assert.ok(stripComments(app).indexOf("或在 word 中报备") < 0, "那个【或】又回来了");
  assert.ok(stripComments(eng).indexOf("或在 word 中报备") < 0);
});

test("action 那一行明说这是唯一的去处，并且给了出口", () => {
  const i = app.indexOf("action: string，每轮回复完成后");
  assert.ok(i > 0, "找不到单聊的 action 规格");
  const line = app.slice(i, i + 400);
  assert.match(line, /这一格是它唯一的去处/);
  assert.match(line, /别在 word 里再说一遍/);
  // ⚠️收尾给出口不给判决（施工规则/bans-make-it-dumber.md）：
  //   不许以「不许写」「删掉重说」收尾，要指向他自己会说的那句
  assert.match(line, /就让它自然落在你要说的那句里/);
});

test("定义仍然只有 ACT_MEANING 一份，三处共用", () => {
  // 单聊 / 群聊 / 线下都引它，不许谁自己再写一份（施工规则/one-public-mechanism.md）
  assert.equal((eng.match(/const ACT_MEANING = /g) || []).length, 1);
  assert.ok((app.match(/\$\{ACT_MEANING\}/g) || []).length >= 1, "单聊没引公共定义");
  assert.match(app, /const G_ACTION_SPEC = ACT_MEANING \+/);
  assert.match(eng, /action 每轮必须填写，禁止 null、空串或省略：\$\{ACT_MEANING\}/);
});
