// 留言板 2026-11-19：「许愿给他递手机那里，前面那个藏起来的选项可以一直保存，现在每次退出去就又变成全给看了」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("能翻的几样按人记住：递手机时存，下回打开照上回的勾", () => {
  assert.match(R("js/app.js"), /saveJSON\("x_peekAllow", Object\.assign\(\{\}, _a, \{ \[charId\]: \(allow \|\| \[\]\)\.map\(String\) \}\)\)/);
  assert.match(R("js/components.js"), /const was = \(loadJSON\("x_peekAllow", \{\}\) \|\| \{\}\)\[character && character\.id\]; if \(Array\.isArray\(was\)\) return was\.filter\(k => all\.includes\(k\)\)/);
});
