// 修罗场开着时，记忆互通／入群前私聊／群通话那几份隐私铁律不能再禁「是什么关系」「撞破彼此」
const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
test("三处隐私头都按修罗场开关收起关系那一句", () => {
  assert.match(app, /\(gsFor\(groupId\)\.drama \? "" : "、是什么关系"\)/);
  assert.match(app, /\(gDramaOn \? "" : "、是什么关系"\)/);
  assert.match(app, /\(cgs && cgs\.drama \? "" : "、是什么关系"\)/);
  assert.match(app, /gDramaOn \? "（修罗场开着/);
  assert.ok(app.indexOf("const gDramaOn = ") < app.indexOf("(gDramaOn ?"), "TDZ");
});
