const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/screens.js", "utf8");
const body = src.slice(src.indexOf("function MyCloset("), src.indexOf("function PhotoStudio("));
test("衣柜关键词输入框可以收窄，不把整页撑出屏幕", () => {
  assert.match(body, /closetgeninput[\s\S]{0,200}flex-1 min-w-0/);
  assert.match(body, /closetscroll", className: "[^"]*overflow-x-hidden/);
});
