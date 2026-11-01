// 「[转账] 向你转账 88.80 元」写成字的，当真转一笔、字拿掉（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
const re = new RegExp(s.match(/const TF_TEXT = \/(.+)\/;/)[1]);
test("认得出这几种写法，正常说话不误伤", () => {
  assert.equal(re.exec("[转账] 向你转账 88.80 元")[1], "88.80");
  assert.equal(re.exec("【转账】转给你 100 元")[1], "100");
  assert.equal(re.exec("【转账】给你转了 ¥200")[1], "200");
  assert.equal(re.exec("给你转了 88 块拿去花"), null);
  assert.match(s, /if \(!\(parsed\.transfer && Number\(parsed\.transfer\.amount\) > 0\)\) parsed\.transfer = \{ amount: Number\(TF_TEXT\.exec\(words\[k\]\)\[1\]\), note: "" \};/);
});
