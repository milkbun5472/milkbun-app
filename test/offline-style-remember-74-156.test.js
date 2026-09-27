// 进线下先来一段默认文风（群里反馈 2026-09-27）：自动开的那一场没问过文风，手动进的那页也总重置回默认。
// 现在：上一场选过的文风／预设台记在这个人（或这个群）身上，下一场先用它。
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(app, /const rememberOfflineStyle = \(charId, st\) => saveOfflineSettings\(charId, \{ lastStyle:/);
const one = app.slice(app.indexOf("  const startOffline = async"), app.indexOf("  const offlineSend ="));
assert.match(one, /const last = \(osFor\(charId\) \|\| \{\}\)\.lastStyle/, "single offline reads the last style");
assert.match(one, /styleKey: picked\.styleKey/);
assert.match(one, /if \(opts\.styleKey != null\) rememberOfflineStyle\(charId, picked\)/);
const grp = app.slice(app.indexOf("  const startGroupOffline = async"), app.indexOf("pGOffline(groupId, list => [sess"));
assert.match(grp, /lastStyle/, "group offline too");
assert.match(app, /rememberOfflineStyle\(charId, patch\);\n    toast\("文风已切换/, "switching mid-scene is remembered");
assert.match(app, /rememberOfflineStyle\("g_" \+ groupId, patch\);/);
assert.equal((comp.match(/settings\.lastStyle\.styleKey\) \|\| "default"\)\); \/\/ 上一场选过什么/g) || []).length, 2, "both setup pages start from the last style");
// 自动开的那一场传的是空 opts：必须走「上一场」那条，不许回到写死的 default
assert.match(app, /if \(!hasActive\) startOffline\(cid, \{\}\);/);
console.log("offline style remember ok");
// v74.165：预设台直接在进门那一页选（单人、群线下两页都有），不用先进去再开设置
{ const setups = comp.split('if (view === "setup") {').slice(1).map(x => x.slice(0, 3000));
  assert.equal(setups.length, 2);
  setups.forEach(seg => assert.match(seg, /h\(OfflineSetupStyleSection[\s\S]{0,300}h\(OfflineStylePresetSection, \{ t, presetOn, setPresetOn, presetId, setPresetId, onOpenStyleLab \}\)/));
  console.log("preset on entry page ok"); }
