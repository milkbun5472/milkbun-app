const test = require("node:test"); const assert = require("node:assert");
const src = (require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8") + "\n" + require("fs").readFileSync(__dirname + "/../js/screens-ui.js", "utf8"));
// 2026-10-18 起 MyCloset 在 screens-ui.js、PhotoStudio 留在 screens.js：切到下一个顶格声明为止
const _i = src.indexOf("function MyCloset("), _k = src.slice(_i + 1).search(/\n(?:async function |function |const |let )/);
const body = src.slice(_i, _k < 0 ? src.length : _i + 1 + _k);
test("衣柜关键词输入框可以收窄，不把整页撑出屏幕", () => {
  assert.match(body, /closetgeninput[\s\S]{0,200}flex-1 min-w-0/);
  assert.match(body, /closetscroll", className: "[^"]*overflow-x-hidden/);
});
