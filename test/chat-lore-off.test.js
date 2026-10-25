const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("聊天设置「TA 知道什么」：世界书多一栏「TA 没用的」，同一个选择器只列没勾的（群友 2026-10-26）", () => {
  assert.match(comp, /title: "世界书 · TA 用哪几条"[\s\S]{0,300}\n\s*settingsTab === "know" && loreEntries && onLoreBulk \? h\(SettingSection, \{ title: "世界书 · TA 没用的", \.\.\.sec\("loreoff"\) \}, h\(ChatLorePicker, \{ character, entries: loreEntries, onBulk: onLoreBulk, only: "off" \}\)\)/);
  assert.match(comp, /const shown = offOnly \? live\.filter\(e => !uses\(e\)\) : live;/);
  assert.match(comp, /const items = shown\.filter\(e => fOf\(e\) === fd\);/);
  assert.match(comp, /在用的词条 TA 全都用着。/);
});
