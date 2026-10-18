const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("秋秋看最近聊天：小房间的也带上，标房间名，按时间排", () => {
  const i = app.indexOf("recentChatFor: (charId, n) => {\n        const c = characters.find(x => x.id === charId); const uN = userName(profile);\n        const CR = window.ChatRooms");
  assert.ok(i > 0, "秋秋那份 recentChatFor 没读房间");
  const body = app.slice(i, i + 1500);
  assert.match(body, /CR\.list\(charId\)\.filter\(r => r && !r\.main\)/);
  assert.match(body, /CR\.chatKey\(charId, r\.id\)/);
  assert.match(body, /pool\.sort\(\(a, b\) => \(a\.m\.ts \|\| 0\) - \(b\.m\.ts \|\| 0\)\)/);
  assert.match(body, /"〔" \+ room \+ "〕"/);
});
