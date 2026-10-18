const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"),
  pk = fs.readFileSync(__dirname + "/../js/peek-phone.js", "utf8"), ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
test("递手机录像：日常联系人摆进消息列表，只在勾了或回放材料里有时", () => {
  assert.match(app, /const peekDailyShown = \(\) => \{/);
  assert.match(app, /\(p\.allow \|\| \[\]\)\.includes\("daily"\) \|\| \(p\.replay && String\(p\.seen \|\| ""\)\.indexOf\("【她手机里的日常联系人"\) >= 0\)/);
  assert.match(app, /peekDaily: peekDailyShown\(\),/);
  assert.match(comp, /"data-kind": "daily"/);
});
test("录像点开日常联系人：打开只读那一页；返回、换下一样、播完都收起", () => {
  assert.match(app, /if \(dp\) setPeekDailyView\(dp\);/);
  assert.match(app, /if \(peekDailyView\) \{ setPeekDailyView\(null\); return; \}/);
  assert.equal((app.match(/setPeekDailyView\(null\);/g) || []).length >= 3, true);
  assert.match(pk, /function PeekDailyChat\(\{ person, onBack \}\)/);
  assert.match(pk, /zIndex: 9980/);   // 垫在录像遮罩（9990）下面
  assert.match(ts, /\["peekdaily",/); assert.match(ts, /\["peekdailybubble",/);
});
