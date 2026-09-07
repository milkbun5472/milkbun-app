"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("js/app.js", "utf8");
const start = app.indexOf("const crossRecentFor = (charId, opts = {}) => {");
const end = app.indexOf("// 群线下的记忆按在场成员的可见交集分流", start);
const block = app.slice(start, end);

test("群聊跨情境近况只使用自己收到的 charId", () => {
  assert.ok(start > 0 && end > start, "crossRecentFor 函数没切到");
  assert.match(block, /const char = offlineCharacterFor\(charId\);/);
  assert.doesNotMatch(block, /\bscopeKey\b/, "群聊函数里混入了只属于侧房线下链的 scopeKey");
});

test("群线上和群线下都走同一个已修好的近况函数", () => {
  assert.match(app, /const lines = \[ownMem, crossRecentFor\(id\)\]/);
  assert.match(app, /crossRecentFor\(c\.id, \{ surfaces: \["offline"\] \}\)/);
});
