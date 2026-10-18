// 网易云接口内置教程（她 2026-10-14）：没接口或正在改时挂在「配网易云搜索接口」底下
const test = require("node:test");
const assert = require("node:assert");
const scr = (require("fs").readFileSync(require("path").join(__dirname, "../js/screens.js"), "utf8") + "\n" + require("fs").readFileSync(require("path").join(__dirname, "../js/screens-ui.js"), "utf8"));
test("教程在，挂在接口那一格底下", () => {
  assert.match(scr, /function NeteaseApiHelp\(\{ toast \}\)/);
  assert.match(scr, /\(!apiBase \|\| apiEdit\) \? h\(NeteaseApiHelp,/);
  assert.match(scr, /接口空着，Cookie 填了也只能听 30 秒试听，「扫码登录」也不会出来/);
});
