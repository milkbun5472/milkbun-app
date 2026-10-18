// 同人文调顺序（群里 2026-10-18）：长按挪位置，排过的记住，新的照旧在最上面，筛选时不让挪
const test = require("node:test"), assert = require("node:assert");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "fanfic.js"), "utf8");
test("长按出挪位置，排过的照排的、新的在上", () => {
  assert.match(src, /props\.onReorder\(\); \}, 520\)/);
  assert.match(src, /saveJSON\("x_ficOrder", n\)/);
  assert.match(src, /const fresh = list\.filter\(function \(f\) \{ return pos\[f\.id\] == null; \}\)/);
  assert.match(src, /list\.splice\(0, list\.length, \.\.\.fresh\.concat\(placed\)\)/);
  assert.match(src, /const canReorder = \(view === "shelf" \|\| view === "feed"\) && !kw && !tagFilter && !meOnly && !!orderKey;/);
  assert.match(src, /"移到最上面", "top"/);
});
