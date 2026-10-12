// 线下能给单个角色调正文字号（群友 2026-10-11）：存在这个人的线下设置里，只管这一场的正文和旁白
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("node:fs").readFileSync(require.resolve("../js/components.js"), "utf8");
test("设置里有正文字号，存进 fontSize；线下正文和旁白读 --off-fs", () => {
  assert.match(c, /customCSS: sCss, fontSize: sFont \}\)/);
  assert.match(c, /"data-wk": "offfontsize"/);
  assert.match(c, /"--off-fs": Number\(os\.fontSize\) \+ "px"/);
  assert.match(c, /"data-wk": "offtext", style: \{ fontFamily: F_BODY, fontSize: "var\(--off-fs, 14px\)"/);
  assert.match(c, /fontSize: "calc\(var\(--off-fs, 14px\) - 1px\)", letterSpacing: 1/, "长旁白没跟着正文字号");
});
