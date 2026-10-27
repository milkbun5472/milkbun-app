const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("API 页能测一下当前填的模型（群友 2026-10-27）", () => {
  assert.match(ui, /const testCur = async \(\) => \{/);
  assert.match(ui, /await callAI\(cur, "这是一次连通测试。只回一个字：好", \[\{ role: "user", content: "测试" \}\], \{ maxTokens: 8000/);
  assert.match(ui, /"data-wk": "apitest"/);
  assert.match(ui, /"测一下这个模型"/);
});
