// 她 2026-11-23：停住的钟开着「离开时停住」一天记上百段，几天就攒满——算出来一样的段合成一段
const test = require("node:test"), assert = require("assert"), fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const grab = n => { const i = s.indexOf("function " + n + "("); let d = 0, j = s.indexOf("{", i); for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; } return s.slice(i, j + 1); };
const X = new Function("const VCLOCK_HIST_CAP=2000;" + grab("vclockSameSeg") + grab("vclockTrimHist") + grab("vclockMapBy") + grab("vclockSeg") + "return {vclockTrimHist, vclockMapBy};")();
test("停住的钟 base 没变的那些段并掉，第一段不动，时间一样", () => {
  const h = [{ until: 100, base: 5000, at: 50, speed: 1 }];
  for (let i = 1; i < 400; i++) h.push({ until: 100 + i * 10, base: 9000, at: 100 + i * 10 - 10, speed: 0, ...(i % 2 ? { awayAt: 100 + i * 10 - 5 } : {}) });
  const m = X.vclockTrimHist(h);
  assert.ok(m.length <= 3, "并掉了：" + m.length);
  assert.equal(m[0].base, 5000);
  assert.ok(m[0].cut, "原来攒过 300 段的记号还在");
  const c0 = { on: true, base: 9000, at: 5000, speed: 0 };
  for (let ts = 60; ts < 4200; ts += 37) assert.equal(X.vclockMapBy({ ...c0, hist: m }, ts), X.vclockMapBy({ ...c0, hist: h }, ts), "ts " + ts);
});
test("走着的钟只换了速度、或拨过的，不并", () => {
  const h = [{ until: 10, base: 0, at: 0, speed: 1 }, { until: 20, base: 100, at: 10, speed: 1 }, { until: 30, base: 200, at: 20, speed: 2 }, { until: 40, base: 300, at: 30, speed: 2 }];
  assert.equal(X.vclockTrimHist(h).length, 4);
});
