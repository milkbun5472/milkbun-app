import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
const i = s.indexOf("const CTX_TAG_ECHO_RE"), j = s.indexOf("\n}\n", i);
const stripCtxTagEcho = new Function(s.slice(i, j + 2) + "\nreturn stripCtxTagEcho;")();
test("回话里抄进来的外卖标签摘掉", () => {
  assert.equal(stripCtxTagEcho("热乎的垫垫肚子 [你给 Lisa 点了外卖：「La Belle Baguette」的热黑巧可可（热）、热烤芝士牛肉可颂（你在单子上写给 Ta 的那句：「趁热喝了」）（还没送到，骑手在路上）]"), "热乎的垫垫肚子");
  assert.equal(stripCtxTagEcho("拿到了 [Lisa 给你点了外卖：奶茶] 谢啦"), "拿到了 谢啦");
});
test("别的方括号不碰；整条只剩标签就原样留着", () => {
  assert.equal(stripCtxTagEcho("我在 [看书] 呢"), "我在 [看书] 呢");
  assert.equal(stripCtxTagEcho("[Lisa 给你点了外卖：奶茶]"), "[Lisa 给你点了外卖：奶茶]");
});
test("showClean 接上了", () => { assert.match(s, /if \(s\.indexOf\("\["\) >= 0\) s = stripCtxTagEcho\(s\);/); });
