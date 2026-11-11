const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../" + f, "utf8");
test("长按能选字的正文：一条公共 CSS，日记和情书挂 data-copyable", () => {
  assert.match(R("index.html"), /\[data-copyable\], \[data-copyable\] \* \{ -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; \}/);
  const ui = R("js/screens-ui.js"), i = ui.indexOf("function DiaryEntryView(");
  assert.match(ui.slice(i, i + 4000), /"data-copyable": "1", className: "flex-1 min-h-0 overflow-y-auto px-7 pb-16"/);
  assert.match(R("js/components.js"), /"data-wk": "letterbody", "data-copyable": "1"/);
  assert.match(R("js/screens.js"), /"data-copyable": "1", style: \{ fontFamily: fc/);
});
