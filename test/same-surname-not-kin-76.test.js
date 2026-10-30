const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const f = new Function("userName", src.slice(src.indexOf("function directedRelationLines"), src.indexOf("// 叙事人称/代入方式指令")) + ";return { directedRelationLines, cnSurname };")(p => p.name);
const chars = [{ id: "a", name: "沈屿白" }, { id: "b", name: "沈知意" }, { id: "c", name: "贺星阑" }, { id: "d", name: "欧阳辰" }, { id: "e", name: "欧阳" }];
test("同姓又没写关系：补一行「只是碰巧，不是亲戚」；写了关系就照写的", () => {
  assert.match(f.directedRelationLines(chars[0], {}, chars, { name: "沈念" }), /沈屿白 和 沈念、沈知意 同姓「沈」，只是碰巧/);
  assert.doesNotMatch(f.directedRelationLines(chars[0], { "a->b": { label: "哥哥" } }, chars, { name: "林夏" }), /同姓/);
  assert.doesNotMatch(f.directedRelationLines(chars[2], {}, chars, { name: "林夏" }), /同姓/);
});
test("复姓先认，英文名不算", () => {
  assert.equal(f.cnSurname("欧阳辰"), "欧阳");
  assert.equal(f.cnSurname("欧阳"), "欧");   // 只有两个字就是姓欧名阳
  assert.equal(f.cnSurname("Alice"), "");
});
