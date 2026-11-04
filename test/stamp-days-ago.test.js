// 历史戳把隔了几天直接写出来，不让模型自己拿日期做减法（她 2026-11-04：五天前说成「前天」）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const body = src.slice(src.indexOf("function fmtStampAI("), src.indexOf("\n}\n", src.indexOf("function fmtStampAI(")) + 3);
const NOW = new Date(2026, 10, 4, 15, 0);
const fmtStampAI = new Function("vclockMap", "vclockNow", "fmtClock", body + "return fmtStampAI;")(
  t => t, () => NOW, d => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"));
test("今天/昨天/前天/几天前", () => {
  assert.equal(fmtStampAI(+new Date(2026, 10, 4, 9, 5)), "今天09:05");
  assert.equal(fmtStampAI(+new Date(2026, 10, 3, 23, 0)), "昨天23:00");
  assert.equal(fmtStampAI(+new Date(2026, 10, 2, 8, 0)), "前天08:00");
  assert.equal(fmtStampAI(+new Date(2026, 9, 30, 21, 5)), "10/30（周五，5天前）21:05");
});
