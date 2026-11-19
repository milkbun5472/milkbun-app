// 她 2026-11-19：「群聊设置都是一个东西一张卡，就不能收起来好几个差不多的放一起吗」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c = fs.readFileSync(path.resolve(__dirname, "..", "js/components.js"), "utf8");
test("群设置三组收起来：群和成员、他们怎么聊、记得什么", () => {
  assert.match(c, /const gSection = \(title, sub, \.\.\.kids\) =>/);
  ["群和成员", "他们怎么聊", "记得什么"].forEach(n => assert.match(c, new RegExp('gSection\\("' + n + '"')));
  const i = c.indexOf('gSection("群和成员"'), j = c.indexOf('gSection("他们怎么聊"'), k = c.indexOf('gSection("记得什么"');
  assert.ok(c.slice(i, j).indexOf('title: "群名 · 成员"') > 0 && c.slice(i, j).indexOf('title: "我在这个群用哪张面具"') > 0);
  assert.ok(c.slice(j, k).indexOf('title: "线上也用文风预设"') > 0 && c.slice(j, k).indexOf('title: "怎么相处"') > 0);
  assert.ok(c.slice(k).indexOf('title: "记忆库 · 群规矩"') > 0);
});
