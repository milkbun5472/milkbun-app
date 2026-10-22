// 她 2026-10-22「这个别xxx好烦」：角色卡准则里「嘴硬的人凶是壳」把答案（凶）给死了，模型最顺手的凶就是「别xxx」
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
test("嘴硬那句只说硬在态度上，用哪句话照TA自己", () => {
  assert.ok(!eng.includes("凶是壳"));
  assert.ok(eng.includes("用哪句话硬，照TA自己平时说话的样子，换个人就不会是这一句。"));
});
