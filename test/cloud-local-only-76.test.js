const test = require("node:test"); const assert = require("node:assert");
const S = require("fs").readFileSync(__dirname + "/../js/cloud.js", "utf8");
test("撤销历史不进云端备份", () => {
  assert.match(S, /const LOCAL_ONLY = \{ x_neteaseCookie: 1, x_assistUndo: 1, x_look_hist: 1 \}/);
  assert.match(S, /!LOCAL_ONLY\[k\] && !\(tableMemoryMode\(\) && k === "x_memLib"\)\)\s*\n\s*\.forEach/);
  assert.match(S, /if \(v != null && !LOCAL_ONLY\[k\]/);
});
