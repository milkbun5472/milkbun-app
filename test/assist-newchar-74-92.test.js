// 她 2026-10-06：「能不能让秋秋可以写人设，从头开始的，然后可以落到人格档案馆里」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const asst = fs.readFileSync(path.join(__dirname, "..", "js", "assistant.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("newchar：只认名字、人设、外貌和档案那几栏；名字和人设必填；落档走同一个新建入口", () => {
  const a = asst.indexOf("function newCharObj("), b = asst.indexOf("const TARGETS = {");
  const cf = asst.slice(asst.indexOf("const CARD_FIELDS"), asst.indexOf("};", asst.indexOf("const CARD_FIELDS")) + 2);
  const f = new Function(cf + asst.slice(a, b) + "\nreturn newCharObj;")();
  const o = f(JSON.stringify({ name: "沈清和", persona: "医生，话少", appearance: "高", tagline: "一句话", id: "坏的", npc: true }));
  assert.deepEqual(Object.keys(o).sort(), ["appearance", "name", "persona", "tagline"]);
  assert.equal(f("不是 JSON"), null);
  assert.match(asst, /if \(!o\.name\) throw new Error\("新角色得有个名字"\);/);
  assert.match(asst, /if \(patch\.target !== "style" && patch\.target !== "newchar" && !patch\.id\)/);
  assert.match(app, /pC\(p => \[\.\.\.p, CharacterPronoun\.newCharacter\(Object\.assign\(\{ id, color: "#5a6a7d" \}, o\)\)\]\);/);
  assert.equal((app.match(/onCreateCharacter: createCharFromAssistant,/g) || []).length, 2, "整屏秋秋和悬浮秋秋两处都接上");
});
