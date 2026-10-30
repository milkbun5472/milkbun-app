const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("真填了线路／角色就当场记「这台手机有存档」，默认设置不算（不然新人重开会被云上旧的盖掉）", () => {
  const i = src.indexOf("function txtWrite(k, s) {"), seg = src.slice(i, i + 1500);
  assert.match(seg, /\/\^\(x_api\|x_characters\|x_groups\|x_worlds\|x_chat:\.\+\)\$\/\.test\(k\)/);
  assert.match(seg, /lsRaw\.set\("qq_vaultHasData", "1"\)/);
});
