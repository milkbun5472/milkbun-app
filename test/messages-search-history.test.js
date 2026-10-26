const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("消息列表一搜，所有人的聊天记录都列出来，点一条跳过去（群友 2026-10-26）", () => {
  const i = comp.indexOf("const msgHits = (() => {"); assert.ok(i > 0);
  const body = comp.slice(i, comp.indexOf("})();", i));
  assert.match(body, /groupChats\[it\.id\] : chats\[it\.id\]/);
  assert.match(body, /m\.recalled \|\| m\.kind === "recalled"/);
  assert.match(body, /__peekHide/);
  assert.match(comp, /"data-wk": "mlhit", onClick: \(\) => onLocateMsg\(/);
  assert.match(app, /onLocateMsg: \(type, id, ts\) => \{ openChatById\(id, type === "group" \? "group" : undefined\); setWalletTrace\(\{ type: type, id: id, ts: ts, key: Date\.now\(\) \}\); \}/);
  assert.match(fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8"), /"mlhit"/);
});
