// 秋秋：「底部不贴边」是底栏没铺到底，别写 transparent、别去刷 body（群里 2026-10-19）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "../js/assistant.js"), "utf8");
test("CSS 规矩里有底栏铺到底那一条", () => {
  assert.match(s, /底部不贴边／最底下多一条颜色／底栏下面露一截/);
  assert.match(s, /padding-bottom: var\(--app-safe-bottom\) !important，一路铺到底/);
});
