const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const e = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("心声相关的规矩只说该怎么写，不点名套路（她 2026-10-27）", () => {
  assert.ok(!/心声那一格同样算/.test(e));
  assert.ok(!/对象不只是她/.test(e));
  assert.ok(!/说出口的话、心声和心情/.test(e));
  assert.ok(!/挪到心里想也还是同一个模子/.test(e));
  assert.match(e, /\*\*心声那一格守同一个标准\*\*/);
});
