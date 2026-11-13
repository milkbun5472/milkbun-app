// 她 2026-11-13 转来群里「今天秋秋机有一点卡」：开机 6 秒后的预热原来是两份并发、
// 每 150ms 接着下一份，一共八兆多，正好跟她当下那条回复抢带宽。
// 这一份钉住改法：慢网/省流量不预热；其余情况一次一份，每份之间等浏览器闲下来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(require("node:path").join(__dirname, "..", "js", "lazy-mods.js"), "utf8");
const warm = src.slice(src.indexOf("function warm()"), src.indexOf("function warm()") + 900);

test("慢网或开了省流量就不预热", () => {
  assert.match(warm, /navigator\.connection/, "没问网络状况");
  assert.match(warm, /saveData/, "没认省流量");
  assert.match(warm, /effectiveType/, "没认 2g/3g");
  assert.match(warm, /return;/, "认出来也没真的不下");
});

test("一次只下一份，每份之间等闲下来", () => {
  assert.match(warm, /requestIdleCallback/, "没等浏览器闲下来");
  assert.doesNotMatch(warm, /next\(\); next\(\);/, "还是两份一起下");
  assert.doesNotMatch(warm, /setTimeout\(next, 150\)/, "还在按固定 150ms 往下赶");
});

test("切到后台就停", () => assert.match(warm, /document\.hidden/, "后台也还在下"));
