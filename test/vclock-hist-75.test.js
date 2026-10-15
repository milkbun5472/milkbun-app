// 群友 2026-10-14：9点、9点10、9点30写的三轮，拨过钟以后前两轮都显示成9点30——旧消息要照当时那一版钟算
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
const pick = name => src.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n}\\n"))[0];
const g = {}; global.window = g;
eval(pick("vclockState") + pick("vclockCfg") + pick("vclockSeg") + pick("vclockKeepHist") + pick("vclockMap") + "global.M=vclockMap; global.K=vclockKeepHist;");
const H = 3600e3, T0 = 1e12, NINE = 9 * H;
let c = { on: true, base: NINE, at: T0, speed: 1 };                     // 现实 T0 时虚拟 9:00
g.__vclock = { clocks: { main: c } };
const msgA = T0 + 60e3;                                                   // 虚拟 9:01
const before = M(msgA);
// 两分钟后她把钟拨到 9:30
const now = T0 + 120e3;
const next = K({ main: c }, { main: { on: true, base: NINE + 30 * 60e3, at: now, speed: 1 } }, now);
g.__vclock = { clocks: next };
assert.equal(M(msgA), before, "旧消息还是当时那个时间");
assert.equal(M(now + 60e3), NINE + 31 * 60e3, "新消息照新的钟");
assert.match(src, /const c = vclockSeg\(c0, ts\);/);
console.log("ok");
