// 空间里直接见面（她 2026-11-20「我是说这里可以直接线下」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const ap = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cs = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("东道群藏起来、只放勾上的人、各频道知道见过面", () => {
  const i = ap.indexOf("const spaceMeetHost = ");
  const body = ap.slice(i, ap.indexOf("const createSpace = ", i));
  assert.match(body, /chKind: "meet", chHidden: true, chArchived: true/);
  assert.match(body, /startGroupOffline\(host\.id, \{ opening: note \|\| "", present: want/);
  assert.match(ap, /channels: \(groups \|\| \[\]\)\.filter\(g => g && g\.spaceId === sp\.id && !g\.chHidden\)/);
  assert.match(ap, /spaceMeetLine\(group\.spaceId\)/);
  assert.match(ap, /\|\| \(opts && opts\._host\);/);
  assert.match(cs, /function SpaceMeetPage\(/);
  assert.match(cs, /groups\.filter\(g => g && g\.spaceId === sp\.id && !g\.chHidden\)/);
});
