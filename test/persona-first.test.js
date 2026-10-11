const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

// 她 2026-10-11：「提示词会不会太过追求活人感会导致兼顾不上抓人设」——量下来人设只占一两成，
// 禁令打头还叫最高准则。总纲换成人设第一，放在所有禁令前面，单聊/群聊/线下叙事三处都接上。
test("人设第一放在去人机味前面，三处都接上", () => {
  assert.match(eng, /const PERSONA_FIRST = `【总纲 · 人设第一】/);
  assert.ok(!/【去人机味 · 最高准则】/.test(eng), "去人机味又自称最高准则了");
  assert.match(eng, /const P = \[PERSONA_FIRST, ANTI_CLICHE\];/, "群聊");
  assert.match(eng, /parts\.push\(PERSONA_FIRST\);\n\s*parts\.push\(ANTI_CLICHE\);/, "单聊");
  assert.match(eng, /PERSONA_FIRST, ANTI_CLICHE, CHARCARD_RULE, OFFLINE_NARRATIVE_RUNTIME/, "线下叙事");
});
