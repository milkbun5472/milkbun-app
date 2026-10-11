// 群里 2026-10-10：论坛面板美化落空（没钩子）；匿名马甲想自己填
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const s = src("screens.js"), c = src("components.js"), a = src("app.js"), ts = src("theme-studio.js");
test("论坛整页和几块面板都挂了钩子，清单里也登记了", () => {
  ["forumpage", "foboards", "forules", "fosort", "fonav", "fonavtab", "fopostpage", "fopostcard"].forEach(k => {
    assert.ok(s.includes('"data-wk": "' + k + '"'), "源码没挂 " + k);
    assert.ok(ts.includes('["' + k + '"'), "清单没登记 " + k);
  });
});
test("马甲能自己填：三处都接上，存进同一个 x_anonMe", () => {
  assert.match(c, /function AnonMaskFill\(/);
  assert.equal((c.match(/h\(AnonMaskFill, \{/g) || []).length, 2);
  assert.equal((a.match(/onSaveMask: saveAnonMe/g) || []).length, 3);
});
