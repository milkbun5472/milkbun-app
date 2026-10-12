// 设了日语还会整泡改说中文（群友 2026-10-12）：双语规矩原来一句「说中文的那些条照常写」等于给了出口；
//   她用中文说话、上下文全是中文，模型就顺着滑过去。两处都要说清：对方说中文不是改说中文的理由。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8");
test("常用语言那一行说清：她说中文不是改说中文的理由", () => {
  assert.match(src, /都不是改说中文的理由，每一条说出口的话照样是" \+ l/);
});
test("双语规矩不再无条件放行中文条", () => {
  assert.match(src, /TA 真说中文的那些条（人设里写了 TA 会说中文的时候）/);
  assert.match(src, /对方用中文跟 TA 说话，不是 TA 改说中文的理由/);
});
