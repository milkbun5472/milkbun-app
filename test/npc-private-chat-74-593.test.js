// 她 2026-10-03：配角私聊。定的三条：主人不知道你们聊了什么；群里的事配角自己也记得；先不做线下。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), comp = P("js/components.js"), engine = P("js/engine.js");

test("入口：配角详情页有「发消息」，走 openChatById", () => {
  assert.match(comp, /onChat \? h\("button", \{ onClick: \(\) => onChat\(cur\.id\)/);
  assert.match(app, /onChatNpc: id => openChatById\(id\),/);
});

test("聊过的配角才进聊天列表", () => {
  assert.match(comp, /characters\.concat\(\(allChars \|\| \[\]\)\.filter\(c => c && c\.npc && \(chats\[c\.id\] \|\| \[\]\)\.length\)\)/);
});

test("私聊里配角没有好感、印象卡、朋友圈、抽卡点", () => {
  assert.match(app, /affinity: char\.npc \? null : Math\.round\(affOf\(char\.id\)\),/);
  assert.match(engine, /typeof affinity === "number"\) parts\.push\("【当前对 "/, "null 时引擎不再整句跳过");
  assert.match(app, /const bumpAff = \(charId, aiDelta\) => \{\n\s*if \(typeof charactersRef !== "undefined" && [^\n]*\.npc\) return;/);
  assert.match(app, /const gachaEarn = [\s\S]{0,200}\.npc\) return 0;   \/\/ 配角没有抽卡点/);
  assert.match(app, /window\.Gaze && !char\.npc \? window\.Gaze\.spec\("对方", charId/);
  assert.match(app, /if \(parsed\.impression && !char\.npc\)/);
  assert.match(app, /const mo = !char\.npc && settingsFor\(charId\)\.autoMoment/);

});

test("后台循环一律跳过配角：TA从不主动找她", () => {
  assert.ok((app.match(/if \(c\.npc\) continue;   \/\/ 配角私聊只在她找TA时才说话/g) || []).length >= 5);
  assert.match(app, /if \(char && char\.npc && !gid\) return;/);
});

test("记忆：群里的事配角召得回（knownBy），私聊的事主人召不回", () => {
  // 召回只看 knownBy（数组时）——群记忆的 knownBy 放的是全体在场者，含配角
  assert.match(engine, /function memoryVisibleTo\(e, charId\) \{ return Array\.isArray\(e\.knownBy\)/);
  assert.match(app, /knownBy: memberIds\.slice\(\)/);
});

test("配角能单独调私聊记忆抽取：照常 / 少抽点 / 不抽", () => {
  assert.match(app, /if \(_npcMem\.npc && _npcMem\.memExtract === "off"\) return;/);
  assert.match(app, /\* \(_npcMem\.npc && _npcMem\.memExtract === "less" \? 3 : 1\)/);
  assert.match(app, /onSetNpcMem: \(id, v\) => pC\(p => p\.map\(c => c\.id === id && c\.npc \?/);
  assert.match(comp, /\[\["", "照常"\], \["less", "少抽点"\], \["off", "不抽"\]\]/);
});
