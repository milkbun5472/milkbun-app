const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
// 她 2026-10-06：「这个 toggle 一直很小」——长说明旁边被挤成一道缝，群友那台挤没了
test("公共开关不许被横排挤扁", () => {
  const i = comp.indexOf("function Toggle({"), j = comp.indexOf("function Slider({", i);
  assert.ok(i > 0 && j > i, "抠不出 Toggle");
  const seg = comp.slice(i, j);
  assert.match(seg, /flexShrink: 0/);
  assert.match(seg, /minWidth: 46/);
});
