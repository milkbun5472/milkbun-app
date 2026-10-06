// 她 2026-10-06：通话背景整张发灰 → 只在字底下压暗，两处背景用同一道渐变。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("通话背景不再整张压黑", () => {
  assert.ok(!c.includes("linear-gradient(rgba(0,0,0,.38),rgba(0,0,0,.58))"));
  assert.ok(!c.includes("rgba(10,10,12,.58) 0,rgba(10,10,12,.42) 30%"));
  assert.equal((c.match(/CALL_BG_SHADE/g) || []).length >= 3, true);
  assert.match(c, /rgba\(0,0,0,0\) 16%,rgba\(0,0,0,0\) 42%/);
});
