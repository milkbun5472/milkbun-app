// 她 2026-10-06 截图：关系页点「按条看 · 改配角简介」整页崩（React #300：hook 数变了）。
// Ties 里「按条看」那一页提前 return，它后面不许再有任何 useXxx。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
test("Ties 提前 return 之后没有 hook", () => {
  const i = S.indexOf("function Ties({");
  const j = S.indexOf("\nfunction ", i + 10);
  const body = S.slice(i, j);
  const k = body.indexOf("  if (view !== null) {");
  assert.ok(k > 0);
  assert.equal(/\buse(State|Effect|Memo|Ref|Callback|LayoutEffect)\(/.test(body.slice(k)), false);
});
