const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("我存的美化：两列小格、八套以上能搜、删收进管理", () => {
  assert.match(c, /const \[shelfQ, setShelfQ\] = useState\(""\), \[shelfEdit, setShelfEdit\] = useState\(false\);/);
  assert.match(c, /gridTemplateColumns: "repeat\(2, minmax\(0, 1fr\)\)"/);
  assert.match(c, /\(shelf\.length > 8 && \(shelfOpen \|\| shelfEdit\)\) \? h\("input"/);
  assert.match(c, /\.slice\(0, \(shelfOpen \|\| shelfEdit \|\| shelfQ\.trim\(\)\) \? undefined : SHELF_PEEK\)/);
  assert.match(c, /onClick: \(\) => shelfEdit \? dropOne\(it\) : useOne\(it\)/);
});
test("文件夹：每套记 folder，顶上一排夹子筛着看，管理里挪夹子", () => {
  assert.match(c, /const moveTo = \(id, folder\) => \{ saveJSON\("x_chatLooks", chatLookShelf\(\)\.map\(x => x\.id === id \? Object\.assign\(\{\}, x, \{ folder:/);
  assert.match(c, /"data-wk": "lookshelfdirs"/);
  assert.match(c, /"data-wk": "lookshelfmove"/);
  assert.match(c, /if \(shelfDir && it\) moveTo\(it\.id, shelfDir\);/);
});
