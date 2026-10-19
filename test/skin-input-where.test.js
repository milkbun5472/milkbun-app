// 聊天皮肤的输入框规则套 :where()，她写的 [data-wk="chatinput"] 才压得过（群里 2026-10-19）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "../js/theme-studio.js"), "utf8");
test("皮肤里不再有比 chatinput 更具体的输入框选择器", () => {
  assert.doesNotMatch(s, /'\[data-wk="composer"\] textarea/);
  assert.doesNotMatch(s, /\\n\[data-wk="composer"\] textarea/);
  assert.match(s, /:where\(\[data-wk="composer"\] input, \[data-wk="composer"\] textarea\) \{/);
  assert.match(s, /:where\(\[data-wk="composer"\] input, \[data-wk="composer"\] textarea\)::placeholder \{/);
});
