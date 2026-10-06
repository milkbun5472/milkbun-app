const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("通话转账：卡落聊天带 inCall，通话里只留 ev 指针", () => {
  assert.match(app, /postCharTransfer\(char\.id, Number\(tf\.amount\), String\(tf\.note \|\| ""\), \{ inCall: cur\.sessionId \}\)/);
  assert.match(app, /sendTransfer\(c0\.id, amt, note, \{ inCall: sid \}\)/);
  assert.match(cmp, /m\.ev === "transfer"/);
  assert.match(cmp, /m\.inCall \? " · 通话中" : ""/);
});
test("挂断时通话卡插到通话中转账单前面", () => {
  assert.match(app, /p\.findIndex\(x => x && x\.inCall === cur\.sessionId\)/);
});
