const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("我存的美化：两列小格、八套以上能搜、删收进管理", () => {
  assert.match(c, /const \[shelfQ, setShelfQ\] = useState\(""\), \[shelfEdit, setShelfEdit\] = useState\(false\);/);
  assert.match(c, /gridTemplateColumns: "repeat\(2, minmax\(0, 1fr\)\)"/);
  assert.match(c, /shelf\.length > 8 \? h\("input"/);
  assert.match(c, /onClick: \(\) => shelfEdit \? dropOne\(it\) : useOne\(it\)/);
});
