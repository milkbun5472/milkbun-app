// 2026-10-17 群友截图：查手机的浏览器、通话、小红书整页只剩一行「[object Object] 译」。
//   PTX（还有 STX）被包到了整页正文（一个元素）上，String() 一下就成了那行字。已经是元素/数组就原样放过。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const grab = (file, fn) => {
  const s = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
  const i = s.indexOf("function " + fn + "(v) {"), j = s.indexOf("\n}\n", i);
  return new Function("h", "TransText", s.slice(i, j + 2) + "\nreturn " + fn + ";")((c, p) => ({ c, p }), function TransText() {});
};
// 2026-10-18 起 PTX 跟着查手机页面那半在 phone-ui.js
["phone-ui.js:PTX", "screens.js:STX"].forEach(x => {
  const [f, fn] = x.split(":");
  test(fn + " 遇到元素／数组原样放过，字才包译", () => {
    const P = grab(f, fn);
    const el = { type: "div", props: {} }, arr = [el];
    assert.equal(P(el), el);
    assert.equal(P(arr), arr);
    assert.equal(P(""), "");
    assert.equal(P("hello").p.text, "hello");
  });
});
