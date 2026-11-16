// 画图编辑器挂到 body：美化给照片卡写 transform 时，fixed 不能被困在卡片里（她 2026-11-16 粉色日记）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("DoodleEditor 用 createPortal 挂到 document.body", () => {
  const i = src.indexOf("function DoodleEditor");
  assert.ok(i > 0);
  const body = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(body, /ReactDOM\.createPortal\(h\("div", \{ "data-wk": "doodle"/);
  assert.match(body, /\), document\.body\);\s*$/);
});
