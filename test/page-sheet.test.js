const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const comp = R("components.js"), scr = R("screens.js"), memo = R("memo.js");
test("PageSheet：整页外壳，用法跟 Sheet 一样", () => {
  assert.match(comp, /function PageSheet\(\{ children, onClose, zh, sub, right, scrollKey, skin \}\)/);
  assert.match(comp, /return ReactDOM\.createPortal\(h\("div", \{ "data-wk": "pagesheet"/);
});
test("第一档那几处已经是整页", () => {
  assert.match(comp, /recallView && h\(PageSheet/);
  assert.match(comp, /peekOpen && h\(PageSheet/);
  assert.match(comp, /function CallLogSheet[\s\S]{0,4000}h\(PageSheet/);
  assert.match(scr, /function MemCfgSheet[\s\S]{0,6000}h\(PageSheet/);
  assert.equal((memo.match(/h\(PageSheet, \{/g) || []).length, 4);
});
