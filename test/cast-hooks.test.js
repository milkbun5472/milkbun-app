// 她 2026-10-08：「人格档案馆那一页是不是没有挂点能不能改改，然后让秋秋可以美化」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
const HOOKS = ["castpage", "castcount", "castcard", "castspine", "castavatar", "castname", "castsum", "castinfo", "castheart"];

test("档案馆那一页挂上了，每个都登记在 cast 那一组里", () => {
  const cast = scr.slice(scr.indexOf("function Cast({"), scr.indexOf("function CastForm("));
  const reg = ts.slice(ts.indexOf('zh:"人格档案馆",pages:Object.freeze(["cast"])'), ts.indexOf('zh:"资料卡"'));
  assert.ok(reg.length > 0, "没登记");
  for (const k of HOOKS) {
    assert.ok(cast.includes('"data-wk": "' + k + '"'), "页面上没挂 " + k);
    assert.ok(reg.includes('["' + k + '"'), "没登记 " + k);
  }
});

test("编角色卡那一页也挂上了，登记在 castForm 那一组", () => {
  const form = scr.slice(scr.indexOf("function CastSection("), scr.indexOf("\n// TIES (directed)"));
  const reg = ts.slice(ts.indexOf('zh:"编角色卡",pages:Object.freeze(["castForm"])'));
  for (const k of ["castfpage", "castfsave", "castfcover", "castfavatar", "castfname", "castftag", "castfcolor", "castfsec", "castfdel"]) {
    assert.ok(form.includes('"data-wk": "' + k + '"'), "页面上没挂 " + k);
    assert.ok(reg.includes('["' + k + '"'), "没登记 " + k);
  }
});
