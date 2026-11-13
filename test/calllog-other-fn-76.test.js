const test = require("node:test"); const assert = require("node:assert");
const E = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = E.indexOf("function callerFnOf"), j = E.indexOf("function callerLabelOf");
const CALL_SKIP_FN = { callAI: 1, callAIOnce: 1, once: 1, logIt: 1, runProbe: 1 };
const callerFnOf = new Function("CALL_SKIP_FN", E.slice(i, j) + "; return callerFnOf;")(CALL_SKIP_FN);
test("认不出名字的调用记下函数名", () => {
  const st = "Error\n    at callAI (https://x/js/engine.js:1:1)\n    at async tickWhatever (https://x/js/app.js:2:2)";
  assert.equal(callerFnOf(st), "tickWhatever");
  assert.equal(callerFnOf("Error\n    at callAI (https://x/js/engine.js:1:1)"), "");
  assert.match(E, /logFrom = "其他·" \+ _fn/);
});
