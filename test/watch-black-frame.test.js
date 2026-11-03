// 一起看：本地片子截出来一片黑（群友 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/watch.js", "utf8");
test("截帧认得出一片黑，重画一次还黑就换成「发张截图给 TA」", () => {
  assert.match(src, /if \(n && lit \/ n < 0\.02\) return "black";/);
  assert.match(src, /requestVideoFrameCallback\(go\)/);
  assert.match(src, /if \(full === "black"\) \{ setFrameBlack\(true\);/);
  assert.match(src, /online \|\| frameBlack\n\s+\? btn\("发张截图给 TA"/);
  assert.match(src, /h\("input", \{ key: "pic", ref: picRef[^\n]+\),\n/);
});
