// 挑人名单：配角收在他挂着的那个人底下（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("公共的 PeopleTree：按 ownerId 收在主角色底下，没主的进「其他」", () => {
  assert.match(comp, /function PeopleTree\(\{ people, row \}\)/);
  assert.match(comp, /const under = id => npcs\.filter\(c => String\(c\.ownerId \|\| ""\) === String\(id\)\)/);
  assert.match(comp, /loose\.length \? fold\("_loose", "其他", loose\)/);
});
test("购物送礼/代付/转赠、外卖给TA点/代付都用它", () => {
  assert.equal((ui.match(/h\(PeopleTree, \{/g) || []).length, 5);
  assert.doesNotMatch(ui, /\(characters \|\| \[\]\)\.map\(c => pickRow\(c, \(\) => submit\("(forchar|paylater)"/);
});
