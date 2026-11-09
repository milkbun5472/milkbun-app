// 群聊骰子 · 抽签（2026-11-01 许愿）：本机掷本机抽，结果写进卡和 content，他们读得到
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("+面板有这一格，点了开对话框", () => {
  assert.match(src, /\["poll", "投票", "bars"\], \["luck", "骰子 · 抽签", "dice"\],/);
  assert.match(src, /else if \(k === "luck"\) setSheet\("luck"\);/);
  assert.match(src, /sheet === "luck" && h\(GroupLuckDialog,/);
});
test("结果写进 content，卡画得出来", () => {
  assert.match(src, /content: "\[抽签\] " \+ meName/);
  assert.match(src, /content: "\[掷骰子\] " \+ meName/);
  assert.match(src, /if \(m\.kind === "luck"\) return h\(GroupLuckCard, \{ key: i, m \}\);/);
});
