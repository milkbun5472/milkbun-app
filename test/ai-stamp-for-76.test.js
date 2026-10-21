// 给模型看的历史行盖不盖时刻、按谁的钟盖，只问 aiStampFor 一处（她 2026-10-21：单个角色的时间感知／虚拟钟有漏的）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), eng = R("engine.js");
test("aiStampFor：关着不盖，开着按这个人自己的钟盖", () => {
  assert.match(app, /const aiStampFor = \(id, ts\) => ts && timeAwareFor\(id\) && typeof fmtStampAI === "function" \? fmtStampAI\(ts, id\) : "";/);
  assert.match(eng, /function fmtStampAI\(ts, id\) \{\n  const d = new Date\(vclockMap\(ts, id\)\), now = vclockNow\(id\);/);
});
test("app.js 里不再有不问开关直接盖的时刻", () => {
  assert.ok(!/最近一次约在 " \+ new Date\(sharedUserTs\)/.test(app));
  assert.ok(!/（现在是 " \+ new Date\(\)\.toLocaleString/.test(app));
});
