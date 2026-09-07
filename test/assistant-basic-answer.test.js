const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const src = fs.readFileSync("js/assistant.js", "utf8");

test("秋秋可以回答基础问题，但没有因此扩张写入权限", () => {
  assert.match(src, /解释常识和概念、语言表达、简单计算、生活办法、轻量计划/);
  assert.match(src, /回答普通问题不会给你新增任何写入权限/);
  assert.match(src, /普通问答生成 patch/);
  assert.match(src, /这条限制只管 App 功能，不限制上面的普通基础问答/);
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

test("秋秋首页把基础问答能力说出来", () => {
  assert.match(src, /普通常识、词句意思、简单计算和生活小问题，我也能直接答/);
});
