// 群里 2026-10-10 截图：通话气泡里漏出 <#0.4#>；线下也会漏——停顿记号只给语音用，屏幕上不摆
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("通话气泡、线下正文显示前剥掉停顿记号", () => {
  assert.match(c, /function TransText\([^)]*\) \{\n  const \[autoShow\] = useOnlineTranslationAuto\(\);\n[\s\S]{0,400}if \(typeof text === "string" && typeof showClean === "function"\) text = showClean\(text, isU\);/);
  assert.match(c, /const segs = offSplit\(typeof stripPauseMarks === "function" \? stripPauseMarks\(text\) : text\);/);
});
test("译文那一行也剥停顿记号（她 2026-11-04：「亲爱的 <#0.5#> 我已经…」）", () => {
  const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(c, /if \(z && z\.indexOf\("<#"\) >= 0 && typeof stripPauseMarks === "function"\) z = stripPauseMarks\(z\);/);
  assert.match(c, /const _z0 = typeof stripPauseMarks === "function" && String\(r\.zh \|\| ""\)\.indexOf\("<#"\) >= 0 \? stripPauseMarks\(r\.zh\) : r\.zh;/);
});
