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

// 她 2026-10-11：「把人设放第一会不会变得不那么活人感」——原句「规矩和人设对不上时，以人设为准」
//   会把人设里的标签词（强势／霸道……）读成「禁令让路、模板回来」。改成分工：人设管是谁，规矩只管别套现成写法。
//   ⚠️这一句只在家里：公共版出炉时 patch-public-tweaks.py 换回原段（她：「放家里不推」）。
test("总纲是分工，不是谁压过谁", () => {
  assert.match(eng, /人设决定这个人是谁、会做什么、说话什么味道；下面的规矩只管一件事：这个人要用只属于他的写法写出来，不用谁都能套的现成写法。/);
  assert.ok(!/规矩和人设对不上时，以人设为准/.test(eng), "「对不上以人设为准」回来了：人设里一个标签词就能让禁令整片让路");
});
