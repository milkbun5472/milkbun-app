// 群里 2026-11-19：「虚拟时间聊天记录又全都变成现实时间了」「记忆库里的事被说成 11 月」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const s = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");
const grab = name => { const i = s.indexOf("function " + name + "("); let d = 0, j = s.indexOf("{", i); for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; } return s.slice(i, j + 1); };
const cap = s.match(/const VCLOCK_HIST_CAP = \d+;/)[0];
const F = new Function(cap + grab("vclockTrimHist") + grab("vclockSeg") + grab("vclockMapBy") + "return { vclockTrimHist, vclockMapBy };")();
test("历史段超了也留着最早那一段", () => {
  const a = Array.from({ length: 2100 }, (_, i) => ({ until: i + 1, base: i, at: i, speed: 1 }));
  const t = F.vclockTrimHist(a);
  assert.equal(t.length, 2000);
  assert.equal(t[0], a[0]);
  assert.equal(t[t.length - 1], a[a.length - 1]);
  assert.doesNotMatch(s, /\]\.slice\(-300\) \}/);
});
test("旧版丢过最早几段（攒满 300）的钟：比现存最早那段还早的消息照那一版往前推，不跳回现实", () => {
  const DAY = 864e5, real0 = Date.UTC(2026, 10, 10), virt0 = Date.UTC(2026, 9, 1);
  const hist = Array.from({ length: 300 }, (_, i) => ({ until: real0 + (i + 1) * 60000, base: virt0 + i * 60000, at: real0 + i * 60000, speed: 1 }));
  const c = { on: true, base: virt0 + 300 * 60000, at: real0 + 300 * 60000, speed: 1, hist };
  const v = F.vclockMapBy(c, real0 - 3 * DAY);
  assert.ok(v < real0 - 20 * DAY, "该落在十月那一侧，不是现实的十一月");
});
