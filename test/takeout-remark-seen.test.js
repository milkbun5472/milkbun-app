// 给角色点的外卖：送到后 TA 看得见小票上给商家的备注（2026-10-31）
require("node:test")("外卖送到才带上备注，在路上不带", () => {
  const assert = require("node:assert/strict");
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /: "（已经送到你手上了）"\n\s*\/\/[^\n]*\n\s*\+ \(\(m\.takeout && m\.takeout\.remark\) \? "（袋子上的小票印着她给商家的备注：「" \+ m\.takeout\.remark \+ "」）" : ""\)\) \+ "\]"/);
});
