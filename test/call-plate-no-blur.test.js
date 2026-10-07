const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("视频顶上那块只压渐变，不再毛玻璃", () => {
  const i = src.indexOf("const litPlate = (from, to) =>");
  const seg = src.slice(i, src.indexOf("} : null;", i));
  assert.doesNotMatch(seg, /backdropFilter/);
  assert.match(seg, /linear-gradient\(180deg/);
});
test("单人视频：聊天那块不给右上小框让位，她的气泡贴右边", () => {
  assert.doesNotMatch(src, /style: pip \? \{ paddingRight: 120 \} : undefined/);
});
test("通话页 fixed 铺满整屏，状态栏那截也是画面", () => {
  assert.match(src, /className: "fixed inset-0 z-\[70\] flex flex-col",/);
});
