const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("「Ta 眼里」只对言秋关，本体模式照常有（后台复看、上下文、状态卡那一页）", () => {
  assert.match(app, /const noGaze = id => !!\(settingsFor\(id\) \|\| \{\}\)\.engineerEyes;/);
  assert.match(app, /gazeOn: !roomCard && !!window\.Gaze && !noGaze\(scc\.id\) && !scc\.npc/);
  assert.equal((app.match(/if \(noGaze\(char\.id\) \|\| !autoRefreshOn\("gaze", char\.id\)\) return;/g) || []).length, 2);
  assert.match(app, /const gazeFor = charId => \{\n\s*if \(noGaze\(charId\)/);
});

test("本体模式聊天里也能顺手更新印象（给那一格、也收下）；言秋照旧不给", () => {
  assert.match(app, /\(_bodyOnly && window\.Gaze && !char\.npc \? window\.Gaze\.spec\("对方", charId, \{ tail: true \}\) : ""\)/);
  assert.match(app, /if \(_roomCanWrite\("gaze"\) && window\.Gaze && !noGaze\(charId\)\) \{/);
});
