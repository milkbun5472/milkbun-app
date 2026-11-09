// 「记忆上下文条数」说了算（她 2026-10-31 定「1」）：回复时带的条数照拉条，最少 80。
// 2026-11-04 收紧：原来「最近几天的也算进来」（Math.max(80, n, inFloor)）会越过拉条——
// 聊得密的人三天内攒上千条，那一项自己顶到 1000 条、字数跟着 26 万字（约 20 万 token），
// 而人一个拉条都没动过。按天只许在拉条额度之内优先装，不许把额度撑大。
require("node:test")("线上回复的窗口照拉条走，按天那一条不许越过它", () => {
  const assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), cmp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(app, /const want = Math\.max\(80, n\);/);
  assert.match(app, /return Math\.min\(1000, want\);/);
  assert.ok(!/Math\.max\(80, n, inFloor\)/.test(app), "按天那一条又回去撑额度了");
  assert.match(app, /: \{ maxChars: Math\.max\(14000, _ctxWant \* 260, Number\(\(memCfgRef\.current \|\| \{\}\)\.recentBudget\) \|\| 0\), maxMessages: _ctxWant \};/);
  assert.match(cmp, /value: Math\.max\(80, ctxN\),\n\s*min: 80,\n\s*max: 1000,/);
});
