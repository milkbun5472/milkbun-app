const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("合照说清谁拿手机：默认是 TA 自己举的，场景写明了别人拍就照场景", () => {
  const i = eng.indexOf('} else if (kind === "duo") {');
  const seg = eng.slice(i, i + 2400);
  assert.ok(seg.includes("【谁拿着手机】"));
  assert.ok(seg.includes("自己伸手举着手机拍的"));
});
