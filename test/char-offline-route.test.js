// 群里 2026-10-10：角色专线也分线上线下
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const a = src("app.js"), c = src("components.js");
test("线下先认 offlineApiId，没挑再落回专线、全局线下", () => {
  assert.match(a, /const offlineApiFor = id => pickRoute\(\(chatSettings\[id\] \|\| \{\}\)\.offlineApiId \|\| \(chatSettings\[id\] \|\| \{\}\)\.apiId, offlineActive\);/);
  assert.match(a, /const apiFor = id => pickRoute\(\(chatSettings\[id\] \|\| \{\}\)\.apiId, active\);/);
});
test("聊天设置线路那一格能单独挑线下，存进设置", () => {
  assert.match(c, /const \[offlineApiId, setOfflineApiId\] = useState\(settings\.offlineApiId \|\| null\);/);
  assert.match(c, /apiId,\n\s*offlineApiId,/);
  assert.match(c, /"data-wk": "csrouteoff"/);
});
