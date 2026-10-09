const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const app = R("app.js"), scr = R("screens.js");
test("自动抽取默认关；没存过设置的老用户也按默认关", () => {
  assert.match(app, /const MEM_CFG_DEFAULT = \{ topK: 5, autoExtract: false,/);
  assert.match(app, /setMemCfg\(Object\.assign\(\{\}, MEM_CFG_DEFAULT, loadJSON\("x_memCfg", \{\}\)\)\);/);
  assert.ok(!/mc = \{ autoExtract: true \}/.test(app), "不许再替没存过的人钉成开");
  assert.match(scr, /!!c\.autoExtract, \(\) => set\(\{ autoExtract: !c\.autoExtract \}\)/, "开关界面也按默认关来显示");
});
