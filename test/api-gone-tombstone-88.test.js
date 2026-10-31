// 删掉的线路开机又回来（她 2026-10-31 群友）：删时记 id，开机见到就拿掉
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), ui = R("screens-ui.js");
test("删除时记下 id，礼物卡不记", () => {
  const rm = ui.slice(ui.indexOf("const removeProfile = source => {"), ui.indexOf("const removeCur = () => {"));
  assert.match(rm, /if \(await onSave\(tidy\(nl\), nextActive\) === false\) return;\s*\n\s*\/\/[^\n]*\n\s*if \(!source\.gift\) \{[^\n]*qq_apiGone/, "存成功之后才记");
});
test("开机读线路：公共版钉的那三行原样，墓碑在后面就地拿掉并存回", () => {
  assert.match(app, /    const storedApis = loadJSON\("x_api", \[\]\);\n    const aps = window\.CredentialVault \? window\.CredentialVault\.materializeApiProfiles\(storedApis\) : storedApis;\n    setApiProfiles\(aps\);/);
  const blk = app.slice(app.indexOf('    setBgApiId(loadJSON("x_bgApi", null));'), app.indexOf('    setBgApiId(loadJSON("x_bgApi", null));') + 1600);
  assert.match(blk, /localStorage\.getItem\("qq_apiGone"\)/);
  assert.match(blk, /aps\.length = 0; left\.forEach\(p => aps\.push\(p\)\);/);
  assert.match(blk, /persistApiProfiles\(left\)/);
  assert.match(blk, /if \(left\.length\)/, "全删光了就别动，免得一条线路都不剩");
});
