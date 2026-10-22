const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("按发送不收键盘：单聊群聊发送键都不抢焦点，刚失焦就把焦点还回去", () => {
  assert.equal((comp.match(/onClick: fire,\n\s*(\/\/[^\n]*\n\s*)?onMouseDown: e => e\.preventDefault\(\)/g) || []).length, 2);
  assert.match(comp, /Date\.now\(\) - blurAt\.current < 600/);
  assert.match(comp, /el\.focus\(\{ preventScroll: true \}\)/);
});
