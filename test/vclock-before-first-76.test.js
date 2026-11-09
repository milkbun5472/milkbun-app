const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
// 群里 2026-11-08：日记和情侣空间的「第一次」，10 月 24 号之前的日期全变成 24 号
const src = eng.slice(eng.indexOf("function vclockSeg("), eng.indexOf("function vclockNow("));
const vclockMapBy = new Function(src.replace(/function vclockMap\(ts, id\)[\s\S]*?\n\}\n/, "").replace(/function vclockRawCfg[\s\S]*?\n\}\n/, "").replace(/function vDate[^\n]*\n/, "").replace(/function vclockMainMap[\s\S]*?\n\}\n/, "") + "; return vclockMapBy;")();
test("钟头一次拨出来之前的事照现实；之后照钟", () => {
  const at = Date.parse("2026-10-24T12:00:00Z"), base = Date.parse("2026-10-24T08:00:00Z");
  const stopped = { on: true, base, at, speed: 0 };
  const before = Date.parse("2026-10-10T09:00:00Z");
  assert.equal(vclockMapBy(stopped, before), before, "开钟以前的日子不该被挤到钟上那一天");
  assert.equal(vclockMapBy(stopped, at + 3600e3), base, "开钟以后照钟（停着就停在那一刻）");
  // 拨过钟、最早那一版也有 at：早于最早那一版的照现实
  const rebased = { on: true, base: base + 86400e3, at: at + 86400e3, speed: 1, hist: [{ until: at + 86400e3, base, at, speed: 0 }] };
  assert.equal(vclockMapBy(rebased, before), before);
});
