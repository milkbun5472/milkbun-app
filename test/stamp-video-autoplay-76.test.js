const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
test("卡面视频挂上就补静音、自己 play()：iPhone 不靠 autoPlay", () => {
  assert.match(src, /const kickVid = v => \{ if \(!v\) return; v\.muted = true; v\.defaultMuted = true;/);
  assert.match(src, /const loopVid = \(url, extra\) => h\("video", \{ ref: kickVid,/);
});
