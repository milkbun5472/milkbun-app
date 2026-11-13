const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const A = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), C = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("群名记下是谁起的，群里和单聊里都说得出", () => {
  assert.match(A, /namedBy: roles && roles\.namedBy && memberIds\.includes\(roles\.namedBy\) \? roles\.namedBy : "me"/);
  assert.match(A, /renameGroup\(groupId, nm, spk\.id\)/); assert.match(A, /renameGroup\(activeGroup\.id, _gname, _gnameBy \|\| ""\)/);
  assert.match(A, /updateGroup\(groupId, \{ name, namedBy: by \|\| "me"/);
  assert.match(A, /const groupNamedByNote = /); assert.match(A, /\\n【群名】/);
  assert.match(A, /groupNamedByNote\(\(groupsRef\.current \|\| \[\]\)\.find\(g => g && g\.id === id\), charId\)/);
  assert.match(C, /name: gName, nameBy: gNameBy,/); assert.match(C, /setGNameBy\(gNamer \|\| members\[0\]\.id\)/);
});
