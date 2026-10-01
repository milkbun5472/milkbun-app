// 日记写不进角色之间的事（她 2026-10-01：cp 两个人自己聊，日记不写她们之间的事）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");
const i = eng.indexOf("const DIARY_SKELETON = ["), j = eng.indexOf("async function generateDiaryComment(", i);
assert.ok(i > 0 && j > i, "抠不出日记那一段");
const seg = eng.slice(i, j);

test("分量按这一天被谁占去，不按是不是用户", () => {
  assert.match(seg, /"- 【日记的中心是你自己，不是用户】[^"]*不管 Ta 是不是用户/);
});

test("她没出场的日子，不再把日记拽回她身上", () => {
  assert.ok(!/"[^"\n]*可以写惦记她、等她消息/.test(seg), "那句又回来了");
  assert.match(seg, /写你今天真正是跟谁、怎么过的/);
});
