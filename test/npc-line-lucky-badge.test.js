const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("配角列表只摆简介第一句；幸运字符能不挂在名字旁边（她 2026-10-27）", () => {
  const i = c.indexOf("function npcLine");
  const f = new Function(c.slice(i, c.indexOf("\n}", i) + 2) + ";return npcLine")();
  assert.equal(f("你是某集团安保负责人，38岁。\n\n退伍出身"), "某集团安保负责人，38岁");
  assert.match(c, /npcLine\(n\.persona\) \|\| "（还没写介绍）"/);
  assert.match(c, /if \(!lucky \|\| !lucky\.word \|\| lucky\.hideBadge/);
  assert.match(app, /if \(i === "badge"\) \{ const sb = luckyOf\(groupId\); luckySave\(groupId, \{ \.\.\.sb, hideBadge: !sb\.hideBadge \}\); return; \}/);
});

test("配角资料页能改性别（她 2026-10-27「性别在哪儿」）", () => {
  assert.match(c, /onSetGender \? h\("div", \{ "data-wk": "npcgender"/);
  assert.match(c, /onSetGender: onSetNpcGender, onClose/);
  assert.match(app, /onSetNpcGender: \(id, v\) => pC\(p => p\.map\(c => c\.id === id && c\.npc \? \{ \.\.\.c, gender:/);
});
