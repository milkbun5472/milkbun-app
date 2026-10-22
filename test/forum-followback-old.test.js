const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("回关上线前就关注着的人：没记录也补掂量一次", () => {
  const seg = app.slice(app.indexOf("const forumBackTick = () =>"), app.indexOf("if (changed) forumBackSave(all);"));
  assert.match(seg, /if \(iFollow && !all\[cid\] && !c\.npc\) setTimeout\(\(\) => forumBackDecide\(cid\), 0\);/);
});
