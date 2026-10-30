const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("夹在一行里的译文（线下台词）接在原文后面，不另起一块盖住后面的字", () => {
  // 2026-10-30 后面又加了 langHint：只认 inline 有没有传进 TransTextState，不钉整串参数（anchor-on-code）
  assert.match(c, /h\(TransTextState, \{[^\n]*\binline\b[^\n]*\}\);/);
  assert.match(c, /open && inline && h\("span", \{ "data-wk": "translatebody", "data-part": "inline"/);
  assert.match(c, /open && !inline && h\("span", \{ "data-wk": "translatebody", style: \{ display: "block"/);
});
