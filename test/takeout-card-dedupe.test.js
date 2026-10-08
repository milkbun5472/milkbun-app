const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("TA照着卡又点一遍同一单：卡不重复发，钱不扣两次", () => {
  const i = app.indexOf("const postCharTakeout = (charId, raw) => {");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  const a = seg.indexOf("if (sameCard) return true;"), b = seg.indexOf("walletSpend(");
  assert.ok(a > 0 && b > a, "得先查卡再扣钱");
});
