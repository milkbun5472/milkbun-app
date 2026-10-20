// 群友 2026-10-21：想让收款和转账长得不一样，CSS 分不出点没点收款——卡上把状态写出来。
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "../js/components.js"), "utf8");
test("转账卡带 data-status / data-receipt / data-me", () => {
  assert.match(c, /"data-wk": "transfercard",\n[^\n]*\n\s*"data-status": m\.status \|\| "pending", "data-receipt": m\.receiptCard \? "1" : "0", "data-me": isU \? "1" : "0",/);
});
