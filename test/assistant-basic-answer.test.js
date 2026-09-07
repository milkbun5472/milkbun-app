const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const src = fs.readFileSync("js/assistant.js", "utf8");

test("秋秋可以回答 App 基础问题，但没有变成生活百科或扩张写入权限", () => {
  assert.match(src, /它整体是做什么的、某个页面或概念是什么意思、不同玩法有什么区别/);
  assert.match(src, /她现在有哪些角色和文风、眼前页面与现状快照里能确认的设置是什么/);
  assert.match(src, /仍然只负责这个 App，不回答与它无关的百科、新闻或生活问题/);
  assert.match(src, /基础问答不会给你新增任何写入权限/);
  assert.match(src, /纯问答生成 patch/);
});

test("模型直接返回普通正文时保住答案，不再误报没听懂", () => {
  assert.match(src, /let plain = String\(raw \|\| ""\)/);
  assert.match(src, /reply = scrubCode\(plain\)/);
  assert.doesNotMatch(src, /throw new Error\("没听懂它说什么，再问一次"\)/);
  assert.match(src, /线路没有返回可读内容，可以再问一次/);
});

test("真跑一遍：线路回普通正文也能成为秋秋的回复", async () => {
  const start = src.indexOf("(function () {\n  const useState = React.useState;");
  const end = src.indexOf("// ============================================================\n// 界面：");
  const sandbox = {
    window: {}, console,
    React: { useState: () => [] }, h: () => null, Svg: null,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    loadJSON: (_key, fallback) => fallback,
    callAI: async () => "答案是四。",
    parseJSONLoose: () => ({}), extractJSON: () => ({})
  };
  sandbox.window = sandbox;
  vm.runInNewContext(src.slice(start, end), sandbox);
  const result = await sandbox.Assistant.ask({}, { characters: [], profile: {} }, [], "二加二等于几？");
  assert.equal(result.reply, "答案是四。");
  assert.deepEqual(Array.from(result.patches), []);
});

test("秋秋首页把 App 基础问答能力说出来", () => {
  assert.match(src, /这个 App 整体是做什么的、某一页或一个概念是什么意思、不同玩法有什么区别/);
  assert.match(src, /现在有哪些角色、文风和设置/);
});
