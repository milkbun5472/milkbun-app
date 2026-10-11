// 送的衣服挂进衣柜、聊天里叫他换上、拍照也是这身，状态卡「穿着」却没改（她 2026-10-11）：
// 衣柜里那件点开有「让他换上这一身」，直接写状态卡那一格（跟线下换衣服同一个 putLiveField）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const scr = fs.readFileSync(require.resolve("../js/screens.js"), "utf8");

test("换上写进状态卡的穿着，一路接到衣柜详情", () => {
  const seg = app.slice(app.indexOf("const wearFromCloset = "), app.indexOf("const closetGiftToChar = "));
  assert.match(seg, /putLiveField\(patch, live, "wearing", v, now\)/);
  assert.match(seg, /setStateFor\(charId,/);
  assert.match(seg, /nt !== "你送的"/, "来路那三个字不进穿着");
  assert.match(app, /onClosetGift: closetGiftToChar,\n    onWear: wearFromCloset/);
  assert.match(scr, /isCloth && onWear \? h\("button", \{ "data-wk": "carrysheetbtn", "data-part": "wear"/);
  assert.equal((scr.match(/onClosetGift, onWear/g) || []).length, 5);
});
