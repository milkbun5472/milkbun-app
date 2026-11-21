// 反查手机·她自己的朋友圈：只设了「不给 TA 看」（hiddenFrom）、没设「只给谁看」时，visibleTo 是空的，
// 拼名字不许直接 vis.map —— 群友 2026-11-20 翻手机报 Cannot read properties of null (reading 'map')。
const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("hidFromYou 时 vis 为空也不崩", () => {
  const i = src.indexOf("const hidFromYou"); assert.ok(i > 0);
  const seg = src.slice(i, i + 800);
  assert.ok(/hidFromYou \? \(vis \?/.test(seg), "拼名单前先判 vis");
  assert.ok(seg.includes("不给你看"));
});
