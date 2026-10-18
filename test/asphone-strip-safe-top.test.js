// 她 2026-10-13：查手机进购物/外卖，顶上那条「正在用他的手机」压着，下面的搜索栏又吃一遍安全区——顶栏太高
const test = require("node:test");
const assert = require("node:assert/strict");
const s = (require("fs").readFileSync(require("path").join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + require("fs").readFileSync(require("path").join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
test("查手机时安全区只吃一遍：横条吃，搜索栏不再吃", () => {
  assert.equal((s.match(/"data-wk": "asphonestrip", className: "shrink-0", style: \{ padding: "7px 14px", paddingTop: safeTop\(7\)/g) || []).length, 2);
  assert.match(s, /paddingTop: underStrip \? 10 : safeTop\(14\)/);
  assert.equal((s.match(/underStrip: !!payAs/g) || []).length, 2);
});
