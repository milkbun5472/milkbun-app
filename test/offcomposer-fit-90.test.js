// 只做了线上的美化，线下回复键不许被顶出屏幕（她 2026-11-26）
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
test("线下输入栏：输入框让位、回复键留在屏幕里", () => {
  assert.match(html, /html body \[data-wk="offcomposer"\] > textarea \{ flex: 1 1 0% !important; min-width: 0 !important; width: auto !important;/);
  assert.match(html, /html body \[data-wk="offcomposer"\] > \[data-wk="chatreply"\] \{ max-width: 64px !important; \}/);
});
