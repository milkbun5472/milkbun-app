// 表情包页有「打字时联想表情包」开关，默认开；关了输入框不冒那一排（她 2026-11-04）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
test("开关存 x_emoteSuggestOff，默认开", () => {
  const u = R("screens-ui.js");
  assert.match(u, /useState\(\(\) => !loadJSON\("x_emoteSuggestOff", false\)\)/);
  assert.match(u, /saveJSON\("x_emoteSuggestOff", !on\)/);
});
test("输入框读这个开关", () => {
  assert.match(R("components.js"), /if \(!draft\.trim\(\) \|\| loadJSON\("x_emoteSuggestOff", false\)\) \{/);
});
test("挂点登记了", () => {
  const ts = R("theme-studio.js");
  assert.match(ts, /"emosuggestrow"/); assert.match(ts, /"emosuggesttoggle"/);
});
