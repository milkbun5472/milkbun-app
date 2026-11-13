const test = require("node:test"); const assert = require("node:assert");
const M = require("../js/cc-memory-auto.js");
const mem = () => { const d = {}; return { getItem: k => d[k] || null, setItem: (k, v) => { d[k] = v; } }; };
test("自动记忆失败后歇一阵，成功清零", () => {
  const st = mem(), t0 = Date.parse("2026-11-13T00:00:00Z");
  let s = M.load(st, "o", "c");
  assert.equal(M.cooling(s, t0), false);
  s = M.fail(st, s, new Error("断了"), t0);
  assert.equal(M.cooling(s, t0 + 60e3), true);          // 一分钟后不再试
  assert.equal(M.cooling(s, t0 + 11 * 60e3), false);    // 十分钟后可以
  s = M.fail(st, s, new Error("断了"), t0 + 11 * 60e3);
  assert.equal(M.cooling(s, t0 + 25 * 60e3), true);     // 第二次翻倍成 20 分钟
  s = M.commit(st, s, [], t0 + 60 * 60e3);
  assert.equal(M.cooling(s, t0 + 60 * 60e3 + 1), false);
});
test("后台不抽、冷却中不抽", () => {
  const A = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
  const i = A.indexOf("const runCcAutoMemory"); const seg = A.slice(i, i + 1200);
  assert.match(seg, /visibilityState === "hidden"\) return 0/); assert.match(seg, /CcMemoryAuto\.cooling\(state, Date\.now\(\)\)\) return 0/);
});
