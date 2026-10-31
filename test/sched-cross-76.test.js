// 多角色日程互通收成一份（2026-10-31「问题就是修了很多次的多角色的日程互通」）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("谁算有关、叫什么只有一份，配角和备注都认", () => {
  assert.equal((s.match(/const schedPeersOf = /g) || []).length, 1);
  assert.match(s, /String\(c\.ownerId \|\| ""\) === String\(char\.id\)/);
  assert.match(s, /const schedNamesOf = c => \[c && c\.name, c && c\.remark\]/);
  assert.doesNotMatch(s.slice(s.indexOf("const schedMirrorPeers"), s.indexOf("const schedMirrorPeers") + 900), /c\.npc/);
});
test("抄过去、参照、此刻核对三处都走这一份", () => {
  const m = s.slice(s.indexOf("const schedMirrorPeers"), s.indexOf("const schedMirrorPeers") + 900);
  assert.match(m, /schedPeersOf\(char\)\.forEach/);
  assert.match(s, /const peers = schedPeersOf\(char\)\.filter/);
  assert.match(s.slice(s.indexOf("const schedCrossFor"), s.indexOf("const schedCrossFor") + 900), /schedPeersOf\(char\)\.forEach/);
});
test("聊天里改的、TA 自己回头改的，也往对方那边抄", () => {
  assert.match(s, /liveRevisedAt: Date\.now\(\) \}\); schedMirrorPeers\(c, today, seqs\); \}/);
  assert.match(s, /selfRevisedAt: Date\.now\(\) \}\);\n\s+schedMirrorPeers\(c, today, seqs\);/);
});
