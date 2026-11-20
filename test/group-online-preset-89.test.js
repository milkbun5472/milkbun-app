// 她 2026-11-19：「群聊能不能吃进文风预设」「我们单聊不是可以有预设嘛就是那个」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("群聊线上也能挑文风预设：同一段话、同一个挑选块，开关记在群设置", () => {
  const e = R("js/engine.js"), a = R("js/app.js"), c = R("js/components.js");
  assert.match(e, /function onlinePresetBlock\(text\)/);
  assert.match(e, /parts\.push\(onlinePresetBlock\(ctx\.onlinePreset\)\)/);
  assert.match(a, /gs\.onlinePresetOn && gs\.onlinePresetId && window\.StylePresets \? "\\n\\n" \+ onlinePresetBlock\(/);
  assert.match(c, /onSave\(\{ apiId: gApiId, offlineApiId: gOffApiId, onlinePresetOn: gPresetOn, onlinePresetId: gPresetId,/);
  assert.match(c, /gCard\(\{ title: "线上也用文风预设"[^\n]*\}, null,\n\s*h\(OfflineStylePresetSection, \{ t, presetOn: gPresetOn/);
  assert.match(a, /body = h\(GroupThread, \{\n\s*onOpenStyleLab: goStyleLab,/);
});
