// 群里 2026-11-19：「同人文设置成最少 7000 字，每篇还是一千多字」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
test("新写一批的输出上限跟着每章最少字数走", () => {
  const s = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic-core.js"), "utf8");
  assert.match(s, /maxTokens: Math\.min\(FIC_TOKEN_MAX \* 4, 6000 \+ n \* Math\.max\(perFic, Math\.ceil\(minWords \* 2\)\)\)/);
});
