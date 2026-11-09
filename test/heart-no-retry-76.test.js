const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 她 2026-11-08：「心上也是吧，不要断了就重试」
test("心上：发呆和盘一盘都一天一趟，断了等明天", () => {
  assert.match(app, /AutoGate\.run\("desire\|" \+ c\.id, today, \(\) => desireMuseFor\(c\), \{ maxTries: 1 \}\)/);
  assert.match(app, /if \(!window\.AutoGate\.due\(_tk, today, \{ maxTries: 1 \}\)\) continue; window\.AutoGate\.claim\(_tk, today\);/);
});
