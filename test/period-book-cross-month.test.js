const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("月事本的日子一排跨得了月：排到今天、开着的那轮从开始那天起、还能挑别的日子", () => {
  const book = comp.slice(comp.indexOf("function PeriodBook("), comp.indexOf("function PeriodBook(") + 12000);
  assert.ok(/const endD = pKeyDate\(daySel\) > today \? pKeyDate\(daySel\) : today;/.test(book));
  assert.ok(/if \(openP && pKeyDate\(openP\.start\) < from\) from = pKeyDate\(openP\.start\);/.test(book));
  assert.ok(/type: "date", value: key/.test(book), "还有一个挑别的日子的口子");
  assert.ok(!/for \(let i = 6; i >= 0; i--\) \{ const d = pKeyDate\(daySel\)/.test(book), "别又退回「选中那天往前七天」");
});
