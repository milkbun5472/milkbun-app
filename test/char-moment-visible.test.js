// 她 2026-11-26：角色发朋友圈也能设仅她可见、只给谁看、不给谁看
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), vm = require("vm");
const en = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("谁看得见", () => {
  const c = {}; vm.createContext(c);
  vm.runInContext(en.slice(en.indexOf("function momCharSees"), en.indexOf("function photoDuoSaid")) + ";this.S=momCharSees;", c);
  assert.equal(c.S({ characterId: "a", visibleTo: ["me"] }, "b"), false);
  assert.equal(c.S({ characterId: "a", visibleTo: ["me"] }, "a"), true);
  assert.equal(c.S({ characterId: "a", hiddenFrom: ["b"] }, "b"), false);
  assert.equal(c.S({ characterId: "a" }, "b"), true);
});
test("接线：生成时让他设范围；别人的手机、评论区照范围；卡上挂锁", () => {
  assert.match(ap, /\\"visible\\":\{\\"to\\":\\"all｜her｜only｜hide\\"/);
  assert.match(ap, /!maskTrace\(m\.content\) && momCharSees\(m, viewerId\)/);
  assert.match(ap, /momCharSees\(m, char\.id\)\)\.slice\(0, 12\)/);
  assert.match(ap, /&& momCharSees\(mom, c\.id\)\);   \/\/ 设了范围的/);
  assert.match(cs, /"仅你可见"/);
});
