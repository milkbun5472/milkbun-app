// 群里 2026-11-11「app 还有哪些地方应该接虚拟时间」：TA 名下的日子走 TA 的钟
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8");

test("往期线下进提示词时，日子按 TA 的钟", () => {
  assert.match(app, /const when = vDate\(x\.startTs \|\| x\.endTs, char\.id\)\.toLocaleDateString\(/);
});
test("TA 日记被翻出来当卡片标题时，日子按 TA 的钟", () => {
  assert.match(app, /title: x\.titleZh \|\| \(x\.ts \? vDate\(x\.ts, char\.id\)\.toLocaleDateString/);
});
test("日记目录「最后一篇」：TA 的按 TA 的钟，自己的照现实", () => {
  assert.match(ui, /\(c\.isMe \? new Date\(last\.ts\) : vDate\(last\.ts, c\.id\)\)\.toLocaleDateString/);
});
test("日记封面最新一篇的日子按 TA 的钟", () => {
  assert.match(ui, /const lastD = last \? \(char && !char\.isMe \? vDate\(last\.ts, char\.id\) : new Date\(last\.ts\)\) : null;/);
});
