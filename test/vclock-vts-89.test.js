// 她 2026-11-19：「做根本修法吧」——每条写下时记住自己的虚拟时间，读的时候先认它
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const s = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");
const grab = name => { const i = s.indexOf("function " + name + "("); let d = 0, j = s.indexOf("{", i); for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; } return s.slice(i, j + 1); };
test("落盘时记 vts，之后钟的历史段丢了也照它算；没记过的照旧推", () => {
  const virt = Date.UTC(2026, 9, 5, 12);
  const F = new Function("cfg", "const VTS_INDEX = new Map();" + grab("vtsClockOf") + grab("vtsTouch")
    + "function vclockCfg(id){ return cfg.on ? {} : null; }"
    + "function vclockMapReal(ts){ return cfg.on ? cfg.v + (ts - cfg.at) : ts; }"
    + grab("vclockMap").replace("const c = vclockCfg(id, ts);", "return vclockMapReal(ts); const c = 0;")
    + "return { vtsTouch, vclockMap, VTS_INDEX };");
  const cfg = { on: true, v: virt, at: Date.now() };
  const X = F(cfg);
  const msgs = [{ role: "user", content: "早", ts: Date.now() - 1000 }];
  X.vtsTouch("x_chat:c1", msgs, true);
  assert.ok(Math.abs(msgs[0].vts - (virt - 1000)) < 5);
  cfg.on = false;   // 钟的历史全没了 / 关了
  assert.equal(X.vclockMap(msgs[0].ts, "c1"), msgs[0].vts, "带了 vts 的照它");
  assert.equal(X.vclockMap(123456, "c1"), 123456, "没带的照旧推");
});
test("挂在 saveJSON / loadJSON 那一处，全 app 一百来处读日子的不用改", () => {
  assert.match(s, /function saveJSON\(k, v\) \{\n[^\n]*\n  vtsTouch\(k, v, true\);/);
  assert.equal((s.match(/vtsTouch\(k, p[vl], false\)/g) || []).length, 3);
  assert.match(s, /function vclockMap\(ts, id\) \{\n  if \(typeof VTS_INDEX !== "undefined" && VTS_INDEX\.size\) \{ const hit = VTS_INDEX\.get\(Number\(ts\)\);/);
});
