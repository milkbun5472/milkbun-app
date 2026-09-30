const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const read = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
test("callAI 按 signal 当场放手，自己断的不重试不报失败", async () => {
  const eng = read("engine.js");
  const src = eng.slice(eng.indexOf("async function callAI("), eng.indexOf("async function callAIOnce("));
  let calls = 0;
  const callAIOnce = () => { calls++; return new Promise(() => {}); };
  const fn = new Function("callAIOnce", "window", "document", src + "; return callAI;")(callAIOnce, {}, undefined);
  const ctrl = new AbortController();
  const p = fn({}, "s", [{ role: "user", content: "你好呀" }], { signal: ctrl.signal });
  setTimeout(() => ctrl.abort(), 5);
  await assert.rejects(p, e => e.userAbort === true);
  assert.strictEqual(calls, 1);
});
test("单聊、群聊、线下、群线下登记断点、气泡挂叉、设置里有开关", () => {
  const app = read("app.js"), comp = read("components.js"), scr = read("screens.js");
  assert.ok(app.includes('laneAbortBegin("c:" + chatKey)'));
  assert.ok(app.includes('laneAbortBegin("c:" + scopeKey)'));
  assert.ok(app.includes('laneAbortBegin("g:" + group.id)'));
  assert.ok(app.includes('laneAbortBegin("g:" + groupId)'));
  assert.ok(app.includes("signal: _abort.signal"));
  assert.strictEqual((app.match(/onStopGen: stopBtnFor\(/g) || []).length, 4);
  assert.strictEqual((comp.match(/h\(GenStopX, \{ onStop: onStopGen \}\)/g) || []).length, 4);
  const eng = read("engine.js");
  assert.strictEqual((eng.match(/signal: session\.signal/g) || []).length, 4);
  assert.ok(scr.includes('saveJSON("x_genStopOn"'));
});
