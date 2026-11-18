// 她 2026-11-18：从别的小手机搬记忆过来，「记忆日期怎么办」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), asst = R("js/assistant.js");
const i = app.indexOf("  const memDateLead = txt => {"), j = app.indexOf("\n  };", i);
const lead = new Function(app.slice(i, j + 5) + "\nreturn memDateLead;")();
test("行首日子拆出来当发生的时候", () => {
  const a = lead("2025-03-14｜第一次一起看海");
  assert.equal(a.text, "第一次一起看海"); assert.equal(new Date(a.ts).getFullYear(), 2025); assert.equal(new Date(a.ts).getDate(), 14);
  assert.equal(lead("2024年12月1日 吵了一架").text, "吵了一架");
  assert.equal(lead("2024/5/20 21:30：告白").text, "告白");
});
test("没日子、写错、将来的照旧按今天记", () => {
  assert.deepEqual(lead("喜欢吃辣"), { text: "喜欢吃辣", ts: 0 });
  assert.equal(lead("2025-13-40｜x").ts, 0);
  assert.equal(lead("2999-01-01｜x").ts, 0);
});
test("秋秋那一路：两处入口都走它，列表符号削掉但日子留着", () => {
  assert.equal((app.match(/const d = memDateLead\(txt\);/g) || []).length, 2);
  assert.match(asst, /最前面「YYYY-MM-DD｜」/);
  const strip = x => x.replace(/^\s*(?:[-·•]\s*|\d{1,3}[.、)）]\s*)/, "").trim();
  assert.equal(strip("1. 2025-03-14｜看海"), "2025-03-14｜看海");
  assert.equal(strip("- 2025-03-14｜看海"), "2025-03-14｜看海");
});
