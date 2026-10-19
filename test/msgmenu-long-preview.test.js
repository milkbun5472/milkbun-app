// 她 2026-10-20：长按一大段长回复，预览把菜单盖住，删不掉。截短放在不挂 bubble 的里层，菜单压在上面。
const test = require("node:test");
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "../js/components.js"), "utf8");
test("长按预览里层自己截短，菜单 zIndex 在上", () => {
  const i = c.indexOf("function MsgMenu("), seg = c.slice(i, i + 4000);
  assert.match(seg, /h\("div", \{ style: \{ maxHeight: 72, overflow: "hidden"[^}]*WebkitLineClamp: 4/);
  assert.match(seg, /position: "relative", zIndex: 2, background: "rgba\(255,255,255,0\.96\)"/);
});
