const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), scr = (fs.readFileSync(__dirname + "/../js/screens.js", "utf8") + "\n" + fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8"));
const i = app.indexOf("const cleanDrawSvg"), clean = new Function(app.slice(i, app.indexOf("  };", i) + 4) + ";return cleanDrawSvg;")();
test("抽屉里TA画的：SVG 洗干净再存，当图片挂", () => {
  const out = clean('<svg viewBox="0 0 300 300"><script>x()</script><path onload="y()" d="M0 0"/><image href="http://e"/></svg>');
  assert.doesNotMatch(out, /script|onload|http:\/\/e/);
  assert.match(out, /^<svg xmlns=/);
  assert.equal(clean("没有画"), "");
  assert.match(app, /kind === "draw" && cleanDrawSvg\(d && d\.svg\) \? \{ svg: cleanDrawSvg\(d\.svg\) \} : \{\}/);
  assert.match(scr, /x\.kind === "draw" && x\.svg \? h\("img", \{ "data-wk": "drawerdrawing", alt: "", src: "data:image\/svg\+xml;charset=utf-8," \+ encodeURIComponent\(x\.svg\)/);
});
