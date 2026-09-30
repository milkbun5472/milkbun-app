// 群友 2026-10-01：「秋秋离开不能继续生成」——切到别的 app，iPhone 把后台的请求掐断。
// 她当场拍板：「死了不要自动重试！」——按次计费，断了就是断了；只把原因说对。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const i = engine.indexOf("async function callAI("), j = engine.indexOf("\nasync function callAIOnce(", i);
assert.ok(i > 0 && j > i, "抠不出 callAI");

const mk = (plan) => {
  const listeners = [];
  const doc = { hidden: false, addEventListener: (_, f) => listeners.push(f), removeEventListener: (_, f) => { const k = listeners.indexOf(f); if (k >= 0) listeners.splice(k, 1); } };
  let calls = 0;
  const once = async () => { const step = plan[calls++] || {}; if (step.hide) { doc.hidden = true; listeners.slice().forEach(f => f()); } if (step.err) throw new Error(step.err); return step.ok; };
  const fn = new Function("document", "callAIOnce", "setTimeout", "window", engine.slice(i, j) + "\nreturn callAI;")(doc, once, f => { f(); return 0; }, undefined);
  return { fn, listeners, calls: () => calls };
};

test("进过后台又断了：一枪都不补发，报错说清是切出去被掐断的", async () => {
  const m = mk([{ hide: true, err: "连接中断了（Load failed）" }, { ok: "不该有第二枪" }]);
  await assert.rejects(m.fn({}, "sys", [{ role: "user", content: "在哪里调" }], {}), /切到别的地方时，手机把后台的连接掐断了/);
  assert.equal(m.calls(), 1, "自动重试了——她说过断了不要重试");
  assert.equal(m.listeners.length, 0, "visibilitychange 监听没摘掉");
});

test("正常回来的那一枪也把监听摘掉", async () => {
  const m = mk([{ ok: "好" }]);
  assert.equal(await m.fn({}, "sys", [{ role: "user", content: "x" }], {}), "好");
  assert.equal(m.listeners.length, 0);
});
