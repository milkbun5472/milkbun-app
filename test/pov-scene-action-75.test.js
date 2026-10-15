// TA 帮她拍：不掷机位，跟照片日记一样他自己定、池子只当灵感（她 2026-10-15：「应该像照相馆那样」）
const test = require("node:test");
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
test("pov 分支：不调 photoShotLine，动作照描述，池子用不用都行", () => {
  const i = eng.indexOf("else if (opts.pov) {"), seg = eng.slice(i, eng.indexOf("\n  else {", i));
  assert.ok(i > 0);
  assert.ok(!/photoShotLine\(/.test(seg));
  assert.ok(/他自己定/.test(seg) && /不另编动作/.test(seg) && /用不用都行/.test(seg));
});
