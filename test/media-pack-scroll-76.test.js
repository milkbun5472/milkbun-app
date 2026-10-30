const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
// 群里 2026-10-30：iOS 存完文字那份就以为存完了，图片包没存，换机后头像全没。
test("「图片第 N 包」冒出来时滚到眼前", () => {
  assert.match(c, /const mediaBoxRef = useRef\(null\)/);
  assert.match(c, /mediaBoxRef\.current\.scrollIntoView\(/);
  assert.match(c, /ref: mediaBoxRef/);
});
