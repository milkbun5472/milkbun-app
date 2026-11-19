// 群里 2026-11-19：「同人文设置成最少 7000 字，每篇还是一千多字」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
test("新写一批的输出上限跟着每章最少字数走", () => {
  const s = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic-core.js"), "utf8");
  assert.match(s, /function ficOutCap\(n, perFic, minWords\)/);
  assert.match(s, /maxTokens: ficOutCap\(n, perFic, minWords\)/);
  assert.equal((s.match(/maxTokens: ficOutCap\(1, clampPerFic\(opts\.perFic\), minWords\)/g) || []).length, 2, "续写、接着写都走这一份");
  assert.doesNotMatch(s, /maxTokens: 65000/);
  const f = new Function("const FIC_TOKEN_MAX = 60000;" + s.slice(s.indexOf("function ficOutCap"), s.indexOf("\n  }", s.indexOf("function ficOutCap")) + 4) + "return ficOutCap;")();
  assert.ok(f(3, 3000, 7000) >= 6000 + 3 * 14000);
  assert.equal(f(1, 2000, 0), 65000);
});
