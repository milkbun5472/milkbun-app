// 论坛点一个人主页是白页（群友 2026-10-16）：档案里没这个人就当网友主页开；真没有也不留白页
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/screens.js"), "utf8");
test("goProfile 先问档案里有没有；楼中楼把作者带上；profileView 不再返回 null", () => {
  assert.ok(/const goProfile = \(id, a\) => charOf\(id\) \? enterSub/.test(src));
  assert.ok(/goProfile\(r\.authorId, r\)/.test(src));
  assert.ok(!/if \(!isMe && !c\) return null;/.test(src));
});
