const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const app = R("app.js"), scr = R("screens.js");
test("自动抽取默认关；老用户没存过设置的钉住原来的开", () => {
  assert.match(app, /const MEM_CFG_DEFAULT = \{ topK: 5, autoExtract: false,/);
  assert.match(app, /if \(!mc && \(loadJSON\("x_characters", \[\]\) \|\| \[\]\)\.length\) \{ mc = \{ autoExtract: true \}; saveJSON\("x_memCfg", mc\); \}/);
  assert.match(scr, /!!c\.autoExtract, \(\) => set\(\{ autoExtract: !c\.autoExtract \}\)/, "开关界面也按默认关来显示");
});
