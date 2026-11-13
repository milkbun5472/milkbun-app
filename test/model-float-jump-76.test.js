const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const A = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), U = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("切线路悬浮面板能直接跳进 设置 → 模，返回回到原处", () => {
  assert.match(A, /onOpenApi: \(\) => \{ setConfigBack\(\{ screen \}\); setConfigPage\("api"\); setScreen\("config"\); \}/);
  assert.match(A, /returnTo: configBack \?/); assert.match(A, /"data-wk": "modelfloatapi"/);
  assert.match(U, /\(props\.returnTo && page === "api"\) \? props\.returnTo/);
});
