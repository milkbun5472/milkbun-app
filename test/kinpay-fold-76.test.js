// 转账/红包的亲属卡收成一格（2026-11-02）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const a = src.indexOf("function KinPayPick("), b = src.slice(a, src.indexOf("function TransferComposeSheet(", a));
test("平时只有「我的钱包」「亲属卡 · N 张」，点开才列每张", () => {
  assert.match(b, /"亲属卡 · " \+ cards\.length \+ " 张 "/);
  assert.match(b, /open \? h\("div", \{ "data-wk": "kinpaylist"/);
});
