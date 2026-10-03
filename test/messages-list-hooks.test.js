// 群友 2026-10-03：「老大这个界面的这种是没办法美化吗」——消息列表补上 data-wk 挂点，并在主题工作台里列出来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const comp = P("js/components.js"), studio = P("js/theme-studio.js");
const HOOKS = ["mlsearch", "mlrow", "mlavatar", "mlname", "mllast", "mltime", "mlbadge", "ctentry", "ctletter", "ctrow", "mltabbar", "mltab"];

test("消息列表每个挂点都真挂在界面上，也都写进了工作台那份名单", () => {
  HOOKS.forEach(k => {
    assert.ok(comp.includes('"data-wk": "' + k + '"'), "界面上没有 " + k);
    assert.ok(studio.includes('["' + k + '",'), "工作台名单里没有 " + k);
  });
  assert.match(studio, /zh:"消息列表",pages:Object\.freeze\(\["messages"\]\)/);
});
