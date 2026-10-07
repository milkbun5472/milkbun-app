const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/phone.js", "utf8");
test("同一部手机不许打架：别的 app 写定的事要对得上，人设最大", () => {
  const i = src.indexOf("function phoneAvoidBlock(");
  const seg = src.slice(i, src.indexOf("\n}", i));
  assert.match(seg, /【同一部手机 · 不许打架】/);
  assert.match(seg, /人设和记忆最大/);
  assert.match(seg, /以人设为准，那一条当没看见/);
});
