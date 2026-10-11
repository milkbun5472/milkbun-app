// 直播礼物栏能「不送了」（她 2026-10-11：点了礼物没办法返回取消送）
const test = require("node:test");
const assert = require("node:assert/strict");
const s = require("node:fs").readFileSync(require.resolve("../js/live.js"), "utf8");
test("礼物栏自己带一颗不送了，点了收起面板", () => {
  assert.match(s, /function GiftPanel\(\{ custom, busy, onSend, onSaveCustom, onDropCustom, onClose \}\)/);
  assert.match(s, /"data-wk": "livegiftcancel", onClick: onClose/);
  assert.match(s, /onClose: \(\) => setGiftOpen\(false\) \}\)/);
});
test("看自己的角色播：收尾一段「开口的是谁」，路人主播不加", () => {
  assert.match(s, /function watchInstruction\(ses, uName, first, own\)/);
  assert.match(s, /【开口的是谁】/);
  assert.match(s, /\+ \(own \? who2 : ""\);/);
  assert.match(s, /props\.probeAs\(char, watchInstruction\(ses, ses\.meName \|\| uName, first, true\)/);
});
