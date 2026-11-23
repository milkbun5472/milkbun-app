// 她 2026-11-19：「做根本修法吧」——每条写下时记住自己的虚拟时间，读的时候先认它
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const s = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");
const grab = name => { const i = s.indexOf("function " + name + "("); let d = 0, j = s.indexOf("{", i); for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; } return s.slice(i, j + 1); };
test("落盘时记 vts，之后钟的历史段丢了也照它算；没记过的照旧推", () => {
  const virt = Date.UTC(2026, 9, 5, 12);
  const F = new Function("cfg", "const VTS_INDEX = new Map();" + (s.match(/const VTS_EXTRA = \{[^\n]*\};/) || [""])[0] + grab("vtsClockOf") + grab("vtsTouch") + grab("vtsTouchList") + "function vclockState(){ return null; }" + grab("vtsKeyOf")
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

test("单独存的那几样也记：日记按人分开存、写的是昨天也算", () => {
  const virt = Date.UTC(2026, 9, 5, 12);
  const F = new Function("cfg", "const VTS_INDEX = new Map();" + (s.match(/const VTS_EXTRA = \{[^\n]*\};/) || [""])[0] + grab("vtsClockOf") + grab("vtsTouch") + grab("vtsTouchList") + "function vclockState(){ return null; }" + grab("vtsKeyOf")
    + "function vclockCfg(id){ return cfg.on ? {} : null; }"
    + "function vclockMap(ts){ return cfg.on ? cfg.v + (ts - cfg.at) : ts; }"
    + "return { vtsTouch, VTS_INDEX };");
  const X = F({ on: true, v: virt, at: Date.now() });
  const d = { c1: [{ id: "d1", ts: Date.now() - 864e5, text: "昨天" }] };
  X.vtsTouch("x_diaries", d, true);
  assert.ok(isFinite(d.c1[0].vts));
  const m = [{ id: "m1", characterId: "c1", ts: Date.now() - 5000, content: "朋友圈" }];
  X.vtsTouch("x_moments", m, true);
  assert.ok(isFinite(m[0].vts));
  ["x_diaries", "x_moments", "x_stories", "x_coupleQA", "x_coupleLetters", "x_coupleTimeline", "x_capsules"].forEach(k => assert.match(s, new RegExp(k + ": 1")));
});

// 她 2026-11-23「补吧」：vts 只认同一只钟；群里的记忆照群钟；不叫 ts 的时间也认
test("vts 连钟一起记，别人那只钟来问不给", () => {
  const F = new Function("W", "const VTS_INDEX = new Map();" + (s.match(/const VTS_EXTRA = \{[^\n]*\};/) || [""])[0] + grab("vtsClockOf") + grab("vtsTouch") + grab("vtsTouchList")
    + "function vclockState(){ return W; }" + grab("vtsKeyOf")
    + "function vclockCfg(id){ return {}; } function vclockRawCfg(){ return null; } function vclockMapBy(c, ts){ return ts + (W.maskOf(String(W.who)) === 'mA' ? 1000 : 0); }"
    + grab("vclockMap").replace("const c = vclockCfg(id, ts);", "W.who = id; const c = vclockCfg(id, ts);")
    + "return { vtsTouch, vclockMap };");
  const W = { clocks: { mA: {}, mB: {} }, maskOf: id => id === "a" || id === "g:x" ? "mA" : "mB" };
  const X = F(W);
  const t = Date.now() - 1000, msgs = [{ role: "user", content: "x", ts: t }];
  X.vtsTouch("x_chat:a", msgs, true);
  assert.equal(X.vclockMap(t, "a"), t + 1000);
  assert.equal(X.vclockMap(t, "b"), t, "别人那只钟不拿 a 的");
  assert.match(grab("vtsClockOf"), /item\.groupId \? "g:"/);
  assert.match(grab("vtsTouchList"), /it\.createdTs, it\.createdAt/);
});
