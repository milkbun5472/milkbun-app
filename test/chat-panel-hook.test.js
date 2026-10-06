const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
// 群友 2026-10-06：「加号面板的整个面板底色是没办法改变的吗」
test("＋面板整块有挂点，单聊群聊都挂，秋秋名单里有", () => {
  assert.equal((comp.match(/"data-wk": "chatpanel",\n\s*className: "shrink-0 grid grid-cols-4/g) || []).length, 2);
  assert.ok(ts.includes('["chatpanel"'));
});
