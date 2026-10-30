// 外卖预约送达（2026-10-30 群里许愿）：结算页挑几点到，订单和给TA的那张卡都照这个点
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
test("结算页有「什么时候送到」，下单带上 at", () => {
  assert.match(ui, /sectionLabel\("什么时候送到"\)/);
  assert.match(ui, /note: mode === "forchar" \? say : "", at \}, mode, target/);
  assert.match(ui, /type: "time"/);
});
test("下单照 at 定送达；代付、亲属卡的订单也带上", () => {
  assert.match(app, /if \(_at > Date\.now\(\) \+ 10 \* 60000\) \{ item\.arriveTs = _at; item\.booked = true; \}/);
  assert.match(app, /const _arr = item\.arriveTs \|\| \(now \+ deliverMsForCat\("food", item\.name\)\)/);
  assert.match(app, /takeout: it\.takeout, \.\.\.\(it\.arriveTs \? \{ arriveTs: it\.arriveTs \} : \{\}\)/);
});
