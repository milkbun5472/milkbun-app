const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); } };
require("../js/auto-refresh-policy.js");
const { AutoGate } = require("../js/auto-gate.js");

test("后台活儿挂上「功能·谁」的全名，收工就摘掉", async () => {
  AutoGate.nameOf = id => (id === "c1" ? "沈屿白" : "");
  assert.equal(AutoGate.currentShow(), "");
  let seen = "";
  await AutoGate.run("diary|c1", "2026-10-04", async () => { seen = AutoGate.currentShow(); return true; });
  assert.equal(seen, "日记·沈屿白");
  assert.equal(AutoGate.currentShow(), "");
});
test("同时跑两件不挑一个猜，照实列出来", async () => {
  let seen = "";
  await AutoGate.tagged("周刊", () => AutoGate.tagged("日记", async () => { seen = AutoGate.currentShow(); }, "日记·A"));
  assert.equal(seen, "周刊／日记·A");
});
test("callAI 成没成都广播 bg-call，app 那头弹提示、设置里有开关", () => {
  const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
  assert.match(eng, /new CustomEvent\("bg-call"/);
  assert.match(app, /addEventListener\("bg-call"/);
  assert.match(scr, /x_bgToast/);
});
