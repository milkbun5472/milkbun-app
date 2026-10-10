// 她 2026-10-10：群聊自发聊天大半夜还在说话——单聊主动有「8 点前 23 点后不发」，群聊那条巡检没跟上
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const a = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("群自发聊天：醒着的凑不够两人就不起这一轮，钟跟单聊主动同一个", () => {
  const i = a.indexOf("const scanAutoGroups"), seg = a.slice(i > 0 ? i : a.indexOf("BORROW_GAP_MS"), a.indexOf("const timer = setInterval(scanAutoGroups"));
  assert.match(seg, /const awake = gm\.filter\(c => \{ const hr = Math\.floor\(charLocalMin\(c\) \/ 60\); return hr >= 8 && hr <= 23; \}\);/);
  assert.match(seg, /if \(awake\.length < Math\.min\(2, gm\.length\)\) continue;/);
});
