const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
test("主题包／气泡导错东西时说人话：CSS、压缩包、网页各给一条出路", () => {
  const a = src.indexOf("  const whatIsThis = text => {"), b = src.indexOf("  const importPackage = async text => {");
  const f = new Function(src.slice(a, b) + ";return whatIsThis;")();
  assert.match(f("Page { color: red; }\n.bubble { background: #fff; }"), /这是一份 CSS[\s\S]*全局 CSS/);
  assert.match(f(":root{--a:1px;}"), /CSS/);
  assert.match(f("PK\u0003\u0004..."), /压缩包/);
  assert.match(f("<!doctype html><html>"), /网页/);
  assert.match(f(""), /空的/);
  assert.match(f("hello"), /只认/);
  assert.ok(/catch \(_\) \{ throw new Error\(whatIsThis\(text\)\); \}/.test(src), "importPackage 解析失败时走它");
});
