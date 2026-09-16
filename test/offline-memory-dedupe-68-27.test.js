// 68.27 的整场自动隐藏绕过了 P1-3 确认机制；这份回归以保护已有记忆为准。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
test("单群滚动与结束保留场次来源，不把来源当作覆盖证明", () => {
  // v69.05 起多了「重新总结这一场」：补的那六条记忆照旧记场次来源，两条经过卡也记上
  // ofs（靠它才找得回这张卡是哪一场），补完回写卡片时再带一次 —— 一共多出十处。
  assert.equal((app.match(/ofs: sess\.id/g) || []).length, 22);
  assert.match(app, /ofs: String\(e\.ofs\)/);
});
test("结束不自动收起整场记忆", () => {
  assert.doesNotMatch(app, /supersedeOfflineRolling|supersededReason: "offline-final"/);
});
test("新增仍经过共享去重与更详细替代候选", () => {
  assert.match(app, /isDupMem\(entry\.text/);
  assert.match(app, /pruneSubsumed\(memLibRef\.current, \[entry\]\)/);
  assert.match(app, /MemoryCorrectionShadow\.observePair/);
});
