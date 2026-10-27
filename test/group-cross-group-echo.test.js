const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("群里每个人也带着他在别的互通群最近聊的（她 2026-10-27）", () => {
  const i = app.indexOf("const memberPrivateContextFor = (c, split, opts) => {"), body = app.slice(i, app.indexOf("\n  };", i));
  assert.match(body, /g\.id !== opts\.groupId && gsFor\(g\.id\)\.memoryInterop && \(g\.memberIds \|\| \[\]\)\.includes\(c\.id\)/);
  assert.match(body, /\.slice\(0, 2\)\.map\(x => x\.text\)/);
  assert.match(body, /otherGroups && c\.name \+ " 在别的群里最近聊的/);
  assert.match(app, /spectate: !imInGroup\(group\) \|\| !!gs\.spectate, groupId: group\.id \}\)/);
});
