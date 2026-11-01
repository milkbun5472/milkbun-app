// 「记忆上下文条数」说了算（她 2026-10-31 定「1」）：回复时带的条数照拉条，最少 80，最近几天的也算进来
require("node:test")("线上回复的窗口照拉条走", () => {
  const assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8"), cmp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(app, /return Math\.min\(1000, Math\.max\(80, n, inFloor\)\);/);
  assert.match(app, /: \{ maxChars: Math\.max\(14000, _ctxWant \* 260, Number\(\(memCfgRef\.current \|\| \{\}\)\.recentBudget\) \|\| 0\), maxMessages: _ctxWant \};/);
  assert.match(cmp, /value: Math\.max\(80, ctxN\),\n\s*min: 80,\n\s*max: 1000,/);
});
