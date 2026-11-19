// 群友 2026-11-19：百合设定，线下总结重 roll 两次还是用「他」称呼女角色
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.CharacterPronoun = require("../js/character-pronoun.js");
const s = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");
const f = new Function(s.slice(s.indexOf("function offlineSummaryGenderLine"), s.indexOf("async function summarizeOffline(")) + ";return offlineSummaryGenderLine;")();
test("线下总结单人、群都带上存了的性别", () => {
  assert.match(f([{ name: "林", gender: "女" }, { name: "周", gender: "" }]), /林是女性，写她用「她」/);
  assert.equal(f([{ name: "周", gender: "" }]), "");
  assert.match(s, /做记忆归档。只输出 JSON：\\n" \+ offlineSummaryGenderLine\(\[ctx\.char\]\) \+/);
  assert.match(s, /做记忆归档。只输出 JSON：\\n" \+ offlineSummaryGenderLine\(ctx\.members\) \+/);
});
