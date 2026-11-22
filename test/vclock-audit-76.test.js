// 群里 2026-11-11「app 还有哪些地方应该接虚拟时间」：TA 名下的日子走 TA 的钟
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8");

test("往期线下进提示词时，日子按 TA 的钟", () => {
  // 11-15 起往期线下写成「第 N 场（几点到几点）」，钟点走 fmtStampAI（它认 TA 的钟），不再是只有日子的 vDate
  assert.match(app, /const when = "第 " \+ \(k \+ 1\) \+ " 场（" \+ fmtStampAI\(x\.startTs \|\| x\.endTs, char\.id\) \+ " 到 " \+ fmtStampAI\(x\.endTs, char\.id\)/);
});
test("TA 日记被翻出来当卡片标题时，日子按 TA 的钟", () => {
  assert.match(app, /title: x\.titleZh \|\| \(x\.ts \? vDate\(x\.ts, char\.id\)\.toLocaleDateString/);
});
test("日记目录「最后一篇」：TA 的按 TA 的钟，自己的照主面具那只钟", () => {
  assert.match(ui, /vDate\(last\.ts, c\.isMe \? null : c\.id\)\.toLocaleDateString/);
});
test("日记封面最新一篇的日子按 TA 的钟", () => {
  assert.match(ui, /const lastD = last \? vDate\(last\.ts, char && !char\.isMe \? char\.id : null\) : null;/);
});
