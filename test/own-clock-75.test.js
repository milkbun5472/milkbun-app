// TA 自己一只钟（她 2026-10-16「单独暂停某个角色的时间过剧情」）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", f), "utf8");
const app = R("js/app.js"), eng = R("js/engine.js"), comp = R("js/components.js");
test("钟的键按时段认：开着那段走 c:角色id，关了照旧面具；旧消息按当时那只钟", () => {
  const i = app.indexOf("const clockKeyOf = (id, ts) =>"), j = app.indexOf("\n  };", i);
  const clockKeyOf = new Function("settingsFor", "maskKeyOf", "return " + app.slice(i + "const clockKeyOf = ".length, j + 4))(
    id => ({ ownClockSpans: id === "c1" ? [{ from: 100, until: 200 }, { from: 500, until: null }] : [] }), () => "m2");
  assert.equal(clockKeyOf("c1", 150), "c:c1");
  assert.equal(clockKeyOf("c1", 300), "m2");
  assert.equal(clockKeyOf("c1", 600), "c:c1");
  assert.equal(clockKeyOf("c2", 150), "m2");
  assert.equal(clockKeyOf("g:x", 150), "m2");
});
test("接线：引擎按消息时间问键；悬浮球拨的是这只；设置里有开关、存 spans", () => {
  assert.ok(/W\.maskOf\(String\(who\), ts\)/.test(eng) && /const c0 = vclockCfg\(id, ts\)/.test(eng));
  assert.ok(/maskOf: clockKeyOf \}/.test(app));
  assert.equal((app.match(/activeChar && clockKeyOf\(activeChar\.id\)\) \|\| "main"/g) || []).length, 2);
  assert.ok(/ownClockSpans: ownClockSpansNext\(activeChar\.id, s\.ownClock\)/.test(app));
  assert.ok(/"data-wk": "ownclock"/.test(comp) && /ownClock,\n/.test(comp));
});
