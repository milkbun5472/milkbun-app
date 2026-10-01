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

// 她 2026-10-02 贴出 v74.456 的真实提示词：标签自己还写着「别的成员并不知情」，人设规则还写「跟她之间的事你不知道」「生人最常见是客气」
test("修罗场开着：关系标签、人设规则不再跟修罗场打架", () => {
  const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8");
  assert.match(app, /if \(l && o\.drama\) return/);
  assert.match(app, /drama: !!gs\.drama \}\)/);
  assert.match(app, /groupBans\(\{ echo: false, drama: !!gsFor\(groupId\)\.drama \}\)/);
  assert.match(eng, /drama: !!ctx\.dramaRule/);
  const G = eng.slice(eng.indexOf("const GROUP_IN_CHARACTER = `") + 28, eng.indexOf("`;", eng.indexOf("const GROUP_IN_CHARACTER = `")));
  const f = new Function("return " + eng.slice(eng.indexOf("const groupInCharacterDrama = ") + 30, eng.indexOf("function groupBans(")).trim().replace(/;$/, ""))();
  const d = f(G);
  assert.ok(d.indexOf("跟她之间的事") < 0 && d.indexOf("最常见的是好奇、客气") < 0, "替换没生效（原文改过了？）");
});
