const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/phone.js");
// 群友 2026-11-26「剪贴板有一条特别喜欢的，还没翻过去就被挤没了」：不加新键，就多存点
test("剪贴板多存：刷好几次以前的还在", () => {
  assert.ok(P.PHONE_GROW.clipboard.items >= 80);
  let d = { items: [{ text: "最喜欢的这一句", time: "周一", sent: false }] };
  for (let r = 0; r < 8; r++) d = P.phoneGrowMerge("clipboard", d, { items: Array.from({ length: 7 }, (_, i) => ({ text: "第" + r + "轮" + i, time: "今天", sent: true })) }, Date.now());
  assert.ok(d.items.some(x => x.text === "最喜欢的这一句"), "刷八次就被挤掉了");
});
