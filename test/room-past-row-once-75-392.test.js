// 开房页「大概是什么时候」只出现一次（2026-10-11：合并时 pastRow() 被并成了两行，开房页出了两格）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "../js/components.js"), "utf8");
test("pastRow 在开房页只调用一次", () => {
  assert.equal((src.match(/\bpastRow\(\)/g) || []).length, 1);
});
