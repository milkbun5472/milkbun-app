const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const c = fs.readFileSync("js/components.js", "utf8"), ts = fs.readFileSync("js/theme-studio.js", "utf8");
test("弹窗有专属挂点，原来的 block 名字不动", () => {
  assert.match(c, /"data-wk": "dialogmask", "data-part": kind \|\| undefined/);
  assert.equal((c.match(/"data-wk": "block", "data-part": "dialog"/g) || []).length, 2);
  assert.equal((c.match(/"data-wk": "block", "data-part": "dialogok"/g) || []).length, 2);
  assert.equal((c.match(/"data-wk": "dialogtitle"/g) || []).length, 2);
  assert.equal((c.match(/"data-wk": "dialogcancel"/g) || []).length, 2);
  assert.match(c, /onCancel, "prompt"\);/); assert.match(c, /onCancel, "confirm"\);/);
  assert.match(ts, /\["dialogmask", "屏幕正中那种弹窗后面的遮罩/);
});
