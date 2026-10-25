const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("看TA翻手机：翻完线下去别处，回主屏、去信息都先把线下那层收掉（群友 2026-10-26）", () => {
  assert.match(app, /goHome: \(\) => \{ peekOffClose\(\); setPeekDailyView\(null\); setScreen\("home"\); \}/);
  assert.match(app, /toMessages: tab => \{ peekOffClose\(\); setPeekDailyView\(null\); setMsgTab\(tab \|\| "chats"\); setScreen\("messages"\); \}/);
});
