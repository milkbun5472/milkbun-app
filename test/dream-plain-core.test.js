// 梦境点破那几句（core/why）也说人话（她 2026-10-11）：只给判据不给例句，三处都接上
const test = require("node:test");
const assert = require("node:assert/strict");
const d = require("node:fs").readFileSync(require.resolve("../js/dream.js"), "utf8");
test("core 两处、why 一处都挂上 DREAM_PLAIN", () => {
  assert.match(d, /const DREAM_PLAIN = "说人话：/);
  assert.equal((d.match(/\+ DREAM_PLAIN/g) || []).length, 3);
});
