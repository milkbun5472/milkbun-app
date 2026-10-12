const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
const a = src.indexOf("function MsgMenu("), body = src.slice(a, src.indexOf("\n}\n", a));
test("长按菜单铺满整屏、不靠外层的框和百分比、不用毛玻璃", () => {
  assert.match(body, /position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh"/);
  assert.match(body, /width: "min\(268px, 74vw\)"/);
  assert.doesNotMatch(body, /backdropFilter|w-\[74%\]|absolute inset-0/);
});
