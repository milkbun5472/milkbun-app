const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

test("日记自动补写与手动生成共享同步单飞锁，并在落库前二次去重", () => {
  assert.match(app, /const diaryFlightRef = useRef\(new Set\(\)\)/);
  const lockAt = app.indexOf("diaryFlightRef.current.add(charId)");
  const firstAwaitAfterLock = app.indexOf("await ", lockAt);
  assert.ok(lockAt > 0 && firstAwaitAfterLock > lockAt, "必须在生成链第一个 await 前占锁");
  assert.match(app, /some\(e => diarySameDay\(e\.ts, targetTs\)\)\) return p/);
  assert.match(app, /diariesRef\.current = n/);
  assert.match(app, /diaryFlightRef\.current\.delete\(charId\)/);
});
