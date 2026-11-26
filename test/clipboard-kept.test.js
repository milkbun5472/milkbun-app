const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const P = require("../js/phone.js");
const NOW = Date.now();
// 群友 2026-11-26「剪贴板有一条特别喜欢的，还没翻过去就被挤没了」：点了「留着」的那条，上限满了也不挤掉
test("剪贴板留着的那条刷新挤不掉", () => {
  const old = { items: [{ text: "最喜欢的这一句", time: "周一", sent: false, kept: true }].concat(Array.from({ length: 23 }, (_, i) => ({ text: "旧的" + i, time: "周二", sent: true }))) };
  const fresh = { items: Array.from({ length: 24 }, (_, i) => ({ text: "新的" + i, time: "今天", sent: true })) };
  const out = P.phoneGrowMerge("clipboard", old, fresh, NOW);
  const fav = out.items.filter(x => x.text === "最喜欢的这一句");
  assert.equal(fav.length, 1, "留着的那条被挤掉了，或者重复了");
  assert.equal(fav[0].kept, true);
  assert.ok(!out.items.some(x => x.text === "旧的0"), "没留着的照常按上限挤");
});
test("剪贴板页有「留着」，写回走 onClipEdit", () => {
  const ui = fs.readFileSync(path.join(__dirname, "..", "js", "phone-ui.js"), "utf8"), app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(ui, /"data-wk": "pclipkeep"/);
  assert.match(ui, /onItemsEdit: ctx\.onClipEdit/);
  assert.match(app, /onClipEdit: \(char, items\) => \{[\s\S]{0,200}savePhoneApp\(char\.id, "clipboard"/);
});
