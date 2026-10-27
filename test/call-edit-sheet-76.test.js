const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const c = fs.readFileSync("js/components.js", "utf8");
test("通话里的编辑框铺满通话页（Sheet 是 absolute inset-0，外层不能是 0 高的盒子）", () => {
  assert.match(c, /callEdit != null && list\[callEdit\] \? h\("div", \{ "data-wk": "calledit", style: \{ position: "absolute", inset: 0, zIndex: 90 \} \}, h\(MsgEditSheet/);
});
