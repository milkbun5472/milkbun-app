// 她 2026-11-18：「群聊一轮每个人好几个动描，这套能不能搬到单聊上」「两行够吗」「开关默认开」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), eng = R("js/engine.js"), comp = R("js/components.js"), ts = R("js/theme-studio.js");

test("单聊 word 里的 {act} 留占位、就地摆一行，一轮至多三行、没变不摆", () => {
  assert.match(eng, /const ACT_SLOT_TOKEN = n => "actslot" \+ n;/);
  assert.match(eng, /const ACT_LINES_PER_TURN = 3;/);
  assert.match(app, /_actDesc && _s\.actMid !== false \? "\\n\\n" \+ ACT_MID_RULE/);
  assert.match(app, /_n < ACT_LINES_PER_TURN && !sameActLine\(_line, _prev\)/);
  assert.match(app, /actMid: s\.actMid !== false/, "默认开");
  assert.match(comp, /useState\(settings\.actMid !== false\)/);
  assert.match(ts, /\["actmid", /);
});

test("占位符认法：前后带标点也认，普通话不认", () => {
  const ctx = {};
  new Function("ctx", eng.match(/const ACT_SLOT_RE = [^\n]+\n/)[0] + eng.match(/function actSlotOf\(w\) \{[^\n]+\n/)[0] + "ctx.f = actSlotOf;")(ctx);
  assert.equal(ctx.f("actslot1"), 1);
  assert.equal(ctx.f(" actslot0。"), 0);
  assert.equal(ctx.f("我在 actslot0 这儿"), null);
});

test("截断兜底那条路也不把 {act} 吞掉", () => {
  assert.match(eng, /typeof x\.act === "string"\) \|\| !takeObj\(x\)/);
});
