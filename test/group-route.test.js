// 群单独挑线路（她 2026-11-04「群聊能设专线吗」）：群聊／出戏／投票／通话走 groupApiFor，群线下走 groupOfflineApiFor
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const a = R("app.js"), c = R("components.js");
test("选路：群自己那格，没挑落回全局", () => {
  assert.match(a, /const groupApiFor = gid => pickRoute\(gsFor\(gid\)\.apiId, active\);/);
  assert.match(a, /const groupOfflineApiFor = gid => pickRoute\(gsFor\(gid\)\.offlineApiId \|\| gsFor\(gid\)\.apiId, offlineActive\);/);
});
test("六处都换过去了", () => {
  assert.match(a, /callAI\(groupApiFor\(groupId\), system \+ mcpToolHint/);
  assert.equal((a.match(/oocAskGroup\(group(Offline)?ApiFor\(groupId\)/g) || []).length, 2);
  assert.match(a, /callAI\(groupApiFor\(groupId\), system, voteMsgs/);
  assert.match(a, /callAI\(groupApiFor\(groupId\), sys \+ callBiHint/);
  assert.match(a, /generateOfflineGroup\(groupOfflineApiFor\(group\.id\)/);
});
test("群设置能挑、能存", () => {
  assert.match(c, /onSave\(\{ apiId: gApiId, offlineApiId: gOffApiId,/);
  assert.match(c, /"data-wk": "gsroute"/); assert.match(c, /"data-wk": "gsrouteoff"/);
  assert.match(R("theme-studio.js"), /"gsroute"/);
});
