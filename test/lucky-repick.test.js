const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("幸运字符重选：从剩下的再翻、不叫模型、点亮前才能换（她 2026-10-27）", () => {
  const i = app.indexOf("const pickLucky = (groupId, i) => {"), body = app.slice(i, app.indexOf("\n  };", i));
  assert.match(body, /if \(i === "again"\)/);
  assert.match(body, /\(st0\.lit \|\| 0\) > 0\) return;/);
  assert.match(body, /luckySave\(groupId, \{ \.\.\.st0, word: "", lit: 0, prog: 0, picked: -1, used \}\);/);
  assert.match(body, /\(st\.used \|\| \[\]\)\.includes\(i\)\) return;/);
  assert.ok(!/callAI|runProbe/.test(body), "重选不该叫模型");
  assert.equal((app.match(/cards, picked: -1, used: \[\] \}\);/g) || []).length, 2, "新抽一套要清掉翻过的记号");
  assert.match(c, /"data-wk": "gluckyagain", onClick: \(\) => onPickLucky && onPickLucky\("again"\)/);
});
