const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/nest.js", "utf8");
test("门的名单：按状态筛、按时间排，参数都带进请求", () => {
  assert.ok(/"&st=" \+ fst \+ "&sort=" \+ sort/.test(src));
  assert.ok(/\[q, fst, sort\]/.test(src));
  for (const k of ["已停用", "等通过", "最近打开的在前", "最久没打开的在前"]) assert.ok(src.includes(k), k);
});
