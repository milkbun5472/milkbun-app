// 群里 2026-10-10 截图：通话气泡里漏出 <#0.4#>；线下也会漏——停顿记号只给语音用，屏幕上不摆
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("通话气泡、线下正文显示前剥掉停顿记号", () => {
  assert.match(c, /function TransText\([^)]*\) \{\n  const \[autoShow\] = useOnlineTranslationAuto\(\);\n[\s\S]{0,200}if \(typeof text === "string" && text\.indexOf\("<#"\) >= 0 && typeof stripPauseMarks === "function"\) text = stripPauseMarks\(text\);/);
  assert.match(c, /const segs = offSplit\(typeof stripPauseMarks === "function" \? stripPauseMarks\(text\) : text\);/);
});
