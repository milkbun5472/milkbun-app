// 她 2026-10-07：「把 ooc 权限给秋秋放开吧」——秋秋看得到、改得了长期准则（角色和群）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = fs.readFileSync(path.join(__dirname, "..", "js", "assistant.js"), "utf8");
const P = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("快照里有长期准则和群规矩", () => {
  assert.match(A, /row\.长期准则 = l\.length \? l : "（没有）"/);
  assert.match(A, /群规矩: gl\.length \? gl : "（没有）"/);
});
test("rules 能改能撤，两个入口都接了写口", () => {
  assert.match(A, /rules: \{\n\s+zh: "长期准则"/);
  assert.match(A, /UNDOABLE = \{[^}]*rules: 1/);
  assert.match(A, /"target":"style\|persona\|appearance\|profile\|theme\|pagecolor\|bubble\|memory\|rules\|/);
  assert.equal((P.match(/onSetDirectives: \(id, lines\) => setDirectives\(/g) || []).length, 2);
});
