const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
// 群友 2026-10-07：「关系网里生成的 npc 聊天过后怎么删除啊？关系网里面已经删了」
test("删配角只有一份 deleteNpc，关系页和通讯录配角册子都走它", () => {
  assert.equal((app.match(/const deleteNpc = /g) || []).length, 1);
  assert.match(app, /if \(wipeChat\) clearChat\(id, true\);/);
  assert.match(app, /onDeleteNpc: id => deleteNpc\(id, false\)/);
  assert.match(app, /onDeleteNpc: \(id, wipeChat\) => deleteNpc\(id, wipeChat\)/);
});
test("通讯录配角详情能删，删前问聊天要不要一起清", () => {
  const i = comp.indexOf("function NpcBook("), j = comp.indexOf("\nfunction ", i + 10);
  const seg = comp.slice(i, j);
  assert.match(seg, /onDelete\(cur\.id, true\)/);
  assert.match(seg, /onDelete\(cur\.id, false\)/);
  assert.match(seg, /"删除这个配角"/);
  assert.match(comp, /onDelete: onDeleteNpc, onSetMem: onSetNpcMem/);
});
