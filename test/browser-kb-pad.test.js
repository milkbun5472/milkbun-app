// Safari 浏览器里键盘压住聊天输入栏（群友 2026-10-11）：只在聊天页自己身上垫，根节点不动；主屏幕模式只在真被压住时才垫
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cmp = fs.readFileSync(require.resolve("../js/components.js"), "utf8");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
test("单聊、群聊两页都挂上；主屏幕模式也挂；垫的量＝聊天页底边超出可视区的那一截", () => {
  assert.equal((cmp.match(/const kbPadRef = useBrowserKbPad\(\);/g) || []).length, 3, "单聊、群聊、通话页");
  assert.equal((cmp.match(/ref: kbPadRef,/g) || []).length, 3);
  const f = cmp.slice(cmp.indexOf("function useBrowserKbPad()"), cmp.indexOf("// 全 App 共用的确认入口。"));
  assert.match(f, /if \(!vv\) return untint;/);   // 没有 visualViewport 也要把底色还原（2026-10-23 加了键盘底色）
  assert.match(f, /const untint = \(\) => under\.forEach/);
  assert.match(f, /document\.addEventListener\("focusin", onFocus\);/);
  assert.doesNotMatch(f, /standalone\) return/, "主屏幕模式也会被压住（她 2026-10-11），不能跳过");
  assert.match(f, /over > 0 \? over \+ "px" : ""/, "只在真的被压住时才垫");
  assert.match(f, /r\.bottom - \(vv\.offsetTop \+ vv\.height\)/);
  assert.match(f, /window\.innerHeight - vv\.height > KB_MIN_PX/);
});
test("根节点还是 100vh（home-screen-layout 那条）", () => {
  assert.match(app, /height: "100vh", \/\/ 100vh=large viewport/);
});
