// 她 2026-10-05：「为啥他自动抽了三签」——唤醒那一串在一枪没回来时又叫了两次
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "auto-gate.js"), "utf8");
test("同一格还在跑，再叫一次直接跳过；跑完照常记账", async () => {
  const store = {};
  const root = { localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  new Function("window", "globalThis", "localStorage", "loadJSON", "saveJSON", src)(root, root, root.localStorage,
    (k, fb) => { try { return store[k] ? JSON.parse(store[k]) : fb; } catch (e) { return fb; } }, (k, v) => { store[k] = JSON.stringify(v); return true; });
  const G = root.AutoGate; assert.ok(G, "AutoGate 没挂上");
  let n = 0, release;
  const slow = () => new Promise(r => { n++; release = () => r(true); });
  const a = G.run("astroSign|c1", "2026-10-05", slow);
  const b = await G.run("astroSign|c1", "2026-10-05", slow);
  const c = await G.run("astroSign|c1", "2026-10-05", slow);
  assert.equal(b, "skip"); assert.equal(c, "skip"); assert.equal(n, 1, "同时跑了不止一枪");
  release(); assert.equal(await a, "ok");
  assert.equal(await G.run("astroSign|c1", "2026-10-05", slow), "skip", "跑成了同一天还又跑");
});
