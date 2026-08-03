const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");

test("日记以角色选择性记忆写作，不再逐条拼聊天摘要", () => {
  assert.match(engine, /只挑【这个角色本人到睡前还会惦记的 1~3 个瞬间】写/);
  assert.match(engine, /不要逐条复述，不追求覆盖完整/);
  assert.match(engine, /不要站到自己外面解释/);
  assert.match(engine, /严格保持这个角色自己的声纹/);
  assert.match(engine, /全篇 0~2 个/);
  assert.doesNotMatch(engine, /全篇有 1~3 个这样的一句话 secret 段就够/);
});
