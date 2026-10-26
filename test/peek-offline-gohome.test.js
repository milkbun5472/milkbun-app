const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("看TA翻手机：翻完线下去别处，回主屏、去信息都先把线下那层收掉（群友 2026-10-26）", () => {
  assert.match(app, /goHome: \(\) => \{ peekOffClose\(\); setPeekDailyView\(null\); setScreen\("home"\); \}/);
  assert.match(app, /toMessages: tab => \{ peekOffClose\(\); setPeekDailyView\(null\); setMsgTab\(tab \|\| "chats"\); setScreen\("messages"\); \}/);
});

test("他翻手机时点开默认进线下的人／群：只摊开正在进行的那场，不替她新开；群线下也一起收（2026-10-26 查一遍）", () => {
  assert.equal((app.match(/if \(peekPlay && !hasActive\) return;/g) || []).length, 2);
  assert.equal((app.match(/if \(peekPlay\) peekOffRef\.current = true;/g) || []).length, 2);
  assert.match(app, /const peekOffClose = \(\) => \{ try \{ window\.__peekOffPast = false; \} catch \(e\) \{\} if \(peekOffRef\.current\) \{ peekOffRef\.current = false; setOfflineChar\(null\); setOfflineGroup\(null\); \} \};/);
});

test("录像里会真动她东西的按钮一律不点（结束、撤回、清空……）", () => {
  const pp = fs.readFileSync(__dirname + "/../js/peek-phone.js", "utf8");
  assert.match(pp, /if \(d === "tap" && \/结束\|撤回\|清空\|退出\|移除\|解散\|收桌\|注销\|重置\/\.test\(S\(s\.text\)\)\) return;/);
});
