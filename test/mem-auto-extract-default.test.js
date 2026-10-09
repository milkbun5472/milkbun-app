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

test("抽取间隔紧跟在开关下面，关着就不显示", () => {
  const i = scr.indexOf('toggle("自动抽取"'), seg = scr.slice(i, i + 900);
  assert.match(seg, /\n\s*\/\/[^\n]*\n\s*c\.autoExtract \? slider\("自动抽取间隔"/);
  assert.ok(seg.indexOf('slider("自动抽取间隔"') < seg.indexOf('slider("每轮召回条数'));
});
