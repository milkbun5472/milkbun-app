const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const a = fs.readFileSync(__dirname + "/../js/assistant.js", "utf8");
test("秋秋的快照里有每个人线下那层的 CSS（她 2026-10-26）", () => {
  assert.match(a, /offAll = loadJ\("x_offlineSettings", \{\}\) \|\| \{\};/);
  assert.match(a, /row\.线下CSS = os\.customCSS \? clipRaw\(os\.customCSS, 3000\) : "（空）";/);
});
